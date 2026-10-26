import { $, $$, EASE_OUT, REDUCED, SPRING, esc, fmtDur, fmtH, fmtT, pad } from '../core/utils.js';
import { CATS, CAT_IDS, GOAL_C, WD, addD, dateOf, isoWeek, kOf, parseK, shiftWk, today } from '../core/domain.js';
import { S, ST, V, W, commit, freshWeek } from '../core/state.js';
import { energyAt } from '../week/grid.js';
import { dayStats } from '../week/dayheads.js';
import { weekStats } from '../side/stats.js';
import { E, closeEditor } from '../week/editor.js';
import { goWeek } from '../week/nav.js';
import { M, closeModal } from '../ui/modal.js';
import { openPlan } from './rituals.js';
import { curYM, shiftYM } from '../month/month.js';
import { renderMonthReport } from './monthReport.js';
import { burst, chime } from '../fx/fx.js';

/* ----- weekly review: full screen, sections reveal as you read ----- */
export const RIC = {
  star: '<svg class="ic" viewBox="0 0 24 24"><path d="M12 3.2l2.6 5.5 6 .8-4.4 4.1 1.1 6L12 16.7l-5.3 2.9 1.1-6-4.4-4.1 6-.8z"/></svg>',
  target: '<svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>',
  flame: '<svg class="ic" viewBox="0 0 24 24"><path d="M12 21.5c-3.9 0-6.6-2.7-6.6-6.3 0-3.9 3.1-6 4.2-9.7 1.7 1.5 2.5 3.2 2.6 4.9.9-1 1.8-2.3 2.1-4 2.6 2.3 4.3 5.3 4.3 8.9 0 3.6-2.8 6.2-6.6 6.2z"/></svg>',
  spark: '<svg class="ic" viewBox="0 0 24 24"><path d="M12 3l1.8 5.4L19.5 10l-5.7 1.7L12 17.5l-1.8-5.8L4.5 10l5.7-1.6z"/><path d="M19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z"/></svg>',
  book: '<svg class="ic" viewBox="0 0 24 24"><path d="M4 19.5v-14A2.5 2.5 0 0 1 6.5 3H20v18H6.5A2.5 2.5 0 0 1 4 18.5 2.5 2.5 0 0 1 6.5 16H20"/></svg>',
  up: '<svg class="ic" viewBox="0 0 24 24"><path d="M3 17l6-6 4 4 8-8M15 7h6v6"/></svg>',
  down: '<svg class="ic" viewBox="0 0 24 24"><path d="M3 7l6 6 4-4 8 8M15 17h6v-6"/></svg>',
  moon: '<svg class="ic" viewBox="0 0 24 24"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/><path d="M19 2.5v4M21 4.5h-4"/></svg>',
  check: '<svg class="ic" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
};
export function reviewData(wk) {
  const w = S.weeks[wk] || freshWeek(); const s = weekStats(w); const st = ST(); const t = today();
  const days = [0, 1, 2, 3, 4, 5, 6].map(d => dayStats(w, d));
  const done = w.blocks.filter(b => b.done);
  let best = -1; days.forEach((x, d) => { if (x.done > 0 && (best < 0 || x.done > days[best].done || (x.done === days[best].done && x.nDone > days[best].nDone))) best = d; });
  const longest = done.slice().sort((a, b) => (b.e - b.s) - (a.e - a.s) || a.d - b.d || a.s - b.s)[0] || null;
  let run = 0, streak = 0, sEnd = -1; days.forEach((x, d) => { run = x.nDone ? run + 1 : 0; if (run > streak) { streak = run; sEnd = d; } });
  const full = days.map((x, d) => (x.list.length >= 2 && x.nDone === x.list.length ? d : -1)).filter(d => d >= 0);
  const jw = w.blocks.filter(b => b.src === 'jw'); const jwDone = jw.filter(b => b.done).length;
  const shutDays = [0, 1, 2, 3, 4, 5, 6].filter(d => S.core.shut[kOf(dateOf(wk, d))]);
  const prev = S.weeks[shiftWk(wk, -1)]; const ps = prev && prev.blocks.length ? weekStats(prev) : null;
  const H0 = st.startH, heat = Array(st.endH - st.startH).fill(0);
  let hiMin = 0, hardMin = 0;
  done.forEach(b => {
    for (let m = b.s; m < b.e; m += 15) {
      const len = Math.min(15, b.e - m), h = Math.floor(m / 60) - H0;
      if (h >= 0 && h < heat.length) heat[h] += len;
      if (b.c === 'deep' || b.c === 'learn') { hardMin += len; if (energyAt(m) >= .85) hiMin += len; }
    }
  });
  let peak = -1, pv = 0; for (let i = 0; i < heat.length - 1; i++) { const v = heat[i] + heat[i + 1]; if (v > pv) { pv = v; peak = i; } }
  const deepDone = done.filter(b => b.c === 'deep');
  const focus = { min: s.deepD, n: deepDone.length, avg: deepDone.length ? Math.round(s.deepD / deepDone.length) : 0, hi: hardMin ? Math.round(hiMin / hardMin * 100) : 0, hard: hardMin };
  const goals = w.goals.map((g, i) => ({ ...g, i })).filter(g => g.t.trim()).map(g => { let p = 0, d = 0; w.blocks.forEach(b => { if (b.g === g.id) { p += b.e - b.s; if (b.done) d += b.e - b.s; } }); return { ...g, p, d }; });
  const trend = []; for (let i = 7; i >= 0; i--) { const k = shiftWk(wk, -i); const ww = S.weeks[k]; trend.push({ k, s: ww && ww.blocks.length ? weekStats(ww) : null }); }
  const past = trend.filter(x => x.s && x.k < t.wk).slice(-3);
  const base = past.length ? past : trend.filter(x => x.s).slice(-1);
  const sugg = base.length ? Math.max(1, Math.round(base.reduce((a, x) => a + x.s.done, 0) / base.length / 60 * 1.1)) : 0;
  return { w, s, days, best, longest, streak, sEnd, full, jw: jw.length, jwDone, shutDays, ps, heat, peak, H0, focus, goals, trend, sugg };
}
export let RV = null, rvObs = null;
export function openReview(wk = V.wk) {
  if (E) closeEditor(true);
  if (M) closeModal();
  const rv = $('#rv'); rv.hidden = false; rv.scrollTop = 0;
  RV = { wk };
  rv.setAttribute('aria-label', '周复盘'); $('.rv-top h2').textContent = '复盘'; $('#rvPrev').setAttribute('aria-label', '上一周'); $('#rvNext').setAttribute('aria-label', '下一周');
  if (!REDUCED.matches) rv.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, easing: EASE_OUT });
  renderReview(wk, 0);
  setTimeout(() => { try { $('#rvClose').focus({ preventScroll: true }); } catch (e) {} }, 50);
}
export function closeReview() {
  if (!RV) return; RV = null; if (rvObs) rvObs.disconnect();
  const rv = $('#rv');
  if (REDUCED.matches) { rv.hidden = true; return; }
  const a = rv.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(12px)' }], { duration: 220, easing: EASE_OUT });
  a.onfinish = () => { if (!RV) rv.hidden = true; };
}
export function rvGo(dir) {
  if (!RV) return;
  if (RV.mode === 'month') { const ny = shiftYM(RV.ym, dir); if (ny > curYM()) return; RV.ym = ny; $('#rv').scrollTop = 0; renderMonthReport(ny, dir); return; }
  const nk = shiftWk(RV.wk, dir);
  if (nk > today().wk) return;
  RV.wk = nk; $('#rv').scrollTop = 0; renderReview(nk, dir);
}
export function countUp(el, dur) {
  const to = +el.dataset.to, fmt = el.dataset.fmt === 'h' ? v => fmtH(v) : v => String(Math.round(v));
  if (REDUCED.matches || !to) { el.textContent = fmt(to); return; }
  const t0 = performance.now();
  const step = () => { const k = Math.max(0, Math.min(1, (performance.now() - t0) / dur)); const e = 1 - Math.pow(1 - k, 4); el.textContent = fmt(to * e); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
export function revealSec(sec, R) {
  if (sec.classList.contains('in')) return;
  sec.classList.add('in');
  $$('[data-to]', sec).forEach(el => countUp(el, sec.dataset.k === 'hero' ? 1400 : 1000));
  if (sec.dataset.k === 'hero' && R.s.n && R.s.pct >= 80 && !REDUCED.matches) {
    setTimeout(() => { if (!RV) return; const r = $('.rs-big', sec).getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2, R.s.pct === 100 ? 70 : 36, R.s.pct === 100 ? 1.4 : 1); if (R.s.pct === 100) chime('big'); }, 1300);
  }
}
export function renderReview(wk, dir) {
  const R = reviewData(wk); const s = R.s; const st = ST(); const t = today();
  const startM = st.startH * 60, endM = st.endH * 60, span = endM - startM;
  const mon = parseK(wk), sun = addD(mon, 6);
  $('#rvWk').textContent = `第 ${isoWeek(mon)} 周 · ${mon.getMonth() + 1}.${pad(mon.getDate())} – ${sun.getMonth() + 1}.${pad(sun.getDate())}`;
  $('#rvNext').disabled = shiftWk(wk, 1) > t.wk;
  const sec = (k, title, fact, body) => `<section class="rs" data-k="${k}"><header class="rs-h rise" style="--i:0"><h3>${title}</h3>${fact ? `<p>${fact}</p>` : ''}</header>${body}</section>`;
  const out = [];

  /* hero */
  const order = R.w.blocks.filter(b => b.done).sort((a, b) => a.d - b.d || a.s - b.s);
  const step = order.length ? Math.min(45, 1500 / order.length) : 0;
  const dl = {}; order.forEach((b, i) => { dl[b.id] = Math.round(500 + i * step); });
  let ti = 0;
  const mosaic = R.days.map(x => `<div class="mo-col">${x.list.filter(b => b.e > startM && b.s < endM).map(b => {
    const a = Math.max(b.s, startM), z = Math.min(b.e, endM);
    return `<i class="mo-t${b.done ? ' done' : ''}" style="--c:var(--c-${b.c});top:${((a - startM) / span * 100).toFixed(2)}%;height:${((z - a) / span * 100).toFixed(2)}%;--o:${Math.min(ti++ * 12, 420)};--dl:${dl[b.id] || 0}"></i>`;
  }).join('')}</div>`).join('');
  let head;
  if (!s.n) head = '这一周还没有记录';
  else if (s.pct === 100) head = '整周涂满';
  else if (R.ps && s.pct > R.ps.pct) head = `比上周高 ${s.pct - R.ps.pct}%`;
  else if (R.full.length) head = `${R.full.length} 天全部涂满`;
  else head = `完成 ${s.nDone} 块`;
  out.push(`<section class="rs rs-hero" data-k="hero">
    <div class="rise" style="--i:1"><div class="mosaic">${mosaic}</div><div class="mo-days">${WD.map((x, d) => `<span class="${d === R.best ? 'best' : ''}">${x.slice(1)}</span>`).join('')}</div></div>
    <div>
      <p class="rs-head rise" style="--i:2">${head}</p>
      <div class="rs-big rise" style="--i:3"><span data-to="${s.pct}">0</span><sup>%</sup></div>
      <p class="rs-cap rise" style="--i:4">涂色率</p>
      <dl class="rs-line rise" style="--i:5">
        <div><dt>完成</dt><dd><span data-to="${s.nDone}">0</span><small>/${s.n} 块</small></dd></div>
        <div><dt>时长</dt><dd><span data-to="${s.done}" data-fmt="h">0</span><small>/${fmtH(s.planned)} h</small></dd></div>
        <div><dt>专注</dt><dd><span data-to="${s.deepD}" data-fmt="h">0</span><small> h</small></dd></div>
      </dl>
    </div>
  </section>`);

  if (s.n) {
    /* highlights */
    const md2 = [];
    if (R.best >= 0) md2.push({ c: 'admin', ic: RIC.star, v: WD[R.best], l: '最佳一天', sub: `${R.days[R.best].nDone} 块 · ${fmtH(R.days[R.best].done)} 小时` });
    if (R.longest) md2.push({ c: R.longest.c, ic: RIC.target, v: fmtDur(R.longest.e - R.longest.s), l: '最长的一块', sub: `${WD[R.longest.d]} ${fmtT(R.longest.s)} · ${esc(R.longest.t || CATS[R.longest.c].full)}` });
    if (R.streak >= 2) md2.push({ c: 'fun', ic: RIC.flame, v: `${R.streak} 天`, l: '连续涂色', sub: `${WD[R.sEnd - R.streak + 1]}到${WD[R.sEnd]}` });
    if (R.full.length) md2.push({ c: 'move', ic: RIC.spark, v: `${R.full.length} 天`, l: '全部涂满', sub: R.full.map(d => WD[d]).join('、') });
    if (R.jw && R.jwDone) md2.push({ c: 'learn', ic: RIC.book, v: `${R.jwDone}/${R.jw}`, l: '上课', sub: `${Math.round(R.jwDone / R.jw * 100)}% 的课已涂色` });
    if (R.ps && s.pct > R.ps.pct) md2.push({ c: 'move', ic: RIC.up, v: `+${s.pct - R.ps.pct}%`, l: '比上周', sub: `上周 ${R.ps.pct}%` });
    if (R.shutDays.length) md2.push({ c: 'learn', ic: RIC.moon, v: `${R.shutDays.length} 天`, l: '按时收工', sub: R.shutDays.map(d => WD[d]).join('、') });
    if (md2.length) out.push(sec('hl', '亮点', '', `<div class="medals">${md2.slice(0, 6).map((m, i) => `<div class="medal rise" style="--i:${i + 1};--c:var(--c-${m.c})"><div class="mi">${m.ic}</div><div class="mv">${m.v}</div><div class="ml">${m.l}</div><div class="ms">${m.sub}</div></div>`).join('')}</div>`));

    /* where the time went */
    const cats = CAT_IDS.filter(c => s.byCatP[c]).sort((a, b) => s.byCatP[b] - s.byCatP[a]);
    const maxP = Math.max(1, ...cats.map(c => s.byCatP[c]));
    const top = CAT_IDS.filter(c => s.byCat[c]).sort((a, b) => s.byCat[b] - s.byCat[a])[0];
    out.push(sec('cat', '时间去哪了', top && s.done ? `<b>${CATS[top].n}</b>占完成时间的 ${Math.round(s.byCat[top] / s.done * 100)}%` : '',
      `<div class="stack rise" style="--i:1">${CAT_IDS.filter(c => s.byCat[c]).map((c, i) => `<i style="--c:var(--c-${c});--w:${(s.byCat[c] / Math.max(1, s.done) * 100).toFixed(2)}%;--i:${i}" title="${CATS[c].full}"></i>`).join('')}</div>
      <div class="cats">${cats.map((c, i) => { const d = s.byCat[c] || 0, p = s.byCatP[c]; return `<span class="cn rise" style="--i:${i + 2};--c:var(--c-${c})"><i></i>${CATS[c].n}</span><span class="ct rise" style="--i:${i + 2};--c:var(--c-${c});--pw:${(p / maxP * 100).toFixed(2)}%;--dw:${(d / maxP * 100).toFixed(2)}%"><b></b><i></i></span><span class="ch rise" style="--i:${i + 2}">${fmtH(d)} / ${fmtH(p)} h</span><span class="cp rise" style="--i:${i + 2}">${Math.round(d / p * 100)}%</span>`; }).join('')}</div>`));

    /* rhythm */
    const maxD = Math.max(1, ...R.days.map(x => x.planned));
    const hmax = Math.max(1, ...R.heat);
    const peakTxt = R.peak >= 0 ? `完成最集中：<b>${pad(R.H0 + R.peak)}–${pad(R.H0 + R.peak + 2)} 点</b>` : '';
    out.push(sec('rh', '一周节奏', R.best >= 0 ? `<b>${WD[R.best]}</b>完成最多` : '',
      `<div class="dchart">${R.days.map((x, d) => `<div class="dc rise${d === R.best ? ' best' : ''}" style="--i:${d + 1}">
        <span class="dc-v">${d === R.best ? RIC.star : ''}${x.done ? fmtH(x.done) + 'h' : ''}</span>
        <div class="dc-bar" style="--i:${d}"><div class="dc-plan" style="--ph:${(x.planned / maxD * 100).toFixed(2)}%"></div><div class="dc-done" style="--dh:${(x.done / maxD * 100).toFixed(2)}%">${CAT_IDS.filter(c => x.byCat[c]).map(c => `<i style="--c:var(--c-${c});flex:${x.byCat[c]}"></i>`).join('')}</div></div>
        <span class="dc-l">${WD[d].slice(1)}</span></div>`).join('')}</div>
      <div class="hours-h rise" style="--i:9">一天里的完成分布<span>${peakTxt}</span></div>
      <div class="hours rise" style="--i:10;--n:${R.heat.length}">${R.heat.map((v, i) => { const e = energyAt((R.H0 + i) * 60); return `<div class="hc" title="${pad(R.H0 + i)}:00 · ${fmtDur(v) || '0min'}"><i style="--i:${i};background:${v ? `color-mix(in oklab,var(--accent) ${Math.round(18 + v / hmax * 82)}%,transparent)` : 'color-mix(in oklab,var(--ink) 4%,transparent)'}"></i><u style="opacity:${e >= .85 ? 1 : e >= .6 ? .35 : .08}"></u></div>`; }).join('')}</div>
      <div class="hours-ax" style="--n:${R.heat.length}">${R.heat.map((_, i) => `<span>${(R.H0 + i) % 3 === 0 ? pad(R.H0 + i) : ''}</span>`).join('')}</div>
      <div class="hours-key"><span><i class="c"></i>完成的时间</span><span><i></i>你的高能时段</span></div>`));

    /* focus */
    if (R.focus.min || R.focus.hard) out.push(sec('fc', '专注', '',
      `<dl class="nums">
        <div class="rise" style="--i:1"><dt>深度专注</dt><dd><span data-to="${R.focus.min}" data-fmt="h">0</span><small> h</small></dd></div>
        <div class="rise" style="--i:2"><dt>专注块</dt><dd><span data-to="${R.focus.n}">0</span><small> 块</small></dd></div>
        <div class="rise" style="--i:3"><dt>平均每块</dt><dd><span data-to="${R.focus.avg}">0</span><small> min</small></dd></div>
        <div class="rise" style="--i:4"><dt>落在高能时段</dt><dd><span data-to="${R.focus.hi}">0</span><small>%</small></dd></div>
      </dl>`));

    /* goals */
    if (R.goals.length) out.push(sec('gl', '三件大事', `完成 <b>${R.goals.filter(g => g.done).length}</b> / ${R.goals.length}`,
      `<ul class="gl">${R.goals.map((g, k) => `<li class="rise${g.done ? ' done' : ''}" style="--i:${k + 1};--g:${GOAL_C[g.i]}"><span class="gs">${g.done ? RIC.check : ''}</span><span class="gt">${esc(g.t)}</span><span class="gh">${g.p ? `${fmtH(g.d)} / ${fmtH(g.p)} h` : '没排时间'}</span><span class="gb"><i style="--w:${g.p ? (g.d / g.p * 100).toFixed(1) : g.done ? 100 : 0}%"></i></span></li>`).join('')}</ul>`));
  }

  /* trend */
  const tFirst = R.trend.findIndex(x => x.s); const tr = tFirst < 0 ? [] : R.trend.slice(tFirst);
  if (tr.filter(x => x.s).length >= 2) out.push(sec('tr', `最近 ${tr.length} 周`, R.sugg ? `下周建议排 <b>约 ${R.sugg} 小时</b>` : '',
    `<div class="trend" style="--n:${tr.length}">${tr.map((x, i) => { const m = parseK(x.k); return `<div class="tc rise${x.k === wk ? ' cur' : ''}" style="--i:${i + 1}"><span class="tc-v">${x.s ? x.s.pct + '%' : ''}</span><div class="tc-bar"><i class="${x.s ? '' : 'none'}" style="--i:${i};--h:${x.s ? Math.max(4, x.s.pct) : 0}%"></i></div><span class="tc-l">${m.getMonth() + 1}.${pad(m.getDate())}</span></div>`; }).join('')}</div>`));

  /* reflection */
  const rv = R.w.review || {};
  out.push(sec('rf', '写给下周', '', `<div class="refl2">
    <div class="rise" style="--i:1"><label for="rv1">最值得高兴的事</label><textarea id="rv1" data-r="good" placeholder="哪怕很小">${esc(rv.good)}</textarea></div>
    <div class="rise" style="--i:2"><label for="rv2">卡住我的</label><textarea id="rv2" data-r="stuck" placeholder="时间被什么吃掉了">${esc(rv.stuck)}</textarea></div>
    <div class="rise" style="--i:3"><label for="rv3">下周只改一处</label><textarea id="rv3" data-r="change" placeholder="具体、做得到">${esc(rv.change)}</textarea></div>
  </div>
  <div class="rv-end rise" style="--i:4"><button class="btn ghost big" id="rvDone">关闭</button><button class="btn solid big" id="rvPlan">规划下一周</button></div>`));

  const body = $('#rvBody'); body.innerHTML = out.join('');
  $$('textarea', body).forEach(ta => ta.addEventListener('input', () => { const ww = W(wk); ww.review = ww.review || {}; ww.review[ta.dataset.r] = ta.value; commit(wk); }));
  $('#rvDone').addEventListener('click', closeReview);
  $('#rvPlan').addEventListener('click', () => { closeReview(); const nk = shiftWk(wk, 1); setTimeout(() => { goWeek(nk, 1); setTimeout(openPlan, 380); }, 200); });
  if (rvObs) rvObs.disconnect();
  const secs = $$('.rs', body);
  if (REDUCED.matches || !('IntersectionObserver' in window)) secs.forEach(x => revealSec(x, R));
  else {
    rvObs = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { revealSec(en.target, R); rvObs.unobserve(en.target); } }), { root: $('#rv'), threshold: .16 });
    secs.forEach(x => rvObs.observe(x));
  }
  if (dir && !REDUCED.matches) body.animate([{ opacity: 0, transform: `translateX(${dir * 24}px)` }, { opacity: 1, transform: 'none' }], { duration: 420, easing: SPRING });
}
export function setRV(v) { RV = v; return v; }
export function setRvObs(v) { rvObs = v; return v; }

export function setup() {
  $('#rvClose').addEventListener('click', closeReview);
  $('#rvPrev').addEventListener('click', () => rvGo(-1));
  $('#rvNext').addEventListener('click', () => rvGo(1));
}
