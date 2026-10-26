import { $, $$, EASE_OUT, REDUCED, SPRING } from '../core/utils.js';
import { mBody } from './modal.js';

/* ================= theme: follow system / light / dark, remembered per device ================= */
export const LS_THEME = 'tuse-week-theme';
export const rootEl = document.documentElement;
export const THEMES = { system: '跟随系统', light: '浅色', dark: '深色' };
export const NEXT_THEME = { system: 'light', light: 'dark', dark: 'system' };
export let themePref = 'system';
// the claude.ai viewer may set data-theme itself; keep its value so "跟随系统" can hand control back
export let hostTheme = themePref === 'system' ? rootEl.getAttribute('data-theme') : (window.__tuseHostTheme || null);
export let themeSet = rootEl.getAttribute('data-theme');
export const THEME_ICON = {
  system: '<svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" stroke="none"/></svg>',
  light: '<svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6L6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4"/></svg>',
  dark: '<svg class="ic" viewBox="0 0 24 24"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" fill="currentColor"/></svg>',
};
export function applyTheme() {
  const v = themePref === 'system' ? hostTheme : themePref;
  themeSet = v || null;
  if (v) rootEl.setAttribute('data-theme', v); else rootEl.removeAttribute('data-theme');
}
export function renderThemeBtn(animate) {
  const b = $('#themeBtn');
  b.innerHTML = THEME_ICON[themePref];
  b.title = `外观：${THEMES[themePref]}（点击切换到${THEMES[NEXT_THEME[themePref]]}）`;
  b.setAttribute('aria-label', b.title);
  if (animate && !REDUCED.matches) b.firstChild.animate([{ transform: 'rotate(-120deg) scale(.4)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 520, easing: SPRING });
  $$('[data-tv]', mBody).forEach(x => x.classList.toggle('on', x.dataset.tv === themePref));
}
export function setTheme(pref, originEl) {
  if (!THEMES[pref] || pref === themePref) return;
  themePref = pref;
  try { localStorage.setItem(LS_THEME, pref); } catch (e) {}
  renderThemeBtn(true);
  if (!document.startViewTransition || REDUCED.matches) { applyTheme(); return; }
  const r = originEl ? originEl.getBoundingClientRect() : null;
  const x = r ? r.left + r.width / 2 : innerWidth - 40, y = r ? r.top + r.height / 2 : 40;
  const end = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  const vt = document.startViewTransition(applyTheme);
  vt.ready.then(() => {
    rootEl.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${end}px at ${x}px ${y}px)`] }, { duration: 640, easing: EASE_OUT, pseudoElement: '::view-transition-new(root)' });
  }).catch(() => {});
}

export function setup() {
  try { const t = localStorage.getItem(LS_THEME); if (THEMES[t]) themePref = t; } catch (e) {}
  new MutationObserver(() => {
    const cur = rootEl.getAttribute('data-theme');
    if (cur === themeSet) return;
    hostTheme = cur;
    if (themePref === 'system') themeSet = cur; else applyTheme();
  }).observe(rootEl, { attributes: true, attributeFilter: ['data-theme'] });
  applyTheme();
  renderThemeBtn(false);
  $('#themeBtn').addEventListener('click', e => setTheme(NEXT_THEME[themePref], e.currentTarget));
}
