// 심판은 이 파일 하나만 인터넷 없는 격리 환경에서 불러옵니다.
// MITRE ATT&CK T1110을 근거로 한 학습용 임계값을 파일 안에 고정합니다.
const PATTERNS = Object.freeze({
  repeated_password_guessing: Object.freeze({ failureCountAtLeast: 30, ruleLevelAtLeast: 10 }),
  password_spraying: Object.freeze({ accountCountAtLeast: 5, massAccountCountAtLeast: 10, ruleLevelAtLeast: 10 }),
});

function nonNegativeInteger(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : 0;
}

function describedNumber(description, expression) {
  return nonNegativeInteger(description.match(expression)?.[1]);
}

function accountCount(alert, description) {
  const accounts = typeof alert?.data?.accounts === 'string'
    ? alert.data.accounts.split(',').map(value => value.trim()).filter(value => /^user\d{2,4}$/.test(value))
    : [];
  return Math.max(
    new Set(accounts).size,
    describedNumber(description, /계정\s*(\d+)개/),
    describedNumber(description, /서로 다른 계정\s*(\d+)개/),
  );
}

function result(confidence, reason) {
  return {
    action: confidence >= 0.85 ? 'block' : confidence >= 0.5 ? 'alert' : 'record',
    confidence,
    reason,
  };
}

// 외부 모듈·파일·패키지·환경 변수·네트워크 없이 경보 한 건을 즉시 판정합니다.
export function decide(alert) {
  const timestamp = Date.parse(alert?.timestamp);
  const level = alert?.rule?.level;
  const description = typeof alert?.rule?.description === 'string'
    ? alert.rule.description.replace(/[\r\n\u0000-\u001f]/g, ' ').slice(0, 500)
    : '';
  const sourceAddress = alert?.data?.srcip;
  const account = alert?.data?.srcuser;
  const fieldsValid = Number.isFinite(timestamp)
    && Number.isInteger(level) && level >= 0 && level <= 15
    && typeof sourceAddress === 'string' && sourceAddress.length > 0
    && typeof account === 'string' && account.length > 0;

  if (!fieldsValid) return result(0.6, 'repeated_password_guessing');

  const failure = /실패/.test(description);
  const count = Math.max(
    nonNegativeInteger(alert?.data?.count),
    describedNumber(description, /실패(?:가|는)?\s*(\d+)건/),
    describedNumber(description, /실패\s*(\d+)건/),
  );
  const accounts = accountCount(alert, description);
  const spray = PATTERNS.password_spraying;
  const guessing = PATTERNS.repeated_password_guessing;
  const explicitSpray = /같은 비밀번호/.test(description)
    && (accounts >= spray.accountCountAtLeast || /여러 계정|서로 다른 계정/.test(description));
  const massAccountFailures = failure && accounts >= spray.massAccountCountAtLeast
    && /같은 주소|한 주소/.test(description);

  if (level >= spray.ruleLevelAtLeast && (explicitSpray || massAccountFailures)) {
    return result(explicitSpray ? 0.96 : 0.9, 'password_spraying');
  }
  if (failure && level >= guessing.ruleLevelAtLeast && count >= guessing.failureCountAtLeast) {
    return result(0.95, 'repeated_password_guessing');
  }
  if (level <= 3 && (!failure || count <= 1)) return result(0.1, 'no_attack_pattern');

  // Jev가 없는 격리 심판에서는 애매한 사건을 차단하지 않고 alert로 내립니다.
  const reason = /계정.*(?:비밀번호|실패)|같은 비밀번호/.test(description)
    ? 'password_spraying'
    : 'repeated_password_guessing';
  return result(0.6, reason);
}
