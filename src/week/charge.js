import { REDUCED } from '../core/utils.js';
import { ST, curBlock } from '../core/state.js';
import { colsBox } from './dom.js';
import { toggleDone } from './actions.js';
import { ac } from '../fx/fx.js';
import { toast } from '../ui/toast.js';

/* ================= hold the circle to paint ================= */
// pressing a block's circle charges it: a ring fills, the circle shakes harder and harder and a rising tone builds.
// only a full ring paints the block; letting go early drains it again.
// un-painting a done block and keyboard presses stay a single press.
export const HOLD = 700;
const R = 14, C = 2 * Math.PI * R;
let CH = null, swallow = false, hintAt = -1e9;

function ring(chk) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('class', 'chg'); s.setAttribute('viewBox', '0 0 32 32'); s.setAttribute('aria-hidden', 'true');
  s.innerHTML = `<circle class="chg-t" cx="16" cy="16" r="${R}"/><circle class="chg-p" cx="16" cy="16" r="${R}" stroke-dasharray="${C}" stroke-dashoffset="${C}" transform="rotate(-90 16 16)"/>`;
  chk.appendChild(s); return s;
}

/* ---------- sound: a filtered saw sliding up two octaves, its tremolo speeding up ---------- */
function chargeTone() {
  if (!ST().sound) return null; const a = ac(); if (!a) return null;
  try { if (a.state === 'suspended') a.resume(); } catch (e) {}
  const t = a.currentTime + .005, T = HOLD / 1000;
  const out = a.createGain(); out.gain.setValueAtTime(0, t); out.gain.linearRampToValueAtTime(.03, t + .05); out.gain.linearRampToValueAtTime(.07, t + T);
  const trem = a.createGain(); trem.gain.value = .7;
  const lfo = a.createOscillator(); lfo.frequency.setValueAtTime(7, t); lfo.frequency.exponentialRampToValueAtTime(26, t + T);
  const depth = a.createGain(); depth.gain.setValueAtTime(.08, t); depth.gain.linearRampToValueAtTime(.3, t + T);
  const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 6; lp.frequency.setValueAtTime(480, t); lp.frequency.exponentialRampToValueAtTime(4200, t + T);
  const o1 = a.createOscillator(); o1.type = 'sawtooth'; o1.frequency.setValueAtTime(196, t); o1.frequency.exponentialRampToValueAtTime(784, t + T);
  const o2 = a.createOscillator(); o2.type = 'triangle'; o2.frequency.setValueAtTime(392, t); o2.frequency.exponentialRampToValueAtTime(1568, t + T);
  const g2 = a.createGain(); g2.gain.value = .45;
  lfo.connect(depth); depth.connect(trem.gain);
  o1.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(trem); trem.connect(out); out.connect(a.destination);
  for (const o of [o1, o2, lfo]) o.start(t);
  return { a, out, o1, o2, lfo };
}
function stopTone(s, full) {
  if (!s) return; const { a, out, o1, o2, lfo } = s; const t = a.currentTime;
  out.gain.cancelScheduledValues(t); out.gain.setValueAtTime(out.gain.value, t);
  if (full) {
    out.gain.linearRampToValueAtTime(0, t + .03);
    // the release: a soft low thump under the chime that toggleDone plays
    const o = a.createOscillator(), g = a.createGain();
    o.frequency.setValueAtTime(170, t); o.frequency.exponentialRampToValueAtTime(48, t + .16);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.16, t + .008); g.gain.exponentialRampToValueAtTime(.0001, t + .2);
    o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + .25);
  } else {
    // letting go early: the pitch sags an octave as it fades, like powering down
    for (const o of [o1, o2]) { o.frequency.cancelScheduledValues(t); o.frequency.setValueAtTime(o.frequency.value, t); o.frequency.exponentialRampToValueAtTime(o.frequency.value / 2, t + .2); }
    out.gain.linearRampToValueAtTime(0, t + .2);
  }
  for (const o of [o1, o2, lfo]) o.stop(t + .26);
}
const buzz = p => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };

/* ---------- charge ---------- */
function start(e, chk, blk) {
  const flood = blk.querySelector('.flood');
  flood.__chg = null; flood.style.transition = 'none';
  chk.classList.add('charging');
  CH = { id: blk.dataset.id, chk, blk, flood, ring: ring(chk), pid: e.pointerId, sx: e.clientX, sy: e.clientY, t0: performance.now(), flip: 1, tone: chargeTone() };
  CH.prog = CH.ring.lastChild;
  // pulses that crowd closer together, roughly over the hold
  buzz([6, 120, 8, 95, 10, 72, 12, 54, 14, 38, 16, 26, 20, 16, 24]);
  CH.raf = requestAnimationFrame(frame);
}
function frame(now) {
  const D = CH; if (!D) return;
  if (!D.blk.isConnected) return cancel(false);
  const p = Math.min(1, (now - D.t0) / HOLD), k = p * p;
  D.prog.style.strokeDashoffset = C * (1 - p);
  // the paint pools inside the circle first, then floods the block from there
  D.flood.style.clipPath = `circle(${(7.6 * (1 - (1 - p) ** 2)).toFixed(2)}px at calc(100% - 15px) 15px)`;
  if (!REDUCED.matches) {
    const a = .25 + 2 * k; D.flip = -D.flip;
    const x = D.flip * a * (.55 + .45 * Math.random()), y = a * .7 * (Math.random() * 2 - 1), r = 9 * k * (Math.random() * 2 - 1);
    D.chk.style.transform = `translate(${x.toFixed(2)}px,${y.toFixed(2)}px) rotate(${r.toFixed(1)}deg) scale(${(1 + .1 * (1 - (1 - p) ** 3)).toFixed(3)})`;
  }
  if (p >= 1) return complete();
  D.raf = requestAnimationFrame(frame);
}
function release(D) {
  cancelAnimationFrame(D.raf); CH = null;
  D.chk.classList.remove('charging'); D.chk.style.transform = '';
}
function complete() {
  const D = CH; release(D);
  stopTone(D.tone, true); buzz(30);
  D.flood.style.transition = ''; D.flood.style.clipPath = '';
  D.ring.classList.add('pop'); setTimeout(() => D.ring.remove(), 450);
  swallow = true; // the click that follows letting go must not un-paint it again
  toggleDone(D.id, D.chk);
}
function cancel(short) {
  const D = CH; if (!D) return; release(D);
  stopTone(D.tone, false); buzz(0);
  const tok = D.flood.__chg = {};
  D.flood.style.transition = 'clip-path .3s var(--ease-out)'; D.flood.style.clipPath = 'circle(0px at calc(100% - 15px) 15px)';
  setTimeout(() => { if (D.flood.__chg === tok) { D.flood.style.transition = ''; D.flood.style.clipPath = ''; } }, 340);
  D.prog.style.transition = 'stroke-dashoffset .28s var(--ease-out)'; D.prog.style.strokeDashoffset = C;
  D.ring.classList.add('out'); setTimeout(() => D.ring.remove(), 320);
  const now = performance.now();
  if (short && now - hintAt > 5000) { hintAt = now; toast('按住圆圈，蓄满了就涂上色'); }
}

export function setup() {
  colsBox.addEventListener('pointerdown', e => {
    if (e.button > 0) return;
    const chk = e.target.closest('.chk'); if (!chk) return;
    swallow = false;
    const blk = chk.closest('.blk'); if (!blk || blk.dataset.id === 'draft') return;
    const b = curBlock(blk.dataset.id); if (!b || b.done) return;
    if (CH) cancel(false);
    e.preventDefault();
    try { chk.setPointerCapture(e.pointerId); } catch (er) {}
    start(e, chk, blk);
  });
  window.addEventListener('pointermove', e => { if (CH && e.pointerId === CH.pid && Math.hypot(e.clientX - CH.sx, e.clientY - CH.sy) > 24) cancel(false); });
  window.addEventListener('pointerup', e => { if (CH && e.pointerId === CH.pid) cancel(performance.now() - CH.t0 < 260); });
  window.addEventListener('pointercancel', e => { if (CH && e.pointerId === CH.pid) cancel(false); });
  window.addEventListener('blur', () => cancel(false));
  colsBox.addEventListener('contextmenu', e => { if (e.target.closest('.chk')) e.preventDefault(); });
  colsBox.addEventListener('click', e => {
    const c = e.target.closest('.chk'); if (!c) return;
    if (swallow) { swallow = false; return; }
    const blk = c.closest('.blk'); const b = blk && curBlock(blk.dataset.id); if (!b) return;
    // a pointer press on an unpainted circle is handled by the hold above
    if (b.done || e.detail === 0) toggleDone(b.id);
  });
}
