// 심판은 이 파일 하나만 인터넷 없는 격리 환경에서 불러옵니다.
const PATTERNS = Object.freeze({
  unsigned_service_change: Object.freeze({
    name: 'unsigned_service_change', conditions: Object.freeze({ ruleLevelAtLeast: 10, mitre: 'T1543' }),
    evidence: 'MITRE ATT&CK T1543: 서명되지 않은 서비스 생성이나 실행 경로 변경은 시스템 서비스 기반 지속성 신호이다.',
  }),
  unfamiliar_scheduled_task: Object.freeze({
    name: 'unfamiliar_scheduled_task', conditions: Object.freeze({ ruleLevelAtLeast: 10, mitre: 'T1053' }),
    evidence: 'MITRE ATT&CK T1053: 평소 목록에 없는 예약 작업의 낯선 실행 파일 호출은 예약 작업 기반 지속성 신호이다.',
  }),
  startup_folder_change: Object.freeze({
    name: 'startup_folder_change', conditions: Object.freeze({ ruleLevelAtLeast: 10, mitre: 'T1543' }),
    evidence: 'MITRE ATT&CK T1543: 시작 실행 항목의 낯선 프로그램 추가는 부팅 후 지속 실행 신호이다.',
  }),
});

function output(confidence, reason) {
  return { action: confidence >= 0.85 ? 'block' : confidence >= 0.5 ? 'alert' : 'record', confidence, reason };
}

function normalized(value) {
  return typeof value === 'string'
    ? value.toLowerCase().replace(/[\r\n\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').slice(0, 1000) : '';
}

function patternName(description) {
  if (/예약 작업/.test(description)) return PATTERNS.unfamiliar_scheduled_task.name;
  if (/시작 (?:폴더|프로그램|항목)/.test(description)) return PATTERNS.startup_folder_change.name;
  if (/서비스|실행 파일/.test(description)) return PATTERNS.unsigned_service_change.name;
  return null;
}

// 외부 모듈·파일·환경 변수·네트워크 없이 경보 한 건을 즉시 판정합니다.
export function decide(alert) {
  const timestamp = Date.parse(alert?.timestamp);
  const level = alert?.rule?.level;
  const sourceAddress = alert?.data?.srcip;
  if (!Number.isFinite(timestamp) || !Number.isInteger(level) || level < 0 || level > 15
    || typeof sourceAddress !== 'string' || sourceAddress.length === 0) {
    return output(0.6, PATTERNS.unsigned_service_change.name);
  }

  const description = normalized(alert?.rule?.description);
  const mitre = Array.isArray(alert?.rule?.mitre) ? alert.rule.mitre : [];
  const pattern = patternName(description);
  const clearService = pattern === PATTERNS.unsigned_service_change.name && mitre.includes('T1543')
    && /(?:서명 없|평소 목록에 없|서비스.*(?:등록|바뀌|변경)|임시 폴더)/.test(description);
  const clearTask = pattern === PATTERNS.unfamiliar_scheduled_task.name && mitre.includes('T1053')
    && /(?:처음 보|임의 문자열|임시 폴더|같은 임시 파일)/.test(description);
  const clearStartup = pattern === PATTERNS.startup_folder_change.name && mitre.includes('T1543')
    && /평소 목록에 없|같은 임시 파일/.test(description);
  if (level >= 10 && (clearService || clearTask || clearStartup)) return output(0.95, pattern);

  if (pattern && level >= 4 && (mitre.includes('T1543') || mitre.includes('T1053'))) {
    return output(0.6, pattern);
  }
  return output(0.1, 'no_attack_pattern');
}
