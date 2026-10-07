// 화면 요소를 ID로 찾습니다.
const $ = id => document.getElementById(id);
let session = null, editId = null, generation = 0;
// 처리 결과나 오류를 화면의 상태 문구에 표시합니다.
const message = text => { $('status').textContent = text; };
// 편집 상태를 해제하고 메모 추가 화면으로 되돌립니다.
function resetEditor() {
  editId = null; $('editor').reset(); $('editor-heading').textContent = '가상 메모 추가';
  $('save').textContent = '추가'; $('cancel').hidden = true;
}
// 로그인 쿠키를 함께 보내 서버 메모 API를 호출하고 JSON 오류를 처리합니다.
async function api(path = '', options = {}) {
  if (!session) throw new Error('로그인이 필요합니다.');
  const response = await fetch('/api/notes' + path, {
    ...options, cache: 'no-store', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
  });
  const json = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(json?.error || '요청을 처리할 수 없습니다.');
  return json;
}
// 본인 메모 목록을 불러와 카드를 만들고 오래된 응답은 화면에 반영하지 않습니다.
async function load() {
  const ticket = generation;
  try {
    const rows = await api();
    if (ticket !== generation || !session) return;
    if (!Array.isArray(rows)) throw new Error('메모 형식을 확인하세요.');
    // 각 메모를 텍스트 요소와 수정·삭제 버튼이 있는 카드로 변환합니다.
    $('notes').replaceChildren(...rows.map(note => {
      const li = document.createElement('li'), title = document.createElement('strong'), body = document.createElement('p');
      title.textContent = note.title; body.textContent = note.body; body.className = 'body';
      const edit = document.createElement('button'); edit.type = 'button'; edit.textContent = '수정';
      // 버튼 클릭 시 해당 메모 또는 로그인 작업을 서버에 요청합니다.
      edit.onclick = async () => {
        try {
          const fresh = await api('/' + encodeURIComponent(note.id));
          editId = fresh.id; $('title').value = fresh.title; $('body').value = fresh.body;
          $('editor-heading').textContent = '가상 메모 수정'; $('save').textContent = '수정 저장'; $('cancel').hidden = false;
          $('title').focus();
        } catch (error) { message(error.message); }
      };
      const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '삭제';
      // 버튼 클릭 시 해당 메모 또는 로그인 작업을 서버에 요청합니다.
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
// 로그인 상태에 맞춰 입력 화면과 메모 목록을 갱신합니다.
function showSession(next) {
  generation++; session = next; $('notes').replaceChildren(); resetEditor();
  $('login').hidden = !!session; $('account').hidden = !session; $('editor').hidden = !session;
  $('account-label').textContent = session ? '로그인한 상태입니다.' : '';
  if (session) void load(); else message('로그인하면 내 메모를 볼 수 있습니다.');
}
// 양식 제출 시 서버에 요청하고 성공 상태와 오류를 화면에 반영합니다.
$('login').onsubmit = async event => {
  event.preventDefault(); $('login-button').disabled = true;
  try {
    const data = await auth({ action: 'login', email: $('email').value.trim(), password: $('password').value });
    $('password').value = '';
    showSession(data.authenticated);
  } catch (error) { $('password').value = ''; message('로그인 실패: ' + error.message); }
  finally { $('login-button').disabled = false; }
};
// 버튼 클릭 시 해당 메모 또는 로그인 작업을 서버에 요청합니다.
$('logout').onclick = async () => {
  try { await auth({ action: 'logout' }); showSession(null); }
  catch (error) { message('로그아웃 실패: ' + error.message); }
};
$('refresh').onclick = load; $('cancel').onclick = resetEditor;
// 양식 제출 시 서버에 요청하고 성공 상태와 오류를 화면에 반영합니다.
$('editor').onsubmit = async event => {
  event.preventDefault(); $('save').disabled = true;
  try {
    await api(editId ? '/' + encodeURIComponent(editId) : '', {
      method: editId ? 'PUT' : 'POST', body: JSON.stringify({ title: $('title').value, body: $('body').value }),
    });
    resetEditor(); await load();
  } catch (error) { message(error.message); } finally { $('save').disabled = false; }
};
// 서버 로그인 API를 호출하고 토큰 없이 인증 상태만 받습니다.
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
