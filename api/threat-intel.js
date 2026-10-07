// Packaging starter only. Implement server-side authentication, official
// NVD/CISA retrieval, six-hour caching, and a fetched-at timestamp.
// 아직 구현하지 않은 API임을 오류 응답으로 알립니다.
export default function handler(_request, response) {
  response.setHeader('Cache-Control', 'no-store');
  response.status(501).json({ error: 'THREAT_INTEL_NOT_IMPLEMENTED' });
}
