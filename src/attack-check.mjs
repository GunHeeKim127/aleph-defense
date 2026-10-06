import { readFile } from 'node:fs/promises';
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
  results.push({attackId:'deployment_identity',expected:'aleph.json 열림, 단계 5',observed:`HTTP ${deployment.status} · 단계 ${step ?? '확인 불가'}`});
  results.push({attackId:'account_a_crud',expected:'5단계 서버 로그인 및 본인 CRUD 정상',observed:'4단계 사용자 CRUD 확인 완료. 5단계 쿠키 로그인 전환 후 실계정 확인은 미실행'});
  results.push({attackId:'account_b_other_note',expected:'A/B 상대 메모 조회·수정·삭제와 소유자 변경 거부',observed:'4단계 양방향 403·소유자 변경 거부 사용자 화면 확인 완료. 5단계 실계정 재확인은 미실행'});
  const publicConfig = JSON.parse(await readFile(new URL('../config/auth.json', import.meta.url), 'utf8'));
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(publicConfig.publishableKey || '')
      || publicConfig.projectUrl + '/auth/v1' !== config.identityProvider.issuer) throw new Error('공개 DB 점검 설정을 확인하세요.');
  const directUrl = new URL(config.originalApiUrl);
  if (directUrl.protocol !== 'https:' || directUrl.origin !== new URL(publicConfig.projectUrl).origin || directUrl.search) throw new Error('원본 자료 경로를 확인하세요.');
  directUrl.searchParams.set('select','id'); directUrl.searchParams.set('limit','1');
  const direct = await fetch(directUrl, {
    headers: { apikey: publicConfig.publishableKey }, redirect: 'error', signal: AbortSignal.timeout(10000),
  });
  results.push({ attackId: 'anonymous_direct_data_api', expected: '공개 키만 사용하는 anon 직접 읽기 401/403 거부', observed: `HTTP ${direct.status} · 인증 사용자 토큰/서버 키 미사용` });
  let exposed = false;
  for (const path of ['/', '/app.js', '/login-config.json', '/config/auth.json']) {
    const response = await request(path); const body = await response.text();
    exposed ||= body.includes(publicConfig.publishableKey) || /sb_publishable_[A-Za-z0-9_-]{12,}/.test(body);
  }
  results.push({attackId:'browser_key_exposure',expected:'첫 화면·JS·이전 키 경로에 공개 키 없음',observed:exposed?'공개 키 노출 발견':'공개 키 노출 없음'});
  const session=await request('/api/auth');
  let loggedOut=false;try{loggedOut=(await session.json()).authenticated===false}catch{}
  results.push({attackId:'server_auth_state',expected:'무로그인 상태는 authenticated false, 토큰 반환 없음',observed:`HTTP ${session.status} · 비로그인 상태 ${loggedOut?'확인':'미확인'}`});
  const manifest=await request('/aleph.json');let routeCount=0;
  try{const data=await manifest.json();routeCount=Array.isArray(data.allowedRoutes)?data.allowedRoutes.length:0}catch{}
  results.push({attackId:'allowed_routes_manifest',expected:'aleph.json에 허용 경로 1개 이상',observed:`HTTP ${manifest.status} · 허용 경로 ${routeCount}개`});
  return results;
}
