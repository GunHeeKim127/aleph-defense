import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createDeviceApproval } from '../src/device-approval.mjs';

const ownerId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const deviceId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const config = { identityProvider: { issuer: 'https://example.supabase.co/auth/v1' } };
const env = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SECRET_KEY: 'test-server-key' };
const response = () => ({ statusCode: 0, body: null, headers: {}, setHeader(k,v){this.headers[k]=v;}, status(code){this.statusCode=code;return this;}, json(body){this.body=body;return this;} });
const verifierFactory = () => async () => ({ userId: ownerId });

test('승인 버튼은 pending 요청만 만들고 자료 권한을 주지 않는다', async () => {
  const calls = [];
  const approval = createDeviceApproval({ config, env, verifierFactory,
    fetchImpl: async (url, options) => { calls.push({ url: String(url), options }); return { ok: true, json: async () => [] }; } });
  let res = response();
  await approval.handler({ method: 'GET', headers: { authorization: 'Bearer test' } }, res);
  assert.deepEqual(res.body, { approved: false, status: 'not_requested' });
  res = response();
  await approval.handler({ method: 'POST', headers: { authorization: 'Bearer test' }, body: { action: 'request' } }, res);
  assert.equal(res.statusCode, 202);
  assert.deepEqual(res.body, { approved: false, status: 'pending' });
  assert.match(res.headers['Set-Cookie'], /HttpOnly; Secure; SameSite=Strict/);
  assert.equal(calls.at(-1).options.method, 'POST');
  assert.equal(JSON.parse(calls.at(-1).options.body).status, 'pending');
});

test('브라우저 자료 요청은 서버 승인표가 approved일 때만 통과한다', async () => {
  let status = 'pending', reached = 0;
  const approval = createDeviceApproval({ config, env, verifierFactory,
    fetchImpl: async () => ({ ok: true, json: async () => [{ status, requested_at: '2026-01-01', approved_at: status === 'approved' ? '2026-01-02' : null }] }) });
  const next = async (_req, res) => { reached++; return res.status(200).json({ protected: true }); };
  const guard = approval.guard(next);
  let res = response();
  await guard({ authSource: 'cookie', headers: { authorization: 'Bearer test', cookie: `__Host-device-id=${deviceId}` } }, res);
  assert.equal(res.statusCode, 403); assert.equal(reached, 0);
  status = 'approved'; res = response();
  await guard({ authSource: 'cookie', headers: { authorization: 'Bearer test', cookie: `__Host-device-id=${deviceId}` } }, res);
  assert.equal(res.statusCode, 200); assert.equal(reached, 1);
});

test('운영 엔진 Bearer 흐름은 기존 계약을 유지한다', async () => {
  const approval = createDeviceApproval({ config, env, verifierFactory, fetchImpl: async () => { throw new Error('unused'); } });
  const res = response();
  await approval.guard(async (_req, nextRes) => nextRes.status(200).json({ existing: true }))({ authSource: 'bearer', headers: {} }, res);
  assert.equal(res.statusCode, 200);
});

test('설치 화면은 승인 전 자료를 숨기고 브라우저 저장소에 키를 쓰지 않는다', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  const manifest = JSON.parse(await readFile(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'));
  assert.match(html, /rel="manifest"/);
  assert.match(html, /id="notes"[^>]*hidden/);
  assert.match(app, /\/api\/device-approval/);
  assert.doesNotMatch(app, /localStorage|sessionStorage|indexedDB/);
  assert.equal(manifest.display, 'standalone');
});
