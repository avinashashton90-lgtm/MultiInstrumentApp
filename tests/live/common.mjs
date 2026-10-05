// Shared pieces for the checks: an independent music-theory reference (written from the definitions, not copied
// from the app), result rows, and a small pool that spreads work over several browser pages.
import { openApp, waitAudio, sleep } from './harness.mjs';
import { noteTargets, percTargets } from './instruments.mjs';

export const NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
export const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], harmonic: [0, 2, 3, 5, 7, 8, 11], melodic: [0, 2, 3, 5, 7, 9, 11],
  penta: [0, 2, 4, 7, 9], minpenta: [0, 3, 5, 7, 10], blues: [0, 3, 5, 6, 7, 10], dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10], chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
};
export const SCALE_LABEL = {
  major: 'Major', minor: 'Natural minor', harmonic: 'Harmonic minor', melodic: 'Melodic minor', penta: 'Major pentatonic',
  minpenta: 'Minor pentatonic', blues: 'Blues', dorian: 'Dorian', mixolydian: 'Mixolydian', chromatic: 'Chromatic'
};
export const PARENT = { penta: 'major', minpenta: 'minor', blues: 'minor', chromatic: 'major' };
export const SCALE_NAMES = Object.keys(SCALES);
export const pc = (m) => ((Math.round(m) % 12) + 12) % 12;
export const midiOf = (f) => 69 + 12 * Math.log2(f / 440);
export const inScale = (m, key, scale) => SCALES[scale].includes(pc(m - key));
export const describe = (key, scale) => NAMES[key] + ' ' + SCALE_LABEL[scale] + ': ' + SCALES[scale].map((i) => NAMES[(key + i) % 12]).join(' ');
// Nearest scale note to m (a tie goes to the lower note)
export function snap(m, key, scale) {
  for (let d = 0; d <= 6; d++) { if (inScale(m - d, key, scale)) return m - d; if (inScale(m + d, key, scale)) return m + d; }
  return m;
}
export function tonicTriad(key, scale) {
  const s = SCALES[scale].length === 7 ? SCALES[scale] : SCALES[PARENT[scale]], third = s[2], fifth = s[4];
  const q = third === 4 ? (fifth === 8 ? '+' : '') : (fifth === 6 ? 'dim' : 'm');
  return { pcs: [key, key + third, key + fifth].map(pc), root: key, name: NAMES[key] + q, iv: [0, third, fifth] };
}
// Chord template match on a 12-bin chroma (energy per pitch class over the strings' fundamental range): the
// major or minor triad whose three notes stand out most from the other nine
export function bestChord(chroma) {
  const c = chroma.map((v) => 10 * Math.log10(v + 1e-20));
  let best = null;
  for (let r = 0; r < 12; r++) for (const [q, iv] of [['', [0, 4, 7]], ['m', [0, 3, 7]]]) {
    const tones = iv.map((i) => (r + i) % 12), inn = tones.reduce((a, t) => a + c[t], 0) / 3;
    const out = c.filter((_, k) => !tones.includes(k)).reduce((a, b) => a + b, 0) / 9;
    if (!best || inn - out > best.score) best = { name: NAMES[r] + q, score: inn - out };
  }
  return best.name;
}

export function row(check, tab, pass, detail, metrics) { return { check, tab, pass: !!pass, detail: detail || '', metrics: metrics || {} }; }

// Run tasks over `workers` pages. task: { tab, run(ctx) }; each worker keeps one page and reopens it on the
// task's instrument when it changes. ctx = { page, touch, log, base }.
export async function pool(browser, base, tasks, workers, onDone) {
  let next = 0;
  const results = [];
  await Promise.all([...Array(Math.min(workers, tasks.length))].map(async () => {
    let cur = null;
    while (next < tasks.length) {
      const task = tasks[next++];
      try {
        if (!cur || cur.tab !== task.tab || task.fresh) {
          if (cur) await cur.context.close();
          cur = await openApp(browser, base, { tab: task.tab });
          cur.tab = task.tab;
          if (task.prep) await task.prep(cur); // settings to make before the first sound (reverbs off, say)
          await warm(cur, task.tab);
        }
        const r = await task.run(cur);
        results.push(...[].concat(r));
        if (onDone) onDone(task, r);
      } catch (e) {
        const r = row(task.check || '?', task.tab, false, 'error: ' + (e && e.message || e).split('\n')[0]);
        results.push(r); if (onDone) onDone(task, [r]);
        if (cur) { await cur.context.close().catch(() => {}); cur = null; }
      }
    }
    if (cur) await cur.context.close();
  }));
  return results;
}

// Wake the app's audio with a first touch (as on a phone, the first touch starts the sound), quietly
export async function warm(cur, tab) {
  const { page, touch } = cur;
  await page.waitForFunction(() => document.body.dataset.screen === 'play');
  let t = await page.evaluate(noteTargets, { tab });
  if (!t.length) t = await page.evaluate(percTargets, { tab });
  if (t.length) await touch.tap(t[0].x, t[0].y, 30);
  await waitAudio(page);
  await sleep(450); // the master limiter's start-up bridge
}

// Turn the reverbs off through their real sliders (the global one in Settings and the instrument's own)
export async function dryReverb(page) {
  await page.evaluate(() => {
    for (const id of ['rev', 'irev']) { const el = document.getElementById(id); if (el) { el.value = 0; el.dispatchEvent(new Event('input', { bubbles: true })); } }
  });
}
// Press a toggle button (the real one) until it shows the wanted state
export async function setToggle(page, touch, id, on) {
  const st = await page.evaluate((id) => { const b = document.getElementById(id); return b && b.offsetParent ? b.getAttribute('aria-pressed') : null; }, id);
  if (st === null || (st === 'true') === on) return;
  await page.locator('#' + id).scrollIntoViewIfNeeded(); // the top bar scrolls sideways on a narrow screen
  const bb = await page.locator('#' + id).boundingBox();
  await touch.tap(bb.x + bb.width / 2, bb.y + bb.height / 2, 30);
}
