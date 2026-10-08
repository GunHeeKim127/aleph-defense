# BYTE BACK 방어전 시작 틀 R5

이 저장소는 1단계에서 학생 본인이 GitHub 저장소와 Vercel 배포를 만드는 출발점입니다. 포함된 메모 네 건은 가상 자료입니다. 실제 학생 자료, 토큰, 비밀키를 넣지 마세요.

## 학생이 하는 일: 세 걸음

1. GitHub 계정을 만듭니다.
2. 방어전 1단계 카드의 **Deploy** 버튼을 누릅니다. Vercel에 GitHub로 로그인하고, 새 저장소가 **본인 계정의 Public 저장소**인지 확인한 뒤 Deploy를 누릅니다.
3. 배포가 끝나면 화면에 나온 `https://…vercel.app` 주소를 방어전 1단계 카드에 붙여넣고 제출합니다. 저장소 주소나 설정 파일은 적지 않습니다.

배포가 끝나면 `/`에서 점령된 가상 자료실을 볼 수 있습니다. `/data.json`에는 같은 가상 메모가 공개됩니다. 이 공개 상태를 확인하는 것이 1단계의 출발점입니다. 1단계 접수와 심판 판정은 포털에서 확인합니다.

## 시작 틀의 자동 처리

`vercel.json`은 정적 결과물 `public`을 배포합니다. 빌드 명령 `npm run build`는 Vercel이 제공하는 GitHub 저장소 소유자·이름, 커밋 SHA, 배포 URL을 검증하고 `public/aleph.json`을 생성합니다. 이 값이 없으면 빌드가 실패하므로, 성공한 것처럼 빈 주소를 내보내지 않습니다. `aleph.json`의 내용만으로 저장소 소유권이나 방어 성공을 인정하지 않습니다. 심판이 공개 저장소의 실제 커밋과 배포된 자료를 따로 대조해야 합니다.

`aleph.config.json`의 `repoUrl`과 `publicAppUrl`은 이전 제출 묶음 방식의 자리표시자입니다. 1단계에서는 학생이 편집하지 않습니다. 2단계 이후 코딩 도구가 필요한 설정과 보호 기능을 단계별로 작성합니다. `npm run bundle`과 `bundle-notes.json`도 1단계의 세 걸음에는 포함되지 않습니다.

로컬에서 가상 화면만 확인할 때는 `npm run build -- --local`을 사용합니다. 로컬 실행은 Vercel 배포나 심판 접수를 증명하지 않습니다. 저장소의 `src/attack-check.mjs`는 실제 배포가 된 뒤 `/data.json`을 비로그인으로 요청해 공개 가상 메모의 확인 표시를 읽습니다.

## 다음 단계의 코딩 도구에 전달할 규칙

[AGENTS.md](AGENTS.md)를 먼저 읽히고 한 번에 한 제작 단위만 요청하세요. 2단계부터는 자료 보호를 구현할 때 `public/data.json`을 복사하는 1단계 빌드 흐름도 함께 바꿔야 합니다. 3단계 이후의 로그인, 허용 경로, 5단계의 원본 API 주소, 6단계 이후 정책 규칙은 해당 단계 원고와 계약에 맞춰 추가합니다. 비밀번호·토큰·서버 전용 키·실제 학생 기록을 코드, Git, 제출 묶음에 넣지 않습니다.

`src/decider.mjs`와 `src/detect.mjs`의 로컬 시험은 반 엔진이나 운영 심판의 결과가 아닙니다. 1단계 이후 제출 묶음 계약 `aleph.defense.submission.v2`는 `scripts/bundle.mjs`에 남아 있으며, 코딩 도구가 해당 단계의 최신 배포 주소와 Git 원격을 맞춘 뒤 사용합니다.

## 2단계 저장점

마지막 1단계 커밋: 5e96d15 Initial commit. 작업 시작 시 다른 변경사항 없음.
원본 data.json 확인 결과 가상 메모 4건이며, 요청의 '세 개'와 달리 실제 4건을 기준으로 이전했습니다.
화면은 /api/notes에서 네 카드를 읽습니다. 루트와 public/data.json에는 빈 notes 배열만 있습니다.
SQL은 공개 Git/정적 파일에 넣지 않는 별도 로컬 산출물 step2-supabase.sql입니다.
Supabase SQL Editor에서 실행한 뒤 owner_id의 uuid 자료형, RLS true, 정책 없음,
anon/authenticated SELECT false를 확인하세요. 새 학습용 테이블이 이미 있으면 SQL은 덮어쓰지 않고 실패합니다.
Vercel 프로젝트 Settings → Environment Variables에서 SUPABASE_URL과 서버 전용 SUPABASE_SECRET_KEY를 직접 설정하고 재배포하세요.
키 값을 채팅이나 파일에 붙여 넣지 마세요. 서버는 upstream 응답/오류/키를 로그에 쓰지 않습니다.
로컬 정적 확인: npm run build -- --local. API 확인은 환경변수가 설정된 Vercel 배포에서 합니다.

### 남은 약점

/api/notes는 로그인 인증이 없는 공개 URL입니다. 누구나 API로 네 메모를 읽을 수 있습니다.
RLS와 브라우저 키 제거는 공개 API의 접근 통제를 대신하지 않습니다.
과거 공개 커밋과 과거 배포에 메모가 남을 수 있으므로 과거 노출이 해소됐다고 판단하지 않습니다.

### 검증과 기록

GitHub 최신 커밋을 별도 폴더에 받아 원본 가상 메모 본문 네 문장을 검색하세요.
검색할 문장은 로컬 SQL에서 확인하고, 문장을 README/검색 결과/제출 묶음에 복사하지 마세요.
검색 대상은 전체 추적 파일이며 검색 결과에는 파일 경로와 일치 개수만 기록하세요.
최신 배포의 /, /data.json, 페이지가 참조하는 JS 및 기타 정적 파일에도 같은 검색을 수행하세요.
/data.json은 notes: []이어야 하고, 화면은 네 카드가 표시되어야 합니다.
비로그인 /api/notes GET은 네 메모를 반환하는 남은 약점이고, POST는 405여야 합니다.
Supabase에서 anon/authenticated로 직접 SELECT는 거부되어야 합니다.

| 점검 | 결과 | 커밋/배포 주소·시각 |
| --- | --- | --- |
| 최신 Git 전체 추적 파일 본문 검색 | 로컬 전체 추적 파일 0건, GitHub는 미실행 | 배포 후 기록 |
| 최신 배포 정적 파일 본문 검색 | 미실행 | 배포 후 기록 |
| /data.json 빈 배열 | 로컬 빈 배열 확인, 배포 미실행 | 배포 후 기록 |
| 화면 네 카드·API GET | DB 설정/배포 후 확인 필요 | 배포 후 기록 |
| 공개 API 남은 약점 | 인증 없는 URL 구현 | 배포 후 기록 |
| Supabase owner_id/RLS/권한 | SQL Editor 미실행 | 실행 후 기록 |

실행하지 않은 배포·검증은 성공으로 기록하지 않습니다. 자기 점검은 심판 판정이 아닙니다.
설정의 실제 배포 주소는 확인 후에만 맞추고 judgeIssuer는 보존합니다.

## 3단계 구현 및 저장점

시작 커밋은 `744d6f3 보안 헤더 추가`였고 Git 상태는 깨끗했습니다.
2단계 기록 이후 보안 헤더가 추가됐지만 이전 결과 표에는 반영되지 않아 이 절에서 보완합니다.
2단계 실제 배포 점검에서 정적 메모 0건, API 가상 메모 4건, nosniff와 GitHub 최신 본문 검색 0건을 확인했습니다.
DB 내부 점검은 사용자가 완료했다고 확인했으며 코딩 도구가 DB에 직접 접속해 검증한 결과는 아닙니다.

현재 구현은 Supabase 공식 SDK 이메일·비밀번호 로그인/로그아웃, 내 메모 목록과 추가·수정·삭제입니다.
공개 Project URL/publishable key 연결 완료. 실제 A 로그인 검증은 사용자가 화면에서 확인해야 합니다.
서버는 변경하지 않은 src/verify-login.mjs의 createLoginVerifier로 Authorization 토큰을 확인합니다.
브라우저 userId/role/owner_id를 믿지 않으며 POST의 owner_id는 검증된 사용자 ID입니다.
목록은 본인 owner_id만 조회합니다. 개별 GET/PUT/DELETE에는 아직 소유자 검사가 없으므로 B가 A의 메모 ID를 알면 읽기·수정·삭제할 수 있습니다. 4단계에서 막습니다.
과거 공개 커밋과 배포의 노출은 로그인 추가로 해소되지 않습니다.

### DB 및 계정 설정

Supabase SQL Editor에서 sql/step3-auth.sql을 실행합니다. 기존 정수 ID를 UUID로 바꾸며 메모와 owner_id를 보존합니다.
서버 역할에 CRUD 권한을 주지만 anon/authenticated에는 직접 자료 권한이나 읽기 정책을 주지 않습니다.
이미 UUID인 테이블에서는 ID를 다시 바꾸지 않습니다. auth.users 외래키를 추가하지 않습니다.
이전 네 메모의 owner_id가 NULL이면 내 목록에는 나오지 않습니다. 삭제하지 않고 DB에 보존합니다.
Authentication → Users에서 학습용 A/B 계정을 준비하고 Email 로그인 공급자를 사용합니다. 비밀번호는 공식 화면에서 직접 설정합니다.
Vercel의 기존 SUPABASE_URL과 SUPABASE_SECRET_KEY는 같은 프로젝트를 가리켜야 합니다.
public/login-config.json에는 공개용 설정만 넣고 서버 키는 절대 넣지 않습니다.

### 실행과 점검

명령: npm run build -- --local
정상: 로그인 폼 → A 로그인 → 내 메모 목록 → 가상 메모 추가 → 수정 → 삭제 → 로그아웃 상태.
거부: 무로그인 모든 자료 경로와 잘못된 토큰은 JSON 오류 401/403이며 자료를 반환하지 않습니다.
POST /api/notes는 {id?,title,body}를 받고 201 {id}를 반환합니다. id는 UUID이며 생략하면 서버가 만듭니다.
GET /api/notes는 본인 메모 배열, GET/PUT/DELETE /api/notes/:id는 개별 메모 경로입니다.
GET 한 건과 PUT 결과는 {id,title,body}, DELETE는 204, 삭제 후 GET은 404입니다.
로그아웃은 SDK의 현재 세션 로그아웃입니다. 이미 발급된 액세스 토큰은 만료 전까지 유효할 수 있습니다.
/aleph.json 자동 생성과 nosniff 설정을 유지합니다. 저장점 이후 npm run bundle로 실제 배포 응답을 다시 기록합니다.

| 점검 | 현재 결과 |
| --- | --- |
| 로컬 인증 거부/CRUD/입력 위조/오류 응답 | 모의 시험 7개 통과 |
| 검증 도우미 | 수정하지 않음 |
| DB UUID 이전 | 실제 DB 메모 4건 UUID 확인, 공개 키 직접 조회 거부 확인 |
| 실제 A 로그인/로그아웃/CRUD | 3단계 사용자 확인 완료 (코딩 도구 실계정 시험 아님) |
| 실제 B 타인 메모 접근 | 미실행, 소유자 검사 없음 |
| 3단계 새 배포·무로그인 거부 | 실제 배포 JSON 401, nosniff, aleph.json 확인 완료 |

자기 점검은 심판 판정이 아닙니다. 메모 본문/비밀번호/JWT/서버 키는 제출 묶음에 넣지 않습니다.

## 4단계 저장점: 본인 메모만 접근

시작 커밋: 23a34ec 3단계 저장점. 시작 시 Git 상태는 깨끗했습니다.
README의 3단계 사용자 확인/배포 기록 누락을 보완했습니다. 이전 단계 절은 당시 기능과 결과의 이력입니다.
현재 서버는 검증한 사용자 ID와 기존 행의 owner_id를 비교하며 본인 목록·추가·개별 조회·수정·삭제만 허용합니다.
타인 또는 owner_id NULL 행은 개별 접근 403, 없는 ID는 404, 인증 없음/실패는 JSON 401입니다.
소유자를 지정하는 URL 쿼리나 본문 입력은 403으로 거부합니다. userId·role도 인증 근거로 쓰지 않습니다.
POST 소유자는 검증한 ID로만 저장합니다. PUT은 기존 소유자 확인 후 owner_id 필터와 검증된 새 소유자를 함께 사용합니다.
DELETE도 기존 소유자 확인과 쓰기 시 소유자 필터를 함께 사용해 검사와 변경 사이의 소유자 변경을 방어합니다.
응답에는 owner_id를 내보내지 않고 {id,title,body}만 유지합니다.
실제 허용 경로는 GET/POST /api/notes와 GET/PUT/DELETE /api/notes/:id이며 설정에 기록했습니다.

### 사용자가 검토할 SQL (자동 실행하지 않음)

1. artifacts/step4-owners.sql: A_EMAIL_HERE/B_EMAIL_HERE를 SQL Editor에서 실제 A/B 이메일로 입력합니다.
   auth.users에서 각 ID를 조회합니다. 기존 원본 세 제목이 정확히 한 건씩 있을 때만 A에 연결하고 B 시험 한 건을 준비합니다.
   원본 네 건 중 선택하지 않은 네 번째와 다른 계정의 메모는 보존합니다. 다른 소유자가 이미 있거나 제목이 중복되면 전체 중단합니다.
   이메일과 시험 본문이 담기는 이 파일은 Git 제외이며 제출 묶음에 넣지 않습니다.
2. sql/step4-rls.sql: learning_notes만 변경합니다. 기존 테이블/열 권한과 정책을 조회·회수하고 authenticated에 CRUD만 부여합니다.
   이 테이블의 기존 정책을 교체합니다. SELECT/DELETE USING, INSERT WITH CHECK, UPDATE USING/WITH CHECK 모두 auth.uid()=owner_id입니다.
   전후 role_table_grants와 has_table_privilege 결과를 대조합니다. anon은 모두 false, authenticated는 CRUD true·그 밖 false여야 합니다.
   예상 밖 역할 상속 권한이 남으면 롤백하며 다른 역할/테이블을 변경하지 않습니다. 서버 역할의 기존 권한은 보존합니다.

서버 Secret Key는 RLS를 우회하므로 앱의 소유자 검사가 별도로 필요합니다.
직접 Data API 자기 점검은 공개 publishable key만 보내 anon 역할의 읽기 거부를 확인합니다.
인증 사용자 JWT를 사용하는 직접 Data API 접근은 심판이 재현할 수 없으므로 점수 근거로 기록하지 않습니다.
DB RLS는 검토용 설계이며, SQL Editor에서 사용자가 실행하기 전에는 적용 완료로 표현하지 않습니다.
과거 공개 커밋/배포 노출은 이번 접근 제한으로 해소됐다고 표현하지 않습니다.

### 재실행과 확인

명령: npm run bundle
화면: Supabase SQL Editor에서 소유자 연결 → 권한 SQL 실행 후 자료실에서 A/B 계정을 번갈아 로그인합니다.
정상: 각 계정의 본인 메모 조회·추가·수정·삭제 성공, 삭제 후 GET 404.
거부: 무로그인 JSON 401, 상대 메모 GET/PUT/DELETE 403, owner_id 변경 403.
/aleph.json 자동 생성과 nosniff를 보존했습니다. 인증 검증 도우미와 정책 판정기는 수정하지 않았습니다.

| 점검 | 결과 |
| --- | --- |
| 본인 CRUD·상호 접근 거부·소유자 변경·경합 방어 | 로컬 모의 시험 9개 통과 |
| 로컬 정적 빌드 | 통과, 메모 없는 data.json 유지 |
| 4단계 A/B 실계정 교차 접근 | 사용자 확인: 양방향 GET/PUT/DELETE 403, 본문/URL owner_id 변경 403, 본인 CRUD 정상 및 삭제 후 GET 404 |
| 소유자 연결·RLS 실제 권한 전후 | 사용자 화면 확인: RLS true, 본인 행 정책 4개, anon 전부 false, authenticated CRUD만 true |
| 최신 배포의 무로그인·보안 헤더·aleph.json·anon 직접 읽기 | npm run bundle 실제 요청으로 기록 |

위 기록은 자기 점검이며 심판 판정이 아닙니다.

## 5단계 저장점: 자료 요청은 서버로만

시작 커밋: 0659653 4단계 사용자 검증 기록 갱신. Git 상태는 깨끗했습니다.
그 뒤 사용자 화면 증거로 확인한 4단계 양방향 접근 차단·소유자 변경 거부·RLS 결과를 위 표에 반영했습니다.
브라우저의 직접 메모 자료 호출: 없음. 기존 목록/조회/추가/수정/삭제는 모두 /api/notes 서버 함수를 사용합니다.
이 점검으로 자료 호출 코드는 변경하지 않았습니다. 기존 서버 로그인 검증·소유자 검사도 변경하지 않았습니다.
5단계 설정에 쿼리 없는 HTTPS 원본 테이블 경로를 기록했고 aleph.json에 allowedRoutes를 생성하도록 준비했습니다.

sql/step5-server-only.sql은 learning_notes의 PUBLIC/anon/authenticated 직접 권한을 회수하는 검토용 SQL입니다.
적용 전후 role_table_grants 및 has_table_privilege를 대조하며 anon/authenticated 모두 false가 정상입니다.
기존 service_role CRUD, RLS 정책·메모·소유자·Auth·다른 테이블은 보존합니다.
PostgreSQL SQL/PLpgSQL 문법 검사와 기존 API 모의 시험 9개는 통과했습니다. DB SQL은 실행하지 않았습니다.

공개 키는 서버 전용 config/auth.json으로 옮겼습니다. public/login-config.json과 브라우저 Supabase SDK는 제거했습니다.
사용자 요청에 따라 Auth 로그인·로그아웃도 /api/auth 서버 함수에서 Supabase 공식 SDK로 처리합니다.
서버는 기존 검증 도우미로 토큰을 검사한 뒤 HttpOnly·Secure·SameSite=Strict 쿠키에 세션을 보관합니다.
브라우저 JS/JSON 응답에는 실제 공개 키나 인증 토큰을 반환하지 않습니다. 원시 토큰은 HttpOnly 쿠키로만 전달합니다.
쿠키 인증을 기존 메모 API Authorization 검증에 연결했으며 외부 Bearer 요청의 검증 흐름은 유지했습니다.
쿠키를 사용하는 변경 요청은 동일 출처 검사 후 처리합니다. 서버의 공개 키·Secret Key는 응답/로그에 출력하지 않습니다.
사용자가 입력한 이메일/비밀번호는 HTTPS 로그인 요청으로만 전달하고 파일·로그·제출 묶음에 저장하지 않습니다.
공식 SDK refreshSession으로 만료된 세션을 갱신하며 signOut은 현재 세션 로그아웃입니다.
이전 브라우저 SDK 로그인 상태는 자동 이전하지 않으므로 새 화면에서 다시 로그인해야 합니다.

### SQL 적용 및 검증

명령: npm run bundle
Supabase SQL Editor에서 sql/step5-server-only.sql을 검토하고 실행하세요. 다른 테이블이나 Auth는 바꾸지 않습니다.
적용 후 anon/authenticated의 SELECT·INSERT·UPDATE·DELETE 및 기타 표에 표시된 권한은 모두 false,
service_role의 CRUD는 true여야 합니다. 기존 RLS는 유지하되 직접 호출은 GRANT 회수로 차단합니다.
화면의 메모 요청은 Vercel API만 사용합니다. 정상 A CRUD는 기존 서버 소유자 검사와 서버 역할 권한으로 유지됩니다.
직접 원본 요청 자기 점검은 서버에서 공개 키만 전송하고 사용자 JWT나 Secret Key를 보내지 않습니다.
/aleph.json에는 allowedRoutes와 쿼리 없는 originalApiUrl을 포함합니다. nosniff와 정적 메모 0건도 유지합니다.

| 점검 | 결과 |
| --- | --- |
| 기존 메모 직접 브라우저 호출 | 없음, 자료 호출 경로 변경 없음 |
| 서버 Auth/쿠키/CSRF 및 본인 CRUD·타인 거부 | 로컬 모의 시험 14개 통과 |
| 정적 파일 공개 키·브라우저 Supabase 호출 검색 | 없음 |
| 직접 권한 회수 SQL | 사용자 SQL 실행 결과 확인: anon/authenticated 모든 직접 권한 false, service_role CRUD true |
| A 정상 로그인/로그아웃·CRUD | 5단계 사용자 확인 완료: 본인 CRUD 정상, 로그아웃 후 메모 숨김 |
| A/B 상대 메모 접근 | 5단계 사용자 화면 확인 완료: 양방향 GET·PUT·DELETE 모두 403 |
| 무로그인 목록 요청 | 사용자 화면에서 401 및 JSON 오류 확인, bundle 실제 요청으로 재확인 |
| 최신 배포 헤더·허용 경로·공개 키 제거·무로그인 거부 | npm run bundle 실제 요청으로 기록 |

기존 공개 커밋과 과거 배포의 키/자료는 이번 변경으로 삭제되지 않습니다. 자기 점검은 심판 판정이 아닙니다.

5단계 검증 기록 갱신: 실계정·DB 확인은 사용자의 실행 결과와 화면 증거이며 도구가 대신 로그인하거나 SQL을 실행한 결과가 아닙니다.
제출 묶음 재생성은 npm run bundle로 실행합니다. Node.js 20의 경로 계산 오류는 5884202에서 수정했습니다.

## 보너스 xdr-01 저장점

시작 커밋은 5071314이며 Git 상태는 깨끗했습니다. 이전 주석 작업을 포함한 기존 파일은 보존했습니다.
기존 판정기는 src/decider.mjs 내부의 starter.deny 한 규칙으로 모든 요청을 거부하며 외부 규칙을 읽지 않습니다.
이번 작업은 xdr/brute-force의 가상 경보 읽기·패턴 분류·만료 거부 후보·추가 판정 어댑터와 알림 기록입니다.
MITRE T1110/T1110.003 공식 설명을 근거로 두 패턴을 작성했으며 수치 임계값은 학습용 기준입니다.
원본 경보·기존 판정기·로그인/메모 API·단계 5 설정 및 judgeIssuer는 변경하지 않았습니다.

실행: npm run xdr:run -- brute-force
결과 파일: xdr/brute-force/result.json. 알림 파일: xdr/alerts.log.
검증: 경보 28건과 추출 28줄 일치, block 10 · alert 9 · record 9, 정상 이벤트 9건의 block 0건.
로컬 시험은 추출·비밀값 제거·확신도 경계·미응답·분류·만료·정상 흐름 보존을 확인했습니다.
첫 시험 실패는 동일 출발 주소·계정의 두 번째 경보가 아직 만료되지 않은 시험 시각 때문이며 시험 시각만 수정했습니다.
Jev 공식 호출 정보가 없어 실제 호출은 미실행이며 애매한 경보는 alert로 기록합니다.
ZTNA 추가 거부 어댑터는 준비했으나 운영 서버의 검증된 신원 매핑과 엔트리포인트 연결, 새 reasonCode 등록은 미완료입니다.
기존 모든 요청 거부를 보존했으므로 운영 정상 요청 통과나 실제 공격 차단 성공으로 보고하지 않습니다.
허용 모의 판정기를 연결한 어댑터 시험에서는 명확한 공격만 추가 거부하고 정상 요청은 통과했습니다.
차단 후보는 경보를 처리한 시각부터 15분 동안 유효하며, 같은 출발 주소가 계정을 바꿔도 추가 거부합니다.
상세 구조와 남은 연결 사항은 [보너스 설명](xdr/brute-force/README.md)을 확인하세요.

## 코드 설명 읽기

함수 위의 한국어 주석에서 역할을 확인할 수 있습니다. JSON은 주석을 허용하지 않으므로 [JSON 항목 묶음 설명](docs/JSON_COMMENTS.md)을 함께 읽으세요.
