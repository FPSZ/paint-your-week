import { $, REDUCED, fmtH } from '../core/utils.js';
import { CAT_IDS, dateOf, kOf, today } from '../core/domain.js';
import { S, V, W } from '../core/state.js';
import { updateGoalProgress } from './goals.js';

/* ================= stats / ring ================= */
export const arcsG = $('#arcs');
export const RC = 2 * Math.PI * 50;
export const arcEls = {};
export let shownPct = 0;
export function weekStats(w) {
  let planned = 0, done = 0, n = 0, nDone = 0, deepP = 0, deepD = 0; const byCat = {}, byCatP = {};
  for (const b of w.blocks) { const m = b.e - b.s; planned += m; n++; byCatP[b.c] = (byCatP[b.c] || 0) + m; if (b.c === 'deep') deepP += m; if (b.done) { done += m; nDone++; byCat[b.c] = (byCat[b.c] || 0) + m; if (b.c === 'deep') deepD += m; } }
  return { planned, done, n, nDone, deepP, deepD, byCat, byCatP, pct: planned ? Math.round(done / planned * 100) : 0 };
}
export function updateStats() {
  const w = W(); const s = weekStats(w);
  let cum = 0;
  CAT_IDS.forEach(c => { const len = s.planned ? (s.byCat[c] || 0) / s.planned * RC : 0; const a = arcEls[c]; a.style.strokeDasharray = `${Math.max(0, len - (len > 4 ? 2 : 0))} ${RC}`; a.style.strokeDashoffset = String(-cum); cum += len; });
  tweenPct(s.pct);
  $('#ringWrap').classList.toggle('glow', s.pct >= 80);
  let line;
  if (!s.n) line = '';
  else if (s.pct === 100) line = '<b>本周全部涂满</b>';
  else if (s.pct < 50) line = `已涂色 <b>${fmtH(s.done)} 小时</b>`;
  else line = `还差 <b>${s.n - s.nDone} 块</b>涂满本周`;
  $('#progLine').innerHTML = line;
  const t = today(); let shutDays = 0, elapsedDays = 0;
  for (let d = 0; d < 7; d++) { const k = kOf(dateOf(V.wk, d)); if (S.core.shut[k]) shutDays++; if (V.wk < t.wk || (V.wk === t.wk && d <= t.d)) elapsedDays++; }
  if (!$('#stDeep')) $('#stats').innerHTML = '<div><dt>专注</dt><dd><span id="stDeep"></span><small id="stDeepP"></small></dd></div><div><dt>完成</dt><dd><span id="stDone"></span><small id="stN"></small></dd></div><div><dt>收工</dt><dd><span id="stShut"></span><small id="stDays"></small></dd></div>';
  tweenText($('#stDeep'), s.deepD, v => fmtH(v)); $('#stDeepP').textContent = `/${fmtH(s.deepP)}h`;
  tweenText($('#stDone'), s.nDone); $('#stN').textContent = `/${s.n}`;
  tweenText($('#stShut'), shutDays); $('#stDays').textContent = `/${elapsedDays || 0}天`;
  updateGoalProgress();
}
export function tweenText(el, to, fmt = v => String(Math.round(v))) {
  const from = el.dataset.v == null ? to : +el.dataset.v; el.dataset.v = to;
  if (from === to || REDUCED.matches) { el.textContent = fmt(to); return; }
  const t0 = performance.now(), dur = 650;
  const step = now => { const k = Math.max(0, Math.min(1, (now - t0) / dur)); const e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(from + (to - from) * e); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
export function tweenPct(to) {
  const elp = $('#pct'); const from = shownPct; shownPct = to;
  if (from === to || REDUCED.matches) { elp.innerHTML = `${to}<sup>%</sup>`; return; }
  const t0 = performance.now(), dur = 700;
  const step = now => { const k = Math.max(0, Math.min(1, (now - t0) / dur)); const e = 1 - Math.pow(1 - k, 3); elp.innerHTML = `${Math.round(from + (to - from) * e)}<sup>%</sup>`; if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}

export function setup() {
  CAT_IDS.forEach(c => { const a = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); a.setAttribute('class', 'arc'); a.setAttribute('cx', 60); a.setAttribute('cy', 60); a.setAttribute('r', 50); a.style.stroke = `var(--c-${c})`; a.style.strokeDasharray = `0 ${RC}`; arcsG.appendChild(a); arcEls[c] = a; });
}
