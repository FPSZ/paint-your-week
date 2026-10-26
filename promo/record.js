// Records the promo frame by frame: node promo/record.js [--from 0 --to 55 --dpr 1.5 --out promo/out/video.mp4]
// Needs a fresh `npm run build` (dist/) and the fonts in .cache/fonts (copied into dist/fonts).
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { demoData, NOW } from './seed.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const FROM = +arg('from', 0) * 1000, TO = +arg('to', 999) * 1000, DPR = +arg('dpr', 1.5);
const OUTF = path.resolve(ROOT, arg('out', 'promo/out/video.mp4'));
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const FPS = 60, DT = 1000 / FPS, BEAT = 500;
fs.mkdirSync(path.dirname(OUTF), { recursive: true });
fs.cpSync(path.join(ROOT, '.cache/fonts'), path.join(ROOT, 'dist/fonts'), { recursive: true });

/* ---------- static server for the repo (dist/ + promo/) ---------- */
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.json': 'application/json' };
const server = http.createServer((q, r) => {
  let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); r.end(d); });
}).listen(0, '127.0.0.1');
await new Promise(r => server.once('listening', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

/* ---------- browser ---------- */
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--hide-scrollbars', '--force-color-profile=srgb', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'], defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: DPR } });
const page = await browser.newPage();
page.on('pageerror', e => console.error('pageerror:', e.message));
page.on('console', m => { if (m.type() === 'error') console.error('console:', m.text()); });
await page.evaluateOnNewDocument(fs.readFileSync(path.join(import.meta.dirname, 'vclock.js'), 'utf8'));
const cdp = await page.createCDPSession();
await page.goto(BASE + '/promo/stage.html');
await page.evaluate((data, now) => {
  localStorage.clear();
  localStorage.setItem('tuse-week-v1', JSON.stringify(data)); localStorage.setItem('tuse-week-theme', 'light');
  localStorage.setItem('tuse-week-tip-cancel', '1'); localStorage.setItem('tuse-week-tip-alt', '1');
  window.__vclockBase = now;
}, demoData(), NOW);
await page.evaluate(() => S.load('/dist/index.html'));
const CAPS = '拖一下就是一段时间想到就写拖进去就排好做完一块涂一块难的事放进高能时段一个月一幅画今天全部涂满每周复盘每月月报涂色周历把一周排成时间块做完一块就把它涂上颜色免费开源可自部署读两篇论文给导师回邮件健身';
await page.evaluate(c => S.warmFonts(c), CAPS);

/* ---------- frame loop ---------- */
const ff = spawn(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
  '-vf', 'scale=1920:1080:flags=lanczos', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', OUTF], { stdio: ['pipe', 'inherit', 'inherit'] });
const events = []; const log = (type, extra = {}) => events.push({ t: +(T / 1000).toFixed(3), type, ...extra });
let T = 0, frames = 0, pos = { x: 1560, y: 1010 }, mv = null, down = false;
const ev = (fn, ...a) => page.evaluate(fn, ...a);
const ease = { out: k => 1 - Math.pow(1 - k, 3), inOut: k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2, human: k => 1 - Math.pow(1 - k, 2.6) };
async function frame() {
  if (mv) {
    const k = Math.min(1, (T - mv.t0) / mv.dur), e = mv.ease(k);
    let to = mv.to; if (typeof to === 'function') { try { to = await to(); } catch (e) { to = null; } }
    if (!to) to = { ...pos }; // the target is gone: stay where we are
    const mx = (mv.from.x + to.x) / 2, my = (mv.from.y + to.y) / 2, dx = to.x - mv.from.x, dy = to.y - mv.from.y;
    const cx = mx - dy * mv.bend, cy = my + dx * mv.bend; // quadratic bezier with a slight arc, like a hand
    pos = { x: (1 - e) ** 2 * mv.from.x + 2 * (1 - e) * e * cx + e * e * to.x, y: (1 - e) ** 2 * mv.from.y + 2 * (1 - e) * e * cy + e * e * to.y };
    // once there, keep following the target (it moves when the camera does) until the next move
    if (k >= 1) { mv.from = { ...pos }; mv.t0 = T - mv.dur; }
    if (!mv || pos.x !== mv.lx || pos.y !== mv.ly) { if (mv) { mv.lx = pos.x; mv.ly = pos.y; } await ev(p => S.cursor(p.x, p.y), pos);
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: pos.x, y: pos.y, button: down ? 'left' : 'none', buttons: down ? 1 : 0 }); }
  }
  await ev(dt => window.__vclock.advance(dt), DT);
  if (T >= TO) throw STOP;
  if (T >= FROM) {
    await ev(() => Promise.all([window.__vclock.painted(), document.getElementById('app').contentWindow.__vclock.painted()]));
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 92 });
    if (!ff.stdin.write(Buffer.from(data, 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
    frames++;
    if (frames % 120 === 0) process.stdout.write(`\r${(T / 1000).toFixed(1)}s  ${frames} frames`);
  }
  T += DT;
}
const at = async s => { while (T < s * 1000 - 0.01) await frame(); };
const wait = async s => at(T / 1000 + s);
const pt = (sel, text, fx = .5, fy = .5) => async () => { const p = await ev((s, t, a, b) => S.pt(s, t, a, b), sel, text, fx, fy); return p ? { x: p[0], y: p[1] } : null; };
const cell = (d, minute, fx = .5) => async () => { const p = await ev((d, m, fx) => { const r = S.minuteY(d, m); return S.appPt(r.x - r.w / 2 + r.w * fx, r.y); }, d, minute, fx); return { x: p[0], y: p[1] }; };
async function move(to, dur = .7, { e = ease.human, bend = .08 } = {}) { mv = { t0: T, dur: dur * 1000, from: { ...pos }, to, ease: e, bend }; await wait(dur); }
async function press() { down = true; await ev(() => S.press(true)); await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: pos.x, y: pos.y, button: 'left', buttons: 1, clickCount: 1 }); }
async function release() { down = false; await ev(() => S.press(false)); await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: pos.x, y: pos.y, button: 'left', buttons: 0, clickCount: 1 }); }
async function click(color, kind = 'click') { await press(); await ev((p, c) => S.ripple(p.x, p.y, c), pos, color || '#6C5CFF'); log(kind); await wait(.07); await release(); }
async function type(text, cps = 13) { for (const ch of text) { await cdp.send('Input.insertText', { text: ch }); log('key'); await wait(1 / cps); } }
async function key(k, code, vk) { await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: vk, text: k === 'Enter' ? '\r' : undefined }); await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk }); log('key'); }
const appRect = (sel, text) => ev((s, t) => S.rect(s, t), sel, text);
const union = (...rs) => { rs = rs.filter(Boolean); const x = Math.min(...rs.map(r => r.x)), y = Math.min(...rs.map(r => r.y)), X = Math.max(...rs.map(r => r.x + r.width)), Y = Math.max(...rs.map(r => r.y + r.height)); return { x, y, width: X - x, height: Y - y }; };
const span = async (d0, d1, m0, m1) => { const a = await appRect(`.col[data-d="${d0}"]`), b = await appRect(`.col[data-d="${d1}"]`), t = await ev((d, m) => S.minuteY(d, m).y, d0, m0), u = await ev((d, m) => S.minuteY(d, m).y, d0, m1); return { x: a.x, y: t, width: b.x + b.width - a.x, height: u - t }; };
const focus = (r, o = {}) => ev((r, o) => S.focus(r, o), r, o);
const cap = (text, sub, o) => { log('caption'); return ev((t, s, o) => S.caption(t, s, o), text, sub, o || {}); };
const capOut = () => ev(() => S.captionOut());

/* ---------- pre-roll: let the app boot, then frame the morning ---------- */
for (let i = 0; i < 150; i++) await ev(dt => window.__vclock.advance(dt), DT);
await ev(() => S.scrollGrid(S.gridTopFor(8 * 60 - 20)));

const STOP = Symbol('stop');
async function film() {
/* ================= the film (120 bpm; 1 beat = 0.5 s) ================= */
// S0 · logo on the beat
await ev(() => S.card(`<div><div class="logo4"><i style="background:#3C5CFF;color:#3C5CFF"></i><i style="background:#FFB21A;color:#FFB21A"></i><i style="background:#FF3B6B;color:#FF3B6B"></i><i class="t4" style="background:transparent;color:#22C993;box-shadow:inset 0 0 0 4px #CBC8DA"></i></div><h1 class="t-cn">${[...'涂色周历'].map(c => `<span class="ch">${c}</span>`).join('')}</h1><p class="t-en">Paint Your Week</p><p class="t-sub">把一周排成时间块，做完一块，就把它涂上颜色</p></div>`));
await ev(() => { document.querySelectorAll('.logo4 i, .t-cn .ch, .t-en, .t-sub').forEach(e => e.style.opacity = 0); });
for (let i = 0; i < 4; i++) {
  await at(.5 + i * .5); log('tile', { i });
  await ev(i => { const e = document.querySelectorAll('.logo4 i')[i]; e.style.opacity = 1; e.animate([{ transform: 'translateY(-420px) rotate(-38deg) scale(.6)' }, { transform: 'none' }], { duration: 700, easing: S.SPRING }); S.beat(.35); }, i);
}
await at(2.5); log('fill');
await ev(() => { const t = document.querySelector('.logo4 .t4'); t.animate([{ background: 'transparent', boxShadow: 'inset 0 0 0 4px #CBC8DA', transform: 'scale(1)' }, { background: '#22C993', boxShadow: '0 18px 40px -18px #22C993', transform: 'scale(1.18)', offset: .55 }, { background: '#22C993', boxShadow: '0 18px 40px -18px #22C993', transform: 'none' }], { duration: 620, easing: 'cubic-bezier(.3,1.4,.5,1)', fill: 'forwards' }); const r = t.getBoundingClientRect(); S.sparks(r.left + r.width / 2, r.top + r.height / 2, 34); document.querySelectorAll('.t-cn .ch').forEach((c, i) => { c.style.opacity = 1; c.animate([{ opacity: 0, transform: 'translateY(60px) scale(.7)', filter: 'blur(12px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }], { duration: 800, delay: 120 + i * 70, easing: S.SPRING, fill: 'backwards' }); }); });
await at(3.0); await ev(() => { for (const s of ['.t-en', '.t-sub']) { const e = document.querySelector(s); e.style.opacity = 1; e.animate([{ opacity: 0, transform: 'translateY(18px)' }, { opacity: 1, transform: 'none' }], { duration: 600, delay: s === '.t-sub' ? 180 : 0, easing: S.OUT, fill: 'backwards' }); } });
await at(3.75); log('whoosh');
await ev(() => { const c = document.getElementById('card'); c.animate([{ opacity: 1, transform: 'none', filter: 'blur(0)' }, { opacity: 0, transform: 'scale(1.12)', filter: 'blur(16px)' }], { duration: 420, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards' }).onfinish = () => S.card(''); });

// S1 · drag to make a block
await at(4.0); log('impact'); await ev(() => { S.winIn(); S.beat(.5); });
await cap('拖一下，*就是一段时间*', 'Drag to block out your time');
await at(5.0); await ev(() => S.cursorShow(true)); await focus(await span(2, 5, 16 * 60 + 15, 20 * 60 + 15), { pad: 20, dur: 1000 });
await move(cell(3, 17 * 60 + 47, .3), .8);
await at(6.0); await press(); log('down');
await move(cell(3, 19 * 60 - 3, .34), .9, { e: ease.inOut, bend: .02 });
await wait(.12); await release(); log('drop');
await wait(.15); { const b = await appRect('.col[data-d="3"] .blk.editing') || await appRect('.col[data-d="3"] .blk', '新的'); const p = await appRect('#pop'); await focus(union(b, p), { pad: 30, dur: 800, max: 1.5 }); }
await at(7.2); await type('健身', 8);
await at(8.0); await move(pt('.cchip[data-c="move"]'), .45); await click('#22C993');
await at(8.75); await move(pt('#edDone'), .5); await click('#6C5CFF');
await at(9.5); await capOut(); await ev(() => S.home(700));

// S2 · capture, then drag into place (snaps to the block above)
await at(10.0); await cap('想到就写，*拖进去就排好*', 'Capture now, schedule in one drag', { a: '#8B5CFF', b: '#FF3B6B' }); await ev(() => S.beat(.4));
{ const r = await span(4, 4, 12 * 60 + 20, 13 * 60 + 40); const fab = await appRect('#ibxFab'); await focus(union(r, { x: fab.x + fab.width - 340, y: fab.y + fab.height - 440, width: 340, height: 440 }), { pad: 24, dur: 900, max: 1.65 }); }
await move(pt('#ibxFab'), .7); await at(10.9); await click('#8B5CFF');
await at(11.2); await type('读两篇论文 90min', 14); await key('Enter', 'Enter', 13);
await at(12.5); await move(pt('#inCats .cat-dot[data-c="admin"]'), .35); await click('#FFB21A');
await at(12.95); await type('给导师回邮件 20min', 15); await key('Enter', 'Enter', 13);
await at(14.1); await move(pt('#inList .task', '给导师回邮件', .3, .5), .5);
await at(14.5); await press(); log('down');
await move(cell(4, 13 * 60 + 7, .3), 1.0, { e: ease.inOut, bend: -.06 });
await wait(.2); await release(); log('drop');
await at(15.7); await capOut();

// S3 · paint, paint, paint
await at(16.0); await cap('做完一块，*涂一块*', 'Finish it. Paint it.', { a: '#FF3B6B', b: '#FF8A3D', dim: true }); await ev(() => S.beat(.5));
{ const a = await appRect('.col[data-d="0"]'), b = await appRect('.col[data-d="2"]'), top = await ev(() => S.minuteY(2, 13 * 60 + 40).y), bot = await ev(() => S.minuteY(2, 20 * 60 + 50).y);
  await ev(r => S.focus(r, { pad: 30, dur: 900 }), { x: a.x - 20, y: top, width: b.x + b.width - a.x + 40, height: bot - top }); }
const paints = ['论文第三章', '跑步', '晚饭', '算法刷题'], beats = [17.0, 17.75, 18.5, 19.25];
for (let i = 0; i < 4; i++) {
  const sel = `.col[data-d="2"] .blk`;
  await move(async () => { const p = await ev(t => { const b = [...S.find('.col[data-d="2"]').querySelectorAll('.blk')].find(x => x.querySelector('.bt').textContent.includes(t)); const r = b.querySelector('.chk').getBoundingClientRect(); return S.toStage(r.left + r.width / 2, r.top + r.height / 2); }, paints[i]); return { x: p[0], y: p[1] }; }, i ? .5 : .65);
  await at(beats[i]); await click(['#3C5CFF', '#22C993', '#FF3B6B', '#8B5CFF'][i], 'paint');
}
await at(20.0); await ev(() => S.home(900)); await move(pt('#now', null, .5, .35), 1.0);
await at(21.5); await capOut();

// S4 · deep work lands in the peak hours
await at(22.0); await cap('难的事，*放进高能时段*', 'Hard things go to your peak hours', { a: '#FFB21A', b: '#FF8A3D' }); await ev(() => S.beat(.4));
await focus(await appRect('#ibxPanel'), { pad: 60, dur: 800, max: 1.6 });
await move(pt('#inList .task', '读两篇论文', .9, .5), .7);
await at(22.95); await move(async () => { const p = await ev(() => { const li = S.find('#inList .task', '读两篇论文'); const b = li.querySelector('.t-auto'); const r = b.getBoundingClientRect(); return S.toStage(r.left + r.width / 2, r.top + r.height / 2); }); return { x: p[0], y: p[1] }; }, .25);
await at(23.25); await click('#FFB21A', 'magic');
await wait(.35);
{ const g = await appRect('#gutter'), c = await appRect('.col[data-d="4"]'), top = await ev(() => S.minuteY(3, 8 * 60 + 30).y), bot = await ev(() => S.minuteY(3, 12 * 60 + 40).y);
  await ev(r => S.focus(r, { pad: 26, dur: 1000 }), { x: g.x, y: top, width: c.x + c.width - g.x, height: bot - top }); }
await at(25.5); await capOut(); await ev(() => S.home(700));

// S5 · the month as one painting
await at(26.0); await cap('一个月，*一幅画*', 'Your month, painted', { a: '#22C993', b: '#3C5CFF' }); await ev(() => S.beat(.45));
await move(pt('#vsw [data-v="month"]'), .55); await at(26.75); await click('#22C993', 'switch');
await at(27.4); { const r = await appRect('#mvCal'); await ev(r => S.focus(r, { pad: 10, dur: 1100, max: 1.2 }), r); }
await move(pt('.mv-day[data-k="2026-10-07"]'), .9); await wait(.25);
await move(pt('.mv-day[data-k="2026-10-15"]'), .7); await wait(.2);
await move(pt('.mv-day[data-k="2026-10-21"]'), .7);
await at(30.9); await capOut(); await ev(() => S.home(700));

// S6 · settle the day
await at(31.5); await move(pt('#vsw [data-v="week"]'), .45); await at(32.0); await click('#3C5CFF', 'switch');
await at(32.5); await cap('今天，*全部涂满*', 'Settle the day — and celebrate', { a: '#3C5CFF', b: '#FF3B6B', dim: true });
{ const r = await appRect('#now'); await ev(r => S.focus(r, { pad: 70, dur: 900, max: 1.65 }), r); }
await move(pt('#now [data-act="settle"]'), .8);
await at(34.0); await capOut(); await click('#FFFFFF', 'settle');
await ev(() => S.focus({ x: 0, y: 0, width: 1440, height: 900 }, { pad: 0, dur: 600, capSpace: false, max: 1.333, ease: S.OUT }));
await wait(.6); { const r = await appRect('#stCard'); await focus({ x: r.x - 300, y: r.y - 140, width: r.width + 600, height: r.height + 230 }, { pad: 0, dur: 1400, capSpace: false, max: 1.75 }); }
await ev(() => S.cursorShow(false, 200));
await at(39.6); await ev(() => S.cursorShow(true, 200)); await move(pt('#stClaim'), .4);
await at(40.0); await click('#8B5CFF', 'claim');
await at(40.8); await ev(() => S.home(900));

// S7 · reviews that feel like rewards
await at(42.0); await cap('每周复盘 · *每月月报*', 'Reviews that feel like rewards', { a: '#8B5CFF', b: '#3C5CFF' }); await ev(() => S.beat(.4));
await move(pt('#vsw [data-v="month"]'), .5); await at(42.5); await click('#8B5CFF', 'switch');
await move(pt('#mvReport'), .55); await at(43.25); await click('#8B5CFF', 'switch');
await wait(.3); { const r = await appRect('#rvBody'); await focus({ x: r.x, y: 70, width: r.width, height: 640 }, { pad: 40, dur: 900, max: 1.45 }); }
await ev(() => S.cursorShow(false, 200));
{ const t0 = 44.0, t1 = 47.0; await at(t0); const maxS = await ev(() => { const rv = S.find('#rv'); return rv.scrollHeight - rv.clientHeight; }); const goal = Math.min(maxS, 2100);
  while (T < t1 * 1000) { const k = (T - t0 * 1000) / ((t1 - t0) * 1000); const e = ease.inOut(Math.min(1, k)); await ev(v => { S.find('#rv').scrollTop = v; }, goal * e); await frame(); } }
await at(47.2); await capOut(); await key('Escape', 'Escape', 27);

// S8 · outro
await at(47.6); log('whoosh'); await ev(() => S.winOut(650));
await at(48.0); log('impact');
await ev(() => S.card(`<div><div class="logo4"><i style="background:#3C5CFF;color:#3C5CFF"></i><i style="background:#FFB21A;color:#FFB21A"></i><i style="background:#FF3B6B;color:#FF3B6B"></i><i style="background:#22C993;color:#22C993"></i></div><h1 class="t-cn">${[...'涂色周历'].map(c => `<span class="ch">${c}</span>`).join('')}</h1><p class="t-en">Paint Your Week</p><div class="t-row"><span style="--c:#22C993"><b></b>免费</span><span style="--c:#3C5CFF"><b></b>开源</span><span style="--c:#FF3B6B"><b></b>可自部署</span></div><p class="t-url">github.com/FPSZ/paint-your-week</p></div>`));
await ev(() => { document.querySelectorAll('.logo4 i, .t-cn .ch, .t-en, .t-row span, .t-url').forEach(e => e.style.opacity = 0); });
for (let i = 0; i < 4; i++) { await at(48.0 + i * .25); log('tile', { i }); await ev(i => { const e = document.querySelectorAll('.logo4 i')[i]; e.style.opacity = 1; e.animate([{ transform: 'scale(0) rotate(-90deg)' }, { transform: 'none' }], { duration: 650, easing: S.SPRING }); }, i); }
await at(49.0); log('fill'); await ev(() => { const l = document.querySelector('.logo4').getBoundingClientRect(); S.sparks(l.left + l.width / 2, l.top + l.height / 2, 44, undefined, 1.3); S.beat(.5); document.querySelectorAll('.t-cn .ch').forEach((c, i) => { c.style.opacity = 1; c.animate([{ opacity: 0, transform: 'translateY(60px) scale(.7)', filter: 'blur(12px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }], { duration: 800, delay: i * 70, easing: S.SPRING, fill: 'backwards' }); }); });
await at(49.6); await ev(() => { const e = document.querySelector('.t-en'); e.style.opacity = 1; e.animate([{ opacity: 0, transform: 'translateY(18px)' }, { opacity: 1, transform: 'none' }], { duration: 600, easing: S.OUT, fill: 'backwards' }); });
for (let i = 0; i < 3; i++) { await at(50.0 + i * .25); log('pop', { i }); await ev(i => { const e = document.querySelectorAll('.t-row span')[i]; e.style.opacity = 1; e.animate([{ opacity: 0, transform: 'translateY(20px) scale(.8)' }, { opacity: 1, transform: 'none' }], { duration: 600, easing: S.SPRING, fill: 'backwards' }); }, i); }
await at(51.0); await ev(() => { const e = document.querySelector('.t-url'); e.style.opacity = 1; e.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 700, easing: S.OUT, fill: 'backwards' }); });
await at(54.0); log('end'); await ev(() => document.body.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 1000, easing: 'ease-in', fill: 'forwards' }));
await at(55.0);
}

try { await film(); } catch (e) { if (e !== STOP) console.error('\n', e); }
/* ---------- done ---------- */
ff.stdin.end(); await new Promise(r => ff.on('close', r));
fs.writeFileSync(path.join(path.dirname(OUTF), 'events.json'), JSON.stringify({ fps: FPS, bpm: 120, duration: T / 1000, events }, null, 1));
console.log(`\n${frames} frames → ${path.relative(ROOT, OUTF)}`);
await browser.close(); server.close();
