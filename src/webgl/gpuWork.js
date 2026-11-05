/**
 * Work that ties up the GPU: compiling shaders and uploading pictures.
 *
 * The loader draws in its own thread, so nothing the page's JavaScript does can
 * hold it up, but it draws on the same GPU as the page. A burst of compiling or
 * uploading on the page freezes the loader for as long as the burst lasts (a
 * tenth of a second, or more, on a phone). So that work is queued here and done
 * one object at a time, a frame apart: each piece is too small to be seen.
 *
 * Where the browser can compile in the background (KHR_parallel_shader_compile),
 * three's compileAsync waits for it without blocking; elsewhere the pause after
 * each piece gives the driver time to finish before the next one starts.
 */

import { perf } from '../lib/perf.js';

const queue = [];
let running = false;

const frame = () => new Promise(resolve => requestAnimationFrame(() => resolve()));

function texturesOf(material) {
  const found = new Set();
  const take = value => { if (value?.isTexture && value.image) found.add(value); };
  Object.values(material).forEach(take);
  Object.values(material.uniforms ?? {}).forEach(uniform => take(uniform?.value));
  return found;
}

/** Each drawable object under `root` with a material not seen before: the pieces worth compiling one by one. */
function pieces(root) {
  const seen = new Set(), list = [];
  root.traverse(object => {
    if (!(object.isMesh || object.isPoints || object.isLine || object.isSprite) || !object.material) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    if (materials.every(material => seen.has(material))) return;
    materials.forEach(material => seen.add(material));
    list.push({ object, materials });
  });
  return list;
}

async function run() {
  running = true;
  while (queue.length) {
    const { renderer, scene, camera, root, resolve } = queue.shift();
    for (const { object, materials } of pieces(root)) {
      if (renderer.getContext().isContextLost?.()) break;
      const { programs, memory } = renderer.info;
      const before = (programs?.length ?? 0) + memory.textures;
      try {
        // Compiled as part of `scene`, so it picks up that scene's lights, as it will be drawn.
        await renderer.compileAsync(object, camera, scene);
        materials.forEach(material => texturesOf(material).forEach(texture => renderer.initTexture(texture)));
      } catch { /* compiled on its first draw instead */ }
      // A frame's rest only after real work: most objects share a program that is already built.
      if ((renderer.info.programs?.length ?? 0) + renderer.info.memory.textures !== before) await frame();
    }
    resolve();
  }
  running = false;
}

/** Compile `root` (default: all of `scene`) and upload its pictures, one object per frame. Resolves when done. */
export function warmGently(renderer, scene, camera, root = scene) {
  if (!renderer || !root) return Promise.resolve();
  return new Promise(resolve => {
    queue.push({ renderer, scene, camera, root, resolve });
    if (!running) run();
  });
}

/* ----- after the loader ----------------------------------------------------- */

const waiting = [];
let settled = false, pumping = false;

/**
 * The page's opening has settled: the hero's entrance is over (DotStage.heroAtRest). Until then the jobs below wait,
 * so none of them lands in the middle of it. (A few seconds after the loader at the latest, whatever happens.)
 */
export function siteSettled() {
  if (settled) return;
  settled = true;
  pump();
}

function pump() {
  if (pumping || !settled || !waiting.length) return;
  pumping = true;
  const idle = window.requestIdleCallback ?? (fn => setTimeout(() => fn({ timeRemaining: () => 8 }), 50));
  const next = () => idle(deadline => {
    // One job per idle moment: a long one gets a moment to itself, and the frames between are left alone.
    const { job, label } = waiting.shift();
    try { perf.time(`after the loader: ${label}`, job); } catch (error) { console.error(error); }
    if (waiting.length) next();
    else pumping = false;
  }, { timeout: 1500 });
  next();
}

/**
 * Work the first screen does not need (the book's covers and stickers, the coin's marks, compiling the book): run
 * once the loader has gone and the opening has settled, one job per idle moment, in the order asked.
 */
export function afterLoader(job, label = 'job') {
  waiting.push({ job, label });
  pump();
}

// Settled at the latest this long after the loader is done, if the hero never says so (no WebGL, say).
window.addEventListener('loader:done', () => setTimeout(siteSettled, 4000), { once: true });
