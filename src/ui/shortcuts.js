import { IS_MAC } from '../week/drag.js';
import { openModal } from './modal.js';

export function openShortcuts() {
  const C = IS_MAC ? '⌘' : 'Ctrl', A = IS_MAC ? '⌥' : 'Alt';
  const k = (...xs) => xs.map(x => x === '+' ? '+' : `<kbd>${x}</kbd>`).join('');
  const rows = [
    [k(A) + ' + 拖动', '复制方块'],
    ['拖到顶部红区，或按 ' + k('Esc'), '取消拖动，放回原处'],
    ['拖动顶边 / 底边', '改开始 / 结束时间'],
    [k(C, '+', 'C') + ' ' + k(C, '+', 'V'), '复制方块，粘贴到鼠标所在位置'],
    [k('空格'), '涂色或取消'],
    [k('Enter'), '编辑'],
    [k('D'), '复制到明天'],
    [k('Delete'), '删除'],
    [k(C, '+', 'Z'), '撤销'],
    [k(C, '+', '⇧', '+', 'Z'), '重做'],
    [k('M'), '周视图 / 月视图'],
    [k('←') + k('→'), '上一周 / 下一周（月视图里切换月）'],
    [k('T'), '回到今天'],
    [k('N'), '展开待安排，直接输入'],
    ['写报告 90min', '待安排自动识别时长'],
  ];
  openModal('keys', `<p class="m-eyebrow">SHORTCUTS</p><h2 class="m-title">快捷操作</h2><p class="m-sub">方块相关的按键，鼠标停在方块上就能用。</p><dl class="keys">${rows.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('')}</dl>`);
}
