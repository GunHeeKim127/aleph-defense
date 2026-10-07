import { matchAlert, decision } from './classify.mjs';
import { askJev } from './jev.mjs';

// 애매한 건만 Jev에 묻습니다. 공식 연결 전/실패 시 차단하지 않고 alert로 남깁니다.
export async function decide(alert) {
  const match = matchAlert(alert);
  if (match.confidence !== null) return decision(match.confidence, match.pattern);
  // 공식 서버 연결이 제공되기 전에는 ask 콜백을 지정하지 않습니다.
  const confidence = await askJev({ pattern: match.pattern, level: match.row.level, evidence: match.evidence });
  return decision(confidence ?? 0.6, match.pattern);
}
