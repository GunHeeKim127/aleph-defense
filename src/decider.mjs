// ALEPH SDP 엔진이 확인한 최상위 deviceRegistered 값만 사용하는 6단계 규칙입니다.
// 브라우저가 만든 userId, role, 기기 객체, 인증서나 키를 별도로 믿거나 저장하지 않습니다.
export const RULE_IDS = Object.freeze(['device_registered']);

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

  return {
    schema: 'aleph.decision.v1',
    requestId: request.requestId,
    decision: 'allow',
    reasonCode: 'approved',
    ruleIds: [RULE_IDS[0]],
  };
}
