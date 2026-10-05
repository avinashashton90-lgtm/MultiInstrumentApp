// Check 9. Record and playback, on every instrument with a Record button: press Record, play three notes, stop,
// press Play, and the playback must sound the same notes (pitch within 10 cents, or the same chord notes on the
// rhythm guitar) at the same moments.
import { sleep } from '../harness.mjs';
import { INSTRUMENTS, noteTargets } from '../instruments.mjs';
import { row, pool, dryReverb, setToggle, NAMES, pc, midiOf } from '../common.mjs';

const HOLD = 320, GAP = 160;

// In the page: pitch (or chord notes) in a window starting `win` ms after each frame in `starts`
function measureAt({ starts, win, fmax, chord }) {
  const R = window.__rec, sr = R.sr;
  return starts.map((s) => {
    const a = s + Math.round(win[0] * sr / 1000), b = s + Math.round(win[1] * sr / 1000), x = R.get(a, b);
    let e = 0; for (const v of x) e += v * v;
    const rms = Math.sqrt(e / x.length);
    if (!chord) return { f: rms > 1e-4 ? PBA.pitch(x, sr, 0, x.length, 40, fmax).f : 0, rms };
    const P = [], N = x.length;
    for (let m = 38; m < 80; m++) {
      const f = 440 * Math.pow(2, (m - 69) / 12), cw = 2 * Math.cos(2 * Math.PI * f / sr); let s1 = 0, s2 = 0;
      for (let k = 0; k < N; k++) { const s0 = x[k] * (0.5 - 0.5 * Math.cos(2 * Math.PI * k / (N - 1))) + cw * s1 - s2; s2 = s1; s1 = s0; }
      P[m] = 10 * Math.log10((s1 * s1 + s2 * s2 - cw * s1 * s2) / (N * N) + 1e-30);
    }
    const top = Math.max(...P.slice(38));
    // the three strongest pitch classes among the local peaks (a strummed triad)
    const peaks = P.map((v, m) => [m, v]).filter(([m, v]) => m >= 38 && v > top - 20 && v >= (P[m - 1] || -999) && v >= (P[m + 1] || -999) && ![12, 19, 24, 28].some((d) => P[m - d] > v - 3)).sort((p, q) => q[1] - p[1]);
    const pcs = [...new Set(peaks.map(([m]) => m % 12))].slice(0, 3).sort((p, q) => p - q);
    return { pcs, rms, spec: P.slice(38).map((v) => Math.max(0, v - top + 40)) };
  });
}

export default async function record({ browser, base, workers, tabs }) {
  const recTabs = ['piano', 'harmonica', 'violin', 'cello', 'horn', 'trumpet', 'viola', 'organ', 'sax', 'xylo', 'synth', 'ebass', 'rhythm'];
  const list = INSTRUMENTS.filter((i) => recTabs.includes(i.tab) && (!tabs || tabs.includes(i.tab)));
  const tasks = list.map((ins) => ({
    tab: ins.tab, check: 'record', prep: ({ page }) => dryReverb(page),
    run: async ({ page, touch }) => {
      await setToggle(page, touch, 'bvib', false); await setToggle(page, touch, 'sxvib', false);
      const errs = [];
      const btn = async (id) => { await page.locator('#' + id).scrollIntoViewIfNeeded(); const b = await page.locator('#' + id).boundingBox(); await touch.tap(b.x + b.width / 2, b.y + b.height / 2, 30); };
      const all = await page.evaluate(noteTargets, { tab: ins.tab });
      const targets = ins.tab === 'rhythm' ? [all[0], all[0], all[0]] : [all[0], all[Math.min(2, all.length - 1)], all[Math.min(4, all.length - 1)]];
      const chord = ins.tab === 'rhythm', fmax = ins.tab === 'guitar' || ins.tab === 'ebass' ? 1000 : 2600;
      const win = [Math.max(60, ins.win[0]), Math.min(HOLD - 20, Math.max(ins.win[1], ins.win[0] + 90))];
      await btn('rec');
      if (await page.evaluate(() => document.getElementById('rec').getAttribute('aria-pressed')) !== 'true') return row('record', ins.tab, false, 'Record did not start');
      const m0 = await page.evaluate(() => window.__rec.marks.length);
      for (const t of targets) { await touch.down(1, t.x, t.y); await sleep(HOLD); await touch.up(1); await sleep(GAP); }
      const downs = (await page.evaluate((m0) => window.__rec.marks.slice(m0).filter((m) => m.type === 'down').map((m) => m.f), m0));
      await btn('rec');
      await sleep(1200);
      if (await page.evaluate(() => document.getElementById('play').disabled)) return row('record', ins.tab, false, 'Play stayed disabled after recording');
      const m1 = await page.evaluate(() => window.__rec.marks.length);
      await btn('play');
      const up = await page.evaluate((m1) => (window.__rec.marks.slice(m1).find((m) => m.type === 'up') || {}).f, m1);
      await sleep(3 * (HOLD + GAP) + 600);
      const live = await page.evaluate(measureAt, { starts: downs, win, fmax, chord });
      const back = await page.evaluate(measureAt, { starts: downs.map((f) => up + (f - downs[0])), win, fmax, chord });
      const desc = [];
      for (let k = 0; k < targets.length; k++) {
        const a = live[k], b = back[k];
        if (!b || b.rms < 1e-3) { errs.push(`note ${k + 1} silent in playback`); continue; }
        if (chord) {
          // the same chord notes: the semitone spectra of the strum and its playback match closely
          const dot = a.spec.reduce((p, v, i) => p + v * b.spec[i], 0), n2 = (v) => Math.sqrt(v.reduce((p, q) => p + q * q, 0));
          const sim = dot / (n2(a.spec) * n2(b.spec) || 1);
          if (sim < 0.85) errs.push(`strum ${k + 1}: played ${a.pcs.map((p) => NAMES[p]).join(' ')}, playback ${b.pcs.map((p) => NAMES[p]).join(' ')} (match ${sim.toFixed(2)})`);
          desc.push('match ' + sim.toFixed(2));
        } else {
          const c = 1200 * Math.log2(b.f / a.f);
          if (!a.f || !b.f || Math.abs(c) > 10) errs.push(`note ${k + 1}: played ${a.f.toFixed(1)} Hz, playback ${b.f.toFixed(1)} Hz`);
          desc.push(NAMES[pc(midiOf(b.f))]);
        }
      }
      return row('record', ins.tab, !errs.length, errs.length ? errs.join('; ') : `recorded ${targets.length} ${chord ? 'strums' : 'notes'} and played back the same (${desc.join(' ')}) at the same times`);
    }
  }));
  return pool(browser, base, tasks, workers);
}
