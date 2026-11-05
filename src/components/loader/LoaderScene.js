import { VERTEX, FRAGMENT } from './paper.glsl.js';
import { DIGITS, PERCENT } from './glyphs.js';
import { BOUNDS, CENTRE, STROKES, smileLines, tracePart } from './smile.js';

/**
 * The loader: the smile drawn as the page loads, the star, and the rip that
 * lets the page out.
 *
 * It normally runs in its own thread (loader.worker.js), so nothing the page
 * does to the main thread can make it stutter; where that is not possible
 * startLoader.js runs the same class on the main thread.
 *
 * Time here only ever moves on by a frame's worth (MAX_STEP), however long a
 * frame took: a slow device plays the animation a little slower, and never
 * jumps over any of it.
 */

const MAX_STEP = 1 / 24;
/** Never later than this does the sheet lift, if the page has not said it is ready. */
const GIVE_UP = 16;

const out2 = t => 1 - (1 - t) * (1 - t);
const in2 = t => t * t;
const inOut = t => t * t * (3 - 2 * t);
const back = (t, s = 1.5) => 1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2;
const clamp01 = t => Math.max(0, Math.min(1, t));
const span = (t, from, to) => clamp01((t - from) / (to - from));

function makeCanvas(width, height) {
  // On the main thread, a plain canvas: Safari 16 has OffscreenCanvas but cannot upload one to WebGL, so the smile and
  // the count never showed there. (In the worker there is no document, and OffscreenCanvas is all there is.)
  if (typeof document === 'undefined') return new OffscreenCanvas(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  return canvas;
}

/** A tiling RGBA noise: four independent layers of periodic value noise. */
function bakeNoise(size) {
  const data = new Uint8Array(size * size * 4);
  let seed = 7;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const layer = () => {
    const octaves = [4, 8, 16, 32, 64].map(cells => ({ cells, grid: Array.from({ length: cells * cells }, random) }));
    return (u, v) => {
      let sum = 0, weight = 0, amp = 1;
      for (const { cells, grid } of octaves) {
        const x = u * cells, y = v * cells, ix = Math.floor(x), iy = Math.floor(y);
        const fx = inOut(x - ix), fy = inOut(y - iy);
        const at = (a, b) => grid[(a % cells) + (b % cells) * cells];
        const top = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * fx;
        const low = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * fx;
        sum += (top + (low - top) * fy) * amp;
        weight += amp;
        amp *= .62;
      }
      return sum / weight;
    };
  };
  const layers = [layer(), layer(), layer(), layer()];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      for (let c = 0; c < 4; c++) {
        // Spread back out to the full range: summed octaves crowd the middle.
        const value = (layers[c](x / size, y / size) - .5) * 2.1 + .5;
        data[(x + y * size) * 4 + c] = clamp01(value) * 255;
      }
    }
  }
  return data;
}

export class LoaderScene {
  /**
   * `canvas`: the visible canvas. `post`: how it tells the page what has happened
   * ('started', 'reveal', 'done', 'failed'). `options`: { width, height, dpr, colours,
   * metrics: { gutter, display, unit }, seen, reduced }.
   */
  constructor(canvas, post, options) {
    this.canvas = canvas;
    this.post = post;
    Object.assign(this, options);
    this.clock = 0;
    this.shown = 0;       // the count on screen, 0-1
    this.progress = 0;    // what the page has reported
    this.ready = false;
    this.exitAt = null;
    this.revealed = false;
    this.finished = false;
    this.dirty = true;
    // What the loader saw, sent with 'done' (lib/perf reads it with ?perf): frames late, every hitch, how long its own
    // drawing took, and when each step happened (ms on this thread's clock; `origin` turns them into the page's).
    this.stats = {
      thread: typeof document === 'undefined' ? 'worker' : 'main', origin: performance.timeOrigin,
      frames: 0, late: 0, worst: 0, ripFrames: 0, ripLate: 0, ripWorst: 0, gaps: [],
      work: 0, workWorst: 0, uploads: 0, phases: {},
    };
    this.lastCount = -1;
    this.lastSmile = '';
    this.lastTime = null;
    this.minimum = this.seen ? .5 : 1.1;
    // How fast the steps between the count and the rip go (the rip itself always takes its time).
    // Someone who has seen it gets there sooner.
    this.pace = this.seen ? 1.45 : 1.2;
    this.frame = this.frame.bind(this);
  }

  start() {
    const gl = this.canvas.getContext('webgl', {
      alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false,
    });
    if (!gl || !this.buildGl(gl)) { this.post({ type: 'failed' }); return; }
    // (Lost after it is done is its own doing: stop() lets the context go.)
    this.canvas.addEventListener?.('webglcontextlost', () => { if (this.finished) return; this.stop(); this.post({ type: 'failed' }); });
    this.layout();
    this.phase('started');
    this.post({ type: 'started' });
    this.request = requestAnimationFrame(this.frame);
  }

  stop() {
    this.finished = true;
    if (this.request) cancelAnimationFrame(this.request);
    // Its GPU memory goes now, not whenever the canvas is collected (on the main thread; a worker's goes with it).
    this.gl?.getExtension('WEBGL_lose_context')?.loseContext();
    this.gl = null;
  }

  /** When a step happened, for the report (once each). */
  phase(name) {
    this.stats.phases[name] ??= { at: Math.round(this.now ?? performance.now()), clock: +this.clock.toFixed(2) };
  }

  buildGl(gl) {
    const shader = (type, source) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, source); gl.compileShader(s);
      return s;
    };
    const program = gl.createProgram();
    gl.attachShader(program, shader(gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return false;
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'aPosition');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    this.gl = gl;
    this.u = new Proxy({}, { get: (cache, name) => (cache[name] ??= gl.getUniformLocation(program, name)) });

    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    const texture = (unit, wrap, filter) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    };
    texture(0, gl.CLAMP_TO_EDGE, gl.LINEAR); gl.uniform1i(this.u.uSmile, 0);
    texture(1, gl.CLAMP_TO_EDGE, gl.LINEAR); gl.uniform1i(this.u.uCount, 1);
    texture(2, gl.REPEAT, gl.LINEAR_MIPMAP_LINEAR); gl.uniform1i(this.u.uNoise, 2);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 256, 0, gl.RGBA, gl.UNSIGNED_BYTE, bakeNoise(256));
    gl.generateMipmap(gl.TEXTURE_2D);

    const { glow, ground, edge, ink, accent } = this.colours;
    gl.uniform3fv(this.u.uGlow, glow); gl.uniform3fv(this.u.uGround, ground); gl.uniform3fv(this.u.uEdge, edge);
    gl.uniform3fv(this.u.uInk, ink); gl.uniform3fv(this.u.uAccent, accent);
    return true;
  }

  /** Report from the page. */
  setProgress(value) { this.progress = Math.max(this.progress, value); }
  setReady() { this.ready = true; this.phase('ready'); }
  resize({ width, height, dpr }) { if (!this.gl) return; Object.assign(this, { width, height, dpr }); this.layout(); this.dirty = true; }

  layout() {
    const { gl, dpr, width, height, metrics } = this;
    const W = Math.round(width * dpr), H = Math.round(height * dpr);
    this.canvas.width = W; this.canvas.height = H;
    gl.viewport(0, 0, W, H);
    gl.uniform2f(this.u.uRes, W, H);
    gl.uniform1f(this.u.uPx, dpr);

    // The smile's own small canvas. It is printed into the sheet by the shader.
    this.scale = Math.max(180, Math.min(270, width * .2)) / 194;
    const s = this.scale * dpr;
    this.smileCanvas ??= makeCanvas(1, 1);
    this.smileCanvas.width = Math.ceil(BOUNDS.width * s);
    this.smileCanvas.height = Math.ceil(BOUNDS.height * s);
    this.smileContext = this.smileCanvas.getContext('2d');
    const left = W / 2 + (BOUNDS.x - CENTRE.x) * s, top = (this.middle ?? height / 2) * dpr + (BOUNDS.y - CENTRE.y) * s;
    gl.uniform4f(this.u.uSmileRect, left, top, this.smileCanvas.width, this.smileCanvas.height);
    this.lastSmile = '';

    // The count: bottom right, on its baseline, in its own little canvas.
    const em = metrics.display * dpr, unitEm = metrics.unit * dpr;
    const cell = Math.max(...DIGITS.map(d => d.advance)) / 1000 * em;
    const gap = metrics.unit * .5 * dpr;
    const unitWidth = PERCENT.advance / 1000 * unitEm;
    const countWidth = Math.ceil(cell * 3 + gap + unitWidth + 4 * dpr);
    const countHeight = Math.ceil(em * 1.25);
    this.countCanvas ??= makeCanvas(1, 1);
    this.countCanvas.width = countWidth; this.countCanvas.height = countHeight;
    this.countContext = this.countCanvas.getContext('2d');
    this.countLayout = { em, unitEm, cell, gap, unitWidth, baseline: Math.round(em * 1.02) };
    gl.uniform4f(this.u.uCountRect, W - metrics.gutter * dpr - countWidth, H - metrics.gutter * dpr + em * .16 - countHeight, countWidth, countHeight);
    this.paths = this.paths ?? { digits: DIGITS.map(d => new Path2D(d.d)), percent: new Path2D(PERCENT.d) };
    this.lastCount = -1;

    // How far the rip has to grow to clear the whole screen is worked out from where the star lands.
    this.placeStar();
  }

  placeStar() {
    const { dpr, width } = this;
    const { tooth } = smileLines(1, 1);
    const s = this.scale * dpr;
    this.star = {
      x: width * dpr / 2 + (tooth.x - CENTRE.x) * s,
      y: (this.middle ?? this.height / 2) * dpr + (tooth.y - CENTRE.y) * s,
    };
    this.gl.uniform2f(this.u.uStar, this.star.x, this.star.y);
    const W = width * dpr, H = this.height * dpr;
    const corner = (x, y) => (Math.sqrt(Math.abs(x - this.star.x) / .52) + Math.sqrt(Math.abs(y - this.star.y))) ** 2;
    this.clear = Math.max(corner(0, 0), corner(W, 0), corner(0, H), corner(W, H)) + 900 * dpr;
    this.tug = 30 * this.scale * dpr;
  }

  drawSmile(progress, pull) {
    const key = `${progress.toFixed(4)}|${pull.toFixed(4)}`;
    if (key === this.lastSmile) return;
    const { smileContext: c, smileCanvas, dpr, scale, gl } = this;
    const s = scale * dpr;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, smileCanvas.width, smileCanvas.height);
    c.setTransform(s, 0, 0, s, -BOUNDS.x * s, -BOUNDS.y * s);
    c.strokeStyle = '#f00';
    c.lineCap = 'round'; c.lineJoin = 'round';
    const { lines } = smileLines(this.reduced ? 1 : progress, pull);
    lines.forEach((line, i) => {
      const [from, to, weight] = STROKES[i];
      const drawn = this.reduced ? 1 : clamp01((progress - from) / (to - from));
      if (!drawn) return;
      c.lineWidth = weight;
      c.beginPath();
      tracePart(c, line, drawn);
      c.stroke();
    });
    gl.activeTexture(gl.TEXTURE0);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, smileCanvas);
    this.stats.uploads++;
    // (Only once it is on the GPU: a failed upload is tried again next frame.)
    this.lastSmile = key;
    this.dirty = true;
  }

  drawCount(value, rise, alpha) {
    const key = `${value}|${rise.toFixed(3)}|${alpha.toFixed(3)}`;
    if (key === this.lastCount) return;
    const { countContext: c, countCanvas, countLayout: l, gl, paths } = this;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, countCanvas.width, countCanvas.height);
    if (alpha > 0) {
      c.globalAlpha = alpha;
      const digits = String(value).padStart(3, '0');
      const y = l.baseline + rise * countCanvas.height;
      const size = l.em / 1000;
      c.fillStyle = '#f00';
      [...digits].forEach((digit, i) => {
        const glyph = DIGITS[+digit];
        const x = i * l.cell + (l.cell - glyph.advance * size) / 2;
        c.setTransform(size, 0, 0, size, x, y);
        c.fill(paths.digits[+digit]);
      });
      const unit = l.unitEm / 1000;
      c.setTransform(unit, 0, 0, unit, l.cell * 3 + l.gap, y);
      // The outline is Manrope's lightest; a fine stroke brings it up to the weight it is set in.
      c.fillStyle = c.strokeStyle = '#0f0';
      c.lineWidth = 34;
      c.lineJoin = 'round';
      c.fill(paths.percent);
      c.stroke(paths.percent);
      c.globalAlpha = 1;
    }
    gl.activeTexture(gl.TEXTURE1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, countCanvas);
    this.stats.uploads++;
    this.lastCount = key;
    this.dirty = true;
  }

  frame(time) {
    if (this.finished) return;
    this.request = requestAnimationFrame(this.frame);
    const raw = this.lastTime == null ? 1 / 60 : (time - this.lastTime) / 1000;
    this.lastTime = time;
    this.now = time;
    const stats = this.stats;
    if (stats.frames > 0) {
      if (raw * 1000 > stats.worst) { stats.worst = raw * 1000; stats.worstAt = this.clock; }
      if (raw > 1 / 30) stats.late++;
      // Every visible hitch, by when it happened (for tuning; a handful of numbers).
      if (raw > 1 / 40 && stats.gaps.length < 60) stats.gaps.push([Math.round(time), Math.round(raw * 1000), +this.clock.toFixed(2)]);
      if (this.revealed) {
        stats.ripFrames++;
        stats.ripWorst = Math.max(stats.ripWorst, raw * 1000);
        if (raw > 1 / 30) stats.ripLate++;
      }
    }
    stats.frames++;
    const dt = Math.min(raw, MAX_STEP);
    this.clock += dt;
    const began = performance.now();
    try {
      this.step(dt);
    } catch (error) {
      // A frame that cannot be drawn must not stop the next one, or the exit.
      if (!this.warned) { this.warned = true; console.warn('Loader frame failed', error); }
    }
    const spent = performance.now() - began;
    stats.work += spent;
    stats.workWorst = Math.max(stats.workWorst, spent);
  }

  step(dt) {
    const { gl, u, clock, pace, reduced, dpr } = this;

    // The count never sits still: until the page says it is done it creeps on by the clock as well as by
    // what has been reported, and always leaves room for the last stretch.
    if (this.exitAt == null) {
      const creep = 1 - Math.exp(-clock / (this.seen ? 1 : 2.6));
      const target = Math.min(.97, Math.max(this.progress, creep * .92));
      this.shown += (target - this.shown) * (1 - Math.exp(-dt / .22));
      if ((this.ready && clock >= this.minimum) || clock >= GIVE_UP) {
        this.exitAt = clock;
        this.phase(this.ready ? 'exit' : 'exit (gave up waiting)');
        this.exitFrom = this.shown;
      }
    }

    let pull = 0, starSize = 0, hole = -1, amp = 0, fade = 1, countAlpha = 1, finish = false;
    let rise = reduced ? 0 : 1 - (1 - span(clock, .1, .9)) ** 3;
    rise = 1 - rise;

    if (this.exitAt != null) {
      const e = clock - this.exitAt;
      const COUNT = reduced ? .2 : .42 / pace;
      this.shown = this.exitFrom + (1 - this.exitFrom) * inOut(clamp01(e / COUNT));
      const g = (e - COUNT) * pace;   // seconds into the star, at its pace
      if (g >= 0) {
        if (reduced) {
          fade = 1 - clamp01(g / .3);
          if (!this.revealed) this.reveal();
          finish = fade === 0;
        } else {
          // The grin takes the strain.
          if (g < .12) pull = -.12 * in2(g / .12);
          else if (g < .42) pull = -.12 + 1.12 * back(span(g, .12, .42), 1.4);
          else pull = 1 - .25 * out2(span(g, .42, .58));
          countAlpha = 1 - span(g, .1, .36);

          // The star twinkles twice on the tooth.
          const size = this.scale * dpr * 24;
          if (g >= .59) {
            this.phase('star');
            if (g < .75) starSize = size * back(span(g, .59, .75));
            else if (g < .87) starSize = size * (1 - .78 * inOut(span(g, .75, .87)));
            else starSize = size * (.22 + .78 * back(span(g, .87, 1.05), 1.3));
          }

          // And goes through: a tug, the paper holds for a moment, then it runs.
          const TUG = 1.05, HOLD = 1.17, RIP = 1.17 + 1.05 * pace;
          if (g >= TUG) {
            if (!this.revealed) this.reveal();
            const opened = this.tug * back(span(g, TUG, TUG + .1), 1.2);
            const run = span(g, HOLD, RIP);
            // Slow as it gives, then away: the tips reach the edges first and the flaps follow.
            const eased = run ** 2.35;
            hole = opened + (this.clear - this.tug) * eased;
            // Only slightly ragged: enough to read as torn, never enough to look busy.
            amp = dpr * (1 + 1.5 * span(g, TUG, HOLD) + 4.5 * Math.min(1, eased * 7));
            starSize *= 1 - span(g, HOLD - .04, HOLD + .1);
            finish = run >= 1;
          }
        }
      }
    }

    const shownCount = Math.round(this.shown * 100);
    this.drawSmile(this.shown, pull);
    this.drawCount(shownCount, rise, countAlpha * (1 - rise));
    if (this.reportedCount !== shownCount) { this.reportedCount = shownCount; this.post({ type: 'count', value: shownCount }); }

    const key = `${hole}|${starSize}|${fade}`;
    if (key !== this.lastDraw || this.dirty) {
      this.lastDraw = key;
      this.dirty = false;
      gl.uniform1f(u.uHole, hole);
      gl.uniform1f(u.uAmp, amp);
      gl.uniform1f(u.uLine, 1.3 * dpr);
      gl.uniform1f(u.uStarSize, starSize);
      gl.uniform1f(u.uFade, fade);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    if (finish) {
      this.finished = true;
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      this.phase('done');
      this.post({ type: 'done', stats: this.stats });
    }
  }

  reveal() {
    this.revealed = true;
    this.phase('rip');
    this.post({ type: 'reveal' });
  }
}
