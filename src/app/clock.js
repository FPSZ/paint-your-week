import { MOBILE } from '../core/utils.js';
import { today } from '../core/domain.js';
import { Sync } from '../core/sync.js';
import { renderDayHeads, renderTodayMarks } from '../week/dayheads.js';
import { renderHeader } from '../week/header.js';
import { renderNow } from '../side/now.js';
import { E, closeEditor } from '../week/editor.js';
import { monthChanged } from '../month/month.js';

/* ================= ticking clock ================= */
export function tick() {
  const t = today();
  if (tick.last && tick.last !== t.key) { renderHeader(); renderDayHeads(); monthChanged(); }
  tick.last = t.key;
  renderTodayMarks(); renderNow();
}

export function setup() {
  setInterval(tick, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { tick(); Sync.refresh(); } });
  MOBILE.addEventListener('change', () => { if (E) closeEditor(true); renderDayHeads(); renderTodayMarks(); });
}
