// Check 4. Stuck notes: hold a note, then end it four ways (lift the finger, a touch cancel from the system, the
// app going to the background, and a touch-end that reports no fingers left while a finger is still logged as
// down), and the output must be silent (below -60 dBFS) within 1 s. Reverbs are turned off for this check so the
// test hears notes, not the room.
import { sleep, nowFrame, stats } from '../harness.mjs';
import { INSTRUMENTS, noteTargets } from '../instruments.mjs';
import { row, pool, dryReverb } from '../common.mjs';

const SILENT = -60;
const WAYS = {
  lift: async (page, touch) => { await touch.up(1); },
  cancel: async (page, touch) => { await touch.cancel(); },
  background: async (page, touch) => {
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
    await sleep(50);
    await page.evaluate(() => { delete document.hidden; });
  },
  'no fingers': async (page) => { await page.evaluate(() => window.dispatchEvent(new TouchEvent('touchend', { bubbles: true }))); }
};

export default async function stuck({ browser, base, workers, tabs }) {
  const list = INSTRUMENTS.filter((i) => i.pitched && (!tabs || tabs.includes(i.tab)));
  const tasks = list.map((ins) => ({
    tab: ins.tab, check: 'stuck', prep: ({ page }) => dryReverb(page),
    run: async ({ page, touch }) => {
      const sr = await page.evaluate(() => window.__rec.sr), t = await page.evaluate(noteTargets, { tab: ins.tab });
      const p = t[Math.min(2, t.length - 1)], res = {};
      for (const [way, end] of Object.entries(WAYS)) {
        await touch.down(1, p.x, p.y); await sleep(450);
        const f0 = await nowFrame(page);
        await end(page, touch);
        await sleep(1300);
        if (touch.pts.size) await touch.cancel(); // tidy up a finger the test itself still holds
        const s = await stats(page, f0 + Math.round(1.0 * sr), f0 + Math.round(1.25 * sr));
        const before = await stats(page, f0 - Math.round(0.2 * sr), f0);
        res[way] = { after: Math.max(...s.frames), during: before.rms };
        await sleep(200);
      }
      const bad = Object.entries(res).filter(([, r]) => r.after > SILENT);
      const quiet = Object.values(res).every((r) => r.during < -50);
      return row('stuck', ins.tab, !bad.length && !quiet,
        quiet ? 'no sound while the note was held' : bad.length ? bad.map(([w, r]) => `${w}: still ${r.after.toFixed(0)} dBFS after 1 s`).join('; ')
          : 'silent within 1 s after ' + Object.entries(res).map(([w, r]) => `${w} (${r.after < -150 ? 'silence' : r.after.toFixed(0) + ' dBFS'})`).join(', '),
        Object.fromEntries(Object.entries(res).map(([w, r]) => [w, +r.after.toFixed(1)])));
    }
  }));
  return pool(browser, base, tasks, workers);
}
