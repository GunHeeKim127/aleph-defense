// 실제 요청의 상태/개수만 기록합니다. 토큰·메모 본문·키를 반환하지 않습니다.
export async function runAttackChecks(config) {
  const app = new URL(config.publicAppUrl);
  if (app.protocol !== 'https:' || app.username || app.password || app.search || app.hash || app.pathname !== '/' || app.hostname.endsWith('.example')) throw new Error('실제 배포 주소가 필요합니다.');
  const results = [];
  const request = async (path, options = {}) => fetch(new URL(path, app), { ...options, redirect: 'error', signal: AbortSignal.timeout(10000) });
  const staticResponse = await request('/data.json');
  let count = null;
  try { const data = await staticResponse.json(); if (Array.isArray(data.notes)) count = data.notes.length; } catch {}
  results.push({attackId:'static_note_read',expected:'정적 메모 0건',observed:`HTTP ${staticResponse.status} · 메모 개수 ${count ?? '확인 불가'}`});
  for (const [method,path,id] of [['GET','/api/notes','anonymous_list'],['POST','/api/notes','anonymous_create'],['GET','/api/notes/00000000-0000-4000-8000-000000000001','anonymous_get'],['PUT','/api/notes/00000000-0000-4000-8000-000000000001','anonymous_update'],['DELETE','/api/notes/00000000-0000-4000-8000-000000000001','anonymous_delete']]) {
    const response = await request(path,{method});
    let jsonError=false;
    try { const data=await response.json();jsonError=typeof data?.error==='string' && !Array.isArray(data.notes); } catch {}
    results.push({attackId:id,expected:'무로그인 401 또는 403 JSON 오류, 자료 없음',observed:`HTTP ${response.status} · JSON 오류 ${jsonError ? '확인' : '미확인'}`});
  }
  const invalid=await request('/api/notes',{headers:{Authorization:'Bearer invalid'}});
  results.push({attackId:'invalid_login',expected:'잘못된 인증 401 JSON 오류',observed:`HTTP ${invalid.status}`});
  const page=await request('/');
  results.push({attackId:'security_header',expected:'첫 화면 nosniff',observed:`HTTP ${page.status} · nosniff ${page.headers.get('x-content-type-options') === 'nosniff' ? '확인' : '미확인'}`});
  const deployment=await request('/aleph.json');
  let step=null;try{step=(await deployment.json()).step}catch{}
  results.push({attackId:'deployment_identity',expected:'aleph.json 열림, 단계 3',observed:`HTTP ${deployment.status} · 단계 ${step ?? '확인 불가'}`});
  results.push({attackId:'account_a_crud',expected:'실제 A 로그인·로그아웃 및 추가·수정·삭제 성공, 삭제 후 GET 404',observed:'미실행: 사용자가 A 계정으로 화면에서 확인 필요'});
  results.push({attackId:'account_b_other_note',expected:'3단계 타인 메모 개별 접근 허점 기록, 4단계에서 보호',observed:'실계정 미실행. 소유자 검사 없음은 코드와 로컬 모의 시험에서 확인'});
  return results;
}
