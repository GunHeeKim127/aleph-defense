import { createHash, timingSafeEqual } from 'node:crypto';
import { createLoginVerifier } from './verify-login.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const sha256 = value => createHash('sha256').update(value, 'utf8').digest('hex');

export function loadVerifiedNoteBackup(env = process.env) {
  const raw = env.RESTORE_NOTE_BACKUP_JSON;
  const expected = env.RESTORE_NOTE_BACKUP_SHA256;
  if (typeof raw !== 'string' || !/^[0-9a-f]{64}$/i.test(expected ?? '')) {
    throw new Error('검증한 비공개 메모 사본이 없습니다.');
  }
  const actual = sha256(raw);
  if (!timingSafeEqual(Buffer.from(actual), Buffer.from(expected.toLowerCase()))) {
    throw new Error('비공개 메모 사본 검증에 실패했습니다.');
  }
  const backup = JSON.parse(raw);
  const note = backup?.note;
  if (backup?.schema !== 'aleph.private-note-backup.v1'
      || !UUID.test(note?.id ?? '') || !UUID.test(note?.ownerId ?? '')
      || typeof note?.title !== 'string' || !note.title.trim() || note.title.length > 200
      || typeof note?.body !== 'string' || !note.body.trim() || note.body.length > 10000
      || !/^[0-9a-f]{64}$/i.test(note?.contentSha256 ?? '')
      || sha256(note.body) !== note.contentSha256.toLowerCase()) {
    throw new Error('비공개 메모 사본 내용 검증에 실패했습니다.');
  }
  return note;
}

export function createRestoreNoteHandler({ config, env = process.env,
  fetchImpl = (...args) => fetch(...args), verifierFactory = createLoginVerifier,
  backupLoader = loadVerifiedNoteBackup } = {}) {
  let verify;
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const error = (status, message) => res.status(status).json({ error: message });
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return error(405, '허용되지 않은 요청입니다.'); }
    if (!req.headers?.authorization) return error(401, '로그인이 필요합니다.');
    let identity;
    try {
      verify ??= verifierFactory({ config, supabaseSecretKey: env.SUPABASE_SECRET_KEY });
      identity = await verify(req.headers.authorization);
    } catch { return error(503, '로그인 확인 설정을 확인하세요.'); }
    if (!UUID.test(identity?.userId ?? '')) return error(401, '로그인 정보가 유효하지 않습니다.');
    const id = req.query?.id;
    if (!UUID.test(id ?? '') || Object.keys(req.query ?? {}).some(key => key !== 'id')) {
      return error(400, '복구 대상 메모 ID를 경로로 지정하세요.');
    }
    if (req.body && (typeof req.body !== 'object' || Object.keys(req.body).length)) {
      return error(400, '복구 내용과 권한은 요청 본문에서 받지 않습니다.');
    }
    let note;
    try { note = backupLoader(env); } catch { return error(503, '검증한 비공개 메모 사본을 확인할 수 없습니다.'); }
    if (note.id !== id) return error(404, '지정한 복구 대상이 사본에 없습니다.');
    if (note.ownerId !== identity.userId) return error(403, '사본 소유자만 복구할 수 있습니다.');
    try {
      const base = new URL(env.SUPABASE_URL);
      if (base.protocol !== 'https:' || base.username || base.password
          || base.origin + '/auth/v1' !== config.identityProvider.issuer || !env.SUPABASE_SECRET_KEY) throw new Error();
      const url = new URL('/rest/v1/learning_notes', base);
      url.searchParams.set('select', 'id,owner_id,content');
      url.searchParams.set('id', 'eq.' + note.id);
      const checked = await fetchImpl(url, { method: 'GET', headers: { apikey: env.SUPABASE_SECRET_KEY }, redirect: 'error' });
      if (!checked.ok) throw new Error();
      const existing = await checked.json();
      if (!Array.isArray(existing) || existing.length > 1) throw new Error();
      if (existing.length && existing[0].owner_id !== note.ownerId) return error(403, '저장된 메모 소유자가 사본과 다릅니다.');
      if (existing.length && sha256(existing[0].content ?? '') === note.contentSha256.toLowerCase()) {
        return res.status(200).json({ id: note.id, ownerVerified: true, contentSha256: note.contentSha256, restored: false });
      }
      const mutation = new URL(url);
      mutation.searchParams.set('owner_id', 'eq.' + note.ownerId);
      const method = existing.length ? 'PATCH' : 'POST';
      if (!existing.length) { mutation.searchParams.delete('id'); mutation.searchParams.delete('owner_id'); }
      const payload = { id: note.id, owner_id: note.ownerId, title: note.title, content: note.body };
      const changed = await fetchImpl(mutation, {
        method, headers: { apikey: env.SUPABASE_SECRET_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify(payload), redirect: 'error',
      });
      if (!changed.ok) return error(changed.status === 409 ? 409 : 503, '메모 한 건을 복구할 수 없습니다.');
      const rows = await changed.json();
      if (!Array.isArray(rows) || rows.length !== 1 || rows[0].id !== note.id
          || rows[0].owner_id !== note.ownerId || sha256(rows[0].content ?? '') !== note.contentSha256.toLowerCase()) throw new Error();
      return res.status(200).json({ id: note.id, ownerVerified: true, contentSha256: note.contentSha256, restored: true });
    } catch { return error(503, '메모 한 건을 복구할 수 없습니다.'); }
  };
}
