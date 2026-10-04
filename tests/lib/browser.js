// Headless Chromium with the app's AudioContext swapped for an OfflineAudioContext, so every note
// renders faster than real time into a buffer we can measure.
'use strict';
const fs = require('fs');
const path = require('path');

function loadPlaywright() {
  try { return require('playwright'); } catch (e) {}
  const { execSync } = require('child_process');
  const globalRoot = execSync('npm root -g').toString().trim();
  return require(path.join(globalRoot, 'playwright'));
}

const ROOT = path.resolve(__dirname, '..', '..');
const SR = 48000;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png' };

// Runs in the page before the app's own script
const INIT = `
window.__PB_TEST__ = true;
window.__pbSeconds = 4;
(function () {
  var Off = window.OfflineAudioContext;
  function Fake() {
    var c = new Off(2, Math.ceil(window.__pbSeconds * ${SR}), ${SR});
    c.resume = function () { return Promise.resolve(); };   // the app calls resume(); offline contexts start on render
    window.__pbCtx = c;
    return c;
  }
  window.AudioContext = Fake; window.webkitAudioContext = Fake;
})();
// Run timed actions against the current offline context, then render. steps: [[seconds, fn], ...]
window.__pbRender = async function (steps) {
  var c = window.__pbCtx, q = 128 / ${SR}, groups = {}, Off = window.OfflineAudioContext;
  steps.forEach(function (s) {
    var k = Math.round(s[0] / q);
    (groups[k] = groups[k] || []).push(s[1]);
  });
  Object.keys(groups).map(Number).sort(function (a, b) { return a - b; }).forEach(function (k) {
    if (k === 0) { groups[k].forEach(function (f) { f(); }); return; }
    c.suspend(k * q).then(function () {
      groups[k].forEach(function (f) { try { f(); } catch (e) { console.error(e); } });
      return Off.prototype.resume.call(c);
    });
  });
  return c.startRendering();
};
// Synthetic pointer events at a point inside an element (fractions of its box)
window.__pbPtr = function (type, el, fx, fy, id) {
  var r = el.getBoundingClientRect(), x = r.left + r.width * fx, y = r.top + r.height * fy;
  var ev = new PointerEvent(type, { pointerId: id || 1, clientX: x, clientY: y, bubbles: true, cancelable: true, pointerType: 'touch', isPrimary: (id || 1) === 1 });
  el.dispatchEvent(ev);
};
`;

async function launch() {
  const { chromium } = loadPlaywright();
  return chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
}

// Open the app (or another html file, e.g. the pre-fix version for baseline numbers) on a fake origin.
async function openApp(browser, opts) {
  opts = opts || {};
  const html = opts.html || path.join(ROOT, 'index.html');
  const context = await browser.newContext({ viewport: { width: 900, height: 420 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  page.on('pageerror', (e) => console.error('[page error]', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.error('[page]', m.text()); });
  await page.route('**/*', (route) => {
    const u = new URL(route.request().url());
    if (u.host !== 'pb.test') return route.abort();
    let p = u.pathname === '/' ? '/index.html' : u.pathname;
    const file = p === '/index.html' ? html : path.join(ROOT, p);
    if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    route.fulfill({ status: 200, body: fs.readFileSync(file), contentType: TYPES[path.extname(file)] || 'application/octet-stream' });
  });
  await page.addInitScript({ content: fs.readFileSync(path.join(__dirname, 'analysis.js'), 'utf8') });
  await page.addInitScript({ content: INIT });
  if (opts.tab) await page.addInitScript({ content: `try { localStorage.setItem('pb-tab', ${JSON.stringify(opts.tab)}); } catch (e) {}` });
  await page.goto('http://pb.test/', { waitUntil: 'load' });
  return { page, context };
}

module.exports = { launch, openApp, SR, ROOT };
