import { pad } from './utils.js';

/* ================= domain ================= */
export const WD = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
export const CATS = {
  deep:  { n: '专注', full: '深度专注' },
  learn: { n: '学习', full: '学习课程' },
  admin: { n: '事务', full: '事务批处理' },
  move:  { n: '运动', full: '运动健康' },
  life:  { n: '生活', full: '生活休整' },
  fun:   { n: '社交', full: '社交娱乐' },
};
export const CAT_IDS = Object.keys(CATS);
export const SETTLE_TITLES = { deep: '心流大师', learn: '求知者', admin: '清单终结者', move: '活力满格', life: '生活家', fun: '快乐制造机' };
export const cv = c => `--c:var(--c-${c});--on:var(--on-${c})`;
export const GOAL_C = ['var(--c-deep)', 'var(--c-life)', 'var(--c-move)'];
export const ENERGY = {
  lark: [.1,.1,.1,.1,.15,.35,.55,.8,1,1,1,.85,.6,.4,.45,.6,.7,.65,.55,.45,.35,.25,.15,.1],
  mid:  [.1,.1,.1,.1,.1,.15,.25,.4,.6,.85,1,1,.8,.45,.4,.55,.75,.8,.7,.65,.55,.45,.3,.2],
  owl:  [.2,.15,.1,.1,.1,.1,.1,.2,.3,.45,.6,.7,.7,.5,.5,.6,.75,.85,.85,.9,1,1,.9,.7],
};
export const CHRONO = { lark: '早鸟型', mid: '中间型', owl: '夜猫型' };
export const dayStart = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const mondayOf = d => { const x = dayStart(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
export const kOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseK = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
export const addD = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const shiftWk = (k, n) => kOf(addD(parseK(k), 7 * n));
export const isoWeek = d => { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return Math.ceil(((t - y0) / 86400000 + 1) / 7); };
export const today = () => { const n = new Date(); return { wk: kOf(mondayOf(n)), d: (n.getDay() + 6) % 7, m: n.getHours() * 60 + n.getMinutes(), key: kOf(n), now: n }; };
export const dateOf = (wk, d) => addD(parseK(wk), d);
export const md = d => `${d.getMonth() + 1}月${d.getDate()}日`;
