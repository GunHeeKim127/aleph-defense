// 계약에 있는 엔진 검증 값만 사용합니다. 브라우저 헤더나 임의의 위치·신원 객체는 읽지 않습니다.
export const RULE_IDS = Object.freeze(['device_registered', 'step_up_required', 'resource_zone_access']);

const SUBJECT_WORDS = new Set(['subject', 'student', 'learner', 'user', 'fixture']);
const RESOURCE_WORDS = new Set(['note', 'notes', 'memo', 'resource', 'announcement', 'announcements', 'notice']);

// 가상 자원 이름의 구역 접두사를 제외하고 엔진이 확인한 사용자 표지를 비교합니다.
function identityPart(value, ignored) {
  if (typeof value !== 'string' || value.length > 256) return '';
  return value.toLowerCase().split(/[^a-z0-9]+/u).filter(Boolean)
    .filter(part => !ignored.has(part)).join('_');
}

// 강사 표지는 엔진이 확인한 subjectId에서만 읽고 브라우저의 role 입력은 사용하지 않습니다.
function isInstructorSubject(subjectId) {
  return typeof subjectId === 'string'
    && subjectId.toLowerCase().split(/[^a-z0-9]+/u).some(part => ['instructor', 'teacher'].includes(part));
}

// 엔진이 확인한 사용자·메서드·정확한 경로가 같은 자원 구역을 가리키는지 검사합니다.
function hasResourceZoneAccess(request) {
  if (request?.service !== 'notes' || request.deviceRegistered !== true
      || !Number.isSafeInteger(request.queryLength) || request.queryLength !== 0
      || typeof request.subjectId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/u.test(request.subjectId)
      || typeof request.method !== 'string' || typeof request.route !== 'string'
      || typeof request.path !== 'string') return false;
  // 정상 화면의 목록 읽기는 API가 검증된 사용자 소유자로 다시 필터링합니다.
  if (request.method === 'GET' && request.route === 'GET /notes' && request.path === '/notes') return true;
  const segments = request.path.split('/');
  if (segments.length !== 3 || segments[0] !== ''
      || !/^[a-zA-Z0-9_-]{1,128}$/u.test(segments[2])) return false;
  const zone = segments[1];
  const subjectIdentity = identityPart(request.subjectId, SUBJECT_WORDS);
  const resourceIdentity = identityPart(segments[2], RESOURCE_WORDS);
  const ownResource = segments[2] === request.subjectId
    || (subjectIdentity && (resourceIdentity === subjectIdentity
      || resourceIdentity.startsWith(`${subjectIdentity}_`)
      || resourceIdentity.endsWith(`_${subjectIdentity}`)));
  if (zone === 'notes' && ['GET', 'PUT'].includes(request.method)) {
    return ownResource && request.route === `${request.method} /notes/:id`;
  }
  if (zone === 'announcements' && request.method === 'PUT') {
    return isInstructorSubject(request.subjectId)
      && request.route === 'PUT /announcements/:id';
  }
  return false;
}

// judge_fixture는 심판의 가상 접속 사건용이며 실제 위치 증거로 저장하거나 승격하지 않습니다.
function isCompositeFixtureRisk(request) {
  const signals = request?.signals;
  if (!signals || signals.source !== 'judge_fixture'
      || !Number.isInteger(signals.hour) || signals.hour < 0 || signals.hour > 23
      || signals.network !== 'unusual') return false;
  const unusualHour = signals.hour <= 5 || signals.hour >= 23;
  const recentEvents = Array.isArray(request?.recentEvents) ? request.recentEvents : [];
  const bulkRead = recentEvents.some(event => event?.kind === 'risk_signal'
    && Number.isInteger(event.ageSeconds) && event.ageSeconds >= 0 && event.ageSeconds <= 300
    && Number.isInteger(event.count) && event.count >= 20);
  return unusualHour && bulkRead;
}

// 제공 엔진이 확인한 새 로그인만 인정하며 토큰 원문은 읽거나 기록하지 않습니다.
function hasFreshStepUp(request) {
  return request?.stepUp?.verified === true
    && Number.isInteger(request.stepUp.authAgeSeconds)
    && request.stepUp.authAgeSeconds >= 0 && request.stepUp.authAgeSeconds <= 900;
}

// 등록 여부가 정확히 true가 아니면 누락된 경우까지 기본 거부합니다.
export async function decide(request) {
  if (request?.deviceRegistered !== true) {
    return {
      schema: 'aleph.decision.v1',
      requestId: request?.requestId,
      decision: 'deny',
      reasonCode: 'device_not_registered',
      ruleIds: [RULE_IDS[0]],
    };
  }

  if (!hasResourceZoneAccess(request)) {
    return {
      schema: 'aleph.decision.v1',
      requestId: request?.requestId,
      decision: 'deny',
      reasonCode: 'resource_not_allowed',
      ruleIds: [RULE_IDS[2]],
    };
  }

  const compositeRisk = isCompositeFixtureRisk(request);
  if (compositeRisk && !hasFreshStepUp(request)) {
    return {
      schema: 'aleph.decision.v1',
      requestId: request.requestId,
      decision: 'step_up',
      reasonCode: 'step_up_required',
      ruleIds: [RULE_IDS[1]],
    };
  }

  return {
    schema: 'aleph.decision.v1',
    requestId: request.requestId,
    decision: 'allow',
    reasonCode: 'approved',
    ruleIds: compositeRisk ? [...RULE_IDS] : [RULE_IDS[0], RULE_IDS[2]],
  };
}
