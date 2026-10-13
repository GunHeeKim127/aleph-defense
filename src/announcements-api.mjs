import { createLoginVerifier } from './verify-login.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
// 공지와 메모가 같은 UUID를 써도 서로 다른 자원으로 식별되게 합니다.
const announcementResourceId = id => `announcement:${id}`;

// 검증된 로그인과 저장된 작성자·강사 권한을 함께 확인하는 공지 API를 만듭니다.
export function createAnnouncementsHandler({ config, env = process.env,
  fetchImpl = (...args) => fetch(...args), verifierFactory = createLoginVerifier } = {}) {
  let verify;
  // 공지 한 건의 읽기와 수정만 처리하며 기능 선택용 쿼리를 거부합니다.
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const error = (status, message) => res.status(status).json({ error: message });
    if (!req.headers?.authorization) return error(401, '로그인이 필요합니다.');
    let identity;
    try {
      verify ??= verifierFactory({ config, supabaseSecretKey: env.SUPABASE_SECRET_KEY });
      identity = await verify(req.headers.authorization);
    } catch { return error(503, '로그인 확인 설정을 확인하세요.'); }
    if (!identity || typeof identity.userId !== 'string' || !UUID.test(identity.userId)) {
      return error(401, '로그인 정보가 유효하지 않습니다. 다시 로그인하세요.');
    }
    const queryKeys = Object.entries(req.query ?? {}).filter(([, value]) => value !== undefined).map(([key]) => key);
    if (queryKeys.some(key => key !== 'id')) return error(403, '자료는 경로의 ID로만 선택할 수 있습니다.');
    if (!['GET', 'PUT'].includes(req.method)) {
      res.setHeader('Allow', 'GET, PUT');
      return error(405, '허용되지 않은 요청입니다.');
    }
    const id = req.query?.id;
    if (typeof id !== 'string' || !UUID.test(id)) return error(400, '공지 ID는 UUID여야 합니다.');
    let payload;
    if (req.method === 'PUT') {
      if (identity.isInstructor !== true) return error(403, '강사 공지는 강사만 수정할 수 있습니다.');
      let input = req.body;
      try { if (typeof input === 'string') input = JSON.parse(input); } catch { return error(400, 'JSON 형식을 확인하세요.'); }
      if (!input || typeof input !== 'object' || Array.isArray(input)
          || Object.hasOwn(input, 'author_id') || Object.hasOwn(input, 'role')
          || typeof input.title !== 'string' || !input.title.trim() || input.title.length > 200
          || typeof input.body !== 'string' || !input.body.trim() || input.body.length > 10000) {
        return error(400, '공지 제목과 내용을 확인하세요.');
      }
      payload = { title: input.title, content: input.body, author_id: identity.userId };
    }
    try {
      const base = new URL(env.SUPABASE_URL);
      if (base.protocol !== 'https:' || base.username || base.password
          || base.origin + '/auth/v1' !== config.identityProvider.issuer || !env.SUPABASE_SECRET_KEY) throw new Error();
      const url = new URL('/rest/v1/learning_announcements', base);
      url.searchParams.set('select', 'id,title,body:content,author_id');
      url.searchParams.set('id', 'eq.' + id);
      const check = await fetchImpl(url, { method: 'GET',
        headers: { apikey: env.SUPABASE_SECRET_KEY }, redirect: 'error',
        signal: AbortSignal.timeout(10000) });
      if (!check.ok) return error(503, '자료를 처리할 수 없습니다.');
      const existing = await check.json();
      if (!Array.isArray(existing) || existing.length > 1) throw new Error();
      if (!existing.length) return error(404, '공지를 찾을 수 없습니다.');
      if (req.method === 'GET') {
        const { title, body } = existing[0];
        return res.status(200).json({ id, resourceId: announcementResourceId(id), title, body });
      }
      if (existing[0].author_id !== identity.userId) return error(403, '본인이 작성한 강사 공지만 수정할 수 있습니다.');
      url.searchParams.set('author_id', 'eq.' + identity.userId);
      const upstream = await fetchImpl(url, { method: 'PATCH',
        headers: { apikey: env.SUPABASE_SECRET_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify(payload), redirect: 'error', signal: AbortSignal.timeout(10000) });
      if (!upstream.ok) return error(503, '자료를 처리할 수 없습니다.');
      const rows = await upstream.json();
      if (!Array.isArray(rows)) throw new Error();
      if (!rows.length) return error(404, '공지를 찾을 수 없습니다.');
      if (rows.length !== 1 || rows[0].author_id !== identity.userId) throw new Error();
      const { title, body } = rows[0];
      return res.status(200).json({ id, resourceId: announcementResourceId(id), title, body });
    } catch { return error(503, '자료를 처리할 수 없습니다.'); }
  };
}
