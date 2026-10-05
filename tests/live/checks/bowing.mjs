// Check 7. Violin, viola and cello bowing: one finger bows in the Bow area while it travels from the top string to
// the bottom one, and each string must sound in turn (its own pitch, read from the recording). The bow resting
// between two strings must play both at once (a double stop). And a finger held on the fingerboard must set the
// pitch of the string being bowed.
import { sleep, nowFrame, waitFrame } from '../harness.mjs';
import { INSTRUMENTS } from '../instruments.mjs';
import { row, pool, dryReverb, setToggle, NAMES, pc } from '../common.mjs';

// In the page: the strongest notes (MIDI, not overtones of a stronger one) between two frames
function notesIn({ f0, f1, lo, hi }) {
  const R = window.__rec, sr = R.sr, x = R.get(f0, f1), hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const g = (f) => { const n = x.length, w = 2 * Math.cos(2 * Math.PI * f / sr); let s1 = 0, s2 = 0;
    for (let i = 0; i < n; i++) { const s0 = x[i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1))) + w * s1 - s2; s2 = s1; s1 = s0; }
    return 10 * Math.log10((s1 * s1 + s2 * s2 - w * s1 * s2) / (n * n) + 1e-20); };
  const e = {}; for (let m = lo - 1; m <= hi + 1; m++) e[m] = g(hz(m));
  const top = Math.max(...Object.values(e)), out = [];
  for (let m = lo; m <= hi; m++) if (e[m] > top - 18 && e[m] >= e[m - 1] && e[m] >= e[m + 1] && ![12, 19, 24].some((d) => e[m - d] > e[m] - 10)) out.push([m, e[m]]);
  return out.sort((a, b) => b[1] - a[1]).map(([m, v]) => ({ m, db: +(v - top).toFixed(1) }));
}

export default async function bowing({ browser, base, workers, tabs }) {
  const list = INSTRUMENTS.filter((i) => i.bowed && (!tabs || tabs.includes(i.tab)));
  const tasks = list.map((ins) => ({
    tab: ins.tab, check: 'bowing', prep: ({ page }) => dryReverb(page),
    run: async ({ page, touch }) => {
      await setToggle(page, touch, 'bvib', false);
      const g = await page.evaluate(() => {
        const z = document.querySelector('#bowed .bzone').getBoundingClientRect();
        const rows = [...document.querySelectorAll('#bowed .brow')].map((r) => { const b = r.getBoundingClientRect(); return { y: b.top + b.height / 2, h: b.height, name: r.querySelector('.sn').textContent.trim(),
          mark: (() => { const m = r.querySelectorAll('.bmark')[2]; if (!m) return null; const q = m.getBoundingClientRect(); return { x: q.left + q.width / 2, m: +m.dataset.m, name: m.textContent.trim() }; })() }; });
        return { zx: z.left + z.width * 0.3, zw: z.width * 0.4, rows };
      });
      const sr = await page.evaluate(() => window.__rec.sr);
      const lo = ins.tab === 'cello' ? 33 : 45, hi = ins.tab === 'cello' ? 80 : 95;
      // Bow back and forth (about 0.7 px/ms, a steady stroke) for `ms` at height y, then measure the last 300 ms
      let bowY = null;
      const bow = async (y, ms) => {
        if (bowY === null) { await touch.down(7, g.zx, y); bowY = y; }
        const t0 = Date.now(); let k = 0;
        while (Date.now() - t0 < ms) { k++; const x = g.zx + g.zw * (0.5 + 0.5 * Math.sin(k * 0.45)); await touch.move(7, x, y + (k % 2)); await sleep(12); }
        const f1 = await nowFrame(page);
        await waitFrame(page, f1);
        return page.evaluate(notesIn, { f0: f1 - Math.round(0.3 * sr), f1, lo, hi });
      };
      const errs = [], info = [];
      // 1. across the strings, top to bottom, one bow stroke
      const heard = [];
      for (let i = 0; i < 4; i++) {
        const n = await bow(g.rows[i].y, i ? 550 : 800);
        const want = NAMES.indexOf(g.rows[i].name.replace('#', '♯'));
        heard.push(n.length ? NAMES[pc(n[0].m)] : '-');
        if (!n.length || pc(n[0].m) !== want) errs.push(`bowing on the ${g.rows[i].name} string played ${n.length ? NAMES[pc(n[0].m)] : 'nothing'}`);
      }
      info.push(`bow across the strings: ${heard.join(' ')}`);
      // 2. double stop: the bow between the second and third strings
      const mid = (g.rows[1].y + g.rows[2].y) / 2;
      const ds = await bow(mid, 900);
      const pair = [g.rows[1].name, g.rows[2].name].map((s) => NAMES.indexOf(s));
      const got = ds.filter((n) => n.db > -18).map((n) => pc(n.m)); // both strings among the strong notes (bowed equal power; the body favours one)
      if (!pair.every((p) => got.includes(p))) errs.push(`double stop ${g.rows[1].name}+${g.rows[2].name} played ${got.map((p) => NAMES[p]).join('+') || 'nothing'}`);
      else info.push(`double stop ${g.rows[1].name}+${g.rows[2].name} both sound (${ds.slice(0, 2).map((n) => n.db).join(', ')} dB)`);
      // 3. a finger on the fingerboard sets the pitch of the bowed string
      const r2 = g.rows[1];
      if (r2.mark) {
        await touch.down(8, r2.mark.x, r2.y);
        const fn = await bow(r2.y, 700);
        await touch.up(8);
        if (!fn.length || pc(fn[0].m) !== pc(r2.mark.m)) errs.push(`finger on ${r2.mark.name} with the bow on that string played ${fn.length ? NAMES[pc(fn[0].m)] : 'nothing'}`);
        else info.push(`finger on ${r2.mark.name} + bow plays ${NAMES[pc(fn[0].m)]}`);
      }
      await touch.up(7);
      return row('bowing', ins.tab, !errs.length, (errs.length ? errs.join('; ') + ' · ' : '') + info.join(', '));
    }
  }));
  return pool(browser, base, tasks, workers);
}
