import { $, $$, EASE_OUT, MOBILE, REDUCED, SPRING, esc, fmtH, fmtT, pad, uid } from '../core/utils.js';
import { CATS, CAT_IDS, addD, dateOf, isoWeek, kOf, md, mondayOf, parseK, shiftWk, today } from '../core/domain.js';
import { MV, S, ST, V, W, commit, setMV, snap, undo, undoStack } from '../core/state.js';
import { Sync } from '../core/sync.js';
import { dhEls } from '../week/dom.js';
import { avgEnergy } from '../week/grid.js';
import { renderDayHeads, renderTodayMarks } from '../week/dayheads.js';
import { renderHeader } from '../week/header.js';
import { weekStats } from '../side/stats.js';
import { renderInbox } from '../inbox/list.js';
import { refresh } from '../week/refresh.js';
import { E, closeEditor } from '../week/editor.js';
import { lsSet } from '../week/drag.js';
import { goWeek, scrollToMinute } from '../week/nav.js';
import { RIC, countUp } from '../pages/review.js';
import { openMonthReport } from '../pages/monthReport.js';
import { toast } from '../ui/toast.js';

/* ================= month view: the whole month at a glance, plus the monthly report ================= */
export const LS_VIEW = 'tuse-week-view';
export const appEl = $('#app'), mvEl = $('#mv'), mvGrid = $('#mvGrid'), mvSide = $('#mvSide');
export const MSEEN = new Set();
export const ymOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
export const parseYM = ym => { const [y, m] = ym.split('-').map(Number); return new Date(y, m - 1, 1); };
export const shiftYM = (ym, n) => { const d = parseYM(ym); return ymOf(new Date(d.getFullYear(), d.getMonth() + n, 1)); };
export const curYM = () => ymOf(today().now);
export const wkMonth = wk => ymOf(addD(parseK(wk), 3));
 // a week belongs to the month holding its Thursday
export const ymForWeek = wk => wk === today().wk ? curYM() : wkMonth(wk);
export function weekForYM(ym) { if (ym === curYM()) return today().wk; const m = kOf(mondayOf(parseYM(ym))); return wkMonth(m) === ym ? m : shiftWk(m, 1); }
export function monthWeeks(ym) { const f = parseYM(ym), l = new Date(f.getFullYear(), f.getMonth() + 1, 0); const out = []; for (let m = mondayOf(f); m <= l; m = addD(m, 7)) out.push(kOf(m)); return out; }
export const STAR_FILL = '<svg viewBox="0 0 24 24"><path d="M12 2.5l2.4 6.6 6.6 2.4-6.6 2.4L12 20.5l-2.4-6.6L3 11.5l6.6-2.4z"/></svg>';
export const ARROW_R = '<svg class="ic arr" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
export function dayInfo(date, tKey) {
  const key = kOf(date), wk = kOf(mondayOf(date)), d = (date.getDay() + 6) % 7, w = S.weeks[wk];
  const list = w ? w.blocks.filter(b => b.d === d).sort((a, b) => a.s - b.s) : [];
  let planned = 0, done = 0, nDone = 0; const byCat = {};
  for (const b of list) { const m = b.e - b.s; planned += m; if (b.done) { done += m; nDone++; byCat[b.c] = (byCat[b.c] || 0) + m; } }
  const dom = CAT_IDS.filter(c => byCat[c]).sort((a, b) => byCat[b] - byCat[a])[0] || (list[0] && list[0].c) || 'deep';
  return { date, key, wk, d, list, planned, done, nDone, byCat, dom, shut: !!S.core.shut[key], past: key < tKey, today: key === tKey, full: list.length >= 2 && nDone === list.length };
}
export function monthData(ym) {
  const f = parseYM(ym), Y = f.getFullYear(), M0 = f.getMonth(), N = new Date(Y, M0 + 1, 0).getDate();
  const tKey = today().key, st = ST();
  const days = [], s = { planned: 0, done: 0, n: 0, nDone: 0, deepD: 0, byCat: {}, byCatP: {} };
  const H0 = st.startH, heat = Array(st.endH - st.startH).fill(0);
  const titles = {}; let longest = null, jw = 0, jwDone = 0;
  for (let i = 1; i <= N; i++) {
    const x = dayInfo(new Date(Y, M0, i), tKey); days.push(x);
    s.planned += x.planned; s.done += x.done; s.n += x.list.length; s.nDone += x.nDone;
    for (const b of x.list) {
      const m = b.e - b.s; s.byCatP[b.c] = (s.byCatP[b.c] || 0) + m;
      if (b.src === 'jw' && x.key <= tKey) { jw++; if (b.done) jwDone++; }
      if (!b.done) continue;
      s.byCat[b.c] = (s.byCat[b.c] || 0) + m; if (b.c === 'deep') s.deepD += m;
      if (!longest || m > longest.b.e - longest.b.s) longest = { b, x };
      const name = (b.t || '').trim() || CATS[b.c].full; const tt = titles[name] || (titles[name] = { t: name, c: b.c, n: 0, min: 0 }); tt.n++; tt.min += m;
      for (let mm = b.s; mm < b.e; mm += 15) { const h = Math.floor(mm / 60) - H0; if (h >= 0 && h < heat.length) heat[h] += Math.min(15, b.e - mm); }
    }
  }
  s.pct = s.planned ? Math.round(s.done / s.planned * 100) : 0;
  let run = 0, streak = 0, sEnd = -1; days.forEach((x, i) => { run = x.nDone ? run + 1 : 0; if (run > streak) { streak = run; sEnd = i; } });
  let best = -1; days.forEach((x, i) => { if (x.done && (best < 0 || x.done > days[best].done)) best = i; });
  const weeks = monthWeeks(ym).map(wk => {
    const ds = days.filter(x => x.wk === wk), w = S.weeks[wk], byCat = {}; let planned = 0, done = 0;
    ds.forEach(x => { planned += x.planned; done += x.done; for (const c in x.byCat) byCat[c] = (byCat[c] || 0) + x.byCat[c]; });
    return { wk, no: isoWeek(parseK(wk)), ds, planned, done, byCat, pct: planned ? Math.round(done / planned * 100) : 0, goals: w && wkMonth(wk) === ym ? w.goals.map((g, gi) => ({ ...g, gi })).filter(g => g.t.trim()) : [] };
  });
  const wd = [0, 1, 2, 3, 4, 5, 6].map(d => {
    const ds = days.filter(x => x.d === d && x.key <= tKey), n = ds.length || 1, byCat = {}; let done = 0, planned = 0;
    ds.forEach(x => { done += x.done; planned += x.planned; for (const c in x.byCat) byCat[c] = (byCat[c] || 0) + x.byCat[c]; });
    for (const c in byCat) byCat[c] /= n;
    return { done: done / n, planned: planned / n, byCat };
  });
  let bestWd = -1; wd.forEach((x, d) => { if (x.done && (bestWd < 0 || x.done > wd[bestWd].done)) bestWd = d; });
  let peak = -1, pv = 0; for (let i = 0; i < heat.length - 1; i++) { const v = heat[i] + heat[i + 1]; if (v > pv) { pv = v; peak = i; } }
  const goals = weeks.flatMap(x => x.goals.map(g => ({ ...g, no: x.no, wk: x.wk })));
  return {
    ym, N, days, s, weeks, wd, bestWd, heat, H0, peak, goals, jw, jwDone, longest, streak, sEnd, best,
    elapsed: days.filter(x => x.key <= tKey).length, active: days.filter(x => x.nDone).length, full: days.filter(x => x.full), shut: days.filter(x => x.shut).length,
    tops: Object.values(titles).sort((a, b) => b.min - a.min || b.n - a.n).slice(0, 5), nTitles: Object.keys(titles).length,
  };
}
export function monthTotals(ym) {
  const f = parseYM(ym), N = new Date(f.getFullYear(), f.getMonth() + 1, 0).getDate(); let planned = 0, done = 0, n = 0;
  for (let i = 1; i <= N; i++) {
    const date = new Date(f.getFullYear(), f.getMonth(), i), w = S.weeks[kOf(mondayOf(date))]; if (!w) continue;
    const d = (date.getDay() + 6) % 7; for (const b of w.blocks) if (b.d === d) { planned += b.e - b.s; n++; if (b.done) done += b.e - b.s; }
  }
  return n ? { planned, done, n, pct: planned ? Math.round(done / planned * 100) : 0 } : null;
}

/* ----- switching ----- */
export function renderVsw() {
  $$('#vsw button').forEach(b => { const on = (b.dataset.v === 'month') === !!MV; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  $('#vsw').style.setProperty('--x', MV ? 1 : 0);
}
export function setView(v, { ym, wk, d, from } = {}) {
  const month = v === 'month';
  if (!!MV === month) return;
  if (E) closeEditor(true);
  lsSet(LS_VIEW, v); V.hoverId = null;
  if (!REDUCED.matches) $('.wk').animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: SPRING });
  if (month) {
    setMV({ ym: ym || ymForWeek(V.wk), cap: -1 });
    appEl.classList.add('month'); mvEl.hidden = false;
    renderVsw(); renderHeader(); renderMonth({ enter: true }); loadMonth(MV.ym);
    if (!REDUCED.matches) $('#mvCal').animate([{ opacity: 0, transform: 'translateY(10px) scale(.985)' }, { opacity: 1, transform: 'none' }], { duration: 520, easing: SPRING });
    return;
  }
  const back = MV.ym; setMV(null);
  appEl.classList.remove('month'); mvEl.hidden = true; mvEl.classList.remove('in');
  renderVsw();
  goWeek(wk || weekForYM(back), 0);
  const t = today();
  if (d != null) { V.sel = d; renderDayHeads(); renderTodayMarks(); }
  const first = d != null ? W().blocks.filter(b => b.d === d).sort((a, b) => a.s - b.s)[0] : null;
  requestAnimationFrame(() => scrollToMinute(V.wk === t.wk && (d == null || d === t.d) ? t.m : first ? first.s : 8 * 60, false));
  if (!REDUCED.matches) {
    const cal = $('#cal'), cr = cal.getBoundingClientRect();
    const origin = from ? `${from.left + from.width / 2 - cr.left}px ${from.top + from.height / 2 - cr.top}px` : '50% 0';
    cal.animate([{ opacity: 0, transform: 'scale(.93)', transformOrigin: origin }, { opacity: 1, transform: 'none', transformOrigin: origin }], { duration: 560, easing: SPRING });
    $$('#side > *').forEach((x, i) => x.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 560, delay: 40 + i * 50, easing: SPRING, fill: 'backwards' }));
    if (d != null) setTimeout(() => { const h = dhEls[d]; if (h) { h.classList.remove('pop-anim'); void h.offsetWidth; h.classList.add('pop-anim'); } }, 260);
  }
}
export function goMonth(ym, dir = 0) {
  if (!MV || ym === MV.ym) return;
  MV.ym = ym; renderHeader(); renderMonth({ dir }); loadMonth(ym);
  if (!REDUCED.matches && dir) $('.wk').animate([{ opacity: 0, transform: `translateX(${dir * 14}px)` }, { opacity: 1, transform: 'none' }], { duration: 420, easing: SPRING });
}
export async function loadMonth(ym) {
  if (!Sync.store) return;
  const want = [...monthWeeks(ym), ...monthWeeks(shiftYM(ym, -1))].filter((k, i, a) => a.indexOf(k) === i && !MSEEN.has(k));
  for (const wk of want) { if (!MV || !Sync.store) return; MSEEN.add(wk); try { await Sync.pull(wk); } catch (e) { MSEEN.delete(wk); } }
}
export function monthChanged() { if (!MV) return; clearTimeout(MV.rt); MV.rt = setTimeout(() => renderMonth({ quiet: true }), 120); }

/* ----- the calendar ----- */
export function renderMonth({ enter = false, dir = 0, quiet = false } = {}) {
  if (!MV) return;
  const ym = MV.ym, f = parseYM(ym), t = today(), wks = monthWeeks(ym);
  const R = monthData(ym);
  mvGrid.style.setProperty('--rows', wks.length);
  const cap = MOBILE.matches ? 0 : Math.max(0, Math.floor(((mvGrid.clientHeight || 600) / wks.length - 38) / 17)); MV.cap = cap;
  let html = '', i = 0;
  wks.forEach((wk, r) => {
    const w = S.weeks[wk], ws = w && w.blocks.length ? weekStats(w) : null, no = isoWeek(parseK(wk));
    html += `<button class="mv-wk${wk === t.wk ? ' cur' : ''}" type="button" data-wk="${wk}" title="第 ${no} 周" aria-label="打开第 ${no} 周" style="--r:${r}"><span>${no}</span><u><i style="--p:${ws ? ws.pct : 0}%"></i></u></button>`;
    for (let d = 0; d < 7; d++) {
      const date = dateOf(wk, d), x = dayInfo(date, t.key), out = date.getMonth() !== f.getMonth(), n = x.list.length;
      const over = cap > 0 && n > cap, items = cap > 0 ? x.list.slice(0, over ? cap - 1 : cap) : [];
      const cls = ['mv-day', out && 'out', x.today && 'today', x.full && 'full', x.past && 'past'].filter(Boolean).join(' ');
      const badge = (x.shut ? `<span class="moon" title="已收工">${RIC.moon}</span>` : '') + (x.full ? `<span class="ok" title="全部涂满">${RIC.check}</span>` : n && (x.past || x.today) ? `${x.nDone}/${n}` : '');
      html += `<div class="${cls}" role="button" tabindex="0" data-k="${x.key}" data-wk="${wk}" data-d="${d}" style="--c:var(--c-${x.dom});--f:${(x.planned ? x.done / x.planned : 0).toFixed(3)};--i:${i++}" aria-label="${md(date)}${n ? `，${n} 项，完成 ${x.nDone} 项` : ''}">
        <div class="mv-paint"></div>
        <div class="mv-top"><span class="mv-date">${date.getDate() === 1 ? `<small>${date.getMonth() + 1}月</small>` : ''}${date.getDate()}</span><span class="mv-badge">${badge}</span></div>
        <ul class="mv-items">${items.map(b => `<li class="${b.done ? 'done' : x.past ? 'miss' : ''}" style="--c:var(--c-${b.c})"><i></i><span>${esc(b.t || CATS[b.c].full)}</span></li>`).join('')}${over ? `<li class="more">+${n - cap + 1}</li>` : ''}</ul>
        <span class="mv-dots">${x.list.slice(0, 4).map(b => `<i class="${b.done ? 'done' : ''}" style="--c:var(--c-${b.c})"></i>`).join('')}</span>
      </div>`;
    }
  });
  mvGrid.innerHTML = html;
  renderMonthSide(R);
  if (quiet) return;
  mvEl.classList.remove('in'); void mvGrid.offsetWidth;
  requestAnimationFrame(() => { if (MV) mvEl.classList.add('in'); $$('[data-to]', mvSide).forEach(el => countUp(el, 1100)); });
  if (dir && !REDUCED.matches) mvGrid.animate([{ opacity: .15, transform: `translateX(${dir * 28}px)` }, { opacity: 1, transform: 'none' }], { duration: 460, easing: SPRING });
}
export function renderMonthSide(R) {
  const s = R.s, cur = R.ym === curYM(), future = R.ym > curYM();
  const prev = monthTotals(shiftYM(R.ym, -1));
  const up = prev && prev.done && s.done > prev.done ? Math.round((s.done - prev.done) / prev.done * 100) : 0;
  const cats = CAT_IDS.filter(c => s.byCatP[c]).sort((a, b) => (s.byCat[b] || 0) - (s.byCat[a] || 0) || s.byCatP[b] - s.byCatP[a]);
  const maxC = Math.max(1, ...cats.map(c => s.byCatP[c]));
  const k = cur ? `已过 ${R.elapsed} / ${R.N} 天` : future ? `${R.N} 天 · 还没开始` : `${R.N} 天`;
  mvSide.innerHTML = `
    <section style="--i:0" aria-label="本月涂色">
      <p class="mvs-k">${k}</p>
      <div class="mvs-big"><b data-to="${future ? s.planned : s.done}" data-fmt="h">${fmtH(future ? s.planned : s.done)}</b><span>${future ? '小时已安排' : '小时已涂色'}</span></div>
      ${future ? '' : `
      <div class="mvs-bar">${CAT_IDS.filter(c => s.byCat[c]).map((c, i) => `<i style="--c:var(--c-${c});--w:${(s.byCat[c] / Math.max(1, s.planned) * 100).toFixed(2)}%;--i:${i}" title="${CATS[c].full} ${fmtH(s.byCat[c])}h"></i>`).join('')}</div>
      <div class="mvs-rate"><span>涂色率<b>${s.pct}%</b></span><span>${s.planned ? `共排 ${fmtH(s.planned)} h` : ''}</span></div>`}
    </section>
    ${future ? '' : `<dl class="mvs-stats" style="--i:1">
      <div><dt>完成</dt><dd>${s.nDone}<small>/${s.n} 块</small></dd></div>
      <div><dt>活跃</dt><dd>${R.active}<small> 天</small></dd></div>
      <div><dt>最长连续</dt><dd>${R.streak}<small> 天</small></dd></div>
      <div><dt>收工</dt><dd>${R.shut}<small> 天</small></dd></div>
    </dl>`}
    ${cats.length ? `<section style="--i:2" aria-label="分类"><h2 class="mvs-h">${future ? '安排' : '时间去哪了'}</h2><div class="mvs-cats">${cats.map((c, i) => `<span class="mc-n" style="--c:var(--c-${c})"><i></i>${CATS[c].n}</span><span class="mc-t" style="--c:var(--c-${c});--pw:${(s.byCatP[c] / maxC * 100).toFixed(2)}%;--dw:${((s.byCat[c] || 0) / maxC * 100).toFixed(2)}%;--i:${i}"><b></b><i></i></span><span class="mc-h">${future ? `${fmtH(s.byCatP[c])}h` : `${fmtH(s.byCat[c] || 0)}<small>/${fmtH(s.byCatP[c])}h</small>`}</span>`).join('')}</div></section>` : ''}
    ${future ? '' : `<button class="mvs-go" id="mvReport" type="button" style="--i:3">${RIC.up}<span>月报</span>${up ? `<small>比上月 +${up}%</small>` : ''}${ARROW_R}</button>`}`;
  const go = $('#mvReport', mvSide); if (go) go.addEventListener('click', () => openMonthReport(R.ym));
}
export function openDayFromCell(cell) {
  const r = cell.getBoundingClientRect();
  setView('week', { wk: cell.dataset.wk, d: +cell.dataset.d, from: r });
}

/* ----- drop an inbox task on a day ----- */
export function findDaySlot(est, cat, wk, d) {
  const t = today(), w = S.weeks[wk], st = ST(), startM = st.startH * 60, endM = st.endH * 60;
  const busy = w ? w.blocks.filter(b => b.d === d) : [], wantHigh = cat === 'deep' || cat === 'learn';
  let from = startM; if (wk === t.wk && d === t.d) from = Math.max(from, Math.ceil((t.m + 10) / 15) * 15);
  let best = null;
  for (let s = from; s + est <= endM; s += 15) {
    if (busy.some(b => b.s < s + est && b.e > s)) continue;
    const lv = avgEnergy(s, s + est);
    let sc = wantHigh ? lv : (lv >= .85 ? .35 : .9 - Math.abs(lv - .6) * .3);
    if (s >= 22 * 60) sc -= .35;
    if (s < 7 * 60) sc -= .3;
    sc -= (s - from) / 1440 * .08;
    if (!best || sc > best.sc) best = { s, sc };
  }
  return best ? best.s : null;
}
export function monthHover(D) {
  let hit = null;
  if (!D.cancelHover) for (const c of $$('.mv-day', mvGrid)) { const r = c.getBoundingClientRect(); if (D.x >= r.left && D.x < r.right && D.y >= r.top && D.y < r.bottom) { hit = c; break; } }
  if (MV.drop !== hit) {
    if (MV.drop) MV.drop.classList.remove('drop');
    MV.drop = hit;
    if (hit) { hit.classList.add('drop'); hit.style.setProperty('--dc', `var(--c-${D.task.c})`); }
  }
  D.mtgt = hit ? { wk: hit.dataset.wk, d: +hit.dataset.d, k: hit.dataset.k } : null;
}
export function monthDrop(D) {
  if (MV.drop) { MV.drop.classList.remove('drop'); MV.drop = null; }
  const { wk, d, k } = D.mtgt, t = D.task;
  const s = findDaySlot(t.est, t.c, wk, d);
  if (s == null) { toast('那天已经排满了'); return false; }
  undoStack.pop(); snap(wk);
  const fl = D.fl, from = fl.getBoundingClientRect();
  S.core.inbox = S.core.inbox.filter(x => x.id !== t.id);
  W(wk).blocks.push({ id: uid(), d, s, e: Math.min(s + t.est, ST().endH * 60), t: t.t, c: t.c, q: '', g: null, done: false });
  commit('core', wk); renderInbox(); renderMonth({ quiet: true });
  if (wk === V.wk) refresh();
  const cell = mvGrid.querySelector(`[data-k="${k}"]`);
  if (cell && !REDUCED.matches) {
    const r = cell.getBoundingClientRect();
    const a = fl.animate([{ transform: fl.style.transform, opacity: 1 }, { transform: `translate3d(${r.left + r.width / 2 - from.width / 2}px, ${r.top + r.height / 2 - from.height / 2}px, 0) scale(.3)`, opacity: 0 }], { duration: 420, easing: EASE_OUT, fill: 'forwards' });
    a.onfinish = () => fl.remove();
    cell.animate([{ boxShadow: `inset 0 0 0 2px var(--c-${t.c})` }, { boxShadow: 'inset 0 0 0 0 transparent' }], { duration: 900, delay: 300, easing: EASE_OUT });
  } else fl.remove();
  toast(`已排进 ${md(dateOf(wk, d))} ${fmtT(s)}`, { action: { label: '撤销', fn: undo } });
  return true;
}

export function setup() {
  mvGrid.addEventListener('click', e => {
    const wb = e.target.closest('.mv-wk');
    if (wb) { const r = wb.getBoundingClientRect(); const wk = wb.dataset.wk; setView('week', { wk, d: wk === today().wk ? today().d : undefined, from: r }); return; }
    const c = e.target.closest('.mv-day'); if (c) openDayFromCell(c);
  });
  mvGrid.addEventListener('keydown', e => { const c = e.target.closest('.mv-day'); if (c && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openDayFromCell(c); } });
  $('#vsw').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setView(b.dataset.v); });
  if ('ResizeObserver' in window) new ResizeObserver(() => {
    if (!MV || MOBILE.matches) return;
    const cap = Math.max(0, Math.floor((mvGrid.clientHeight / monthWeeks(MV.ym).length - 38) / 17));
    if (cap !== MV.cap) renderMonth({ quiet: true });
  }).observe(mvGrid);
}
