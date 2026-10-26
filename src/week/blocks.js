import { EASE_OUT, I, REDUCED, SPRING, clamp, el, esc, fmtDur, fmtT } from '../core/utils.js';
import { CATS, WD, today } from '../core/domain.js';
import { ST, V, W } from '../core/state.js';
import { blockEls, colEls } from './dom.js';
import { HH } from './grid.js';
import { E } from './editor.js';

/* ================= layout & blocks ================= */
export function layoutDay(list) {
  const sorted = [...list].sort((a, b) => a.s - b.s || b.e - a.e);
  const res = {}; let cluster = [], cEnd = -1, colsEnd = [];
  const flush = () => { const n = colsEnd.length; cluster.forEach(id => res[id].n = n); cluster = []; colsEnd = []; cEnd = -1; };
  for (const b of sorted) {
    if (cluster.length && b.s >= cEnd) flush();
    let ci = colsEnd.findIndex(end => end <= b.s);
    if (ci < 0) { ci = colsEnd.length; colsEnd.push(b.e); } else colsEnd[ci] = b.e;
    res[b.id] = { c: ci, n: 1 }; cluster.push(b.id); cEnd = Math.max(cEnd, b.e);
  }
  flush(); return res;
}
export const isLate = (b, wk = V.wk) => { if (b.done) return false; const t = today(); if (wk < t.wk) return true; if (wk > t.wk) return false; return b.d < t.d || (b.d === t.d && b.e <= t.m); };
export function makeBlockEl(b) {
  const e = el('div', 'blk', `<div class="flood"></div><div class="bin"><div class="bt"></div><div class="bm"></div><div class="bq"></div></div><button class="chk" type="button" aria-label="标记完成">${I.check}</button>`);
  e.dataset.id = b.id; e.tabIndex = 0; e.setAttribute('role', 'button');
  return e;
}
export function paintBlockEl(e, b, lay, hh, startM, endM) {
  const s = clamp(b.s, startM, endM), en = clamp(b.e, startM, endM);
  const top = (s - startM) / 60 * hh, h = Math.max((en - s) / 60 * hh - 2, 14);
  e.style.top = top + 'px'; e.style.height = h + 'px';
  e.style.left = `calc(${lay.c / lay.n * 100}% + 3px)`; e.style.width = `calc(${100 / lay.n}% - 6px)`;
  e.style.setProperty('--c', `var(--c-${b.c})`); e.style.setProperty('--on', `var(--on-${b.c})`);
  e.hidden = en <= s;
  e.classList.toggle('done', !!b.done);
  e.classList.toggle('late', isLate(b));
  e.classList.toggle('xs', h < 30); e.classList.toggle('sm', h >= 30 && h < 54);
  const title = b.t || CATS[b.c].full;
  const bt = e.children[1].children[0], bm = e.children[1].children[1], bq = e.children[1].children[2];
  const goal = b.g ? W().goals.find(g => g.id === b.g && g.t) : null;
  bt.innerHTML = (goal ? `<span class="bg-goal" title="${esc(goal.t)}"></span>` : '') + esc(title);
  bm.textContent = `${fmtT(b.s)}–${fmtT(b.e)} · ${fmtDur(b.e - b.s)}`;
  bq.textContent = b.q || ''; bq.style.display = b.q ? '' : 'none';
  e.setAttribute('aria-label', `${title}，${WD[b.d]} ${fmtT(b.s)} 到 ${fmtT(b.e)}${b.done ? '，已完成' : ''}`);
  e.querySelector('.chk').setAttribute('aria-label', b.done ? '取消完成' : '标记完成');
}
export function flipFrom(e, from, dur = 520) {
  const to = e.getBoundingClientRect(); if (!to.width || !from) return;
  const dx = from.left - to.left, dy = from.top - to.top, sx = from.width / to.width, sy = from.height / to.height;
  if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(sx - 1) < .02 && Math.abs(sy - 1) < .02) return;
  e.animate([{ transformOrigin: '0 0', transform: `translate(${dx}px,${dy}px) scale(${sx},${sy})` }, { transformOrigin: '0 0', transform: 'none' }], { duration: REDUCED.matches ? 1 : dur, easing: SPRING });
}
export function renderBlocks({ flip = false, enter = false, from = {} } = {}) {
  const w = W(); const st = ST(); const hh = HH(); const startM = st.startH * 60, endM = st.endH * 60;
  const first = new Map();
  if (flip) blockEls.forEach((e, id) => { if (!from[id]) first.set(id, e.getBoundingClientRect()); });
  for (const id in from) first.set(id, from[id]);
  const seen = new Set(); let i = 0;
  for (let d = 0; d < 7; d++) {
    const list = w.blocks.filter(b => b.d === d);
    const lay = layoutDay(list);
    list.sort((a, b) => a.s - b.s);
    for (const b of list) {
      seen.add(b.id);
      let e = blockEls.get(b.id), isNew = false;
      if (!e) { e = makeBlockEl(b); blockEls.set(b.id, e); isNew = true; }
      if (e.parentNode !== colEls[d]) colEls[d].appendChild(e);
      e.classList.remove('floating', 'lifted', 'resizing'); e.style.transform = '';
      paintBlockEl(e, b, lay[b.id], hh, startM, endM);
      if (isNew && !first.has(b.id) && (enter || !REDUCED.matches)) {
        e.animate([{ opacity: 0, transform: 'translateY(6px) scale(.94)' }, { opacity: 1, transform: 'none' }], { duration: REDUCED.matches ? 1 : 460, delay: enter ? Math.min(i * 14, 420) : 0, easing: SPRING, fill: 'backwards' });
        i++;
      }
    }
  }
  blockEls.forEach((e, id) => {
    if (seen.has(id)) return;
    blockEls.delete(id);
    if (REDUCED.matches || !e.isConnected || e.offsetParent === null) { e.remove(); return; }
    const a = e.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.9)' }], { duration: 200, easing: EASE_OUT });
    a.onfinish = () => e.remove();
  });
  first.forEach((r, id) => { const e = blockEls.get(id); if (e && seen.has(id)) flipFrom(e, r); });
  if (E) { const e = blockEls.get(E.id); blockEls.forEach(x => x.classList.toggle('editing', x === e)); }
}
