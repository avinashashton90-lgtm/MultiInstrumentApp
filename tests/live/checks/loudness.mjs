// Check 3. Loudness and clipping, every instrument at its normal settings: three notes (or pads) played at a
// medium touch, held 0.9 s. Peak, RMS and clipped samples (|x| >= 0.999) of the live output.
// Pass: no clipped samples, peak at or below -1 dBFS (with 0.1 dB of slack), RMS no quieter than -30 dBFS,
// and trumpet and French horn within 2.5 dB of -16 dBFS RMS.
import { sleep, nowFrame, stats } from '../harness.mjs';
import { INSTRUMENTS, noteTargets, percTargets } from '../instruments.mjs';
import { row, pool } from '../common.mjs';

const TARGET = { trumpet: -16, horn: -16 };
const MIN_RMS = -30;

// Where to touch for a medium-strength note: the vertical middle of a row cell (breath / velocity), else the target
export async function mediumTargets(page, ins) {
  let t = ins.pitched ? await page.evaluate(noteTargets, { tab: ins.tab }) : await page.evaluate(percTargets, { tab: ins.tab });
  if (ins.kind === 'row' && ins.tab !== 'harmonica') {
    const box = await page.evaluate((tab) => { const el = document.querySelector({ flute: '#flute', horn: '#horn', trumpet: '#tptRow', sax: '#saxRow', xylo: '#xylo' }[tab]); const r = el.getBoundingClientRect(); return { top: r.top, h: r.height }; }, ins.tab);
    t = t.map((p) => ({ ...p, y: box.top + box.h * 0.5 }));
  }
  if (ins.tab === 'rhythm') t = [t[0], t[0], t[0]];
  const pick = t.length >= 5 ? [0, Math.floor(t.length / 2), t.length - 1] : t.slice(0, 3);
  return pick.map((i) => (typeof i === 'number' ? t[i] : i));
}

export async function playHeld(page, touch, targets, hold = 900, gap = 350) {
  const out = [];
  for (const p of targets) {
    const f0 = await nowFrame(page);
    await touch.down(1, p.x, p.y); await sleep(hold); await touch.up(1); await sleep(gap);
    out.push(f0);
  }
  return out;
}

export default async function loudness({ browser, base, workers, tabs }) {
  const list = INSTRUMENTS.filter((i) => !tabs || tabs.includes(i.tab));
  const tasks = list.map((ins) => ({
    tab: ins.tab, check: 'loudness',
    run: async ({ page, touch }) => {
      const targets = await mediumTargets(page, ins), sr = await page.evaluate(() => window.__rec.sr);
      const starts = await playHeld(page, touch, targets);
      const st = [];
      for (const f0 of starts) st.push(await stats(page, f0, f0 + Math.round(1.2 * sr)));
      // RMS while the note sounds: frames within 20 dB of the note's loudest frame, from the start to 0.9 s
      const noteRms = st.map((s) => {
        const fr = s.frames.slice(0, 45), top = Math.max(...fr), on = fr.filter((v) => v > top - 20);
        return 10 * Math.log10(on.reduce((a, v) => a + Math.pow(10, v / 10), 0) / Math.max(1, on.length));
      });
      const rms = 10 * Math.log10(noteRms.reduce((a, v) => a + Math.pow(10, v / 10), 0) / noteRms.length);
      const peak = Math.max(...st.map((s) => s.peak)), clip = st.reduce((a, s) => a + s.clip, 0);
      const errs = [];
      if (clip) errs.push(`${clip} clipped samples`);
      if (peak > -0.9) errs.push(`peak ${peak.toFixed(1)} dBFS is above -1 dBFS`);
      if (rms < MIN_RMS) errs.push(`too quiet: RMS ${rms.toFixed(1)} dBFS (minimum ${MIN_RMS})`);
      if (TARGET[ins.tab] !== undefined && Math.abs(rms - TARGET[ins.tab]) > 2.5) errs.push(`RMS ${rms.toFixed(1)} dBFS, target ${TARGET[ins.tab]} ± 2.5`);
      return row('loudness', ins.tab, !errs.length, (errs.length ? errs.join('; ') + ' · ' : '') + `peak ${peak.toFixed(1)} dBFS, RMS ${rms.toFixed(1)} dBFS, ${clip} clipped`,
        { peak: +peak.toFixed(2), rms: +rms.toFixed(2), clip, notes: noteRms.map((v) => +v.toFixed(1)) });
    }
  }));
  return pool(browser, base, tasks, workers);
}
