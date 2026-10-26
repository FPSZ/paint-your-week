import { $, el, esc } from '../core/utils.js';

/* ================= toast ================= */
export const toastsEl = $('#toasts');
export function toast(text, { action, icon, ms = 3600 } = {}) {
  while (toastsEl.children.length > 2) toastsEl.firstChild.remove();
  const t = el('div', 'toast', `${icon ? `<span class="ic">${icon}</span>` : ''}<span>${esc(text)}</span>`);
  if (action) { const b = el('button', '', esc(action.label)); b.addEventListener('click', () => { action.fn(); kill(); }); t.appendChild(b); }
  toastsEl.appendChild(t);
  let gone = false; const kill = () => { if (gone) return; gone = true; t.classList.add('out'); setTimeout(() => t.remove(), 260); };
  setTimeout(kill, ms);
}
