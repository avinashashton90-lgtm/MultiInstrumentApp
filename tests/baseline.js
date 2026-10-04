// Plays the same gestures through the UI (pointer and key events only) of any version of the app, so the
// before / after numbers in TESTING.md are like for like.
//   node tests/baseline.js <index.html> [out.json]   e.g. the pre-fix file from git, then the current one
'use strict';
const fs = require('fs');
const path = require('path');
const { launch } = require('./lib/browser');
const { measure } = require('./lib/measure');

const html = path.resolve(process.argv[2] || '');
if (!fs.existsSync(html)) { console.error('usage: node tests/baseline.js path/to/index.html [out.json]'); process.exit(1); }
const outFile = path.resolve(process.argv[3] || path.join(__dirname, 'results', 'baseline.json'));

// In-page plan: open the instrument's audio, then play one gesture at 0.05 s and measure the next second
function gesturePlan(a) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const $ = (s) => document.querySelector(s);
  const key = (k, type) => window.dispatchEvent(new KeyboardEvent(type || 'keydown', { key: k }));
  const before = async () => {
    $('.card[data-tab="' + a.tab + '"]').click(); await sleep(260); // the card tap creates the audio context
    if (a.key !== undefined) { const s = $(a.keySel) || $('#key'); s.value = a.key; s.dispatchEvent(new Event('change')); }
  };
  const steps = [];
  const on = 0.4, off = on + (a.hold || 0.8); // after the master compressor has settled
  if (a.kb) { steps.push([on, () => key(a.kb)]); steps.push([off, () => key(a.kb, 'keyup')]); }
  else {
    steps.push([on, () => __pbPtr('pointerdown', $(a.sel), a.fx, a.fy, 7)]);
    steps.push([off, () => __pbPtr('pointerup', $(a.sel), a.fx, a.fy, 7)]);
  }
  return { seconds: 1.9, before, steps, windows: [['n', on, on + 1, a.pitch ? 'pitch' : 'spectrum', { fmin: 40 }]] };
}

const LOUD = [
  ['Piano C4 (grand)', { tab: 'piano', sel: '[data-midi="60"]', fx: 0.5, fy: 0.5 }],
  ['Drums kick', { tab: 'drums', kb: 'a' }], ['Drums snare', { tab: 'drums', kb: 's' }],
  ['Drums closed hat', { tab: 'drums', kb: 'd' }], ['Drums low tom', { tab: 'drums', kb: 'g' }],
  ['Drums high tom', { tab: 'drums', kb: 'h' }], ['Drums clap', { tab: 'drums', kb: 'j' }],
  ['Drums crash', { tab: 'drums', kb: 'k' }],
  ['Tabla Na', { tab: 'tabla2', kb: 'j' }], ['Tabla Tun', { tab: 'tabla2', kb: 'l' }],
  ['Tabla bayan Ge', { tab: 'tabla2', kb: 'a' }], ['Tabla bayan Ke', { tab: 'tabla2', kb: 's' }],
  ['Drum pad Kick (mid hit)', { tab: 'epad', sel: '.epadb[data-i="0"]', fx: 0.5, fy: 0.5 }],
  ['Drum pad Snare (mid hit)', { tab: 'epad', sel: '.epadb[data-i="2"]', fx: 0.5, fy: 0.5 }],
  ['Drum pad Closed hat (mid hit)', { tab: 'epad', sel: '.epadb[data-i="4"]', fx: 0.5, fy: 0.5 }],
  ['Drum pad Sub (mid hit)', { tab: 'epad', sel: '.epadb[data-i="14"]', fx: 0.5, fy: 0.5 }],
  ['Guitar string 2 (steel)', { tab: 'guitar', sel: '#neck', fx: 0.5, fy: 2.5 / 6 }],
  ['Flute', { tab: 'flute', sel: '#flute', fx: 0.3, fy: 0.5 }],
  ['Harmonica hole 4 blow', { tab: 'harmonica', sel: '#harp', fx: 0.35, fy: 0.25 }],
  ['Violin (held, A string)', { tab: 'violin', sel: '#bowed', fx: 0.3, fy: 2.5 / 4 }],
  ['Cello (held, D string)', { tab: 'cello', sel: '#bowed', fx: 0.3, fy: 2.5 / 4 }],
  ['French horn (mid breath)', { tab: 'horn', sel: '#horn', fx: 0.2, fy: 0.5 }]
];

const KEYS = [
  // Positions chosen so the nearest scale note differs between C major and D major (F vs F# on the violin's
  // D string, C vs C# on the cello's G string) once snapping to the scale exists
  ['Violin', { tab: 'violin', sel: '#bowed', fx: 0.197, fy: 1.5 / 4, keySel: '#nkey' }],
  ['Cello', { tab: 'cello', sel: '#bowed', fx: 0.296, fy: 1.5 / 4, keySel: '#nkey' }],
  ['Flute', { tab: 'flute', sel: '#flute', fx: 0.03, fy: 0.5, keySel: '#fkey' }],
  ['French horn', { tab: 'horn', sel: '#horn', fx: 0.02, fy: 0.5, keySel: '#nkey' }],
  ['Harmonica', { tab: 'harmonica', sel: '#harp', fx: 0.05, fy: 0.25, keySel: '#nkey' }]
];

(async () => {
  const browser = await launch();
  const res = { loudness: [], keys: [], strings: [] };
  for (const [name, a] of LOUD) {
    const r = await measure(browser, { html, tab: a.tab }, gesturePlan, a);
    res.loudness.push({ name, peak: r.n.peak, rms: r.n.rms, rmsPhone: r.n.rmsPhone, above200: r.n.above200 });
    console.log(name.padEnd(32), 'peak', r.n.peak.toFixed(1), 'rms', r.n.rms.toFixed(1), 'phone-band rms', r.n.rmsPhone.toFixed(1));
  }
  for (const [name, a] of KEYS) {
    const row = { name };
    for (const k of [0, 2]) {
      const r = await measure(browser, { html, tab: a.tab }, gesturePlan, Object.assign({ key: k, pitch: true }, a));
      row['key' + k] = r.n.f;
    }
    res.keys.push(row);
    console.log(name.padEnd(12), 'key C', row.key0.toFixed(2), 'Hz   key D', row.key2.toFixed(2), 'Hz');
  }
  for (const tab of ['violin', 'cello']) {
    for (let s = 0; s < 4; s++) {
      const r = await measure(browser, { html, tab }, gesturePlan, { tab, sel: '#bowed', fx: 0.004, fy: (s + 0.5) / 4, pitch: true });
      res.strings.push({ tab, string: s, f: r.n.f });
      console.log(tab, 'open string', s, r.n.f.toFixed(2), 'Hz');
    }
  }
  await browser.close();
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(res, null, 1));
})();
