// Check 2. Pitch: every pitched instrument, all 12 keys x every scale, set with the real Key and Scale controls.
// The same taps a user makes are played, the live output is measured, and each note must be within 5 cents of a
// note of the chosen key and scale, match its on-screen label, and the header must name the key, scale and notes.
// Different keys or scales must give different pitches (unless music theory says they are the same notes).
import { choose, playAndMeasure, sleep } from '../harness.mjs';
import { PITCHED, noteTargets } from '../instruments.mjs';
import { NAMES, SCALES, SCALE_NAMES, pc, midiOf, inScale, snap, tonicTriad, describe, row, pool, dryReverb, setToggle } from '../common.mjs';

const TOL = 5;

// What music theory says a case must sound like, as a comparable signature
function refSig(ins, key, scale) {
  if (ins.kind === 'chords') return tonicTriad(key, scale).pcs.slice().sort((a, b) => a - b).join(',');
  if (ins.kind === 'board') return SCALES[scale].map((i) => (key + i) % 12).sort((a, b) => a - b).join(',');
  return key + ':' + SCALES[scale].join(','); // rows and keyboards start on the root and climb the scale
}

async function runCase(cur, ins, key, scale) {
  const { page, touch } = cur, errs = [];
  await choose(page, 'key', key);
  await choose(page, 'scale', scale);
  await sleep(250); // the last case's final note fades out before this one starts
  const header = await page.evaluate(() => document.getElementById('tonal').textContent);
  if (header !== describe(key, scale)) errs.push(`header shows "${header}", expected "${describe(key, scale)}"`);
  if (ins.kind === 'chords') { // the first chord button: the key's own chord
    const bb = await page.evaluate((tab) => { const b = document.querySelector((tab === 'guitar' ? '#chords' : '#rchords') + ' [data-chord="0"]'); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, name: b.textContent }; }, ins.tab);
    await touch.tap(bb.x, bb.y, 30);
    const tri = tonicTriad(key, scale);
    if (bb.name !== tri.name) errs.push(`first chord button says ${bb.name}, expected ${tri.name}`);
  }
  const targets = await page.evaluate(noteTargets, { tab: ins.tab });
  const res = await playAndMeasure(page, touch, targets, { hold: ins.win[1] + 15, gap: ins.kind === 'chords' ? 60 : 25, win: ins.win, fmax: ins.tab === 'xylo' ? 4200 : ins.tab === 'guitar' || ins.tab === 'ebass' ? 1000 : 2600, chroma: ins.tab === 'rhythm' });
  const notes = res.map((r, i) => ({ ...r, m: r.f > 0 ? midiOf(r.f) : NaN, label: targets[i].label, info: targets[i].info, midi: targets[i].midi }));
  let sig;
  if (ins.tab === 'rhythm') {
    const tri = tonicTriad(key, scale), ns = notes[0].notes || [];
    const pcs = [...new Set(ns.map(pc))].sort((a, b) => a - b);
    if (!ns.length) errs.push('no notes heard in the strum');
    else {
      // every note heard must be a chord note, and the root and the third (major or minor) must be there; the fifth
      // can hide under the root's own overtone, so it isn't required
      const extra = pcs.filter((p) => !tri.pcs.includes(p)), missing = tri.pcs.slice(0, 2).filter((p) => !pcs.includes(p));
      if (extra.length || missing.length) errs.push(`strum plays ${pcs.map((p) => NAMES[p]).join(' ')}, expected ${tri.name} (${tri.pcs.map((p) => NAMES[p]).join(' ')})`);
      if (pc(ns[0]) !== key) errs.push(`lowest note ${NAMES[pc(ns[0])]}, expected the root ${NAMES[key]}`);
    }
    sig = pcs.join(',');
    return { key, scale, errs, sig, ref: refSig(ins, key, scale), worst: null, n: 1, chord: true };
  } else {
    notes.forEach((n, i) => {
      if (!(n.f > 0)) { errs.push(`${n.info || 'note ' + (i + 1)}: no pitch heard`); return; }
      const near = Math.round(n.m), cents = (n.m - near) * 100;
      n.near = near; n.cents = cents;
      if (Math.abs(cents) > TOL) errs.push(`${n.info || 'note ' + (i + 1)} ${n.label}: ${n.f.toFixed(2)} Hz is ${cents.toFixed(1)} cents off ${NAMES[pc(near)]}`);
      if (ins.kind === 'chords') { if (!tonicTriad(key, scale).pcs.includes(pc(near))) errs.push(`${n.info}: plays ${NAMES[pc(near)]}, not in the chord`); }
      else if (!inScale(near, key, scale)) errs.push(`${n.info || 'note ' + (i + 1)}: plays ${NAMES[pc(near)]}, not in ${describe(key, scale)}`);
      if (ins.kind === 'keys') { const want = snap(n.midi, key, scale); if (near !== want) errs.push(`${n.info} ${NAMES[pc(n.midi)]}: plays ${NAMES[pc(near)]}, expected ${NAMES[pc(want)]} (Scale lock)`); }
      else if (n.label && n.label !== NAMES[pc(near)]) errs.push(`${n.info || 'note ' + (i + 1)}: labelled ${n.label} but plays ${NAMES[pc(near)]}`);
    });
    const ok = notes.filter((n) => n.near !== undefined);
    if (ins.kind === 'row' && ins.tab !== 'harmonica' || ins.kind === 'keys') {
      // a row or keyboard starts on the root and climbs the scale, one octave
      const steps = ins.kind === 'keys' ? [...new Set(ok.map((n) => n.near))] : ok.map((n) => n.near);
      if (steps.length && pc(steps[0]) !== key) errs.push(`starts on ${NAMES[pc(steps[0])]}, not the key's root ${NAMES[key]}`);
      const want = SCALES[scale].concat([12]).join(','), got = steps.map((m) => m - steps[0]).join(',');
      if (got !== want) errs.push(`steps ${got} (semitones from the root), expected ${want}`);
    }
    if (ins.kind === 'board') {
      const got = [...new Set(ok.map((n) => pc(n.near)))].sort((a, b) => a - b).join(','), want = refSig(ins, key, scale);
      if (got !== want) errs.push(`snap points play ${got}, expected the scale ${want}`);
    }
    if (ins.kind === 'chords' && ok.length && pc(Math.min(...ok.map((n) => n.near))) !== key) errs.push('lowest string is not the chord root');
    sig = ins.kind === 'board' || ins.kind === 'chords' ? [...new Set(ok.map((n) => pc(n.near)))].sort((a, b) => a - b).join(',') : ok.map((n) => n.near).join(' ');
  }
  const cents = notes.filter((n) => n.cents !== undefined).map((n) => Math.abs(n.cents));
  return { key, scale, errs, sig, ref: refSig(ins, key, scale), worst: cents.length ? Math.max(...cents) : null, n: cents.length };
}

export default async function pitch({ browser, base, workers, tabs, keys, scales, progress }) {
  const list = PITCHED.filter((i) => !tabs || tabs.includes(i.tab));
  keys = keys || [...Array(12).keys()]; scales = scales || SCALE_NAMES;
  const tasks = [], cases = {};
  for (const ins of list) for (const scale of scales) tasks.push({
    tab: ins.tab, check: 'pitch', prep: ({ page }) => dryReverb(page),
    run: async (cur) => {
      if (!cur.prepared) { // steady pitch for measuring: no reverb tails, no vibrato
        await setToggle(cur.page, cur.touch, 'bvib', false); await setToggle(cur.page, cur.touch, 'sxvib', false);
        await setToggle(cur.page, cur.touch, 'slock', true); await setToggle(cur.page, cur.touch, 'bsnap', true); await setToggle(cur.page, cur.touch, 'bxsnap', true);
        cur.prepared = true;
      }
      const out = [];
      for (const key of keys) {
        // Recording live audio on a busy computer can catch a glitch (a dropped audio block mid-note), so a case
        // that fails is played again once; a real fault fails both times, and the second result is the one kept.
        // How many cases needed a second take is reported.
        let r = await runCase(cur, ins, key, scale);
        if (r.errs.length) { r = await runCase(cur, ins, key, scale); r.retried = true; }
        out.push(r);
      }
      (cases[ins.tab] = cases[ins.tab] || []).push(...out);
      return [];
    }
  });
  await pool(browser, base, tasks, workers, (t) => progress && progress(`pitch ${t.tab}`));
  const rows = [];
  for (const ins of list) {
    const cs = cases[ins.tab] || [], bad = cs.filter((c) => c.errs.length);
    // different keys or scales must sound different wherever music theory says they differ
    const clash = [];
    for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
      if (cs[i].ref !== cs[j].ref && cs[i].sig === cs[j].sig) clash.push(`${NAMES[cs[i].key]} ${cs[i].scale} = ${NAMES[cs[j].key]} ${cs[j].scale}`);
    }
    const worst = Math.max(0, ...cs.map((c) => c.worst || 0)), notes = cs.reduce((a, c) => a + c.n, 0);
    const detail = bad.length || clash.length
      ? [...bad.slice(0, 3).map((c) => `${NAMES[c.key]} ${c.scale}: ${c.errs.slice(0, 2).join('; ')}`), ...(clash.length ? [`identical pitches for ${clash.length} pairs, e.g. ${clash[0]}`] : [])].join(' | ')
      : ins.tab === 'rhythm' ? `${cs.length} key/scale cases, every strum played the key's chord, every case distinct`
      : `${cs.length} key/scale cases, ${notes} notes, worst ${worst.toFixed(1)} cents, every case distinct`;
    const again = cs.filter((c) => c.retried).length;
    rows.push(row('pitch', ins.tab, cs.length === keys.length * scales.length && !bad.length && !clash.length, detail + (again ? ` (${again} played twice after a glitch)` : ''),
      { cases: cs.length, failed: bad.length, notes, worstCents: +worst.toFixed(2), clashes: clash.length, retried: again }));
  }
  return rows;
}
