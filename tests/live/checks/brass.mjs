// Check 8. Brass and reeds (trumpet, French horn, saxophone): the tone must get brighter as the player blows
// harder (spectral centroid rising from soft to medium to full breath on the same note), and nothing may crackle:
// no clipped samples, no sample-to-sample jump far beyond the steps around it (a click), no burst of energy above
// 8 kHz well over the note's own (crackle), through held notes, a legato slide over the whole row and a breath swell.
import { sleep, nowFrame, stats } from '../harness.mjs';
import { INSTRUMENTS, noteTargets } from '../instruments.mjs';
import { row, pool } from '../common.mjs';

const BOX = { horn: '#horn', trumpet: '#tptRow', sax: '#saxRow' };
const MAX_JUMP = 3;     // largest sample step in a 20 ms frame over the median of its neighbours
const MAX_BURST = 12;   // energy above 8 kHz in any frame over the median frame, dB

export default async function brass({ browser, base, workers, tabs }) {
  const list = INSTRUMENTS.filter((i) => i.brass && (!tabs || tabs.includes(i.tab)));
  const tasks = list.map((ins) => ({
    tab: ins.tab, check: 'brass',
    run: async ({ page, touch }) => {
      const sr = await page.evaluate(() => window.__rec.sr), t = await page.evaluate(noteTargets, { tab: ins.tab });
      const box = await page.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { left: r.left, top: r.top, w: r.width, h: r.height }; }, BOX[ins.tab]);
      const note = t[3] || t[0], errs = [], cen = [], all = [];
      for (const fy of [0.92, 0.5, 0.05]) { // soft, medium, full breath (higher up blows harder)
        const f0 = await nowFrame(page);
        await touch.down(1, note.x, box.top + box.h * fy); await sleep(800); await touch.up(1); await sleep(300);
        const s = await stats(page, f0 + Math.round(0.25 * sr), f0 + Math.round(0.75 * sr));
        cen.push(s.cen); all.push(s);
      }
      if (!(cen[0] < cen[1] * 0.97 && cen[1] < cen[2] * 0.97)) errs.push(`brightness does not rise with breath: centroid ${cen.map((c) => c.toFixed(0)).join(' / ')} Hz`);
      // legato slide across the whole row at full breath, then a breath swell on one note
      let f0 = await nowFrame(page);
      await touch.down(1, box.left + 4, box.top + box.h * 0.1);
      for (let k = 1; k <= 30; k++) { await touch.move(1, box.left + 4 + (box.w - 8) * k / 30, box.top + box.h * 0.1); await sleep(25); }
      for (let k = 0; k <= 20; k++) { await touch.move(1, box.left + box.w - 6, box.top + box.h * (0.1 + 0.85 * Math.abs(Math.sin(k / 20 * Math.PI)))); await sleep(30); }
      await touch.up(1); await sleep(400);
      all.push(await stats(page, f0, f0 + Math.round(2.2 * sr)));
      const clip = all.reduce((a, s) => a + s.clip, 0), jump = Math.max(...all.map((s) => s.jump)), burst = Math.max(...all.map((s) => s.burst)), peak = Math.max(...all.map((s) => s.peak));
      if (clip) errs.push(`${clip} clipped samples`);
      if (jump > MAX_JUMP) errs.push(`a sample jump ${jump.toFixed(1)} x the steps around it (a click)`);
      if (burst > MAX_BURST) errs.push(`a burst above 8 kHz ${burst.toFixed(1)} dB over the note (crackle)`);
      return row('brass', ins.tab, !errs.length, (errs.length ? errs.join('; ') + ' · ' : '') +
        `centroid soft/medium/full ${cen.map((c) => c.toFixed(0)).join(' / ')} Hz, largest jump ${jump.toFixed(1)} x neighbours, worst 8 kHz burst ${burst.toFixed(1)} dB, peak ${peak.toFixed(1)} dBFS, ${clip} clipped`,
        { centroid: cen.map((c) => Math.round(c)), jump: +jump.toFixed(2), burst: +burst.toFixed(1), peak: +peak.toFixed(2), clip });
    }
  }));
  return pool(browser, base, tasks, workers);
}
