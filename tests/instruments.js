// Behaviour tests: violin / cello tuning, timbre and two-hand bowing, the French horn, and the master limiter.
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
    if (tab === 'violin' || tab === 'cello') {
      if ($('#bvib').getAttribute('aria-pressed') === 'true') $('#bvib').click();
      P.setTonal(tab, key, scale);
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
for (const [tab, open] of [['violin', [55, 62, 69, 76]], ['cello', [36, 43, 50, 57]]]) {
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
  const H = __pbt, P = PocketBandTest, out = {};
  for (const tab of ['violin', 'cello']) {
    H.setup(tab, 0, 'major'); H.start(2);
    P.vStart(tab, 't', 55, 0.6, { vib: false });
    const r = H.analyse(await __pbRender([[1.5, () => P.vStop('t')]]), { body: [0.7, 1.4, 'timbre'], env: [0, 1.4, 'env'] });
    // attack: time to reach 90% (-0.9 dB) of the steady level
    const env = r.env.env, steady = r.body.rms, i90 = env.findIndex((v) => v >= steady - 0.92);
    out[tab] = { centroid: r.body.centroid, above2k: r.body.above2k, attack: i90 * 0.005 };
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
  const H = __pbt, P = PocketBandTest, $ = (s) => document.querySelector(s), out = {};
  for (const [k, l, stop] of [['soft', 0.3, false], ['loud', 1, false], ['mid', 0.65, false], ['stopped', 0.65, true]]) {
    H.setup('horn');
    if (($('#hstop').getAttribute('aria-pressed') === 'true') !== stop) $('#hstop').click();
    H.start(2.4);
    P.vStart('horn', 'h', 53, l, {});
    const r = H.analyse(await __pbRender([[2.2, () => P.vStop('h')]]), { body: [0.3, 0.5, 'timbre'], env: [0, 0.6, 'env'] });
    // attack: from the start of the note to 90% of its steady level
    const env = r.env.env, tail = env.slice(60, 120), steady = 10 * Math.log10(tail.reduce((a, v) => a + Math.pow(10, v / 10), 0) / tail.length);
    const i90 = env.findIndex((v) => v >= steady - 0.92);
    out[k] = { centroid: r.body.centroid, rms: r.body.rms, attack: i90 * 0.005 };
  }
  // vibrato depth: re-render a mid note and track pitch frame by frame
  H.setup('horn'); if ($('#hstop').getAttribute('aria-pressed') === 'true') $('#hstop').click();
  H.start(2.2); P.vStart('horn', 'h', 53, 0.65, {});
  const buf = await __pbRender([]), x = PBA.mono(buf), sr = buf.sampleRate, fs = [];
  for (let t = 1.0; t < 2.0; t += 0.025) fs.push(PBA.pitch(x, sr, Math.round(t * sr), Math.round((t + 0.06) * sr), 50, 1000).f);
  const cs = fs.map((f) => 1200 * Math.log2(f / 174.614));
  out.vibrato = (Math.max(...cs) - Math.min(...cs)) / 2;
  if ($('#hstop').getAttribute('aria-pressed') === 'true') $('#hstop').click();
  return out;
}, (r) => {
  const ok = r.mid.attack >= 0.08 && r.mid.attack <= 0.15 && r.loud.centroid > r.soft.centroid * 1.3 && r.vibrato > 2 && r.vibrato < 15 &&
    r.stopped.centroid > r.mid.centroid && r.stopped.rms < r.mid.rms;
  return [ok, `attack (to 90%) ${(1000 * r.mid.attack).toFixed(0)} ms; brightness (centroid) soft ${r.soft.centroid.toFixed(0)} Hz → full breath ${r.loud.centroid.toFixed(0)} Hz; ` +
    `vibrato ±${r.vibrato.toFixed(1)} cents; hand-stop ${(r.stopped.rms - r.mid.rms).toFixed(1)} dB quieter and brighter (${r.stopped.centroid.toFixed(0)} Hz vs ${r.mid.centroid.toFixed(0)} Hz)`, r];
});

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
