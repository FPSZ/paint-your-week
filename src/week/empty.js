import { $ } from '../core/utils.js';
import { CAT_IDS, cv, shiftWk } from '../core/domain.js';
import { S, V, W, everUsed } from '../core/state.js';
import { applyTemplate, copyPrevWeek } from './templates.js';
import { toast } from '../ui/toast.js';
import { openImport } from '../pages/import.js';

/* ================= empty state ================= */
export const emptyEl = $('#empty');
export function renderEmpty() {
  const w = W(); const show = w.blocks.length === 0 && !V.dismissed[V.wk];
  if (!show) { emptyEl.hidden = true; emptyEl.innerHTML = ''; return; }
  const key = `${V.wk}|${everUsed()}`; if (!emptyEl.hidden && emptyEl.dataset.k === key) return;
  emptyEl.dataset.k = key;
  const prev = S.weeks[shiftWk(V.wk, -1)]; const canCopy = prev && prev.blocks.length > 0;
  const first = !everUsed();
  emptyEl.innerHTML = `<div class="empty-card">
    <div class="empty-swatch">${CAT_IDS.map(c => `<i style="${cv(c)}"></i>`).join('')}</div>
    <h2>${first ? '把这一周涂满颜色' : '这一周还空着'}</h2>
    <p>${first ? '做完一件，点一下圆圈，它就被涂满颜色。' : '沿用上周，或者从模板开始。'}</p>
    <div class="empty-acts">
      ${canCopy ? '<button class="btn solid" data-e="copy">复制上周的安排</button>' : ''}
      <button class="btn ${canCopy ? 'soft' : 'solid'}" data-e="tpl">套用高效模板</button>
      <button class="btn soft" data-e="jw">导入课表</button>
      <button class="btn ghost" data-e="blank">从空白开始</button>
    </div>
  </div>`;
  emptyEl.hidden = false;
}

export function setup() {
  emptyEl.addEventListener('click', e => {
    const b = e.target.closest('[data-e]'); if (!b) return;
    if (b.dataset.e === 'copy') copyPrevWeek();
    if (b.dataset.e === 'tpl') applyTemplate();
    if (b.dataset.e === 'jw') openImport();
    if (b.dataset.e === 'blank') { V.dismissed[V.wk] = 1; renderEmpty(); toast('在网格上拖出时间块'); }
  });
}
