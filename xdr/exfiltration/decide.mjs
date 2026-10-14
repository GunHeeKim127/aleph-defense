// 심판은 이 파일 하나만 인터넷 없는 격리 환경에서 불러옵니다.
const PATTERNS = Object.freeze({
  command_channel_bulk_transfer: Object.freeze({
    name: 'command_channel_bulk_transfer', conditions: Object.freeze({ ruleLevelAtLeast: 10, bytesAtLeast: 50000000, mitre: 'T1041' }),
    evidence: 'MITRE ATT&CK T1041: 명령 통로의 반복 대량 외부 전송은 명령 통로 유출 신호이다.',
  }),
  unknown_destination_bulk_transfer: Object.freeze({
    name: 'unknown_destination_bulk_transfer', conditions: Object.freeze({ ruleLevelAtLeast: 10, bytesAtLeast: 50000000, mitre: 'T1048' }),
    evidence: 'MITRE ATT&CK T1048: 평소 사용하지 않는 목적지나 프로토콜의 대량 전송은 다른 프로토콜 유출 신호이다.',
  }),
  off_hours_archive_transfer: Object.freeze({
    name: 'off_hours_archive_transfer', conditions: Object.freeze({ ruleLevelAtLeast: 10, bytesAtLeast: 50000000, mitre: 'T1048' }),
    evidence: 'MITRE ATT&CK T1048: 업무 시간 밖 압축 자료의 낯선 목적지 전송은 다른 프로토콜 유출 신호이다.',
  }),
});

function output(confidence, reason) {
  return { action: confidence >= 0.85 ? 'block' : confidence >= 0.5 ? 'alert' : 'record', confidence, reason };
}

function integer(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : 0;
}

function normalized(value) {
  return typeof value === 'string'
    ? value.toLowerCase().replace(/[\r\n\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').slice(0, 1000) : '';
}

function patternName(description, mitre) {
  if (/수업 시간 밖|업무 시간 밖|업무 외/.test(description) && /압축|전송/.test(description)) {
    return PATTERNS.off_hours_archive_transfer.name;
  }
  if (/명령 통로/.test(description) || mitre.includes('T1041')) return PATTERNS.command_channel_bulk_transfer.name;
  if (/처음 보는|평소.*(?:다른|쓰지 않)|외부 주소|다른 주소/.test(description) || mitre.includes('T1048')) {
    return PATTERNS.unknown_destination_bulk_transfer.name;
  }
  return null;
}

// 외부 모듈·파일·환경 변수·네트워크 없이 경보 한 건을 즉시 판정합니다.
export function decide(alert) {
  const timestamp = Date.parse(alert?.timestamp);
  const level = alert?.rule?.level;
  const sourceAddress = alert?.data?.srcip;
  if (!Number.isFinite(timestamp) || !Number.isInteger(level) || level < 0 || level > 15
    || typeof sourceAddress !== 'string' || sourceAddress.length === 0) {
    return output(0.6, PATTERNS.unknown_destination_bulk_transfer.name);
  }

  const description = normalized(alert?.rule?.description);
  const mitre = Array.isArray(alert?.rule?.mitre) ? alert.rule.mitre : [];
  const bytes = integer(alert?.data?.bytes);
  const destination = alert?.data?.dstip;
  const pattern = patternName(description, mitre);
  const technique = mitre.includes('T1041') || mitre.includes('T1048');
  if (pattern && technique && level >= 10 && bytes >= 50000000
    && typeof destination === 'string' && destination.length > 0) {
    return output(0.95, pattern);
  }
  if (pattern && technique && level >= 4) return output(0.6, pattern);
  return output(0.1, 'no_attack_pattern');
}
