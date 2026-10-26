import { $, $$, EASE_OUT, REDUCED, SPRING, clamp, esc, fmtDur, fmtH, fmtT } from '../core/utils.js';
import { CATS, CAT_IDS, SETTLE_TITLES, WD, addD, dateOf, kOf, md, mondayOf, today } from '../core/domain.js';
import { MV, S, ST, commit } from '../core/state.js';
import { nowBox, renderNow } from './now.js';
import { E, closeEditor } from '../week/editor.js';
import { M, closeModal } from '../ui/modal.js';
import { openShutdown } from '../pages/rituals.js';
import { RIC, countUp } from '../pages/review.js';
import { appEl } from '../month/month.js';
import { F, closeFocus } from '../ui/focus.js';
import { ac, burst, chime, fxRun, parts, resolveColor, setFxRun, stepFx, tone } from '../fx/fx.js';

/* ================= today settled: the payoff when every block of the day is painted ================= */
export const settleEl = $('#settle');
export let SETTLE = null, PILE = null;
export function dayDone(date) {
  const w = S.weeks[kOf(mondayOf(date))]; if (!w) return null;
  const d = (date.getDay() + 6) % 7, l = w.blocks.filter(b => b.d === d);
  return l.length ? { n: l.length, all: l.every(b => b.done), done: l.reduce((a, b) => a + (b.done ? b.e - b.s : 0), 0) } : null;
}
export function settleData() {
  const t = today(), w = S.weeks[t.wk];
  const list = (w ? w.blocks : []).filter(b => b.d === t.d).sort((a, b) => a.s - b.s);
  const byCat = {}; let done = 0; list.forEach(b => { const m = b.e - b.s; done += m; byCat[b.c] = (byCat[b.c] || 0) + m; });
  const cats = CAT_IDS.filter(c => byCat[c]).sort((a, b) => byCat[b] - byCat[a]);
  // consecutive fully painted days; days with nothing planned don't break the run
  let streak = 1; for (let i = 1; i <= 60; i++) { const x = dayDone(addD(t.now, -i)); if (!x) continue; if (!x.all) break; streak++; }
  let first = true;
  for (const wk in S.weeks) { if (!first) break; for (let d = 0; d < 7; d++) { const date = dateOf(wk, d); if (kOf(date) >= t.key) continue; const x = dayDone(date); if (x && x.all && x.n >= 2) { first = false; break; } } }
  const y = dayDone(addD(t.now, -1));
  const last = list.length ? list[list.length - 1].e : 0;
  return { t, list, done, byCat, cats, dom: cats[0] || 'deep', streak, first: first && list.length >= 2, more: y && done > y.done ? done - y.done : 0, ahead: last > t.m ? last - t.m : 0 };
}
export function settlePal(cats) {
  const p = [...cats]; for (const c of ['deep', 'learn', 'life', 'fun']) if (p.length < 3 && !p.includes(c)) p.push(c);
  return `--s1:var(--c-${p[0]});--s2:var(--c-${p[1]});--s3:var(--c-${p[2]})`;
}
export function settleAch(R) {
  const a = [];
  if (R.first) a.push({ c: 'admin', ic: RIC.spark, t: '第一次全部涂满' });
  if (R.streak >= 2) a.push({ c: 'fun', ic: RIC.flame, t: `连续 ${R.streak} 天全满` });
  if (R.ahead >= 15) a.push({ c: 'move', ic: RIC.up, t: `提前 ${fmtDur(R.ahead)} 收官` });
  if (R.more >= 30) a.push({ c: 'deep', ic: RIC.up, t: `比昨天多 ${fmtH(R.more)}h` });
  if ((R.byCat.deep || 0) >= 120) a.push({ c: 'deep', ic: RIC.target, t: `专注 ${fmtH(R.byCat.deep)}h` });
  if (R.list.length >= 6) a.push({ c: 'learn', ic: RIC.check, t: `${R.list.length} 件事全部搞定` });
  return a.slice(0, 3);
}
// every block of today is painted, not settled yet: ask before the big moment (more blocks may still come)
export function askCard(R) {
  return `<div class="now-card settled ask" style="${settlePal(R.cats)}">
      <div class="now-k">${RIC.spark}今天的都涂满了</div>
      <h3>今天的任务都完成了吗？</h3>
      <div class="sc-line">已涂色 <b>${fmtH(R.done)}</b> 小时 · <b>${R.list.length}</b> 块</div>
      <div class="sc-strip">${R.list.map(b => `<i style="--c:var(--c-${b.c});flex:${b.e - b.s}"></i>`).join('')}</div>
      <div class="now-act"><button class="btn on sc-go" data-act="settle">${RIC.star}结算</button><button class="btn on-ghost" data-act="more">还有事</button></div>
    </div>`;
}
export function settledCard(R, shut) {
  return `<div class="now-card settled" style="${settlePal(R.cats)}">
      <div class="now-k">${RIC.check}今日结算</div>
      <h3>全部涂满</h3>
      <span class="sc-tt">${RIC.star}${SETTLE_TITLES[R.dom]}</span>
      <dl class="sc-stats"><div><dt>涂色</dt><dd>${fmtH(R.done)}<small>h</small></dd></div><div><dt>完成</dt><dd>${R.list.length}<small>块</small></dd></div><div><dt>连续全满</dt><dd>${R.streak}<small>天</small></dd></div></dl>
      <div class="sc-strip">${R.list.map(b => `<i style="--c:var(--c-${b.c});flex:${b.e - b.s}"></i>`).join('')}</div>
      <div class="now-act">${shut ? '<span class="sc-shut">已收工</span>' : '<button class="btn on" data-act="shut">收工</button>'}<button class="btn on-ghost" data-act="replay">再看一次</button></div>
    </div>`;
}

/* sound: a short fanfare, then a ding per achievement */
export function fanfare() {
  if (!ST().sound) return; const a = ac(); if (!a) return;
  try { if (a.state === 'suspended') a.resume(); } catch (e) {}
  const t = a.currentTime + .02;
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(a, f, t + i * .085, .5, .055, 'triangle'));
  [1046.5, 1318.5, 1567.98].forEach(f => tone(a, f, t + .4, 1.2, .03));
  [2093, 2637, 3136, 2637, 3520].forEach((f, i) => tone(a, f, t + .72 + i * .055, .22, .012));
}
export function ding(i) {
  if (!ST().sound) return; const a = ac(); if (!a) return;
  const t = a.currentTime + .01, f = 1318.5 * Math.pow(1.122, i);
  tone(a, f, t, .32, .04); tone(a, f * 2, t + .05, .25, .014);
}

/* the sky: paint chips, stars and ribbons that drift down and pile up along the bottom */
export function rainDrop(pal, gold) {
  const k = Math.random(), sh = k < .48 ? 4 : k < .74 ? 5 : k < .9 ? 3 : 1;
  return { rain: true, x: Math.random() * innerWidth, y: -24 - Math.random() * 60, vx: (Math.random() - .5) * .7, vy: .8 + Math.random() * 2, g: .05 + Math.random() * .05, vt: 3 + Math.random() * 3.4,
    sw: .35 + Math.random() * .9, fq: .03 + Math.random() * .05, ph: Math.random() * 6.28, r: Math.random() * 6.28, vr: (Math.random() - .5) * .12,
    s: sh === 4 ? 10 + Math.random() * 8 : sh === 5 ? 12 + Math.random() * 9 : 6 + Math.random() * 5, c: sh === 5 ? gold : pal[Math.floor(Math.random() * pal.length)], sh, life: 0, max: Infinity };
}
export function startRain(ms) {
  PILE = { bw: 10, h: new Float32Array(Math.ceil(innerWidth / 10) + 2), cap: innerHeight * .16 };
  const pal = CAT_IDS.map(c => resolveColor(`var(--c-${c})`)), gold = resolveColor('var(--gold)');
  const t0 = performance.now();
  const spawn = () => {
    if (!SETTLE) return; const el = performance.now() - t0; if (el > ms) return;
    for (let i = 0, n = el < 700 ? 5 : 3; i < n; i++) parts.push(rainDrop(pal, gold));
    if (!fxRun) { setFxRun(true); requestAnimationFrame(stepFx); }
    SETTLE.rainT = setTimeout(spawn, 34);
  };
  spawn();
}
export function stepRain(p) {
  if (p.rest) return;
  p.vy = Math.min(p.vy + p.g, p.vt); p.x += p.vx + Math.sin(p.life * p.fq + p.ph) * p.sw; p.y += p.vy; p.r += p.vr;
  if (!PILE) return;
  const i = clamp(Math.round(p.x / PILE.bw), 1, PILE.h.length - 2), floor = innerHeight - PILE.h[i] - p.s * .4;
  if (p.y >= floor) {
    p.y = floor; p.rest = true;
    const add = p.s * .42; if (PILE.h[i] < PILE.cap) { PILE.h[i] += add; PILE.h[i - 1] += add * .55; PILE.h[i + 1] += add * .55; }
  }
}
export function fadeRain() { for (const p of parts) if (p.rain && !p.fade) { p.fade = true; p.max = p.life + 26; } PILE = null; }

/* the moment itself */
export function openSettle() {
  const R = settleData(); if (!R.list.length) return;
  if (!(S.core.settled && S.core.settled[R.t.key])) { S.core.settled = Object.assign({}, S.core.settled, { [R.t.key]: 1 }); commit('core'); renderNow(); }
  if (SETTLE) closeSettle(false, true);
  if (E) closeEditor(true);
  if (F) closeFocus();
  if (M) closeModal();
  SETTLE = { timers: [] };
  const later = (ms, fn) => SETTLE.timers.push(setTimeout(fn, ms));
  const ach = settleAch(R), shut = !!S.core.shut[R.t.key];
  const first = R.list[0].s, last = R.list[R.list.length - 1].e;
  settleEl.setAttribute('style', settlePal(R.cats));
  settleEl.innerHTML = `<div class="st-card" id="stCard">
    <div class="st-medal" aria-hidden="true"><div class="st-rays"></div><div class="st-coin"><svg viewBox="0 0 24 24"><path d="M6 12.5l4 4L18 8"/></svg></div></div>
    <p class="st-k">今日结算 · ${md(R.t.now)} ${WD[R.t.d]}</p>
    <h2 class="st-h" id="stTitle">全部涂满</h2>
    <div class="st-tt">${RIC.star}${SETTLE_TITLES[R.dom]}</div>
    <dl class="st-stats">
      <div><dt>涂色</dt><dd><span data-to="${R.done}" data-fmt="h">0</span><small>h</small></dd></div>
      <div><dt>完成</dt><dd><span data-to="${R.list.length}">0</span><small>块</small></dd></div>
      <div><dt>连续全满</dt><dd><span data-to="${R.streak}">0</span><small>天</small></dd></div>
    </dl>
    <div class="st-strip" aria-label="今日色卡">${R.list.map((b, i) => `<i style="--c:var(--c-${b.c});flex:${b.e - b.s};--i:${i}" title="${fmtT(b.s)} ${esc(b.t || CATS[b.c].full)}"></i>`).join('')}</div>
    <div class="st-ax"><span>${fmtT(first)}</span><span>${fmtT(last)}</span></div>
    <div class="st-ach">${ach.map(a => `<span class="st-a" style="--c:var(--c-${a.c})">${a.ic}${a.t}</span>`).join('')}</div>
    <div class="st-acts">${shut ? '' : '<button class="btn ghost big" id="stShut" type="button">去收工</button>'}<button class="btn solid big" id="stClaim" type="button">收下</button></div>
  </div>`;
  settleEl.getAnimations().forEach(a => a.cancel());
  settleEl.hidden = false;
  $('#stClaim').addEventListener('click', () => closeSettle(false));
  const sb = $('#stShut'); if (sb) sb.addEventListener('click', () => closeSettle(true));
  setTimeout(() => { try { $('#stClaim').focus({ preventScroll: true }); } catch (e) {} }, 60);
  fanfare();
  later(950, () => $$('[data-to]', settleEl).forEach(el => countUp(el, 1100)));
  $$('.st-a', settleEl).forEach((c, i) => later(1750 + i * 420, () => {
    c.classList.add('on'); ding(i);
    if (!REDUCED.matches) { const r = c.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2, 8, .55, [getComputedStyle(c).color, resolveColor('var(--gold)')]); }
  }));
  if (REDUCED.matches) { $$('.st-a', settleEl).forEach(c => c.classList.add('on')); return; }
  settleEl.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: EASE_OUT });
  const W0 = innerWidth, H0 = innerHeight, big = Math.min(2.6, 1.7 + H0 / 1400);
  const volley = (n, p) => { burst(-10, H0 + 10, n, p, null, { dir: -Math.PI / 3.1, spread: .5, life: 1.9 }); burst(W0 + 10, H0 + 10, n, p, null, { dir: -Math.PI + Math.PI / 3.1, spread: .5, life: 1.9 }); };
  later(60, () => { volley(60, big); appEl.animate([{ transform: 'none' }, { transform: 'translate(-5px,3px)' }, { transform: 'translate(4px,-3px)' }, { transform: 'translate(-2px,2px)' }, { transform: 'none' }], { duration: 340, easing: 'ease-out' }); });
  later(300, () => burst(W0 / 2, H0 * .42, 70, 1.8, null, { spread: Math.PI * 1.9, life: 1.4 }));
  later(1200, () => volley(30, big * .85));
  later(2300, () => volley(22, big * .75));
  later(150, () => startRain(3600));
}
export function closeSettle(goShut, instant) {
  if (!SETTLE) return;
  const s0 = SETTLE; SETTLE = null; s0.timers.forEach(clearTimeout); clearTimeout(s0.rainT);
  fadeRain();
  const card = $('#stCard'), claim = $('#stClaim');
  const done = () => {
    if (SETTLE) return;
    settleEl.getAnimations().forEach(a => a.cancel());
    settleEl.hidden = true; settleEl.innerHTML = '';
    const c = nowBox.firstElementChild; if (c && !REDUCED.matches && !instant) c.animate([{ transform: 'none' }, { transform: 'scale(1.06)' }, { transform: 'none' }], { duration: 650, easing: SPRING });
    if (goShut) openShutdown();
  };
  if (instant || REDUCED.matches || !card) { done(); return; }
  if (!goShut && claim) { const r = claim.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2, 34, 1.3); chime('done'); }
  const r = card.getBoundingClientRect(), tg = nowBox.getBoundingClientRect();
  const visible = !MV && tg.width > 0 && tg.bottom > 0 && tg.top < innerHeight;
  const to = visible ? `translate(${tg.left + tg.width / 2 - r.left - r.width / 2}px, ${tg.top + tg.height / 2 - r.top - r.height / 2}px) scale(${(tg.width / r.width).toFixed(3)})` : 'translateY(40px) scale(.9)';
  card.animate([{ transform: 'none', opacity: 1 }, { transform: to, opacity: visible ? .35 : 0 }], { duration: 600, easing: 'cubic-bezier(.5,0,.2,1)', fill: 'forwards' });
  const a = settleEl.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 520, delay: 140, easing: EASE_OUT, fill: 'forwards' });
  a.onfinish = done;
}

export function setup() {
  settleEl.addEventListener('click', e => { if (e.target === settleEl) closeSettle(false); });
}
