// The live test harness: headless Chromium (Playwright) opens the real app from a local http server, drives it
// with real touch input (Chrome DevTools touch events, the same path a finger takes) and the real controls, and
// records what the page actually plays from window.__testTap, the analyser the app hangs on its final output.
// Nothing in the app is swapped or mocked: the audio is the live AudioContext rendering in real time.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(import.meta.url);

export function loadPlaywright() {
  for (const p of ['playwright', 'playwright-core']) { try { return require(p); } catch (e) {} }
  try { return require(path.join(execSync('npm root -g').toString().trim(), 'playwright')); } catch (e) {}
  throw new Error('Playwright is not installed. Run "npm install" in the app folder (run-tests.bat does this for you).');
}

const ANALYSIS = fs.readFileSync(path.join(ROOT, 'tests', 'lib', 'analysis.js'), 'utf8');

// Runs in the page before the app's own script. It only listens: the recorder taps window.__testTap the moment
// the app creates it, and pointer down / up times are noted on the audio clock so a note can be found in the take.
const RECORDER = `
(function () {
  var R = window.__rec = { chunks: [], sr: 0, ready: false, marks: [], node: null };
  var tap = null;
  Object.defineProperty(window, '__testTap', { configurable: true, get: function () { return tap; }, set: function (v) { tap = v; attach(v); } });
  var SRC = 'class PbRec extends AudioWorkletProcessor { constructor() { super(); this.b = new Float32Array(1024); this.n = 0; this.f0 = 0; }' +
    ' process(ins) { var a = ins[0], L = a && a[0], Rr = a && a[1], q = 128;' +
    ' if (this.n === 0) this.f0 = currentFrame;' +
    ' for (var i = 0; i < q; i++) this.b[this.n + i] = L ? (Rr ? 0.5 * (L[i] + Rr[i]) : L[i]) : 0;' +
    ' this.n += q; if (this.n >= 1024) { this.port.postMessage({ f: this.f0, d: this.b }); this.b = new Float32Array(1024); this.n = 0; }' +
    ' return true; } } registerProcessor("pb-rec", PbRec);';
  function attach(t) {
    var c = t.context; R.sr = c.sampleRate; R.ctx = c;
    var url = URL.createObjectURL(new Blob([SRC], { type: 'text/javascript' }));
    c.audioWorklet.addModule(url).then(function () {
      var n = new AudioWorkletNode(c, 'pb-rec', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1], channelCount: 2, channelCountMode: 'explicit' });
      var z = c.createGain(); z.gain.value = 0;
      t.connect(n); n.connect(z); z.connect(c.destination);
      n.port.onmessage = function (e) {
        R.chunks.push(e.data);
        if (R.chunks.length > 2400) R.chunks.splice(0, 600); // keep about the last minute
      };
      R.node = n; R.ready = true;
    });
  }
  R.now = function () { return R.ctx ? Math.round(R.ctx.currentTime * R.sr) : 0; };
  R.last = function () { var c = R.chunks[R.chunks.length - 1]; return c ? c.f + c.d.length : 0; };
  // Samples [f0, f1) of the take (zeros where nothing was recorded)
  R.get = function (f0, f1) {
    var out = new Float32Array(Math.max(0, f1 - f0));
    for (var i = 0; i < R.chunks.length; i++) {
      var c = R.chunks[i], a = Math.max(f0, c.f), b = Math.min(f1, c.f + c.d.length);
      for (var k = a; k < b; k++) out[k - f0] = c.d[k - c.f];
    }
    return out;
  };
  function mark(type) { return function (e) { if (R.ctx) R.marks.push({ type: type, id: e.pointerId, f: R.now(), x: e.clientX, y: e.clientY }); }; }
  window.addEventListener('pointerdown', mark('down'), true);
  window.addEventListener('pointerup', mark('up'), true);
})();
`;

export async function launch() {
  const { chromium } = loadPlaywright();
  return chromium.launch({
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required', '--disable-renderer-backgrounding', '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows']
  });
}

// A phone-sized landscape page with touch. opts: { tab, url, offline, record }
export async function openApp(browser, base, opts = {}) {
  const context = await browser.newContext({
    viewport: opts.viewport || { width: 800, height: 380 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1,
    serviceWorkers: opts.serviceWorkers || 'block'
  });
  const page = await context.newPage();
  const log = { errors: [], failed: [] };
  page.on('pageerror', (e) => log.errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') log.errors.push(m.text() + (m.location().url ? ' (' + m.location().url + ')' : '')); });
  page.on('requestfailed', (r) => log.failed.push(r.url() + ' ' + (r.failure() || {}).errorText));
  page.on('response', (r) => { if (r.status() >= 400) log.failed.push(r.url() + ' HTTP ' + r.status()); });
  await page.addInitScript({ content: ANALYSIS });
  await page.addInitScript({ content: RECORDER });
  if (opts.tab !== undefined) await page.addInitScript({ content: `try { ${opts.tab ? `localStorage.setItem('pb-tab', ${JSON.stringify(opts.tab)})` : `localStorage.removeItem('pb-tab')`} } catch (e) {}` });
  await page.goto(base + (opts.path || 'index.html'), { waitUntil: 'load' });
  const touch = await Touch.create(page);
  return { page, context, log, touch };
}

// Real touch input through the DevTools protocol: every finger is a touch point, so the page sees genuine
// trusted touch and pointer events (pointerType "touch"), multi-touch included.
export class Touch {
  static async create(page) { const t = new Touch(); t.page = page; t.cdp = await page.context().newCDPSession(page); t.pts = new Map(); return t; }
  list() { return [...this.pts.entries()].map(([id, p]) => ({ x: p.x, y: p.y, id, radiusX: 4, radiusY: 4, force: 1 })); }
  async send(type) { await this.cdp.send('Input.dispatchTouchEvent', { type, touchPoints: this.list() }); }
  async down(id, x, y) { this.pts.set(id, { x, y }); await this.send('touchStart'); }
  async move(id, x, y) { this.pts.set(id, { x, y }); await this.send('touchMove'); }
  async up(id) { this.pts.delete(id); await this.send('touchEnd'); }
  async cancel() { this.pts.clear(); await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); }
  async upAll() { for (const id of [...this.pts.keys()]) await this.up(id); }
  async tap(x, y, holdMs = 60) { await this.down(99, x, y); await sleep(holdMs); await this.up(99); }
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Wait for the app's audio and the recorder to be live (the first touch creates the AudioContext)
export async function waitAudio(page) {
  await page.waitForFunction(() => window.__rec && window.__rec.ready && window.__rec.chunks.length > 4, null, { timeout: 10000 });
}

// Open an instrument the way a person does: Home, swipe the gallery to its card, tap it
export async function openFromGallery(page, touch, tab) {
  if (await page.evaluate(() => document.body.dataset.screen) !== 'home') {
    const hb = await page.locator('#home').boundingBox();
    await touch.tap(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.waitForFunction(() => document.body.dataset.screen === 'home');
  }
  for (let i = 0; i < 40; i++) {
    const st = await page.evaluate((tab) => {
      const card = document.querySelector('.card[data-tab="' + tab + '"]'), g = document.getElementById('gallery');
      if (!card) return { missing: true };
      const r = card.getBoundingClientRect(), gr = g.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, gx: gr.left + gr.width / 2, gy: gr.top + gr.height / 2, w: gr.width,
        visible: r.left >= gr.left - 2 && r.right <= gr.right + 2, centred: Math.abs(r.left + r.width / 2 - (gr.left + gr.width / 2)) < r.width / 2 };
    }, tab);
    if (st.missing) throw new Error('no gallery card for ' + tab);
    if (st.visible && st.centred) {
      await touch.tap(st.x, st.y, 40);
      await page.waitForFunction((tab) => document.body.dataset.screen === 'play' && document.body.dataset.tab === tab, tab, { timeout: 3000 });
      return;
    }
    // swipe toward the card, a third of the gallery width at a time
    const dir = st.x > st.gx ? -1 : 1, dx = Math.min(Math.abs(st.x - st.gx), st.w / 3) * dir;
    await touch.down(98, st.gx, st.gy);
    for (let k = 1; k <= 6; k++) { await touch.move(98, st.gx + dx * k / 6, st.gy); await sleep(16); }
    await touch.up(98);
    await sleep(350);
  }
  throw new Error('could not reach the ' + tab + ' card by swiping');
}

// Pick an option in one of the real <select> controls (fires input and change like a person picking it)
export async function choose(page, id, value) { await page.selectOption('#' + id, String(value)); }

// Touch each target in turn (hold, lift, small gap) and measure what came out of the app for each one.
// Returns [{ f, clarity, rms, peak }] in target order; f is the measured fundamental in Hz.
export async function playAndMeasure(page, touch, targets, { hold = 240, gap = 50, win = [100, 220], fmin = 40, fmax = 2600, chroma = false } = {}) {
  const m0 = await page.evaluate(() => window.__rec.marks.length);
  for (const t of targets) { await touch.down(1, t.x, t.y); await sleep(hold); await touch.up(1); await sleep(gap); }
  return page.evaluate(async ({ m0, win, fmin, fmax, chroma, n }) => {
    const R = window.__rec, sr = R.sr, downs = R.marks.slice(m0).filter((m) => m.type === 'down');
    const end = (downs.length ? downs[downs.length - 1].f : 0) + Math.round(win[1] * sr / 1000);
    for (let i = 0; i < 100 && R.last() < end; i++) await new Promise((r) => setTimeout(r, 20));
    const out = [];
    for (let i = 0; i < n; i++) {
      const d = downs[i];
      if (!d) { out.push({ f: 0, clarity: 0, rms: 0, missing: true }); continue; }
      const a = d.f + Math.round(win[0] * sr / 1000), b = d.f + Math.round(win[1] * sr / 1000), x = R.get(a, b);
      let s = 0, p = 0; for (const v of x) { s += v * v; p = Math.max(p, Math.abs(v)); }
      const rms = Math.sqrt(s / x.length);
      const q = rms > 1e-4 ? PBA.pitch(x, sr, 0, x.length, fmin, fmax) : { f: 0, clarity: 0 };
      const r = { f: q.f, clarity: q.clarity, rms, peak: p };
      if (chroma) { // energy of each pitch class from C2 to B6 (for strummed chords)
        r.chroma = new Array(12).fill(0);
        for (let m = 36; m < 96; m++) r.chroma[m % 12] += Math.pow(10, PBA.tonePower(x, sr, 0, x.length, 440 * Math.pow(2, (m - 69) / 12)) / 10);
      }
      out.push(r);
    }
    return out;
  }, { m0, win, fmin, fmax, chroma, n: targets.length });
}
