// Public endpoint in step 2. Never expose upstream errors or credentials.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: '요청 방식을 확인하세요.' });
  }
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  try {
    const base = new URL(url);
    if (base.protocol !== 'https:' || base.username || base.password || !key) throw new Error();
    const upstream = new URL('/rest/v1/learning_notes?select=title,content&order=id.asc', base);
    const response = await fetch(upstream, {
      headers: { apikey: key }, redirect: 'error', signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error();
    const rows = await response.json();
    if (!Array.isArray(rows) || rows.length !== 4 || rows.some(n =>
      typeof n.title !== 'string' || typeof n.content !== 'string')) throw new Error();
    return res.status(200).json({ notes: rows.map(({ title, content }) => ({ title, content })) });
  } catch {
    return res.status(503).json({ error: '자료를 불러올 수 없습니다. 잠시 후 다시 시도하세요.' });
  }
}
