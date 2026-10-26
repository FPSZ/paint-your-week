import { $, pad } from '../core/utils.js';
import { addD, isoWeek, parseK, shiftWk, today } from '../core/domain.js';
import { MV, V } from '../core/state.js';
import { curYM, parseYM, shiftYM } from '../month/month.js';

/* ================= header ================= */
export function renderHeader() {
  if (MV) {
    const cur = curYM(), f = parseYM(MV.ym), off = MV.ym !== cur;
    const tag = MV.ym === cur ? '本月' : MV.ym === shiftYM(cur, 1) ? '下月' : MV.ym === shiftYM(cur, -1) ? '上月' : '';
    $('#wkNo').textContent = `${f.getMonth() + 1} 月`; $('#wkRange').textContent = String(f.getFullYear());
    const tg = $('#wkTag'); tg.textContent = tag; tg.hidden = !tag;
    $('#wkLabel').classList.toggle('off', off); $('#wkLabel').title = off ? '回到本月' : '';
    $('#wkLabel').setAttribute('aria-label', `${f.getFullYear()} 年 ${f.getMonth() + 1} 月${tag ? '，' + tag : ''}`);
    $('#thisWT').textContent = '回到本月'; $('#wkBack').textContent = '回本月';
    $('#prevW').setAttribute('aria-label', '上个月'); $('#nextW').setAttribute('aria-label', '下个月');
    const tw = $('#thisW'); tw.classList.toggle('show', off); tw.inert = !off;
    return;
  }
  $('#thisWT').textContent = '回到本周'; $('#wkBack').textContent = '回本周';
  $('#prevW').setAttribute('aria-label', '上一周'); $('#nextW').setAttribute('aria-label', '下一周');
  const t = today(); const mon = parseK(V.wk), sun = addD(mon, 6);
  const tag = V.wk === t.wk ? '本周' : V.wk === shiftWk(t.wk, 1) ? '下周' : V.wk === shiftWk(t.wk, -1) ? '上周' : '';
  const off = V.wk !== t.wk;
  $('#wkNo').textContent = `第 ${isoWeek(mon)} 周`;
  const tg = $('#wkTag'); tg.textContent = tag; tg.hidden = !tag;
  $('#wkLabel').classList.toggle('off', off); $('#wkLabel').title = off ? '回到本周' : '';
  $('#wkRange').textContent = `${mon.getMonth() + 1}.${pad(mon.getDate())} – ${sun.getMonth() + 1}.${pad(sun.getDate())}`;
  $('#wkLabel').setAttribute('aria-label', `第 ${isoWeek(mon)} 周，${mon.getMonth() + 1} 月 ${mon.getDate()} 日到 ${sun.getMonth() + 1} 月 ${sun.getDate()} 日${tag ? '，' + tag : ''}`);
  const tw = $('#thisW'); tw.classList.toggle('show', off); tw.inert = !off;
}
