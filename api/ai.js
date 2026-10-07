// Packaging starter only. Implement server-side authentication, a per-user
// daily limit, and a server-held AI key before using this endpoint.
// 아직 구현하지 않은 API임을 오류 응답으로 알립니다.
export default function handler(_request, response) {
  response.setHeader('Cache-Control', 'no-store');
  response.status(501).json({ error: 'AI_PROXY_NOT_IMPLEMENTED' });
}
