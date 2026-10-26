import { $, REDUCED, SPRING, clamp, fmtDur, fmtT, uid } from '../core/utils.js';
import { CATS, WD, cv, today } from '../core/domain.js';
import { MV, S, ST, V, W, commit, curBlock, snap, undo, undoStack } from '../core/state.js';
import { colEls, colsBox, dayheads, ghost, layer, scroller } from './dom.js';
import { HH, avgEnergy } from './grid.js';
import { makeBlockEl } from './blocks.js';
import { inList, renderInbox } from '../inbox/list.js';
import { refresh } from './refresh.js';
import { E, closeEditor, openEditor } from './editor.js';
import { selectDay } from './nav.js';
import { monthDrop, monthHover } from '../month/month.js';
import { toast } from '../ui/toast.js';
import { ibx } from '../inbox/float.js';

/* ================= pointer: drag / resize / create ================= */
export let DRAG = null, DRAG_CLICK_BLOCK = false;
export const snap15 = m => Math.round(m / 15) * 15;
export function visibleCols() { return colEls.filter(c => c.offsetParent !== null); }
export function colAtX(x, strict) {
  const vis = visibleCols(); if (!vis.length) return null;
  const cr = colsBox.getBoundingClientRect();
  if (strict && (x < cr.left - 20 || x > cr.right + 20)) return null;
  let best = null, bd = Infinity;
  for (const c of vis) { const r = c.getBoundingClientRect(); if (x >= r.left && x < r.right) return +c.dataset.d; const dd = Math.min(Math.abs(x - r.left), Math.abs(x - r.right)); if (dd < bd) { bd = dd; best = +c.dataset.d; } }
  return best;
}
export function minuteAtY(y, d) { const r = colEls[d].getBoundingClientRect(); return ST().startH * 60 + (y - r.top) / HH() * 60; }
export function showGhost(d, s, e, c, prefix = '') {
  const st = ST(); const hh = HH();
  const fresh = ghost.hidden || ghost.parentNode !== colEls[d];
  if (ghost.parentNode !== colEls[d]) colEls[d].appendChild(ghost);
  ghost.style.cssText = `${cv(c)};transform:translate3d(0,${(s - st.startH * 60) / 60 * hh}px,0);height:${Math.max((e - s) / 60 * hh - 2, 14)}px${fresh ? ';transition:none' : ''}`;
  ghost.firstChild.textContent = `${prefix}${fmtT(s)} – ${fmtT(e)}`;
  ghost.hidden = false;
}
function magnetized(on) {
  if (on && !ghost.classList.contains('mag')) { try { navigator.vibrate && navigator.vibrate(5); } catch (e) {} }
  ghost.classList.toggle('mag', !!on);
}
// the block edge nearest the pointer in this column, if one is close enough to grab.
// Looks at every block, not just the one under the pointer, so the bottom of a block that has another one
// right below it can still be grabbed; on a tie the bottom edge wins (stretching down is the common case).
export function edgeAt(col, x, y) {
  const hits = []; let over = null;
  for (const blk of col.querySelectorAll('.blk')) {
    if (blk.classList.contains('draft')) continue;
    const r = blk.getBoundingClientRect(); if (x < r.left || x > r.right) continue;
    hits.push([blk, r]); if (y > r.top && y < r.bottom) over = blk;
  }
  let best = null, bs = Infinity;
  for (const [blk, r] of hits) {
    // short blocks keep their whole body for moving and clicking: their edges are grabbed from just outside
    const small = r.height < 30, inB = small ? Math.min(3, r.height / 6) : 11, inT = small ? inB : 8;
    // reaching outward goes at most 3px into another block's body, so a neighbour never takes over the middle
    const reach = over && over !== blk ? 3 : small ? 10 : 7;
    // in the gap between two blocks the upper one's bottom edge is favoured, so the seam stretches it downward
    if (y >= r.bottom - inB && y <= r.bottom + reach) { const sc = Math.abs(y - r.bottom); if (sc <= bs) { bs = sc; best = { blk, top: false }; } }
    if (y >= r.top - reach && y <= r.top + inT && (small || x < r.right - 28)) { const sc = Math.abs(y - r.top) + 2.5; if (sc < bs) { bs = sc; best = { blk, top: true }; } }
  }
  return best;
}
// times pull toward neighbouring blocks' start/end (within ~12px), otherwise to the 15-minute grid
export function magnet(m, d, skipId) {
  const tol = 12 / HH() * 60; let best = null, bd = tol;
  for (const b of W().blocks) { if (b.d !== d || b.id === skipId) continue; for (const x of [b.s, b.e]) { const dd = Math.abs(x - m); if (dd < bd) { bd = dd; best = x; } } }
  return best == null ? { m: snap15(m), mag: false } : { m: best, mag: true };
}
// a block of length dur whose top is near `raw`: snap whichever of its two edges is closer to a neighbour
function magnetSpan(raw, dur, d, skipId) {
  const a = magnet(raw, d, skipId), z = magnet(raw + dur, d, skipId);
  if (a.mag && (!z.mag || Math.abs(a.m - raw) <= Math.abs(z.m - raw - dur))) return a;
  if (z.mag) return { m: z.m - dur, mag: true };
  return a;
}
export function hideGhost() { ghost.hidden = true; ghost.remove(); }
// the time line on the floating copy follows the drop target; null puts the original text back
export function flTime(D, text) {
  const t = D.fl && $(D.kind === 'task' ? '.t-est' : '.bm', D.fl); if (!t) return;
  if (D.flText == null) D.flText = t.textContent;
  const next = text || D.flText; if (t.textContent === next) return;
  t.textContent = next; D.fl.classList.toggle('timed', !!text);
}
export function activate() {
  const D = DRAG; D.active = true;
  if (E) closeEditor(true);
  if (D.kind === 'move') {
    snap(); D.fl = D.el.cloneNode(true); D.fl.classList.remove('editing'); D.fl.classList.add('floating', 'lifted');
    D.fl.style.top = '0px'; D.fl.style.left = '0px';
    D.fl.style.width = D.rect.width + 'px'; D.fl.style.height = D.rect.height + 'px';
    D.fl.insertAdjacentHTML('beforeend', '<span class="dup-badge" aria-hidden="true">+</span>');
    layer.appendChild(D.fl); setCopy(D.copy); dropCancel.classList.add('show'); ibx.classList.add('ghosted');
  } else if (D.kind === 'resize' || D.kind === 'resize-top') { snap(); D.el.classList.add('resizing'); }
  else if (D.kind === 'create') {
    D.draft = makeBlockEl({ id: 'draft' }); D.draft.classList.add('draft'); D.draft.dataset.id = 'draft';
    D.draft.style.cssText = cv(V.lastCat) + ';left:3px;width:calc(100% - 6px)';
    $('.bt', D.draft).textContent = '新的时间块'; $('.bq', D.draft).style.display = 'none';
    colEls[D.d].appendChild(D.draft);
  } else if (D.kind === 'task') {
    snap();
    D.fl = D.el.cloneNode(true); D.fl.classList.add('floating'); D.fl.style.width = D.rect.width + 'px'; D.fl.style.height = D.rect.height + 'px';
    layer.appendChild(D.fl); D.el.classList.add('placeholder'); ibx.classList.add('ghosted');
    dropCancel.classList.add('show');
    if (!lsGet(LS_TIP_TASK)) { lsSet(LS_TIP_TASK, '1'); toast('拖到顶部红色区域或按 Esc 取消'); }
  }
  if (D.kind !== 'move') document.body.style.cursor = D.kind === 'resize' || D.kind === 'resize-top' ? 'ns-resize' : 'grabbing';
  loop();
}
export function setCopy(on) {
  const D = DRAG; if (!D || D.kind !== 'move') return;
  D.copy = !!on;
  D.el.classList.toggle('dimmed', !D.copy);
  if (D.fl) D.fl.classList.toggle('copying', D.copy);
  document.body.style.cursor = D.copy ? 'copy' : 'grabbing';
  if (D.tgt) showGhost(D.tgt.d, D.tgt.s, D.tgt.s + D.dur, D.cat, D.copy ? '复制 · ' : '');
}
// is the pointer over the red cancel zone at the top?
function overCancel(D) { const zr = dropCancel.getBoundingClientRect(); return D.x >= zr.left - 12 && D.x <= zr.right + 12 && D.y >= zr.top - 12 && D.y <= zr.bottom + 18; }
export function update() {
  const D = DRAG; if (!D || !D.active) return;
  if (D.kind === 'task' || D.kind === 'move') {
    const hot = overCancel(D);
    if (hot !== !!D.cancelHover) { D.cancelHover = hot; dropCancel.classList.toggle('hot', hot); if (hot) { try { navigator.vibrate && navigator.vibrate(6); } catch (er) {} } }
    if (hot && D.kind === 'move') { D.tgt = null; hideGhost(); flTime(D, null); return; }
  }
  const st = ST(); const startM = st.startH * 60, endM = st.endH * 60;
  if (D.kind === 'move') {
    const d = colAtX(D.x, false); const top = D.y - D.offY;
    const g = magnetSpan(minuteAtY(top, d), D.dur, d, D.copy ? null : D.id); const s = clamp(g.m, startM, endM - D.dur);
    D.tgt = { d, s }; showGhost(d, s, s + D.dur, D.cat, D.copy ? '复制 · ' : ''); magnetized(g.mag);
    flTime(D, `${d !== D.d0 ? WD[d] + ' ' : ''}${fmtT(s)}–${fmtT(s + D.dur)}`);
  } else if (D.kind === 'resize-top') {
    const b = curBlock(D.id); if (!b) return;
    const m = clamp(magnet(minuteAtY(D.y, b.d), b.d, b.id).m, startM, b.e - 5);
    if (m !== b.s) { b.s = m; const hh = HH(); const h = (b.e - b.s) / 60 * hh; D.el.style.top = (b.s - startM) / 60 * hh + 'px'; D.el.style.height = Math.max(h - 2, 14) + 'px'; $('.bm', D.el).textContent = `${fmtT(b.s)}–${fmtT(b.e)} · ${fmtDur(b.e - b.s)}`; D.el.classList.toggle('xs', h < 32); D.el.classList.toggle('sm', h >= 32 && h < 56); }
  } else if (D.kind === 'resize') {
    const b = curBlock(D.id); if (!b) return;
    const m = clamp(magnet(minuteAtY(D.y, b.d), b.d, b.id).m, b.s + 5, endM);
    if (m !== b.e) { b.e = m; const hh = HH(); D.el.style.height = Math.max((b.e - b.s) / 60 * hh - 2, 14) + 'px'; $('.bm', D.el).textContent = `${fmtT(b.s)}–${fmtT(b.e)} · ${fmtDur(b.e - b.s)}`; D.el.classList.toggle('xs', (b.e - b.s) / 60 * hh < 32); D.el.classList.toggle('sm', (b.e - b.s) / 60 * hh >= 32 && (b.e - b.s) / 60 * hh < 56); }
  } else if (D.kind === 'create') {
    const m = magnet(minuteAtY(D.y, D.d), D.d).m;
    let s = Math.min(D.s0, m), e = Math.max(D.s0 + 15, m); s = clamp(s, startM, endM - 15); e = clamp(e, s + 15, endM);
    D.cs = s; D.ce = e; const hh = HH();
    D.draft.style.top = (s - startM) / 60 * hh + 'px'; D.draft.style.height = Math.max((e - s) / 60 * hh - 2, 14) + 'px';
    $('.bm', D.draft).textContent = `${fmtT(s)}–${fmtT(e)} · ${fmtDur(e - s)}`;
    D.draft.classList.toggle('xs', (e - s) / 60 * hh < 30); D.draft.classList.toggle('sm', (e - s) / 60 * hh >= 30 && (e - s) / 60 * hh < 54);
  } else if (D.kind === 'task') {
    if (MV) { monthHover(D); return; }
    const d = D.cancelHover ? null : colAtX(D.x, true); const sr = scroller.getBoundingClientRect();
    const over = d !== null && D.y > sr.top && D.y < sr.bottom;
    if (over) {
      const est = D.task.est; const top = D.y - 14;
      const g = magnetSpan(minuteAtY(top, d), est, d); const s = clamp(g.m, startM, endM - est);
      D.tgt = { d, s }; showGhost(d, s, Math.min(s + est, endM), D.task.c); magnetized(g.mag);
      flTime(D, `${WD[d]} ${fmtT(s)}–${fmtT(Math.min(s + est, endM))}`);
      if (!D.asBlock) { D.asBlock = true; const cw = colEls[d].getBoundingClientRect().width - 6; D.fl.classList.add('as-block'); D.fl.style.width = Math.max(cw, 120) + 'px'; D.fl.style.height = Math.max(est / 60 * HH() - 2, 30) + 'px'; D.offX = 20; D.offY = 14; }
    } else {
      D.tgt = null; hideGhost(); flTime(D, null);
      if (D.asBlock) { D.asBlock = false; D.fl.classList.remove('as-block'); D.fl.style.width = D.rect.width + 'px'; D.fl.style.height = D.rect.height + 'px'; D.offX = Math.min(D.offX, D.rect.width - 10); D.offY = D.rect.height / 2; }
    }
  }
}
export function loop() {
  const D = DRAG; if (!D || !D.active) return;
  if (D.dirty) { D.dirty = false; update(); }
  const r = scroller.getBoundingClientRect(); const top = dayheads.getBoundingClientRect().bottom; const edge = 56; let v = 0;
  if (!D.cancelHover && (D.kind !== 'task' || D.tgt)) {
    if (D.y < top + edge && D.y > r.top - 120) v = -Math.min(1, (top + edge - D.y) / edge) * 16;
    else if (D.y > r.bottom - edge && D.y < r.bottom + 120) v = Math.min(1, (D.y - (r.bottom - edge)) / edge) * 16;
  }
  if (v) { const before = scroller.scrollTop; scroller.scrollTop += v; if (scroller.scrollTop !== before) update(); }
  if (D.fl) {
    const vx = D.x - D.px; D.px = D.x; D.tilt += (clamp(vx * .7, -8, 8) - D.tilt) * .2;
    const scale = D.cancelHover ? .86 : D.kind === 'move' ? 1.03 : 1;
    D.fl.style.opacity = D.cancelHover ? '.7' : '';
    D.fl.style.transform = `translate3d(${D.x - D.offX}px, ${D.y - D.offY}px, 0) rotate(${D.tilt.toFixed(2)}deg) scale(${scale})`;
  }
  requestAnimationFrame(loop);
}
export function finish(cancel) {
  if (DRAG && DRAG.active && DRAG.dirty) { DRAG.dirty = false; update(); }
  const D = DRAG; DRAG = null; clearTimeout(D.lp); document.body.style.cursor = ''; ibx.classList.remove('ghosted'); dropCancel.classList.remove('show', 'hot');
  if (D.cancelHover) cancel = true;
  if (cancel && D.active) flTime(D, null);
  if (!D.active) {
    if (cancel) return;
    if (D.kind === 'move' || D.kind === 'resize' || D.kind === 'resize-top') { openEditor(D.id); return; }
    if (D.kind === 'create') { createAt(D.d, D.s0, D.s0 + 60); return; }
    if (D.kind === 'tap') {
      const dx = D.x - D.sx, dy = D.y - D.sy;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) { selectDay(clamp(V.sel + (dx < 0 ? 1 : -1), 0, 6), dx < 0 ? 1 : -1); return; }
      if (Math.hypot(dx, dy) < 10 && performance.now() - D.t0 < 500) createAt(D.d, D.s0, D.s0 + 60);
      return;
    }
    return;
  }
  DRAG_CLICK_BLOCK = true; setTimeout(() => { DRAG_CLICK_BLOCK = false; }, 0);
  if (D.kind === 'move') {
    const b = curBlock(D.id); const fl = D.fl; const from = fl.getBoundingClientRect(); hideGhost();
    D.el.classList.remove('dimmed');
    const moved = b && D.tgt && !cancel && (D.copy || D.tgt.d !== b.d || D.tgt.s !== b.s);
    if (moved && D.copy) {
      fl.remove();
      const nb = { ...b, id: uid(), d: D.tgt.d, s: D.tgt.s, e: D.tgt.s + D.dur, done: false }; delete nb.src;
      W().blocks.push(nb); commit('week'); refresh({ from: { [nb.id]: from } });
      toast(`已复制到 ${WD[nb.d]} ${fmtT(nb.s)}`, { action: { label: '撤销', fn: undo } });
    } else if (moved) {
      fl.remove();
      b.d = D.tgt.d; b.s = D.tgt.s; b.e = D.tgt.s + D.dur; commit('week');
      refresh({ flip: true, from: { [D.id]: from } });
      if (!lsGet(LS_TIP_ALT)) { lsSet(LS_TIP_ALT, '1'); setTimeout(() => toast(`按住 ${IS_MAC ? '⌥' : 'Alt'} 拖动可以复制方块`), 500); }
    } else {
      undoStack.pop();
      const to = D.el.getBoundingClientRect();
      if (REDUCED.matches || !to.width) fl.remove();
      else { const a = fl.animate([{ transform: fl.style.transform }, { transform: `translate3d(${to.left}px, ${to.top}px, 0)` }], { duration: 380, easing: SPRING, fill: 'forwards' }); a.onfinish = () => fl.remove(); }
    }
  } else if (D.kind === 'resize' || D.kind === 'resize-top') {
    D.el.classList.remove('resizing');
    if (cancel) undo(); else { commit('week'); refresh({ flip: true }); }
  } else if (D.kind === 'create') {
    D.draft.remove();
    if (!cancel && D.cs != null) createAt(D.d, D.cs, D.ce);
  } else if (D.kind === 'task') {
    hideGhost();
    if (MV && MV.drop) { MV.drop.classList.remove('drop'); MV.drop = null; }
    if (MV && D.mtgt && !cancel && monthDrop(D)) { /* landed on a day in the month view */ }
    else if (D.tgt && !cancel) {
      const from = D.fl.getBoundingClientRect(); D.fl.remove();
      const t = D.task; S.core.inbox = S.core.inbox.filter(x => x.id !== t.id);
      const b = { id: uid(), d: D.tgt.d, s: D.tgt.s, e: Math.min(D.tgt.s + t.est, ST().endH * 60), t: t.t, c: t.c, q: '', g: null, done: false };
      W().blocks.push(b); commit('core', 'week'); renderInbox(); refresh({ from: { [b.id]: from } });
      const lv = avgEnergy(b.s, b.e);
      toast(`已排进 ${WD[b.d]} ${fmtT(b.s)}${(b.c === 'deep' || b.c === 'learn') && lv >= .8 ? ' · 高能时段' : ''}`, { action: { label: '撤销', fn: undo } });
    } else {
      undoStack.pop();
      const fl = D.fl; const r = D.rect; const cur = fl.getBoundingClientRect();
      fl.classList.remove('as-block'); fl.style.width = r.width + 'px'; fl.style.height = r.height + 'px';
      const a = fl.animate([{ transform: `translate3d(${cur.left}px, ${cur.top}px, 0)` }, { transform: `translate3d(${r.left}px, ${r.top}px, 0)` }], { duration: REDUCED.matches ? 1 : 420, easing: SPRING, fill: 'forwards' });
      a.onfinish = () => { fl.remove(); D.el.classList.remove('placeholder'); };
    }
  }
}
export function createAt(d, s, e) {
  const st = ST(); s = clamp(s, st.startH * 60, st.endH * 60 - 15); e = clamp(e, s + 15, st.endH * 60);
  if (V.wk < today().wk && !V.pastOk) { V.pastOk = true; toast('这是过去的一周'); }
  snap();
  const b = { id: uid(), d, s, e, t: '', c: V.lastCat, q: '', g: null, done: false };
  W().blocks.push(b); commit('week'); V.dismissed[V.wk] = 1; refresh();
  requestAnimationFrame(() => openEditor(b.id, { fresh: true }));
}
export const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
export const LS_TIP_ALT = 'tuse-week-tip-alt', LS_TIP_TASK = 'tuse-week-tip-cancel';
export const dropCancel = $('#dropCancel');
export const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
export const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
export function blockTarget() {
  const a = document.activeElement;
  if (a && a.classList && a.classList.contains('blk') && curBlock(a.dataset.id)) return a.dataset.id;
  if (a && a !== document.body && !(a.classList && a.classList.contains('blk'))) return null;
  return V.hoverId && curBlock(V.hoverId) ? V.hoverId : null;
}
export function copyBlock(id) {
  const b = curBlock(id); if (!b) return;
  V.clip = { t: b.t, c: b.c, q: b.q, g: b.g, dur: b.e - b.s };
  toast(`已复制「${b.t || CATS[b.c].full}」，鼠标移到空位按 ${IS_MAC ? '⌘' : 'Ctrl'} + V`);
}
export function pasteBlock() {
  const c = V.clip; if (!c) return false;
  if (!V.overGrid) { toast('把鼠标移到要放的位置，再粘贴'); return true; }
  const d = colAtX(V.px, true); if (d == null) return true;
  const st = ST(); let s = Math.floor(minuteAtY(V.py, d) / 15) * 15;
  s = clamp(s, st.startH * 60, st.endH * 60 - c.dur);
  snap();
  const nb = { id: uid(), d, s, e: s + c.dur, t: c.t, c: c.c, q: c.q, g: c.g, done: false };
  W().blocks.push(nb); commit('week'); V.dismissed[V.wk] = 1; refresh();
  toast(`已粘贴到 ${WD[d]} ${fmtT(s)}`, { action: { label: '撤销', fn: undo } });
  return true;
}

let hinted = null;
function edgeHint(near) {
  const blk = near && near.blk, cls = near ? (near.top ? 'rs-top' : 'rs-bot') : '';
  if (hinted && (hinted !== blk || !hinted.classList.contains(cls))) hinted.classList.remove('rs-top', 'rs-bot');
  if (blk) blk.classList.add(cls);
  hinted = blk;
}

export function setup() {
  colsBox.addEventListener('pointermove', e => {
    if (DRAG || e.pointerType !== 'mouse') return;
    const col = e.target.closest('.col');
    const near = col && !e.target.closest('.chk') ? edgeAt(col, e.clientX, e.clientY) : null;
    colsBox.classList.toggle('edge-rs', !!near); edgeHint(near);
  });
  colsBox.addEventListener('pointerdown', e => {
    if (e.button > 0 || DRAG) return;
    const blk = e.target.closest('.blk');
    const touch = e.pointerType !== 'mouse';
    const ecol = !touch && !e.target.closest('.chk') && e.target.closest('.col');
    const near = ecol && edgeAt(ecol, e.clientX, e.clientY);
    if (near) {
      const b = curBlock(near.blk.dataset.id);
      if (b) {
        DRAG = { kind: near.top ? 'resize-top' : 'resize', id: b.id, el: near.blk, pid: e.pointerId, sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, touch, active: false, rect: near.blk.getBoundingClientRect(), tilt: 0, px: e.clientX };
        e.preventDefault(); return;
      }
    }
    if (blk) {
      if (e.target.closest('.chk')) return;
      const b = curBlock(blk.dataset.id); if (!b) return;
      const r = blk.getBoundingClientRect();
      DRAG = { kind: 'move', copy: !touch && e.altKey, d0: b.d, id: b.id, el: blk, pid: e.pointerId, sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, touch, active: false, offX: e.clientX - r.left, offY: e.clientY - r.top, rect: r, dur: b.e - b.s, cat: b.c, tilt: 0, px: e.clientX };
      if (!touch) e.preventDefault();
    } else {
      const col = e.target.closest('.col'); if (!col) return;
      if (performance.now() - (V.suppress || 0) < 80) return;
      const d = +col.dataset.d, y0 = minuteAtY(e.clientY, d), g = magnet(y0, d);
      DRAG = { kind: touch ? 'tap' : 'create', d, pid: e.pointerId, sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, touch, active: false, t0: performance.now(), s0: g.mag ? g.m : Math.floor(y0 / 15) * 15 };
      if (!touch) e.preventDefault();
    }
    if (touch && DRAG.kind === 'move') DRAG.lp = setTimeout(() => { if (DRAG && !DRAG.active && DRAG.kind === 'move') { activate(); try { navigator.vibrate && navigator.vibrate(8); } catch (er) {} } }, 280);
  });
  inList.addEventListener('pointerdown', e => {
    if (e.button > 0 || DRAG) return;
    const li = e.target.closest('.task'); if (!li || e.target.closest('.t-btn') || e.target.closest('input')) return;
    const task = S.core.inbox.find(t => t.id === li.dataset.tid); if (!task) return;
    const touch = e.pointerType !== 'mouse'; const r = li.getBoundingClientRect();
    DRAG = { kind: 'task', id: task.id, task, el: li, pid: e.pointerId, sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, touch, active: false, offX: e.clientX - r.left, offY: e.clientY - r.top, rect: r, tilt: 0, px: e.clientX };
    if (!touch) e.preventDefault();
    if (touch) DRAG.lp = setTimeout(() => { if (DRAG && !DRAG.active && DRAG.kind === 'task') { activate(); try { navigator.vibrate && navigator.vibrate(8); } catch (er) {} } }, 280);
  });
  window.addEventListener('pointermove', e => {
    const D = DRAG; if (!D || e.pointerId !== D.pid) return;
    D.x = e.clientX; D.y = e.clientY;
    const dist = Math.hypot(D.x - D.sx, D.y - D.sy);
    if (!D.active) {
      if (D.touch) { if (dist > 10 && D.kind !== 'tap') { clearTimeout(D.lp); DRAG = null; } return; }
      if (dist > 4) activate(); else return;
    }
    if (D.kind === 'move' && e.altKey !== D.copy) setCopy(e.altKey);
    // pointer events can arrive several times per frame; the drag loop picks up the latest position once per frame
    // ...except entering or leaving the cancel zone, which should react right away
    const flip = (D.kind === 'task' || D.kind === 'move') && overCancel(D) !== !!D.cancelHover;
    e.preventDefault(); if (D.fresh && !flip) D.dirty = true; else { D.fresh = true; D.dirty = false; update(); }
  }, { passive: false });
  document.addEventListener('keydown', e => { if (e.key === 'Alt' && DRAG && DRAG.active && DRAG.kind === 'move') { e.preventDefault(); setCopy(true); } });
  document.addEventListener('keyup', e => { if (e.key === 'Alt' && DRAG && DRAG.active && DRAG.kind === 'move') { e.preventDefault(); setCopy(false); } });
  document.addEventListener('touchmove', e => { if (DRAG && DRAG.active) e.preventDefault(); }, { passive: false });
  window.addEventListener('pointerup', e => { if (DRAG && e.pointerId === DRAG.pid) finish(false); });
  window.addEventListener('pointercancel', e => { if (DRAG && e.pointerId === DRAG.pid) finish(true); });
  colsBox.addEventListener('pointermove', e => { if (e.pointerType !== 'mouse') return; V.px = e.clientX; V.py = e.clientY; V.overGrid = true; const b = e.target.closest('.blk'); V.hoverId = b && b.dataset.id !== 'draft' ? b.dataset.id : null; });
  colsBox.addEventListener('pointerleave', () => { V.overGrid = false; V.hoverId = null; if (!DRAG) { colsBox.classList.remove('edge-rs'); edgeHint(null); } });
}
