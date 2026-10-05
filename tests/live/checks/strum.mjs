// Check 6. Strumming on Guitar and Rhythm guitar: a finger swipes down, up, down, up… at 4 strums a second (a short
// 30 px flick each time, as a player does) and every strum must be heard. Down and up must alternate, and they must
// sound different the way a real guitar does: a down-strum starts on the low strings and is louder; an up-strum
// starts on the high strings, barely touches the low ones and is softer. The big ▼ Down / ▲ Up pads are checked too.
import { sleep, nowFrame, waitFrame } from '../harness.mjs';
import { INSTRUMENTS } from '../instruments.mjs';
import { row, pool, dryReverb } from '../common.mjs';

const RATE = 4, STRUMS = 8;

// In the page: per strum, its level, how far it rises over what was ringing, when its lowest and its highest note
// start, and how strong the low note is against the high one once the old ring is muted. The chord's notes are
// found from the recording itself (Goertzel energy per semitone on the down-strums), not taken from the app.
function analyse({ f0, marks, dirs }) {
  const R = window.__rec, sr = R.sr, x = R.get(f0, marks[marks.length - 1] + Math.round(0.35 * sr));
  const ms = (t) => Math.round(t * sr / 1000), hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const db = (v) => 10 * Math.log10(v + 1e-20), mean = (e) => e.reduce((p, q) => p + q, 0) / Math.max(1, e.length);
  const goertzel = (f, a, b) => { // power at f over [a, b), Hann window
    a = Math.max(0, a); b = Math.min(x.length, b); const n = b - a, w = 2 * Math.cos(2 * Math.PI * f / sr); let s1 = 0, s2 = 0;
    for (let i = 0; i < n; i++) { const s0 = x[a + i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1))) + w * s1 - s2; s2 = s1; s1 = s0; }
    return (s1 * s1 + s2 * s2 - w * s1 * s2) / (n * n);
  };
  const rms = (a, b) => { let e = 0; for (let i = a; i < b; i++) e += x[i] * x[i]; return e / Math.max(1, b - a); };
  // the chord's notes: local peaks within 30 dB of the strongest, not an octave, twelfth or two octaves of a stronger one
  const count = {};
  marks.forEach((m, k) => {
    if (dirs[k] < 0) return;
    const c = m - f0, e = []; for (let n = 38; n <= 84; n++) e[n] = db(goertzel(hz(n), c + ms(40), c + ms(200)));
    const top = Math.max(...e.filter(Number.isFinite));
    for (let n = 40; n < 84; n++) if (e[n] > top - 20 && e[n] >= e[n - 1] && e[n] >= e[n + 1] && ![12, 19, 24].some((d) => e[n - d] > e[n] - 6)) count[n] = (count[n] || 0) + 1;
  });
  // a chord note is one heard clearly in at least three of the four down-strums
  const downs = dirs.filter((d) => d > 0).length, notes = Object.keys(count).filter((n) => count[n] >= downs * 0.75).map(Number).sort((p, q) => p - q);
  // the spectra of the down- and up-strums, each averaged and set to 0 dB at its strongest semitone: the low chord
  // notes (the lower half of the down-strums' peaks) should be much weaker in the up-strums
  const spec = (want) => { const acc = []; marks.forEach((m, k) => { if (dirs[k] !== want) return; const c = m - f0;
    for (let n = 40; n <= 90; n++) acc[n] = (acc[n] || 0) + goertzel(hz(n), c + ms(80), c + ms(200)); });
    const d = acc.map((v) => db(v)), top = Math.max(...d.filter(Number.isFinite)); return d.map((v) => v - top); };
  const D = spec(1), U = spec(-1), peaks = [];
  for (let n = 41; n < 90; n++) if (D[n] > -25 && D[n] >= D[n - 1] && D[n] >= D[n + 1]) peaks.push(n);
  const lower = peaks.slice(0, Math.max(1, Math.floor(peaks.length / 2)));
  let lowDrop = -99, lowNote = 0;
  for (const n of lower) if (D[n] - U[n] > lowDrop) { lowDrop = D[n] - U[n]; lowNote = n; }
  // the low note timed on each strum is that one: a bottom string's note (the highest chord note is timed too)
  const lo = hz(lowNote || notes[0]), hi = hz(notes[notes.length - 1]);
  const hp = (() => { // 4 kHz high-pass, two RBJ biquads
    const w = 2 * Math.PI * 4000 / sr, c = Math.cos(w), al = Math.sin(w) / (2 * 0.7071), a0 = 1 + al;
    const b0 = (1 + c) / 2 / a0, b1 = -(1 + c) / a0, a1 = -2 * c / a0, a2 = (1 - al) / a0;
    let y = x;
    for (let pass = 0; pass < 2; pass++) { const o = new Float32Array(y.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
      for (let i = 0; i < y.length; i++) { const v = b0 * y[i] + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = y[i]; y2 = y1; y1 = v; o[i] = v; } y = o; }
    return y;
  })();
  const res = marks.map((m) => {
    const c = m - f0, W = ms(30), H = ms(5);
    const track = (f) => { const pre = [], post = []; for (let a = c - ms(70); a + W <= c + ms(140); a += H) (a + W <= c - ms(5) ? pre : post).push([a, goertzel(f, a, a + W)]); return { pre: mean(pre.map((p) => p[1])), post }; };
    const onset = (t) => { const i = t.post.findIndex((p) => p[1] > t.pre * 2); return i < 0 ? Infinity : Math.round((t.post[i][0] + W - c) * 1000 / sr); };
    const rise = (t) => db(Math.max(...t.post.map((p) => p[1]))) - db(t.pre);
    const L = track(lo), Hh = track(hi);
    // the pick's attack: energy above 4 kHz (where a fresh pluck is bright and a string ringing for a while is not)
    // in 10 ms frames after the strum, over just before it
    const d = (a, b) => { let e = 0; for (let i = Math.max(0, a); i < b; i++) e += hp[i] * hp[i]; return e / Math.max(1, b - a); };
    let att = 0; for (let a = c - ms(5); a < c + ms(90); a += ms(5)) att = Math.max(att, d(a, a + ms(10)));
    return {
      level: db(rms(c, c + ms(170))), jump: Math.max(rise(L), rise(Hh), db(att) - db(d(c - ms(60), c - ms(10)))), tLo: onset(L), tHi: onset(Hh), riseLo: rise(L),
      lowVsHigh: db(goertzel(lo, c + ms(80), c + ms(200))) - db(goertzel(hi, c + ms(80), c + ms(200))),
      // where the strum's energy sits: power-weighted mean over the semitones E2-C7, once the old ring is muted
      cen: (() => { let a = 0, b = 0; for (let n = 40; n <= 96; n++) { const p = goertzel(hz(n), c + ms(80), c + ms(200)); a += p * hz(n); b += p; } return a / (b || 1); })()
    };
  });
  return { notes, res, lowDrop, lowNote };
}

export default async function strum({ browser, base, workers, tabs }) {
  const list = INSTRUMENTS.filter((i) => i.strum && (!tabs || tabs.includes(i.tab)));
  const tasks = list.map((ins) => ({
    tab: ins.tab, check: 'strum', prep: ({ page }) => dryReverb(page),
    run: async ({ page, touch }) => {
      const neck = ins.tab === 'guitar' ? '#neck' : '#rneck';
      await page.evaluate((neck) => { // note the audio frame of each strum the moment its pick animation starts
        window.__strums = [];
        new MutationObserver((ms) => new Set(ms.map((m) => m.target)).forEach((el) => { const c = el.className; if (typeof c === 'string' && /pickfx (dn|up)/.test(c)) window.__strums.push({ f: window.__rec.now(), dir: c.includes('dn') ? 1 : -1 }); }))
          .observe(document.querySelector(neck), { subtree: true, attributes: true, attributeFilter: ['class'] });
      }, neck);
      const errs = [], info = [];
      const r = await page.locator(neck).boundingBox();
      const x = r.x + r.width * 0.5;
      let y = r.y + r.height * 0.5 - 15, dir = 1;
      await touch.down(3, x, y);
      const t0 = Date.now();
      for (let k = 0; k < STRUMS; k++) {
        while (Date.now() - t0 < k * 1000 / RATE) await sleep(2);
        for (let s = 0; s < 4; s++) { y += dir * 7.5; await touch.move(3, x, y); } // a quick 30 px flick, as a player does
        dir = -dir;
      }
      await sleep(350);
      await touch.up(3);
      const swipes = await page.evaluate(() => window.__strums.splice(0));
      const dirs = swipes.map((s) => s.dir);
      if (swipes.length !== STRUMS) errs.push(`${STRUMS} swipes gave ${swipes.length} strums`);
      if (dirs.some((d, i) => d !== (i % 2 ? -1 : 1))) errs.push('strums did not alternate down/up: ' + dirs.map((d) => d > 0 ? '▼' : '▲').join(''));
      if (swipes.length) {
        await waitFrame(page, swipes[swipes.length - 1].f + 0.4 * 48000);
        const { notes, res: m, lowDrop } = await page.evaluate(analyse, { f0: swipes[0].f - 4800, marks: swipes.map((s) => s.f), dirs });
        const downs = m.filter((_, i) => dirs[i] > 0), ups = m.filter((_, i) => dirs[i] < 0);
        const avg = (a, k) => a.reduce((p, q) => p + q[k], 0) / Math.max(1, a.length);
        if (process.env.STRUM_DEBUG) console.log(ins.tab, dirs.join(' '), JSON.stringify(m.map((v) => Object.fromEntries(Object.entries(v).map(([k, n]) => [k, Math.round(n * 10) / 10])))));
        const quiet = m.map((v, i) => [v, i]).filter(([v]) => v.jump < 5 || v.level < -45);
        if (quiet.length) errs.push(`strum ${quiet.map(([, i]) => i + 1).join(', ')} not heard (rose only ${quiet.map(([v]) => v.jump.toFixed(1)).join(', ')} dB)`);
        const dLvl = avg(downs, 'level') - avg(ups, 'level');
        if (dLvl < 1) errs.push(`up-strums not softer (down ${avg(downs, 'level').toFixed(1)}, up ${avg(ups, 'level').toFixed(1)} dB)`);
        // up-strums catch mostly the top strings
        if (notes.length < 2) errs.push(`only ${notes.length} chord notes heard in the down-strums`);
        if (lowDrop < 6) errs.push(`up-strums not lighter on the low strings (the low notes are only ${lowDrop.toFixed(1)} dB weaker than in the down-strums)`);
        // Order: a down-strum's lowest note must start right away (within 70 ms of the pick: onsets are read in 5 ms
        // steps through a 30 ms window, too coarse for the 25 ms a fast strum takes); an up-strum's lowest note, if it is touched at all (rising 6 dB or more), must come after its
        // highest. The highest note isn't timed on down-strums: on a guitar chord it is usually an octave of a lower
        // string, whose overtone sounds at the same pitch from the start.
        if (downs.some((v) => !(v.tLo <= 70))) errs.push('a down-strum did not start on the low strings');
        if (ups.some((v) => v.riseLo > 6 && Number.isFinite(v.tHi) && v.tLo + 10 < v.tHi)) errs.push('an up-strum started on the low strings');
        info.push(`chord notes ${notes.length}, ${swipes.length} strums at ${RATE}/s ${dirs.map((d) => d > 0 ? '▼' : '▲').join('')}, each rose ${Math.min(...m.map((v) => v.jump)).toFixed(0)}+ dB`,
          `down ${avg(downs, 'level').toFixed(1)} dB, up ${dLvl.toFixed(1)} dB softer with the low strings ${lowDrop.toFixed(0)} dB weaker`,
          `low strings first on every down, high strings first on every up`);
      }
      // The pads: ▼ then ▲, each a strum in its direction
      const pads = await page.evaluate((neck) => { const w = document.querySelector(neck).closest('.view, section, body').querySelector(neck === '#neck' ? '#gpads' : '#rpads'); return [...w.querySelectorAll('[data-dir]')].map((b) => { const q = b.getBoundingClientRect(); return { dir: +b.dataset.dir, x: q.left + q.width / 2, y: q.top + q.height / 2, vis: q.width > 0 }; }); }, neck);
      for (const p of pads) { await touch.tap(p.x, p.y, 40); await sleep(260); }
      const padRes = await page.evaluate(() => window.__strums.splice(0).map((s) => s.dir));
      if (pads.length !== 2 || pads.some((p) => !p.vis)) errs.push('the ▼ Down / ▲ Up pads are missing');
      else if (padRes.join() !== pads.map((p) => p.dir).join()) errs.push(`pads strummed ${padRes.map((d) => d > 0 ? '▼' : '▲').join('') || 'nothing'}`);
      else info.push('pads ▼▲ strum both ways');
      return row('strum', ins.tab, !errs.length, (errs.length ? errs.join('; ') + ' · ' : '') + info.join(', '));
    }
  }));
  return pool(browser, base, tasks, workers);
}
