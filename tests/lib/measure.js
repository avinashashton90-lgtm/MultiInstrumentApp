// One render = one fresh page. `plan` runs in the page and returns { seconds, steps, windows }:
// steps are [time, fn] actions, windows are [name, start, end, kind] spans to measure afterwards
// (kind 'pitch' adds a fundamental-frequency estimate, 'level' adds peak / RMS only).
'use strict';
const { openApp } = require('./browser');

async function measure(browser, opts, plan, arg) {
  const { page, context } = await openApp(browser, opts);
  try {
    return await page.evaluate(async ({ plan, arg }) => {
      // eslint-disable-next-line no-new-func
      const p = new Function('arg', 'return (' + plan + ')(arg);')(arg);
      const P = await p;
      window.__pbSeconds = P.seconds;
      if (P.before) await P.before();    // must create the audio context (the app makes it on first use)
      const buf = await window.__pbRender(P.steps);
      const x = PBA.mono(buf), sr = buf.sampleRate, out = {};
      P.windows.forEach(([name, s, e, kind, extra]) => {
        const a = Math.round(s * sr), b = Math.round(e * sr);
        const m = { peak: PBA.db(PBA.peak(buf, a, b)), rms: PBA.db(PBA.rms(buf, a, b)) };
        if (kind === 'pitch') { const q = PBA.pitch(x, sr, a, b, extra && extra.fmin, extra && extra.fmax); m.f = q.f; m.clarity = q.clarity; }
        if (kind === 'spectrum') { m.above200 = PBA.energyAbove(x, sr, 200, a, b); m.rmsPhone = PBA.db(PBA.rmsAbove(x, sr, 200, a, b)); }
        out[name] = m;
      });
      out.__clip = PBA.peak(buf) >= 1;
      out.__peak = PBA.db(PBA.peak(buf));
      return out;
    }, { plan: plan.toString(), arg });
  } finally {
    await context.close();
  }
}

module.exports = { measure };
