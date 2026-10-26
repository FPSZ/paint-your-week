import { $, $$, EASE_OUT, REDUCED, SPRING, esc, fmtDur, fmtH, pad } from '../core/utils.js';
import { CATS, CAT_IDS, GOAL_C, WD, md } from '../core/domain.js';
import { MV, S, V, commit } from '../core/state.js';
import { energyAt } from '../week/grid.js';
import { E, closeEditor } from '../week/editor.js';
import { goWeek } from '../week/nav.js';
import { M, closeModal } from '../ui/modal.js';
import { RIC, RV, closeReview, revealSec, rvObs, setRV, setRvObs } from './review.js';
import { STAR_FILL, curYM, monthData, monthTotals, parseYM, setView, shiftYM } from '../month/month.js';

/* ----- monthly report ----- */
export function openMonthReport(ym) {
  if (E) closeEditor(true);
  if (M) closeModal();
  if (ym > curYM()) ym = curYM();
  const rv = $('#rv'); rv.hidden = false; rv.scrollTop = 0; rv.setAttribute('aria-label', '月报');
  $('.rv-top h2').textContent = '月报'; $('#rvPrev').setAttribute('aria-label', '上个月'); $('#rvNext').setAttribute('aria-label', '下个月');
  setRV({ mode: 'month', ym });
  if (!REDUCED.matches) rv.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, easing: EASE_OUT });
  renderMonthReport(ym, 0);
  setTimeout(() => { try { $('#rvClose').focus({ preventScroll: true }); } catch (e) {} }, 50);
}
export function renderMonthReport(ym, dir) {
  const R = monthData(ym), s = R.s, f = parseYM(ym), mo = f.getMonth() + 1;
  const prevYM = shiftYM(ym, -1), prev = monthTotals(prevYM), pm = parseYM(prevYM).getMonth() + 1;
  const dd = x => `${x.date.getMonth() + 1}.${x.date.getDate()}`;
  $('#rvWk').textContent = `${f.getFullYear()} 年 ${mo} 月`;
  $('#rvNext').disabled = shiftYM(ym, 1) > curYM();
  const sec = (k, title, fact, body) => `<section class="rs" data-k="${k}"><header class="rs-h rise" style="--i:0"><h3>${title}</h3>${fact ? `<p>${fact}</p>` : ''}</header>${body}</section>`;
  const out = [];

  /* hero: every day of the month as a tile, painted by how much got done */
  const lead = (f.getDay() + 6) % 7, maxD = Math.max(1, ...R.days.map(x => x.done));
  let order = 0; const dl = {}; R.days.forEach((x, i) => { if (x.done) dl[i] = 520 + order++ * Math.min(60, 1400 / Math.max(1, R.active)); });
  const tiles = Array(lead).fill('<div class="mh-d pad"></div>').join('') + R.days.map((x, i) => {
    const a = x.done ? .3 + .7 * x.done / maxD : 0;
    return `<div class="mh-d${a > .55 ? ' lit' : ''}${x.today ? ' today' : ''}" style="--c:var(--c-${x.dom});--a:${a.toFixed(2)};--dl:${Math.round(dl[i] || 0)}" title="${md(x.date)}${x.done ? ` · ${fmtH(x.done)} 小时` : ''}"><i></i><span>${x.date.getDate()}</span>${x.full ? `<b>${STAR_FILL}</b>` : ''}</div>`;
  }).join('');
  let head;
  if (!s.n) head = '这个月还没有记录';
  else if (s.pct === 100) head = '整月涂满';
  else if (prev && s.done > prev.done) head = `比 ${pm} 月多涂了 ${fmtH(s.done - prev.done)} 小时`;
  else if (R.full.length) head = `${R.full.length} 天全部涂满`;
  else head = `完成 ${s.nDone} 块`;
  out.push(`<section class="rs rs-mhero" data-k="hero">
    <div class="rise" style="--i:1"><div class="mheat">${tiles}</div><div class="mh-wd">${WD.map(x => `<span>${x.slice(1)}</span>`).join('')}</div></div>
    <div>
      <p class="rs-head rise" style="--i:2">${head}</p>
      <div class="rs-big rise" style="--i:3"><span data-to="${s.pct}">0</span><sup>%</sup></div>
      <p class="rs-cap rise" style="--i:4">${mo} 月涂色率</p>
      <dl class="rs-line rise" style="--i:5">
        <div><dt>时长</dt><dd><span data-to="${s.done}" data-fmt="h">0</span><small>/${fmtH(s.planned)} h</small></dd></div>
        <div><dt>完成</dt><dd><span data-to="${s.nDone}">0</span><small>/${s.n} 块</small></dd></div>
        <div><dt>活跃</dt><dd><span data-to="${R.active}">0</span><small> 天</small></dd></div>
      </dl>
    </div>
  </section>`);

  if (s.n) {
    /* highlights: only things worth being proud of */
    const md2 = [];
    if (R.best >= 0) { const x = R.days[R.best]; md2.push({ c: 'admin', ic: RIC.star, v: dd(x), l: '最满的一天', sub: `${WD[x.d]} · ${fmtH(x.done)} 小时 · ${x.nDone} 块` }); }
    if (R.streak >= 2) { const a = R.days[R.sEnd - R.streak + 1], z = R.days[R.sEnd]; md2.push({ c: 'fun', ic: RIC.flame, v: `${R.streak} 天`, l: '最长连续涂色', sub: `${dd(a)} – ${dd(z)}` }); }
    if (R.full.length) md2.push({ c: 'move', ic: RIC.spark, v: `${R.full.length} 天`, l: '全部涂满', sub: R.full.slice(0, 5).map(dd).join('、') + (R.full.length > 5 ? ' …' : '') });
    if (R.longest) md2.push({ c: R.longest.b.c, ic: RIC.target, v: fmtDur(R.longest.b.e - R.longest.b.s), l: '最长的一块', sub: `${dd(R.longest.x)} · ${esc(R.longest.b.t || CATS[R.longest.b.c].full)}` });
    if (prev && s.done > prev.done && prev.done) md2.push({ c: 'move', ic: RIC.up, v: `+${Math.round((s.done - prev.done) / prev.done * 100)}%`, l: `比 ${pm} 月`, sub: `${pm} 月 ${fmtH(prev.done)} 小时` });
    if (R.jw && R.jwDone) md2.push({ c: 'learn', ic: RIC.book, v: `${R.jwDone}/${R.jw}`, l: '上课', sub: `${Math.round(R.jwDone / R.jw * 100)}% 的课已涂色` });
    const gDone = R.goals.filter(g => g.done).length;
    if (gDone) md2.push({ c: 'deep', ic: RIC.target, v: `${gDone} 件`, l: '大事达成', sub: `共 ${R.goals.length} 件` });
    if (R.shut) md2.push({ c: 'learn', ic: RIC.moon, v: `${R.shut} 天`, l: '按时收工', sub: '' });
    if (md2.length) out.push(sec('hl', '亮点', '', `<div class="medals">${md2.slice(0, 6).map((m, i) => `<div class="medal rise" style="--i:${i + 1};--c:var(--c-${m.c})"><div class="mi">${m.ic}</div><div class="mv">${m.v}</div><div class="ml">${m.l}</div>${m.sub ? `<div class="ms">${m.sub}</div>` : ''}</div>`).join('')}</div>`));

    /* where the time went */
    const cats = CAT_IDS.filter(c => s.byCatP[c]).sort((a, b) => s.byCatP[b] - s.byCatP[a]);
    const maxP = Math.max(1, ...cats.map(c => s.byCatP[c]));
    const top = CAT_IDS.filter(c => s.byCat[c]).sort((a, b) => s.byCat[b] - s.byCat[a])[0];
    out.push(sec('cat', '时间去哪了', top && s.done ? `<b>${CATS[top].n}</b>占完成时间的 ${Math.round(s.byCat[top] / s.done * 100)}%` : '',
      `<div class="stack rise" style="--i:1">${CAT_IDS.filter(c => s.byCat[c]).map((c, i) => `<i style="--c:var(--c-${c});--w:${(s.byCat[c] / Math.max(1, s.done) * 100).toFixed(2)}%;--i:${i}" title="${CATS[c].full}"></i>`).join('')}</div>
      <div class="cats">${cats.map((c, i) => { const d = s.byCat[c] || 0, p = s.byCatP[c]; return `<span class="cn rise" style="--i:${i + 2};--c:var(--c-${c})"><i></i>${CATS[c].n}</span><span class="ct rise" style="--i:${i + 2};--c:var(--c-${c});--pw:${(p / maxP * 100).toFixed(2)}%;--dw:${(d / maxP * 100).toFixed(2)}%"><b></b><i></i></span><span class="ch rise" style="--i:${i + 2}">${fmtH(d)} / ${fmtH(p)} h</span><span class="cp rise" style="--i:${i + 2}">${Math.round(d / p * 100)}%</span>`; }).join('')}</div>`));

    /* week by week (only the days inside this month) */
    const maxW = Math.max(1, ...R.weeks.map(x => x.planned));
    let bw = -1; R.weeks.forEach((x, i) => { if (x.done && (bw < 0 || x.done > R.weeks[bw].done)) bw = i; });
    out.push(sec('wk', '每一周', bw >= 0 ? `第 ${R.weeks[bw].no} 周最满` : '',
      `<div class="mwk" style="--n:${R.weeks.length}">${R.weeks.map((x, i) => { const a = x.ds[0].date, z = x.ds[x.ds.length - 1].date; return `<div class="dc rise${i === bw ? ' best' : ''}${x.ds.length < 7 ? ' part' : ''}" style="--i:${i + 1}" data-wk="${x.wk}" role="button" tabindex="0" title="打开第 ${x.no} 周">
        <span class="dc-v">${i === bw ? RIC.star : ''}${x.done ? fmtH(x.done) + 'h' : ''}</span>
        <div class="dc-bar" style="--i:${i}"><div class="dc-plan" style="--ph:${(x.planned / maxW * 100).toFixed(2)}%"></div><div class="dc-done" style="--dh:${(x.done / maxW * 100).toFixed(2)}%">${CAT_IDS.filter(c => x.byCat[c]).map(c => `<i style="--c:var(--c-${c});flex:${x.byCat[c]}"></i>`).join('')}</div></div>
        <span class="dc-l">第 ${x.no} 周<small>${a.getMonth() + 1}.${a.getDate()}–${z.getDate()}</small></span></div>`; }).join('')}</div>`));

    /* rhythm: average weekday + hours of the day */
    const maxWd = Math.max(1, ...R.wd.map(x => x.planned));
    const hmax = Math.max(1, ...R.heat);
    const peakTxt = R.peak >= 0 ? `完成最集中：<b>${pad(R.H0 + R.peak)}–${pad(R.H0 + R.peak + 2)} 点</b>` : '';
    out.push(sec('rh', '节奏', R.bestWd >= 0 ? `<b>${WD[R.bestWd]}</b>平均完成最多` : '',
      `<div class="dchart">${R.wd.map((x, d) => `<div class="dc rise${d === R.bestWd ? ' best' : ''}" style="--i:${d + 1}">
        <span class="dc-v">${d === R.bestWd ? RIC.star : ''}${x.done ? fmtH(x.done) + 'h' : ''}</span>
        <div class="dc-bar" style="--i:${d}"><div class="dc-plan" style="--ph:${(x.planned / maxWd * 100).toFixed(2)}%"></div><div class="dc-done" style="--dh:${(x.done / maxWd * 100).toFixed(2)}%">${CAT_IDS.filter(c => x.byCat[c]).map(c => `<i style="--c:var(--c-${c});flex:${x.byCat[c]}"></i>`).join('')}</div></div>
        <span class="dc-l">${WD[d].slice(1)}</span></div>`).join('')}</div>
      <div class="hours-h rise" style="--i:9">一天里的完成分布<span>${peakTxt}</span></div>
      <div class="hours rise" style="--i:10;--n:${R.heat.length}">${R.heat.map((v, i) => { const e = energyAt((R.H0 + i) * 60); return `<div class="hc" title="${pad(R.H0 + i)}:00 · ${v ? fmtDur(Math.round(v)) : '0min'}"><i style="--i:${i};background:${v ? `color-mix(in oklab,var(--accent) ${Math.round(18 + v / hmax * 82)}%,transparent)` : 'color-mix(in oklab,var(--ink) 4%,transparent)'}"></i><u style="opacity:${e >= .85 ? 1 : e >= .6 ? .35 : .08}"></u></div>`; }).join('')}</div>
      <div class="hours-ax" style="--n:${R.heat.length}">${R.heat.map((_, i) => `<span>${(R.H0 + i) % 3 === 0 ? pad(R.H0 + i) : ''}</span>`).join('')}</div>
      <div class="hours-key"><span><i class="c"></i>完成的时间</span><span><i></i>你的高能时段</span></div>`));

    /* what you did most */
    if (R.tops.length >= 2) {
      const maxN = Math.max(...R.tops.map(x => x.min));
      out.push(sec('tp', '做得最多的事', `共 ${R.nTitles} 件不同的事`,
        `<ol class="tops">${R.tops.map((x, i) => `<li><span class="tp-n rise" style="--i:${i + 1}">${i + 1}</span><span class="tp-t rise" style="--i:${i + 1};--c:var(--c-${x.c})"><i></i><span>${esc(x.t)}</span></span><span class="tp-bar rise" style="--i:${i + 1};--c:var(--c-${x.c})"><i style="--i:${i};--w:${(x.min / maxN * 100).toFixed(1)}%"></i></span><span class="tp-v rise" style="--i:${i + 1}"><b>${fmtH(x.min)}</b>h · ${x.n} 次</span></li>`).join('')}</ol>`));
    }

    /* the month's big goals */
    let gk = 0;
    if (R.goals.length) out.push(sec('gl', '大事', `达成 <b>${R.goals.filter(g => g.done).length}</b> / ${R.goals.length}`,
      R.weeks.filter(x => x.goals.length).map(x => `<div class="mgl"><h4 class="rise" style="--i:${Math.min(gk, 8) + 1}">第 ${x.no} 周</h4><ul class="gl">${x.goals.map(g => ({ ...g, wk: x.wk })).map(g => { const k = gk++; const w = S.weeks[g.wk]; let p = 0, d = 0; w.blocks.forEach(b => { if (b.g === g.id) { p += b.e - b.s; if (b.done) d += b.e - b.s; } }); return `<li class="rise${g.done ? ' done' : ''}" style="--i:${Math.min(k, 8) + 1};--g:${GOAL_C[g.gi]}"><span class="gs">${g.done ? RIC.check : ''}</span><span class="gt">${esc(g.t)}</span><span class="gh">${p ? `${fmtH(d)} / ${fmtH(p)} h` : '没排时间'}</span><span class="gb"><i style="--w:${p ? (d / p * 100).toFixed(1) : g.done ? 100 : 0}%"></i></span></li>`; }).join('')}</ul></div>`).join('')));
  }

  /* reflection, kept with the account */
  const note = (S.core.months && S.core.months[ym]) || {};
  out.push(sec('rf', `写给 ${f.getMonth() === 11 ? 1 : mo + 1} 月`, '', `<div class="refl2">
    <div class="rise" style="--i:1"><label for="mr1">这个月最骄傲的事</label><textarea id="mr1" data-r="proud" placeholder="写下来，下个月翻回来看">${esc(note.proud)}</textarea></div>
    <div class="rise" style="--i:2"><label for="mr2">下个月想改变的一件事</label><textarea id="mr2" data-r="next" placeholder="具体、做得到">${esc(note.next)}</textarea></div>
  </div>
  <div class="rv-end rise" style="--i:3"><button class="btn ghost big" id="rvDone">关闭</button>${MV ? '' : `<button class="btn solid big" id="rvMonth">看月历</button>`}</div>`));

  const body = $('#rvBody'); body.innerHTML = out.join('');
  $$('textarea', body).forEach(ta => ta.addEventListener('input', () => { S.core.months = S.core.months || {}; const n = S.core.months[ym] = S.core.months[ym] || {}; n[ta.dataset.r] = ta.value; commit('core'); }));
  $('#rvDone').addEventListener('click', closeReview);
  const mb = $('#rvMonth'); if (mb) mb.addEventListener('click', () => { closeReview(); setView('month', { ym }); });
  $$('.mwk .dc', body).forEach(c => {
    const go = () => { const wk = c.dataset.wk; closeReview(); if (MV) setView('week', { wk }); else goWeek(wk, wk > V.wk ? 1 : -1); };
    c.addEventListener('click', go); c.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  });
  if (rvObs) rvObs.disconnect();
  const secs = $$('.rs', body);
  if (REDUCED.matches || !('IntersectionObserver' in window)) secs.forEach(x => revealSec(x, R));
  else {
    setRvObs(new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { revealSec(en.target, R); rvObs.unobserve(en.target); } }), { root: $('#rv'), threshold: .16 }));
    secs.forEach(x => rvObs.observe(x));
  }
  if (dir && !REDUCED.matches) body.animate([{ opacity: 0, transform: `translateX(${dir * 24}px)` }, { opacity: 1, transform: 'none' }], { duration: 420, easing: SPRING });
}
