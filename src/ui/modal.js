import { $, $$, EASE_OUT, MOBILE, REDUCED, SPRING } from '../core/utils.js';
import { USER } from '../core/state.js';
import { E, closeEditor } from '../week/editor.js';

/* ================= modals ================= */
export const modal = $('#modal'), sheet = $('#sheet'), mBody = $('#mBody');
export let M = null;
export function openModal(kind, html, { wide = false } = {}) {
  if (E) closeEditor(true);
  sheet.getAnimations().forEach(a => a.cancel()); $('.scrim', modal).getAnimations().forEach(a => a.cancel());
  M = kind; mBody.innerHTML = html; sheet.classList.toggle('wide', wide); sheet.classList.toggle('locked', kind === 'user' && !USER); modal.hidden = false; sheet.scrollTop = 0;
  if (!REDUCED.matches) {
    $('.scrim', modal).animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: EASE_OUT });
    sheet.animate(MOBILE.matches ? [{ transform: 'translateY(40px)', opacity: 0 }, { transform: 'none', opacity: 1 }] : [{ transform: 'scale(.95) translateY(10px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 460, easing: SPRING });
    $$('.m-eyebrow,.m-title,.m-sub,.steps > li,.kpis,.rv-h,.catbars,.daybars,.insight,.refl,.set-row,.sci > li,.big-cta,.user-form,.keys', mBody).slice(0, 28)
      .forEach((x, i) => x.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 480, delay: 70 + i * 32, easing: SPRING, fill: 'backwards' }));
  }
  setTimeout(() => { const f = $('[data-autofocus]', mBody); if (f && (!MOBILE.matches || kind === 'user')) f.focus(); }, 60);
}
export function closeModal() {
  if (!M) return; M = null;
  if (REDUCED.matches) { modal.hidden = true; return; }
  $('.scrim', modal).animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, fill: 'forwards' });
  const a = sheet.animate([{ transform: 'none', opacity: 1 }, { transform: MOBILE.matches ? 'translateY(30px)' : 'scale(.97)', opacity: 0 }], { duration: 180, easing: EASE_OUT, fill: 'forwards' });
  a.onfinish = () => { if (!M) { modal.hidden = true; a.cancel(); $('.scrim', modal).getAnimations().forEach(x => x.cancel()); } };
}

export function setup() {
  modal.addEventListener('click', e => { if (e.target.closest('[data-close]')) { if (M === 'user' && !USER) return; closeModal(); } });
}
