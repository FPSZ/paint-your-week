import { I, uid } from './utils.js';
import { today } from './domain.js';
import { Sync } from './sync.js';
import { buildGrid } from '../week/grid.js';
import { renderGoals } from '../side/goals.js';
import { renderInbox } from '../inbox/list.js';
import { refresh } from '../week/refresh.js';
import { goWeek } from '../week/nav.js';
import { renderMonth } from '../month/month.js';
import { toast } from '../ui/toast.js';

/* ================= state ================= */
export const LS = 'tuse-week-v1', LS_USER = 'tuse-week-user', LS_RECENT = 'tuse-week-recent';
export const CAN_SERVER = !(window.claude && typeof window.claude.use === 'function') && /^https?:$/.test(location.protocol);
export let SERVER = false;
export let USER = '';
export const lsKey = () => USER ? LS + ':' + USER : LS;
export const freshCore = () => ({ settings: { chrono: 'mid', startH: 6, endH: 24, density: 'std', sound: true }, inbox: [], shut: {}, updatedAt: 0 });
export const freshWeek = () => ({ blocks: [], goals: [0, 1, 2].map(() => ({ id: uid(), t: '', done: false, obs: '', plan: '' })), review: { good: '', stuck: '', change: '' }, ritual: {}, updatedAt: 0 });
export function normCore(c) { const f = freshCore(); const o = Object.assign(f, c || {}); o.settings = Object.assign(freshCore().settings, (c && c.settings) || {}); o.inbox = Array.isArray(o.inbox) ? o.inbox : []; o.shut = o.shut || {}; return o; }
export function normWeek(w) { const f = freshWeek(); const o = Object.assign(f, w || {}); o.blocks = Array.isArray(o.blocks) ? o.blocks : []; if (!Array.isArray(o.goals) || o.goals.length !== 3) o.goals = f.goals; o.review = Object.assign(f.review, o.review || {}); o.ritual = o.ritual || {}; return o; }
export function loadLocal() {
  try { const raw = localStorage.getItem(lsKey()); if (raw) { const o = JSON.parse(raw); if (o && o.core && o.weeks) { o.core = normCore(o.core); for (const k in o.weeks) o.weeks[k] = normWeek(o.weeks[k]); return o; } } } catch (e) {}
  return { core: freshCore(), weeks: {} };
}
export let S;
export function saveLocal() { try { localStorage.setItem(lsKey(), JSON.stringify(S)); } catch (e) {} }
export const ST = () => S.core.settings;
export const W = (k = V.wk) => S.weeks[k] || (S.weeks[k] = freshWeek());
export const everUsed = () => Object.values(S.weeks).some(w => w.blocks.length) || S.core.inbox.length > 0;
export const V = { wk: today().wk, sel: today().d, lastCat: 'deep', inCat: 'deep', inEst: 60, dismissed: {}, hourH: 56 };
export let MV = null;
export function locate(id) { for (const wk in S.weeks) { const b = S.weeks[wk].blocks.find(x => x.id === id); if (b) return { wk, w: S.weeks[wk], b }; } return null; }
export const curBlock = id => W().blocks.find(b => b.id === id);
export let undoStack = [], redoStack = [];
export const stateOf = wk => JSON.stringify({ wk, week: S.weeks[wk] || null, core: S.core });
export function snap(wk = V.wk) { undoStack.push(stateOf(wk)); if (undoStack.length > 60) undoStack.shift(); redoStack = []; }
export function restoreState(o) {
  const prevSettings = JSON.stringify(ST());
  S.core = normCore(o.core); if (o.week) S.weeks[o.wk] = normWeek(o.week);
  commit('core', o.wk);
  if (JSON.stringify(ST()) !== prevSettings) buildGrid();
  if (MV) { renderInbox(); renderMonth({ quiet: true }); if (o.wk === V.wk) { renderGoals(); refresh(); } }
  else if (o.wk !== V.wk) goWeek(o.wk); else { renderGoals(); renderInbox(); refresh({ flip: true }); }
}
export function undo() {
  const s = undoStack.pop();
  if (!s) { toast('没有可以撤销的操作'); return; }
  const o = JSON.parse(s); redoStack.push(stateOf(o.wk)); restoreState(o);
  toast('已撤销', { icon: I.undo });
}
export function redo() {
  const s = redoStack.pop();
  if (!s) { toast('没有可以重做的操作'); return; }
  const o = JSON.parse(s); undoStack.push(stateOf(o.wk)); restoreState(o);
  toast('已重做', { icon: I.redo });
}
export function commit(...keys) {
  const t = Date.now();
  for (const k of keys) {
    if (k === 'core') { S.core.updatedAt = t; Sync.dirty('core'); }
    else { const wk = k === 'week' ? V.wk : k; W(wk).updatedAt = t; Sync.dirty(wk); }
  }
  clearTimeout(commit.t); commit.t = setTimeout(saveLocal, 180);
}
export function setSERVER(v) { SERVER = v; return v; }
export function setUSER(v) { USER = v; return v; }
export function setS(v) { S = v; return v; }
export function setMV(v) { MV = v; return v; }
export function setUndoStack(v) { undoStack = v; return v; }
export function setRedoStack(v) { redoStack = v; return v; }

export function setup() {
  if (CAN_SERVER) { try { USER = localStorage.getItem(LS_USER) || ''; } catch (e) {} }
  S = loadLocal();
}
