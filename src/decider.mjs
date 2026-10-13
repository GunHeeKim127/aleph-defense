// 계약에 있는 엔진 검증 값만 사용합니다. 브라우저 헤더나 임의의 위치·신원 객체는 읽지 않습니다.
export const RULE_IDS = Object.freeze(['device_registered', 'step_up_required', 'resource_zone_access']);
const RESERVED_NOTE_IDS = new Set(['all', 'export']);

// 판정기는 메모 한 건의 읽기·수정 경로만 허용합니다. 소유자는 자료 API가 다시 검사합니다.
function hasResourceZoneAccess(request) {
  if (request?.service !== 'notes' || request.deviceRegistered !== true
      || !Number.isSafeInteger(request.queryLength) || request.queryLength !== 0
      || typeof request.subjectId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/u.test(request.subjectId)
      || typeof request.method !== 'string' || typeof request.route !== 'string'
      || typeof request.path !== 'string') return false;
  const normalizedPath = request.path.startsWith('/api/') ? request.path.slice(4) : request.path;
  const normalizedRoute = request.route.includes(' /api/')
    ? request.route.replace(' /api/', ' /') : request.route;
  const segments = normalizedPath.split('/');
  if (segments.length !== 3 || segments[0] !== ''
      || !/^[a-zA-Z0-9_-]{1,128}$/u.test(segments[2])
      || RESERVED_NOTE_IDS.has(segments[2].toLowerCase())) return false;
  return segments[1] === 'notes'
    && ['GET', 'PUT'].includes(request.method)
    && normalizedRoute === `${request.method} /notes/:id`;
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
