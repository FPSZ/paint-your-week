import { $, I, fmtDur, uid } from '../core/utils.js';
import { CATS, WD, shiftWk, today } from '../core/domain.js';
import { S, V, W, commit, locate, snap, undo } from '../core/state.js';
import { blockEls, dhEls } from './dom.js';
import { dayStats } from './dayheads.js';
import { weekStats } from '../side/stats.js';
import { refresh } from './refresh.js';
import { openReview } from '../pages/review.js';
import { burst, celebrate, chime, plusLabel } from '../fx/fx.js';
import { openSettle } from '../side/settle.js';
import { nowBox } from '../side/now.js';
import { toast } from '../ui/toast.js';

/* ================= block actions ================= */
export function toggleDone(id, originEl) {
  const loc = locate(id); if (!loc) return;
  const before = weekStats(loc.w).pct;
  snap(loc.wk); loc.b.done = !loc.b.done; commit(loc.wk);
  refresh();
  if (!loc.b.done) return;
  let x = innerWidth / 2, y = innerHeight / 2;
  const e = loc.wk === V.wk ? blockEls.get(id) : null;
  const src = e && e.offsetParent ? $('.chk', e) : originEl;
  if (src) { const r = src.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top + r.height / 2; }
  const ds = dayStats(loc.w, loc.b.d);
  const dayClear = ds.list.length >= 2 && ds.nDone === ds.list.length;
  celebrate(x, y, `var(--c-${loc.b.c})`, dayClear ? 'big' : 'done');
  plusLabel(x, y - 16, `+${fmtDur(loc.b.e - loc.b.s)}`, loc.b.c);
  $('#ringWrap').classList.remove('bump'); void $('#ringWrap').offsetWidth; $('#ringWrap').classList.add('bump');
  if (loc.wk === V.wk) { const h = dhEls[loc.b.d]; h.classList.remove('pop-anim'); void h.offsetWidth; h.classList.add('pop-anim'); }
  try { navigator.vibrate && navigator.vibrate(10); } catch (er) {}
  const after = weekStats(loc.w).pct;
  const tt = today();
  // today is fully painted: the sidebar card turns into the settle question; the big moment waits for 结算
  if (dayClear && loc.wk === tt.wk && loc.b.d === tt.d && !(S.core.settled && S.core.settled[tt.key])) {
    setTimeout(() => {
      const c = nowBox.firstElementChild; if (c && c.offsetParent) { const r = c.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2, 34, 1.2); }
      toast('今天的都涂满了', { icon: I.spark, action: { label: '结算', fn: openSettle } });
    }, 420);
  }
  else if (dayClear) {
    setTimeout(() => { const h = dhEls[loc.b.d]; if (loc.wk === V.wk && h.offsetParent) { const r = h.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2, 40, 1.2); } toast(`${WD[loc.b.d]}全部涂满`, { icon: I.spark }); }, 380);
  } else if (before < 100 && after === 100) { setTimeout(() => { burst(innerWidth / 2, innerHeight * .4, 70, 1.5); chime('big'); toast('整周涂满', { icon: I.spark, action: { label: '复盘', fn: openReview } }); }, 400); }
  else if (before < 50 && after >= 50) toast('本周过半', { icon: I.spark });
}
export function removeBlock(id) {
  const w = W(); const b = w.blocks.find(x => x.id === id); if (!b) return;
  snap(); w.blocks = w.blocks.filter(x => x.id !== id); commit('week'); refresh();
  toast(`已删除「${b.t || CATS[b.c].full}」`, { action: { label: '撤销', fn: undo } });
}
export function dupTomorrow(id) {
  const w = W(); const b = w.blocks.find(x => x.id === id); if (!b) return;
  snap(); const nb = { ...b, id: uid(), done: false }; delete nb.src;
  if (b.d < 6) { nb.d = b.d + 1; w.blocks.push(nb); commit('week'); refresh(); }
  else { nb.d = 0; const nk = shiftWk(V.wk, 1); W(nk).blocks.push(nb); commit('week', nk); }
  toast(`已复制到${b.d < 6 ? WD[b.d + 1] : '下周一'}`, { action: { label: '撤销', fn: undo } });
}
