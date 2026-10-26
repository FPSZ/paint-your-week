/* ================= synthesized sounds ================= */
// sine mallets, a little filtered noise and one shared compressor, all in C major pentatonic:
// the charge climbs the scale faster and faster, and the paint lands on the chord it was climbing toward.
// every function takes the AudioContext and a start time, so they also render offline.
const hz = m => 440 * 2 ** ((m - 69) / 12);
const BUS = new WeakMap(), NOISE = new WeakMap();
export function bus(a) {
  let g = BUS.get(a);
  if (!g) {
    const c = a.createDynamicsCompressor();
    c.threshold.value = -16; c.knee.value = 12; c.ratio.value = 3.5; c.attack.value = .004; c.release.value = .2;
    g = a.createGain(); g.connect(c); c.connect(a.destination); BUS.set(a, g);
  }
  return g;
}
function noise(a) {
  let b = NOISE.get(a);
  if (!b) { b = a.createBuffer(1, a.sampleRate, a.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; NOISE.set(a, b); }
  return b;
}
// one struck partial: a 3ms attack, then an exponential ring-out
function ring(a, out, f, t, vol, dec, detune = 0, type = 'sine') {
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.value = f; o.detune.value = detune;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .003); g.gain.setTargetAtTime(0, t + .003, dec / 4);
  o.connect(g); g.connect(out); o.start(t); o.stop(t + dec * 1.3 + .05);
  return o;
}
// a soft mallet: the note plus a brief overtone for the strike
function mallet(a, out, m, t, vol, dec = .2) {
  const f = hz(m);
  return [ring(a, out, f, t, vol, dec), ring(a, out, f * 4, t, vol * .14, .035)];
}
function hiss(a, out, t, dur, type, f0, f1, q = 1) {
  const s = a.createBufferSource(); s.buffer = noise(a); s.loop = true;
  const fl = a.createBiquadFilter(); fl.type = type; fl.Q.value = q; fl.frequency.setValueAtTime(f0, t); if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = a.createGain(); g.gain.value = 0; s.connect(fl); fl.connect(g); g.connect(out);
  s.start(t, Math.random() * .5); s.stop(t + dur + .05);
  return { s, g };
}

/* paints in quick succession step up the scale, like a combo */
const STEPS = [0, 2, 4, 5, 7, 9];
let streak = 0, lastPaint = -1e9;
export function paintKey(take) {
  const now = performance.now(), s = now - lastPaint < 8000 ? streak : 0;
  if (take) { streak = Math.min(s + 1, STEPS.length - 1); lastPaint = now; }
  return STEPS[s];
}

/* charge: mallet notes up the pentatonic scale, closer and closer together, over an airy riser */
const PENTA = [67, 69, 72, 74, 76, 79, 81, 84, 86, 88, 91, 93, 96]; // G4 … C7
export function chargeSound(a, t, T, key = 0) {
  const out = a.createGain(); out.connect(bus(a));
  const src = [];
  for (let at = 0, gap = .11, i = 0; at < T - .02 && i < PENTA.length; at += gap, gap = Math.max(.04, gap * .86), i++) {
    const p = at / T;
    src.push(...mallet(a, out, PENTA[i] + key, t + at, .02 + .01 * p, .16 + .1 * p));
  }
  const r = hiss(a, out, t, T, 'bandpass', 700, 5200, 1.4);
  r.g.gain.setValueAtTime(0, t); r.g.gain.linearRampToValueAtTime(.018, t + T);
  src.push(r.s);
  return {
    stop(full) {
      const n = a.currentTime;
      out.gain.cancelScheduledValues(n); out.gain.setValueAtTime(out.gain.value, n);
      out.gain.linearRampToValueAtTime(0, n + (full ? .04 : .12));
      for (const s of src) try { s.stop(n + .16); } catch (e) {}
      // let go early: a soft two-note sigh back down
      if (!full) { mallet(a, bus(a), 76 + key, n + .01, .026, .14); mallet(a, bus(a), 72 + key, n + .1, .02, .22); }
    },
  };
}

/* paint: a low thump and a short splash under a strummed major chord that rings out, sparkles on top */
export function paintSound(a, t, key = 0, big = false) {
  const out = bus(a), dec = big ? 1.7 : 1.15;
  const th = a.createOscillator(), tg = a.createGain();
  th.frequency.setValueAtTime(150, t); th.frequency.exponentialRampToValueAtTime(42, t + .2);
  tg.gain.setValueAtTime(0, t); tg.gain.linearRampToValueAtTime(.32, t + .006); tg.gain.setTargetAtTime(0, t + .006, .06);
  th.connect(tg); tg.connect(out); th.start(t); th.stop(t + .45);
  const sp = hiss(a, out, t, .2, 'bandpass', 1800, 0, .9); sp.g.gain.setValueAtTime(.09, t); sp.g.gain.setTargetAtTime(0, t, .028);
  const air = hiss(a, out, t, .7, 'highpass', 7000, 0, .5); air.g.gain.setValueAtTime(.022, t); air.g.gain.setTargetAtTime(0, t, .15);
  [60, 72, 76, 79, 84].forEach((m, i) => {
    const at = t + i * .014, f = hz(m + key), v = i ? .042 : .05;
    ring(a, out, f, at, v, dec); ring(a, out, f, at, v * .5, dec, 7); ring(a, out, f * 2, at, v * .2, .35);
  });
  (big ? [91, 96, 100, 103, 108] : [91, 96, 100]).forEach((m, i) => mallet(a, out, m + key, t + .07 + i * .05, .024, .32));
}

/* settle: the biggest paint, then the old fanfare on top: an arpeggio up, a held chord, a run of sparkles */
export function settleSound(a, t) {
  const out = bus(a);
  paintSound(a, t, 0, true);
  [72, 76, 79, 84].forEach((m, i) => ring(a, out, hz(m), t + .14 + i * .085, .05, .6, 0, 'triangle'));
  [84, 88, 91].forEach(m => ring(a, out, hz(m), t + .5, .03, 1.5));
  [96, 100, 103, 100, 105].forEach((m, i) => mallet(a, out, m, t + .82 + i * .055, .02, .26));
}
