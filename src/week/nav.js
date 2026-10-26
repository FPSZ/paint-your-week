import { $, MOBILE, REDUCED, SPRING, clamp } from '../core/utils.js';
import { shiftWk, today } from '../core/domain.js';
import { MV, ST, V } from '../core/state.js';
import { Sync } from '../core/sync.js';
import { blockEls, colEls, colsBox, dayheads, dhEls, scroller } from './dom.js';
import { HH } from './grid.js';
import { renderDayHeads, renderTodayMarks } from './dayheads.js';
import { renderHeader } from './header.js';
import { renderGoals } from '../side/goals.js';
import { refresh } from './refresh.js';
import { E, closeEditor } from './editor.js';
import { curYM, goMonth, shiftYM } from '../month/month.js';

/* ================= day select (mobile) / week nav ================= */
export function selectDay(d, dir = 0) {
  if (d === V.sel) return; V.sel = d; renderDayHeads(); renderTodayMarks();
  if (MOBILE.matches && !REDUCED.matches && dir) colEls[d].animate([{ opacity: 0, transform: `translateX(${dir * 30}px)` }, { opacity: 1, transform: 'none' }], { duration: 360, easing: SPRING });
}
export function goWeek(wk, dir = 0) {
  if (E) closeEditor(true);
  const old = V.wk; V.wk = wk;
  const t = today(); V.sel = wk === t.wk ? t.d : 0;
  if (Sync.store) { if (old !== t.wk) Sync.unwatch(old); Sync.pull(wk).catch(() => {}); Sync.watch(wk); }
  blockEls.forEach(e => e.remove()); blockEls.clear();
  renderHeader(); renderGoals(); refresh({ enter: true });
  if (!REDUCED.matches && dir) {
    colsBox.animate([{ opacity: .2, transform: `translateX(${dir * 26}px)` }, { opacity: 1, transform: 'none' }], { duration: 420, easing: SPRING });
    $('.wk').animate([{ opacity: 0, transform: `translateX(${dir * 14}px)` }, { opacity: 1, transform: 'none' }], { duration: 420, easing: SPRING });
    dhEls.forEach((h, i) => $('.dh-date', h).animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 480, delay: i * 30, easing: SPRING, fill: 'backwards' }));
  }
}
export function backToThisWeek() { if (MV) { const c = curYM(); goMonth(c, c > MV.ym ? 1 : -1); return; } const t = today(); if (V.wk !== t.wk) goWeek(t.wk, t.wk > V.wk ? 1 : -1); scrollToMinute(t.m, true); }
export function scrollToMinute(m, smooth) {
  const st = ST(); const y = (clamp(m, st.startH * 60, st.endH * 60) - st.startH * 60) / 60 * HH();
  const base = colsBox.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
  const target = Math.max(0, base + y - scroller.clientHeight * .35);
  scroller.scrollTo({ top: target, behavior: smooth && !REDUCED.matches ? 'smooth' : 'auto' });
}

export function setup() {
  dayheads.addEventListener('click', e => { const h = e.target.closest('.dh'); if (h && MOBILE.matches) selectDay(+h.dataset.d, +h.dataset.d > V.sel ? 1 : -1); });
  $('#prevW').addEventListener('click', () => MV ? goMonth(shiftYM(MV.ym, -1), -1) : goWeek(shiftWk(V.wk, -1), -1));
  $('#nextW').addEventListener('click', () => MV ? goMonth(shiftYM(MV.ym, 1), 1) : goWeek(shiftWk(V.wk, 1), 1));
  $('#thisW').addEventListener('click', backToThisWeek);
  $('#wkLabel').addEventListener('click', () => { if (MV ? MV.ym !== curYM() : V.wk !== today().wk) backToThisWeek(); });
}
