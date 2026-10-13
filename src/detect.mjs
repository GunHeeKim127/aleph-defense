const WINDOW_MS = 10 * 60 * 1000;
const MAX_NORMAL_READS = 120;

// 계약에 있는 시각·요청 종류·가명 사용자만 복사하고 나머지 필드는 읽거나 출력하지 않습니다.
function readEvent(event) {
  const at = event?.at;
  const method = event?.method;
  const subject = event?.identity?.sub;
  const time = typeof at === 'string' ? Date.parse(at) : Number.NaN;
  if (!Number.isFinite(time) || new Date(time).toISOString() !== at
      || typeof method !== 'string'
      || typeof subject !== 'string' || !subject || subject.length > 256
      || /[\u0000-\u001f\u007f]/u.test(subject)) {
    throw new TypeError('invalid_detection_event');
  }
  return { time, method, subject };
}

// 같은 가명 사용자의 GET이 어느 10분 구간에서든 120건을 넘는 최초 사건만 회수 후보로 제안합니다.
export function detect(events) {
  if (!Array.isArray(events)) throw new TypeError('invalid_detection_events');
  const safeEvents = events.map(readEvent).sort((a, b) => a.time - b.time);
  const readsBySubject = new Map();
  for (const event of safeEvents) {
    if (event.method !== 'GET') continue;
    const reads = readsBySubject.get(event.subject) ?? [];
    reads.push(event.time);
    while (reads.length && event.time - reads[0] > WINDOW_MS) reads.shift();
    readsBySubject.set(event.subject, reads);
    if (reads.length > MAX_NORMAL_READS) {
      return { action: 'propose_revocation', reasonCode: 'burst_read', subject: event.subject };
    }
  }
  return { action: 'observe' };
}
