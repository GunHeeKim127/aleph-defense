const $ = id => document.getElementById(id);
let session = null, editId = null, generation = 0;
const message = text => { $('status').textContent = text; };
function resetEditor() {
  editId = null; $('editor').reset(); $('editor-heading').textContent = '가상 메모 추가';
  $('save').textContent = '추가'; $('cancel').hidden = true;
}
async function api(path = '', options = {}) {
  if (!session) throw new Error('로그인이 필요합니다.');
  const response = await fetch('/api/notes' + path, {
    ...options, cache: 'no-store', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
  });
  const json = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(json?.error || '요청을 처리할 수 없습니다.');
  return json;
}
async function load() {
  const ticket = generation;
  try {
    const rows = await api();
    if (ticket !== generation || !session) return;
    if (!Array.isArray(rows)) throw new Error('메모 형식을 확인하세요.');
    $('notes').replaceChildren(...rows.map(note => {
      const li = document.createElement('li'), title = document.createElement('strong'), body = document.createElement('p');
      title.textContent = note.title; body.textContent = note.body; body.className = 'body';
      const edit = document.createElement('button'); edit.type = 'button'; edit.textContent = '수정';
      edit.onclick = async () => {
        try {
          const fresh = await api('/' + encodeURIComponent(note.id));
          editId = fresh.id; $('title').value = fresh.title; $('body').value = fresh.body;
          $('editor-heading').textContent = '가상 메모 수정'; $('save').textContent = '수정 저장'; $('cancel').hidden = false;
          $('title').focus();
        } catch (error) { message(error.message); }
      };
      const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '삭제';
      remove.onclick = async () => {
        if (!confirm('이 가상 메모를 삭제할까요?')) return;
        try { await api('/' + encodeURIComponent(note.id), { method: 'DELETE' }); if (editId === note.id) resetEditor(); await load(); message('삭제했습니다.'); }
        catch (error) { message(error.message); }
      };
      li.append(title, body, edit, remove); return li;
    }));
    message(rows.length ? '내 메모 ' + rows.length + '건' : '내 메모가 없습니다. 가상 메모를 추가하세요.');
  } catch (error) { if (ticket === generation) { $('notes').replaceChildren(); message(error.message); } }
}
function showSession(next) {
  generation++; session = next; $('notes').replaceChildren(); resetEditor();
  $('login').hidden = !!session; $('account').hidden = !session; $('editor').hidden = !session;
  $('account-label').textContent = session ? '로그인한 상태입니다.' : '';
  if (session) void load(); else message('로그인하면 내 메모를 볼 수 있습니다.');
}
$('login').onsubmit = async event => {
  event.preventDefault(); $('login-button').disabled = true;
  try {
    const data = await auth({ action: 'login', email: $('email').value.trim(), password: $('password').value });
    $('password').value = '';
    showSession(data.authenticated);
  } catch (error) { $('password').value = ''; message('로그인 실패: ' + error.message); }
  finally { $('login-button').disabled = false; }
};
$('logout').onclick = async () => {
  try { await auth({ action: 'logout' }); showSession(null); }
  catch (error) { message('로그아웃 실패: ' + error.message); }
};
$('refresh').onclick = load; $('cancel').onclick = resetEditor;
$('editor').onsubmit = async event => {
  event.preventDefault(); $('save').disabled = true;
  try {
    await api(editId ? '/' + encodeURIComponent(editId) : '', {
      method: editId ? 'PUT' : 'POST', body: JSON.stringify({ title: $('title').value, body: $('body').value }),
    });
    resetEditor(); await load();
  } catch (error) { message(error.message); } finally { $('save').disabled = false; }
};
async function auth(body) {
  const response = await fetch('/api/auth', { method: body ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store',
    headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '로그인 요청을 처리할 수 없습니다.');
  return data;
}
try {
  showSession((await auth()).authenticated); $('login-button').disabled = false;
} catch { message('로그인 서버에 연결할 수 없습니다. 잠시 후 다시 시도하세요.'); }
