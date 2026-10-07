# JSON 항목 묶음 설명

JSON 표준은 주석을 허용하지 않으므로 원본 파일에는 주석이나 임의 필드를 넣지 않습니다. 아래 설명을 원본과 함께 읽으세요. 키·토큰·메모 본문 등 값은 이 문서에 복사하지 않습니다.

## aleph.config.json

- `step`: 현재 제작 단계.
- `repoUrl`: 제출 대상 GitHub 저장소.
- `publicAppUrl`: 실제 자료실 배포 주소.
- `sampleMarker`: 학습용 표식.
- `judgeIssuer`: 운영 측 심판 발급자 주소: 임의 변경 금지.
- `identityProvider`: 로그인 토큰의 발급자·대상·공개 키 주소. 하위 항목: `issuer`, `audience`, `jwksUrl`.
- `allowedRoutes`: 허용하는 메모 API 메서드와 경로.
- `originalApiUrl`: 쿼리 없는 원본 자료 HTTPS 경로.
- `restoreRoute`: 복구 경로 설정.

## artifacts/submission.json

- `schema`: 데이터 형식 버전.
- `step`: 현재 제작 단계.
- `commit`: 제출 기준 커밋.
- `repoUrl`: 제출 대상 GitHub 저장소.
- `changedFiles`: 마지막 커밋의 변경 파일 목록.
- `policyRules`: 현재 구현된 판정 규칙 이름.
- `attackAttempts`: 자기 점검 결과: 사용자 확인과 자동 요청 결과를 구분.
- `explanation`: 제출 변경 설명: 비밀값과 메모 본문 제외.
- `blockedAt`: 아직 진행하지 못한 확인 사항.
- `identityProvider`: 로그인 토큰의 발급자·대상·공개 키 주소. 하위 항목: `issuer`, `audience`, `jwksUrl`.
- `allowedRoutes`: 허용하는 메모 API 메서드와 경로.
- `originalApiUrl`: 쿼리 없는 원본 자료 HTTPS 경로.
- `restoreRoute`: 복구 경로 설정.

## bundle-notes.json

- `explanation`: 제출 변경 설명: 비밀값과 메모 본문 제외.
- `blockedAt`: 아직 진행하지 못한 확인 사항.

## config/auth.json

- `projectUrl`: 서버 Auth SDK가 연결할 Supabase 프로젝트 주소.
- `publishableKey`: 서버에서만 읽는 공개 키: 값을 문서나 화면에 복사하지 않음.

## data.json

- `notes`: 정적 메모 배열: 현재는 빈 배열 유지.

## package/baseline-functions.json

- `version`: 파일의 version 설정 또는 식별 정보.
- `starter`: 파일의 starter 설정 또는 식별 정보.
- `functions`: 시작 틀의 서버 함수 기준 목록.
- `allowedNew`: 시작 틀에서 추가를 허용하는 함수 경로.

## package.json

- `name`: 파일의 name 설정 또는 식별 정보.
- `private`: 파일의 private 설정 또는 식별 정보.
- `type`: 파일의 type 설정 또는 식별 정보.
- `scripts`: 개발·시험·제출 명령 묶음. 하위 항목: `build`, `test:r5`, `test:package`, `bundle`, `decider:test`, `detect:test`, `fixture:7`, `xdr:run`.
- `engines`: 지원하는 실행 환경. 하위 항목: `node`.
- `dependencies`: 서버에서 사용하는 외부 라이브러리. 하위 항목: `@supabase/supabase-js`, `jose`.

## public/data.json

- `notes`: 정적 메모 배열: 현재는 빈 배열 유지.

## vercel.json

- `$schema`: 파일의 $schema 설정 또는 식별 정보.
- `framework`: 파일의 framework 설정 또는 식별 정보.
- `buildCommand`: 배포 빌드 명령.
- `outputDirectory`: 정적 파일 배포 폴더.
- `headers`: 배포 응답의 보안 헤더 규칙.

## xdr/fixtures/brute-force.json

- `schema`: 데이터 형식 버전.
- `moduleKey`: XDR 연습 모듈 종류.
- `alerts`: XDR 연습용 가상 경보 목록.

## xdr/fixtures/exfiltration.json

- `schema`: 데이터 형식 버전.
- `moduleKey`: XDR 연습 모듈 종류.
- `alerts`: XDR 연습용 가상 경보 목록.

## xdr/fixtures/known-cve.json

- `schema`: 데이터 형식 버전.
- `moduleKey`: XDR 연습 모듈 종류.
- `alerts`: XDR 연습용 가상 경보 목록.

## xdr/fixtures/persistence.json

- `schema`: 데이터 형식 버전.
- `moduleKey`: XDR 연습 모듈 종류.
- `alerts`: XDR 연습용 가상 경보 목록.

## xdr/fixtures/privilege.json

- `schema`: 데이터 형식 버전.
- `moduleKey`: XDR 연습 모듈 종류.
- `alerts`: XDR 연습용 가상 경보 목록.

## xdr/fixtures/web-injection.json

- `schema`: 데이터 형식 버전.
- `moduleKey`: XDR 연습 모듈 종류.
- `alerts`: XDR 연습용 가상 경보 목록.

## package-lock.json

- 자동 생성된 의존성 잠금 파일입니다. 루트 설정과 `packages` 묶음은 설치 버전과 무결성 정보를 고정합니다. 수동 주석을 넣지 않습니다.
