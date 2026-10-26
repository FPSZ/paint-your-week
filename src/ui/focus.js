import { $, EASE_OUT, REDUCED, clamp, esc, fmtDur, fmtT, pad } from '../core/utils.js';
import { CATS, cv, today } from '../core/domain.js';
import { locate } from '../core/state.js';
import { toggleDone } from '../week/actions.js';
import { chime } from '../fx/fx.js';
import { toast } from './toast.js';

/* ================= focus mode ================= */
export const focusEl = $('#focus');
export let F = null;
export const FC = 2 * Math.PI * 93;
export function openFocus(id) {
  const loc = locate(id); if (!loc) return; const b = loc.b; const t = today();
  const inNow = loc.wk === t.wk && b.d === t.d && b.s <= t.m && b.e > t.m;
  const total = (b.e - b.s) * 60000;
  const endTs = inNow ? Date.now() + ((b.e * 60) - (t.m * 60 + t.now.getSeconds())) * 1000 : Date.now() + total;
  F = { id, endTs, total, paused: false, left: 0, rung: false };
  focusEl.style.cssText = cv(b.c);
  $('#fCat').textContent = CATS[b.c].full; $('#fTitle').textContent = b.t || CATS[b.c].full;
  $('#fCue').textContent = b.q || '';
  $('#fMeta').textContent = `${fmtT(b.s)}–${fmtT(b.e)} · ${fmtDur(b.e - b.s)}`;
  const nx = loc.w.blocks.filter(x => x.d === b.d && x.s >= b.e && x.id !== b.id).sort((a, z) => a.s - z.s)[0];
  $('#fNext').innerHTML = nx ? `下一项 <b>${fmtT(nx.s)} ${esc(nx.t || CATS[nx.c].full)}</b>` : '';
  $('#fPause').textContent = '暂停';
  focusEl.hidden = false;
  if (!REDUCED.matches) focusEl.animate([{ opacity: 0, transform: 'scale(1.03)' }, { opacity: 1, transform: 'none' }], { duration: 500, easing: EASE_OUT });
  try { navigator.wakeLock && navigator.wakeLock.request('screen').then(l => { F && (F.lock = l); }).catch(() => {}); } catch (e) {}
  tickFocus(); F.iv = setInterval(tickFocus, 250);
}
export function tickFocus() {
  if (!F) return;
  const left = F.paused ? F.left : Math.max(0, F.endTs - Date.now());
  const sec = Math.ceil(left / 1000); const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
  $('#fTime').textContent = h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  $('#fArc').style.strokeDashoffset = String(FC * (1 - clamp(1 - left / F.total, 0, 1)));
  $('#fSub').textContent = F.paused ? '已暂停' : left > 0 ? '剩余时间' : '时间到，做完了吗？';
  if (left <= 0 && !F.rung) { F.rung = true; chime('soft'); }
}
export function closeFocus() {
  if (!F) return; clearInterval(F.iv); try { F.lock && F.lock.release(); } catch (e) {} F = null;
  if (REDUCED.matches) { focusEl.hidden = true; return; }
  const a = focusEl.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, easing: EASE_OUT }); a.onfinish = () => { if (!F) focusEl.hidden = true; };
}

export function setup() {
  $('#fArc').style.strokeDasharray = FC;
  $('#fPause').addEventListener('click', () => { if (!F) return; if (F.paused) { F.endTs = Date.now() + F.left; F.paused = false; $('#fPause').textContent = '暂停'; } else { F.left = Math.max(0, F.endTs - Date.now()); F.paused = true; $('#fPause').textContent = '继续'; } tickFocus(); });
  $('#fExit').addEventListener('click', closeFocus);
  $('#fDone').addEventListener('click', () => { if (!F) return; const id = F.id; closeFocus(); const loc = locate(id); if (loc && !loc.b.done) setTimeout(() => toggleDone(id, null), 120); else if (loc) toast('这块已经涂过色了'); });
}
