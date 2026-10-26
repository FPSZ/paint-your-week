import { $, REDUCED, cssVar, el, esc } from '../core/utils.js';
import { ST } from '../core/state.js';
import { stepRain } from '../side/settle.js';
import { paintKey, paintSound } from './sound.js';

/* ================= celebrate: confetti + sound ================= */
export let fx, ctx;
export let parts = [], fxRun = false;
export function sizeFx() { const dpr = Math.min(2, devicePixelRatio || 1); fx.width = innerWidth * dpr; fx.height = innerHeight * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
export const resolveColor = c => { const m = /var\((--[\w-]+)\)/.exec(c); return m ? cssVar(m[1]) : c; };
export function burst(x, y, n = 26, power = 1, colors, o = {}) {
  if (REDUCED.matches) return;
  const pal = (colors || ['var(--c-deep)', 'var(--c-learn)', 'var(--c-admin)', 'var(--c-move)', 'var(--c-life)', 'var(--c-fun)']).map(resolveColor);
  n = Math.round(n * 1.8);
  for (let i = 0; i < n; i++) {
    const a = (o.dir ?? -Math.PI / 2) + (Math.random() - .5) * (o.spread ?? Math.PI * 1.05), sp = (3.6 + Math.random() * 6.4) * power;
    parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2.6 * power, g: .2 + Math.random() * .12, r: Math.random() * 6.28, vr: (Math.random() - .5) * .45, s: 4 + Math.random() * 5.5, c: pal[i % pal.length], sh: i % 4, ph: Math.random() * 6.28, life: 0, max: (54 + Math.random() * 40) * (o.life || 1) });
  }
  if (!fxRun) { fxRun = true; requestAnimationFrame(stepFx); }
}
// physics is in "60 fps frames" (k = elapsed / 16.7ms), so motion looks the same on any refresh rate
let fxLast = 0;
export function stepFx(now) {
  now = now || performance.now();
  const k = fxLast ? Math.min(3, Math.max(.2, (now - fxLast) / (1000 / 60))) : 1; fxLast = now;
  const dpr = fx.width / innerWidth || 1, drag = Math.pow(.985, k);
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, fx.width, fx.height);
  parts = parts.filter(p => p.life < p.max);
  for (const p of parts) {
    p.life += k;
    if (p.rain) { stepRain(p, k); ctx.globalAlpha = p.fade ? Math.max(0, (p.max - p.life) / 26) : 1; }
    else { p.vx *= drag; p.vy = p.vy * drag + p.g * k; p.x += p.vx * k; p.y += p.vy * k; p.r += p.vr * k; ctx.globalAlpha = Math.min(1, 1.4 - p.life / p.max * 1.4 + .4); }
    if (ctx.globalAlpha <= 0) continue;
    ctx.fillStyle = p.c;
    const c = Math.cos(p.r) * dpr, s = Math.sin(p.r) * dpr;
    if (p.sh === 3) { const f = .25 + Math.abs(Math.cos(p.life * .28 + p.ph)) * .75; ctx.setTransform(c, s, -s * f, c * f, p.x * dpr, p.y * dpr); ctx.fillRect(-p.s * .9, -p.s / 5, p.s * 1.8, p.s / 2.5); continue; }
    ctx.setTransform(c, s, -s, c, p.x * dpr, p.y * dpr);
    if (p.sh === 0) ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
    else if (p.sh === 4) { const z = p.s; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(-z / 2, -z / 2, z, z, z * .28); else ctx.rect(-z / 2, -z / 2, z, z); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.42)'; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(-z * .32, -z * .32, z * .4, z * .2, z * .1); else ctx.rect(-z * .32, -z * .32, z * .4, z * .2); ctx.fill(); }
    else if (p.sh === 5) { const R = p.s / 2, r = R * .46; ctx.beginPath(); for (let k = 0; k < 10; k++) { const an = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r : R; ctx.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } ctx.closePath(); ctx.fill(); }
    else if (p.sh === 1) { ctx.beginPath(); ctx.arc(0, 0, p.s / 2.6, 0, 6.283); ctx.fill(); }
    else { const z = p.s / 1.6; ctx.beginPath(); for (let j = 0; j < 4; j++) { const an = j * Math.PI / 2; ctx.lineTo(Math.cos(an) * z, Math.sin(an) * z); ctx.lineTo(Math.cos(an + Math.PI / 4) * z * .35, Math.sin(an + Math.PI / 4) * z * .35); } ctx.closePath(); ctx.fill(); }
  }
  ctx.globalAlpha = 1; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (parts.length) requestAnimationFrame(stepFx); else { fxRun = false; fxLast = 0; ctx.clearRect(0, 0, innerWidth, innerHeight); }
}
export function celebrate(x, y, color, kind = 'done') {
  const c = resolveColor(color);
  burst(x, y, kind === 'big' ? 44 : 24, kind === 'big' ? 1.25 : .9, [c, c, resolveColor('var(--gold)'), '#ffffff', c]);
  chime(kind);
}
export function plusLabel(x, y, text, cat) {
  if (REDUCED.matches) return;
  const p = el('div', 'plus', esc(text)); p.style.cssText = `left:${x}px;top:${y}px;--c:var(--c-${cat})`; document.body.appendChild(p);
  setTimeout(() => p.remove(), 1200);
}
export let AC = null;
export function ac() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; } } return AC; }
export function tone(a, f, t0, dur, vol, type = 'sine') {
  const o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.value = f;
  g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + .012); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
  o.connect(g); g.connect(a.destination); o.start(t0); o.stop(t0 + dur + .05);
}
export function chime(kind = 'done') {
  if (!ST().sound) return; const a = ac(); if (!a) return;
  try { if (a.state === 'suspended') a.resume(); } catch (e) {}
  const t = a.currentTime + .01;
  if (kind === 'done' || kind === 'big') paintSound(a, t, paintKey(true), kind === 'big');
  else { tone(a, 392, t, .35, .05, 'triangle'); tone(a, 523.25, t + .1, .45, .045, 'triangle'); }
}
export function setFxRun(v) { fxRun = v; return v; }

export function setup() {
  fx = $('#fx');
  ctx = fx.getContext('2d');
  sizeFx();
  addEventListener('resize', sizeFx);
  // creating an AudioContext takes ~100ms; do it while the page is idle so the first 涂色 doesn't stutter
  // (it starts suspended until a click, and chime() resumes it)
  (window.requestIdleCallback || (f => setTimeout(f, 1500)))(() => { if (ST().sound) ac(); }, { timeout: 4000 });
}
