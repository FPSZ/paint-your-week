import { $, I, esc, toM } from '../core/utils.js';
import { kOf, mondayOf, parseK, today } from '../core/domain.js';
import { S, W, commit } from '../core/state.js';
import { Sync } from '../core/sync.js';
import { blockEls } from '../week/dom.js';
import { refresh } from '../week/refresh.js';
import { closeModal, openModal } from '../ui/modal.js';
import { burst, chime } from '../fx/fx.js';
import { toast } from '../ui/toast.js';

/* ================= timetable import: 五邑大学教务系统 (jxgl.wyu.edu.cn) ================= */
// Runs as a bookmarklet on jxgl.wyu.edu.cn (never in this page): reads the whole semester and copies it.
export async function jwGrab() {
  const post = async (u, b) => (await fetch(u, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest' }, body: b })).json();
  if (!/(^|\.)jxgl\.wyu\.edu\.cn$/.test(location.hostname)) { alert('请先打开五邑大学教务系统（jxgl.wyu.edu.cn）并登录，再点这个书签'); return; }
  try {
    const now = new Date();
    const m = await post('/new/curMonthXnxq', 'month=' + now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0'));
    const x = m && m.data && m.data[0] && m.data[0].xnxqdm;
    if (!x) { alert('这个月不在学期里，教务系统没有返回课表'); return; }
    const cal = await post('/new/desktop/queryXnxqrl', 'xnxqdm=' + x);
    const ds = cal.data.map(d => d.rq).sort();
    const ev = await post('/new/desktop/getCalendar', 'd1=' + ds[0] + '+00%3A00%3A00&d2=' + ds[ds.length - 1] + '+23%3A59%3A59');
    const out = { v: 1, src: 'wyu-jxgl', xnxqdm: x, from: ds[0], to: ds[ds.length - 1], ev: ev.filter(e => e.lx === 'kb').map(e => ({ id: e.dm, d: e.qsrq, s: e.qssj, e: e.jssj, n: e.kcmc, t: e.jxhjmc, l: e.jxcdmc, p: e.teaxms, k: e.sknrjj || '' })) };
    const txt = JSON.stringify(out);
    try { await navigator.clipboard.writeText(txt); alert('已复制 ' + out.ev.length + ' 节课。回到涂色周历，在「导入课表」里粘贴。'); }
    catch (e) {
      const t = document.createElement('textarea'); t.value = txt;
      t.style.cssText = 'position:fixed;left:10%;top:10%;width:80%;height:60%;z-index:2147483647;font:12px monospace';
      document.body.appendChild(t); t.focus(); t.select();
      alert('浏览器没让自动复制：课表已经选中，按 Ctrl+C 复制，然后刷新这个页面');
    }
  } catch (e) { alert('没读到课表：请确认已经登录教务系统'); }
}
export let JW_BOOKMARKLET;
export function parseTimetable(text) {
  let o; try { o = JSON.parse(String(text || '').trim()); } catch (e) { return null; }
  let ev = null;
  if (o && Array.isArray(o.ev)) ev = o.ev;
  else if (Array.isArray(o)) ev = o.filter(e => e && (!e.lx || e.lx === 'kb')).map(e => ({ id: e.dm, d: e.qsrq, s: e.qssj, e: e.jssj, n: e.kcmc, t: e.jxhjmc, l: e.jxcdmc, p: e.teaxms, k: e.sknrjj || '' }));
  if (!ev) return null;
  ev = ev.filter(e => e && /^\d{4}-\d{2}-\d{2}$/.test(e.d) && /^\d{1,2}:\d{2}/.test(e.s) && /^\d{1,2}:\d{2}/.test(e.e) && e.n);
  if (!ev.length) return null;
  const ds = ev.map(e => e.d).sort();
  return { ev, from: o.from || ds[0], to: o.to || ds[ds.length - 1] };
}
export function jwBlocks(ev, includePast) {
  const t = today(); const by = {};
  for (const e of ev) {
    const date = parseK(e.d); const wk = kOf(mondayOf(date));
    if (!includePast && wk < t.wk) continue;
    const s = toM(e.s.slice(0, 5)), en = toM(e.e.slice(0, 5));
    if (!(en > s)) continue;
    const kind = e.t && e.t !== '讲课' ? e.t : '';
    const q = [e.l, e.p, e.k].filter(Boolean).join(' · ').slice(0, 140);
    (by[wk] = by[wk] || []).push({
      id: ('jw' + (e.id || '') + e.d + e.s.slice(0, 5)).replace(/[^0-9a-z]/gi, ''),
      d: (date.getDay() + 6) % 7, s, e: en,
      t: kind && kind !== '体育' ? `${e.n}（${kind}）` : e.n,
      c: /体育/.test(e.n) || kind === '体育' ? 'move' : 'learn',
      q, g: null, done: false, src: 'jw',
    });
  }
  return by;
}
export async function pullWeeks(wks) {
  if (!Sync.store) return;
  for (const wk of wks) { try { await Sync.pull(wk); } catch (e) {} }
}
export async function importTimetable(parsed, includePast) {
  const by = jwBlocks(parsed.ev, includePast); const wks = Object.keys(by).sort();
  if (!wks.length) return { n: 0, weeks: 0 };
  await pullWeeks(wks);
  let n = 0;
  for (const wk of wks) {
    const w = W(wk);
    const done = new Set(w.blocks.filter(b => b.src === 'jw' && b.done).map(b => b.id));
    w.blocks = w.blocks.filter(b => b.src !== 'jw' && !(b.t === '课程 / 固定安排' && !b.done));
    for (const b of by[wk]) { if (done.has(b.id)) b.done = true; w.blocks.push(b); n++; }
    commit(wk);
  }
  blockEls.forEach(x => x.remove()); blockEls.clear(); refresh({ enter: true });
  return { n, weeks: wks.length, wks };
}
export function clearTimetable(wks) {
  let n = 0;
  for (const wk of (wks || Object.keys(S.weeks))) {
    const w = S.weeks[wk]; if (!w) continue;
    const before = w.blocks.length; w.blocks = w.blocks.filter(b => b.src !== 'jw');
    if (w.blocks.length !== before) { n += before - w.blocks.length; commit(wk); }
  }
  refresh({ flip: true });
  return n;
}
export function openImport() {
  const html = `<p class="m-eyebrow">TIMETABLE · 五邑大学教务系统</p><h2 class="m-title">导入课表</h2>
  <p class="m-sub">按真实日期排进每一周，节假日已扣掉。重复导入会覆盖之前导入的课。</p>
  <ol class="steps">
    <li class="step"><span class="sn">1</span><div><h4>把这个按钮拖到书签栏</h4><p>只需要做一次。按住它拖到浏览器顶部的书签栏；看不到书签栏就按 Ctrl+Shift+B。</p><div class="row"><a class="bm-link" id="jwBm" href="${esc(JW_BOOKMARKLET)}" draggable="true">复制五邑课表</a></div></div></li>
    <li class="step"><span class="sn">2</span><div><h4>登录教务系统，点一下这个书签</h4><p>在教务系统登录后的任意页面点它，会提示「已复制 N 节课」。</p><div class="row"><a class="btn soft" href="https://jxgl.wyu.edu.cn/new/welcome.page?ui=new" target="_blank" rel="noopener">打开教务系统</a></div></div></li>
    <li class="step"><span class="sn">3</span><div><h4>粘贴到这里</h4>
      <label class="sr" for="jwBox">课表数据</label><textarea class="data-box" id="jwBox" placeholder="Ctrl+V 粘贴刚复制的课表"></textarea>
      <div class="jw-preview" id="jwPreview"></div>
      <label class="jw-past"><input type="checkbox" id="jwPast"> 也导入已经过去的周</label></div></li>
  </ol>
  <div class="big-cta"><button class="btn ghost" data-close>取消</button><button class="btn solid big" id="jwGo" disabled>导入到周历</button></div>`;
  openModal('import', html, { wide: true });
  const box = $('#jwBox'), pv = $('#jwPreview'), go = $('#jwGo'), past = $('#jwPast');
  let parsed = null;
  const update = () => {
    if (!box.value.trim()) { parsed = null; pv.innerHTML = ''; go.disabled = true; return; }
    parsed = parseTimetable(box.value);
    if (!parsed) { pv.innerHTML = '<span class="bad">没认出课表数据。请用第 1 步的书签重新复制，再完整粘贴。</span>'; go.disabled = true; return; }
    const by = jwBlocks(parsed.ev, past.checked);
    const n = Object.values(by).reduce((a, b) => a + b.length, 0);
    const courses = [...new Set(parsed.ev.map(e => e.n))];
    pv.innerHTML = `识别到 <b>${courses.length}</b> 门课、<b>${parsed.ev.length}</b> 节（${esc(parsed.from)} – ${esc(parsed.to)}）。` +
      (n ? `将导入 <b>${n}</b> 节，分布在 <b>${Object.keys(by).length}</b> 周。` : '这些课都已经过去了；勾选下面的选项才会导入。') +
      `<span class="jw-courses">${courses.map(c => `<i>${esc(c)}</i>`).join('')}</span>`;
    go.disabled = !n;
  };
  box.addEventListener('input', update); past.addEventListener('change', update);
  $('#jwBm').addEventListener('click', e => { e.preventDefault(); toast('把它拖到书签栏，然后在教务系统里点它'); });
  go.addEventListener('click', async () => {
    if (!parsed) return;
    go.disabled = true; go.textContent = '导入中…';
    const r = await importTimetable(parsed, past.checked);
    closeModal();
    const gr = $('#ringWrap').getBoundingClientRect();
    burst(gr.left + gr.width / 2, gr.top + gr.height / 2, 40, 1.1, ['var(--c-learn)', 'var(--c-deep)', 'var(--c-move)']); chime('big');
    toast(`已导入 ${r.n} 节课，分布在 ${r.weeks} 周`, { icon: I.spark, ms: 5000, action: { label: '撤销', fn: () => { const k = clearTimetable(r.wks); toast(`已移除 ${k} 节导入的课`); } } });
  });
}

export function setup() {
  JW_BOOKMARKLET = 'javascript:' + encodeURIComponent('(' + jwGrab.toString() + ')()');
}
