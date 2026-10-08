# 무차별 로그인 공격 연습

`npm run xdr:run -- brute-force`는 원본 경보를 읽어 result.json을 갱신합니다.
`node xdr/brute-force/read-alerts.mjs`는 다섯 필드만 추출한 JSON 줄을 출력합니다.
patterns.json의 두 패턴은 MITRE T1110 및 T1110.003에 근거합니다. 임계값은 학습용 로컬 설정이며 MITRE 공식 수치가 아닙니다.
한 건의 Wazuh 집계 경보를 분류하며 별도 시간창 상관 분석이나 실제 Wazuh 수신기는 구현하지 않습니다.
경보에 시간 구간이 없으면 짧은 시간이라고 추정하지 않습니다.

## Jev

이 과제에는 Jev 호출 주소·인증·응답 계약이 들어 있지 않습니다. 현재 애매한 경보는 Jev 미응답 상황으로 alert(0.6)에 남습니다.
공식 연결을 마련한 서버 운영자가 `JEV_ADAPTER_MODULE`에 서버 어댑터 파일의 절대 경로를 지정하면,
그 파일의 `askJev(summary, {signal})` 함수를 호출합니다. 반환은 `{confidence: 0..1}`입니다.
이 인터페이스는 본 프로젝트 어댑터 계약이며 Jev 공식 API라고 주장하지 않습니다.
요약에는 패턴·수준·근거 코드만 전달하고 주소·계정·설명·비밀번호는 보내지 않습니다.
키는 서버 비밀 설정에서만 읽어야 하며 저장소에 쓰지 않습니다. 실패·시간 초과는 alert입니다.

## 거부 후보와 ZTNA 연결

실행기는 명확한 패턴과 block 점수가 모두 있는 경우만 deny-rules.json에 후보를 씁니다.
후보에는 근거 경보 번호·규칙 이름·시작/만료 시각·출발 주소 지문이 있습니다.
만료는 경보를 처리한 시각부터 15분이며 같은 주소가 계정을 바꿔도 유효 시간 동안 추가 거부합니다.
알림은 xdr/alerts.log에 JSON 한 줄씩 추가됩니다. 재실행하면 알림 이력이 추가됩니다.

connect.mjs의 `createXdrDecider({baseDecide,resolveSubject,clock,rulesFile})`가 추가 거부 어댑터입니다.
baseDecide는 기존 판정기 함수이고 resolveSubject는 운영 서버가 검증한 subjectId를 출발 주소·계정으로 연결하는 함수입니다.
브라우저 요청에 임의 주소/계정 필드를 넣지 않습니다. 일치하지 않거나 만료된 후보는 기존 판정 결과를 그대로 반환합니다.
이 부품은 기존 판정기를 교체하지 않습니다. `baseDecide`에 기존 판정기를 넣고, 신뢰할 수 있는 `resolveSubject` 연결을 주입해 사용합니다.
과제의 가상 경보 시험에서는 주소·계정 연결을 함께 주입해 명확한 공격은 추가 거부하고 정상 요청은 기존 판정 결과로 통과하는지 확인합니다.
현재 src/decider.mjs의 starter.deny 자체는 시작 틀의 기존 규칙이므로 이 보너스 과제에서 변경하지 않습니다.

## 확인

`node --test test/brute-force.test.mjs test/xdr-run.test.mjs`로 추출·분류·만료·정상 흐름 보존을 시험합니다.
정상 경보가 record, 명확한 패턴이 block, 애매한 경보가 alert인지 result.json의 counts 및 decisions를 확인하세요.
Jev 미응답 대체 처리와 ZTNA 추가 확인 부품은 로컬 시험으로 확인합니다. 이 결과는 실제 외부 서비스나 심판 판정 결과를 뜻하지 않습니다.
