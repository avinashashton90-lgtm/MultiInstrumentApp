// Behaviour tests: violin / viola / cello tuning, timbre and two-hand bowing, the French horn, the eight newer
// instruments (trumpet, pipe organ, saxophone, xylophone, synth, electric bass, rhythm guitar), the shared note
// limit, recording, and the master limiter.
//   node tests/instruments.js      prints a report, writes tests/results/instruments.json, exits 1 on a failure
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, openApp } = require('./lib/browser');
const R = require('./lib/reference');

// ---------- in-page helpers (serialised into the page) ----------
const PAGE_LIB = function () {
  const P = window.PocketBandTest, $ = (s) => document.querySelector(s);
  const input = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('input')); };
  const H = window.__pbt = {};
  H.setup = (tab, key, scale) => {
    P.open(tab);
    input('rev', 0);
    if (document.getElementById('irev').offsetParent !== null) input('irev', 0);
    if (tab === 'violin' || tab === 'cello' || tab === 'viola') {
      if ($('#bvib').getAttribute('aria-pressed') === 'true') $('#bvib').click();
      if (key !== undefined) P.setTonal(tab, key, scale);
      P.bowRect(); P.bw.manual = true;
    }
  };
  H.start = (seconds) => { P.reset(); window.__pbSeconds = seconds; P.init(); };
  H.analyse = (buf, wins) => {
    const x = PBA.mono(buf), sr = buf.sampleRate, out = {};
    for (const k in wins) {
      const [s, e, kind, extra] = wins[k], a = Math.round(s * sr), b = Math.round(e * sr);
      const m = { rms: PBA.db(PBA.rms(buf, a, b)), peak: PBA.db(PBA.peak(buf, a, b)) };
      if (kind === 'pitch') m.f = PBA.pitch(x, sr, a, b, 50, 2500).f;
      if (kind === 'tones') m.tones = extra.map((f) => PBA.tonePower(x, sr, a, b, f));
      if (kind === 'timbre') { m.centroid = PBA.centroid(x, sr, a); m.above2k = PBA.energyAbove(x, sr, 2000, a, b); }
      if (kind === 'env') m.env = PBA.envelope(x, a, b, Math.round(sr * (extra || 0.005)));
      if (kind === 'hf') { // energy above ~7 kHz in 2 ms frames: a click shows as a spike
        const hp = new Float32Array(b - a); let lp = 0;
        const k = Math.exp(-2 * Math.PI * 7000 / sr);
        for (let i = a; i < b; i++) { lp = (1 - k) * x[i] + k * lp; hp[i - a] = x[i] - lp; }
        m.env = PBA.envelope(hp, 0, hp.length, Math.round(sr * 0.002));
      }
      out[k] = m;
    }
    out.__peak = PBA.db(PBA.peak(buf)); out.__clipped = PBA.peak(buf) >= 1;
    return out;
  };
  H.median = (a) => { const b = a.slice().sort((x, y) => x - y); return b[b.length >> 1]; };
  // Pitch track: one estimate per `hop` seconds over [s, e), in cents from midi note m (frames off by more than 100 c dropped)
  H.track = (buf, s, e, m, hop, fmin, fmax) => {
    const x = PBA.mono(buf), sr = buf.sampleRate, f0 = 440 * Math.pow(2, (m - 69) / 12), out = [];
    for (let t = s; t < e; t += hop) out.push(1200 * Math.log2(PBA.pitch(x, sr, Math.round(t * sr), Math.round((t + 0.06) * sr), fmin || f0 * 0.7, fmax || f0 * 1.4).f / f0));
    return out.filter((c) => Math.abs(c) < 100);
  };
  // Roughness: spread (dB) of the level in 4 ms frames over a held note; a growl's flutter raises it
  H.rough = (buf, s, e) => {
    const sr = buf.sampleRate, env = PBA.envelope(PBA.mono(buf), Math.round(s * sr), Math.round(e * sr), Math.round(0.004 * sr)).sort((a, b) => a - b);
    return env[Math.floor(env.length * 0.9)] - env[Math.floor(env.length * 0.1)];
  };
  // Seconds from `from` until the level (10 ms frames) stays more than `db` below `ref` dBFS
  H.fall = (buf, from, ref, db) => {
    const sr = buf.sampleRate, env = PBA.envelope(PBA.mono(buf), Math.round(from * sr), buf.length, Math.round(0.01 * sr));
    let last = -1;
    env.forEach((v, i) => { if (v > ref - db) last = i; });
    return (last + 1) * 0.01;
  };
  // Loudest 2 ms burst of energy above 7 kHz in [s, e) over the median of the held note's [hs, he)
  H.fadeBurst = (buf, hs, he, s, e) => {
    const x = PBA.mono(buf), sr = buf.sampleRate, k = Math.exp(-2 * Math.PI * 7000 / sr), hp = new Float32Array(x.length);
    let lp = 0;
    for (let i = 0; i < x.length; i++) { lp = (1 - k) * x[i] + k * lp; hp[i] = x[i] - lp; }
    const fr = Math.round(sr * 0.002), held = PBA.envelope(hp, Math.round(hs * sr), Math.round(he * sr), fr).sort((p, q) => p - q);
    return Math.max(...PBA.envelope(hp, Math.round(s * sr), Math.round(e * sr), fr)) - held[held.length >> 1];
  };
  // Loudest burst of energy above 7 kHz (2 ms frames) over the median, ignoring anything 40 dB below `lvl`
  H.burst = (buf, s, e, lvl) => {
    const x = PBA.mono(buf), sr = buf.sampleRate, a = Math.round(s * sr), b = Math.round(e * sr), k = Math.exp(-2 * Math.PI * 7000 / sr), hp = new Float32Array(b - a);
    let lp = 0;
    for (let i = a; i < b; i++) { lp = (1 - k) * x[i] + k * lp; hp[i - a] = x[i] - lp; }
    const env = PBA.envelope(hp, 0, hp.length, Math.round(sr * 0.002)).sort((p, q) => p - q), top = env[env.length - 1];
    return top < lvl - 40 ? 0 : top - env[env.length >> 1];
  };
  H.ptr = (type, sel, fx, fy, id) => __pbPtr(type, typeof sel === 'string' ? document.querySelector(sel) : sel, fx, fy, id || 9);
  // Board geometry for the bowed instruments
  H.board = () => { const r = P.bw.rect; return { W: r.width, H: r.height, FB: 0.74 }; };
  H.fingerX = (s) => { const g = H.board(); return (s + 0.5) / 15 * g.FB * g.W; };
  H.stringY = (u) => (u + 0.5) / 4 * H.board().H;
  // Bow strokes: a triangle wave in x around the middle of the bow zone, one move + tick per 60 Hz frame
  H.strokes = (steps, id, t0, t1, opts) => {
    const g = H.board(), xc = 0.87 * g.W, A = opts.amp || 0.07 * g.W, period = opts.period || 0.4;
    for (let t = t0; t <= t1 + 1e-9; t += 1 / 60) {
      const ph = ((t - t0) / period) % 1, tri = ph < 0.5 ? 4 * ph - 1 : 3 - 4 * ph;
      const u = typeof opts.u === 'function' ? opts.u(t) : opts.u;
      const x = xc + A * tri, y = H.stringY(u), ms = t * 1000;
      steps.push([t, () => { P.bwMove(id, x, y, ms); P.bwTick(ms); }]);
    }
  };
};

// Each test: plan runs in the page and returns analysis; check runs in node and returns [ok, detail]
const TESTS = [];
const test = (name, plan, check, arg) => TESTS.push({ name, plan, check, arg });
const near = (f, m, tol = 5) => Math.abs(R.cents(f, m)) <= tol;
const fmt = (f, m) => `${f.toFixed(2)} Hz (${R.cents(f, m) >= 0 ? '+' : ''}${R.cents(f, m).toFixed(2)} c from ${R.NAMES[R.pc(m)]}${Math.floor(m / 12) - 1})`;

// ---- tuning: open strings under the bow ----
for (const [tab, open] of [['violin', [55, 62, 69, 76]], ['viola', [48, 55, 62, 69]], ['cello', [36, 43, 50, 57]]]) {
  test(`${tab}: open strings`, async (tab) => {
    const H = __pbt, P = PocketBandTest, steps = [], wins = {};
    H.setup(tab, 0, 'major'); H.start(5.2);
    for (let i = 0; i < 4; i++) {
      const t0 = 0.3 + i * 1.2;
      steps.push([t0, () => P.bwDown('b', H.board().W * 0.87, H.stringY(i), t0 * 1000)]);
      H.strokes(steps, 'b', t0, t0 + 0.9, { u: i });
      steps.push([t0 + 0.95, () => P.bwLift('b')]);
      wins['s' + i] = [t0 + 0.45, t0 + 0.9, 'pitch'];
    }
    return H.analyse(await __pbRender(steps), wins);
  }, (r) => {
    const ok = open.every((m, i) => near(r['s' + i].f, m));
    return [ok, open.map((m, i) => fmt(r['s' + i].f, m)).join(', ')];
  }, tab);
}

// ---- timbre: the same note (G3) on both, then each instrument's own register ----
test('violin vs cello: timbre', async () => {
  const H = __pbt, P = PocketBandTest, out = {}, T0 = 0.4;
  for (const tab of ['violin', 'cello']) {
    const runs = [];
    // five renders with different random start phases; detuned copies beat, so one render alone can mislead
    for (let seed = 1; seed <= 5; seed++) {
      H.setup(tab, 0, 'major'); window.__pbSeed = seed; H.start(T0 + 2);
      const r = H.analyse(await __pbRender([[T0, () => P.vStart(tab, 't', 55, 0.6, { vib: false })], [T0 + 1.5, () => P.vStop('t')]]),
        { body: [T0 + 0.7, T0 + 1.4, 'timbre'], env: [T0, T0 + 1.4, 'env'] });
      // attack: time to reach 90% (-0.9 dB) of the steady level
      const env = r.env.env, steady = r.body.rms, i90 = env.findIndex((v) => v >= steady - 0.92);
      runs.push({ centroid: r.body.centroid, above2k: r.body.above2k, attack: i90 * 0.005 });
    }
    window.__pbSeed = 1;
    out[tab] = {};
    for (const k of ['centroid', 'above2k', 'attack']) out[tab][k] = H.median(runs.map((x) => x[k]));
  }
  return out;
}, (r) => {
  const ok = r.violin.centroid > 1.5 * r.cello.centroid && r.cello.attack > 1.5 * r.violin.attack;
  return [ok, `G3 on both. Spectral centroid violin ${r.violin.centroid.toFixed(0)} Hz vs cello ${r.cello.centroid.toFixed(0)} Hz; ` +
    `energy above 2 kHz ${(100 * r.violin.above2k).toFixed(0)}% vs ${(100 * r.cello.above2k).toFixed(1)}%; attack to 90% ${(1000 * r.violin.attack).toFixed(0)} ms vs ${(1000 * r.cello.attack).toFixed(0)} ms`, r];
});

// ---- two-hand bowing (violin in D major: strings G D A E) ----
test('bowing: held finger sets the pitch of the bowed string', async () => {
  const H = __pbt, P = PocketBandTest, steps = [];
  H.setup('violin', 2, 'major'); H.start(2);
  steps.push([0.2, () => P.bwDown('f', H.fingerX(4), H.stringY(1), 200)]);     // D string, 4 semitones up: F#4
  steps.push([0.3, () => P.bwDown('b', H.board().W * 0.87, H.stringY(1), 300)]);
  H.strokes(steps, 'b', 0.3, 1.7, { u: 1 });
  return H.analyse(await __pbRender(steps), { n: [0.8, 1.6, 'pitch'] });
}, (r) => [near(r.n.f, 66), fmt(r.n.f, 66)]);

test('bowing: a string with no finger sounds open', async () => {
  const H = __pbt, P = PocketBandTest, steps = [];
  H.setup('violin', 2, 'major'); H.start(2);
  steps.push([0.2, () => P.bwDown('f', H.fingerX(4), H.stringY(1), 200)]);     // finger on D, but the bow is on A
  steps.push([0.3, () => P.bwDown('b', H.board().W * 0.87, H.stringY(2), 300)]);
  H.strokes(steps, 'b', 0.3, 1.7, { u: 2 });
  return H.analyse(await __pbRender(steps), { n: [0.8, 1.6, 'pitch'] });
}, (r) => [near(r.n.f, 69), fmt(r.n.f, 69)]);

test('bowing: double stop (bow between two strings, one finger per string)', async () => {
  const H = __pbt, P = PocketBandTest, steps = [];
  H.setup('violin', 2, 'major'); H.start(2);
  steps.push([0.2, () => P.bwDown('f1', H.fingerX(4), H.stringY(1), 200)]);    // D string: F#4 (66)
  steps.push([0.2, () => P.bwDown('f2', H.fingerX(2), H.stringY(2), 200)]);    // A string: B4 (71)
  steps.push([0.3, () => P.bwDown('b', H.board().W * 0.87, H.stringY(1.5), 300)]);
  H.strokes(steps, 'b', 0.3, 1.7, { u: 1.5 });
  const f = (m) => 440 * Math.pow(2, (m - 69) / 12);
  // the two notes, plus off-note frequencies between and around them as the floor
  return H.analyse(await __pbRender(steps), { n: [0.8, 1.6, 'tones', [f(66), f(71), f(68.5), f(64), f(73.5)]] });
}, (r) => {
  const [a, b, mid, lo, hi] = r.n.tones, floor = Math.max(mid, lo, hi);
  const ok = Math.abs(a - b) < 6 && a - floor > 20 && b - floor > 20;
  return [ok, `F#4 ${a.toFixed(1)} dB, B4 ${b.toFixed(1)} dB, strongest off-note ${floor.toFixed(1)} dB`];
});

test('bowing: one finger per string (a newer finger on the same string wins, lifting it hands back)', async () => {
  const H = __pbt, P = PocketBandTest, steps = [];
  H.setup('violin', 2, 'major'); H.start(3.2);
  steps.push([0.2, () => P.bwDown('f1', H.fingerX(2), H.stringY(1), 200)]);    // E4 (64)
  steps.push([0.3, () => P.bwDown('b', H.board().W * 0.87, H.stringY(1), 300)]);
  H.strokes(steps, 'b', 0.3, 3.0, { u: 1 });
  steps.push([1.1, () => P.bwDown('f2', H.fingerX(5), H.stringY(1), 1100)]);   // G4 (67)
  steps.push([2.0, () => P.bwLift('f2')]);
  return H.analyse(await __pbRender(steps), { a: [0.6, 1.05, 'pitch'], b: [1.4, 1.95, 'pitch'], c: [2.4, 2.95, 'pitch'] });
}, (r) => [near(r.a.f, 64) && near(r.b.f, 67) && near(r.c.f, 64), `${fmt(r.a.f, 64)} then ${fmt(r.b.f, 67)} then ${fmt(r.c.f, 64)}`]);

test('bowing: moving across the strings changes strings smoothly', async () => {
  const H = __pbt, P = PocketBandTest, steps = [];
  H.setup('violin', 2, 'major'); H.start(3.4);
  steps.push([0.3, () => P.bwDown('b', H.board().W * 0.87, H.stringY(0), 300)]);
  H.strokes(steps, 'b', 0.3, 3.2, { u: (t) => Math.max(0, Math.min(3, (t - 0.6) * 1.25)) }); // G to E over 2.4 s
  // 20 ms frames: two strings a fifth apart beat against each other inside shorter frames
  return H.analyse(await __pbRender(steps), { first: [0.3, 0.6, 'pitch'], last: [3.05, 3.3, 'pitch'], env: [0.7, 3.0, 'env', 0.02], hf: [0.7, 3.0, 'hf'] });
}, (r) => {
  const env = r.env.env, steps = env.slice(1).map((v, i) => Math.abs(v - env[i])), maxStep = Math.max(...steps);
  const hf = r.hf.env.slice().sort((a, b) => a - b), spike = hf[hf.length - 1] - hf[hf.length >> 1];
  const ok = near(r.first.f, 55) && near(r.last.f, 76) && maxStep < 3 && spike < 10;
  return [ok, `starts ${fmt(r.first.f, 55)}, ends ${fmt(r.last.f, 76)}; largest level change between 20 ms frames ${maxStep.toFixed(2)} dB; ` +
    `largest high-frequency spike ${spike.toFixed(1)} dB over the median`];
});

test('bowing: changing bow direction does not click', async () => {
  const H = __pbt, P = PocketBandTest, steps = [];
  H.setup('violin', 2, 'major'); H.start(3);
  steps.push([0.3, () => P.bwDown('b', H.board().W * 0.87, H.stringY(2), 300)]);
  H.strokes(steps, 'b', 0.3, 2.8, { u: 2, period: 0.5 });                      // a reversal every 0.25 s
  return H.analyse(await __pbRender(steps), { env: [0.8, 2.7, 'env'], hf: [0.8, 2.7, 'hf'] });
}, (r) => {
  const env = r.env.env, steps = env.slice(1).map((v, i) => Math.abs(v - env[i])), maxStep = Math.max(...steps);
  const hf = r.hf.env.slice().sort((a, b) => a - b), spike = hf[hf.length - 1] - hf[hf.length >> 1];
  const dip = Math.max(...env) - Math.min(...env);
  return [maxStep < 3 && spike < 10, `7 reversals: largest level change between 5 ms frames ${maxStep.toFixed(2)} dB, deepest dip ${dip.toFixed(1)} dB, ` +
    `largest high-frequency spike ${spike.toFixed(1)} dB over the median`];
});

test('bowing: bow speed sets the volume', async () => {
  const H = __pbt, P = PocketBandTest, out = {};
  for (const [k, period] of [['slow', 2], ['medium', 0.45], ['fast', 0.22]]) {
    const steps = [];
    H.setup('violin', 2, 'major'); H.start(2);
    steps.push([0.3, () => P.bwDown('b', H.board().W * 0.87, H.stringY(2), 300)]);
    H.strokes(steps, 'b', 0.3, 1.8, { u: 2, period });
    out[k] = H.analyse(await __pbRender(steps), { n: [0.8, 1.7] }).n.rms;
  }
  return out;
}, (r) => [r.fast > r.medium + 2 && r.medium > r.slow + 2, `RMS slow ${r.slow.toFixed(1)}, medium ${r.medium.toFixed(1)}, fast ${r.fast.toFixed(1)} dBFS`]);

test('bowing: one finger alone still holds and rubs (old behaviour)', async () => {
  const H = __pbt, P = PocketBandTest, steps = [];
  H.setup('violin', 2, 'major'); H.start(2.4);
  const x = H.fingerX(4), y0 = H.stringY(1);
  steps.push([0.3, () => P.bwDown('f', x, y0, 300)]);
  for (let t = 0.3; t < 1.0; t += 1 / 60) { const ms = t * 1000; steps.push([t, () => P.bwTick(ms)]); }           // held still
  for (let t = 1.0; t < 2.2; t += 1 / 60) {                                                                     // rubbed up and down
    const ms = t * 1000, y = y0 + 14 * Math.sin(2 * Math.PI * 4 * (t - 1));
    steps.push([t, () => { P.bwMove('f', x, y, ms); P.bwTick(ms); }]);
  }
  return H.analyse(await __pbRender(steps), { still: [0.6, 0.98, 'pitch'], rub: [1.4, 2.15, 'pitch'] });
}, (r) => [near(r.still.f, 66) && near(r.rub.f, 66) && r.rub.rms > r.still.rms + 3,
  `held ${fmt(r.still.f, 66)} at ${r.still.rms.toFixed(1)} dBFS, rubbed ${r.rub.rms.toFixed(1)} dBFS`]);

test('cello: two-hand bowing too', async () => {
  const H = __pbt, P = PocketBandTest, steps = [];
  H.setup('cello', 0, 'major'); H.start(2);
  steps.push([0.2, () => P.bwDown('f', H.fingerX(5), H.stringY(2), 200)]);     // D string, 5 up: G3 (55)
  steps.push([0.3, () => P.bwDown('b', H.board().W * 0.87, H.stringY(2), 300)]);
  H.strokes(steps, 'b', 0.3, 1.8, { u: 2 });
  return H.analyse(await __pbRender(steps), { n: [0.9, 1.7, 'pitch'] });
}, (r) => [near(r.n.f, 55), fmt(r.n.f, 55)]);

// ---- French horn ----
test('horn: attack, breath-opened low-pass, vibrato, hand-stop', async () => {
  const H = __pbt, P = PocketBandTest, $ = (s) => document.querySelector(s), out = {}, T0 = 0.4;
  for (const [k, l, stop] of [['soft', 0.3, false], ['loud', 1, false], ['mid', 0.65, false], ['stopped', 0.65, true]]) {
    const runs = [];
    for (let seed = 1; seed <= 5; seed++) { // median of five random start phases, as for the strings
      H.setup('horn');
      if (($('#hstop').getAttribute('aria-pressed') === 'true') !== stop) $('#hstop').click();
      window.__pbSeed = seed; H.start(T0 + 1.2);
      const r = H.analyse(await __pbRender([[T0, () => P.vStart('horn', 'h', 53, l, {})], [T0 + 1, () => P.vStop('h')]]),
        { body: [T0 + 0.3, T0 + 0.5, 'timbre'], env: [T0, T0 + 0.6, 'env'] });
      // attack: from the start of the note to 90% of its level once settled (0.25 to 0.4 s in)
      const env = r.env.env, tail = env.slice(50, 80), steady = 10 * Math.log10(tail.reduce((a, v) => a + Math.pow(10, v / 10), 0) / tail.length);
      const i90 = env.findIndex((v) => v >= steady - 0.92);
      runs.push({ centroid: r.body.centroid, rms: r.body.rms, attack: i90 * 0.005 });
    }
    out[k] = {};
    for (const q of ['centroid', 'rms', 'attack']) out[k][q] = H.median(runs.map((x) => x[q]));
  }
  window.__pbSeed = 1;
  // vibrato depth: re-render a mid note and track pitch frame by frame
  H.setup('horn'); if ($('#hstop').getAttribute('aria-pressed') === 'true') $('#hstop').click();
  H.start(T0 + 2.2);
  const buf = await __pbRender([[T0, () => P.vStart('horn', 'h', 53, 0.65, {})]]), x = PBA.mono(buf), sr = buf.sampleRate, fs = [];
  // F3 is 174.6 Hz; searching 120-260 Hz keeps short frames from locking onto a harmonic
  for (let t = T0 + 1.0; t < T0 + 2.0; t += 0.025) fs.push(PBA.pitch(x, sr, Math.round(t * sr), Math.round((t + 0.06) * sr), 120, 260).f);
  // a 60 ms frame now and then reads the 3:2 ratio between harmonics; frames that far off are dropped
  const cs = fs.map((f) => 1200 * Math.log2(f / 174.614)).filter((c) => Math.abs(c) < 100);
  out.vibrato = (Math.max(...cs) - Math.min(...cs)) / 2;
  if ($('#hstop').getAttribute('aria-pressed') === 'true') $('#hstop').click();
  return out;
}, (r) => {
  const ok = r.mid.attack >= 0.08 && r.mid.attack <= 0.15 && r.loud.centroid > r.soft.centroid * 1.3 && r.vibrato > 2 && r.vibrato < 15 &&
    r.stopped.centroid > r.mid.centroid && r.stopped.rms < r.mid.rms;
  return [ok, `attack (to 90%) ${(1000 * r.mid.attack).toFixed(0)} ms; brightness (centroid) soft ${r.soft.centroid.toFixed(0)} Hz → full breath ${r.loud.centroid.toFixed(0)} Hz; ` +
    `vibrato ±${r.vibrato.toFixed(1)} cents; hand-stop ${(r.stopped.rms - r.mid.rms).toFixed(1)} dB quieter and brighter (${r.stopped.centroid.toFixed(0)} Hz vs ${r.mid.centroid.toFixed(0)} Hz)`, r];
});

// ---- viola ----
test('viola: timbre between violin and cello', async () => {
  const H = __pbt, P = PocketBandTest, out = {}, T0 = 0.4;
  for (const tab of ['violin', 'viola', 'cello']) {
    const c = [];
    for (let seed = 1; seed <= 5; seed++) {
      H.setup(tab, 0, 'major'); window.__pbSeed = seed; H.start(T0 + 1.6);
      const r = H.analyse(await __pbRender([[T0, () => P.vStart(tab, 't', 55, 0.6, { vib: false })], [T0 + 1.2, () => P.vStop('t')]]), { body: [T0 + 0.6, T0 + 1.1, 'timbre'] });
      c.push(r.body.centroid);
    }
    out[tab] = H.median(c);
  }
  window.__pbSeed = 1;
  return out;
}, (r) => [r.violin > r.viola * 1.15 && r.viola > r.cello * 1.15, `G3 on each, spectral centroid: violin ${r.violin.toFixed(0)} Hz, viola ${r.viola.toFixed(0)} Hz, cello ${r.cello.toFixed(0)} Hz`]);

test('viola: two-hand bowing', async () => {
  const H = __pbt, P = PocketBandTest, steps = [];
  H.setup('viola', 0, 'major'); H.start(2);
  steps.push([0.2, () => P.bwDown('f', H.fingerX(4), H.stringY(1), 200)]);     // G string, 4 up: B3 (59)
  steps.push([0.3, () => P.bwDown('b', H.board().W * 0.87, H.stringY(1), 300)]);
  H.strokes(steps, 'b', 0.3, 1.8, { u: 1 });
  return H.analyse(await __pbRender(steps), { n: [0.9, 1.7, 'pitch'] });
}, (r) => [near(r.n.f, 59), fmt(r.n.f, 59)]);

// ---- trumpet ----
// Standard trumpet fingering, written out by hand (C trumpet, sounding pitch): valves pressed for each note
const TP_CHART = { 54: '123', 55: '13', 56: '23', 57: '12', 58: '1', 59: '2', 60: '', 61: '123', 62: '13', 63: '23', 64: '12', 65: '1', 66: '2', 67: '',
  68: '23', 69: '12', 70: '1', 71: '2', 72: '', 73: '12', 74: '1', 75: '2', 76: '', 77: '1', 78: '2', 79: '', 80: '23', 81: '12', 82: '1', 83: '2', 84: '' };
test('trumpet: valve fingering shown for every note F♯3 to C6', async () => {
  const P = PocketBandTest, out = {};
  for (let m = 54; m <= 84; m++) out[m] = P.tpFingering(m).map((i) => i + 1).join('');
  return out;
}, (r) => {
  const bad = Object.keys(TP_CHART).filter((m) => r[m] !== TP_CHART[m]);
  return [bad.length === 0, bad.length ? 'differs from the chart at ' + bad.map((m) => `${R.NAMES[R.pc(+m)]}${Math.floor(m / 12) - 1}: ${r[m] || 'open'} vs ${TP_CHART[m] || 'open'}`).join(', ')
    : '31 notes match the standard chart (e.g. D5: 1, C♯5: 1+2, A♭4: 2+3, F♯3: 1+2+3); the ringed valves light up as each note plays'];
});

test('trumpet: holding valves lowers the note (2: one semitone, 1+3: five)', async () => {
  const H = __pbt, P = PocketBandTest, v = (i) => document.querySelector('.valve[data-v="' + i + '"]');
  H.setup('trumpet'); P.setTonal('trumpet', 0, 'major'); H.start(2.6);
  // cells from C4 in C major: index 7 is C5
  const n = P.tpRow.notes.length, fx = 7.5 / n, steps = [
    [0.3, () => H.ptr('pointerdown', '#tptRow', fx, 0.4, 5)],
    [0.95, () => H.ptr('pointerdown', v(1), 0.5, 0.5, 6)], [1.5, () => H.ptr('pointerup', v(1), 0.5, 0.5, 6)],
    [1.6, () => { H.ptr('pointerdown', v(0), 0.5, 0.5, 7); H.ptr('pointerdown', v(2), 0.5, 0.5, 8); }],
    [2.4, () => H.ptr('pointerup', '#tptRow', fx, 0.4, 5)]];
  const r = H.analyse(await __pbRender(steps), { open: [0.5, 0.9, 'pitch'], v2: [1.1, 1.45, 'pitch'], v13: [1.8, 2.35, 'pitch'] });
  ['6', '7', '8'].forEach((id) => window.dispatchEvent(new PointerEvent('pointerup', { pointerId: +id })));
  return r;
}, (r) => [near(r.open.f, 72) && near(r.v2.f, 71) && near(r.v13.f, 67), `open ${fmt(r.open.f, 72)}, valve 2 ${fmt(r.v2.f, 71)}, valves 1+3 ${fmt(r.v13.f, 67)}`]);

test('trumpet: breath height, mute and growl', async () => {
  const H = __pbt, P = PocketBandTest, out = {}, T0 = 0.4;
  for (const [k, l, x] of [['soft', 0.3, {}], ['full', 1, {}], ['muted', 0.8, { mute: true }], ['open', 0.8, {}], ['growl', 0.8, { growl: true }]]) {
    H.setup('trumpet'); H.start(T0 + 1.3);
    const buf = await __pbRender([[T0, () => P.vStart('trumpet', 't', 67, l, x)], [T0 + 1, () => P.vStop('t')]]);
    const r = H.analyse(buf, { b: [T0 + 0.3, T0 + 0.9, 'timbre'] });
    out[k] = { centroid: r.b.centroid, rms: r.b.rms, rough: H.rough(buf, T0 + 0.3, T0 + 0.9) };
  }
  return out;
}, (r) => [r.full.centroid > 1.5 * r.soft.centroid && r.muted.rms < r.open.rms - 3 && r.growl.rough > r.open.rough + 3,
  `G4: brightness (centroid) soft ${r.soft.centroid.toFixed(0)} Hz → full breath ${r.full.centroid.toFixed(0)} Hz; mute ${(r.muted.rms - r.open.rms).toFixed(1)} dB, ` +
  `centroid ${r.open.centroid.toFixed(0)} → ${r.muted.centroid.toFixed(0)} Hz; growl: level flutter ${r.open.rough.toFixed(1)} → ${r.growl.rough.toFixed(1)} dB`]);

// ---- pipe organ ----
test('organ: no decay while held, chiff, stops, two manuals, cathedral reverb', async () => {
  const H = __pbt, P = PocketBandTest, T0 = 0.4, f = 261.63, out = {};
  const play = async (x, secs, hold, rev) => {
    H.setup('organ'); if (rev) { const el = document.getElementById('irev'); el.value = rev; el.dispatchEvent(new Event('input')); }
    H.start(secs);
    return __pbRender([[T0, () => P.vStart('organ', 'o', 60, 1, x)], [T0 + hold, () => P.vStop('o')]]);
  };
  let buf = await play({ stops: [true, true, false, false], up: 0 }, T0 + 3.4, 3);
  let r = H.analyse(buf, { early: [T0 + 0.4, T0 + 1.4], late: [T0 + 1.9, T0 + 2.9], chiff: [T0, T0 + 0.04, 'timbre'], body: [T0 + 0.5, T0 + 0.6, 'timbre'] });
  const xx = PBA.mono(buf), sr = buf.sampleRate, hi = (a, b) => PBA.db(PBA.rmsAbove(xx, sr, 3000, Math.round(a * sr), Math.round(b * sr)));
  out.hold = r.late.rms - r.early.rms; out.chiff = hi(T0 + 0.003, T0 + 0.033) - hi(T0 + 0.5, T0 + 0.6);
  const tones = async (stops) => H.analyse(await play({ stops, up: 0 }, T0 + 1.2, 1), { t: [T0 + 0.4, T0 + 0.9, 'tones', [f, 2 * f, 3 * f, 4 * f]] }).t.tones;
  out.one = await tones([true, false, false, false]); out.all = await tones([true, true, true, true]);
  out.great = H.analyse(await play({ stops: [true, true, false, false], up: 0 }, T0 + 1.2, 1), { b: [T0 + 0.4, T0 + 0.9, 'timbre'] }).b.centroid;
  out.swell = H.analyse(await play({ stops: [true, true, false, false], up: 1 }, T0 + 1.2, 1), { b: [T0 + 0.4, T0 + 0.9, 'timbre'] }).b.centroid;
  buf = await play({ stops: [true, true, false, false], up: 0 }, T0 + 7, 1, 0.6);
  r = H.analyse(buf, { held: [T0 + 0.5, T0 + 0.9] });
  out.tail = H.fall(buf, T0 + 1, r.held.rms, 40);
  return out;
}, (r) => {
  const gain = r.all.map((v, i) => v - r.one[i]);
  const ok = Math.abs(r.hold) < 0.5 && r.chiff > 6 && gain[1] > 3 && gain[2] > 3 && gain[3] > 3 && r.swell < r.great && r.tail > 2;
  return [ok, `C4 held 3 s: level in the 3rd second vs the 1st ${r.hold.toFixed(2)} dB; chiff: the first 30 ms carry ${r.chiff.toFixed(0)} dB more energy above 3 kHz than the held pipe; ` +
    `drawing 4′, 2⅔′ and 2′ raises harmonics 2, 3, 4 by ${gain.slice(1).map((g) => g.toFixed(0)).join(', ')} dB; upper manual (flutes) centroid ${r.swell.toFixed(0)} Hz vs lower (principals) ${r.great.toFixed(0)} Hz; ` +
    `cathedral: ${r.tail.toFixed(1)} s for the tail to fall 40 dB after the key is let go`, r];
});

// ---- saxophone ----
test('saxophone: soft attack, breath noise, vibrato, growl', async () => {
  const H = __pbt, P = PocketBandTest, T0 = 0.4, out = {}, f = 311.13;
  const play = async (x, secs) => { H.setup('sax'); H.start(secs); return __pbRender([[T0, () => P.vStart('sax', 's', 63, 0.65, x)], [T0 + secs - T0 - 0.2, () => P.vStop('s')]]); };
  let buf = await play({ vib: false }, T0 + 1.4);
  const r = H.analyse(buf, { env: [T0, T0 + 0.6, 'env'], t: [T0 + 0.4, T0 + 1, 'tones', [f, 1.5 * f, 2.5 * f]] });
  const env = r.env.env, tail = env.slice(80, 110), steady = 10 * Math.log10(tail.reduce((a, v) => a + Math.pow(10, v / 10), 0) / tail.length);
  out.attack = env.findIndex((v) => v >= steady - 0.92) * 0.005;
  out.noise = Math.max(r.t.tones[1], r.t.tones[2]) - r.t.tones[0];
  out.rough = H.rough(buf, T0 + 0.4, T0 + 1.1);
  buf = await play({ vib: true }, T0 + 2.4);
  const cs = H.track(buf, T0 + 1, T0 + 2, 63, 0.025);
  out.vib = (Math.max(...cs) - Math.min(...cs)) / 2;
  buf = await play({ vib: false, growl: true }, T0 + 1.4);
  out.growl = H.rough(buf, T0 + 0.4, T0 + 1.1);
  return out;
}, (r) => [r.attack >= 0.04 && r.attack <= 0.15 && r.noise > -60 && r.vib > 8 && r.vib < 30 && r.growl > r.rough + 3,
  `E♭4: attack (to 90%) ${(1000 * r.attack).toFixed(0)} ms; breath noise between the harmonics ${(-r.noise).toFixed(0)} dB below the fundamental (oscillators alone: below -90 dB); ` +
  `vibrato ±${r.vib.toFixed(1)} cents; growl: level flutter ${r.rough.toFixed(1)} → ${r.growl.toFixed(1)} dB`]);

// ---- xylophone ----
test('xylophone: short inharmonic decay, glissando swipe', async () => {
  const H = __pbt, P = PocketBandTest, T0 = 0.4, f = 523.25, out = {};
  H.setup('xylo'); P.setTonal('xylo', 0, 'major'); H.start(T0 + 1.6);
  let buf = await __pbRender([[T0, () => P.vStart('xylo', 'x', 72, 0.8, {})]]);
  const r = H.analyse(buf, { hit: [T0, T0 + 0.03], t: [T0 + 0.002, T0 + 0.05, 'tones', [3 * f, 6 * f, 6.27 * f]] });
  out.decay = H.fall(buf, T0, r.hit.peak, 40);
  out.inharm = r.t.tones[2] - r.t.tones[1]; out.twelfth = r.t.tones[0];
  // swipe from the first bar to the last in 0.6 s, one move per 60 Hz frame
  H.setup('xylo'); H.start(T0 + 1.2);
  const n0 = P.xy.n, bars = P.xy.bars.length, steps = [[T0, () => H.ptr('pointerdown', '#xylo', 0.5 / bars, 0.5, 4)]];
  for (let k = 1; k <= 36; k++) steps.push([T0 + k / 60, () => H.ptr('pointermove', '#xylo', (0.5 + (bars - 1) * k / 36) / bars, 0.5, 4)]);
  steps.push([T0 + 0.7, () => H.ptr('pointerup', '#xylo', 0.99, 0.5, 4)]);
  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 4 }));
  buf = await __pbRender(steps);
  out.hits = P.xy.n - n0; out.bars = bars;
  return out;
}, (r) => [r.decay < 1.2 && r.inharm > 10 && r.hits === r.bars,
  `C5: falls 40 dB in ${r.decay.toFixed(2)} s; untuned mode at 6.27× is ${r.inharm.toFixed(0)} dB above where a 6th harmonic would be; ` +
  `a swipe across all ${r.bars} bars struck ${r.hits} of them, once each`]);

// ---- synth ----
test('synth: presets and knobs (filter, attack, release)', async () => {
  const H = __pbt, P = PocketBandTest, T0 = 0.4, out = {};
  const play = async (x, hold, secs) => {
    H.setup('synth'); H.start(secs || T0 + hold + 2.2);
    const buf = await __pbRender([[T0, () => P.vStart('synth', 'y', 57, 0.8, x)], [T0 + hold, () => P.vStop('y')]]);
    return buf;
  };
  const k = (p, o) => Object.assign({ p }, P.SYN[p] && { cut: P.SYN[p].cut, att: P.SYN[p].att, rel: P.SYN[p].rel, vib: 0 }, o || {});
  for (const p of ['lead', 'pad', 'pluck', 'supersaw']) {
    const buf = await play(k(p), 1.5);
    const r = H.analyse(buf, { env: [T0, T0 + 1.5, 'env', 0.01], b: [T0 + 1, T0 + 1.4, 'timbre'] });
    const env = r.env.env, pk = Math.max(...env);
    out[p] = { attack: env.findIndex((v) => v >= pk - 0.92) * 0.01, end: env[env.length - 2] - pk, centroid: r.b.centroid };
  }
  const cen = async (cut) => H.analyse(await play(k('lead', { cut }), 1), { b: [T0 + 0.4, T0 + 0.9, 'timbre'] }).b.centroid;
  out.dark = await cen(30); out.bright = await cen(90);
  const tail = async (rel) => { const buf = await play(k('lead', { rel }), 0.8); const h = H.analyse(buf, { h: [T0 + 0.5, T0 + 0.8] }).h.rms; return H.fall(buf, T0 + 0.8, h, 40); };
  out.shortRel = await tail(100); out.longRel = await tail(2000);
  return out;
}, (r) => [r.pad.attack > 0.4 && r.lead.attack < 0.05 && r.pluck.end < -15 && r.lead.end > -3 && r.bright > 2 * r.dark && r.longRel > 4 * r.shortRel,
  `attack to full level: lead ${(1000 * r.lead.attack).toFixed(0)} ms, pad ${(1000 * r.pad.attack).toFixed(0)} ms; after 1.5 s held: pluck ${r.pluck.end.toFixed(0)} dB, lead ${r.lead.end.toFixed(1)} dB; ` +
  `centroid lead ${r.lead.centroid.toFixed(0)}, pad ${r.pad.centroid.toFixed(0)}, supersaw ${r.supersaw.centroid.toFixed(0)} Hz; filter knob 30% → 90%: ${r.dark.toFixed(0)} → ${r.bright.toFixed(0)} Hz; ` +
  `release knob 100 ms → 2 s: tail falls 40 dB in ${r.shortRel.toFixed(2)} s → ${r.longRel.toFixed(2)} s`]);

// ---- electric bass ----
test('electric bass: open strings, finger / pick / slap, fretted slide', async () => {
  const H = __pbt, P = PocketBandTest, T0 = 0.4, out = { open: [] };
  for (const m of [28, 33, 38, 43]) {
    H.setup('ebass'); H.start(T0 + 1.2);
    const buf = await __pbRender([[T0, () => P.vStart('ebass', 'e', m, 0.8, { mode: 'finger' })], [T0 + 1, () => P.vStop('e')]]);
    const x = PBA.mono(buf), sr = buf.sampleRate;
    out.open.push(PBA.pitch(x, sr, Math.round((T0 + 0.1) * sr), Math.round((T0 + 0.9) * sr), 30, 300).f);
  }
  for (const mode of ['finger', 'pick', 'slap']) {
    const c = [];
    for (let seed = 1; seed <= 3; seed++) {
      H.setup('ebass'); window.__pbSeed = seed; H.start(T0 + 1);
      c.push(H.analyse(await __pbRender([[T0, () => P.vStart('ebass', 'e', 40, 0.8, { mode })]]), { b: [T0 + 0.01, T0 + 0.1, 'timbre'] }).b.centroid);
    }
    out[mode] = H.median(c);
  }
  window.__pbSeed = 1;
  // A string: press at the 2nd fret, slide to the 7th (B1 to E2), through the touch handler
  H.setup('ebass'); P.setTonal('ebass', 4, 'chromatic'); H.start(T0 + 1.6);
  const fx = (fr) => (fr + 0.5) / 13, y = 1.5 / 4, steps = [[T0, () => H.ptr('pointerdown', '#ebass', fx(2), y, 3)]];
  for (let k = 1; k <= 20; k++) steps.push([T0 + 0.5 + k * 0.01, () => H.ptr('pointermove', '#ebass', fx(2 + 5 * k / 20), y, 3)]);
  steps.push([T0 + 1.4, () => H.ptr('pointerup', '#ebass', fx(7), y, 3)]);
  const buf = await __pbRender(steps), x = PBA.mono(buf), sr = buf.sampleRate;
  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 3 }));
  out.from = PBA.pitch(x, sr, Math.round((T0 + 0.1) * sr), Math.round((T0 + 0.45) * sr), 30, 300).f;
  out.to = PBA.pitch(x, sr, Math.round((T0 + 0.8) * sr), Math.round((T0 + 1.3) * sr), 30, 300).f;
  return out;
}, (r) => {
  const ok = [28, 33, 38, 43].every((m, i) => near(r.open[i], m)) && r.finger < r.pick && r.pick < r.slap && near(r.from, 35) && near(r.to, 40);
  return [ok, `open strings ${[28, 33, 38, 43].map((m, i) => fmt(r.open[i], m)).join(', ')}; attack brightness (centroid) finger ${r.finger.toFixed(0)} Hz, ` +
    `pick ${r.pick.toFixed(0)} Hz, slap ${r.slap.toFixed(0)} Hz; slide on the A string ${fmt(r.from, 35)} → ${fmt(r.to, 40)}`];
});

// ---- rhythm guitar ----
test('rhythm guitar: auto-strum timing, palm mute, muted strum', async () => {
  const H = __pbt, P = PocketBandTest, T0 = 0.4, out = {};
  // "On the beat" at 120 BPM: a down-strum every 0.5 s
  H.setup('rhythm'); P.setTonal('rhythm', 7, 'major');
  const pat = document.getElementById('rpat'); pat.value = P.RPAT.findIndex((p) => p[0] === 'down'); pat.dispatchEvent(new Event('change'));
  const bpm = document.getElementById('rbpm'); bpm.value = 120; bpm.dispatchEvent(new Event('input'));
  H.start(T0 + 2.4);
  const ticks = [[T0, () => P.rhAuto(true)], [T0 + 2.05, () => P.rhAuto(false)]];
  for (let t = T0 + 0.01; t < T0 + 2.05; t += 0.01) ticks.push([t, () => P.rhTick()]); // the scheduler's timer, in audio time
  let buf = await __pbRender(ticks);
  // onsets: the pick's attack, as a jump in energy above 2 kHz (a strum's top end dies within a few tens of ms)
  const x = PBA.mono(buf), sr = buf.sampleRate, k = Math.exp(-2 * Math.PI * 2000 / sr), hp = new Float32Array(x.length), on = [];
  let lp = 0;
  for (let i = 0; i < x.length; i++) { lp = (1 - k) * x[i] + k * lp; hp[i] = x[i] - lp; }
  const env = PBA.envelope(hp, Math.round(T0 * sr), Math.round((T0 + 2.3) * sr), Math.round(0.002 * sr));
  for (let i = 3; i < env.length; i++) if (env[i] - env[i - 3] > 10 && (!on.length || i * 0.002 - on[on.length - 1] > 0.2)) on.push(i * 0.002);
  out.onsets = on; pat.value = 0; pat.dispatchEvent(new Event('change'));
  const strum = async (palm, mute) => {
    H.setup('rhythm'); P.rh.palm = palm; H.start(T0 + 1.4);
    const b = await __pbRender([[T0, () => P.rhStrum('s', 1, 0.75, mute)]]);
    P.rh.palm = false;
    const r = H.analyse(b, { a: [T0, T0 + 0.05], b: [T0 + 0.02, T0 + 0.11, 'timbre'] });
    return { fall: H.fall(b, T0, r.a.peak, 30), centroid: r.b.centroid };
  };
  out.open = await strum(false, false); out.palm = await strum(true, false); out.mute = await strum(false, true);
  return out;
}, (r) => {
  const gaps = r.onsets.slice(1).map((t, i) => t - r.onsets[i]), worst = Math.max(...gaps.map((g) => Math.abs(g - 0.5)));
  const ok = r.onsets.length === 5 && worst < 0.01 && r.palm.fall < r.open.fall / 2 && r.palm.centroid < r.open.centroid && r.mute.fall < 0.15;
  return [ok, `120 BPM, on the beat: ${r.onsets.length} strums, ${gaps.map((g) => (1000 * g).toFixed(0)).join(' / ')} ms apart; ` +
    `time to fall 30 dB: open ${r.open.fall.toFixed(2)} s, palm-muted ${r.palm.fall.toFixed(2)} s (centroid ${r.open.centroid.toFixed(0)} → ${r.palm.centroid.toFixed(0)} Hz), muted strum ${r.mute.fall.toFixed(2)} s`];
});

// ---- every newer instrument: lifting the finger fades the note out cleanly ----
test('release: every newer instrument fades out cleanly when the finger lifts', async () => {
  const H = __pbt, P = PocketBandTest, T0 = 0.4, out = {};
  const cases = {
    trumpet: ['#tptRow', 0.3, 0.4], sax: ['#saxRow', 0.3, 0.4], viola: null, organ: ['#man0 .mkey:nth-of-type(4)', 0.5, 0.6],
    synth: ['#synKeys .mkey:nth-of-type(4)', 0.5, 0.6], xylo: ['#xylo', 0.3, 0.6], ebass: ['#ebass', 0.3, 0.6], rhythm: null
  };
  for (const tab in cases) {
    H.setup(tab); H.start(T0 + 2);
    const c = cases[tab], lift = T0 + 0.8;
    const steps = c ? [[T0, () => H.ptr('pointerdown', c[0], c[1], c[2], 2)], [lift, () => H.ptr('pointerup', c[0], c[1], c[2], 2)]]
      : tab === 'viola' ? [[T0, () => P.vStart('viola', 'v', 62, 0.7, { vib: true })], [lift, () => P.vStop('v')]]
      // the rhythm neck tells a tap from a swipe on a short real-time timer, which an offline render can't follow;
      // the live suite (npm test) covers the gesture, so here the strum is played directly
      : [[T0, () => P.rhStrum('r', 1, 0.75, false, 0)], [lift, () => P.vStop('r')]];
    const buf = await __pbRender(steps), r = H.analyse(buf, { held: [lift - 0.15, lift] });
    out[tab] = { gone: H.fall(buf, lift, r.held.peak, 50), burst: H.fadeBurst(buf, lift - 0.3, lift, lift, lift + 0.6) };
  }
  return out;
}, (r) => [Object.values(r).every((x) => x.gone < 0.8 && x.burst < 12),
  'time from lifting the finger to 50 dB down, and the largest burst of energy above 7 kHz during the fade compared with the held note: ' +
  Object.keys(r).map((k) => `${k} ${(1000 * r[k].gone).toFixed(0)} ms (${r[k].burst >= 0 ? '+' : ''}${r[k].burst.toFixed(1)} dB)`).join('; ')]);

// ---- shared note limit and recording ----
test('note limit: the newer instruments share the limit', async () => {
  const H = __pbt, P = PocketBandTest, out = {};
  for (const [tab, x] of [['organ', { stops: [true, true, true, true], up: 0 }], ['synth', { p: 'supersaw', cut: 78, att: 15, rel: 600, vib: 0 }], ['xylo', {}]]) {
    H.setup(tab); H.start(1);
    await __pbRender([[0.3, () => { for (let i = 0; i < 20; i++) P.vStart(tab, 'n' + i, 48 + i, 0.8, x); }]]);
    out[tab] = P.voices();
    for (let i = 0; i < 20; i++) P.vStop('n' + i);
  }
  return out;
}, (r) => [Object.values(r).every((v) => v <= 14), Object.keys(r).map((k) => `${k}: 20 notes started, ${r[k]} sounding (limit 14)`).join('; ')]);

test('record and play back: every newer instrument', async () => {
  const H = __pbt, P = PocketBandTest, out = {}, $ = (s) => document.querySelector(s);
  const g = { trumpet: '#tptRow', sax: '#saxRow', viola: '#bowed', organ: '#man0 .mkey', synth: '#synKeys .mkey', xylo: '#xylo', ebass: '#ebass', rhythm: '#rneck' };
  for (const tab in g) {
    H.setup(tab); H.start(2); P.init();
    $('#rec').click();
    H.ptr('pointerdown', g[tab], 0.3, 0.5, 11); H.ptr('pointermove', g[tab], 0.6, 0.6, 11);
    await new Promise((res) => setTimeout(res, 60));
    H.ptr('pointerup', g[tab], 0.6, 0.6, 11); window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 11 }));
    $('#rec').click();
    const evs = P.rec().filter((e) => e.type === 'v'), starts = evs.filter((e) => e.op === 'start');
    const canPlay = !$('#play').disabled;
    $('#play').click();
    await new Promise((res) => setTimeout(res, 150));
    const played = P.played();
    if (!$('#play').disabled && $('#play').textContent === 'Stop') $('#play').click();
    out[tab] = { events: evs.length, starts: starts.length, tab: starts.every((e) => e.tab === tab), canPlay, played: played.filter((t) => t === tab).length };
  }
  return out;
}, (r) => [Object.values(r).every((x) => x.starts > 0 && x.tab && x.canPlay && x.played > 0),
  Object.keys(r).map((k) => `${k}: ${r[k].events} events recorded, ${r[k].played} notes replayed`).join('; ')]);

// ---- master limiter ----
test('limiter: chords and stacked notes never clip', async () => {
  const H = __pbt, P = PocketBandTest, out = {};
  const cases = {
    'piano 3-note chord (vel 0.7)': () => P.noteOn('c', 60, 0.7, 'piano', [0, 4, 7]),
    '14 organ notes at full velocity': () => { for (let i = 0; i < 5; i++) P.noteOn('o' + i, 48 + 3 * i, 1, 'organ', [0, 4, 7]); },
    'drum pad: 4 hits at once, full velocity': () => [0, 2, 3, 7].forEach((i) => P.ehit('electro', i, 1)),
    'tabla Dha + Dhin together': () => { P.tabla('Na', 1); P.tabla('Ge', 1); }
  };
  for (const vol of [1, 1.5]) for (const k in cases) {
    P.open(k.startsWith('drum') ? 'epad' : k.startsWith('tabla') ? 'tabla2' : 'piano');
    H.start(2); P.setVolume(vol);
    const r = H.analyse(await __pbRender([[0.3, cases[k]]]), {});
    out[k + ' @ ' + Math.round(vol * 100) + '%'] = { peak: r.__peak, clipped: r.__clipped, voices: P.voices() };
  }
  return out;
}, (r) => {
  const ok = Object.values(r).every((x) => !x.clipped && x.peak <= -0.9);
  return [ok, Object.keys(r).map((k) => `${k}: peak ${r[k].peak.toFixed(2)} dBFS`).join('; '), r];
});

(async () => {
  const browser = await launch();
  const { page, context } = await openApp(browser);
  await page.evaluate(`(${PAGE_LIB.toString()})()`);
  const report = [];
  let failed = 0;
  for (const t of TESTS) {
    const r = await page.evaluate(t.plan, t.arg);
    const [ok, detail, data] = t.check(r);
    if (!ok) failed++;
    report.push({ name: t.name, ok, detail, data });
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${t.name}\n      ${detail}`);
  }
  await context.close();
  await browser.close();
  fs.mkdirSync(path.join(__dirname, 'results'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, 'results', 'instruments.json'), JSON.stringify(report, null, 1));
  console.log(`\n${TESTS.length - failed}/${TESTS.length} passed`);
  process.exit(failed ? 1 : 0);
})();
