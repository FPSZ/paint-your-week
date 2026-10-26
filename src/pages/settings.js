import { $, $$, REDUCED, SPRING, pad } from '../core/utils.js';
import { CHRONO } from '../core/domain.js';
import { S, ST, W, commit, normCore, normWeek, saveLocal, snap, undo } from '../core/state.js';
import { Sync } from '../core/sync.js';
import { blockEls } from '../week/dom.js';
import { buildGrid } from '../week/grid.js';
import { refresh, renderAll } from '../week/refresh.js';
import { applyTemplate, copyPrevWeek } from '../week/templates.js';
import { M, closeModal, mBody, openModal } from '../ui/modal.js';
import { openScience } from './science.js';
import { chime } from '../fx/fx.js';
import { toast } from '../ui/toast.js';
import { THEMES, setTheme, themePref } from '../ui/theme.js';
import { clearTimetable, openImport } from './import.js';
import { openShortcuts } from '../ui/shortcuts.js';

/* ----- settings ----- */
export function openSettings() {
  const st = ST();
  const opts = (from, to, cur) => { let o = ''; for (let h = from; h <= to; h++) o += `<option value="${h}" ${h === cur ? 'selected' : ''}>${pad(h)}:00</option>`; return o; };
  const seg = (key, items, cur) => `<div class="seg" data-set="${key}">${items.map(([k, n]) => `<button class="${cur === k ? 'on' : ''}" data-v="${k}">${n}</button>`).join('')}</div>`;
  const html = `<p class="m-eyebrow">SETTINGS</p><h2 class="m-title">设置</h2>
  <h3 class="set-g">外观</h3>
  <div class="set-row"><div><h4>主题</h4><p>只对这台设备生效</p></div><div class="seg">${Object.keys(THEMES).map(k => `<button class="${themePref === k ? 'on' : ''}" data-tv="${k}">${THEMES[k]}</button>`).join('')}</div></div>
  <div class="set-row"><div><h4>网格密度</h4></div>${seg('density', [['compact', '紧凑'], ['std', '标准'], ['roomy', '宽松']], st.density)}</div>
  <div class="set-row"><div><h4>完成音效</h4></div>${seg('sound', [['1', '开'], ['0', '关']], st.sound ? '1' : '0')}</div>
  <h3 class="set-g">时间</h3>
  <div class="set-row"><div><h4>作息类型</h4><p>决定金色高能时段的位置</p></div>${seg('chrono', Object.keys(CHRONO).map(k => [k, CHRONO[k]]), st.chrono)}</div>
  <div class="set-row"><div><h4>显示时段</h4></div><div class="set-time"><label class="sr" for="setStart">开始</label><select id="setStart">${opts(4, 10, st.startH)}</select><span>→</span><label class="sr" for="setEnd">结束</label><select id="setEnd">${opts(18, 24, st.endH)}</select></div></div>
  <h3 class="set-g">数据</h3>
  <div class="set-row"><div><h4>课表</h4><p>五邑大学教务系统</p></div><div class="set-acts"><button class="btn soft" data-x="jw">导入</button><button class="btn ghost danger" data-x="jwclear">移除导入的课</button></div></div>
  <div class="set-row"><div><h4>本周</h4><p>模板只填空档</p></div><div class="set-acts"><button class="btn soft" data-x="tpl">套用模板</button><button class="btn soft" data-x="copy">复制上周</button><button class="btn ghost danger" data-x="clear">清空</button></div></div>
  <div class="set-row set-backup"><div><h4>备份</h4></div><div class="set-acts"><button class="btn soft" data-x="export">复制全部数据</button><button class="btn ghost" data-x="import">从备份恢复</button></div>
    <textarea class="data-box" id="dataBox" placeholder="粘贴备份，再点「从备份恢复」" aria-label="备份数据" hidden></textarea></div>
  <h3 class="set-g">帮助</h3>
  <div class="set-row"><div><h4>快捷操作</h4><p>随时按 ? 打开</p></div><button class="btn ghost" data-x="keys">查看</button></div>
  <div class="set-row"><div><h4>设计依据</h4><p>13 项研究</p></div><button class="btn ghost" data-x="sci">查看</button></div>`;
  openModal('settings', html);
  const setNum = (k, v) => { snap(); ST()[k] = v; commit('core'); buildGrid(); blockEls.forEach(e => e.remove()); blockEls.clear(); refresh({ enter: true }); };
  $('#setStart').addEventListener('change', e => { const v = +e.target.value; if (v >= ST().endH - 6) { toast('显示时段至少要 6 小时'); e.target.value = ST().startH; return; } setNum('startH', v); });
  $('#setEnd').addEventListener('change', e => { const v = +e.target.value; if (v <= ST().startH + 6) { toast('显示时段至少要 6 小时'); e.target.value = ST().endH; return; } setNum('endH', v); });
}

export function setup() {
  mBody.addEventListener('click', e => {
    if (M !== 'settings') return;
    const tv = e.target.closest('[data-tv]'); if (tv) { setTheme(tv.dataset.tv, tv); return; }
    const sb = e.target.closest('.seg button');
    if (sb) {
      const key = sb.closest('.seg').dataset.set; const v = sb.dataset.v;
      $$('button', sb.parentNode).forEach(x => x.classList.toggle('on', x === sb));
      snap(); ST()[key] = key === 'sound' ? v === '1' : v; commit('core');
      if (key !== 'sound') { buildGrid(); blockEls.forEach(x => x.remove()); blockEls.clear(); refresh({ enter: true }); }
      else if (ST().sound) chime('done');
      return;
    }
    const x = e.target.closest('[data-x]'); if (!x) return;
    const k = x.dataset.x;
    if (k === 'tpl') { closeModal(); applyTemplate(); }
    if (k === 'copy') { closeModal(); copyPrevWeek(); }
    if (k === 'jw') { closeModal(); setTimeout(openImport, 200); }
    if (k === 'keys') { closeModal(); setTimeout(openShortcuts, 200); }
    if (k === 'sci') { closeModal(); setTimeout(() => openScience(), 200); }
    if (k === 'jwclear') {
      if (!x.dataset.armed) { x.dataset.armed = '1'; x.textContent = '再点一次确认移除'; setTimeout(() => { if (x.isConnected) { delete x.dataset.armed; x.textContent = '移除导入的课'; } }, 3000); return; }
      const n = clearTimetable(); closeModal(); toast(n ? `已移除 ${n} 节导入的课` : '这台设备上没有导入的课');
    }
    if (k === 'clear') {
      if (!x.dataset.armed) { x.dataset.armed = '1'; x.textContent = '再点一次确认清空'; setTimeout(() => { if (x.isConnected) { delete x.dataset.armed; x.textContent = '清空本周'; } }, 3000); return; }
      snap(); W().blocks = []; commit('week'); closeModal(); refresh(); toast('本周已清空', { action: { label: '撤销', fn: undo } });
    }
    if (k === 'export') {
      const txt = JSON.stringify(S); const box = $('#dataBox'); box.hidden = false; box.value = txt;
      const ok = () => toast('已复制全部数据');
      const fail = () => { box.focus(); box.select(); toast('已放进下方文本框，按 Ctrl/⌘ + C 复制'); };
      try { navigator.clipboard.writeText(txt).then(ok, fail); } catch (er) { fail(); }
    }
    if (k === 'import') {
      const box = $('#dataBox'); if (box.hidden) { box.hidden = false; box.value = ''; box.focus(); if (!REDUCED.matches) box.animate([{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: SPRING }); return; }
      const raw = box.value.trim(); if (!raw) { toast('先把备份粘贴到文本框里'); box.focus(); return; }
      try {
        const o = JSON.parse(raw); if (!o || !o.core || !o.weeks) throw new Error('bad');
        snap(); S.core = normCore(o.core); S.weeks = {}; for (const wk in o.weeks) S.weeks[wk] = normWeek(o.weeks[wk]);
        const t = Date.now(); S.core.updatedAt = t; Sync.dirty('core'); for (const wk in S.weeks) { S.weeks[wk].updatedAt = t; Sync.dirty(wk); }
        saveLocal(); buildGrid(); closeModal(); blockEls.forEach(e2 => e2.remove()); blockEls.clear(); renderAll({ enter: true }); toast('已从备份恢复');
      } catch (er) { toast('这段内容不是有效的备份，请检查是否完整复制'); }
    }
  });
}
