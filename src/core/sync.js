import { $, clone, sleep } from './utils.js';
import { today } from './domain.js';
import { MV, S, SERVER, ST, USER, V, normCore, normWeek, saveLocal } from './state.js';
import { buildGrid } from '../week/grid.js';
import { goalsEl, renderGoals, updateGoalProgress } from '../side/goals.js';
import { renderInbox } from '../inbox/list.js';
import { renderNow } from '../side/now.js';
import { refresh } from '../week/refresh.js';
import { E } from '../week/editor.js';
import { DRAG } from '../week/drag.js';
import { loadMonth, monthChanged } from '../month/month.js';
import { toast } from '../ui/toast.js';

/* ================= sync: claude.ai db (artifact) or this server's tenant API, falling back to this browser ================= */
export const syncEl = $('#sync');
export function setSync(s) {
  const where = SERVER ? `服务器（用户 ${USER}）` : '你的私人云端空间';
  const txt = { local: '', syncing: '', synced: '', error: '未同步' }[s];
  const tip = { local: '数据保存在这台设备的浏览器里', syncing: '正在保存到' + where, synced: '已保存到' + where + '，换设备打开也在', error: '暂时连不上，数据已先存在本机，稍后会重试' }[s];
  syncEl.dataset.s = s; syncEl.title = tip; $('span', syncEl).textContent = txt;
}
export function cloudStore(db, id) {
  const ref = k => db.doc(`data/users/${id}/${k === 'core' ? 'core' : 'w' + k}`);
  return {
    async get(k) { const s = await ref(k).get(); return s.exists ? clone(s.data()) : null; },
    async set(k, data) { await ref(k).set(data); },
    sub(k, next, err) { return ref(k).onSnapshot(s => { if (s.exists && !s.metadata.hasPendingWrites) next(clone(s.data())); }, err); },
  };
}
export function serverStore(user) {
  const base = new URL('api/doc/' + encodeURIComponent(user) + '/', location.href).href;
  const req = async (k, opt = {}) => {
    const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 8000);
    try { return await fetch(base + (k === 'core' ? 'core' : 'w' + k), Object.assign({ cache: 'no-store', signal: ac.signal }, opt)); }
    catch (e) { throw { code: 'unavailable' }; } finally { clearTimeout(t); }
  };
  const fail = r => ({ status: r.status, code: r.status === 429 || r.status === 503 ? 'resource_exhausted' : r.status === 413 || r.status === 507 ? 'quota_exceeded' : 'unavailable' });
  return {
    poll: true,
    async get(k) { const r = await req(k); if (r.status === 404) return null; if (!r.ok) throw fail(r); return (await r.json()).data; },
    async set(k, data) {
      const r = await req(k, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      if (r.status === 409) { const j = await r.json(); throw { code: 'conflict', data: j.data }; }
      if (!r.ok) { let j = null; try { j = await r.json(); } catch (e) {} throw Object.assign(fail(r), { error: j && j.error }); }
    },
  };
}
export let gateAt = 0;
export const gate = async () => { const now = Date.now(); const t = Math.max(now, gateAt + 220); gateAt = t; if (t > now) await sleep(t - now); };
export async function makeStore() {
  if (window.claude && typeof window.claude.use === 'function') {
    const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
    if (!db || !user) return null;
    const id = await user.id(); return id ? cloudStore(db, id) : null;
  }
  return SERVER && USER ? serverStore(USER) : null;
}
export const Sync = {
  store: null, gen: 0, unsub: {}, timers: {}, writing: {}, again: {}, pending: new Set(),
  async init() {
    setSync('local');
    const gen = ++this.gen; let store = null;
    try { store = await makeStore(); } catch (e) { store = null; }
    if (gen !== this.gen || !store) return;
    this.store = store; setSync('syncing');
    try {
      await this.pull('core'); await this.pull(today().wk); if (V.wk !== today().wk) await this.pull(V.wk);
      if (this.store === store) setSync('synced');
    } catch (e) {
      if (e && (e.code === 'unavailable' || e.code === 'resource_exhausted')) setSync('error');
      else { this.store = null; setSync('local'); return; }
    }
    this.watch('core'); this.watch(today().wk); this.watch(V.wk);
    if (MV) loadMonth(MV.ym);
  },
  async stop() {
    Object.values(this.timers).forEach(t => clearTimeout(t)); this.timers = {};
    if (this.store) await Promise.all([...this.pending].map(k => this.push(k).catch(() => {})));
    Object.keys(this.unsub).forEach(k => this.unwatch(k));
    this.store = null; this.gen++; this.pending.clear(); setSync('local');
  },
  local(k) { return k === 'core' ? S.core : S.weeks[k]; },
  apply(k, data) {
    if (k === 'core') { const prev = JSON.stringify(ST()); S.core = normCore(data); if (JSON.stringify(ST()) !== prev) buildGrid(); }
    else S.weeks[k] = normWeek(data);
    saveLocal(); onRemote(k);
  },
  async pull(k) {
    const store = this.store; if (!store) return;
    if (store.poll) await gate();
    const r = await store.get(k);
    if (store !== this.store) return;
    const loc = this.local(k); const lu = +(loc && loc.updatedAt) || 0;
    if (r) { const ru = +r.updatedAt || 0; if (ru > lu) this.apply(k, r); else if (lu > ru) this.push(k); }
    else if (lu > 0) this.push(k);
  },
  async refresh() { if (!this.store || !this.store.poll || DRAG || E) return; try { await this.pull('core'); await this.pull(V.wk); if (V.wk !== today().wk) await this.pull(today().wk); } catch (e) {} },
  watch(k) {
    if (!this.store || !this.store.sub || this.unsub[k]) return;
    try {
      this.unsub[k] = this.store.sub(k, r => {
        const loc = this.local(k);
        if ((+r.updatedAt || 0) > (+(loc && loc.updatedAt) || 0) && !DRAG && !(k === V.wk && E)) this.apply(k, r);
      }, () => { delete this.unsub[k]; });
    } catch (e) {}
  },
  unwatch(k) { const u = this.unsub[k]; if (u) { try { u(); } catch (e) {} delete this.unsub[k]; } },
  dirty(k) { if (!this.store) return; this.pending.add(k); clearTimeout(this.timers[k]); setSync('syncing'); this.timers[k] = setTimeout(() => this.push(k), 900); },
  async push(k) {
    const store = this.store; if (!store) return;
    if (this.writing[k]) { this.again[k] = true; return; }
    const loc = this.local(k); if (!loc) return;
    this.pending.delete(k); clearTimeout(this.timers[k]);
    this.writing[k] = true;
    try { if (store.poll) await gate(); await store.set(k, clone(loc)); if (store === this.store) setSync('synced'); }
    catch (e) {
      const c = e && e.code;
      if (c === 'conflict') { if (store === this.store && e.data) { this.apply(k, e.data); setSync('synced'); } }
      else if (c === 'unavailable' || c === 'resource_exhausted') {
        let ok = false;
        for (let i = 1; i <= 4 && store === this.store && !ok; i++) {
          await sleep((1000 + Math.random() * 1400) * i);
          if (store !== this.store) break;
          try { await gate(); await store.set(k, clone(this.local(k))); ok = true; setSync('synced'); }
          catch (e2) {
            if (e2 && e2.code === 'conflict' && e2.data) { this.apply(k, e2.data); ok = true; setSync('synced'); }
            else if (!(e2 && (e2.code === 'unavailable' || e2.code === 'resource_exhausted'))) break;
          }
        }
        if (!ok && store === this.store) { setSync('error'); this.pending.add(k); }
      } else if (c === 'quota_exceeded') { setSync('error'); toast(e.error === 'too_many_docs' ? '这个用户的数据太多了，新内容先保存在本机' : '服务器空间已满，数据先保存在本机'); }
      else if (e && e.status) { setSync('error'); }
      else if (store === this.store) { this.store = null; setSync('local'); }
    }
    this.writing[k] = false;
    if (this.again[k]) { this.again[k] = false; this.push(k); }
  },
};
export function onRemote(k) {
  monthChanged();
  if (k === 'core') { renderInbox(); refresh(); return; }
  if (k === V.wk) { if (goalsEl.contains(document.activeElement)) updateGoalProgress(); else renderGoals(); refresh({ flip: true }); }
  else if (k === today().wk) renderNow();
}
