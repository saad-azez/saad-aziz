/**
 * The performance monitor (lib/perf.js turns it on with `?perf`). Everything here only ever runs then.
 *
 * In the console, each line tagged by where the load comes from:
 *   LOADER  its report when it is done: how it ran, when each step came, every hitch and what the page was doing then,
 *           and whether it cleaned up after itself.
 *   MAIN    long tasks (the script and function, where the browser says: Chrome's long-animation-frame entries),
 *           and frames dropped, by the section on screen.
 *   GPU     shaders compiled and pictures uploaded: these hold up the loader's thread too, which shares the GPU.
 *   GSAP    the ticker's listeners and the tweens' updates, by what they are and where they were made.
 *   3D      each renderer: draws, triangles and time per frame; the models, heaviest first.
 * And `perf` in the console: perf.report() (everything since the page opened, or since perf.reset()), perf.loader(),
 * perf.gsap(), perf.gpu(), perf.three(), perf.sections().
 *
 * Run it on the dev server (npm run dev) to see file names and function names; a built site's are minified.
 */

const COLOURS = { LOADER: '#c9a7ff', MAIN: '#ffb36b', GPU: '#6fdcd0', GSAP: '#a6e07a', '3D': '#7cc8ff', PERF: '#e6e6e6' };
const style = tag => `background:${COLOURS[tag]};color:#141018;border-radius:3px;padding:1px 6px;font-weight:700`;
const say = (tag, message, ...rest) => console.log(`%c${tag}%c ${message}`, style(tag), '', ...rest);
const warn = (tag, message, ...rest) => console.warn(`%c${tag}%c ${message}`, style(tag), '', ...rest);
const ms = value => `${Math.round(value)}ms`;
const now = () => performance.now();

/** Where in the site's own code a stack points: "file.js:line fn" (the first frame outside this file and the libraries). */
function origin(stack = new Error().stack) {
  for (const line of String(stack).split('\n').slice(1)) {
    if (/perfMonitor|node_modules|\/deps\/|gsap|three\.module|chunk-/.test(line)) continue;
    const match = line.match(/(?:at\s+(?:new\s+)?([\w$.<>]+)\s+\()?(?:https?:\/\/[^/]+)?\/?([^()\s]+?):(\d+):\d+\)?\s*$/);
    if (match) return `${match[2].replace(/^src\//, '').replace(/\?.*$/, '')}:${match[3]}${match[1] ? ` ${match[1]}` : ''}`;
  }
  return 'unknown';
}

/** The section on screen now: the element under the middle of the viewport, by its id or class. */
function sectionInView() {
  if (document.documentElement.classList.contains('is-loading')) return 'under the loader';
  const hit = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
  const section = hit?.closest('section, header, footer, [id], main > *');
  if (!section) return 'page';
  return section.id || String(section.className || section.tagName).split(' ')[0] || 'page';
}

function tally(map, key, value) {
  const entry = map.get(key) ?? { count: 0, total: 0, worst: 0 };
  entry.count++; entry.total += value; entry.worst = Math.max(entry.worst, value);
  map.set(key, entry);
}
const table = (map, limit = 15, extra = () => ({})) => console.table(Object.fromEntries([...map]
  .sort((a, b) => b[1].total - a[1].total).slice(0, limit)
  .map(([key, v]) => [key, { count: v.count, 'total ms': +v.total.toFixed(1), 'worst ms': +v.worst.toFixed(1), ...extra(key, v) }])));

export function createMonitor() {
  /** Everything that happened, in the page's time: { t, end, kind, what, ms }. Kept to what fits. */
  const events = [];
  const record = event => { events.push(event); if (events.length > 4000) events.splice(0, 1000); };
  const tasks = new Map(), gpuWork = new Map(), sections = new Map(), listeners = new Map(), tweens = new Map(), jobs = new Map();
  const renderers = new Map(), models = new Map();
  let loaderReport = null;

  say('PERF', 'monitor on. perf.report() in the console for the tables; ?perf=0 in the address to switch it off.');

  /* ----- MAIN: long tasks, by script ------------------------------------- */
  const loafSupported = PerformanceObserver.supportedEntryTypes?.includes('long-animation-frame');
  try {
    new PerformanceObserver(list => list.getEntries().forEach(entry => {
      const scripts = (entry.scripts ?? []).filter(s => s.duration > 5).sort((a, b) => b.duration - a.duration);
      const short = text => (String(text).startsWith('IMG[src="data:') ? 'IMG[inline svg].onload' : String(text)).slice(0, 90);
      const where = scripts.map(s => `${short(s.sourceFunctionName || s.invoker || '?')} (${String(s.sourceURL || '').split('/').pop().replace(/\?.*$/, '') || s.invokerType}) ${ms(s.duration)}`);
      // No script to blame: say where the frame's time went instead (Chrome's breakdown of a long frame).
      const end = entry.startTime + entry.duration;
      const layout = entry.styleAndLayoutStart ? end - entry.styleAndLayoutStart : 0;
      const rendering = entry.renderStart ? (entry.styleAndLayoutStart || end) - entry.renderStart : 0;
      const scripted = (entry.scripts ?? []).reduce((sum, s) => sum + s.duration, 0);
      const what = where[0] ?? `browser work: ${ms(rendering)} in rAF callbacks and rendering, ${ms(layout)} style/layout/paint, ${ms(entry.duration - rendering - layout - scripted)} other (GPU canvases, decoding)`;
      const section = sectionInView();
      record({ t: entry.startTime, end: entry.startTime + entry.duration, kind: 'task', what, ms: entry.duration, section });
      scripts.forEach(s => tally(tasks, `${short(s.sourceFunctionName || s.invoker || '?')} · ${String(s.sourceURL || s.invokerType).split('/').pop().replace(/\?.*$/, '')}`, s.duration));
      if (!scripts.length) tally(tasks, what, entry.duration);
      if (entry.duration > 120) warn('MAIN', `${ms(entry.duration)} frame blocked in ${section}: ${where.slice(0, 3).join(' · ') || what}`);
    })).observe({ type: loafSupported ? 'long-animation-frame' : 'longtask', buffered: true });
  } catch { /* neither: frames below still show the drops */ }

  /* ----- MAIN: frames dropped, by section --------------------------------- */
  let last = null, second = { start: now(), dropped: 0, worst: 0 };
  const watchFrames = time => {
    if (last != null && !document.hidden) {
      const gap = time - last;
      if (gap > 34) {
        const section = sectionInView();
        tally(sections, section, gap);
        second.dropped += Math.round(gap / 16.7) - 1;
        second.worst = Math.max(second.worst, gap);
        second.section = section;
      }
      if (time - second.start > 1000) {
        if (second.dropped >= 3) {
          const cause = events.filter(e => e.kind === 'task' && e.end > second.start).sort((a, b) => b.ms - a.ms)[0];
          say('MAIN', `${second.section}: ${second.dropped} frames dropped in the last second (worst gap ${ms(second.worst)})${cause ? ` · biggest task: ${cause.what}` : ''}`);
        }
        second = { start: time, dropped: 0, worst: 0 };
      }
    }
    last = time;
    requestAnimationFrame(watchFrames);
  };
  requestAnimationFrame(watchFrames);

  /* ----- GPU: shader programs and pictures -------------------------------- */
  const contextNames = new WeakMap();
  const nameOf = gl => contextNames.get(gl) ?? (gl.canvas?.className ? `canvas.${String(gl.canvas.className).split(' ')[0]}` : 'canvas');
  for (const proto of [window.WebGLRenderingContext?.prototype, window.WebGL2RenderingContext?.prototype].filter(Boolean)) {
    const link = proto.linkProgram;
    proto.linkProgram = function (program) {
      const start = now();
      const result = link.call(this, program);
      const spent = now() - start;
      const who = nameOf(this);
      tally(gpuWork, `${who}: shader programs`, spent);
      record({ t: start, end: start + Math.max(spent, 1), kind: 'gpu', what: `${who}: shader compiled (${origin()})`, ms: spent });
      return result;
    };
    for (const method of ['texImage2D', 'texSubImage2D', 'texStorage2D', 'compressedTexImage2D']) {
      const original = proto[method];
      if (!original) continue;
      proto[method] = function (...args) {
        const start = now();
        const result = original.apply(this, args);
        const spent = now() - start;
        const source = args.find(a => a && typeof a === 'object' && 'width' in a && !ArrayBuffer.isView(a));
        const width = source ? source.width : (method === 'texStorage2D' ? args[2] : args[3]);
        const height = source ? source.height : (method === 'texStorage2D' ? args[3] : args[4]);
        if (width * height >= 256 * 256 || spent > 2) {
          const who = nameOf(this);
          tally(gpuWork, `${who}: pictures ${method === 'texStorage2D' ? 'allocated' : 'uploaded'}`, spent);
          record({ t: start, end: start + Math.max(spent, 1), kind: 'gpu', what: `${who}: ${width}×${height} ${source?.constructor?.name ?? 'data'} uploaded (${origin()})`, ms: spent });
        }
        return result;
      };
    }
  }

  /* ----- LOADER: its report --------------------------------------------- */
  window.addEventListener('loader:done', ({ detail }) => {
    const report = loaderReport = { ...detail, seenAt: now() };
    const offset = (detail.origin ?? performance.timeOrigin) - performance.timeOrigin;
    const page = t => t + offset;
    console.groupCollapsed(`%cLOADER%c ${detail.plain ? 'plain cover (no WebGL)' : detail.failsafe ? 'FAILSAFE: it never finished' : `done at ${ms(now())}`} — ${detail.late ?? 0} late frames of ${detail.frames ?? 0}, rip ${detail.ripLate ?? 0} late of ${detail.ripFrames ?? 0}`, style('LOADER'), '');
    const timeline = [
      ...(detail.trail ?? []).map(([t, what]) => ({ t, what, from: 'page' })),
      ...Object.entries(detail.phases ?? {}).map(([name, p]) => ({ t: page(p.at), what: `${name} (loader clock ${p.clock}s)`, from: detail.thread })),
    ].sort((a, b) => a.t - b.t);
    console.table(timeline.map(row => ({ 'at ms': Math.round(row.t), step: row.what, from: row.from })));
    if (detail.frames) {
      say('LOADER', `ran on the ${detail.thread} thread · its own drawing: ${(detail.work / detail.frames).toFixed(2)}ms a frame on average, worst ${ms(detail.workWorst)} · ${detail.uploads} canvas uploads`);
      if (detail.thread === 'main') warn('LOADER', 'on the main thread (no WebGL in workers here, e.g. Safari before 17): anything the page does holds it up.');
    }
    const gaps = (detail.gaps ?? []).map(([t, gap, clock]) => {
      const end = page(t), start = end - gap;
      const during = events.filter(e => e.end >= start - 4 && e.t <= end).sort((a, b) => b.ms - a.ms);
      return { 'at ms': Math.round(start), 'frame ms': gap, 'loader clock': clock, 'page doing then': during.slice(0, 3).map(e => `${e.what} ${ms(e.ms)}`).join(' | ') || '(nothing seen: the GPU, or another tab)' };
    });
    if (gaps.length) { say('LOADER', `${gaps.length} hitches (frames over 25ms), and what the page was doing then:`); console.table(gaps); }
    else say('LOADER', 'no hitches: every frame on time.');
    console.groupEnd();
    // And whether it let go of everything.
    setTimeout(() => {
      const left = [];
      if (document.querySelector('.loader')) left.push('its element is still in the page');
      if (document.documentElement.classList.contains('is-loading')) left.push('the page is still marked is-loading (scroll held)');
      if (document.querySelector('canvas.loader__stage')) left.push('its canvas is still in the page');
      if (left.length) warn('LOADER', `did not clean up: ${left.join('; ')}`);
      else say('LOADER', 'cleaned up: element and canvas gone, page released, its GPU context let go.');
    }, 600);
    setTimeout(() => summary('since the page opened'), 4000);
  });

  /* ----- GSAP ------------------------------------------------------------ */
  function instrumentGsap(gsap) {
    if (gsap.__perf) return;
    gsap.__perf = true;
    const wrapped = new Map();
    const add = gsap.ticker.add.bind(gsap.ticker), remove = gsap.ticker.remove.bind(gsap.ticker);
    gsap.ticker.add = (fn, once, prioritize) => {
      const label = `${fn.name || 'listener'} · ${origin()}`;
      const timed = (...args) => { const start = now(); const result = fn(...args); tally(listeners, label, now() - start); return result; };
      wrapped.set(fn, timed);
      return add(timed, once, prioritize);
    };
    gsap.ticker.remove = fn => remove(wrapped.get(fn) ?? fn);
    const describe = targets => {
      const first = Array.isArray(targets) ? targets[0] : targets;
      if (!first) return '?';
      if (typeof first === 'string') return first;
      if (first instanceof Element) return `${first.tagName.toLowerCase()}${first.classList[0] ? `.${first.classList[0]}` : ''}`;
      return first.constructor?.name && first.constructor.name !== 'Object' ? first.constructor.name : `{${Object.keys(first).slice(0, 2).join(',')}}`;
    };
    const timeUpdates = (targets, vars) => {
      if (!vars || typeof vars !== 'object') return vars;
      const label = `${vars.id ?? describe(targets)} · ${origin()}`;
      const created = tweens.get(label) ?? { count: 0, total: 0, worst: 0, made: 0 };
      created.made++;
      tweens.set(label, created);
      if (typeof vars.onUpdate !== 'function') return vars;
      const update = vars.onUpdate;
      return { ...vars, onUpdate(...args) { const start = now(); const result = update.apply(this, args); tally(tweens, label, now() - start); return result; } };
    };
    for (const method of ['to', 'from', 'fromTo']) {
      const original = gsap[method].bind(gsap);
      gsap[method] = (targets, a, b, ...rest) => method === 'fromTo' ? original(targets, a, timeUpdates(targets, b), ...rest) : original(targets, timeUpdates(targets, a), b, ...rest);
      const proto = gsap.core.Timeline.prototype, timeline = proto[method];
      proto[method] = function (targets, a, b, ...rest) {
        return method === 'fromTo' ? timeline.call(this, targets, a, timeUpdates(targets, b), ...rest) : timeline.call(this, targets, timeUpdates(targets, a), b, ...rest);
      };
    }
  }

  /* ----- 3D -------------------------------------------------------------- */
  function watchRenderer(name, renderer) {
    contextNames.set(renderer.getContext(), name);
    const entry = { name, renderer, frames: new Map(), scenes: new Set(), calls: 0, triangles: 0, renders: 0, ms: 0, worst: 0 };
    renderers.set(name, entry);
    const render = renderer.render.bind(renderer);
    renderer.render = (scene, camera) => {
      const start = now();
      render(scene, camera);
      const spent = now() - start;
      entry.renders++; entry.ms += spent; entry.worst = Math.max(entry.worst, spent);
      entry.calls += renderer.info.render.calls; entry.triangles += renderer.info.render.triangles;
      entry.scenes.add(scene);
    };
  }
  const trianglesOf = object => {
    let triangles = 0, meshes = 0;
    object.traverse(child => {
      const geometry = child.geometry;
      if (!geometry || !(child.isMesh || child.isPoints || child.isLine)) return;
      meshes++;
      const count = geometry.index ? geometry.index.count : geometry.attributes.position?.count ?? 0;
      triangles += child.isMesh ? count / 3 : count;
    });
    return { triangles: Math.round(triangles), meshes };
  };

  /* ----- the summary ------------------------------------------------------ */
  function summary(title = 'since the last reset') {
    console.groupCollapsed(`%cPERF%c summary ${title}`, style('PERF'), '');
    if (tasks.size) { say('MAIN', 'scripts in long frames (over 50ms), most time first:'); table(tasks); }
    if (sections.size) { say('MAIN', 'frames dropped (over 34ms) by section on screen:'); table(sections); }
    if (gpuWork.size) { say('GPU', 'shader compiles and picture uploads, by canvas:'); table(gpuWork); }
    if (listeners.size) { say('GSAP', 'ticker listeners (run every frame), most time first:'); table(listeners); }
    const updates = new Map([...tweens].filter(([, v]) => v.made));
    if (updates.size) { say('GSAP', 'tweens: how many made, and their onUpdate time:'); table(updates, 20, (key, v) => ({ made: v.made })); }
    if (jobs.size) { say('PERF', 'timed jobs:'); table(jobs); }
    if (renderers.size) {
      say('3D', 'renderers:');
      console.table(Object.fromEntries([...renderers.values()].map(r => [r.name, {
        renders: r.renders, 'avg ms': +(r.ms / Math.max(1, r.renders)).toFixed(2), 'worst ms': +r.worst.toFixed(1),
        'avg draw calls': Math.round(r.calls / Math.max(1, r.renders)), 'avg triangles': Math.round(r.triangles / Math.max(1, r.renders)),
        programs: r.renderer.info.programs?.length ?? '?', textures: r.renderer.info.memory.textures, geometries: r.renderer.info.memory.geometries,
      }])));
      const heaviest = [];
      const path = object => { const names = []; for (let o = object; o && !o.isScene; o = o.parent) names.unshift(o.name || (o === object ? '' : o.type)); return names.filter(Boolean).join(' › ') || object.type; };
      renderers.forEach(r => r.scenes.forEach(scene => scene.traverse(child => {
        if (!child.geometry || !(child.isMesh || child.isPoints || child.isLine)) return;
        heaviest.push({ renderer: r.name, object: `${path(child)} (${child.geometry.type}, ${child.material?.type ?? '?'})`, shown: child.visible, ...trianglesOf(child) });
      })));
      models.forEach((info, name) => heaviest.push({ renderer: 'model', object: name, ...info }));
      say('3D', 'meshes in the scenes and the loaded models, heaviest first:');
      console.table(heaviest.sort((a, b) => b.triangles - a.triangles).slice(0, 25));
    }
    const glb = performance.getEntriesByType('resource').filter(e => /\.(glb|gltf)/.test(e.name));
    if (glb.length) console.table(glb.map(e => ({ file: e.name.split('/').pop(), KB: Math.round((e.encodedBodySize || e.transferSize) / 1024), 'download ms': Math.round(e.duration) })));
    console.groupEnd();
  }

  const api = {
    renderer: watchRenderer,
    gsap: instrumentGsap,
    model(name, object) { models.set(name, trianglesOf(object)); },
    time(label, fn) { const start = now(); try { return fn(); } finally { tally(jobs, label, now() - start); } },
  };
  window.perf = {
    report: () => summary(),
    reset() { [tasks, gpuWork, sections, listeners, jobs].forEach(m => m.clear()); tweens.forEach(v => { v.count = v.total = v.worst = 0; }); renderers.forEach(r => Object.assign(r, { calls: 0, triangles: 0, renders: 0, ms: 0, worst: 0 })); say('PERF', 'reset.'); },
    loader: () => loaderReport,
    gsap: () => { table(listeners); table(tweens, 30, (key, v) => ({ made: v.made })); },
    gpu: () => table(gpuWork),
    three: () => summary('(3D)'),
    sections: () => table(sections),
    events: () => events.slice(),
  };
  return api;
}
