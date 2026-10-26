// Stage for the promo: the app runs in #app (1440×900) inside a window; the recorder drives this API frame by frame.
(() => {
const $ = s => document.querySelector(s);
const SPRING = 'linear(0, .0063, .0255 2.4%, .1022 5.1%, .5361 16%, .7258 21.9%, .8538 27.5%, .9388 33.4%, .9666 36.6%, .9876 40%, 1.0099 46.6%, 1.0151 52.3%, 1.0108 59.6%, 1.0011 77.4%, .9992 90.7%, 1)';
const OUT = 'cubic-bezier(.22,1,.36,1)', INOUT = 'cubic-bezier(.65,0,.35,1)';
const app = $('#app'), cam = $('#cam'), cap = $('#cap'), cur = $('#cursor'), card = $('#card');
const HOME = { x: 355, y: 246, s: .84 };
let CAM = { ...HOME, o: 0 };
const tf = c => `translate(${c.x}px, ${c.y}px) scale(${c.s})`;
cam.style.transform = tf(CAM); cam.style.opacity = 0;
const doc = () => app.contentDocument, win = () => app.contentWindow;

function settle(el, anim, final) { anim.onfinish = () => { Object.assign(el.style, final); anim.cancel(); }; }
const S = window.S = {
  SPRING, OUT, INOUT, HOME,
  load(url) {
    return new Promise(res => {
      app.addEventListener('load', async () => {
        const l = doc().createElement('link'); l.rel = 'stylesheet';
        l.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700;900&display=block';
        doc().head.appendChild(l);
        await new Promise(r => { l.onload = r; l.onerror = r; });
        await Promise.all([document.fonts.ready, doc().fonts.ready]);
        res(true);
      }, { once: true });
      app.src = url;
    });
  },
  // warm every glyph the video will show, so text never pops in late
  async warmFonts(extra) {
    const txt = doc().body.innerText + (extra || '');
    const loads = [];
    for (const w of [400, 500, 700, 900]) { loads.push(doc().fonts.load(`${w} 20px "Noto Sans SC"`, txt)); loads.push(document.fonts.load(`${w} 20px "Noto Sans SC"`, txt)); }
    for (const w of [600, 700, 800]) loads.push(document.fonts.load(`${w} 20px "Bricolage Grotesque"`, 'Paint Your Week github.com/FPSZ/paint-your-week'));
    await Promise.all(loads); await doc().fonts.ready; await document.fonts.ready;
  },
  /* ---- camera ---- */
  cam(to, dur = 900, ease = INOUT) {
    const next = { ...CAM, ...to };
    // zoomed in, the caption gets a frosted band so it never sits on busy UI
    const zoomed = next.s > HOME.s + .05 && next.y < 200, band = $('#band'), bo = +getComputedStyle(band).opacity;
    if ((zoomed ? 1 : 0) !== bo) { const b = band.animate([{ opacity: bo }, { opacity: zoomed ? 1 : 0 }], { duration: dur * .7, easing: OUT, fill: 'forwards' }); settle(band, b, { opacity: zoomed ? 1 : 0 }); }
    const a = cam.animate([{ transform: tf(CAM), opacity: CAM.o }, { transform: tf(next), opacity: next.o }], { duration: dur, easing: ease, fill: 'forwards' });
    settle(cam, a, { transform: tf(next), opacity: next.o }); CAM = next;
  },
  home(dur = 900, ease = INOUT) { S.cam({ ...HOME, o: 1 }, dur, ease); },
  // zoom so an app rect (iframe viewport px) fills the area under the caption
  focus(r, { pad = 40, dur = 900, ease = INOUT, capSpace = true, max = 1.75 } = {}) {
    const area = capSpace ? { x: 70, y: 215, w: 1780, h: 830 } : { x: 50, y: 50, w: 1820, h: 980 };
    const s = Math.min(area.w / (r.width + pad * 2), area.h / (r.height + pad * 2), max);
    let x = area.x + area.w / 2 - (r.x + r.width / 2) * s, y = area.y + area.h / 2 - (44 + r.y + r.height / 2) * s;
    if (1440 * s > 1920) x = Math.min(0, Math.max(1920 - 1440 * s, x));
    if (944 * s > 1080) y = Math.min(0, Math.max(1080 - 944 * s, y));
    S.cam({ x, y, s, o: 1 }, dur, ease);
  },
  winIn(dur = 1100) {
    CAM = { ...HOME, y: HOME.y + 260, s: HOME.s * .9, x: HOME.x + 1440 * HOME.s * .05, o: 0 };
    cam.style.transform = tf(CAM); cam.style.opacity = 0; S.cam({ ...HOME, o: 1 }, dur, SPRING);
  },
  winOut(dur = 700) { S.cam({ x: HOME.x + 1440 * HOME.s * .08, y: HOME.y + 80, s: HOME.s * .84, o: 0 }, dur, 'cubic-bezier(.5,0,.75,0)'); },
  /* ---- app geometry ---- */
  find(sel, text) {
    const all = [...doc().querySelectorAll(sel)];
    return text ? all.find(e => e.textContent.includes(text)) : all[0];
  },
  rect(sel, text) { const e = S.find(sel, text); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; },
  toStage(ax, ay) { const fr = app.getBoundingClientRect(), k = fr.width / 1440; return [fr.left + ax * k, fr.top + ay * k]; },
  pt(sel, text, fx = .5, fy = .5) { const r = S.rect(sel, text); if (!r) return null; return S.toStage(r.x + r.width * fx, r.y + r.height * fy); },
  appPt(ax, ay) { return S.toStage(ax, ay); },
  scrollGrid(top) { const s = doc().getElementById('scroller'); s.scrollTop = top; return s.scrollTop; },
  gridTopFor(minute) { const d = doc(); const hh = parseFloat(getComputedStyle(d.documentElement).getPropertyValue('--hh')); const st = 7 * 60; const cols = d.getElementById('cols'), sc = d.getElementById('scroller'); const base = cols.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop; return base + (minute - st) / 60 * hh - 6; },
  minuteY(d, minute) { const D = doc(); const col = D.querySelector(`.col[data-d="${d}"]`); const r = col.getBoundingClientRect(); const hh = parseFloat(getComputedStyle(D.documentElement).getPropertyValue('--hh')); return { x: r.left + r.width / 2, y: r.top + (minute - 7 * 60) / 60 * hh, w: r.width }; },
  /* ---- cursor ---- */
  cursor(x, y) { cur.style.transform = `translate(${x}px, ${y}px)`; },
  cursorShow(on, dur = 260) { const a = cur.animate([{ opacity: on ? 0 : 1 }, { opacity: on ? 1 : 0 }], { duration: dur, easing: OUT, fill: 'forwards' }); settle(cur, a, { opacity: on ? 1 : 0 }); },
  press(on) { cur.classList.toggle('down', on); },
  ripple(x, y, c = '#6C5CFF') {
    const r = document.createElement('i'); r.className = 'rp'; r.style.cssText = `left:${x}px;top:${y}px;--c:${c}`; $('#ripples').appendChild(r);
    r.animate([{ transform: 'scale(.6)', opacity: .9 }, { transform: 'scale(3.6)', opacity: 0 }], { duration: 620, easing: OUT, fill: 'forwards' }).onfinish = () => r.remove();
  },
  beat(k = .5) { $('#beat').animate([{ opacity: 0 }, { opacity: k, offset: .18 }, { opacity: 0 }], { duration: 520, easing: 'ease-out' }); },
  /* ---- captions ---- */
  caption(text, sub, { a = '#3C5CFF', b = '#8B5CFF', dim = false } = {}) {
    const h = $('#capH'), p = $('#capP');
    cap.style.setProperty('--a', a); cap.style.setProperty('--b', b); cap.classList.toggle('dim', dim);
    // *emphasised* parts get the gradient; every character is its own span so it can spring in
    h.innerHTML = text.split(/(\*[^*]+\*)/).filter(Boolean).map(seg => {
      const em = seg.startsWith('*'); const chars = [...(em ? seg.slice(1, -1) : seg)].map(c => `<span class="ch">${c}</span>`).join('');
      return em ? `<em>${chars}</em>` : chars;
    }).join('');
    p.textContent = sub || '';
    [...h.querySelectorAll('.ch')].forEach((c, i) => c.animate([{ opacity: 0, transform: 'translateY(42px) scale(.86) rotate(4deg)', filter: 'blur(10px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }], { duration: 760, delay: i * 34, easing: SPRING, fill: 'backwards' }));
    p.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 600, delay: 260 + [...h.querySelectorAll('.ch')].length * 22, easing: OUT, fill: 'backwards' });
  },
  captionOut() {
    const chs = [...cap.querySelectorAll('.ch')];
    chs.forEach((c, i) => c.animate([{ opacity: 1, transform: 'none', filter: 'blur(0)' }, { opacity: 0, transform: 'translateY(-26px) scale(.96)', filter: 'blur(6px)' }], { duration: 340, delay: i * 12, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards' }));
    $('#capP').animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, easing: 'ease-in', fill: 'forwards' });
  },
  captionClear() { $('#capH').innerHTML = ''; $('#capP').textContent = ''; $('#capP').getAnimations().forEach(a => a.cancel()); },
  /* ---- title cards ---- */
  card(html) { card.getAnimations().forEach(a => a.cancel()); card.hidden = !html; card.innerHTML = html || ''; },
  pop(sel, from, dur = 760, delay = 0, ease = SPRING) { const e = card.querySelector(sel); if (e) e.animate([from, { opacity: 1, transform: 'none', filter: 'blur(0)' }], { duration: dur, delay, easing: ease, fill: 'backwards' }); return e; },
  // DOM confetti for the title cards (the app's own confetti lives inside the window)
  sparks(x, y, n = 26, colors = ['#3C5CFF', '#8B5CFF', '#FF3B6B', '#FFB21A', '#22C993', '#FF8A3D'], power = 1) {
    for (let i = 0; i < n; i++) {
      const s = document.createElement('i'); const sz = 8 + Math.random() * 10, round = Math.random() < .4;
      s.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${sz}px;height:${round ? sz : sz * .55}px;margin:${-sz / 2}px;border-radius:${round ? '50%' : '3px'};background:${colors[i % colors.length]};z-index:9;pointer-events:none`;
      document.body.appendChild(s);
      const a = -Math.PI / 2 + (Math.random() - .5) * Math.PI * 1.7, d = (180 + Math.random() * 260) * power, dx = Math.cos(a) * d, dy = Math.sin(a) * d, rot = (Math.random() - .5) * 720;
      s.animate([{ transform: 'translate(0,0) rotate(0)', opacity: 1 }, { transform: `translate(${dx}px,${dy}px) rotate(${rot / 2}deg)`, opacity: 1, offset: .45 }, { transform: `translate(${dx * 1.2}px,${dy * 1.2 + 260}px) rotate(${rot}deg)`, opacity: 0 }], { duration: 1300 + Math.random() * 500, easing: 'cubic-bezier(.15,.7,.4,1)', fill: 'forwards' }).onfinish = () => s.remove();
    }
  },
};
})();
