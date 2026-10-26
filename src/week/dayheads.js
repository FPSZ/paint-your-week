import { $, $$, I, MOBILE, REDUCED, SPRING, clamp, el, fmtT } from '../core/utils.js';
import { CAT_IDS, WD, dateOf, kOf, md, today } from '../core/domain.js';
import { S, ST, V, W } from '../core/state.js';
import { blockEls, colEls, dhEls, elapsedEl, gutter, nowLine, nowTag } from './dom.js';
import { HH } from './grid.js';
import { isLate } from './blocks.js';

/* ================= day headers / today marks ================= */
export function dayStats(w, d) {
  const list = w.blocks.filter(b => b.d === d); let planned = 0, done = 0, nDone = 0; const byCat = {};
  for (const b of list) { const m = b.e - b.s; planned += m; if (b.done) { done += m; nDone++; byCat[b.c] = (byCat[b.c] || 0) + m; } }
  return { list, planned, done, nDone, byCat };
}
export function renderDayHeads() {
  const w = W(); const t = today(); const st = ST(); const win = (st.endH - st.startH) * 60;
  dhEls.forEach((h, d) => {
    const date = dateOf(V.wk, d); const ds = dayStats(w, d);
    const isToday = V.wk === t.wk && d === t.d;
    h.classList.toggle('today', isToday);
    h.classList.toggle('sel', d === V.sel);
    $('.dh-date', h).textContent = date.getDate();
    const top = $('.dh-top', h);
    let tg = $('.dh-today', top);
    if (isToday && !tg) { tg = el('span', 'dh-today', '今天'); top.insertBefore(tg, $('.dh-badge', top)); }
    if (!isToday && tg) tg.remove();
    const bar = $('.dh-bar', h);
    const segs = CAT_IDS.filter(c => ds.byCat[c]).map(c => `<i style="--c:var(--c-${c});width:${ds.planned ? ds.byCat[c] / ds.planned * 100 : 0}%"></i>`).join('');
    if (bar.dataset.k !== segs) { bar.innerHTML = segs; bar.dataset.k = segs; }
    const free = Math.max(0, Math.round((1 - ds.planned / win) * 100));
    $('.dn', h).textContent = ds.list.length ? `${ds.nDone}/${ds.list.length}` : '';
    const fr = $('.fr', h); fr.textContent = ds.list.length && free < 20 ? '偏满' : '';
    fr.title = '留白 = 显示时段里没有安排的比例。留够 20% 以上，给意外和低估的时间（计划谬误）。';
    h.classList.toggle('full', ds.list.length > 0 && free < 20);
    const clear = ds.list.length >= 2 && ds.nDone === ds.list.length;
    const shut = !!S.core.shut[kOf(date)];
    const badge = $('.dh-badge', h); const bk = `${clear}|${shut}`;
    if (badge.dataset.k !== bk) { badge.innerHTML = (clear ? `<span title="全部涂满">${I.spark}</span>` : '') + (shut ? `<span title="已收工">${I.moon}</span>` : ''); badge.dataset.k = bk; if (clear && !REDUCED.matches && badge.firstElementChild) badge.firstElementChild.animate([{ transform: 'scale(0) rotate(-120deg)' }, { transform: 'none' }], { duration: 700, easing: SPRING }); }
    h.setAttribute('aria-label', `${WD[d]} ${md(date)}，${ds.nDone}/${ds.list.length} 完成`);
  });
  colEls.forEach((c, d) => c.classList.toggle('sel', d === V.sel));
}
export function renderTodayMarks() {
  const t = today(); const st = ST(); const hh = HH(); const startM = st.startH * 60, endM = st.endH * 60;
  const cur = V.wk === t.wk, past = V.wk < t.wk;
  colEls.forEach((c, d) => c.classList.toggle('past', past || (cur && d < t.d)));
  if (cur) {
    const y = (clamp(t.m, startM, endM) - startM) / 60 * hh;
    const c = colEls[t.d];
    if (elapsedEl.parentNode !== c) c.prepend(elapsedEl);
    if (nowLine.parentNode !== c) c.appendChild(nowLine);
    elapsedEl.style.height = y + 'px'; nowLine.style.top = y + 'px'; nowTag.style.top = y + 'px';
    nowTag.textContent = fmtT(t.m);
    const inRange = t.m >= startM && t.m <= endM;
    elapsedEl.hidden = false; nowLine.hidden = !inRange; nowTag.hidden = !inRange || (MOBILE.matches && V.sel !== t.d);
  } else { elapsedEl.hidden = true; nowLine.hidden = true; nowTag.hidden = true; }
  const ny = parseFloat(nowTag.style.top) || 0;
  $$('.hl', gutter).forEach((l, i) => l.classList.toggle('near', !nowTag.hidden && Math.abs(i * hh + 13 - ny) < 16));
  const w = W();
  blockEls.forEach((e, id) => { const b = w.blocks.find(x => x.id === id); if (b) e.classList.toggle('late', isLate(b)); });
}
