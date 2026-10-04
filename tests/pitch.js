// Key x scale test: every melodic instrument, all 12 keys, all 10 scales. Each case plays a run of notes
// through the instrument's own touch handlers, measures the fundamental of each, and checks it against the
// reference note (within 5 cents) and the on-screen label. Also checks that the 12 keys give 12 different roots.
//   node tests/pitch.js [--only=violin,horn] [--keys=0,7]
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, openApp } = require('./lib/browser');
const R = require('./lib/reference');

const TOL = 5; // cents
const arg = (k) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.split('=')[1].split(',') : null; };
const TABS = arg('only') || ['piano', 'guitar', 'flute', 'harmonica', 'violin', 'cello', 'horn'];
const KEYS = (arg('keys') || [...Array(12).keys()]).map(Number);
const SCALES = arg('scales') || R.SCALE_NAMES;

// In the page: play one case and return what was heard and shown for each note
async function playCase({ tab, key, scale }) {
  const P = window.PocketBandTest, $ = (s) => document.querySelector(s);
  const input = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('input')); };
  P.open(tab);
  input('rev', 0);                                   // no reverb tails between notes
  if (document.body.matches('[data-tab="harmonica"],[data-tab="violin"],[data-tab="cello"],[data-tab="horn"]')) input('irev', 0);
  if ($('#bvib').getAttribute('aria-pressed') === 'true') $('#bvib').click(); // steady pitch for measuring
  P.setTonal(tab, key, scale);
  const G = [];                                      // gestures: { down, up, label, info }
  const centre = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
  const at = (board, cx, cy) => { const r = board.getBoundingClientRect(); return [(cx - r.left) / r.width, (cy - r.top) / r.height]; };
  const tap = (el, fx, fy, label, info) => G.push({ down: () => __pbPtr('pointerdown', el, fx, fy, 5), up: () => __pbPtr('pointerup', el, fx, fy, 5), label, info });
  const n = P.T.iv(scale).length;
  if (tab === 'piano') {
    const keys = [...document.querySelectorAll('#piano [data-midi]')].sort((a, b) => centre(a).x - centre(b).x);
    // the chromatic layout may start on the white key below a black root
    const start = keys.findIndex((k) => P.T.pc(+k.dataset.midi) === key);
    keys.slice(start, start + n + 1).forEach((k) => tap(k, 0.5, k.classList.contains('bkey') ? 0.4 : 0.6, k.textContent, k.classList.contains('bkey') ? 'black' : ''));
  } else if (tab === 'flute' || tab === 'horn') {
    const board = $('#' + tab), cells = [...board.querySelectorAll(tab === 'flute' ? '.fcell' : '.hcell')];
    cells.slice(0, n + 1).forEach((c, i) => tap(board, (i + 0.5) / cells.length, 0.5, c.textContent));
  } else if (tab === 'harmonica') {
    const board = $('#harp'), cols = board.querySelectorAll('.hcol');
    for (let i = 0; i < 5; i++) for (const draw of [false, true]) {
      tap(board, (i + 0.5) / 10, draw ? 0.75 : 0.25, cols[i].children[draw ? 2 : 0].firstChild.textContent, (draw ? 'draw ' : 'blow ') + (i + 1));
    }
  } else if (tab === 'violin' || tab === 'cello') {
    const board = $('#bowed'), row = P.bw.rows[1];
    [...row.querySelectorAll('.bmark')].forEach((mk) => {
      const c = centre(mk), f = at(board, c.x, c.y);
      tap(board, f[0], 1.5 / 4, mk.querySelector('b').textContent);
    });
  } else if (tab === 'guitar') {
    $('[data-chord="0"]').click();
    for (let i = 0; i < P.gtr.n; i++) {
      const muted = P.gtrMidi(i) < 0;
      G.push({ down: muted ? () => {} : () => P.pluck(i, 0.7, 'g'), up: () => P.gtrRelease('g'), label: P.gtr.strEls[i].lastChild.textContent, info: muted ? 'muted' : 'string ' + (i + 1) });
    }
  }
  const PRE = 0.3, LEN = 0.75, GAP = 0.3, steps = [], wins = [];
  G.forEach((g, i) => {
    const t = PRE + i * (LEN + GAP);
    steps.push([t, g.down], [t + LEN, g.up]);
    wins.push(tab === 'guitar' ? [t + 0.08, t + 0.6] : [t + 0.25, t + LEN - 0.02]);
  });
  P.reset();
  window.__pbSeconds = PRE + G.length * (LEN + GAP) + 0.2;
  P.init();
  const buf = await __pbRender(steps), x = PBA.mono(buf), sr = buf.sampleRate;
  const chord = tab === 'guitar' ? $('[data-chord="0"]').textContent : null;
  return {
    chord,
    notes: G.map((g, i) => {
      const a = Math.round(wins[i][0] * sr), b = Math.round(wins[i][1] * sr);
      const q = g.info === 'muted' ? { f: 0, clarity: 0 } : PBA.pitch(x, sr, a, b, 50, 2500);
      return { f: q.f, clarity: q.clarity, label: g.label, info: g.info || '', level: PBA.db(PBA.rms(buf, a, b)) };
    })
  };
}

// Reference notes for a case
function expected(tab, key, scale) {
  const n = R.SCALES[scale].length;
  switch (tab) {
    case 'piano': return R.run(48 + key, scale, n + 1);          // C3 octave, starting on the key's root
    case 'flute': return R.run(60 + key, scale, n + 1);          // flute starts on the root from C4
    case 'horn': return R.run(48 + key, scale, n + 1);           // horn starts on the root from C3
    case 'harmonica': {
      const root = 55 + R.pc(key - 55);                           // harps run from G3 to F#4
      const out = [];
      for (let i = 0; i < 5; i++) out.push(root + R.seventh(scale, R.HARP_BLOW[i]), root + R.seventh(scale, R.HARP_DRAW[i]));
      return out;
    }
    case 'violin': case 'cello': {
      const open = tab === 'violin' ? 62 : 43;                    // second string: violin D4, cello G2
      const out = [];
      for (let m = open + 1; m <= open + 14; m++) if (R.SCALES[scale].includes(R.pc(m - key))) out.push(m);
      return out;
    }
  }
  return null;
}

function checkCase(tab, key, scale, res) {
  const errs = [], measured = [];
  if (tab === 'guitar') {
    const tri = R.tonicTriad(key, scale);
    if (res.chord !== tri.name) errs.push(`first chord button is ${res.chord}, expected ${tri.name}`);
    let bass = null;
    res.notes.forEach((nt) => {
      if (nt.info === 'muted') return;
      const m = Math.round(69 + 12 * Math.log2(nt.f / 440)), c = R.cents(nt.f, m);
      measured.push(c);
      if (bass === null) bass = m;
      if (Math.abs(c) > TOL) errs.push(`${nt.info}: ${nt.f.toFixed(2)} Hz is ${c.toFixed(1)} cents off ${R.NAMES[R.pc(m)]}`);
      if (!tri.pcs.includes(R.pc(m))) errs.push(`${nt.info}: plays ${R.NAMES[R.pc(m)]}, not in ${tri.name}`);
      if (nt.label !== R.NAMES[R.pc(m)]) errs.push(`${nt.info}: label ${nt.label} but plays ${R.NAMES[R.pc(m)]}`);
    });
    if (bass === null || R.pc(bass) !== tri.root) errs.push('lowest string is not the chord root');
    return { errs, measured, root: bass === null ? 0 : R.freq(bass) * Math.pow(2, 0) };
  }
  const exp = expected(tab, key, scale);
  if (exp.length !== res.notes.length) errs.push(`${res.notes.length} notes on screen, expected ${exp.length}`);
  res.notes.forEach((nt, i) => {
    if (i >= exp.length) return;
    const c = R.cents(nt.f, exp[i]);
    measured.push(c);
    if (!(Math.abs(c) <= TOL)) errs.push(`note ${i + 1} ${nt.info}: ${nt.f.toFixed(2)} Hz, expected ${R.freq(exp[i]).toFixed(2)} (${c.toFixed(1)} cents)`);
    const name = R.NAMES[R.pc(exp[i])];
    const lbl = nt.label.replace(/\d+$/, '');
    if (nt.info !== 'black' && lbl !== name) errs.push(`note ${i + 1}: label "${nt.label}", expected ${name}`);
  });
  return { errs, measured, root: res.notes[0] ? res.notes[0].f : 0 };
}

(async () => {
  const t0 = Date.now();
  const browser = await launch();
  const cases = [];
  for (const tab of TABS) for (const scale of SCALES) for (const key of KEYS) cases.push({ tab, key, scale });
  const results = [];
  const WORKERS = 4;
  let next = 0;
  await Promise.all([...Array(WORKERS)].map(async () => {
    const { page, context } = await openApp(browser);
    while (next < cases.length) {
      const c = cases[next++];
      const res = await page.evaluate(playCase, c);
      const chk = checkCase(c.tab, c.key, c.scale, res);
      results.push(Object.assign({}, c, chk, { notes: res.notes, chord: res.chord }));
      if (chk.errs.length) console.log(`FAIL ${c.tab} key ${R.NAMES[c.key]} ${c.scale}: ${chk.errs.slice(0, 3).join('; ')}`);
    }
    await context.close();
  }));
  await browser.close();

  // Different keys must give different pitches: the 12 keys must give 12 different sets of sounding notes
  const distinct = [];
  for (const tab of TABS) for (const scale of SCALES) {
    const sigs = results.filter((r) => r.tab === tab && r.scale === scale)
      .map((r) => r.notes.filter((n) => n.f > 0).map((n) => (69 + 12 * Math.log2(n.f / 440)).toFixed(1)).join(' '));
    // A fretless board in the chromatic scale offers every semitone in every key, so only there the sets match
    const fretlessChromatic = (tab === 'violin' || tab === 'cello') && scale === 'chromatic';
    const ok = fretlessChromatic || (sigs.length === KEYS.length && new Set(sigs).size === sigs.length);
    distinct.push({ tab, scale, ok });
    if (!ok) console.log(`FAIL ${tab} ${scale}: keys do not give ${KEYS.length} different sets of notes`);
  }

  const summary = TABS.map((tab) => {
    const rs = results.filter((r) => r.tab === tab), all = [].concat(...rs.map((r) => r.measured));
    const abs = all.map(Math.abs);
    return { tab, cases: rs.length, notes: all.length, failed: rs.filter((r) => r.errs.length).length,
             maxCents: Math.max(...abs), meanCents: abs.reduce((a, b) => a + b, 0) / abs.length,
             keysDistinct: distinct.filter((d) => d.tab === tab).every((d) => d.ok) };
  });
  console.log('\ninstrument  cases  notes  failed  worst(c)  mean(c)  keys distinct');
  summary.forEach((s) => console.log(s.tab.padEnd(11), String(s.cases).padStart(5), String(s.notes).padStart(6), String(s.failed).padStart(7),
    s.maxCents.toFixed(2).padStart(9), s.meanCents.toFixed(2).padStart(8), '  ' + (s.keysDistinct ? 'yes' : 'NO')));
  fs.mkdirSync(path.join(__dirname, 'results'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, 'results', 'pitch.json'), JSON.stringify({ summary, failures: results.filter((r) => r.errs.length).map((r) => ({ tab: r.tab, key: r.key, scale: r.scale, errs: r.errs })) }, null, 1));
  console.log(`\n${results.length} cases in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  process.exit(summary.every((s) => s.failed === 0 && s.keysDistinct) ? 0 : 1);
})();
