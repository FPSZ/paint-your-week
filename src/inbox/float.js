import { $, EASE_OUT, REDUCED, SPRING, clamp, el } from '../core/utils.js';
import { lsSet } from '../week/drag.js';

/* ================= floating inbox ================= */
export const ibx = $('#ibx'), ibxFab = $('#ibxFab'), ibxPanel = $('#ibxPanel');
export const LS_IBX = 'tuse-week-inbox-pos';
export const SAFE = (() => { const p = el('div'); p.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding-bottom:env(safe-area-inset-bottom,0px);padding-top:env(safe-area-inset-top,0px)'; document.body.appendChild(p); const cs = getComputedStyle(p); const o = { b: parseFloat(cs.paddingBottom) || 0, t: parseFloat(cs.paddingTop) || 0 }; p.remove(); return o; })();
export const IB = Object.assign({ h: 'r', v: 'b', dx: 24, dy: 24, open: false }, (() => { try { const o = JSON.parse(localStorage.getItem(LS_IBX) || 'null'); return o && /^[rl]$/.test(o.h) && /^[bt]$/.test(o.v) && isFinite(o.dx) && isFinite(o.dy) ? { h: o.h, v: o.v, dx: +o.dx, dy: +o.dy } : {}; } catch (e) { return {}; } })());
export let IBD = null, ibxJustDragged = false;
export function saveIbx() { lsSet(LS_IBX, JSON.stringify({ h: IB.h, v: IB.v, dx: Math.round(IB.dx), dy: Math.round(IB.dy) })); }
export function placeIbx() {
  const st = ibx.style; st.left = st.right = st.top = st.bottom = ''; st.translate = '';
  const dy = Math.max(IB.dy, 12 + (IB.v === 'b' ? SAFE.b : SAFE.t)), dx = Math.max(IB.dx, 8);
  st[IB.h === 'r' ? 'right' : 'left'] = dx + 'px';
  st[IB.v === 'b' ? 'bottom' : 'top'] = dy + 'px';
  ibx.dataset.h = IB.h; ibx.dataset.v = IB.v;
  ibxPanel.style.setProperty('--maxh', Math.max(240, Math.min(560, innerHeight - dy - 16)) + 'px');
  ibxPanel.style.transformOrigin = `${IB.h === 'r' ? 'right' : 'left'} ${IB.v === 'b' ? 'bottom' : 'top'}`;
  const r = ibx.getBoundingClientRect(); let fx = 0, fy = 0;
  if (r.left < 8) fx = 8 - r.left; else if (r.right > innerWidth - 8) fx = innerWidth - 8 - r.right;
  if (r.top < 8) fy = 8 - r.top; else if (r.bottom > innerHeight - 8) fy = innerHeight - 8 - r.bottom;
  if (fx || fy) st.translate = `${fx}px ${fy}px`;
}
export function openIbx(focus = true) {
  if (!IB.open) {
    IB.open = true; ibxFab.setAttribute('aria-expanded', 'true');
    ibx.classList.add('open'); ibxPanel.hidden = false; placeIbx();
    if (!REDUCED.matches) ibxPanel.animate([{ opacity: 0, transform: 'scale(.35)', borderRadius: '30px' }, { opacity: 1, transform: 'none', borderRadius: '22px' }], { duration: 520, easing: SPRING });
  }
  if (focus) setTimeout(() => { if (IB.open) $('#inInput').focus({ preventScroll: true }); }, 60);
}
export function closeIbx() {
  if (!IB.open) return; IB.open = false; ibxFab.setAttribute('aria-expanded', 'false');
  if (ibx.contains(document.activeElement)) document.activeElement.blur();
  const done = () => {
    if (IB.open) return; ibxPanel.hidden = true; ibx.classList.remove('open'); placeIbx();
    if (!REDUCED.matches) ibxFab.animate([{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'none' }], { duration: 460, easing: SPRING });
  };
  if (REDUCED.matches) return done();
  const an = ibxPanel.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.45)' }], { duration: 200, easing: EASE_OUT }); an.onfinish = done;
}
export function ibxDown(e) {
  if (e.button > 0 || IBD) return;
  if (e.target.closest('.ibx-h button')) return;
  const r = ibx.getBoundingClientRect();
  IBD = { pid: e.pointerId, sx: e.clientX, sy: e.clientY, l: r.left, t: r.top, w: r.width, h: r.height, moved: false };
}
export function ibxUp(e) {
  if (!IBD || e.pointerId !== IBD.pid) return;
  const D = IBD; IBD = null; if (!D.moved) return;
  ibx.classList.remove('dragging'); ibxJustDragged = true; setTimeout(() => { ibxJustDragged = false; }, 0);
  const r = ibx.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  IB.h = cx > innerWidth / 2 ? 'r' : 'l'; IB.v = cy > innerHeight / 2 ? 'b' : 't';
  IB.dx = IB.h === 'r' ? innerWidth - r.right : r.left; IB.dy = IB.v === 'b' ? innerHeight - r.bottom : r.top;
  if (IB.dx < 44) IB.dx = 16;
  if (IB.dy < 44) IB.dy = 16;
  placeIbx(); saveIbx();
  if (!REDUCED.matches) { const to = ibx.getBoundingClientRect(); ibx.animate([{ transform: `translate(${r.left - to.left}px, ${r.top - to.top}px)` }, { transform: 'none' }], { duration: 520, easing: SPRING }); }
}

export function setup() {
  ibxFab.addEventListener('pointerdown', ibxDown);
  $('#ibxHandle').addEventListener('pointerdown', ibxDown);
  window.addEventListener('pointermove', e => {
    if (!IBD || e.pointerId !== IBD.pid) return;
    const dx = e.clientX - IBD.sx, dy = e.clientY - IBD.sy;
    if (!IBD.moved) {
      if (Math.hypot(dx, dy) < 5) return;
      IBD.moved = true; ibx.classList.add('dragging');
      const st = ibx.style; st.right = st.bottom = ''; st.translate = ''; st.left = IBD.l + 'px'; st.top = IBD.t + 'px';
    }
    e.preventDefault();
    ibx.style.left = clamp(IBD.l + dx, 8, innerWidth - IBD.w - 8) + 'px';
    ibx.style.top = clamp(IBD.t + dy, 8, innerHeight - IBD.h - 8) + 'px';
  }, { passive: false });
  window.addEventListener('pointerup', ibxUp);
  window.addEventListener('pointercancel', ibxUp);
  ibxFab.addEventListener('click', () => { if (!ibxJustDragged) openIbx(); });
  $('#ibxMin').addEventListener('click', closeIbx);
  addEventListener('resize', () => { if (!IBD) placeIbx(); });
  placeIbx();
}
