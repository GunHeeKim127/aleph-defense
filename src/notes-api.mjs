import { randomUUID } from 'node:crypto';
import { createLoginVerifier } from './verify-login.mjs';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function createNotesHandler({ config, single = false, env = process.env,
  fetchImpl = (...args) => fetch(...args), verifierFactory = createLoginVerifier } = {}) {
  let verify;
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const error = (status, message) => res.status(status).json({ error: message });
    if (!req.headers?.authorization) return error(401, '로그인이 필요합니다.');
    let identity;
    try {
      verify ??= verifierFactory({ config, supabaseSecretKey: env.SUPABASE_SECRET_KEY });
      identity = await verify(req.headers.authorization);
    } catch { return error(503, '로그인 확인 설정을 확인하세요.'); }
    if (!identity || typeof identity.userId !== 'string' || !UUID.test(identity.userId)) return error(401, '로그인 정보가 유효하지 않습니다. 다시 로그인하세요.');
    if (req.query && Object.hasOwn(req.query, 'owner_id')) return error(403, '메모 소유자는 변경할 수 없습니다.');
    const methods = single ? ['GET', 'PUT', 'DELETE'] : ['GET', 'POST'];
    if (!methods.includes(req.method)) {
      res.setHeader('Allow', methods.join(', '));
      return error(405, '허용되지 않은 요청입니다.');
    }
    const id = single ? req.query?.id : undefined;
    if (single && (typeof id !== 'string' || !UUID.test(id))) return error(400, '메모 ID는 UUID여야 합니다.');
    let payload;
    if (req.method === 'POST' || req.method === 'PUT') {
      let input = req.body;
      try { if (typeof input === 'string') input = JSON.parse(input); } catch { return error(400, 'JSON 형식을 확인하세요.'); }
      if (input && typeof input === 'object' && Object.hasOwn(input, 'owner_id')) return error(403, '메모 소유자는 변경할 수 없습니다.');
      if (!input || typeof input !== 'object' || Array.isArray(input)
          || typeof input.title !== 'string' || !input.title.trim() || input.title.length > 200
          || typeof input.body !== 'string' || !input.body.trim() || input.body.length > 10000) return error(400, '제목과 가상 메모 내용을 입력하세요.');
      payload = { title: input.title, content: input.body };
      if (req.method === 'POST') {
        if (input.id !== undefined && (typeof input.id !== 'string' || !UUID.test(input.id))) return error(400, '메모 ID는 UUID여야 합니다.');
        payload.id = input.id ?? randomUUID();
        payload.owner_id = identity.userId;
      }
    }
    try {
      const base = new URL(env.SUPABASE_URL);
      if (base.protocol !== 'https:' || base.username || base.password
          || base.origin + '/auth/v1' !== config.identityProvider.issuer || !env.SUPABASE_SECRET_KEY) throw new Error();
      const url = new URL('/rest/v1/learning_notes', base);
      url.searchParams.set('select', 'id,title,body:content,owner_id');
      if (single) url.searchParams.set('id', 'eq.' + id);
      else if (req.method === 'GET') url.searchParams.set('owner_id', 'eq.' + identity.userId);
      if (req.method === 'GET') url.searchParams.set('order', 'id.asc');
      if (single) {
        const check = await fetchImpl(url, {
          headers: { apikey: env.SUPABASE_SECRET_KEY }, method: 'GET',
          redirect: 'error', signal: AbortSignal.timeout(10000),
        });
        if (!check.ok) return error(503, '자료를 처리할 수 없습니다.');
        const existing = await check.json();
        if (!Array.isArray(existing) || existing.length > 1) throw new Error();
        if (!existing.length) return error(404, '메모를 찾을 수 없습니다.');
        if (existing[0].owner_id !== identity.userId) return error(403, '본인 메모만 접근할 수 있습니다.');
        if (req.method === 'GET') {
          const { id, title, body } = existing[0];
          return res.status(200).json({ id, title, body });
        }
        // Recheck the existing owner atomically during mutation, even if it changes after the read.
        url.searchParams.set('owner_id', 'eq.' + identity.userId);
        if (req.method === 'PUT') payload.owner_id = identity.userId;
      }
      const upstream = await fetchImpl(url, {
        method: req.method === 'PUT' ? 'PATCH' : req.method,
        headers: { apikey: env.SUPABASE_SECRET_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        ...(payload ? { body: JSON.stringify(payload) } : {}),
        redirect: 'error', signal: AbortSignal.timeout(10000),
      });
      if (!upstream.ok) return error(upstream.status === 409 ? 409 : 503,
        upstream.status === 409 ? '이미 사용 중인 메모 ID입니다.' : '자료를 처리할 수 없습니다.');
      const rows = await upstream.json();
      if (!Array.isArray(rows)) throw new Error();
      if (single && rows.length === 0) return error(404, '메모를 찾을 수 없습니다.');
      if (rows.some(row => row.owner_id !== identity.userId)) throw new Error();
      if (req.method === 'POST') return res.status(201).json({ id: payload.id });
      if (req.method === 'DELETE') return res.status(204).end();
      const clean = rows.map(({ id, title, body }) => ({ id, title, body }));
      return res.status(200).json(single ? clean[0] : clean);
    } catch { return error(503, '자료를 처리할 수 없습니다.'); }
  };
}
