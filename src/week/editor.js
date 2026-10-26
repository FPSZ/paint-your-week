import { $, $$, EASE_OUT, MOBILE, REDUCED, SPRING, clamp, el, esc, fmtDur, fmtT, toM, uid } from '../core/utils.js';
import { CATS, CAT_IDS, WD, cv } from '../core/domain.js';
import { S, V, W, commit, curBlock, snap, undo } from '../core/state.js';
import { blockEls, colsBox } from './dom.js';
import { avgEnergy } from './grid.js';
import { renderBlocks } from './blocks.js';
import { renderDayHeads } from './dayheads.js';
import { updateStats } from '../side/stats.js';
import { renderInbox } from '../inbox/list.js';
import { renderNow } from '../side/now.js';
import { refresh } from './refresh.js';
import { dupTomorrow, removeBlock, toggleDone } from './actions.js';
import { toast } from '../ui/toast.js';
import { ibx } from '../inbox/float.js';

/* ================= editor ================= */
export const pop = $('#pop');
export let E = null;
export const edTitle = $('#edTitle'), edStart = $('#edStart'), edEnd = $('#edEnd'), edCue = $('#edCue');
export function fillEditor() {
  const b = curBlock(E.id); if (!b) return;
  if (document.activeElement !== edTitle) edTitle.value = b.t;
  edTitle.placeholder = CATS[b.c].full;
  pop.style.setProperty('--c', `var(--c-${b.c})`); pop.style.setProperty('--on', `var(--on-${b.c})`);
  $$('.cchip', pop).forEach(x => x.classList.toggle('on', x.dataset.c === b.c));
  $$('.dchip', pop).forEach(x => x.classList.toggle('on', +x.dataset.d === b.d));
  if (document.activeElement !== edStart) edStart.value = fmtT(b.s);
  if (document.activeElement !== edEnd) edEnd.value = fmtT(b.e % 1440);
  $('#edDur').textContent = fmtDur(b.e - b.s);
  $$('.durchip', pop).forEach(x => x.classList.toggle('on', +x.dataset.m === b.e - b.s));
  if (document.activeElement !== edCue) edCue.value = b.q || '';
  const goals = W().goals.filter(g => g.t.trim());
  $('#edGoalWrap').hidden = !goals.length;
  $('#edGoals').innerHTML = goals.map(g => `<button type="button" class="gchip ${b.g === g.id ? 'on' : ''}" data-g="${g.id}" title="${esc(g.t)}">${esc(g.t)}</button>`).join('');
  const pb = $('#edPaint'); pb.classList.toggle('on', !!b.done); pb.setAttribute('aria-pressed', String(!!b.done));
  $('span', pb).textContent = b.done ? '已涂色' : '涂色'; pb.title = b.done ? '再点一次取消涂色' : '标记为已完成';
  const hint = $('#edHint'); const lv = avgEnergy(b.s, b.e); const dur = b.e - b.s; let txt = '', good = false;
  if ((b.c === 'deep' || b.c === 'learn') && lv < .5) txt = '在你的低能时段，难的事放进金色时段更好。';
  else if (b.c === 'admin' && lv >= .9) txt = '高能时段，留给需要专注的事更好。';
  else if (b.c === 'deep' && dur < 45) txt = '专注块建议 60–90 分钟。';
  else if (b.c === 'deep' && dur > 180) txt = '超过 3 小时，中间记得休息。';
  else if ((b.c === 'deep' || b.c === 'learn') && lv >= .8) { txt = '在你的高能时段。'; good = true; }
  hint.hidden = !txt; hint.textContent = txt; hint.classList.toggle('good', good);
}
export function placePop() {
  if (MOBILE.matches) { pop.classList.add('sheet-mode'); return; }
  pop.classList.remove('sheet-mode');
  const e = blockEls.get(E.id); if (!e) return;
  const r = e.getBoundingClientRect(); const pw = pop.offsetWidth, ph = pop.offsetHeight;
  let x = r.right + 12, origin = 'left';
  if (x + pw > innerWidth - 12) { x = r.left - 12 - pw; origin = 'right'; }
  if (x < 12) { x = clamp(r.left, 12, innerWidth - pw - 12); origin = 'center'; }
  const y = clamp(r.top - 10, 12, innerHeight - ph - 12);
  pop.style.left = x + 'px'; pop.style.top = y + 'px'; pop.style.transformOrigin = `${origin} top`;
}
export function openEditor(id, { fresh = false } = {}) {
  if (E && E.id === id) return;
  if (E) closeEditor(true);
  const b = curBlock(id); if (!b) return;
  E = { id, fresh, touched: false, snapped: fresh };
  fillEditor();
  pop.getAnimations().forEach(a => a.cancel());
  pop.hidden = false; pop.style.visibility = 'hidden';
  placePop(); pop.style.visibility = '';
  pop.animate(MOBILE.matches ? [{ opacity: 0, transform: 'translateY(30px)' }, { opacity: 1, transform: 'none' }] : [{ opacity: 0, transform: 'scale(.94) translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: REDUCED.matches ? 1 : 380, easing: SPRING });
  blockEls.forEach((x, k) => x.classList.toggle('editing', k === id));
  if (fresh || !MOBILE.matches) setTimeout(() => { if (E && E.id === id) edTitle.focus(); }, 40);
}
export function closeEditor(instant = false) {
  if (!E) return;
  const id = E.id; const b = curBlock(id); const wasFresh = E.fresh && !E.touched && !(b && b.t.trim());
  E = null;
  blockEls.forEach(x => x.classList.remove('editing'));
  if (b && wasFresh) { W().blocks = W().blocks.filter(x => x.id !== id); commit('week'); refresh(); }
  else if (b && !b.t.trim()) { b.t = CATS[b.c].full; commit('week'); refresh(); }
  if (instant || REDUCED.matches) { pop.hidden = true; return; }
  const a = pop.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: MOBILE.matches ? 'translateY(24px)' : 'scale(.96)' }], { duration: 160, easing: EASE_OUT });
  a.onfinish = () => { if (!E) pop.hidden = true; };
}
export function editBlock(mut, { flip = false } = {}) {
  if (!E) return; const b = curBlock(E.id); if (!b) return;
  if (!E.snapped) { snap(); E.snapped = true; }
  mut(b); E.touched = true; V.lastCat = b.c; commit('week');
  if (flip) refresh({ flip: true }); else { renderBlocks(); renderDayHeads(); updateStats(); renderNow(); }
  fillEditor();
}
export function backToInbox(id) {
  const w = W(); const b = w.blocks.find(x => x.id === id); if (!b) return;
  const e = blockEls.get(id); const r = e && e.getBoundingClientRect();
  snap(); w.blocks = w.blocks.filter(x => x.id !== id);
  S.core.inbox.unshift({ id: uid(), t: b.t || CATS[b.c].full, c: b.c, est: b.e - b.s });
  commit('week', 'core'); renderInbox(); refresh();
  if (r && !REDUCED.matches) {
    const f = ibx.getBoundingClientRect(); const fly = el('div', 'ibx-fly'); fly.style.cssText = `${cv(b.c)};left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`; document.body.appendChild(fly);
    const an = fly.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${f.left + f.width / 2 - r.left - r.width / 2}px, ${f.top + f.height / 2 - r.top - r.height / 2}px) scale(.15)`, opacity: .2 }], { duration: 560, easing: 'cubic-bezier(.5,0,.2,1)' });
    an.onfinish = () => fly.remove();
  }
  toast(`已放回待安排`, { action: { label: '撤销', fn: undo } });
}

export function setup() {
  $('#edCats').innerHTML = CAT_IDS.map(c => `<button type="button" class="cchip" data-c="${c}" style="${cv(c)}"><i></i>${CATS[c].n}</button>`).join('');
  $('#edDays').innerHTML = WD.map((w, d) => `<button type="button" class="dchip" data-d="${d}">${w.slice(1)}</button>`).join('');
  $('#edDurs').innerHTML = [25, 45, 60, 90, 120].map(m => `<button type="button" class="durchip" data-m="${m}">${fmtDur(m)}</button>`).join('');
  edTitle.addEventListener('input', () => editBlock(b => { b.t = edTitle.value; }));
  edTitle.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); closeEditor(); } });
  edCue.addEventListener('input', () => editBlock(b => { b.q = edCue.value; }));
  edCue.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); closeEditor(); } });
  edStart.addEventListener('change', () => { const v = toM(edStart.value); if (!edStart.value) return; editBlock(b => { const dur = b.e - b.s; b.s = clamp(v, 0, 1435); b.e = Math.min(b.s + dur, 1440); }, { flip: true }); });
  edEnd.addEventListener('change', () => { if (!edEnd.value) return; let v = toM(edEnd.value); editBlock(b => { if (v === 0) v = 1440; b.e = v <= b.s ? Math.min(b.s + 5, 1440) : v; }, { flip: true }); });
  $('#edCats').addEventListener('click', e => { const c = e.target.closest('.cchip'); if (c) editBlock(b => { b.c = c.dataset.c; }); });
  $('#edDays').addEventListener('click', e => { const c = e.target.closest('.dchip'); if (c) editBlock(b => { b.d = +c.dataset.d; if (MOBILE.matches) V.sel = b.d; }, { flip: true }); });
  $('#edDurs').addEventListener('click', e => { const c = e.target.closest('.durchip'); if (c) editBlock(b => { b.e = Math.min(b.s + +c.dataset.m, 1440); }, { flip: true }); });
  $('#edGoals').addEventListener('click', e => { const c = e.target.closest('.gchip'); if (c) editBlock(b => { b.g = b.g === c.dataset.g ? null : c.dataset.g; }); });
  $('#edClose').addEventListener('click', () => closeEditor());
  $('#edDel').addEventListener('click', () => { const id = E.id; E.touched = true; closeEditor(true); removeBlock(id); });
  $('#edDup').addEventListener('click', () => { const id = E.id; E.touched = true; dupTomorrow(id); });
  $('#edBack').addEventListener('click', () => { const id = E.id; E.touched = true; closeEditor(true); backToInbox(id); });
  // 完成 = done editing; 涂色 = the task itself is done (the editor stays open)
  $('#edDone').addEventListener('click', () => closeEditor());
  $('#edPaint').addEventListener('click', () => { const id = E.id; E.touched = true; toggleDone(id, $('#edPaint')); if (E) fillEditor(); });
  document.addEventListener('pointerdown', e => {
    if (!E) return;
    if (pop.contains(e.target)) return;
    if (e.target.closest(`.blk[data-id="${E.id}"]`)) return;
    if (e.target.closest('.toast')) return;
    if (colsBox.contains(e.target) && !e.target.closest('.blk')) V.suppress = performance.now();
    closeEditor();
  }, true);
}
