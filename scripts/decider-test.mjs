import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fixtureRequests } from './fixture-7.mjs';

const RESPONSE_KEYS = 'decision,reasonCode,requestId,ruleIds,schema';

// 판정 응답의 계약과 규칙 이름이 올바른지 검사합니다.
function validResponse(request, response, ruleIds) {
  return response && typeof response === 'object' && !Array.isArray(response)
    && Object.keys(response).sort().join(',') === RESPONSE_KEYS
    && response.schema === 'aleph.decision.v1'
    && response.requestId === request.requestId
    && ['allow', 'deny', 'step_up'].includes(response.decision)
    && typeof response.reasonCode === 'string'
    && /^[a-z][a-z0-9_]{0,63}$/u.test(response.reasonCode)
    && Array.isArray(response.ruleIds) && response.ruleIds.length > 0
    && response.ruleIds.every(id => ruleIds.includes(id));
}

// Local practice only. The class engine and the server judge validate live requests separately.
// 가상 요청으로 판정기를 연습하며 실제 심판 판정을 대신하지 않습니다.
export async function checkDecider({ decide, ruleIds }) {
  if (typeof decide !== 'function' || !Array.isArray(ruleIds)
      || !ruleIds.includes('device_registered')) {
    throw new Error('6단계 device_registered 규칙을 먼저 구현하고 RULE_IDS에 적어 주세요.');
  }
  const { normal, suspicious } = fixtureRequests();
  const checks = [
    { name: '등록 기기의 정상 요청', request: normal, decision: 'allow' },
    { name: '미등록 기기의 가상 요청', request: { ...normal, requestId: randomUUID(),
      deviceRegistered: false }, decision: 'deny', reasonCode: 'device_not_registered' },
    { name: '기기 등록값 없는 가상 요청', request: { ...normal, requestId: randomUUID(),
      deviceRegistered: undefined }, decision: 'deny', reasonCode: 'device_not_registered' },
  ];
  if (ruleIds.includes('step_up_required')) {
    checks.push(
      { name: '복합 이상 접속', request: suspicious, decision: 'step_up',
        reasonCode: 'step_up_required' },
      { name: '다시 확인한 복합 이상 접속', request: { ...suspicious,
        requestId: randomUUID(), stepUp: { verified: true, authAgeSeconds: 60 } },
      decision: 'allow' },
      { name: '위조한 클라이언트 신호는 승격하지 않음', request: { ...suspicious,
        requestId: randomUUID(), signals: { source: 'client_header', region: 'foreign',
          network: 'unusual', hour: 3 }, headers: { 'x-region': 'foreign' } }, decision: 'allow' },
      { name: '지역 하나만 다른 요청', request: { ...normal, requestId: randomUUID(),
        signals: { source: 'judge_fixture', region: 'foreign', network: 'usual', hour: 14 } },
      decision: 'allow' },
      { name: '접속 정보가 없는 요청은 값을 만들지 않음', request: { ...normal,
        requestId: randomUUID(), signals: undefined }, decision: 'allow' },
      { name: '실제 경로의 불명확 신호는 가상 위치 근거가 아님', request: { ...suspicious,
        requestId: randomUUID(), signals: { source: 'none', region: 'unknown',
          network: 'unknown', hour: 3 } }, decision: 'allow' },
    );
  }
  if (ruleIds.includes('resource_zone_access')) {
    checks.push(
      { name: '메모 한 건 읽기', request: { ...normal, requestId: randomUUID() },
        decision: 'allow' },
      { name: '메모 한 건 수정', request: { ...normal, requestId: randomUUID(),
        subjectId: 'student-a', method: 'PUT', path: '/notes/note-a-1',
        route: 'PUT /notes/:id' }, decision: 'allow' },
      { name: '사용자 표지가 끝에 있는 자기 메모', request: { ...normal,
        requestId: randomUUID(), subjectId: 'student-a', path: '/notes/note-1-a',
        route: 'GET /notes/:id' }, decision: 'allow' },
      { name: 'API 접두사의 메모 한 건 읽기', request: { ...normal, requestId: randomUUID(),
        path: '/api/notes/note-fixture-1',
        route: 'GET /api/notes/:id' }, decision: 'allow' },
      { name: 'B의 A 메모 읽기', request: { ...normal, requestId: randomUUID(),
        subjectId: 'student-b', path: '/notes/note-a-1', route: 'GET /notes/:id' },
      decision: 'deny', reasonCode: 'resource_not_allowed' },
      { name: 'B의 A 메모 수정', request: { ...normal, requestId: randomUUID(),
        subjectId: 'student-b', method: 'PUT', path: '/notes/note-a-1',
        route: 'PUT /notes/:id' }, decision: 'deny', reasonCode: 'resource_not_allowed' },
      { name: '사용자 표지가 뒤에 붙은 다른 메모', request: { ...normal,
        requestId: randomUUID(), subjectId: 'student-a', path: '/notes/note-b-a-1',
        route: 'GET /notes/:id' }, decision: 'deny', reasonCode: 'resource_not_allowed' },
      { name: '메모 전체 목록', request: { ...normal, requestId: randomUUID(),
        path: '/notes', route: 'GET /notes' },
      decision: 'deny', reasonCode: 'resource_not_allowed' },
      { name: 'API 메모 전체 목록', request: { ...normal, requestId: randomUUID(),
        path: '/api/notes', route: 'GET /api/notes' },
      decision: 'deny', reasonCode: 'resource_not_allowed' },
      { name: '공지 읽기', request: { ...normal, requestId: randomUUID(),
        path: '/announcements/class-notice', route: 'GET /announcements/:id' },
      decision: 'deny', reasonCode: 'resource_not_allowed' },
      { name: '공지 수정', request: { ...normal, requestId: randomUUID(), method: 'PUT',
        path: '/announcements/class-notice', route: 'PUT /announcements/:id' },
      decision: 'deny', reasonCode: 'resource_not_allowed' },
      { name: '메모 생성', request: { ...normal, requestId: randomUUID(), method: 'POST',
        route: 'POST /notes/:id' }, decision: 'deny', reasonCode: 'resource_not_allowed' },
      { name: '메모 삭제', request: { ...normal, requestId: randomUUID(), method: 'DELETE',
        route: 'DELETE /notes/:id' }, decision: 'deny', reasonCode: 'resource_not_allowed' },
      { name: '알 수 없는 기능 경로', request: { ...normal, requestId: randomUUID(),
        path: '/notes/export', route: 'GET /notes/export' },
      decision: 'deny', reasonCode: 'resource_not_allowed' },
      { name: 'ID 라우트로 해석된 export 기능 경로', request: { ...normal,
        requestId: randomUUID(), path: '/notes/export', route: 'GET /notes/:id' },
      decision: 'deny', reasonCode: 'resource_not_allowed' },
      { name: 'ID 라우트로 해석된 all 기능 경로', request: { ...normal,
        requestId: randomUUID(), path: '/notes/all', route: 'GET /notes/:id' },
      decision: 'deny', reasonCode: 'resource_not_allowed' },
      { name: '쿼리로 고른 기능', request: { ...normal, requestId: randomUUID(),
        queryLength: 12 }, decision: 'deny', reasonCode: 'resource_not_allowed' },
    );
  }
  const results = [];
  for (const item of checks) {
    const response = await decide(item.request);
    const valid = validResponse(item.request, response, ruleIds)
      && response.decision === item.decision
      && (!item.reasonCode || response.reasonCode === item.reasonCode);
    results.push({ name: item.name, passed: valid });
  }
  return results;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { decide, RULE_IDS } = await import('../src/decider.mjs');
    const results = await checkDecider({ decide, ruleIds: RULE_IDS });
    for (const item of results) process.stdout.write(`${item.passed ? '통과' : '확인 필요'} · ${item.name}\n`);
    process.stdout.write('이 명령은 가상 요청으로 연습하며 심판 통과 증거가 아닙니다.\n');
    if (results.some(item => !item.passed)) process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`판정기 연습 첫 오류: ${error.message}\n`);
    process.exitCode = 1;
  }
}
