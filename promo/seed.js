// Demo data for the promo: a student's October. "Today" is Wednesday 2026-10-28, evening;
// four of today's blocks are still unpainted so the video can paint them.
let seed = 11; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
const pad = n => String(n).padStart(2, '0');
const kOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const T = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };

// [day, start, end, title, category, extra]
const THIS_WEEK = [
  [0, '08:30', '09:00', '背单词', 'learn'], [0, '10:00', '11:35', '数据结构', 'learn', { src: 'jw' }], [0, '12:00', '13:00', '午饭', 'life'],
  [0, '14:00', '16:00', '论文第三章', 'deep', { g: 0 }], [0, '16:30', '17:00', '回复邮件', 'admin'], [0, '17:30', '18:30', '健身', 'move', { g: 2 }], [0, '19:00', '20:30', '算法刷题', 'learn', { g: 1 }],
  [1, '08:00', '09:35', '大学英语', 'learn', { src: 'jw' }], [1, '10:00', '12:00', '论文第三章', 'deep', { g: 0 }], [1, '12:00', '13:00', '午饭', 'life'],
  [1, '14:30', '16:05', '概率论', 'learn', { src: 'jw' }], [1, '16:30', '17:30', '社团例会', 'fun'], [1, '19:30', '21:00', '算法刷题', 'learn', { g: 1 }],
  [2, '08:30', '09:00', '背单词', 'learn'], [2, '10:00', '11:35', '电子技术基础', 'learn', { src: 'jw' }], [2, '12:00', '13:00', '午饭', 'life'],
  [2, '14:00', '16:00', '论文第三章', 'deep', { g: 0, todo: 1 }], [2, '16:30', '17:30', '跑步', 'move', { g: 2, todo: 1 }], [2, '18:00', '18:45', '晚饭', 'life', { todo: 1 }], [2, '19:00', '20:30', '算法刷题', 'learn', { g: 1, todo: 1 }],
  [3, '08:00', '09:35', '大学物理', 'learn', { src: 'jw' }], [3, '12:00', '13:00', '午饭', 'life'], [3, '14:00', '16:00', '论文第三章', 'deep', { g: 0 }],
  [3, '16:30', '17:30', '组会', 'admin'], [3, '19:00', '20:30', '算法刷题', 'learn', { g: 1 }],
  [4, '10:00', '11:35', '数据结构', 'learn', { src: 'jw' }], [4, '12:00', '13:00', '午饭', 'life'], [4, '14:00', '16:00', '论文第三章', 'deep', { g: 0 }], [4, '16:30', '17:30', '跑步', 'move', { g: 2 }], [4, '19:30', '21:30', '电影之夜', 'fun'],
  [5, '09:30', '11:30', '论文修改', 'deep', { g: 0 }], [5, '14:00', '17:00', '和朋友爬山', 'fun'],
  [6, '10:00', '11:00', '游泳', 'move'], [6, '20:00', '20:45', '周复盘', 'admin'],
];
// earlier weeks: a looser version of the same rhythm
const ROUTINE = [
  [0, '08:30', '09:00', '背单词', 'learn'], [0, '10:00', '11:35', '数据结构', 'learn', { src: 'jw' }], [0, '12:00', '13:00', '午饭', 'life'], [0, '14:00', '16:00', '论文', 'deep', { g: 0 }], [0, '17:30', '18:30', '健身', 'move', { g: 2 }], [0, '19:00', '20:30', '算法刷题', 'learn', { g: 1 }],
  [1, '08:00', '09:35', '大学英语', 'learn', { src: 'jw' }], [1, '10:00', '12:00', '论文', 'deep', { g: 0 }], [1, '12:00', '13:00', '午饭', 'life'], [1, '14:30', '16:05', '概率论', 'learn', { src: 'jw' }], [1, '16:30', '17:30', '社团例会', 'fun'],
  [2, '08:30', '09:00', '背单词', 'learn'], [2, '10:00', '11:35', '电子技术基础', 'learn', { src: 'jw' }], [2, '12:00', '13:00', '午饭', 'life'], [2, '14:00', '16:00', '论文', 'deep', { g: 0 }], [2, '16:30', '17:30', '跑步', 'move', { g: 2 }], [2, '19:00', '20:30', '算法刷题', 'learn', { g: 1 }],
  [3, '08:00', '09:35', '大学物理', 'learn', { src: 'jw' }], [3, '12:00', '13:00', '午饭', 'life'], [3, '14:00', '16:00', '实验报告', 'deep'], [3, '16:30', '17:30', '组会', 'admin'],
  [4, '10:00', '11:35', '数据结构', 'learn', { src: 'jw' }], [4, '12:00', '13:00', '午饭', 'life'], [4, '14:00', '16:00', '论文', 'deep', { g: 0 }], [4, '16:30', '17:30', '跑步', 'move', { g: 2 }],
  [5, '09:30', '11:30', '论文修改', 'deep'], [5, '15:00', '17:30', '和朋友逛街', 'fun'],
  [6, '10:00', '11:00', '游泳', 'move'], [6, '20:00', '20:45', '周复盘', 'admin'],
];
const GOALS = [['论文第三章初稿', '刷完 40 道算法题', '每周跑步 3 次'], ['完成实验报告', '刷完 30 道算法题', '健身 3 次'], ['论文开题', '英语听力 5 份', '每周跑步 3 次']];

export function demoData() {
  const weeks = {}, shut = {}, settled = {};
  const mondayThis = new Date(2026, 9, 26);
  for (let w = 8; w >= 0; w--) {
    const mon = new Date(mondayThis); mon.setDate(mon.getDate() - 7 * w);
    const wk = kOf(mon), gid = [0, 1, 2].map(i => `g${w}_${i}`), rate = [0, .9, .78, .86, .7, .82, .74, .8, .66][w];
    const rows = w === 0 ? THIS_WEEK : ROUTINE;
    const blocks = rows.filter(r => w === 0 || rnd() < .93).map(([d, s, e, t, c, x = {}], i) => {
      const past = w > 0 || d < 2 || (d === 2 && !x.todo);
      const b = { id: `b${w}_${i}`, d, s: T(s), e: T(e), t, c, q: '', g: x.g != null ? gid[x.g] : null, done: w === 0 ? past : rnd() < rate };
      if (x.src) b.src = x.src;
      return b;
    });
    const names = GOALS[w % 3];
    weeks[wk] = { blocks, goals: names.map((t, i) => ({ id: gid[i], t, done: w > 0 && rnd() < .55, obs: '', plan: '' })), review: { good: '', stuck: '', change: '' }, ritual: {}, updatedAt: 1 };
    for (let d = 0; d < 7; d++) { const x = new Date(mon); x.setDate(x.getDate() + d); if ((w > 0 || d < 2) && rnd() < .72) shut[kOf(x)] = 1; }
  }
  return { core: { settings: { chrono: 'mid', startH: 7, endH: 23, density: 'std', sound: false }, inbox: [], shut, settled, updatedAt: 1 }, weeks };
}
// the moment the app believes it is
export const NOW = new Date(2026, 9, 28, 21, 15).getTime();
