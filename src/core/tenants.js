import { $ } from './utils.js';
import { CAT_IDS } from './domain.js';
import { LS_RECENT, SERVER, USER } from './state.js';

/* ================= tenants (server deployment): switch by username, no password ================= */
export const USER_RE = /^[0-9a-z_\-.一-鿿]{1,24}$/;
export const normUser = raw => { const u = String(raw || '').normalize('NFC').trim().toLowerCase(); return USER_RE.test(u) ? u : null; };
export const loadRecent = () => { try { const a = JSON.parse(localStorage.getItem(LS_RECENT) || '[]'); return Array.isArray(a) ? a.filter(x => typeof x === 'string' && USER_RE.test(x)).slice(0, 8) : []; } catch (e) { return []; } };
export const addRecent = n => { try { localStorage.setItem(LS_RECENT, JSON.stringify([n, ...loadRecent().filter(x => x !== n)].slice(0, 8))); } catch (e) {} };
export function userHue(n) { let h = 0; for (const ch of n) h = (h * 31 + ch.codePointAt(0)) >>> 0; return CAT_IDS[h % CAT_IDS.length]; }
export function renderUserChip() {
  const b = $('#userBtn'); b.hidden = !SERVER; if (!SERVER) return;
  const av = $('#userAv'); const nm = $('#userName');
  if (USER) { av.textContent = [...USER][0].toUpperCase(); av.style.setProperty('--ua', `var(--c-${userHue(USER)})`); nm.textContent = USER; b.title = '切换用户'; }
  else { av.textContent = '?'; av.style.setProperty('--ua', 'var(--muted)'); nm.textContent = '选择用户'; }
}
export async function pingApi() {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 4000);
  try { const r = await fetch(new URL('api/ping', location.href).href, { cache: 'no-store', signal: ac.signal }); if (!r.ok) return false; const j = await r.json(); return !!(j && j.ok); }
  catch (e) { return false; } finally { clearTimeout(t); }
}
