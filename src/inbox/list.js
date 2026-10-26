import { $, $$, I, MOBILE, REDUCED, SPRING, clamp, esc, fmtDur, fmtT, uid } from '../core/utils.js';
import { CATS, CAT_IDS, WD, cv, today } from '../core/domain.js';
import { S, ST, V, W, commit, snap, undo } from '../core/state.js';
import { blockEls } from '../week/dom.js';
import { avgEnergy } from '../week/grid.js';
import { flipFrom } from '../week/blocks.js';
import { renderNow } from '../side/now.js';
import { refresh } from '../week/refresh.js';
import { DRAG_CLICK_BLOCK } from '../week/drag.js';
import { scrollToMinute } from '../week/nav.js';
import { toast } from '../ui/toast.js';
import { IB, ibxFab } from './float.js';

/* ================= inbox ================= */
export const inList = $('#inList'), inInput = $('#inInput');
export function syncInOpts() { $$('.cat-dot', $('#inCats')).forEach(b => b.classList.toggle('on', b.dataset.c === V.inCat)); $$('.est', $('#inEsts')).forEach(b => b.classList.toggle('on', +b.dataset.m === V.inEst)); }
export function parseEst(text) {
  const raw = String(text || '');
  const m = raw.match(/\s*(半个?小时|(\d+(?:\.\d+)?)\s*(h|hr|hrs|个?小时|m|min|mins|分钟|分))\s*$/i);
  if (!m || m.index === 0) return { t: raw, est: null };
  let mins = m[1].startsWith('半') ? 30 : /^(h|hr|hrs|个?小时)$/i.test(m[3]) ? parseFloat(m[2]) * 60 : parseFloat(m[2]);
  mins = clamp(Math.round(mins / 5) * 5, 5, 480);
  return { t: raw.slice(0, m.index), est: mins };
}
export function addTask(title, cat = V.inCat, est = V.inEst) {
  const t = String(title || '').trim(); if (!t) return null;
  snap(); const task = { id: uid(), t, c: cat, est }; S.core.inbox.unshift(task); commit('core'); renderInbox(task.id); return task;
}
export function renderInbox(newId) {
  renderNow();
  const list = S.core.inbox;
  const nEl = $('#inCount'), grew = list.length > (renderInbox.n ?? list.length); renderInbox.n = list.length;
  nEl.textContent = list.length; nEl.hidden = !list.length; $('#inTip').hidden = !list.length;
  if (grew && !IB.open && !REDUCED.matches) { nEl.animate([{ transform: 'scale(1.6)' }, { transform: 'none' }], { duration: 520, easing: SPRING }); ibxFab.animate([{ transform: 'translateY(-6px)' }, { transform: 'none' }], { duration: 520, easing: SPRING }); }
  if (!list.length) { inList.innerHTML = ''; return; }
  inList.innerHTML = list.map(t => `<li class="task" data-tid="${t.id}" style="${cv(t.c)}"><span class="t-dot"></span><span class="t-title" title="点击改名">${esc(t.t)}</span><span class="t-est">${fmtDur(t.est)}</span><button class="t-btn t-auto" type="button" title="自动排进合适的空档" aria-label="自动排入">${I.auto}</button><button class="t-btn t-del" type="button" title="删除" aria-label="删除">${I.x}</button></li>`).join('');
  if (newId) { const li = $(`[data-tid="${newId}"]`, inList); if (li && !REDUCED.matches) li.animate([{ opacity: 0, transform: 'translateY(-8px) scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: SPRING }); }
}
export function renameTask(li, id) {
  const task = S.core.inbox.find(t => t.id === id); if (!task) return;
  const span = $('.t-title', li); if ($('input', span)) return;
  span.innerHTML = `<input value="${esc(task.t)}" maxlength="60" aria-label="改名">`; const inp = $('input', span); inp.focus(); inp.select();
  const done = save => { if (save && inp.value.trim() && inp.value.trim() !== task.t) { snap(); task.t = inp.value.trim(); commit('core'); } renderInbox(); };
  inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') done(true); if (ev.key === 'Escape') done(false); ev.stopPropagation(); });
  inp.addEventListener('blur', () => done(true));
  inp.addEventListener('pointerdown', ev => ev.stopPropagation());
}
export function findSlot(est, cat, wk = V.wk) {
  const t = today(); if (wk < t.wk) return null;
  const w = W(wk); const st = ST(); const startM = st.startH * 60, endM = st.endH * 60;
  const wantHigh = cat === 'deep' || cat === 'learn';
  let best = null;
  for (let d = (wk === t.wk ? t.d : 0); d < 7; d++) {
    const busy = w.blocks.filter(b => b.d === d);
    let from = startM; if (wk === t.wk && d === t.d) from = Math.max(from, Math.ceil((t.m + 10) / 15) * 15);
    let dayBest = null;
    for (let s = from; s + est <= endM; s += 15) {
      if (busy.some(b => b.s < s + est && b.e > s)) continue;
      const lv = avgEnergy(s, s + est);
      let sc = wantHigh ? lv : (lv >= .85 ? .35 : .9 - Math.abs(lv - .6) * .3);
      if (s >= 22 * 60) sc -= .35;
      if (s < 7 * 60) sc -= .3;
      sc -= (s - from) / 1440 * .08;
      if (!dayBest || sc > dayBest.sc) dayBest = { d, s, sc };
    }
    if (dayBest) {
      if (!best || dayBest.sc - d * .03 > best.sc - best.d * .03) best = dayBest;
      if (dayBest.sc >= (wantHigh ? .8 : .7)) break;
    }
  }
  return best;
}
export function autoSchedule(id, li) {
  const task = S.core.inbox.find(t => t.id === id); if (!task) return;
  const slot = findSlot(task.est, task.c);
  if (!slot) { toast(V.wk < today().wk ? '这是过去的一周，换到本周或下周再排' : '这周已经没有放得下的空档了'); return; }
  const from = li ? li.getBoundingClientRect() : null;
  snap(); S.core.inbox = S.core.inbox.filter(t => t.id !== id);
  const b = { id: uid(), d: slot.d, s: slot.s, e: Math.min(slot.s + task.est, 1440), t: task.t, c: task.c, q: '', g: null, done: false };
  W().blocks.push(b); commit('core', 'week');
  if (MOBILE.matches) V.sel = b.d;
  renderInbox(); refresh();
  scrollToMinute(b.s, true);
  requestAnimationFrame(() => { const e = blockEls.get(b.id); if (e && from) flipFrom(e, from, 640); });
  const lv = avgEnergy(b.s, b.e);
  toast(`已排进 ${WD[b.d]} ${fmtT(b.s)}${(b.c === 'deep' || b.c === 'learn') && lv >= .8 ? ' · 高能时段' : ''}`, { action: { label: '撤销', fn: undo } });
}

export function setup() {
  $('#inCats').innerHTML = CAT_IDS.map(c => `<button type="button" class="cat-dot" data-c="${c}" style="${cv(c)}" title="${CATS[c].full}" aria-label="${CATS[c].full}"><i></i></button>`).join('');
  $('#inEsts').innerHTML = [15, 30, 60, 90, 120].map(m => `<button type="button" class="est" data-m="${m}" aria-label="预计 ${fmtDur(m)}">${fmtDur(m)}</button>`).join('');
  $('#inCats').addEventListener('click', e => { const b = e.target.closest('.cat-dot'); if (b) { V.inCat = b.dataset.c; syncInOpts(); inInput.focus(); } });
  $('#inEsts').addEventListener('click', e => { const b = e.target.closest('.est'); if (b) { V.inEst = +b.dataset.m; syncInOpts(); inInput.focus(); } });
  $('#inForm').addEventListener('submit', e => { e.preventDefault(); const p = parseEst(inInput.value); addTask(p.t, V.inCat, p.est || V.inEst); inInput.value = ''; $('#inForm').classList.remove('typing'); syncInOpts(); });
  inInput.addEventListener('input', () => { $('#inForm').classList.toggle('typing', !!inInput.value); const p = parseEst(inInput.value); $$('.est', $('#inEsts')).forEach(b => b.classList.toggle('on', +b.dataset.m === (p.est || V.inEst))); });
  inList.addEventListener('click', e => {
    const li = e.target.closest('.task'); if (!li) return; const id = li.dataset.tid;
    if (e.target.closest('.t-del')) { snap(); S.core.inbox = S.core.inbox.filter(t => t.id !== id); commit('core'); const a = li.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateX(20px)' }], { duration: 180 }); a.onfinish = () => renderInbox(); toast('已删除', { action: { label: '撤销', fn: undo } }); return; }
    if (e.target.closest('.t-auto')) { autoSchedule(id, li); return; }
    if (e.target.closest('.t-title') && !DRAG_CLICK_BLOCK) renameTask(li, id);
  });
}
