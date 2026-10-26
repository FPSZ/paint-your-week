import { $, $$, REDUCED, SPRING } from '../core/utils.js';
import { today } from '../core/domain.js';
import { V } from '../core/state.js';
import { buildGrid } from '../week/grid.js';
import { syncInOpts } from '../inbox/list.js';
import { renderAll } from '../week/refresh.js';
import { lsGet } from '../week/drag.js';
import { scrollToMinute } from '../week/nav.js';
import { LS_VIEW, setView } from '../month/month.js';

export function setup() {
  /* ================= boot ================= */
  buildGrid();
  syncInOpts();
  renderAll({ enter: true });
  if (!REDUCED.matches) {
    [...$$('.top > *'), ...$$('#side > *')].forEach((x, i) => x.animate([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 640, delay: 40 + i * 60, easing: SPRING, fill: 'backwards' }));
    $('#cal').animate([{ opacity: 0, transform: 'translateY(16px) scale(.985)' }, { opacity: 1, transform: 'none' }], { duration: 720, delay: 90, easing: SPRING, fill: 'backwards' });
  }
  requestAnimationFrame(() => { const t = today(); scrollToMinute(V.wk === t.wk ? t.m : 8 * 60, false); });
  setTimeout(() => $('#logo').classList.add('filled'), 700);
  if (lsGet(LS_VIEW) === 'month') setView('month');
}
