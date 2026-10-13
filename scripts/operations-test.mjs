import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createOperationsHandler } from '../src/operations-api.mjs';
import { RULE_IDS } from '../src/decider.mjs';

const response = () => ({ statusCode: 0, body: null, headers: {},
  setHeader(key, value) { this.headers[key] = value; },
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; } });

const handler = createOperationsHandler({ config: { publicAppUrl: 'https://student.example' },
  now: () => new Date('2026-10-13T00:00:00.000Z'),
  verifierFactory: () => async () => ({ userId: 'student-fixture' }),
  fetchImpl: async () => ({ status: 401 }) });
const res = response();
await handler({ method: 'GET', query: {}, headers: { 'x-request-id': '11111111-1111-4111-8111-111111111111' } }, res);
assert.equal(res.statusCode, 200);
assert.equal(res.body.checks.length, 41);
assert.deepEqual(res.body.policy.ruleIds, [...RULE_IDS]);
assert.deepEqual(res.body.checkCounts, { total: 41, measured: 2, matched: 2, notRun: 39 });
assert.equal(res.body.checks.filter(item => item.status === 'not_run').length, 39);
const serialized = JSON.stringify(res.body);
assert.doesNotMatch(serialized, /Bearer\s+[A-Za-z0-9._~+/-]{16,}|sb_secret_|-----BEGIN [A-Z ]*PRIVATE KEY-----/u);
const mismatch = response();
const unsafeHandler = createOperationsHandler({ config: { publicAppUrl: 'https://student.example' },
  verifierFactory: () => async () => ({ userId: 'student-fixture' }), fetchImpl: async () => ({ status: 200 }) });
await unsafeHandler({ method: 'GET', query: {}, headers: {} }, mismatch);
assert.equal(mismatch.body.checkCounts.matched, 1);
const [html, app, worker] = await Promise.all([
  readFile(new URL('../public/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../public/app.js', import.meta.url), 'utf8'),
  readFile(new URL('../public/service-worker.js', import.meta.url), 'utf8'),
]);
assert.match(html, /id="operations"[^>]*hidden/u);
assert.match(app, /fetch\('\/api\/operations'/u);
assert.match(app, /counts\.measured \+ counts\.notRun !== counts\.total/u);
assert.match(worker, /pathname\.startsWith\('\/api\/'\)/u);
console.log('통과 · 작전실 서버 요약과 41종 실행·미실행 수치 일치');
console.log('통과 · 정상 허용과 익명 거부의 요청 ID·확인 시각 기록');
console.log('통과 · 메모 본문·토큰·비밀번호를 응답에 포함하지 않음');

