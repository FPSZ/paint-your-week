import { $, $$, EASE_OUT, I, MOBILE, REDUCED, SPRING, el, esc, fmtH, fmtT, pad, uid } from '../core/utils.js';
import { CATS, GOAL_C, WD, addD, cv, isoWeek, kOf, md, mondayOf, parseK, shiftWk, today } from '../core/domain.js';
import { S, ST, V, W, commit, locate, snap } from '../core/state.js';
import { avgEnergy } from '../week/grid.js';
import { dayStats } from '../week/dayheads.js';
import { weekStats } from '../side/stats.js';
import { renderGoals } from '../side/goals.js';
import { addTask, findSlot, parseEst, renderInbox } from '../inbox/list.js';
import { refresh } from '../week/refresh.js';
import { CUE, applyTemplate, copyPrevWeek } from '../week/templates.js';
import { toggleDone } from '../week/actions.js';
import { E, closeEditor } from '../week/editor.js';
import { M, closeModal } from '../ui/modal.js';
import { openReview, reviewData } from './review.js';
import { burst, chime } from '../fx/fx.js';
import { toast } from '../ui/toast.js';
import { openImport } from './import.js';

/* ----- rituals: one step per screen ----- */
export let RT = null;
export const rtEl = $('#rt');
export function openRitual(kind, title, steps, { wk = V.wk, start = 0, onFinish } = {}) {
  if (E) closeEditor(true);
  if (M) closeModal();
  RT = { kind, steps, i: start, wk, onFinish, live: null };
  rtEl.classList.toggle('night', kind === 'shut');
  $('#rtTitle').textContent = title;
  rtEl.hidden = false;
  if (!REDUCED.matches) rtEl.animate([{ opacity: 0, transform: 'scale(1.015)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: EASE_OUT });
  renderRitual(0);
}
export function closeRitual() {
  if (!RT) return; const kind = RT.kind; RT = null;
  if (kind === 'plan') { renderGoals(); refresh(); }
  if (REDUCED.matches) { rtEl.hidden = true; return; }
  const a = rtEl.animate([{ opacity: 1 }, { opacity: 0, transform: 'scale(.99)' }], { duration: 240, easing: EASE_OUT });
  a.onfinish = () => { if (!RT) rtEl.hidden = true; };
}
export function renderRitual(dir) {
  const st = RT.steps[RT.i]; const real = RT.steps.filter(x => !x.final); const n = real.length;
  $('#rtDots').innerHTML = st.final ? '' : real.map((x, k) => `<i class="${k === RT.i ? 'cur' : (x.isDone && x.isDone()) || k < RT.i ? 'done' : ''}"></i>`).join('');
  const body = $('#rtBody');
  body.innerHTML = `${st.final ? '' : `<p class="rt-k" data-r>${pad(RT.i + 1)} / ${pad(n)}</p><h3 class="rt-h" data-r>${st.title}</h3>${st.sub ? `<p class="rt-sub" data-r>${st.sub}</p>` : ''}`}<div class="rt-main" data-r></div>`;
  RT.live = null;
  st.render($('.rt-main', body));
  const foot = $('#rtFoot'); foot.hidden = !!st.final;
  $('#rtBack').style.visibility = RT.i ? '' : 'hidden';
  $('#rtNext').textContent = st.next || (RT.i === n - 1 ? '完成' : '下一步');
  $('.rt-scroll').scrollTop = 0;
  if (!REDUCED.matches) $$('[data-r]', body).forEach((x, k) => x.animate([{ opacity: 0, transform: `translate(${dir * 36}px, ${dir ? 0 : 12}px)` }, { opacity: 1, transform: 'none' }], { duration: 560, delay: k * 70, easing: SPRING, fill: 'backwards' }));
}
export function rtNext() {
  const st = RT.steps[RT.i];
  if (st.onNext && st.onNext() === false) return;
  if (RT.i < RT.steps.length - 1) { RT.i++; renderRitual(1); return; }
  const fin = RT.onFinish; closeRitual(); if (fin) fin();
}
export function mosaicHTML(w) {
  const st = ST(), a0 = st.startH * 60, a1 = st.endH * 60, span = a1 - a0;
  return `<div class="mosaic mini live">${[0, 1, 2, 3, 4, 5, 6].map(d => `<div class="mo-col">${w.blocks.filter(b => b.d === d && b.e > a0 && b.s < a1).map(b => { const a = Math.max(b.s, a0), z = Math.min(b.e, a1); return `<i class="mo-t${b.done ? ' done' : ''}" style="--c:var(--c-${b.c});top:${((a - a0) / span * 100).toFixed(2)}%;height:${((z - a) / span * 100).toFixed(2)}%;--o:0;--dl:0"></i>`; }).join('')}</div>`).join('')}</div><div class="mo-days">${WD.map(x => `<span>${x.slice(1)}</span>`).join('')}</div>`;
}
export const CHECK_SVG = '<svg class="ic" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

/* ----- weekly plan ----- */
export function openPlan() {
  const wk = V.wk; const w = W(wk); w.ritual = w.ritual || {};
  const tick = i => () => { W(wk).ritual = W(wk).ritual || {}; if (!W(wk).ritual['s' + i]) { W(wk).ritual['s' + i] = true; commit(wk); } };
  const isDone = i => () => !!(W(wk).ritual || {})['s' + i];
  const steps = [
    { title: '回看上周', isDone: isDone(0), onNext: tick(0), render(m) {
      const pk = shiftWk(wk, -1), pw = S.weeks[pk], cur = weekStats(W(wk));
      if (!pw || !pw.blocks.length) { m.innerHTML = '<p class="rt-empty">上周没有记录。</p>'; return; }
      const R = reviewData(pk);
      m.innerHTML = `<dl class="rt-stats"><div><dt>涂色率</dt><dd>${R.s.pct}<small>%</small></dd></div><div><dt>完成</dt><dd>${fmtH(R.s.done)}<small>/ ${fmtH(R.s.planned)} h</small></dd></div><div><dt>最佳一天</dt><dd>${R.best >= 0 ? WD[R.best] : '—'}</dd></div></dl>
        <p class="rt-note">这周建议排 <b>约 ${R.sugg} 小时</b>${cur.n ? `，现在已排 ${fmtH(cur.planned)} 小时` : ''}</p>
        <div class="rt-acts"><button class="btn soft" type="button" data-a="rv">看上周复盘</button></div>`;
      $('[data-a="rv"]', m).addEventListener('click', () => openReview(pk));
    } },
    { title: '写下三件大事', sub: '具体、有点难度。', isDone: isDone(1), onNext: () => { tick(1)(); renderGoals(); }, render(m) {
      const g0 = W(wk).goals;
      m.innerHTML = `<div class="rt-goals">${g0.map((g, i) => `<div class="rt-goal${g.t.trim() ? ' has' : ''}" data-gid="${g.id}" style="--g:${GOAL_C[i]}">
          <div class="rt-gm"><i></i><input class="rt-gi" value="${esc(g.t)}" placeholder="${['必须推进的一件事', '第二件重要的事', '第三件，可以是生活上的'][i]}" maxlength="50" aria-label="大事 ${i + 1}"></div>
          <div class="rt-woop"><div><input data-f="obs" value="${esc(g.obs)}" placeholder="最可能的障碍" maxlength="60" aria-label="障碍"><input data-f="plan" value="${esc(g.plan)}" placeholder="出现时，我就…" maxlength="60" aria-label="对策"></div></div>
        </div>`).join('')}</div>`;
      m.addEventListener('input', e => {
        const row = e.target.closest('.rt-goal'); if (!row) return; const g = W(wk).goals.find(x => x.id === row.dataset.gid); if (!g) return;
        if (e.target.classList.contains('rt-gi')) { g.t = e.target.value; row.classList.toggle('has', !!g.t.trim()); } else if (e.target.dataset.f) g[e.target.dataset.f] = e.target.value;
        commit(wk);
      });
      m.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); const ins = $$('input', m).filter(x => x.offsetParent); const k = ins.indexOf(e.target); if (ins[k + 1]) ins[k + 1].focus(); else rtNext(); } });
      setTimeout(() => { const f = $$('.rt-gi', m).find(x => !x.value); if (f && !MOBILE.matches) f.focus({ preventScroll: true }); }, 380);
    } },
    { title: '先放不可动的', sub: '课程、三餐、运动。', isDone: isDone(2), onNext: tick(2), render(m) {
      m.innerHTML = '<div class="rt-mini"></div><p class="rt-count"></p><div class="rt-acts"><button class="btn soft" type="button" data-a="jw">导入课表</button><button class="btn soft" type="button" data-a="copy">复制上周安排</button><button class="btn soft" type="button" data-a="tpl">套用高效模板</button></div>';
      const draw = () => {
        const w2 = W(wk), s = weekStats(w2), jw = w2.blocks.filter(b => b.src === 'jw').length, pw = S.weeks[shiftWk(wk, -1)];
        $('.rt-mini', m).innerHTML = mosaicHTML(w2);
        $('.rt-count', m).innerHTML = s.n ? `已有 <b>${s.n}</b> 块 · <b>${fmtH(s.planned)}</b> 小时${jw ? ` · 课程 <b>${jw}</b> 节` : ''}` : '这一周还是空的';
        $('[data-a="copy"]', m).disabled = !(pw && pw.blocks.length);
      };
      draw(); RT.live = draw;
      m.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (!b) return; if (b.dataset.a === 'jw') openImport(); if (b.dataset.a === 'copy') copyPrevWeek(); if (b.dataset.a === 'tpl') applyTemplate(); });
    } },
    { title: '大事放进高能时段', sub: '每件至少一块完整的专注时间。', isDone: isDone(3), onNext: tick(3), render(m) {
      RT.placed = RT.placed || {};
      const draw = () => {
        const w2 = W(wk); const gs = w2.goals.map((g, i) => ({ ...g, i })).filter(g => g.t.trim());
        if (!gs.length) { m.innerHTML = '<p class="rt-empty">还没写三件大事。</p><div class="rt-acts"><button class="btn soft" type="button" data-a="back">回去写</button></div>'; return; }
        m.innerHTML = `<ul class="rt-gs">${gs.map(g => { let p = 0; w2.blocks.forEach(b => { if (b.g === g.id) p += b.e - b.s; }); const pl = RT.placed[g.id]; return `<li data-gid="${g.id}" style="--g:${GOAL_C[g.i]}"><i></i><span class="t">${esc(g.t)}</span><span class="h">${p ? fmtH(p) + ' h' : '未排'}</span><button class="btn soft" type="button" data-a="place">排 90 分钟</button>${pl ? `<span class="placed">已排进 ${pl}</span>` : ''}</li>`; }).join('')}</ul>`;
        if (RT.just && !REDUCED.matches) { const tag = $(`li[data-gid="${RT.just}"] .placed`, m); if (tag) tag.animate([{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: SPRING }); }
        RT.just = null;
      };
      draw(); RT.live = draw;
      m.addEventListener('click', e => {
        const b = e.target.closest('[data-a]'); if (!b) return;
        if (b.dataset.a === 'back') { RT.i = 1; renderRitual(-1); return; }
        const li = b.closest('li'); const g = W(wk).goals.find(x => x.id === li.dataset.gid); if (!g) return;
        const slot = findSlot(90, 'deep', wk); if (!slot) { toast('这周已经没有放得下的空档了'); return; }
        snap(wk);
        const nb = { id: uid(), d: slot.d, s: slot.s, e: Math.min(slot.s + 90, 1440), t: g.t, c: 'deep', q: g.plan ? `如果${g.obs || '分心'}，就${g.plan}` : CUE.deep, g: g.id, done: false };
        W(wk).blocks.push(nb); commit(wk);
        RT.placed[g.id] = `${WD[nb.d]} ${fmtT(nb.s)}${avgEnergy(nb.s, nb.e) >= .8 ? ' · 高能时段' : ''}`; RT.just = g.id;
        const r = b.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2, 14, .7, [`var(--c-deep)`, GOAL_C[W(wk).goals.indexOf(g)], 'var(--gold)']);
        refresh();
      });
    } },
    { title: '每天留两成空白', sub: '低估用时是常态，给意外留位置。', next: '开始这一周', isDone: isDone(4), onNext: tick(4), render(m) {
      const draw = () => {
        const w2 = W(wk), win = (ST().endH - ST().startH) * 60;
        const rows = [0, 1, 2, 3, 4, 5, 6].map(d => { const p = dayStats(w2, d).planned; return { d, load: Math.min(100, Math.round(p / win * 100)), free: Math.max(0, Math.round((1 - p / win) * 100)), p }; });
        const full = rows.filter(r => r.p && r.free < 20);
        m.innerHTML = `<p class="rt-note" style="margin-top:0">${full.length ? `<b>${full.map(r => WD[r.d]).join('、')}</b>偏满，挪走一两块` : '每天都留了空'}</p>
          <div class="rt-load">${rows.map(r => `<div class="rl${r.p && r.free < 20 ? ' warn' : ''}" style="--i:${r.d}"><span>${WD[r.d].slice(1)}</span><div class="rl-t"><i style="--w:${r.load}%"></i><b style="left:80%"></b></div><em>${r.p ? `留白 ${r.free}%` : '空'}</em></div>`).join('')}</div>`;
      };
      draw(); RT.live = draw;
    } },
  ];
  let start = steps.findIndex(x => !x.isDone()); if (start < 0) start = 0;
  openRitual('plan', `第 ${isoWeek(parseK(wk))} 周计划`, steps, { wk, start, onFinish: () => {
    burst(innerWidth / 2, innerHeight * .4, 60, 1.3); chime('big'); toast('这周的地图画好了', { icon: I.spark });
  } });
}

/* ----- shutdown ----- */
export function openShutdown() {
  const t = today(); const wk = t.wk;
  const tmrDate = addD(t.now, 1), tmrWk = kOf(mondayOf(tmrDate)), tmrD = (tmrDate.getDay() + 6) % 7;
  const todayDone = () => (S.weeks[wk] ? S.weeks[wk].blocks : []).filter(b => b.d === t.d && b.done).reduce((a, b) => a + b.e - b.s, 0);
  const steps = [
    { title: '今天', sub: `${WD[t.d]} · ${md(t.now)}`, render(m) {
      const draw = () => {
        const list = (S.weeks[wk] ? S.weeks[wk].blocks : []).filter(b => b.d === t.d).sort((a, b) => a.s - b.s);
        const nd = list.filter(b => b.done).length, left = list.filter(b => !b.done);
        m.innerHTML = `<dl class="rt-stats"><div><dt>涂色</dt><dd>${nd}<small>/ ${list.length} 块</small></dd></div><div><dt>完成</dt><dd>${fmtH(todayDone())}<small> h</small></dd></div></dl>
          ${left.length ? `<h4 class="rt-sh">还没涂色的</h4><ul class="rt-list">${left.map(b => `<li data-id="${b.id}" style="${cv(b.c)}"><i></i><span class="t">${esc(b.t || CATS[b.c].full)}</span><span class="tm">${fmtT(b.s)}</span><span class="ra"><button type="button" data-a="done">完成</button><button type="button" data-a="tmr">明天</button><button type="button" data-a="inbox">待安排</button></span></li>`).join('')}</ul>` : list.length ? '<p class="rt-note">今天的块都处理好了。</p>' : ''}`;
      };
      draw(); RT.live = draw;
      m.addEventListener('click', e => {
        const b = e.target.closest('[data-a]'); if (!b) return; const li = b.closest('li'); const id = li.dataset.id; const loc = locate(id); if (!loc) return;
        const act = b.dataset.a;
        const run = () => {
          if (act === 'done') { toggleDone(id, b); return; }
          snap(loc.wk);
          if (act === 'tmr') {
            if (loc.b.d < 6) { loc.b.d += 1; commit(loc.wk); }
            else { loc.w.blocks = loc.w.blocks.filter(x => x.id !== id); const nk = shiftWk(loc.wk, 1); W(nk).blocks.push({ ...loc.b, d: 0 }); commit(loc.wk, nk); }
          } else { loc.w.blocks = loc.w.blocks.filter(x => x.id !== id); S.core.inbox.unshift({ id: uid(), t: loc.b.t || CATS[loc.b.c].full, c: loc.b.c, est: loc.b.e - loc.b.s }); commit(loc.wk, 'core'); renderInbox(); }
          refresh();
        };
        if (act === 'done' || REDUCED.matches) run();
        else { const a = li.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(24px)' }], { duration: 220, easing: EASE_OUT, fill: 'forwards' }); a.onfinish = run; }
      });
    } },
    { title: '清空大脑', sub: '还惦记着的事，先放进待安排。', render(m) {
      m.innerHTML = '<form autocomplete="off"><label class="sr" for="rtDump">还惦记着什么</label><input class="rt-big-in" id="rtDump" placeholder="还惦记着什么？回车" maxlength="60"></form><ul class="rt-added"></ul>';
      const f = $('form', m), inp = $('#rtDump', m), ul = $('.rt-added', m);
      f.addEventListener('submit', e => {
        e.preventDefault(); const p = parseEst(inp.value); const task = addTask(p.t, 'admin', p.est || 30); inp.value = '';
        if (!task) return;
        const li = el('li', '', `${CHECK_SVG}<span>${esc(task.t)}</span>`); ul.prepend(li);
        if (!REDUCED.matches) li.animate([{ opacity: 0, transform: 'translateY(-8px)' }, { opacity: 1, transform: 'none' }], { duration: 380, easing: SPRING });
      });
      setTimeout(() => { if (!MOBILE.matches) inp.focus({ preventScroll: true }); }, 380);
    } },
    { title: '明天', sub: `${WD[tmrD]} · ${md(tmrDate)}`, next: '收工', onNext: () => { if (!S.core.shut[t.key]) { snap(); S.core.shut[t.key] = 1; commit('core'); refresh(); } }, render(m) {
      const list = (S.weeks[tmrWk] ? S.weeks[tmrWk].blocks : []).filter(b => b.d === tmrD).sort((a, b) => a.s - b.s);
      m.innerHTML = list.length ? `<ol class="rt-tl">${list.map((b, i) => `<li class="${i ? '' : 'first'}" style="${cv(b.c)}"><span class="tm">${fmtT(b.s)}</span><i></i><span class="t">${esc(b.t || CATS[b.c].full)}</span></li>`).join('')}</ol>` : '<p class="rt-empty">明天还空着。</p>';
    } },
    { final: true, render(m) {
      const shut = !!S.core.shut[t.key];
      m.innerHTML = `<div class="rt-fin"><svg class="ic moon" viewBox="0 0 24 24"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/><path d="M19 2.5v4M21 4.5h-4"/></svg><h3>收工完毕</h3><p>今天完成 <b>${fmtH(todayDone())}</b> 小时</p><div class="rt-acts">${RT.reopen ? '<button class="btn ghost big" type="button" data-a="undo">撤销收工</button>' : ''}<button class="btn solid big" type="button" data-a="bye">晚安</button></div></div>`;
      if (!REDUCED.matches) {
        $('.moon', m).animate([{ transform: 'translateY(60px) rotate(-40deg)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 1200, easing: SPRING });
        $$('.rt-fin > :not(svg)', m).forEach((x, k) => x.animate([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 600, delay: 450 + k * 120, easing: SPRING, fill: 'backwards' }));
        if (shut && !RT.reopen) setTimeout(() => { const r = $('.moon', m).getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2, 30, .9, ['#FFE7A8', 'var(--c-learn)', 'var(--c-deep)']); chime('soft'); }, 700);
      }
      m.addEventListener('click', e => {
        const b = e.target.closest('[data-a]'); if (!b) return;
        if (b.dataset.a === 'undo') { snap(); delete S.core.shut[t.key]; commit('core'); refresh(); closeRitual(); toast('已撤销收工'); }
        else closeRitual();
      });
    } },
  ];
  const already = !!S.core.shut[t.key];
  openRitual('shut', '收工', steps, { wk, start: already ? 3 : 0 });
  if (already) { RT.reopen = true; renderRitual(0); }
}

export function setup() {
  $('#rtNext').addEventListener('click', () => RT && rtNext());
  $('#rtBack').addEventListener('click', () => { if (RT && RT.i > 0) { RT.i--; renderRitual(-1); } });
  $('#rtClose').addEventListener('click', closeRitual);
}
