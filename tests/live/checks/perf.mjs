// Check 11. Performance: main-thread time each note costs (from Chrome's own counters while ten notes are tapped
// one after another) and the frame rate while ten fingers hold notes for two seconds. Headless Chromium on a
// desktop CPU is faster than a phone, so the limits are set well inside what a phone needs: under 8 ms of work per
// note and at least 50 frames a second.
import { sleep } from '../harness.mjs';
import { INSTRUMENTS, noteTargets, percTargets } from '../instruments.mjs';
import { row, pool } from '../common.mjs';

const MAX_MS = 8, MIN_FPS = 50;

export default async function perf({ browser, base, workers, tabs }) {
  const list = INSTRUMENTS.filter((i) => !tabs || tabs.includes(i.tab));
  // one page at a time so the instruments don't compete for the CPU
  const tasks = list.map((ins) => ({
    tab: ins.tab, check: 'perf', fresh: true,
    run: async ({ page, touch }) => {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Performance.enable');
      const metric = async () => { const m = (await cdp.send('Performance.getMetrics')).metrics; const g = (k) => (m.find((x) => x.name === k) || {}).value || 0; return g('TaskDuration') * 1000; };
      let t = ins.pitched ? await page.evaluate(noteTargets, { tab: ins.tab }) : await page.evaluate(percTargets, { tab: ins.tab });
      // the idle cost of the page over the same time, to subtract
      const i0 = await metric(); await sleep(1000); const idle = (await metric()) - i0;
      const m0 = await metric(), w0 = Date.now();
      for (let k = 0; k < 10; k++) { const p = t[k % t.length]; await touch.down(1, p.x, p.y); await sleep(60); await touch.up(1); await sleep(40); }
      const busy = (await metric()) - m0 - idle * (Date.now() - w0) / 1000;
      const perNote = Math.max(0, busy / 10);
      // ten fingers held (or as many places as there are) and the frame rate meanwhile
      const n = Math.min(10, t.length);
      for (let k = 0; k < n; k++) await touch.down(10 + k, t[k].x + (k >= t.length ? 2 : 0), t[k].y);
      const fps = await page.evaluate(() => new Promise((res) => { let f = 0; const t0 = performance.now(); (function tick(now) { f++; if (now - t0 < 2000) requestAnimationFrame(tick); else res(f / ((now - t0) / 1000)); })(t0); }));
      const voices = await page.evaluate(() => window.__pbStats().voices);
      await touch.upAll();
      await cdp.detach();
      const errs = [];
      if (perNote > MAX_MS) errs.push(`${perNote.toFixed(1)} ms of main-thread work per note (limit ${MAX_MS})`);
      if (fps < MIN_FPS) errs.push(`${fps.toFixed(0)} frames/s with ${n} fingers down (limit ${MIN_FPS})`);
      return row('perf', ins.tab, !errs.length, (errs.length ? errs.join('; ') + ' · ' : '') + `${perNote.toFixed(1)} ms per note, ${fps.toFixed(0)} frames/s with ${n} fingers (${voices} voices)`, { perNote: +perNote.toFixed(2), fps: +fps.toFixed(1) });
    }
  }));
  return pool(browser, base, tasks, 1);
}
