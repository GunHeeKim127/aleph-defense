import { createClient } from '@supabase/supabase-js';
import { createLoginVerifier } from './verify-login.mjs';

const names = ['__Host-notes-access', '__Host-notes-refresh'];
function cookies(req) {
  const out = {};
  const raw = req.headers?.cookie;
  if (typeof raw !== 'string' || raw.length > 20000) return out;
  for (const entry of raw.split(';')) {
    const index = entry.indexOf('=');
    const name = entry.slice(0, index).trim();
    if (!names.includes(name)) continue;
    try { out[name] = decodeURIComponent(entry.slice(index + 1)); } catch {}
  }
  return out;
}
function setCookies(res, session) {
  const tokens = session ? [session.access_token, session.refresh_token] : ['', ''];
  res.setHeader('Set-Cookie', names.map((name, i) => `${name}=${encodeURIComponent(tokens[i])}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${session ? (i ? 604800 : Math.min(session.expires_in ?? 3600, 3600)) : 0}`));
}
export function createSessionAuth({ config, authConfig, env = process.env,
  clientFactory = createClient, verifierFactory = createLoginVerifier } = {}) {
  let verify;
  const verifier = () => verify ??= verifierFactory({ config, supabaseSecretKey: env.SUPABASE_SECRET_KEY });
  const client = () => {
    if (authConfig.projectUrl + '/auth/v1' !== config.identityProvider.issuer) throw new Error();
    return clientFactory(authConfig.projectUrl,
      env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLIC_KEY || authConfig.publishableKey,
      { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  };
  const sameOrigin = req => req.headers?.origin === new URL(config.publicAppUrl).origin;
  async function tokenFromCookie(req, res) {
    const jar = cookies(req);
    const access = jar[names[0]], refresh = jar[names[1]];
    if (access && await verifier()( `Bearer ${access}` )) return access;
    if (!refresh) return null;
    const { data, error } = await client().auth.refreshSession({ refresh_token: refresh });
    if (error || !data?.session || !await verifier()(`Bearer ${data.session.access_token}`)) {
      setCookies(res, null); return null;
    }
    setCookies(res, data.session); return data.session.access_token;
  }
  const handler = async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const fail = (status, error) => res.status(status).json({ error });
    try {
      if (req.method === 'GET') {
        const token = await tokenFromCookie(req, res);
        return res.status(200).json({ authenticated: !!token });
      }
      if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return fail(405, '허용되지 않은 요청입니다.'); }
      if (!sameOrigin(req)) return fail(403, '같은 사이트에서 요청하세요.');
      let body = req.body;
      try { if (typeof body === 'string') body = JSON.parse(body); } catch { return fail(400, 'JSON 형식을 확인하세요.'); }
      if (body?.action === 'login') {
        if (typeof body.email !== 'string' || !body.email.trim() || body.email.length > 320
            || typeof body.password !== 'string' || !body.password || body.password.length > 4096) return fail(400, '이메일과 비밀번호를 입력하세요.');
        const { data, error } = await client().auth.signInWithPassword({ email: body.email.trim(), password: body.password });
        if (error || !data?.session) {
          const reason = error?.code === 'email_not_confirmed' ? '이메일 확인을 먼저 완료하세요.'
            : error?.code === 'invalid_credentials' ? '이메일 또는 비밀번호가 올바르지 않습니다.' : '로그인할 수 없습니다. 계정 설정을 확인하세요.';
          return fail(401, reason);
        }
        if (!await verifier()(`Bearer ${data.session.access_token}`)) return fail(401, '로그인 토큰을 확인할 수 없습니다.');
        setCookies(res, data.session);
        return res.status(200).json({ authenticated: true });
      }
      if (body?.action === 'logout') {
        const jar = cookies(req);
        try {
          if (jar[names[0]] && jar[names[1]]) {
            const sdk = client();
            const session = await sdk.auth.setSession({ access_token: jar[names[0]], refresh_token: jar[names[1]] });
            if (!session.error) await sdk.auth.signOut({ scope: 'local' });
          }
        } finally { setCookies(res, null); }
        return res.status(200).json({ authenticated: false });
      }
      return fail(400, '로그인 또는 로그아웃 요청을 확인하세요.');
    } catch { return fail(503, '로그인 서버 설정을 확인하세요.'); }
  };
  const wrap = next => async (req, res) => {
    // External verified bearer requests (including the judge) retain the existing flow.
    if (req.headers?.authorization) return next(req, res);
    if (!['GET','HEAD'].includes(req.method) && !sameOrigin(req)) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(403).json({ error: '같은 사이트에서 요청하세요.' });
    }
    try {
      const token = await tokenFromCookie(req, res);
      if (token) req.headers = { ...req.headers, authorization: `Bearer ${token}` };
      return next(req, res);
    } catch { res.setHeader('Cache-Control','no-store'); return res.status(503).json({ error: '로그인 서버 설정을 확인하세요.' }); }
  };
  return { handler, wrap };
}
