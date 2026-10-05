// Loudness of every instrument and pad: one medium-velocity note each, measured at the app's output.
//   node tests/loudness.js              measure at the default master volume, write tests/results/loudness.json
//   node tests/loudness.js --calibrate  work out the LEVEL trims in index.html so each note peaks at -3 dBFS
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, openApp, ROOT } = require('./lib/browser');


// Runs in the page. vol: master volume. Returns one row per sound.
async function measureAll(vol) {
  const P = window.PocketBandTest, S = [], PRE = 0.3; // notes start after the limiter has settled
  const sel = (id, v) => { const s = document.getElementById(id); s.value = v; s.dispatchEvent(new Event('change')); };
  const ptr = (type, id, fx, fy) => __pbPtr(type, document.getElementById(id), fx, fy, 3);
  document.querySelectorAll('#inst option').forEach((o) => S.push({ name: 'Piano: ' + o.textContent, path: ['piano', o.value], tab: 'piano',
    on: () => P.noteOn('n', 60, 0.7, o.value, [0]), off: () => P.noteOff('n') }));
  ['acoustic', 'electro'].forEach((kit) => P.PADS.forEach((p) => S.push({ name: 'Drums (' + kit + '): ' + p.name, path: ['drums', kit, p.id], tab: 'drums',
    on: () => P.drum(p.id, 0.7, kit) })));
  Object.keys(P.BOLS).forEach((b) => S.push({ name: 'Tabla: ' + b + (['Ge', 'Ga', 'Ke'].includes(b) ? ' (bayan)' : ' (dayan)'), path: ['tabla', b], tab: 'tabla2',
    on: () => P.tabla(b, 0.7) }));
  S.push({ name: 'Tabla: tanpura drone', path: ['tanpura'], tab: 'tabla2', seconds: 4, target: -9, // a backing drone sits lower
    on: () => P.setDrone(true), off: () => P.setDrone(false), hold: 3.5 });
  Object.keys(P.EKITS).forEach((kit) => P.EKITS[kit].pads.forEach((p, i) => S.push({ name: 'Drum pad (' + kit + '): ' + p[0], path: ['epad', kit, i], tab: 'epad',
    on: () => P.ehit(kit, i, 0.7) })));
  document.querySelectorAll('#gsound option').forEach((o) => S.push({ name: 'Guitar: ' + o.textContent, path: ['guitar', o.value], tab: 'guitar',
    setup: () => sel('gsound', o.value), on: () => P.pluck(2, 0.7, 'g'), off: () => P.gtrRelease('g'), hold: 1.2 }));
  S.push({ name: 'Flute (mid breath)', path: ['flute'], tab: 'flute', on: () => ptr('pointerdown', 'flute', 0.3, 0.5), off: () => ptr('pointerup', 'flute', 0.3, 0.5) });
  S.push({ name: 'Harmonica (hole 4 blow)', path: ['harmonica'], tab: 'harmonica', on: () => P.vStart('harmonica', 'h', P.hmNote(3, false), 0.9, {}), off: () => P.vStop('h') });
  [['violin', 69], ['cello', 50]].forEach(([tab, m]) => {
    S.push({ name: tab[0].toUpperCase() + tab.slice(1) + ' (bowed, medium bow)', path: [tab, 'bow'], tab, on: () => P.vStart(tab, 'b', m, 0.6, { vib: true }), off: () => P.vStop('b') });
    S.push({ name: tab[0].toUpperCase() + tab.slice(1) + ' (pizzicato)', path: [tab, 'pizz'], tab, on: () => P.vStart(tab, 'p', m, 0.9, { pizz: true }), off: () => P.vStop('p') });
  });
  S.push({ name: 'French horn (mid breath)', path: ['horn'], tab: 'horn', on: () => P.vStart('horn', 'h', 53, 0.65, {}), off: () => P.vStop('h') });

  // Hits use random noise and plucks a random excitation, so each sound is played REPS times and the median kept
  const REPS = 5, med = (a) => a.slice().sort((p, q) => p - q)[a.length >> 1];
  const out = [];
  for (const s of S) {
    const runs = [];
    for (let k = 0; k < REPS; k++) {
      P.open(s.tab);
      if (s.setup) s.setup();
      P.reset();
      window.__pbSeconds = PRE + (s.seconds || 2);
      window.__pbSeed = k + 1;           // a different, repeatable random draw each time
      P.init(); P.setVolume(vol);
      const steps = [[PRE, s.on]];
      if (s.off) steps.push([PRE + (s.hold || 0.8), s.off]);
      const buf = await __pbRender(steps), sr = buf.sampleRate, a = Math.round(PRE * sr);
      const x = PBA.mono(buf);
      runs.push({ peak: PBA.db(PBA.peak(buf, a)), rms: PBA.db(PBA.activeRms(buf, a, buf.length, sr)),
                  rms1s: PBA.db(PBA.rms(buf, a, a + sr)), above200: PBA.energyAbove(x, sr, 200, a, buf.length) });
    }
    const row = { name: s.name, path: s.path, target: s.target || -3 };
    ['peak', 'rms', 'rms1s', 'above200'].forEach((k) => { row[k] = med(runs.map((r) => r[k])); });
    row.peakSpread = Math.max(...runs.map((r) => r.peak)) - Math.min(...runs.map((r) => r.peak));
    out.push(row);
  }
  return out;
}

function getIn(o, p) { return p.reduce((a, k) => a[k], o); }
function setIn(o, p, v) { const last = p[p.length - 1]; getIn(o, p.slice(0, -1))[last] = v; }

function formatLevel(L) {
  const r = (v) => Number(v.toPrecision(3));
  const lines = Object.keys(L).map((k) => {
    const v = L[k];
    if (typeof v === 'number') return '    ' + k + ': ' + r(v);
    const inner = Object.keys(v).map((kk) => {
      const x = v[kk];
      if (typeof x === 'number') return kk + ': ' + r(x);
      if (Array.isArray(x)) return '\n      ' + kk + ': [' + x.map(r).join(', ') + ']';
      return '\n      ' + kk + ': { ' + Object.keys(x).map((q) => q + ': ' + r(x[q])).join(', ') + ' }';
    });
    const nested = inner.some((s) => s.startsWith('\n'));
    return '    ' + k + ': { ' + inner.join(', ') + (nested ? '\n    }' : ' }');
  });
  return '{\n' + lines.join(',\n') + '\n  }';
}

(async () => {
  const calibrate = process.argv.includes('--calibrate');
  const browser = await launch();
  const file = path.join(ROOT, 'index.html');
  let rows;
  for (let pass = 0; pass < (calibrate ? 3 : 1); pass++) {
    const { page, context } = await openApp(browser);
    // Calibrate at half volume (-6 dB) so every note stays below the limiter and scales linearly
    const vol = calibrate ? 0.5 : 1;
    rows = await page.evaluate(measureAll, vol);
    if (calibrate) {
      const L = await page.evaluate(() => window.PocketBandTest.level());
      const half = 20 * Math.log10(0.5);
      let worst = 0;
      rows.forEach((r) => {
        const err = (r.target + half) - r.peak;
        worst = Math.max(worst, Math.abs(err));
        setIn(L, r.path, getIn(L, r.path) * Math.pow(10, err / 20));
      });
      let html = fs.readFileSync(file, 'utf8');
      html = html.replace(/\/\*LEVEL\*\/[\s\S]*?\/\*END LEVEL\*\//, '/*LEVEL*/' + formatLevel(L) + '/*END LEVEL*/');
      fs.writeFileSync(file, html);
      console.log('pass', pass + 1, 'largest correction', worst.toFixed(2), 'dB');
    }
    await context.close();
  }
  if (calibrate) { await browser.close(); return; }
  rows.forEach((r) => console.log(r.name.padEnd(40), 'peak', r.peak.toFixed(1).padStart(6), ' rms', r.rms.toFixed(1).padStart(6), ' >200Hz', (100 * r.above200).toFixed(0).padStart(3) + '%'));
  fs.mkdirSync(path.join(__dirname, 'results'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, 'results', 'loudness.json'), JSON.stringify(rows, null, 1));
  await browser.close();
})();
