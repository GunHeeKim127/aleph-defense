import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { RULE_IDS } from './decider.mjs';
import { verifyPolicySnapshot } from './policy-restore.mjs';
import { createLoginVerifier } from './verify-login.mjs';

const CHECKS = Object.freeze([
  ['s01_public_shell', 1, 'normal', 'GET /', 'HTTP 200'],
  ['s01_public_sample', 1, 'normal', 'GET /data.json', 'HTTP 200, notes 0'],
  ['s02_server_notes', 2, 'forbidden', 'GET /api/notes/:id without login', 'HTTP 401 or 403'],
  ['s02_direct_database', 2, 'forbidden', 'anon direct database SELECT', 'HTTP 401 or 403'],
  ['s03_login', 3, 'normal', 'POST /api/auth', 'authenticated session'],
  ['s03_anonymous_notes', 3, 'forbidden', 'GET /api/notes', 'HTTP 401 or 403'],
  ['s03_logout', 3, 'normal', 'POST /api/auth logout', 'authenticated false'],
  ['s04_own_note_read', 4, 'normal', 'GET /api/notes/:id', 'HTTP 200 for owner'],
  ['s04_other_note_read', 4, 'forbidden', 'GET /api/notes/:id', 'HTTP 403 for non-owner'],
  ['s04_other_note_update', 4, 'forbidden', 'PUT /api/notes/:id', 'HTTP 403 for non-owner'],
  ['s04_other_note_delete', 4, 'forbidden', 'DELETE /api/notes/:id', 'HTTP 403 for non-owner'],
  ['s05_server_list', 5, 'normal', 'GET /api/notes', 'HTTP 200 for signed-in owner'],
  ['s05_anon_direct_read', 5, 'forbidden', 'anon direct database SELECT', 'HTTP 401 or 403'],
  ['s05_browser_key', 5, 'forbidden', 'GET /app.js', 'no public database key'],
  ['s06_registered_device', 6, 'normal', 'decide registered request', 'allow'],
  ['s06_unregistered_device', 6, 'forbidden', 'decide unregistered request', 'deny device_not_registered'],
  ['s07_normal_context', 7, 'normal', 'decide normal context', 'allow'],
  ['s07_composite_risk', 7, 'forbidden', 'decide composite risk', 'step_up'],
  ['s07_fresh_step_up', 7, 'normal', 'decide verified step-up', 'allow'],
  ['s08_own_note_zone', 8, 'normal', 'GET /notes/:id', 'allow'],
  ['s08_note_bulk', 8, 'forbidden', 'GET /notes', 'deny resource_not_allowed'],
  ['s08_announcement_read', 8, 'forbidden', 'GET /announcements/:id', 'deny resource_not_allowed'],
  ['s08_announcement_update', 8, 'forbidden', 'PUT /announcements/:id', 'deny resource_not_allowed'],
  ['s08_unknown_route', 8, 'forbidden', 'GET /notes/export', 'deny resource_not_allowed'],
  ['s09_normal_reads', 9, 'normal', '30 GET events', 'observe'],
  ['s09_threshold_reads', 9, 'normal', '120 GET events in 10 minutes', 'observe'],
  ['s09_burst_reads', 9, 'forbidden', '121 GET events in 10 minutes', 'propose_revocation'],
  ['s09_split_subjects', 9, 'normal', '100 GET events per subject', 'observe'],
  ['s10_policy_snapshot', 10, 'normal', 'verify safe policy snapshot', 'verified version'],
  ['s10_policy_diff', 10, 'normal', 'plan test policy restore', 'changes shown before write'],
  ['s10_wrong_owner_restore', 10, 'forbidden', 'POST /api/restore/notes/:id', 'HTTP 403'],
  ['s10_missing_backup', 10, 'forbidden', 'POST /api/restore/notes/:id', 'HTTP 503'],
  ['s10_owned_restore', 10, 'normal', 'POST /api/restore/notes/:id', 'one verified note restored'],
  ['s11_manifest', 11, 'normal', 'GET /manifest.webmanifest', 'HTTP 200'],
  ['s11_pending_hidden', 11, 'forbidden', 'GET /api/notes before approval', 'HTTP 403'],
  ['s11_approved_open', 11, 'normal', 'GET /api/operations on approved device', 'HTTP 200'],
  ['s11_install_not_trust', 11, 'forbidden', 'installed app before approval', 'protected data hidden'],
  ['s11_browser_storage', 11, 'forbidden', 'browser storage inspection', 'no device key or token'],
  ['s11_offline_notes', 11, 'forbidden', 'offline protected API', 'no cached protected data'],
  ['s11_anonymous_approval', 11, 'forbidden', 'GET /api/device-approval', 'HTTP 401 or 403'],
  ['s11_approved_crud', 11, 'normal', 'approved device note CRUD', 'owner CRUD preserved'],
]);

// 안전 정책 사본의 내용 해시를 다시 검증하고 본문 없는 버전 요약만 만듭니다.
function recoverySummary() {
  const text = readFileSync(new URL('../backups/step10/safe-policy.json', import.meta.url), 'utf8');
  const hash = readFileSync(new URL('../backups/step10/safe-policy.sha256', import.meta.url), 'utf8').trim();
  const snapshot = verifyPolicySnapshot(text, hash);
  return { status: 'verified_snapshot', version: snapshot.version,
    sourceCommit: snapshot.sourceCommit.slice(0, 12), service: snapshot.service };
}

// 승인된 사용자의 요청에 가린 작전 요약과 실행 여부가 분리된 41종 표를 반환합니다.
export function createOperationsHandler({ config, env = process.env,
  fetchImpl = (...args) => fetch(...args), now = () => new Date(), verifierFactory = createLoginVerifier } = {}) {
  let verify;
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ error: '허용되지 않은 요청입니다.' });
    }
    if (Object.keys(req.query ?? {}).length) return res.status(400).json({ error: '쿼리 없이 요청하세요.' });
    try {
      verify ??= verifierFactory({ config, supabaseSecretKey: env.SUPABASE_SECRET_KEY });
      const identity = await verify(req.headers?.authorization);
      if (!identity?.userId) return res.status(401).json({ error: '로그인이 필요합니다.' });
      const checkedAt = now().toISOString();
      const observations = [
        { checkId: 's01_public_sample', path: '/data.json', requestId: randomUUID() },
        { checkId: 's03_anonymous_notes', path: '/api/notes', requestId: randomUUID() },
        { checkId: 's02_server_notes', path: '/api/notes/00000000-0000-4000-8000-000000000001', requestId: randomUUID() },
      ];
      for (const observation of observations) {
        const response = await fetchImpl(new URL(observation.path, config.publicAppUrl).href, {
          method: 'GET', redirect: 'error', headers: { 'X-Request-Id': observation.requestId },
          signal: AbortSignal.timeout(10000),
        });
        observation.status = response.status;
        if (observation.checkId === 's01_public_sample') {
          let noteCount = null;
          try { const data = await response.json(); if (Array.isArray(data?.notes)) noteCount = data.notes.length; } catch { }
          observation.actual = `HTTP ${response.status} · public notes ${noteCount ?? 'unknown'}`;
          observation.matched = response.status === 200 && noteCount === 0;
        } else {
          observation.actual = `HTTP ${response.status} · anonymous response body redacted`;
          observation.matched = response.status === 401 || response.status === 403;
        }
      }
      const checks = CHECKS.map(([checkId, stage, kind, request, expected]) => ({
        checkId, stage, kind, request, expected, status: 'not_run', actual: null,
        requestId: null, checkedAt: null,
      }));
      for (const observation of observations) Object.assign(
        checks.find(item => item.checkId === observation.checkId),
        { status: 'measured', actual: observation.actual, requestId: observation.requestId,
          checkedAt, matched: observation.matched },
      );
      const measured = checks.filter(item => item.status === 'measured');
      const matched = measured.filter(item => item.matched === true);
      return res.status(200).json({
        schema: 'aleph.operations.v1', checkedCommit: process.env.VERCEL_GIT_COMMIT_SHA?.toLowerCase() ?? 'local',
        generatedAt: checkedAt,
        sources: { student: ['src/decider.mjs', 'src/detect.mjs', 'public/manifest.webmanifest'],
          engine: 'ALEPH SDP engine', engineRuntimeEvidence: 'not_run' },
        policy: { ruleIds: [...RULE_IDS], count: RULE_IDS.length },
        detection: { status: 'not_run', eventCount: null, reason: 'verified engine events were not supplied' },
        revocation: { status: 'not_run', proposed: null, completed: null, reason: 'engine revocation result was not supplied' },
        recovery: recoverySummary(),
        checkCounts: { total: checks.length, measured: measured.length,
          matched: matched.length,
          notRun: checks.length - measured.length },
        checks: checks.map(({ matched: _matched, ...item }) => item),
      });
    } catch {
      return res.status(503).json({ error: '작전실 서버 기록을 확인할 수 없습니다.' });
    }
  };
}

