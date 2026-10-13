import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { verifyPolicySnapshot, diffTestPolicy, restoreTestPolicy } from '../src/policy-restore.mjs';
import { createRestoreNoteHandler } from '../src/restore-note-api.mjs';

const readJson = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const response = () => ({
  statusCode: 0, body: undefined, headers: {},
  setHeader(name, value) { this.headers[name] = value; },
  status(code) { this.statusCode = code; return this; },
  json(value) { this.body = value; return this; },
  end() { return this; },
});
const config = { identityProvider: { issuer: 'https://example.supabase.co/auth/v1' } };
const ownerId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const noteId = '22222222-2222-4222-8222-222222222222';
const body = '비공개 시험 메모';
const contentSha256 = createHash('sha256').update(body).digest('hex');
const backup = { id: noteId, ownerId, title: '복구 시험', body, contentSha256 };

test('안전 정책은 해시를 확인하고 변경 범위를 먼저 표시한다', async () => {
  const text = await readFile(new URL('../backups/step10/safe-policy.json', import.meta.url), 'utf8');
  const hash = (await readFile(new URL('../backups/step10/safe-policy.sha256', import.meta.url), 'utf8')).trim();
  const snapshot = verifyPolicySnapshot(text, hash);
  const current = await readJson('./fixtures/step10-current-policy.json');
  const plan = diffTestPolicy(snapshot, current);
  assert.equal(plan.service, 'student-notes');
  assert.deepEqual(plan.changes.map(change => change.ruleId), ['burst_read', 'device_registered', 'resource_zone_access', 'step_up_required']);
  assert.throws(() => restoreTestPolicy(snapshot, current, 'wrong-version'), /버전/);
  const { restored } = restoreTestPolicy(snapshot, current, snapshot.version);
  assert.deepEqual(restored.services['student-notes'].rules, snapshot.rules);
  assert.deepEqual(restored.services['unrelated-service'], current.services['unrelated-service']);
  assert.deepEqual(restored.auditHistory, current.auditHistory);
  const changedText = text.replace('"mode": "require"', '"mode": "optional"');
  assert.throws(() => verifyPolicySnapshot(changedText, hash), /검증/);
});

test('메모 복원은 로그인·대상·소유자가 모두 일치해야 한다', async () => {
  const handler = createRestoreNoteHandler({ config,
    env: { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SECRET_KEY: 'server-test-key' },
    verifierFactory: () => async () => ({ userId: ownerId }), backupLoader: () => backup,
    fetchImpl: async () => ({ ok: true, json: async () => [] }),
  });
  let res = response();
  await handler({ method: 'POST', headers: {}, query: { id: noteId } }, res);
  assert.equal(res.statusCode, 401);
  res = response();
  await handler({ method: 'POST', headers: { authorization: 'Bearer test' }, query: { id: '11111111-1111-4111-8111-111111111111' } }, res);
  assert.equal(res.statusCode, 404);
  const otherHandler = createRestoreNoteHandler({ config,
    env: { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SECRET_KEY: 'server-test-key' },
    verifierFactory: () => async () => ({ userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }), backupLoader: () => backup,
  });
  res = response();
  await otherHandler({ method: 'POST', headers: { authorization: 'Bearer test' }, query: { id: noteId } }, res);
  assert.equal(res.statusCode, 403);
});

test('B의 지정 메모 한 건만 복원하고 해시를 다시 확인한다', async () => {
  const calls = [];
  const handler = createRestoreNoteHandler({ config,
    env: { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SECRET_KEY: 'server-test-key' },
    verifierFactory: () => async () => ({ userId: ownerId }), backupLoader: () => backup,
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options });
      if (options.method === 'GET') return { ok: true, json: async () => [] };
      return { ok: true, json: async () => [{ id: noteId, owner_id: ownerId, content: body }] };
    },
  });
  const res = response();
  await handler({ method: 'POST', headers: { authorization: 'Bearer test' }, query: { id: noteId } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.restored, true);
  assert.equal(res.body.ownerVerified, true);
  assert.equal(res.body.contentSha256, contentSha256);
  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /id=eq/);
  assert.equal(calls[1].options.method, 'POST');
});
