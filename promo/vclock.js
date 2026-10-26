// Virtual clock for frame-exact recording. Injected into every document before its own scripts run.
// Time only moves when the recorder calls __advance(ms): timers, requestAnimationFrame, performance.now/Date,
// and every CSS/Web animation in the document are stepped together, so each captured frame is exact.
(() => {
  if (window.__vclock) return;
  const RealDate = Date, realRAF = window.requestAnimationFrame.bind(window);
  const base = +(new URLSearchParams(location.search).get('t0') || window.top.__vclockBase || 0) || RealDate.now();
  let vt = 0, tid = 1, rid = 1;
  const timers = new Map(), rafs = new Map(), anims = new Map();

  performance.now = () => vt;
  class VDate extends RealDate { constructor(...a) { if (a.length) super(...a); else super(base + vt); } static now() { return base + vt; } }
  window.Date = VDate;
  window.setTimeout = (fn, ms = 0, ...args) => { const id = tid++; timers.set(id, { at: vt + Math.max(0, +ms || 0), fn, args }); return id; };
  window.setInterval = (fn, ms = 0, ...args) => { const every = Math.max(1, +ms || 0), id = tid++; timers.set(id, { at: vt + every, fn, args, every }); return id; };
  window.clearTimeout = window.clearInterval = id => { timers.delete(id); };
  window.requestAnimationFrame = fn => { const id = rid++; rafs.set(id, fn); return id; };
  window.cancelAnimationFrame = id => { rafs.delete(id); };
  window.requestIdleCallback = fn => window.setTimeout(() => fn({ didTimeout: false, timeRemaining: () => 12 }), 1);
  window.cancelIdleCallback = id => window.clearTimeout(id);

  const run = (fn, args) => { try { typeof fn === 'function' ? fn(...args) : (0, eval)(fn); } catch (e) { console.error('[vclock]', e); } };
  // every animation in the document is paused and placed exactly where virtual time says it should be
  function stepAnimations() {
    for (const a of document.getAnimations()) {
      const ps = a.playState;
      if (ps === 'finished' || ps === 'idle') { anims.delete(a); continue; }
      let st = anims.get(a);
      if (st == null) { if (ps !== 'running') continue; st = vt; anims.set(a, st); } // starts now, in virtual time
      if (ps === 'running') a.pause();
      const ct = a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming() : null;
      const local = (vt - st) * (a.playbackRate || 1);
      if (ct && isFinite(ct.endTime) && local >= ct.endTime) { anims.delete(a); try { a.finish(); } catch (e) { a.currentTime = ct.endTime; } }
      else a.currentTime = Math.max(0, local);
    }
  }
  window.__vclock = {
    now: () => vt,
    // wait for the browser to actually paint (two real frames), so a capture never shows half-rastered tiles
    painted: () => new Promise(r => realRAF(() => realRAF(r))),
    advance(ms) {
      const target = vt + ms;
      for (let guard = 0; guard < 5000; guard++) {
        let id = null, t = null;
        for (const [k, v] of timers) if (v.at <= target && (!t || v.at < t.at || (v.at === t.at && k < id))) { id = k; t = v; }
        if (!t) break;
        vt = Math.max(vt, t.at);
        if (t.every) t.at += t.every; else timers.delete(id);
        run(t.fn, t.args);
        stepAnimations();
      }
      vt = target;
      const cbs = [...rafs.values()]; rafs.clear();
      for (const f of cbs) run(f, [vt]);
      stepAnimations();
      for (const f of document.querySelectorAll('iframe')) { try { f.contentWindow.__vclock && f.contentWindow.__vclock.advance(ms); } catch (e) {} }
    },
  };
})();
