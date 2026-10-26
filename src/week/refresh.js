import { renderBlocks } from './blocks.js';
import { renderDayHeads, renderTodayMarks } from './dayheads.js';
import { renderHeader } from './header.js';
import { updateStats } from '../side/stats.js';
import { renderGoals } from '../side/goals.js';
import { renderInbox } from '../inbox/list.js';
import { renderNow } from '../side/now.js';
import { renderEmpty } from './empty.js';
import { RT } from '../pages/rituals.js';

/* ================= refresh ================= */
export function refresh(opts = {}) {
  renderDayHeads(); renderBlocks(opts); renderTodayMarks(); updateStats(); renderNow(); renderEmpty();
  if (RT && RT.live) RT.live();
}
export function renderAll(opts = {}) { renderHeader(); renderGoals(); renderInbox(); refresh(opts); }
