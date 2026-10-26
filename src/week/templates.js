import { toM, uid } from '../core/utils.js';
import { CHRONO, shiftWk } from '../core/domain.js';
import { S, ST, V, W, commit, snap, undo } from '../core/state.js';
import { refresh } from './refresh.js';
import { toast } from '../ui/toast.js';

/* ================= templates ================= */
export const CUE = {
  deep: '如果坐到书桌前，就先关掉手机通知，打开要推进的那份文件',
  admin: '把零碎的消息、邮件、杂事集中在这一块里处理完',
  move: '如果到了这个时间，就直接换鞋出门，不先坐下',
  shut: '如果到了这个时间，就打开收工面板：清点今天、看一眼明天',
  review: '如果到了这个时间，就打开复盘，然后为下周写三件大事',
};
export const TPL = {
  mid: {
    wk: [['07:30', '08:00', '早餐', 'life'], ['09:00', '11:00', '深度专注 · 本周大事', 'deep', CUE.deep], ['11:15', '12:00', '事务批处理：消息与邮件', 'admin', CUE.admin], ['12:00', '13:00', '午饭 + 散步', 'life'], ['14:00', '15:30', '课程 / 固定安排', 'learn'], ['16:00', '16:30', '事务批处理', 'admin'], ['18:30', '19:15', '晚饭', 'life'], ['21:30', '21:45', '收工仪式', 'admin', CUE.shut]],
    mwf: [['17:30', '18:15', '运动', 'move', CUE.move]],
    tt: [['19:30', '21:00', '学习 · 复习与练习', 'learn']],
    sat: [['09:30', '11:30', '深度专注 · 推进大事', 'deep', CUE.deep], ['12:00', '13:00', '午饭', 'life'], ['14:00', '17:00', '朋友 / 户外', 'fun'], ['17:30', '18:15', '运动', 'move', CUE.move]],
    sun: [['10:00', '11:00', '运动', 'move', CUE.move], ['12:00', '13:00', '午饭', 'life'], ['15:00', '17:00', '自由时间', 'fun'], ['20:00', '20:45', '周复盘 + 下周计划', 'admin', CUE.review]],
  },
  lark: {
    wk: [['07:00', '07:30', '早餐', 'life'], ['08:00', '10:00', '深度专注 · 本周大事', 'deep', CUE.deep], ['10:15', '11:00', '事务批处理：消息与邮件', 'admin', CUE.admin], ['12:00', '13:00', '午饭 + 散步', 'life'], ['14:00', '15:30', '课程 / 固定安排', 'learn'], ['16:00', '16:30', '事务批处理', 'admin'], ['18:00', '18:45', '晚饭', 'life'], ['21:00', '21:15', '收工仪式', 'admin', CUE.shut]],
    mwf: [['17:00', '17:45', '运动', 'move', CUE.move]],
    tt: [['19:00', '20:30', '学习 · 复习与练习', 'learn']],
    sat: [['08:30', '10:30', '深度专注 · 推进大事', 'deep', CUE.deep], ['12:00', '13:00', '午饭', 'life'], ['14:00', '17:00', '朋友 / 户外', 'fun'], ['17:00', '17:45', '运动', 'move', CUE.move]],
    sun: [['08:30', '09:30', '运动', 'move', CUE.move], ['12:00', '13:00', '午饭', 'life'], ['15:00', '17:00', '自由时间', 'fun'], ['19:30', '20:15', '周复盘 + 下周计划', 'admin', CUE.review]],
  },
  owl: {
    wk: [['08:30', '09:00', '早餐', 'life'], ['10:00', '12:00', '深度专注 · 本周大事', 'deep', CUE.deep], ['12:15', '13:15', '午饭 + 散步', 'life'], ['14:00', '15:30', '课程 / 固定安排', 'learn'], ['16:00', '16:45', '事务批处理：消息与邮件', 'admin', CUE.admin], ['18:30', '19:15', '晚饭', 'life'], ['22:30', '22:45', '收工仪式', 'admin', CUE.shut]],
    mwf: [['17:30', '18:15', '运动', 'move', CUE.move], ['20:00', '21:30', '深度专注 · 夜间高峰', 'deep', CUE.deep]],
    tt: [['20:00', '21:30', '学习 · 复习与练习', 'learn']],
    sat: [['10:30', '12:30', '深度专注 · 推进大事', 'deep', CUE.deep], ['13:00', '14:00', '午饭', 'life'], ['15:00', '18:00', '朋友 / 户外', 'fun'], ['18:00', '18:45', '运动', 'move', CUE.move]],
    sun: [['11:00', '12:00', '运动', 'move', CUE.move], ['13:00', '14:00', '午饭', 'life'], ['15:30', '17:30', '自由时间', 'fun'], ['20:30', '21:15', '周复盘 + 下周计划', 'admin', CUE.review]],
  },
};
export function templateBlocks(chrono) {
  const T = TPL[chrono] || TPL.mid; const out = [];
  const add = (d, r) => out.push({ id: uid(), d, s: toM(r[0]), e: toM(r[1]), t: r[2], c: r[3], q: r[4] || '', g: null, done: false });
  for (let d = 0; d < 5; d++) { T.wk.forEach(r => add(d, r)); if (d % 2 === 0) T.mwf.forEach(r => add(d, r)); else T.tt.forEach(r => add(d, r)); }
  T.sat.forEach(r => add(5, r)); T.sun.forEach(r => add(6, r));
  return out;
}
export function applyTemplate() {
  snap(); const w = W(); const tb = templateBlocks(ST().chrono);
  w.blocks.push(...tb.filter(b => !w.blocks.some(x => x.d === b.d && x.s < b.e && x.e > b.s)));
  commit('week'); refresh({ enter: true });
  toast(`已套用${CHRONO[ST().chrono]}模板`, { action: { label: '撤销', fn: undo } });
}
export function copyPrevWeek() {
  const prev = S.weeks[shiftWk(V.wk, -1)]; if (!prev || !prev.blocks.length) { toast('上周没有可复制的安排'); return; }
  snap(); const w = W();
  w.blocks.push(...prev.blocks.map(b => ({ ...b, id: uid(), done: false, g: null })).filter(b => !w.blocks.some(x => x.d === b.d && x.s < b.e && x.e > b.s)));
  commit('week'); refresh({ enter: true });
  toast(`已复制上周的 ${prev.blocks.length} 个时间块`, { action: { label: '撤销', fn: undo } });
}
