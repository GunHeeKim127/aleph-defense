// Only return statuses and counts; never note bodies or credentials.
export async function runAttackChecks(config) {
  let app;
  try { app = new URL(config.publicAppUrl); } catch { throw new Error('실제 배포 주소가 필요합니다.'); }
  if (app.protocol !== 'https:' || app.hostname.endsWith('.example') || app.username || app.password
      || app.pathname !== '/' || app.search || app.hash) throw new Error('실제 배포 주소가 필요합니다.');
  const checks = [];
  for (const [path, id] of [['/data.json', 'static_note_read'], ['/api/notes', 'anonymous_api_read']]) {
    const response = await fetch(new URL(path, app), { redirect: 'error', signal: AbortSignal.timeout(10000) });
    let count = null;
    try { const data = await response.json(); if (Array.isArray(data.notes)) count = data.notes.length; } catch {}
    checks.push({ attackId: id, expected: path === '/data.json' ? '정적 메모 0건' : '공개 API의 남은 약점: 비로그인 메모 4건',
      observed: 'HTTP ' + response.status + ' · 메모 개수 ' + (count ?? '확인 불가') });
  }
  return checks;
}
