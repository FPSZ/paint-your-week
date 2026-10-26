import { $, REDUCED, esc } from '../core/utils.js';
import { shiftWk, today } from '../core/domain.js';
import { MV, S, V } from '../core/state.js';
import { openModal } from '../ui/modal.js';
import { openPlan, openShutdown } from './rituals.js';
import { openReview } from './review.js';
import { curYM, monthTotals, shiftYM } from '../month/month.js';
import { openMonthReport } from './monthReport.js';
import { openSettings } from './settings.js';

/* ----- science ----- */
export const SCI = [
  { k: 'block', h: '时间块：先排不可动的，再给大事整块时间', f: '把一周拆成具体的时间块。先放睡眠、三餐、课程等固定项，再把最重要的工作放进大块空档，并给意外留出空白。', u: '整张周网格；周计划第 3–5 步；每天表头的「留白」提示。', r: 'Stanford Center for Teaching and Learning. Weekly Planning: Time Blocking Method. · Newport, C. (2020). The Time-Block Planner. Portfolio.' },
  { k: 'ii', h: '实施意图：写清「何时、何地、如果…就…」', f: '综合 94 项独立检验的元分析：形成「如果遇到情境 X，就做 Y」的具体计划，对目标达成有中到大的效应（d = 0.65）。', u: '每个时间块都有具体时间和「如果…就…」触发情境；把待办拖进某个时间，本身就是在形成实施意图。', r: 'Gollwitzer, P. M., & Sheeran, P. (2006). Implementation intentions and goal achievement: A meta-analysis of effects and processes. Advances in Experimental Social Psychology, 38, 69–119.' },
  { k: 'zeig', h: '没安排的事，会在脑子里打转', f: '未完成的目标会带来侵入性念头，拖累手头无关任务的表现。只要为它写下具体计划，这些干扰效应就会消失。', u: '「待安排」收件箱：想到就丢进来，再拖进时间格；收工仪式里的「清空大脑」。', r: 'Masicampo, E. J., & Baumeister, R. F. (2011). Consider it done! Plan making can eliminate the cognitive effects of unfulfilled goals. Journal of Personality and Social Psychology, 101(4), 667–683.' },
  { k: 'goals', h: '具体、有挑战的目标', f: '35 年研究总结：具体且有难度的目标，比「尽力而为」带来更高的绩效（元分析效应量 d ≈ 0.42–0.80），前提是对目标有承诺，并能得到进度反馈。', u: '每周只写「三件大事」；时间块可以关联到大事，进度条自动反馈。', r: 'Locke, E. A., & Latham, G. P. (2002). Building a practically useful theory of goal setting and task motivation: A 35-year odyssey. American Psychologist, 57(9), 705–717.' },
  { k: 'woop', h: '心理对照：先想障碍，再写对策', f: '把想要的结果和现实中的障碍对照，再配上「如果障碍出现，我就…」（MCII / WOOP）。元分析显示对目标达成有小到中等的效应（g = 0.34）。', u: '每件大事都能展开填写「最可能的障碍」和「如果它出现，我就…」。', r: 'Wang, G., Wang, Y., & Gai, X. (2021). A meta-analysis of the effects of mental contrasting with implementation intentions on goal attainment. Frontiers in Psychology, 12, 565202.' },
  { k: 'monitor', h: '记录进度，本身就在推动目标', f: '138 项随机研究（N = 19,951）：促进进度监控的干预提高了目标达成（d = 0.40）；进度被实际记录下来时，效果更强。', u: '做完就勾，方块被涂成饱和色；周进度环、每日进度条和周复盘。', r: 'Harkin, B., Webb, T. L., Chang, B. P. I., et al. (2016). Does monitoring goal progress promote goal attainment? A meta-analysis of the experimental evidence. Psychological Bulletin, 142(2), 198–229.' },
  { k: 'small', h: '小区域假说：前半程看已完成，后半程看还差多少', f: '追求目标的早期，关注「已经完成的部分」更能维持投入；接近目标时，关注「还剩多少」更有动力。', u: '进度环文案在 50% 之前显示「已涂色 X 小时」，过半后切换为「还差 N 块就涂满」。', r: 'Koo, M., & Fishbach, A. (2012). The small-area hypothesis: Effects of progress monitoring on goal adherence. Journal of Consumer Research, 39(3), 493–509.' },
  { k: 'gradient', h: '目标梯度：越接近终点，越想冲刺', f: '离奖励越近，人们行动得越快；看得见的进度会加速投入（咖啡集点卡等现场研究）。', u: '每日进度条；一天「全部涂满」的额外庆祝；周进度 50% 与 100% 的里程碑。', r: 'Kivetz, R., Urminsky, O., & Zheng, Y. (2006). The goal-gradient hypothesis resurrected: Purchase acceleration, illusionary goal progress, and customer retention. Journal of Marketing Research, 43(1), 39–58.' },
  { k: 'fallacy', h: '计划谬误：我们总在低估用时', f: '经典研究中，学生预测完成毕业论文平均需要约 34 天，实际用了约 55 天，只有约三成在自己预测的时间内完成。人对自己的预测尤其乐观。', u: '表头标出留白不足 20% 的日子；复盘用你自己的历史完成量（参考类预测）来建议下周排多少。', r: 'Buehler, R., Griffin, D., & Ross, M. (1994). Exploring the "planning fallacy": Why people underestimate their task completion times. Journal of Personality and Social Psychology, 67(3), 366–381. · Kahneman, D., & Tversky, A. (1979). Intuitive prediction: Biases and corrective procedures. TIMS Studies in Management Science, 12, 313–327.' },
  { k: 'residue', h: '注意力残留：频繁切换会拖慢下一件事', f: '从一件没完成的任务切走后，部分注意力会残留在上一件事上，降低新任务的表现。', u: '专注模式一次只显示一件事；模板把零碎消息集中进「事务批处理」；短于 45 分钟的专注块会提示。', r: 'Leroy, S. (2009). Why is it so hard to do my work? The challenge of attention residue when switching between work tasks. Organizational Behavior and Human Decision Processes, 109(2), 168–181.' },
  { k: 'sync', h: '同步效应：在自己的高峰时段做难事', f: '系统综述（65 项研究）中，约 45% 的成人研究观察到同步效应：在自己生物钟的最佳时段，注意、抑制控制和记忆表现更好。并不存在对所有人都成立的「早上最强」。', u: '按作息类型画出金色能量带；专注块放进低谷会提示；自动排入时优先找高能空档。能量曲线是近似值，最好结合自己的感受调整。', r: 'Chronotype and synchrony effects in human cognitive performance: A systematic review (2025).' },
  { k: 'detach', h: '收工仪式：下班后真正放下', f: '综合 86 篇文献、约 3.8 万名员工的元分析：工作后的心理脱离，与更好的身心健康、状态幸福感和任务表现相关（相关研究，非因果）。', u: '「收工」面板：处理今天剩下的块、清空大脑、看一眼明天，再郑重地点下「收工完毕」。', r: 'Wendsche, J., & Lohmann-Haislah, A. (2017). A meta-analysis on antecedents and outcomes of detachment from work. Frontiers in Psychology, 7, 2072. · Sonnentag, S., & Fritz, C. (2015). Recovery from job stress: The stressor-detachment model as an integrative framework. Journal of Organizational Behavior, 36(S1), S72–S103.' },
  { k: 'rpe', h: '即时反馈与「意料之外」的奖励', f: '多巴胺神经元编码的是「奖赏预测误差」：结果比预期更好时，信号更强。即时、清晰的正反馈，有助于把行为和结果联系起来。', u: '勾选瞬间的涂色、彩屑和音效（每次音高略有不同）；一天全部涂满、整周涂满时的额外庆祝。这里只借用即时反馈的原理，不做断签惩罚之类的成瘾设计。', r: 'Schultz, W., Dayan, P., & Montague, P. R. (1997). A neural substrate of prediction and reward. Science, 275(5306), 1593–1599.' },
];
export function openScience(focusKey) {
  const html = `<p class="m-eyebrow">EVIDENCE · ${SCI.length} 项研究</p><h2 class="m-title">每个设计背后的依据</h2>
  <p class="m-sub">效应量 d / g 是标准化均值差，大约 0.2 为小、0.5 为中、0.8 为大，不等于「成功率提高了百分之几」。</p>
  <ul class="sci">${SCI.map(s => `<li id="sci-${s.k}"><h4>${s.h}</h4><p class="f">${s.f}</p><p class="u"><b>在这里</b>${s.u}</p><p class="r">${esc(s.r)}</p></li>`).join('')}</ul>
  <p class="note">能量曲线、模板时间和「留白 20%」是基于上述研究的实践默认值，不是研究直接给出的数字。按你自己的数据调整，比任何默认值都准。</p>`;
  openModal('sci', html, { wide: true });
  if (focusKey) setTimeout(() => { const li = $('#sci-' + focusKey); if (li) { li.scrollIntoView({ block: 'center', behavior: REDUCED.matches ? 'auto' : 'smooth' }); li.classList.add('flash'); } }, 120);
}

export function setup() {
  document.addEventListener('click', e => { const w = e.target.closest('.why'); if (w) openScience(w.dataset.why); });
  $('#planBtn').addEventListener('click', openPlan);
  $('#shutBtn').addEventListener('click', openShutdown);
  $('#reviewBtn').addEventListener('click', () => { if (MV) { const c = curYM(), p = shiftYM(c, -1); openMonthReport(MV.ym === c && today().now.getDate() <= 3 && monthTotals(p) ? p : MV.ym); return; } const t = today(), pk = shiftWk(t.wk, -1); openReview(V.wk === t.wk && t.d <= 1 && S.weeks[pk] && S.weeks[pk].blocks.length ? pk : V.wk); });
  $('#setBtn').addEventListener('click', openSettings);
  $('#sciBtn').addEventListener('click', () => openScience());
}
