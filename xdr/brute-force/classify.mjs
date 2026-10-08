import { readFile } from 'node:fs/promises';
import { extractAlert } from './read-alerts.mjs';

const { patterns } = JSON.parse(await readFile(new URL('./patterns.json', import.meta.url), 'utf8'));
const byName = Object.fromEntries(patterns.map(pattern => [pattern.name, pattern]));

// 경보 번호로 정답을 정하지 않고 안전하게 추출한 설명과 수치로 패턴을 대조합니다.
export function matchAlert(alert) {
  const row = extractAlert(alert);
  const failure = /실패/.test(row.description);
  const numeric = Number(alert?.data?.count);
  const described = Number(row.description.match(/실패(?:가|는)?\s*(\d+)건/)?.[1]);
  const count = Number.isSafeInteger(numeric) && numeric >= 0 ? numeric : described || 0;
  const accounts = new Set((typeof alert?.data?.accounts === 'string' ? alert.data.accounts : '')
    .split(',').filter(value => /^user\d{2,4}$/.test(value)));
  const accountCount = Math.max(accounts.size, Number(row.description.match(/계정\s*(\d+)개/)?.[1]) || 0);
  const guessed = byName.repeated_password_guessing.conditions;
  const sprayed = byName.password_spraying.conditions;
  if (row.level === null || row.timestamp === null || row.sourceAddress === '[redacted]' || row.account === '[redacted]') {
    return { row, pattern: 'repeated_password_guessing', confidence: null, evidence: 'insufficient_fields' };
  }
  const explicitSpray = /같은 비밀번호/.test(row.description)
    && (accountCount >= sprayed.accountCountAtLeast || /여러 계정/.test(row.description));
  const massAccountFailures = failure && accountCount >= sprayed.massAccountCountAtLeast
    && /같은 주소/.test(row.description);
  if (row.level >= sprayed.ruleLevelAtLeast && (explicitSpray || massAccountFailures)) {
    return { row, pattern: 'password_spraying', confidence: explicitSpray ? 0.96 : 0.9,
      evidence: explicitSpray ? 'explicit_spray' : 'mass_account_failures' };
  }
  if (failure && row.level >= guessed.ruleLevelAtLeast && count >= guessed.failureCountAtLeast) {
    return { row, pattern: 'repeated_password_guessing', confidence: 0.95, evidence: 'high_failure_volume' };
  }
  if (row.level <= 3 && (!failure || count <= 1)) {
    return { row, pattern: 'no_attack_pattern', confidence: 0.1, evidence: 'normal_event' };
  }
  return { row, pattern: /계정.*(?:비밀번호|실패)/.test(row.description) ? 'password_spraying' : 'repeated_password_guessing',
    confidence: null, evidence: 'ambiguous' };
}

// 확신도는 공격 가능성입니다. 낮은 점수는 정상 기록에 대응합니다.
export function decision(confidence, reason) {
  return { action: confidence >= 0.85 ? 'block' : confidence >= 0.5 ? 'alert' : 'record', confidence, reason };
}
