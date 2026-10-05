// Check 5. Note limit and multi-touch: five fingers down at once must sound five notes on instruments that play
// chords (one on the single-voice wind instruments, one per string on the bass), forty fingers at once must never
// go past the app's note limit or clip, and when every finger lifts all notes must end.
import { sleep, nowFrame, stats } from '../harness.mjs';
import { INSTRUMENTS, noteTargets, percTargets } from '../instruments.mjs';
import { row, pool } from '../common.mjs';

const MONO = ['flute', 'horn', 'trumpet', 'sax'];

export default async function polyphony({ browser, base, workers, tabs }) {
  const list = INSTRUMENTS.filter((i) => !tabs || tabs.includes(i.tab));
  const tasks = list.map((ins) => ({
    tab: ins.tab, check: 'polyphony',
    run: async ({ page, touch }) => {
      const sr = await page.evaluate(() => window.__rec.sr), voices = () => page.evaluate(() => window.__pbStats().voices);
      const max = await page.evaluate(() => window.__pbStats().max);
      let t = ins.pitched ? await page.evaluate(noteTargets, { tab: ins.tab }) : await page.evaluate(percTargets, { tab: ins.tab });
      if (ins.kind === 'board') { // one finger per string
        t = await page.evaluate((tab) => [...document.querySelectorAll(tab === 'ebass' ? '#ebass .brow' : '#bowed .brow')].map((r) => { const b = r.getBoundingClientRect(); const m = r.querySelector('.bmark, .fmark').getBoundingClientRect(); return { x: m.left + m.width / 2, y: b.top + b.height / 2 }; }), ins.tab);
      }
      const errs = [], info = [];
      // five fingers, one after another (10 ms apart), held together
      const five = [...Array(5)].map((_, i) => t[i % t.length]);
      for (let i = 0; i < 5; i++) { await touch.down(10 + i, five[i].x + (i >= t.length ? 3 : 0), five[i].y); await sleep(10); }
      await sleep(250);
      const v5 = await voices();
      const want = MONO.includes(ins.tab) ? [1, 2] : ins.kind === 'board' ? [4, 6] : ins.strum ? [1, 30] : !ins.pitched ? [1, max] : [5, 7];
      if (v5 < want[0] || v5 > want[1]) errs.push(`5 fingers sounded ${v5} voices, expected ${want[0]}-${want[1]}`);
      info.push(`5 fingers: ${v5} voices`);
      await touch.upAll(); await sleep(500);
      // forty fingers spread over the playing area
      const area = await page.evaluate((tab) => { const el = document.querySelector('.view:not([style*="none"]) .stage, body'); const st = document.querySelector('.stage').getBoundingClientRect(); return { l: st.left + 20, t: st.top + 20, w: st.width - 40, h: st.height - 40 }; }, ins.tab);
      // Chromium's renderer handles at most 16 touch points per event (more crashes the page), so the first 15
      // fingers are real touches and the other 25 are pointer events sent to the element under each spot, which
      // is what the app's pointer handlers see from a real finger
      const spots = [...Array(40)].map((_, i) => ({ x: area.l + area.w * ((i % 10) + 0.5) / 10, y: area.t + area.h * (Math.floor(i / 10) + 0.5) / 4 }));
      const f0 = await nowFrame(page);
      let peakV = 0;
      for (let i = 0; i < 15; i++) {
        await touch.down(20 + i, spots[i].x, spots[i].y);
        if (i % 5 === 4) peakV = Math.max(peakV, await voices());
      }
      for (let i = 15; i < 40; i++) {
        await page.evaluate(({ x, y, id }) => {
          const el = document.elementFromPoint(x, y); if (!el) return;
          window.__synth = window.__synth || [];
          window.__synth.push({ el, x, y, id });
          el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, composed: true, pointerId: id, pointerType: 'touch', isPrimary: false, clientX: x, clientY: y, pressure: 0.5, width: 8, height: 8 }));
        }, { ...spots[i], id: 500 + i });
        if (i % 5 === 4) peakV = Math.max(peakV, await voices());
      }
      await sleep(300);
      peakV = Math.max(peakV, await voices());
      const held = await stats(page, f0, await nowFrame(page));
      await page.evaluate(() => { for (const s of window.__synth || []) s.el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, composed: true, pointerId: s.id, pointerType: 'touch', clientX: s.x, clientY: s.y })); window.__synth = []; });
      await touch.upAll(); await sleep(1200);
      // a strum from the big Down/Up pads rings on by design (the next strum mutes it), so only count notes held by fingers
      const left = await page.evaluate(() => { const s = window.__pbStats(); return s.voices - (s.ringing || 0); });
      if (peakV > max) errs.push(`40 fingers: ${peakV} voices, over the limit of ${max}`);
      if (held.clip) errs.push(`40 fingers: ${held.clip} clipped samples`);
      if (left > 0 && !(ins.tab === 'drums' || ins.tab === 'epad' || ins.tab.startsWith('tabla'))) errs.push(`${left} voices still sounding after every finger lifted`);
      info.push(`40 fingers: at most ${peakV} of ${max}, peak ${held.peak.toFixed(1)} dBFS, ${held.clip} clipped`, `after lifting: ${left} voices`);
      return row('polyphony', ins.tab, !errs.length, (errs.length ? errs.join('; ') + ' · ' : '') + info.join(', '), { five: v5, forty: peakV, limit: max, left });
    }
  }));
  return pool(browser, base, tasks, workers);
}
