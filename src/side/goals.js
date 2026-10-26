import { $, $$, I, esc, fmtH } from '../core/utils.js';
import { GOAL_C } from '../core/domain.js';
import { W, commit, snap } from '../core/state.js';
import { renderBlocks } from '../week/blocks.js';
import { celebrate } from '../fx/fx.js';
import { toast } from '../ui/toast.js';

/* ================= goals ================= */
export const goalsEl = $('#goals');
export function renderGoals() {
  const w = W();
  goalsEl.innerHTML = w.goals.map((g, i) => `
    <li class="goal ${g.done ? 'done' : ''}" data-gid="${g.id}" style="--g:${GOAL_C[i]}">
      <div class="goal-row">
        <button class="g-chk" type="button" aria-label="${g.done ? '取消完成' : '标记这件大事完成'}"><svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="8.5"/><path d="M6.2 10.4l2.6 2.6 5-5.4"/></svg></button>
        <label class="sr" for="g-${g.id}">大事 ${i + 1}</label>
        <input class="g-in" id="g-${g.id}" value="${esc(g.t)}" placeholder="${['这周必须推进的一件事', '第二件重要的事', '第三件（可以是生活上的）'][i]}" maxlength="50">
        <button class="g-more" type="button" aria-label="展开障碍与对策">${I.down}</button>
      </div>
      <div class="g-prog"><div class="g-bar"><i></i></div><span class="g-num"></span></div>
      <div class="g-woop"><div>
        <label for="go-${g.id}">最可能挡住我的障碍</label>
        <input id="go-${g.id}" data-f="obs" value="${esc(g.obs)}" placeholder="例如：晚上一刷手机就停不下来" maxlength="60">
        <label for="gp-${g.id}">如果它出现，我就…</label>
        <input id="gp-${g.id}" data-f="plan" value="${esc(g.plan)}" placeholder="例如：把手机放进书包，先写 10 分钟" maxlength="60">
      </div></div>
    </li>`).join('');
  updateGoalProgress();
}
export function updateGoalProgress() {
  const w = W();
  $$('.goal', goalsEl).forEach(li => {
    const g = w.goals.find(x => x.id === li.dataset.gid); if (!g) return;
    let p = 0, d = 0; w.blocks.forEach(b => { if (b.g === g.id) { p += b.e - b.s; if (b.done) d += b.e - b.s; } });
    $('.g-bar i', li).style.width = p ? `${d / p * 100}%` : '0%';
    $('.g-num', li).textContent = p ? `${fmtH(d)}/${fmtH(p)}h` : '';
    $('.g-prog', li).hidden = !p;
    li.classList.toggle('done', !!g.done);
  });
}

export function setup() {
  goalsEl.addEventListener('input', e => {
    const li = e.target.closest('.goal'); if (!li) return; const g = W().goals.find(x => x.id === li.dataset.gid); if (!g) return;
    if (e.target.classList.contains('g-in')) g.t = e.target.value; else if (e.target.dataset.f) g[e.target.dataset.f] = e.target.value;
    commit('week'); clearTimeout(goalsEl.t); goalsEl.t = setTimeout(() => { renderBlocks(); updateGoalProgress(); }, 400);
  });
  goalsEl.addEventListener('click', e => {
    const li = e.target.closest('.goal'); if (!li) return; const g = W().goals.find(x => x.id === li.dataset.gid); if (!g) return;
    if (e.target.closest('.g-more')) { li.classList.toggle('open'); return; }
    if (e.target.closest('.g-chk')) {
      if (!g.t.trim()) { $('.g-in', li).focus(); return; }
      snap(); g.done = !g.done; commit('week'); updateGoalProgress();
      if (g.done) { const r = $('.g-chk', li).getBoundingClientRect(); celebrate(r.left + r.width / 2, r.top + r.height / 2, li.style.getPropertyValue('--g'), 'big'); toast(`大事达成：${g.t}`, { icon: I.spark }); }
    }
  });
  goalsEl.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') e.target.blur(); });
}
