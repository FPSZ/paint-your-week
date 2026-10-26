import { $, $$, esc } from './utils.js';
import { today } from './domain.js';
import { CAN_SERVER, LS_USER, MV, S, SERVER, USER, V, commit, loadLocal, redoStack, saveLocal, setRedoStack, setS, setSERVER, setUSER, setUndoStack, undoStack } from './state.js';
import { Sync } from './sync.js';
import { addRecent, loadRecent, normUser, pingApi, renderUserChip } from './tenants.js';
import { blockEls } from '../week/dom.js';
import { buildGrid } from '../week/grid.js';
import { renderHeader } from '../week/header.js';
import { syncInOpts } from '../inbox/list.js';
import { renderAll } from '../week/refresh.js';
import { E, closeEditor } from '../week/editor.js';
import { scrollToMinute } from '../week/nav.js';
import { closeModal, mBody, openModal } from '../ui/modal.js';
import { MSEEN, curYM, renderMonth } from '../month/month.js';
import { toast } from '../ui/toast.js';

export function openUserModal() {
  const recent = loadRecent().filter(n => n !== USER);
  const html = `<p class="m-eyebrow">WORKSPACE</p><h2 class="m-title">${USER ? '切换用户' : '输入用户名，进入你的周历'}</h2>
  <p class="m-sub">每个名字是一份独立的日程。没有密码，知道名字就能打开，别放隐私。</p>
  <form class="user-form" id="userForm" autocomplete="off"><label class="sr" for="userInput">用户名</label><input class="ed-input" id="userInput" maxlength="24" placeholder="例如 xiaolin_2026" autocapitalize="off" spellcheck="false" data-autofocus><button class="btn solid big" type="submit">进入</button></form>
  <p class="user-err" id="userErr" hidden></p>
  <p class="note" style="margin-top:10px">1–24 个字符：中文、字母、数字、_ - . ，不区分大小写。</p>
  ${recent.length ? `<h3 class="rv-h">这台设备上用过的</h3><div class="ed-goals">${recent.map(n => `<button class="gchip" type="button" data-user="${esc(n)}">${esc(n)}</button>`).join('')}</div>` : ''}`;
  openModal('user', html);
  $('#userForm').addEventListener('submit', e => {
    e.preventDefault(); const n = normUser($('#userInput').value);
    if (!n) { const er = $('#userErr'); er.hidden = false; er.textContent = '用户名只能用中文、字母、数字和 _ - . ，长度 1–24。'; $('#userInput').focus(); return; }
    switchUser(n);
  });
  $$('[data-user]', mBody).forEach(b => b.addEventListener('click', () => switchUser(b.dataset.user)));
}
export async function switchUser(name) {
  if (name === USER) { closeModal(); return; }
  if (E) closeEditor(true);
  await Sync.stop();
  clearTimeout(commit.t); saveLocal();
  setUSER(name); try { localStorage.setItem(LS_USER, name); } catch (e) {}
  addRecent(name);
  setS(loadLocal()); setUndoStack([]); MSEEN.clear(); setRedoStack([]);
  const t = today(); V.wk = t.wk; V.sel = t.d; V.dismissed = {};
  closeModal();
  buildGrid(); blockEls.forEach(x => x.remove()); blockEls.clear(); syncInOpts(); renderAll({ enter: true }); renderUserChip();
  if (MV) { MV.ym = curYM(); renderHeader(); renderMonth({ enter: true }); }
  requestAnimationFrame(() => scrollToMinute(t.m, false));
  toast(`已进入 ${name} 的周历`);
  Sync.init();
}

export function setup() {
  $('#userBtn').addEventListener('click', openUserModal);
  (async () => {
    if (!CAN_SERVER) { Sync.init(); return; }
    setSERVER(await pingApi());
    if (!SERVER) return;
    renderUserChip();
    if (USER) { addRecent(USER); Sync.init(); } else openUserModal();
  })();
}
