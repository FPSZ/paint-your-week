import { el, pad } from '../core/utils.js';
import { CHRONO, ENERGY } from '../core/domain.js';
import { ST } from '../core/state.js';
import { bandsBox, gridEl, gutter, nowTag } from './dom.js';

/* ================= grid skeleton ================= */
export const HH = () => ({ compact: 44, std: 56, roomy: 72 })[ST().density] || 56;
export const energyAt = m => ENERGY[ST().chrono][Math.floor(m / 60) % 24];
export const avgEnergy = (s, e) => { let t = 0, n = 0; for (let m = s; m < e; m += 15) { t += energyAt(m); n++; } return n ? t / n : 0; };
export function buildGrid() {
  const st = ST(); const hours = st.endH - st.startH; const hh = HH();
  document.documentElement.style.setProperty('--hh', hh + 'px');
  gridEl.style.setProperty('--hours', hours);
  gutter.innerHTML = '';
  for (let i = 0; i < hours; i++) {
    const lab = el('div', 'hl'); lab.style.top = (i * hh) + 'px'; lab.textContent = `${pad((st.startH + i) % 24)}:00`;
    gutter.appendChild(lab);
  }
  const lv = []; for (let i = 0; i <= hours; i++) lv.push(ENERGY[st.chrono][Math.min(23, st.startH + i) % 24]);
  const stops = lv.map((v, i) => `color-mix(in oklab, var(--gold) ${Math.round(v * 100)}%, transparent) ${(i / hours * 100).toFixed(2)}%`).join(',');
  const strip = el('div', 'energy'); strip.style.background = `linear-gradient(to bottom, ${stops})`; strip.title = `能量曲线（${CHRONO[st.chrono]}）`;
  gutter.appendChild(strip);
  bandsBox.innerHTML = '';
  let start = null;
  for (let h = st.startH; h <= st.endH; h++) {
    const hi = h < st.endH && ENERGY[st.chrono][h % 24] >= .85;
    if (hi && start === null) start = h;
    if (!hi && start !== null) {
      const top = (start - st.startH) * hh, height = (h - start) * hh;
      const b = el('div', 'band'); b.style.top = top + 'px'; b.style.height = height + 'px'; bandsBox.appendChild(b);
      const tag = el('div', 'band-tag', '高能'); tag.style.top = top + 'px'; tag.title = '按你的作息类型推算的高能时段'; gutter.appendChild(tag);
      start = null;
    }
  }
  gutter.appendChild(nowTag);
}
