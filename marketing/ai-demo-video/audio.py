"""Synthesize the 40s soundtrack: ambient music bed + UI SFX synced to the animation."""
import numpy as np
import wave

SR = 44100
DUR = 40.0
N = int(SR * DUR)
t_all = np.arange(N) / SR
L = np.zeros(N)
R = np.zeros(N)

def add(sig, at, gain=1.0, pan=0.0):
    """Mix sig into L/R at time `at` (seconds). pan -1..1."""
    i0 = int(at * SR)
    if i0 >= N: return
    n = min(len(sig), N - i0)
    gl = gain * (1 - max(pan, 0) * 0.7)
    gr = gain * (1 + min(pan, 0) * 0.7)
    L[i0:i0+n] += sig[:n] * gl
    R[i0:i0+n] += sig[:n] * gr

def env(n, a, r, sustain_frac=1.0):
    """Attack/release envelope over n samples."""
    e = np.ones(n) * sustain_frac
    na, nr = int(a * SR), int(r * SR)
    na, nr = min(na, n), min(nr, n)
    if na: e[:na] = np.linspace(0, sustain_frac, na)
    if nr: e[-nr:] *= np.linspace(1, 0, nr)
    return e

def tone(freq, dur, a=0.01, r=0.05, harmonics=((1,1.0),)):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    s = np.zeros(n)
    for mult, amp in harmonics:
        s += amp * np.sin(2*np.pi*freq*mult*tt)
    return s * env(n, a, r)

def pluck(freq, dur=0.9):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    decay = np.exp(-tt * 6.5)
    s = (np.sin(2*np.pi*freq*tt) + 0.35*np.sin(2*np.pi*freq*2*tt) + 0.12*np.sin(2*np.pi*freq*3*tt))
    return s * decay * env(n, 0.004, 0.05)

def pad_chord(freqs, dur):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    s = np.zeros(n)
    for i, f in enumerate(freqs):
        vib = 1 + 0.0015 * np.sin(2*np.pi*(0.15 + i*0.07)*tt + i)
        s += np.sin(2*np.pi*f*vib*tt) + 0.25*np.sin(2*np.pi*2*f*vib*tt)
    return s / len(freqs) * env(n, dur*0.35, dur*0.45)

NOTE = {n: 440*2**((i-9)/12) for i, n in enumerate(
    ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'])}
def nf(name, octv):  # note freq
    return NOTE[name] * 2**(octv - 4)

# ---------------- music bed ----------------
# 100 BPM, chords of 4 beats (2.4s): C  G/B  Am7  Fmaj7 — warm, forward-moving
BEAT = 0.6
CHORD_D = 4 * BEAT
prog = [
    [('C',3),('G',3),('E',4),('B',4)],
    [('B',2),('G',3),('D',4),('G',4)],
    [('A',2),('G',3),('C',4),('E',4)],
    [('F',2),('A',3),('C',4),('E',4)],
]
tt = 0.0
ci = 0
while tt < DUR:
    ch = prog[ci % 4]
    freqs = [nf(nm, o) for nm, o in ch]
    add(pad_chord(freqs, CHORD_D * 1.15), tt, gain=0.16)
    # pluck arpeggio: 8th notes over chord tones (upper 3), ping-pong pan
    tones = freqs[1:] + [freqs[3] * 2]
    for k in range(8):
        at = tt + k * BEAT / 2
        if at >= DUR - 0.5: break
        f = tones[[0, 2, 1, 3, 2, 0, 3, 1][k]]
        add(pluck(f, 0.7), at, gain=0.075, pan=(-1)**k * 0.5)
    tt += CHORD_D
    ci += 1

# soft "heartbeat" bass pulse on beats 1 and 3 for momentum
tt = 0.0
while tt < DUR - 1:
    root = prog[int(tt // CHORD_D) % 4][0]
    f = nf(*root) / 2
    add(tone(f, 0.5, a=0.01, r=0.35, harmonics=((1, 1.0), (2, 0.15))), tt, gain=0.11)
    add(tone(f, 0.4, a=0.01, r=0.3, harmonics=((1, 1.0),)), tt + 2*BEAT, gain=0.07)
    tt += CHORD_D

# ---------------- SFX ----------------
def blip(f0, f1, dur=0.14):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    freq = f0 + (f1 - f0) * (tt / dur)
    ph = 2*np.pi*np.cumsum(freq)/SR
    return np.sin(ph) * env(n, 0.004, dur*0.6)

def whoosh(dur=0.5, rising=True):
    n = int(dur * SR)
    noise = np.random.default_rng(7).standard_normal(n)
    spec = np.fft.rfft(noise)
    fr = np.fft.rfftfreq(n, 1/SR)
    spec *= np.exp(-((fr - 900) / 700)**2)          # bandpass around 900 Hz
    s = np.fft.irfft(spec, n)
    s /= np.max(np.abs(s)) + 1e-9
    sweep = np.linspace(0.2, 1.0, n) if rising else np.linspace(1.0, 0.2, n)
    return s * sweep * env(n, dur*0.4, dur*0.5)

def chime(notes, gap=0.09, gain_each=1.0):
    total = int((len(notes)*gap + 1.2) * SR)
    s = np.zeros(total)
    for i, f in enumerate(notes):
        p = pluck(f, 1.1) * gain_each
        i0 = int(i * gap * SR)
        s[i0:i0+len(p)] += p
    return s

def tick():
    n = int(0.03 * SR)
    return np.random.default_rng(3).standard_normal(n) * env(n, 0.002, 0.025) * \
        np.exp(-np.arange(n)/SR*180)

rng = np.random.default_rng(42)

# scene transitions
for at in [3.55, 20.35, 31.15]:
    add(whoosh(0.7, rising=True), at, gain=0.16)

# scene B (offset 3.8)
B = 3.8
add(blip(500, 880, 0.16), B+0.95, gain=0.22)                    # widget opens
add(blip(620, 860, 0.12), B+1.55, gain=0.20)                    # greeting pop
for kt in np.arange(B+2.25, B+5.55, 0.085):                     # typing ticks
    if rng.random() < 0.82:
        add(tick(), kt + rng.random()*0.02, gain=0.5*rng.uniform(0.5, 1.0))
add(whoosh(0.30, rising=True), B+5.82, gain=0.20)               # send
add(blip(870, 620, 0.12), B+5.9, gain=0.18)
add(blip(620, 860, 0.12), B+7.45, gain=0.20)                    # bot msg 1
add(blip(620, 860, 0.12), B+8.65, gain=0.20)                    # bot msg 2
add(blip(700, 950, 0.10), B+9.05, gain=0.16)                    # chips
add(tick(), B+10.9, gain=1.6)                                    # chip click
add(blip(950, 700, 0.09), B+10.92, gain=0.20)
add(chime([nf('C',5), nf('E',5), nf('G',5)], 0.10), B+12.65, gain=0.30)   # booked!

# scene C (offset 20.6)
C = 20.6
n_sc = int(1.7 * SR)                                             # scan hum
tt_sc = np.arange(n_sc) / SR
scan = np.sin(2*np.pi*(220 + 160*tt_sc/1.7)*tt_sc) * env(n_sc, 0.4, 0.5) * 0.5
scan += whoosh(1.7, rising=True)[:n_sc] * 0.7
add(scan, C+0.9, gain=0.14)
for i, rt in enumerate([1.6, 2.15, 2.7, 3.35, 4.0]):             # row pops
    f = 620 + i*70
    add(blip(f, f+220, 0.10), C+rt, gain=0.19)
add(blip(500, 380, 0.16), C+3.35, gain=0.14)                     # allergy = lower tone under its pop
add(chime([nf('G',4), nf('C',5)], 0.10), C+5.05, gain=0.28)      # synced toast
add(blip(700, 990, 0.12), C+6.25, gain=0.18)                     # stat line

# scene D (offset 31.4)
D = 31.4
add(tone(nf('C',2), 2.2, a=0.25, r=1.6, harmonics=((1,1),(2,0.3),(3,0.1))), D+0.25, gain=0.16)  # logo swell
add(chime([nf('C',5), nf('E',5), nf('G',5), nf('C',6)], 0.09), D+2.7, gain=0.26)                # CTA sparkle

# ---------------- master ----------------
mix = np.stack([L, R], axis=1)
# gentle master fade in/out
fade_in = int(0.4 * SR); fade_out = int(2.5 * SR)
mix[:fade_in] *= np.linspace(0, 1, fade_in)[:, None]
mix[-fade_out:] *= np.linspace(1, 0, fade_out)[:, None]
# soft-knee limiter-ish
mix = np.tanh(mix * 1.4) / 1.4
peak = np.max(np.abs(mix))
mix = mix / peak * 0.85
pcm = (mix * 32767).astype(np.int16)

with wave.open('soundtrack.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print('wrote soundtrack.wav', pcm.shape, f'peak {peak:.3f}')
