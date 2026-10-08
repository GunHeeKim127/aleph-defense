import { createHash } from 'node:crypto';
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { matchAlert } from './classify.mjs';

const rulesUrl = new URL('./deny-rules.json', import.meta.url);
const logUrl = new URL('../alerts.log', import.meta.url);
const ttlMs = 15 * 60 * 1000;

// 차단 대상 주소의 원문 대신 지문을 사용합니다. 계정을 바꿔도 같은 공격 주소는 우회할 수 없습니다.
export function sourceKey(sourceAddress) {
  return createHash('sha256').update(JSON.stringify(sourceAddress)).digest('hex');
}

// 명확한 패턴으로 확인된 block만 처리 시점부터 일정 시간 유효한 주소 차단 후보로 저장합니다.
export async function connectResults(fixture, result,
  { rulesFile = rulesUrl, alertsFile = logUrl, clock = Date.now } = {}) {
  const rows = new Map(fixture.alerts.map(alert => [alert.id, alert]));
  const rules = [];
  const startsAt = new Date(clock()).toISOString();
  const expiresAt = new Date(Date.parse(startsAt) + ttlMs).toISOString();
  for (const item of result.decisions) {
    const alert = rows.get(item.alertId);
    if (!alert || !/^bf-\d{2}$/.test(item.alertId)) continue;
    const match = matchAlert(alert);
    if (item.action === 'block' && item.confidence >= 0.85 && match.confidence >= 0.85) {
      rules.push({ ruleId: `xdr.brute_force.${item.alertId.replace('-', '_')}`,
        action: 'deny', sourceKey: sourceKey(match.row.sourceAddress),
        alertId: item.alertId, pattern: match.pattern,
        startsAt, expiresAt });
    }
    if (item.action === 'alert') {
      await appendFile(alertsFile, JSON.stringify({ alertId: item.alertId, action: 'alert',
        pattern: match.pattern, confidence: item.confidence }) + '\n', { encoding: 'utf8', mode: 0o600 });
    }
  }
  await writeFile(rulesFile, JSON.stringify({ schema: 'aleph.xdr.deny.v1', scope: 'local_fixture', rules }, null, 2) + '\n');
  return rules;
}

// 정상 요청은 기존 판정기로 넘기며 서버가 확인한 신원에 해당하는 유효 후보만 추가 거부합니다.
export function createXdrDecider({ baseDecide, resolveSubject, clock = Date.now, rulesFile = rulesUrl }) {
  if (typeof baseDecide !== 'function' || typeof resolveSubject !== 'function') throw new TypeError('trusted_mapping_required');
  return async function decide(request) {
    const resolved = await resolveSubject(request.subjectId);
    const data = JSON.parse(await readFile(rulesFile, 'utf8'));
    const at = clock();
    const key = resolved && sourceKey(resolved.sourceAddress);
    const hits = data.schema === 'aleph.xdr.deny.v1' && Array.isArray(data.rules) ? data.rules.filter(rule =>
      rule.action === 'deny' && rule.sourceKey === key && /^xdr\.brute_force\.bf_\d{2}$/.test(rule.ruleId)
      && Date.parse(rule.startsAt) <= at && at < Date.parse(rule.expiresAt)) : [];
    if (hits.length) return { schema: 'aleph.decision.v1', requestId: request.requestId,
      decision: 'deny', reasonCode: 'xdr_brute_force', ruleIds: hits.map(rule => rule.ruleId) };
    return baseDecide(request);
  };
}
