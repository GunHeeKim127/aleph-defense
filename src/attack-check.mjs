// 실제 요청의 상태/개수만 기록합니다. 토큰·메모 본문·키를 반환하지 않습니다.
// 현재 배포에 실제 요청을 보내 상태와 공개 노출 여부를 기록합니다.
export async function runAttackChecks(config) {
  const app = new URL(config.publicAppUrl);
  if (app.protocol !== 'https:' || app.username || app.password || app.search || app.hash || app.pathname !== '/' || app.hostname.endsWith('.example')) throw new Error('실제 배포 주소가 필요합니다.');
  const results = [];
  // 자기 점검용 HTTPS 요청을 시간 제한과 함께 보냅니다.
  const request = async (path, options = {}) => {
    if (typeof path !== 'string' || !/^\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]*$/u.test(path)) throw new Error('path_format');
    return fetch(new URL(path, app).href, { ...options, redirect: 'error', signal: AbortSignal.timeout(10000) });
  };
  const staticResponse = await request('/data.json');
  let count = null;
  try { const data = await staticResponse.json(); if (Array.isArray(data.notes)) count = data.notes.length; } catch { }
  results.push({ attackId: 'static_note_read', expected: '정적 메모 0건', observed: `HTTP ${staticResponse.status} · 메모 개수 ${count ?? '확인 불가'}` });
  // 제출 묶음의 네트워크 자기 점검은 격리 환경 계약에 맞춰 읽기 요청만 사용합니다.
  for (const [path, id] of [['/api/notes', 'anonymous_list'], ['/api/notes/00000000-0000-4000-8000-000000000001', 'anonymous_get']]) {
    const response = await request(path);
    let jsonError = false;
    try { const data = await response.json(); jsonError = typeof data?.error === 'string' && !Array.isArray(data.notes); } catch { }
    results.push({ attackId: id, expected: '무로그인 401 또는 403 JSON 오류, 자료 없음', observed: `HTTP ${response.status} · JSON 오류 ${jsonError ? '확인' : '미확인'}` });
  }
  return results;
}
