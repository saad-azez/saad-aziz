// The work ring's scrollable previews: one tall picture of each site.
//
// A plate never loads the site it shows. It shows a single long screenshot of
// it, which is uploaded once and scrolled under the reader's wheel, so the
// page never boots a second copy of itself (or anyone else's) in an iframe.
//
//   npm run previews                        every project in src/content/site.js, from its href, + this site
//   npm run previews -- <id>                one project from site.js
//   npm run previews -- <id> <url>          any site, full length, as public/work/<id>.webp
//   npm run previews -- <id> <url> --steps  a site with pinned or scroll-driven sections: screen by screen, stitched
//
// This site is photographed from the dev server (SITE=http://localhost:5173 by
// default), at rest and in the work ring, in the day scheme.
//
// Pictures are 1440 CSS px wide (a desktop layout) saved at 1200 px, and at most
// MAX_SCREENS screens tall so every GPU can hold them as one texture.
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { WORK } from '../src/content/site.js';

const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SITE = process.env.SITE ?? 'http://localhost:5173';
const ROOT = resolve(import.meta.dirname, '..');
const OUT = join(ROOT, 'public/work');
const CSS_WIDTH = 1440, VIEW_HEIGHT = 900, OUT_WIDTH = 1200, MAX_SCREENS = 7, QUALITY = 86;
const SCALE = OUT_WIDTH / CSS_WIDTH;
const PORT = 9335;
/** How long a live site gets to load (loaders, 3D scenes) before it is photographed. */
const WAIT = Number(process.env.WAIT ?? 6000);

/**
 * How each project's site photographs best. Pinned sections, scrubbed timelines
 * and image sequences only show up screen by screen ('steps'); a plain page is
 * one full-length shot. `wait` is for a site with a long loader.
 */
const HOW = {
  'zuhayr-creative': { steps: true, wait: 12000 },
  'pearl-towers': { steps: true },
  'poseidon-waters': { steps: true },
  cognichip: { steps: true },
  'pro-marketing': { steps: true },
  builders: { steps: true, wait: 14000 },
  tiraki: { steps: true },
};

const sleep = ms => new Promise(r => setTimeout(r, ms));
const profile = mkdtempSync(join(tmpdir(), 'previews-'));
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--window-size=${CSS_WIDTH},${VIEW_HEIGHT}`,
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars',
  '--no-first-run', '--no-default-browser-check', '--allow-file-access-from-files',
  `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' });

let target;
for (let i = 0; i < 40 && !target; i++) {
  await sleep(250);
  try { target = (await (await fetch(`http://localhost:${PORT}/json`)).json()).find(t => t.type === 'page'); } catch {}
}
if (!target) { chrome.kill(); throw new Error('Chrome did not start: set CHROME to its path'); }

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(r => { ws.onopen = r; });
let id = 0;
const pending = new Map();
ws.onmessage = e => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
};
const send = (method, params = {}) => new Promise((ok, fail) => {
  const n = ++id;
  pending.set(n, m => (m.error ? fail(new Error(`${method}: ${m.error.message}`)) : ok(m.result)));
  ws.send(JSON.stringify({ id: n, method, params }));
});
const evaluate = async expression => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.value;
const viewport = height => send('Emulation.setDeviceMetricsOverride', { width: CSS_WIDTH, height, deviceScaleFactor: 1, mobile: false });
const open = async (url, wait) => {
  await send('Page.navigate', { url });
  await sleep(600);
  await evaluate('new Promise(r => document.readyState === "complete" ? r() : addEventListener("load", r))');
  await evaluate('document.fonts.ready.then(() => true)');
  await sleep(wait);
  await dismissOverlays();
};

/**
 * Cookie banners and age gates are not the site: answer them the way a reader
 * would (accept, or say yes to the age question), then give the page a moment.
 */
const ANSWERS = /^(accept( all)?( cookies)?|allow all|i agree|agree|got it|ok(ay)?|yes,? i('| a)m.*age.*|i('| a)m over 18|enter)\.?$/i;
async function dismissOverlays() {
  const clicked = await evaluate(`(() => {
    const pattern = ${ANSWERS};
    const buttons = [...document.querySelectorAll('button, a, [role="button"], input[type="button"], input[type="submit"]')]
      .filter(b => { const r = b.getBoundingClientRect(); return r.width && r.height && pattern.test((b.innerText || b.value || '').trim()); });
    buttons.forEach(b => b.click());
    return buttons.length;
  })()`);
  if (clicked) await sleep(1500);
}
const save = (name, base64) => {
  const file = join(OUT, `${name}.webp`);
  writeFileSync(file, Buffer.from(base64, 'base64'));
  console.log('saved', file.replace(ROOT, '.'));
};

/** A page that lays out at any height: grown to its full length and photographed once. */
async function captureTall(name, url, wait = WAIT) {
  await viewport(VIEW_HEIGHT);
  await open(url, wait);
  // Scroll through once, slowly, so lazy pictures load and scroll reveals play out.
  const length = await evaluate('document.documentElement.scrollHeight');
  for (let y = 0; y < Math.min(length, VIEW_HEIGHT * MAX_SCREENS); y += VIEW_HEIGHT * .5) { await evaluate(`scrollTo(0, ${y})`); await sleep(450); }
  await evaluate('scrollTo(0, 0)');
  await sleep(1500);
  const height = Math.min(await evaluate('document.documentElement.scrollHeight'), VIEW_HEIGHT * MAX_SCREENS);
  const shot = await send('Page.captureScreenshot', {
    format: 'webp', quality: QUALITY, captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: CSS_WIDTH, height, scale: SCALE },
  });
  save(name, shot.data);
}

/** Screens stacked in the order they are scrolled through. */
async function stitch(name, frames) {
  const encoded = await evaluate(`(async () => {
    const frames = ${JSON.stringify(frames)};
    const images = await Promise.all(frames.map(src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = src; })));
    const canvas = document.createElement('canvas');
    canvas.width = images[0].width;
    canvas.height = images.reduce((sum, i) => sum + i.height, 0);
    const c = canvas.getContext('2d');
    let y = 0;
    for (const i of images) { c.drawImage(i, 0, y); y += i.height; }
    return canvas.toDataURL('image/webp', ${QUALITY / 100}).split(',')[1];
  })()`);
  save(name, encoded);
}

/** What is on screen now. A clip is measured on the page, so it starts at the scroll. */
const screen = async () => 'data:image/png;base64,' + (await send('Page.captureScreenshot', {
  format: 'png', clip: { x: 0, y: await evaluate('scrollY'), width: CSS_WIDTH, height: VIEW_HEIGHT, scale: SCALE },
})).data;

/** A site whose sections are a screen tall: photographed a screen at a time. */
async function captureSteps(name, url, wait = WAIT) {
  await viewport(VIEW_HEIGHT);
  await open(url, wait);
  const length = Math.min(await evaluate('document.documentElement.scrollHeight'), VIEW_HEIGHT * MAX_SCREENS);
  const frames = [];
  // Travel to each screen gradually, as a reader would, so scroll-driven scenes
  // (pinned sections, scrubbed timelines, image sequences) play through on the way.
  let at = 0;
  for (let y = 0; y < length; y += VIEW_HEIGHT) {
    for (let i = 1; i <= 8; i++) { await evaluate(`scrollTo({ top: ${Math.round(at + (y - at) * i / 8)}, behavior: 'instant' })`); await sleep(90); }
    at = y;
    await sleep(1600);
    frames.push(await screen());
  }
  await send('Page.navigate', { url: 'about:blank' });
  await stitch(name, frames);
}

/** This site: the hero at rest, then the work ring. */
async function captureThisSite() {
  await viewport(VIEW_HEIGHT);
  await open(`${SITE}/`, 200);
  await evaluate(`localStorage.setItem('saad:scheme', 'day')`);
  await open(`${SITE}/`, 7000);
  // The dev server's animation panel is not part of the site.
  await evaluate(`document.head.insertAdjacentHTML('beforeend', '<style>.animation-debug { display: none !important; }</style>')`);
  const frames = [await screen()];
  await evaluate(`scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' })`);
  await sleep(1200);
  // Hold the gallery still (as focus would) without drawing a focus ring.
  await evaluate(`document.querySelector('.work__ring')?.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))`);
  await sleep(2500);
  frames.push(await screen());
  await send('Page.navigate', { url: 'about:blank' });
  await stitch('this-site', frames);
}

await send('Page.enable');
await send('Runtime.enable');
try {
  const [name, url] = process.argv.slice(2).filter(a => !a.startsWith('--'));
  const capture = async (id, href, how = HOW[id] ?? {}) => {
    try { await (how.steps ? captureSteps : captureTall)(id, href, how.wait); } catch (error) { console.warn(`${id} was not photographed: ${error.message}`); }
  };
  if (name && url) {
    await capture(name, url, { steps: process.argv.includes('--steps') });
  } else {
    const projects = WORK.projects.filter(project => !name || project.id === name);
    if (!projects.length) throw new Error(`no project "${name}" in src/content/site.js`);
    for (const project of projects) {
      if (project.id === 'this-site') {
        try { await captureThisSite(); } catch (error) {
          console.warn(`this site was not photographed (${error.message}); is the dev server running at ${SITE}?`);
        }
      } else if (project.href) await capture(project.id, project.href);
    }
  }
} finally {
  ws.close();
  chrome.kill();
  await sleep(400);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
