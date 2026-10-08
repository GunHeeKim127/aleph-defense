import { createHash } from 'node:crypto';
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { decide } from './decide.mjs';

const rulesUrl = new URL('./deny-rules.json', import.meta.url);
const logUrl = new URL('../alerts.log', import.meta.url);
const ttlMs = 15 * 60 * 1000;

// 원문 주소를 거부 규칙에 남기지 않으면서 같은 공격 주소의 계정 변경 우회를 막습니다.
export function sourceKey(sourceAddress) {
  return createHash('sha256').update(JSON.stringify(sourceAddress)).digest('hex');
}

function safeAlertId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9._-]{1,80}$/.test(value) ? value : null;
}

// decide 결과를 후처리합니다. 독립 판정에서도 block인 후보만 규칙으로 쓰고 alert만 로그에 누적합니다.
export async function respond(fixture, result,
  { rulesFile = rulesUrl, alertsFile = logUrl, clock = Date.now } = {}) {
  const rows = new Map(Array.isArray(fixture?.alerts)
    ? fixture.alerts.map(alert => [safeAlertId(alert?.id), alert]).filter(([id]) => id)
    : []);
  const decisions = Array.isArray(result?.decisions) ? result.decisions : [];
  const rules = [];
  const startsAt = new Date(clock()).toISOString();
  const expiresAt = new Date(Date.parse(startsAt) + ttlMs).toISOString();

  for (const item of decisions) {
    const alertId = safeAlertId(item?.alertId);
    const alert = alertId && rows.get(alertId);
    if (!alert) continue;
    const verified = decide(alert);
    if (item.action === 'block' && item.confidence >= 0.85 && verified.action === 'block') {
      rules.push({
        ruleId: `xdr.brute_force.${alertId.replace(/[^A-Za-z0-9_]/g, '_')}`,
        action: 'deny', sourceKey: sourceKey(alert?.data?.srcip), alertId,
        pattern: verified.reason, startsAt, expiresAt,
      });
    }
    if (item.action === 'alert' && verified.action === 'alert') {
      await appendFile(alertsFile, `${JSON.stringify({
        alertId, action: 'alert', pattern: verified.reason, confidence: item.confidence,
      })}\n`, { encoding: 'utf8', mode: 0o600 });
    }
  }

  await writeFile(rulesFile, `${JSON.stringify({
    schema: 'aleph.xdr.deny.v1', scope: 'local_fixture', rules,
  }, null, 2)}\n`, 'utf8');
  return rules;
}

// 정상 요청은 기존 판정기로 보내고, 신뢰된 주소 매핑이 활성 거부 규칙과 맞을 때만 추가 거부합니다.
export function createXdrDecider({ baseDecide, resolveSubject, clock = Date.now, rulesFile = rulesUrl }) {
  if (typeof baseDecide !== 'function' || typeof resolveSubject !== 'function') {
    throw new TypeError('trusted_mapping_required');
  }
  return async function decideRequest(request) {
    const resolved = await resolveSubject(request.subjectId);
    const data = JSON.parse(await readFile(rulesFile, 'utf8'));
    const at = clock();
    const key = resolved?.sourceAddress ? sourceKey(resolved.sourceAddress) : null;
    const hits = data.schema === 'aleph.xdr.deny.v1' && Array.isArray(data.rules)
      ? data.rules.filter(rule => rule.action === 'deny' && rule.sourceKey === key
        && typeof rule.alertId === 'string' && typeof rule.ruleId === 'string'
        && Date.parse(rule.startsAt) <= at && at < Date.parse(rule.expiresAt))
      : [];
    if (hits.length) {
      return { schema: 'aleph.decision.v1', requestId: request.requestId,
        decision: 'deny', reasonCode: 'xdr_brute_force', ruleIds: hits.map(rule => rule.ruleId) };
    }
    return baseDecide(request);
  };
}

export const connectResults = respond;
