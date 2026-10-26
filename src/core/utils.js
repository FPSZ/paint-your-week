export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
export const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const pad = n => String(n).padStart(2, '0');
export const fmtT = m => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
export const toM = s => { const [a, b] = String(s).split(':').map(Number); return (a || 0) * 60 + (b || 0); };
export const fmtH = m => String(Math.round(m / 6) / 10);
export const fmtDur = m => m < 60 ? `${m}min` : `${fmtH(m)}h`;
export const clone = o => JSON.parse(JSON.stringify(o));
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const REDUCED = matchMedia('(prefers-reduced-motion: reduce)');
export const MOBILE = matchMedia('(max-width: 760px)');
export const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
export let SPRING = 'cubic-bezier(.34,1.36,.64,1)';
try {
  const lin = 'linear(0, .0063, .0255 2.4%, .1022 5.1%, .5361 16%, .7258 21.9%, .8538 27.5%, .9388 33.4%, .9666 36.6%, .9876 40%, 1.0099 46.6%, 1.0168 52.3%, 1.0163 59.3%, 1.0035 79.5%, 1)';
  document.documentElement.animate([{ opacity: 1 }, { opacity: 1 }], { duration: 1, easing: lin });
  SPRING = lin;
} catch (e) {}
export const EASE_OUT = 'cubic-bezier(.22,1,.36,1)';
export const I = {
  check: '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="8.2"/><path d="M6.2 10.4l2.6 2.6 5-5.4"/></svg>',
  x: '<svg class="ic" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  auto: '<svg class="ic" viewBox="0 0 24 24"><path d="M4 7h10a5 5 0 0 1 0 10H8M11 13l-4 4 4 4"/></svg>',
  down: '<svg class="ic" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>',
  spark: '<svg class="ic" viewBox="0 0 24 24"><path d="M12 3l1.8 5.4L19.5 10l-5.7 1.7L12 17.5l-1.8-5.8L4.5 10l5.7-1.6z"/><path d="M19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z"/></svg>',
  moon: '<svg class="ic moon" viewBox="0 0 24 24"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/><path d="M19 2.5v4M21 4.5h-4"/></svg>',
  undo: '<svg class="ic" viewBox="0 0 24 24"><path d="M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3"/></svg>',
  redo: '<svg class="ic" viewBox="0 0 24 24"><path d="M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3"/></svg>',
};
