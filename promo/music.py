"""Music + sound effects for the promo, synthesised from scratch and timed to promo/out/events.json.
python promo/music.py promo/out/events.json promo/out/audio.wav
120 bpm, C major. Sections follow the film: intro, groove, painting (+arps), build, drop (settle), outro.
"""
import json, sys
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve

SR = 48000
BPM = 120; BEAT = 60 / BPM; BAR = 4 * BEAT
ev = json.load(open(sys.argv[1], encoding='utf8'))
DUR = ev['duration'] + 1.0
N = int(SR * DUR)
rng = np.random.default_rng(7)

def bus(): return np.zeros((N, 2))
music, drums, sfx, verb_send = bus(), bus(), bus(), bus()

def put(b, sig, t, gain=1.0, pan=0.0):
    i = int(round(t * SR))
    if i >= N: return
    if sig.ndim == 1:
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        sig = np.stack([sig * l, sig * r], 1) * np.sqrt(2)
    n = min(len(sig), N - i)
    b[i:i + n] += sig[:n] * gain

def tt(d): return np.arange(int(d * SR)) / SR
def env_adsr(n, a=.005, d=.1, s=.6, r=.2, hold=None):
    t = np.arange(n) / SR; hold = hold if hold is not None else n / SR - r
    e = np.where(t < a, t / max(a, 1e-4), s + (1 - s) * np.exp(-(t - a) / max(d, 1e-4)))
    rel = np.clip((t - hold) / max(r, 1e-4), 0, 1)
    return e * (1 - rel) ** 2
def lp(x, f, order=2): return sosfilt(butter(order, min(f, SR / 2 * .95), 'low', fs=SR, output='sos'), x)
def hp(x, f, order=2): return sosfilt(butter(order, f, 'high', fs=SR, output='sos'), x)
def bp(x, lo, hi): return sosfilt(butter(2, [lo, hi], 'band', fs=SR, output='sos'), x)
def hz(note):  # 'C4' style or midi number
    if isinstance(note, (int, float)): return 440 * 2 ** ((note - 69) / 12)
    names = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
    n, acc, octv = note[0], note[1:-1], int(note[-1])
    m = 12 * (octv + 1) + names[n] + (1 if acc == '#' else -1 if acc == 'b' else 0)
    return 440 * 2 ** ((m - 69) / 12)

def additive(f, d, k_max=40, tilt=1.0, decay=None, detune=0.0):
    t = tt(d); out = np.zeros_like(t); K = int(min(k_max, (SR / 2 - 200) / f))
    for k in range(1, K + 1):
        a = 1 / k ** tilt
        if decay is not None: a = a * np.exp(-t * (decay[0] + decay[1] * k))
        out += a * np.sin(2 * np.pi * k * f * (1 + detune) * t + rng.uniform(0, 6.28))
    return out
def pluck(f, d=.6, bright=1.0):
    s = additive(f, d, 30, 1.0, (4.0, 1.6 / bright))
    return s * env_adsr(len(s), a=.002, d=.25, s=0, r=.05) * .5
def bass_note(f, d):
    t = tt(d); s = np.sin(2 * np.pi * f * t) + .35 * np.sin(4 * np.pi * f * t) + .12 * np.sin(6 * np.pi * f * t)
    return lp(s * env_adsr(len(t), a=.004, d=.18, s=.55, r=.06), 900) * .55
def pad_chord(fs, d, bright=1800, voices=3, spread=.007):
    out = np.zeros((int(d * SR), 2))
    for f in fs:
        for v in range(voices):
            det = (v - (voices - 1) / 2) * spread
            s = additive(f, d, 16, 1.25, None, det)
            pan = (v - (voices - 1) / 2) / max(1, voices - 1) * .8
            out[:, 0] += s * np.cos((pan + 1) * np.pi / 4); out[:, 1] += s * np.sin((pan + 1) * np.pi / 4)
    e = env_adsr(len(out), a=.35, d=.6, s=.8, r=.55)[:, None]
    out = np.stack([hp(lp(out[:, 0], bright), 180), hp(lp(out[:, 1], bright), 180)], 1) * e  # keep the low end for kick and bass
    return out / (len(fs) * voices) * .9
def supersaw(fs, d, cut=5200):
    return pad_chord(fs, d, bright=cut, voices=7, spread=.012) * 1.4
def noise(d): return rng.standard_normal(int(d * SR))

# ---------- drums ----------
def kick():
    t = tt(.42); f = 46 + 110 * np.exp(-t / .045); ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-t / .2) + .5 * np.exp(-t / .004) * rng.standard_normal(len(t)) * .25
    return np.tanh(s * 1.6) * .9
def clap():
    s = np.zeros(int(.3 * SR))
    for j, o in enumerate([0, .011, .023]):
        n = bp(noise(.25), 900, 3200) * np.exp(-tt(.25) / (.02 if j < 2 else .09)); i = int(o * SR); s[i:i + len(n)] += n[:len(s) - i]
    return s * .55
def hat(open_=False):
    d = .22 if open_ else .05; return hp(noise(d), 7000, 4) * np.exp(-tt(d) / (.07 if open_ else .012)) * (.28 if open_ else .32)
def snare():
    t = tt(.2); return (bp(noise(.2), 1200, 6000) * np.exp(-t / .05) * .6 + np.sin(2 * np.pi * 190 * t) * np.exp(-t / .04) * .35)
def crash():
    d = 2.4; return hp(noise(d), 4000, 2) * np.exp(-tt(d) / .7) * .22
def riser(d, f0=300, f1=6000):
    t = tt(d); n = noise(d); out = np.zeros_like(n); seg = 2048
    for i in range(0, len(n), seg):
        k = i / len(n); fc = f0 * (f1 / f0) ** k
        out[i:i + seg] = bp(n[i:i + seg], fc * .7, min(fc * 1.4, SR / 2 * .9))
    return out * (t / d) ** 1.6 * .35
def whoosh(d=.45, up=False):
    n = noise(d); t = tt(d); out = np.zeros_like(n); seg = 1024
    for i in range(0, len(n), seg):
        k = i / len(n); fc = 600 * (8 if up else 1) ** (k if up else 1 - k) * (1 if up else 1)
        out[i:i + seg] = bp(n[i:i + seg], max(200, fc * .6), min(fc * 2.2, 18000))
    return out * np.sin(np.pi * t / d) ** 2 * .3
def impact():
    t = tt(1.6); boom = np.sin(2 * np.pi * (38 + 40 * np.exp(-t / .08)) * t) * np.exp(-t / .5)
    return np.tanh((boom + lp(noise(1.6), 900) * np.exp(-t / .15) * .6) * 1.4) * .8

# ---------- harmony ----------
CH = {'C': ['C3', 'E3', 'G3', 'C4', 'E4'], 'G': ['G2', 'D3', 'G3', 'B3', 'D4'], 'Am': ['A2', 'E3', 'A3', 'C4', 'E4'], 'F': ['F2', 'C3', 'F3', 'A3', 'C4'],
      'Fmaj7': ['F2', 'C3', 'E3', 'A3', 'C4'], 'Em': ['E2', 'B2', 'E3', 'G3', 'B3']}
PROG = ['C', 'G', 'Am', 'F']
def chord_at(bar):
    if bar <= 0: return 'Fmaj7'
    if bar == 1: return 'G'
    if bar >= 26: return 'C'
    if bar == 24: return 'F'
    if bar == 25: return 'G'
    return PROG[(bar - 2) % 4]
def tones(name): return [hz(n) for n in CH[name]]

def section(t):
    for a, b, n in [(0, 4, 'intro'), (4, 16, 'A'), (16, 22, 'B'), (22, 26, 'A'), (26, 32, 'B2'), (32, 34, 'build'), (34, 40, 'drop'), (40, 48, 'A'), (48, 56, 'outro')]:
        if a <= t < b: return n
    return 'end'

# ---------- arrangement ----------
K, CL, HT, OH, SN = kick(), clap(), hat(), hat(True), snare()
kick_times = []
nbars = int(np.ceil(DUR / BAR))
for bar in range(nbars):
    t0 = bar * BAR; name = chord_at(bar); fs = tones(name)
    sec = section(t0 + .01)
    # pads / chords
    if sec in ('intro',):
        p = pad_chord(fs[1:], BAR + .6, bright=900 + 1400 * bar); put(music, p, t0, .55 if bar else .45)
    elif sec in ('A', 'B', 'B2'):
        put(music, pad_chord(fs[1:], BAR + .5, bright=2200), t0, .32)
        for b8 in range(8):  # offbeat chord stabs (house)
            if b8 % 2 == 1:
                st = np.zeros(int(.28 * SR))
                for f in fs[2:]: st += pluck(f * 2, .28, 1.4)
                put(music, st, t0 + b8 * BEAT / 2, .22, pan=(-.3 if b8 % 4 == 1 else .3))
    elif sec == 'build':
        put(music, pad_chord(fs[1:], BAR, bright=1200 + 4000 * ((t0 - 32) / 2 + .5)), t0, .38)
    elif sec == 'drop':
        put(music, supersaw(fs[1:], BAR + .3), t0, .5)
    elif sec == 'outro':
        if bar < 26: put(music, supersaw(fs[1:], BAR + .3, 3800), t0, .38)
        else: put(music, pad_chord(fs, 4.5, bright=2600, voices=5), t0, .55); put(music, supersaw(fs[1:], 3.0, 3000), t0, .25)
    # bass
    if sec in ('A', 'B', 'B2', 'drop', 'outro') and not (sec == 'outro' and bar >= 26):
        root = fs[0]
        for b8 in range(8):
            f = root * (2 if b8 % 2 else 1)
            put(music, bass_note(f, BEAT / 2 * .9), t0 + b8 * BEAT / 2, .52 if sec == 'drop' else .42)
    if sec == 'outro' and bar >= 26: put(music, bass_note(fs[0], 3.0), t0, .6)
    # arps
    if sec in ('B', 'B2', 'drop'):
        pat = [0, 1, 2, 3, 4, 3, 2, 1]
        arp = [f * 2 for f in fs]
        for s16 in range(16):
            f = arp[pat[s16 % 8] % len(arp)] * (2 if sec == 'drop' and s16 % 4 == 3 else 1)
            put(music, pluck(f, .22, 1.8), t0 + s16 * BEAT / 4, .16 if sec == 'B2' else .2, pan=.45 if s16 % 2 else -.45)
            put(verb_send, pluck(f, .22, 1.8), t0 + s16 * BEAT / 4, .08)
    # drums
    for b in range(4):
        tb = t0 + b * BEAT
        on = sec in ('A', 'B', 'B2', 'drop') or (sec == 'outro' and bar < 26) or (sec == 'build' and tb < 33.5)
        if on: put(drums, K, tb, .95); kick_times.append(tb)
        if sec in ('A', 'B', 'B2', 'drop', 'outro') and b % 2 == 1 and not (sec == 'outro' and bar >= 26): put(drums, CL, tb, .7, pan=.05)
        if sec in ('A', 'B', 'B2', 'drop', 'build') or (sec == 'outro' and bar < 26):
            for h in range(2 if sec == 'A' else 4):
                th = tb + h * BEAT / (2 if sec == 'A' else 4)
                put(drums, HT, th, (.55 if h % 2 else .35) * (1.15 if sec == 'drop' else 1), pan=.25)
        if sec in ('B', 'drop') : put(drums, OH, tb + BEAT / 2, .5, pan=-.2)
    if sec == 'intro' and bar == 1:
        for h in range(8): put(drums, HT, t0 + h * BEAT / 2, .25 + h * .03, pan=.25)
# build: snare roll + riser into the drop
for i, tr in enumerate(np.concatenate([np.arange(32, 33, .25), np.arange(33, 33.5, .125), np.arange(33.5, 33.875, .0625)])):
    put(drums, SN, tr, .25 + .45 * (i / 20), pan=.1)
put(sfx, riser(2.0), 32.0, .9)
put(sfx, riser(1.6, 250, 5000), 2.4, .6)

# sidechain pumping on the music bus
sc = np.ones(N)
for kt in kick_times:
    i = int(kt * SR); n = min(int(.32 * SR), N - i)
    if n > 0: sc[i:i + n] = np.minimum(sc[i:i + n], 1 - .55 * np.exp(-np.arange(n) / SR / .09))
music *= sc[:, None]

# ---------- sound effects from the film ----------
CHORD_HIGH = lambda t: [f * 4 for f in tones(chord_at(int(t // BAR)))[1:4]]
def pop(f0=420, f1=900, d=.09):
    t = tt(d); ph = 2 * np.pi * np.cumsum(f0 * (f1 / f0) ** (t / d)) / SR; return np.sin(ph) * np.exp(-t / .03) * .7
def chime(fs, d=.9):
    out = np.zeros(int(d * SR))
    for j, f in enumerate(fs):
        t = tt(d); s = (np.sin(2 * np.pi * f * t) + .3 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t / .1)) * np.exp(-t / (.35 + .1 * j))
        i = int(j * .045 * SR); out[i:] += s[:len(out) - i] * .4
    return out
def crackle(d=.6, n=60):
    out = np.zeros(int(d * SR))
    for _ in range(n):
        i = int(rng.uniform(0, d * .8) * SR); g = hp(noise(.012), 3000) * np.exp(-tt(.012) / .003) * rng.uniform(.2, .6)
        out[i:i + len(g)] += g[:len(out) - i]
    return out * np.exp(-np.arange(len(out)) / SR / .35)
paint_n = 0
for e in ev['events']:
    t, k = e['t'], e['type']
    if k == 'key': put(sfx, hp(noise(.014), 2500) * np.exp(-tt(.014) / .004) * .5, t, .35, pan=rng.uniform(-.2, .2))
    elif k == 'click': put(sfx, pop(1400, 900, .03), t, .32)
    elif k == 'down': put(sfx, pop(320, 240, .05), t, .3)
    elif k == 'drop': put(sfx, pop(520, 260, .1), t, .45); put(sfx, chime(CHORD_HIGH(t)[:2], .5), t + .02, .18)
    elif k == 'paint':
        base = [hz('C6'), hz('E6'), hz('G6'), hz('C7')][paint_n % 4]; paint_n += 1
        put(sfx, pop(380, 1000, .08), t, .55); put(sfx, chime([base, base * 1.26, base * 1.5], 1.0), t + .015, .32, pan=.1)
        put(sfx, crackle(.7, 70), t + .02, .55, pan=-.1); put(verb_send, chime([base, base * 1.5], 1.0), t, .2)
    elif k == 'caption': put(sfx, whoosh(.5, True), t - .05, .25)
    elif k == 'switch': put(sfx, whoosh(.35), t, .35); put(sfx, pop(900, 600, .04), t, .25)
    elif k == 'magic':
        put(sfx, chime([hz(n) for n in ['C6', 'E6', 'G6', 'B6', 'D7', 'G7']], 1.4), t, .4); put(verb_send, chime([hz('G6'), hz('D7')], 1.2), t, .25)
    elif k == 'settle':
        put(sfx, impact(), t, .9); put(drums, crash(), t, 1.0)
        put(sfx, chime([hz(n) for n in ['C5', 'E5', 'G5', 'C6', 'E6', 'G6', 'C7']], 2.2), t + .05, .5)
        put(sfx, crackle(2.5, 400), t + .1, .6); put(verb_send, chime([hz('C6'), hz('G6'), hz('C7')], 2.0), t + .1, .3)
    elif k == 'claim': put(sfx, chime([hz('G6'), hz('C7')], .9), t, .4); put(sfx, crackle(.6, 50), t, .4)
    elif k == 'tile':
        f = [hz('C5'), hz('E5'), hz('G5'), hz('C6')][e.get('i', 0) % 4]
        put(sfx, pluck(f, .7, 1.5), t, .55, pan=[-.3, .3, -.15, .15][e.get('i', 0) % 4]); put(sfx, pop(260, 160, .07), t, .35); put(verb_send, pluck(f, .7, 1.5), t, .2)
    elif k == 'fill': put(sfx, chime([hz('E6'), hz('G6'), hz('C7')], 1.2), t, .38); put(sfx, crackle(.8, 80), t, .45)
    elif k == 'pop': put(sfx, pluck([hz('G5'), hz('A5'), hz('C6')][e.get('i', 0) % 3], .45, 1.6), t, .45)
    elif k == 'whoosh': put(sfx, whoosh(.55, False), t - .15, .45)
    elif k == 'impact': put(sfx, impact(), t, .7); put(drums, crash(), t, .7)
    elif k == 'end': put(sfx, chime([hz('C6'), hz('E6'), hz('G6'), hz('C7')], 2.5), t - .5, .3)

# ---------- reverb (synthetic plate) + master ----------
ir_t = tt(1.6); ir = rng.standard_normal((len(ir_t), 2)) * np.exp(-ir_t / .45)[:, None]
ir[:, 0] = lp(ir[:, 0], 7000); ir[:, 1] = lp(ir[:, 1], 7000); ir /= np.sqrt((ir ** 2).sum(0))
verb_in = verb_send + .12 * music + .18 * sfx
wet = np.stack([fftconvolve(verb_in[:, c], ir[:, c])[:N] for c in range(2)], 1) * .5
mix = music * .9 + drums * .85 + sfx * .9 + wet
mix = np.stack([hp(mix[:, 0], 28), hp(mix[:, 1], 28)], 1)
# fade in the first ms, fade out the tail
mix[:int(.01 * SR)] *= np.linspace(0, 1, int(.01 * SR))[:, None]
fade = int(1.2 * SR); mix[-fade:] *= np.linspace(1, 0, fade)[:, None] ** 2
mix = np.tanh(mix * 1.2) / np.tanh(1.2)
mix *= .89 / np.max(np.abs(mix))
import wave
with wave.open(sys.argv[2], 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix * 32767).astype('<i2').tobytes())
print('wrote', sys.argv[2], f'{DUR:.1f}s')
