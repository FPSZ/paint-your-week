import { $, REDUCED, SPRING, clamp, esc, fmtDur, fmtH, fmtT, uid } from '../core/utils.js';
import { CATS, WD, cv, md, today } from '../core/domain.js';
import { MV, S, ST, V, W, commit, snap, undo } from '../core/state.js';
import { renderInbox } from '../inbox/list.js';
import { refresh } from '../week/refresh.js';
import { toggleDone } from '../week/actions.js';
import { scrollToMinute } from '../week/nav.js';
import { openShutdown } from '../pages/rituals.js';
import { openFocus } from '../ui/focus.js';
import { openSettle, settleData, settledCard } from './settle.js';
import { toast } from '../ui/toast.js';

/* ================= now card ================= */
export const nowBox = $('#now');
export function renderNow() {
  const t = today(); const w = S.weeks[t.wk];
  const list = (w ? w.blocks : []).filter(b => b.d === t.d).sort((a, b) => a.s - b.s);
  const cur = list.find(b => b.s <= t.m && b.e > t.m);
  const next = list.find(b => b.s > t.m);
  let html;
  const allDone = list.length > 0 && list.every(b => b.done);
  if (allDone) html = settledCard(settleData(), !!S.core.shut[t.key]);
  else if (cur) {
    const left = cur.e - t.m, frac = (t.m - cur.s) / (cur.e - cur.s);
    html = `<div class="now-card live" style="${cv(cur.c)}">
      <div class="now-k"><span class="pulse"></span>进行中 · ${CATS[cur.c].full}</div>
      <h3>${esc(cur.t || CATS[cur.c].full)}</h3>
      <div class="now-time">${fmtT(cur.s)}–${fmtT(cur.e)} · 还剩 ${fmtDur(left)}</div>
      ${cur.q ? `<p class="now-cue">${esc(cur.q)}</p>` : ''}
      <div class="now-bar"><i style="width:${(frac * 100).toFixed(1)}%"></i></div>
      <div class="now-act"><button class="btn on" data-act="focus" data-id="${cur.id}">专注模式</button><button class="btn on-ghost" data-act="done" data-id="${cur.id}">${cur.done ? '已涂色 · 撤回' : '涂色'}</button></div>
    </div>`;
  } else if (next) {
    const left = next.s - t.m, from = list.filter(b => b.e <= t.m).reduce((a, b) => Math.max(a, b.e), ST().startH * 60);
    const frac = clamp(left / Math.max(left, next.s - from), 0, 1), RC2 = 2 * Math.PI * 27;
    const fit = S.core.inbox.filter(x => x.est <= left - 5).sort((a, b) => b.est - a.est)[0];
    html = `<div class="now-card gap" style="${cv(next.c)}">
      <div class="gap-row">
        <div class="gap-ring" aria-label="还有 ${fmtDur(left)}"><svg viewBox="0 0 64 64" aria-hidden="true"><circle class="t" cx="32" cy="32" r="27"/><circle class="p" cx="32" cy="32" r="27" style="stroke-dasharray:${RC2.toFixed(2)};stroke-dashoffset:${(RC2 * (1 - frac)).toFixed(2)}"/></svg><span><b>${left < 60 ? left : fmtH(left)}</b><small>${left < 60 ? 'min' : 'h'}</small></span></div>
        <div class="gap-txt">
          <div class="now-k">空档 · 下一项</div>
          <h3>${esc(next.t || CATS[next.c].full)}</h3>
          <div class="now-time">${fmtT(next.s)}–${fmtT(next.e)} · ${fmtDur(next.e - next.s)}</div>
        </div>
      </div>
      <div class="now-act"><button class="btn paint" data-act="focus" data-id="${next.id}">提前开始</button>${fit ? `<button class="btn gap-fill" data-act="fill" data-tid="${fit.id}" title="排进现在这段空档"><svg class="ic" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg><span>先做 ${esc(fit.t)}</span><small>${fmtDur(fit.est)}</small></button>` : ''}</div>
    </div>`;
  } else if (list.length) {
    const nd = list.filter(b => b.done).length; const shut = S.core.shut[t.key];
    html = `<div class="now-card idle">
      <div class="now-k" style="color:var(--muted)">${shut ? '已收工' : '今天的安排都过去了'}</div>
      <h3>今天涂色 ${nd}/${list.length}</h3>
            ${shut ? '' : '<div class="now-act"><button class="btn solid" data-act="shut">开始收工</button></div>'}
    </div>`;
  } else {
    html = `<div class="now-card idle">
      <div class="now-k" style="color:var(--muted)">${WD[t.d]} · ${md(t.now)}</div>
      <h3>今天还是一张白纸</h3>
      <p class="now-empty">在网格上拖出一个时间块。</p>
    </div>`;
  }
  const nowKey = allDone ? 's' + !!S.core.shut[t.key] : cur ? 'c' + cur.id + cur.done : next ? 'n' + next.id : list.length ? 'e' + !!S.core.shut[t.key] : 'b';
  const changed = renderNow.k !== undefined && renderNow.k !== nowKey; renderNow.k = nowKey;
  nowBox.innerHTML = html;
  if (changed && !REDUCED.matches) nowBox.firstElementChild.animate([{ opacity: 0, transform: 'translateY(10px) scale(.98)' }, { opacity: 1, transform: 'none' }], { duration: 520, easing: SPRING });
}
export function fillGap(tid) {
  const t = today(), task = S.core.inbox.find(x => x.id === tid); if (!task) return;
  const w = W(t.wk), s = Math.ceil(t.m / 5) * 5;
  const next = w.blocks.filter(b => b.d === t.d && b.s > t.m).sort((a, b) => a.s - b.s)[0];
  const e = Math.min(s + task.est, next ? next.s : ST().endH * 60);
  if (e - s < 10) { toast('空档不够了'); return; }
  snap(t.wk); S.core.inbox = S.core.inbox.filter(x => x.id !== tid);
  w.blocks.push({ id: uid(), d: t.d, s, e, t: task.t, c: task.c, q: '', g: null, done: false });
  commit('core', t.wk); renderInbox();
  if (V.wk === t.wk && !MV) { refresh(); scrollToMinute(s, true); } else renderNow();
  toast(`已排进空档 ${fmtT(s)}–${fmtT(e)}`, { action: { label: '撤销', fn: undo } });
}

export function setup() {
  nowBox.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const act = b.dataset.act;
    if (act === 'focus') openFocus(b.dataset.id);
    if (act === 'done') toggleDone(b.dataset.id, b);
    if (act === 'shut') openShutdown();
    if (act === 'replay') openSettle();
    if (act === 'fill') fillGap(b.dataset.tid);
  });
}
