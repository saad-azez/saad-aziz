import * as THREE from 'three';
import { STICKER_VERTEX, STICKER_FRAGMENT } from '../bookShaders.js';
import { drawSticker, stickerImages } from './stickerArt.js';
import { reducedMotion } from '../../../brand/motion.js';

/**
 * The stickers on the book's covers (JOURNAL.stickers), for the reader to peel
 * off and stick down again anywhere on the book.
 *
 * Each is a mesh under its cover (so it rides the book however it is turned),
 * drawn in the cover's own space (bookShaders STICKER_VERTEX), with its own
 * shadow. Under the pointer a corner lifts, asking to be peeled. Taken hold
 * of, it peels from the edge nearest the hand right across to the far one,
 * the part that has come away rising steeply off the board round a curl, and
 * is off: held at a slant from the edge in the hand, its shadow on the board
 * under it. Carried, it swings and its free end flaps with the speed. Let go,
 * it drops, and lays itself down from the far edge back to the one held, as a
 * sticker is smoothed down. Everything moves on springs (`SPRING`), so it has
 * weight and overshoots a little. Where a reader leaves a sticker is kept in
 * their browser.
 *
 * Places are in the cover's space, in page lengths: x across the board from
 * the hinge, z along the spine; covers 0 (the back, cover A) and 1 (the front).
 */

const STORE = 'saad:stickers:v2';
/**
 * How it moves. `hover`: under the pointer, how much of it lifts (of its length
 * along the peel), at `hoverAngle` (rad). `peeling`: how steeply it rises
 * while coming off; `held`: the slant it is carried at; `laying`: as it is
 * smoothed down. `lift`: how high it is carried (page lengths). `curl`: the
 * curl's radius (of its smaller side). `swing`: how far it turns for how fast
 * it is carried across, and at most; `flap`: how far its free end rises for
 * how fast it is carried, and at most.
 */
const MOTION = {
  hover: .16, hoverAngle: .5, peeling: 1.05, held: .24, laying: .3,
  lift: .028, curl: .09, swing: .06, swingMost: .35, flap: 1.4, flapMost: .5,
};
/**
 * The springs (rad/s, damping): peeling off (quick, a touch of overshoot), the
 * angle it rises at (lively), the lift, and laying back down (slower, so it is
 * seen to roll down from its far edge).
 */
const SPRING = { peel: [11, .8], lay: [7, .9], angle: [15, .45], lift: [11, .7] };
/**
 * The coin as a weight on a sticker it rests on. Pulled, the sticker peels
 * only up to the coin's edge (less `margin` of the coin's radius), the more
 * the harder it is pulled; it strains up (`strain`, rad more at full pull);
 * and only a pull `yank` long (page lengths, across the cover) tears it out
 * from under the coin, which jolts and settles. `catchUp`: how quickly the
 * sticker, torn free, catches up with the hand (per second).
 */
const WEIGHT = { margin: .15, strain: .35, yank: .32, catchUp: 16 };
/**
 * Thrown off when the coin breaks out from under them (scatter): each flies
 * back to where it was first stuck: flung first away from the coin (`fling`
 * page lengths out) and up (`arc` high at its top), spinning (`spin` whole
 * turns, either way) down to its first tilt, in `time` seconds, the top one
 * first, then the next (`stagger`), then it lays itself down.
 */
const SCATTER = { time: 1.2, stagger: .05, arc: .4, fling: .6, spin: 1 };
/** The stickers over the coin as it fights them (heave, 0 → 1): how high they bulge over it (times its face) and how they jitter (rad). */
const HEAVE = { height: 2, rate: 23, jitter: .08 };

/** Move `state[key]` (its velocity in `state[key + 'V']`) toward `target` on a spring, for `dt`. Returns whether it is still moving. */
function spring(state, key, target, [omega, zeta], dt) {
  const v = key + 'V';
  const steps = Math.max(1, Math.ceil(dt * 240)), h = dt / steps;
  for (let i = 0; i < steps; i++) {
    state[v] += (omega * omega * (target - state[key]) - 2 * zeta * omega * state[v]) * h;
    state[key] += state[v] * h;
  }
  return Math.abs(target - state[key]) > 1e-4 || Math.abs(state[v]) > 1e-3;
}
/** Which way the sticker's right and up run across each cover, seen from outside it. */
const FRAME = [
  { right: new THREE.Vector2(-1, 0), up: new THREE.Vector2(0, 1) },
  { right: new THREE.Vector2(1, 0), up: new THREE.Vector2(0, -1) },
];

function load() {
  try { return JSON.parse(localStorage.getItem(STORE) ?? '{}') ?? {}; } catch { return {}; }
}

export default class Stickers {
  /**
   * `covers`: the two cover meshes; `shared`: the book's shared uniforms;
   * `board`: { thickness, bow, x0, x1, half } of a cover in page lengths (`bow`
   * the book's own uniform, as it bows now: Book.bow);
   * `list`: JOURNAL.stickers; `onChange`: something needs drawing.
   */
  constructor({ covers, shared, board, list, onChange }) {
    this.covers = covers;
    this.board = board;
    this.onChange = onChange;
    this.items = [];
    this.top = 0;
    this.drag = null;
    this.hovered = null;
    // Fine enough to bend round a curl, and to take the coin's round edge where it lies over it.
    this.geometry = new THREE.PlaneGeometry(1, 1, 64, 64);
    /** The coin in its seat, for the stickers on the front cover to lie over (setCoin): x, z, radius, height. */
    this.coin = new THREE.Vector4(0, 0, 1, 0);
    this.noCoin = new THREE.Vector4(0, 0, 1, 0);
    /**
     * The coin and the stickers over its seat: whichever came last is on top. `coinOnTop`: the coin landed on a
     * sticker already there (it rests on it; no bump). `coinSeated`: it is in its seat; `coinHeight` how high its
     * face stands; `bump` how far a sticker over it is stretched over it (0 → 1, eased in once it has landed).
     */
    this.coinOnTop = false;
    this.coinSeated = false;
    this.coinHeight = 0;
    this.bump = 0;
    /** How hard a sticker pinned under the coin is being pulled (0 → 1), and when it was last torn free (ms), for the coin's tremble and jolt. */
    this.coinStrain = 0;
    this.coinJolt = -Infinity;
    /** How hard the coin is fighting the stickers piled on it (0 → 1, the stage sets it): they heave over it. */
    this.heave = 0;
    const saved = load();
    const across = board.x1 - board.x0;
    list.forEach(spec => {
      const art = drawSticker(spec);
      const map = new THREE.CanvasTexture(art.colour);
      map.colorSpace = THREE.SRGBColorSpace;
      map.anisotropy = 8;
      const skin = new THREE.CanvasTexture(art.finish);
      const cover = spec.side === 'back' ? 0 : 1;
      const w = spec.size * across, h = w * art.aspect;
      const item = {
        spec, art, map, skin, cover,
        centre: this.fromSeen(cover, spec.u, spec.v),
        tilt: spec.tilt ?? 0,
        order: this.top++,
        lift: 0, liftV: 0, peel: 0, peelV: 0, angle: 0, angleV: 0, swing: 0, length: 1,
        hovered: false, laying: false,
        edge: new THREE.Vector2(), dir: new THREE.Vector2(-.7, -.7),
      };
      const place = saved[spec.id];
      if (place && (place.cover === 0 || place.cover === 1) && Number.isFinite(place.x) && Number.isFinite(place.z)) {
        item.cover = place.cover;
        item.centre.set(place.x, place.z);
        if (Number.isFinite(place.tilt)) item.tilt = place.tilt;
        if (Number.isFinite(place.order)) item.order = place.order;
      }
      this.top = Math.max(this.top, item.order + 1);
      const own = {
        uMap: { value: map },
        uSkin: { value: skin },
        uCenter: { value: item.centre },
        uRight: { value: FRAME[item.cover].right },
        uUp: { value: FRAME[item.cover].up },
        uTilt: { value: item.tilt },
        uSize: { value: new THREE.Vector2(w, h) },
        uThick: { value: board.thickness },
        uBow: board.bow,
        uLayer: { value: 0 },
        uLift: { value: 0 },
        uPeelEdge: { value: item.edge },
        uPeelDir: { value: item.dir },
        uPeel: { value: 0 },
        uAngle: { value: 0 },
        uCurl: { value: MOTION.curl * Math.min(w, h) + .003 },
        uBounds: { value: new THREE.Vector4(board.x0, board.x1, -board.half, board.half) },
        // The coin sits on the front cover only.
        uCoin: { value: item.cover === 1 ? this.coin : this.noCoin },
      };
      item.uniforms = own;
      item.size = own.uSize.value;
      item.mesh = new THREE.Mesh(this.geometry, new THREE.ShaderMaterial({
        vertexShader: STICKER_VERTEX, fragmentShader: STICKER_FRAGMENT,
        uniforms: { ...shared, ...own, uShadow: { value: 0 } },
        side: THREE.DoubleSide,
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      }));
      item.shadow = new THREE.Mesh(this.geometry, new THREE.ShaderMaterial({
        vertexShader: STICKER_VERTEX, fragmentShader: STICKER_FRAGMENT,
        uniforms: { ...shared, ...own, uShadow: { value: 1 } },
        transparent: true, depthWrite: false,
        polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
      }));
      for (const mesh of [item.mesh, item.shadow]) { mesh.frustumCulled = false; mesh.renderOrder = mesh === item.shadow ? 1 : 2; }
      this.attach(item);
      this.items.push(item);
    });
    // Drawn again once the portrait, the marks and the fonts are in.
    stickerImages().then(() => {
      this.items.forEach(item => {
        item.art = drawSticker(item.spec, { colour: item.art.colour, finish: item.art.finish });
        item.map.needsUpdate = true;
        item.skin.needsUpdate = true;
      });
      this.onChange?.();
    });
  }

  /**
   * Where the coin's seat is on the front cover (x, z, its radius, in the
   * cover's space), how high the coin's face stands off the board, and whether
   * the coin is in it (`seated`: landed, not on its way). Until it lands, it
   * is on its way to whatever is there: if a sticker covers the seat then, the
   * coin comes down on top of it. A sticker laid over the coin once it is in
   * its seat is stretched over it (the bump, eased in by `update`).
   */
  setCoin(x, z, r, height, seated) {
    this.coin.x = x; this.coin.y = z; this.coin.z = r;
    this.coinHeight = Math.max(0, height);
    if (!seated) this.coinOnTop = this.seatCovered();
    if (seated !== this.coinSeated) this.onChange?.();
    this.coinSeated = seated;
  }

  /** Whether a sticker on the front cover lies over the coin's seat (`only`: that one sticker): any of it, at its middle or round its rim. */
  seatCovered(only = null) {
    const { x, y: z, z: r } = this.coin;
    for (const item of this.items) {
      if (item.cover !== 1 || (only ? item !== only : this.drag?.item === item)) continue;
      for (let k = 0; k <= 8; k++) {
        const a = k / 8 * Math.PI * 2, d = k === 8 ? 0 : r * .75;
        const p = this.local(item, x + Math.cos(a) * d, z + Math.sin(a) * d);
        if (item.art.solid(p.x / item.size.x + .5, p.y / item.size.y + .5)) return true;
      }
    }
    return false;
  }

  /** Put a sticker's meshes under its cover. */
  attach(item) {
    const cover = this.covers[item.cover];
    cover.add(item.shadow);
    cover.add(item.mesh);
    item.uniforms.uRight.value = FRAME[item.cover].right;
    item.uniforms.uUp.value = FRAME[item.cover].up;
  }

  /** A place on cover `cover` as it is seen (u left → right, v top → bottom) in its own space. */
  fromSeen(cover, u, v) {
    const { x0, x1, half } = this.board;
    const across = cover === 1 ? u : 1 - u;
    return new THREE.Vector2(x0 + across * (x1 - x0), cover === 1 ? v * 2 * half - half : half - v * 2 * half);
  }

  /** Where the ray meets cover `cover`'s outer face, in its own space (x, z), or null. Its face is bowed, so twice. */
  onCover(cover, ray, out = new THREE.Vector2()) {
    const mesh = this.covers[cover];
    const inverse = this._inverse ??= new THREE.Matrix4();
    inverse.copy(mesh.matrixWorld).invert();
    const o = (this._o ??= new THREE.Vector3()).copy(ray.origin).applyMatrix4(inverse);
    const d = (this._d ??= new THREE.Vector3()).copy(ray.direction).applyMatrix3((this._m3 ??= new THREE.Matrix3()).setFromMatrix4(inverse));
    if (Math.abs(d.y) < 1e-9) return null;
    let y = this.board.thickness, t = 0;
    for (let pass = 0; pass < 3; pass++) {
      t = (y - o.y) / d.y;
      const x = o.x + d.x * t;
      y = this.board.thickness + this.board.bow.value * Math.max(0, x) ** 2;
    }
    if (t < 0) return null;
    return out.set(o.x + d.x * t, o.z + d.z * t);
  }

  /** Whether cover `cover`'s outside faces the camera. */
  facing(cover, camera) {
    const mesh = this.covers[cover];
    const normal = (this._n ??= new THREE.Vector3()).set(0, 1, 0).transformDirection(mesh.matrixWorld);
    const at = (this._p ??= new THREE.Vector3()).set(.5, this.board.thickness, 0).applyMatrix4(mesh.matrixWorld);
    return normal.dot(at.sub(camera.position).negate()) > 0;
  }

  /** A point on a cover (x, z) on sticker `item`, in its own frame (a right, b up, page lengths). */
  local(item, x, z, out = new THREE.Vector2()) {
    const { right, up } = FRAME[item.cover];
    const dx = x - item.centre.x, dz = z - item.centre.y;
    const qx = dx * right.x + dz * right.y, qy = dx * up.x + dz * up.y;
    const c = Math.cos(item.tilt + item.swing), s = Math.sin(item.tilt + item.swing);
    return out.set(c * qx + s * qy, -s * qx + c * qy);
  }

  /** The sticker under the ray (the uppermost), with where on it and on its cover; or null. */
  pick(ray, camera) {
    let best = null;
    for (const cover of [0, 1]) {
      if (!this.facing(cover, camera)) continue;
      const at = this.onCover(cover, ray);
      if (!at) continue;
      for (const item of this.items) {
        if (item.cover !== cover || (best && best.item.order > item.order)) continue;
        const p = this.local(item, at.x, at.y);
        if (item.art.solid(p.x / item.size.x + .5, p.y / item.size.y + .5)) best = { item, a: p.x, b: p.y, x: at.x, z: at.y };
      }
    }
    return best;
  }

  /**
   * What is under the ray on whichever cover faces the camera: the sticker
   * there, if any (it wins), else the place on the cover as it is seen
   * ({ side, u, v }); or null off the book.
   */
  coverAt(ray, camera) {
    const hit = this.pick(ray, camera);
    if (hit) return { sticker: hit.item };
    const { x0, x1, half } = this.board;
    for (const cover of [0, 1]) {
      if (!this.facing(cover, camera)) continue;
      const at = this.onCover(cover, ray);
      if (!at || at.x < x0 || at.x > x1 || Math.abs(at.y) > half) continue;
      const across = (at.x - x0) / (x1 - x0);
      return {
        side: cover === 1 ? 'front' : 'back',
        u: cover === 1 ? across : 1 - across,
        v: cover === 1 ? (at.y + half) / (2 * half) : (half - at.y) / (2 * half),
      };
    }
    return null;
  }

  /** Peel `item` from the edge in the direction of (a, b) from its middle. */
  peelFrom(item, a, b) {
    let dx = a, dy = b;
    const length = Math.hypot(dx, dy);
    if (length < 1e-5) { dx = .7; dy = .7; } else { dx /= length; dy /= length; }
    const w = item.size.x / 2, h = item.size.y / 2;
    const reach = Math.min(w / Math.max(Math.abs(dx), 1e-5), h / Math.max(Math.abs(dy), 1e-5));
    item.edge.set(dx * reach, dy * reach);
    item.dir.set(-dx, -dy);
    // How far it is across, along the peel: from the edge to the farthest corner.
    item.length = reach + Math.abs(dx) * w + Math.abs(dy) * h;
  }

  /** The pointer is over the book (ray) or has left it (null): a sticker under it lifts a corner. Returns whether one is. */
  hover(ray, camera) {
    if (this.drag) return true;
    const hit = ray ? this.pick(ray, camera) : null;
    if (this.hovered && this.hovered !== hit?.item) this.hovered.hovered = false;
    this.hovered = hit?.item ?? null;
    if (hit) {
      // The corner nearest the pointer, while the sticker is still flat (so it never jumps mid-peel).
      if (hit.item.peel < .002 && !hit.item.laying) {
        this.peelFrom(hit.item, hit.a, hit.b);
        // Under other stickers, only as far as their edge.
        hit.item.hoverLimit = this.coveredPeel(hit.item);
      }
      hit.item.hovered = true;
    }
    this.onChange?.();
    return Boolean(hit);
  }

  /** Take hold of the sticker under the ray, if there is one. Returns whether it did. */
  grab(ray, camera) {
    const hit = this.pick(ray, camera);
    if (!hit) return false;
    const item = hit.item;
    // From the edge nearest the hand; one caught as it was being laid down carries on from where it was.
    if (item.peel < .002) this.peelFrom(item, hit.a, hit.b);
    item.laying = false;
    // Held down by what lies on it: the coin resting on it (pulled hard enough, it tears free: WEIGHT), or other
    // stickers stuck on top of it (it never comes out from under those: only its free part lifts).
    const underCoin = this.coinSeated && this.coinOnTop && item.cover === 1 && this.seatCovered(item);
    const underStickers = this.coveredPeel(item);
    if (!underCoin && underStickers === Infinity) item.order = this.top++;
    this.drag = {
      item, offset: new THREE.Vector2(item.centre.x - hit.x, item.centre.y - hit.z), last: new THREE.Vector2(hit.x, hit.z), time: performance.now(),
      pinned: underCoin || underStickers < Infinity, yankable: underStickers === Infinity,
      from: new THREE.Vector2(hit.x, hit.z), target: item.centre.clone(), pull: 0, catchUp: false,
    };
    this.drag.limit = Math.min(underCoin ? this.pinnedPeel(item) : Infinity, underStickers);
    this.onChange?.();
    return true;
  }

  /** Whether the coin is trapped: in its seat, under any sticker laid over it (one is enough). */
  coinTrapped() {
    return this.coinSeated && !this.coinOnTop && this.items.some(item => item.cover === 1 && !item.fly && this.seatCovered(item));
  }

  /**
   * The coin breaks out: every sticker over its seat is thrown off it, the one
   * on top first, each back to where it was first stuck (JOURNAL.stickers),
   * and laid down there, in the order they were first stuck.
   */
  scatter() {
    if (this.drag) this.release();
    let delay = 0;
    const thrown = this.items.filter(item => item.cover === 1 && this.seatCovered(item)).sort((a, b) => b.order - a.order);
    thrown.forEach(item => {
      const to = this.fromSeen(item.cover, item.spec.u, item.spec.v);
      // Peeled from its far side from home, so it lifts toward where it is going.
      const home = this.local(item, to.x, to.y);
      this.peelFrom(item, -home.x, -home.y);
      item.laying = false;
      // Flung out away from the coin (toward home, or any way if home is under it), then curving down onto home.
      const out = new THREE.Vector2().subVectors(item.centre, new THREE.Vector2(this.coin.x, this.coin.y)).add(new THREE.Vector2().subVectors(to, item.centre).multiplyScalar(.6));
      if (out.lengthSq() < 1e-6) out.set(Math.random() - .5, Math.random() - .5);
      const via = item.centre.clone().addScaledVector(out.normalize(), SCATTER.fling);
      const turns = Math.round((item.spec.tilt ?? 0) - item.tilt) + (Math.random() < .5 ? -1 : 1) * SCATTER.spin;
      item.fly = { from: item.centre.clone(), via, to, tiltFrom: item.tilt, tiltTo: (item.spec.tilt ?? 0) + turns * Math.PI * 2, t: -delay };
      delay += SCATTER.stagger;
    });
    // Laid down as they were first stuck: their first order.
    const first = new Map(this.items.map((item, i) => [item, i]));
    [...thrown].sort((a, b) => first.get(a) - first.get(b)).forEach(item => { item.order = this.top++; });
    this.coinOnTop = false;
    this.onChange?.();
  }

  /** Whether any sticker is still flying home after the coin broke out. */
  get flying() { return this.items.some(item => item.fly); }

  /** Where on its cover a point of sticker `item` (a right, b up, in its own frame) is: the inverse of `local`. */
  onBoard(item, a, b, out = new THREE.Vector2()) {
    const { right, up } = FRAME[item.cover];
    const c = Math.cos(item.tilt + item.swing), s = Math.sin(item.tilt + item.swing);
    const qx = c * a - s * b, qy = s * a + c * b;
    return out.set(item.centre.x + right.x * qx + up.x * qy, item.centre.y + right.y * qx + up.y * qy);
  }

  /**
   * How far sticker `item` can peel from its edge (peelFrom) before it runs
   * under another sticker stuck on top of it; Infinity when nothing lies on it.
   */
  coveredPeel(item) {
    const above = this.items.filter(other => other !== item && other.cover === item.cover && other.order > item.order && !other.fly);
    if (!above.length) return Infinity;
    const steps = 40, across = 9, perp = [-item.dir.y, item.dir.x];
    const p = this._pp ??= new THREE.Vector2(), q = this._pq ??= new THREE.Vector2();
    const halfW = Math.hypot(item.size.x, item.size.y) / 2;
    for (let k = 0; k <= steps; k++) {
      const s = item.length * k / steps;
      for (let j = 0; j < across; j++) {
        const w = (j / (across - 1) * 2 - 1) * halfW;
        const a = item.edge.x + item.dir.x * s + perp[0] * w, b = item.edge.y + item.dir.y * s + perp[1] * w;
        if (!item.art.solid(a / item.size.x + .5, b / item.size.y + .5)) continue;
        this.onBoard(item, a, b, p);
        for (const other of above) {
          this.local(other, p.x, p.y, q);
          if (other.art.solid(q.x / other.size.x + .5, q.y / other.size.y + .5)) return Math.max(0, s - item.length * .04);
        }
      }
    }
    return Infinity;
  }

  /** How far a sticker under the coin can peel, from the edge it is pulled by: up to the coin's edge, no further. */
  pinnedPeel(item) {
    const c = this.local(item, this.coin.x, this.coin.y);
    const toCoin = (c.x - item.edge.x) * item.dir.x + (c.y - item.edge.y) * item.dir.y;
    return Math.max(0, toCoin - this.coin.z * (1 - WEIGHT.margin));
  }

  /** Carry the held sticker to the ray, across its cover, kept on the board. Pinned under the coin, it stays and strains instead. */
  move(ray) {
    const drag = this.drag;
    if (!drag) return;
    const at = this.onCover(drag.item.cover, ray);
    if (!at) return;
    const item = drag.item, { x0, x1, half } = this.board, margin = .03;
    drag.target.set(
      THREE.MathUtils.clamp(at.x + drag.offset.x, x0 + margin, x1 - margin),
      THREE.MathUtils.clamp(at.y + drag.offset.y, -half + margin, half - margin),
    );
    if (drag.pinned) {
      drag.pull = Math.min(at.distanceTo(drag.from), drag.yankable ? Infinity : WEIGHT.yank * .999);
      if (drag.yankable && drag.pull > WEIGHT.yank) {
        // Torn out from under the coin: it comes away into the hand, and the coin, its weight gone, jolts and settles.
        drag.pinned = false;
        drag.limit = Infinity;
        drag.catchUp = true;
        this.coinOnTop = false;
        this.coinJolt = performance.now();
      }
    } else if (!drag.catchUp) item.centre.copy(drag.target);
    // It swings a little with how fast it is carried across, as a held thing does.
    const now = performance.now(), dt = Math.max(.008, (now - drag.time) / 1000);
    const { right } = FRAME[item.cover];
    const across = ((at.x - drag.last.x) * right.x + (at.y - drag.last.y) * right.y) / dt;
    drag.velocity = (drag.velocity ?? 0) * .6 + across * .4;
    drag.last.copy(at);
    drag.time = now;
    this.onChange?.();
  }

  /** Let go of the held sticker: it lays itself down where it is, and stays there. */
  release() {
    const drag = this.drag;
    if (!drag) return;
    this.drag = null;
    const item = drag.item;
    item.tilt += item.swing;
    item.swing = 0;
    item.laying = true;
    // Laid over the coin in its seat: now the sticker is the one on top (stretched over it); let go still pinned
    // under it, it stays where it was, under it.
    if (!drag.pinned && this.coinSeated && item.cover === 1 && this.seatCovered()) this.coinOnTop = false;
    if (drag.catchUp) item.centre.copy(drag.target);
    this.save();
    this.onChange?.();
  }

  save() {
    const places = {};
    this.items.forEach(item => { places[item.spec.id] = { cover: item.cover, x: +item.centre.x.toFixed(4), z: +item.centre.y.toFixed(4), tilt: +item.tilt.toFixed(4), order: item.order }; });
    try { localStorage.setItem(STORE, JSON.stringify(places)); } catch { /* kept for this visit only */ }
  }

  /**
   * Move everything on by `dt`; `shown` whether the stickers are on show (not once the book is open, its covers'
   * backs together), and `flat` how far they are laid down flat on their boards (0 → 1, as the covers close in on
   * each other). Returns whether anything is still moving.
   */
  update(dt, shown, flat = 0) {
    this.flat = flat;
    let moving = false;
    const step = reducedMotion || dt <= 0 ? 0 : Math.min(dt, 1 / 30);
    // The bump: only once the coin has landed in its seat, and only under a sticker laid on top of it.
    const bump = this.coinSeated && !this.coinOnTop ? 1 : 0;
    this.bump = step ? this.bump + (bump - this.bump) * (1 - Math.exp(-step * 14)) : bump;
    if (Math.abs(bump - this.bump) < 1e-3) this.bump = bump; else moving = true;
    // Fighting under them, the coin heaves the stickers up over it, harder and harder, in pulses.
    const heaving = reducedMotion ? 0 : this.heave;
    const pulse = .55 + .45 * Math.sin(performance.now() / 1000 * HEAVE.rate * (.7 + .3 * heaving));
    this.coin.w = this.coinHeight * this.bump * (1 + heaving * HEAVE.height * pulse);
    if (heaving > 0) moving = true;
    // The coin feels a sticker pulled from under it.
    const strain = this.drag?.pinned ? THREE.MathUtils.clamp(this.drag.pull / WEIGHT.yank, 0, 1) : 0;
    this.coinStrain += (strain - this.coinStrain) * (step ? 1 - Math.exp(-step * 12) : 1);
    if (this.coinStrain > 1e-3 || performance.now() - this.coinJolt < 1200) moving = true;
    const byOrder = [...this.items].sort((a, b) => a.order - b.order);
    byOrder.forEach((item, rank) => {
      item.mesh.visible = item.shadow.visible = shown;
      const held = this.drag?.item === item;
      let peel = 0, angle = 0, lift = 0, peelSpring = SPRING.peel;
      if (item.fly) {
        // Thrown off the coin: off the board at once, then across in an arc, turning, to its new place.
        const fly = item.fly;
        fly.t += step || SCATTER.time * 2;
        const p = THREE.MathUtils.clamp(fly.t / SCATTER.time, 0, 1);
        // Fast off the coin, slowing as it comes down home.
        const e = 1 - (1 - p) ** 2.4;
        peel = item.length + item.uniforms.uCurl.value * 4;
        angle = MOTION.held * (1 - p) + .05;
        // Up at once, highest early, settling down onto the board.
        lift = p > 0 ? MOTION.lift + SCATTER.arc * Math.sin(Math.PI * Math.min(1, e * 1.05)) * (1 - p * .3) : 0;
        fly.lift = lift;
        const a = (1 - e) * (1 - e), b = 2 * e * (1 - e), c = e * e;
        item.centre.set(a * fly.from.x + b * fly.via.x + c * fly.to.x, a * fly.from.y + b * fly.via.y + c * fly.to.y);
        item.tilt = fly.tiltFrom + (fly.tiltTo - fly.tiltFrom) * e;
        if (p >= 1) { item.fly = null; item.tilt = item.spec.tilt ?? 0; item.laying = true; this.save(); }
        moving = true;
      } else if (held && this.drag.pinned) {
        // Under the coin: it peels only toward it, the more the harder it is pulled, its free end straining up.
        const strain = THREE.MathUtils.clamp(this.drag.pull / WEIGHT.yank, 0, 1);
        peel = Math.min(this.drag.limit, item.length) * (.45 + .55 * strain);
        angle = MOTION.peeling + WEIGHT.strain * strain;
      } else if (held) {
        // Coming off: steeply while it peels across, then carried at a slant, its free end flapping with the speed.
        peel = item.length + item.uniforms.uCurl.value * 4;
        const flap = THREE.MathUtils.clamp(Math.abs(this.drag.velocity ?? 0) * MOTION.flap, 0, MOTION.flapMost);
        angle = item.peel < item.length * .8 ? MOTION.peeling : MOTION.held + flap;
        lift = item.peel > item.length * .6 ? MOTION.lift : 0;
      } else if (item.laying) {
        // Dropped, then smoothed down from the far edge back to the one held.
        angle = MOTION.laying;
        peelSpring = SPRING.lay;
        if (item.peel < .002 && Math.abs(item.peelV) < .01) item.laying = false;
      } else if (item.hovered) {
        // Under the coin resting on it, its corner lifts only as far as the coin lets it.
        const pinned = this.coinSeated && this.coinOnTop && item.cover === 1 && this.seatCovered(item);
        peel = Math.min(item.length * MOTION.hover, pinned ? this.pinnedPeel(item) : Infinity, item.hoverLimit ?? Infinity);
        angle = MOTION.hoverAngle;
      }
      if (step === 0) {
        Object.assign(item, { peel, angle, lift, peelV: 0, angleV: 0, liftV: 0 });
      } else {
        if (spring(item, 'peel', peel, peelSpring, step)) moving = true;
        if (spring(item, 'angle', angle, SPRING.angle, step)) moving = true;
        if (spring(item, 'lift', lift, SPRING.lift, step)) moving = true;
        item.peel = Math.max(0, item.peel);
        item.lift = Math.max(0, item.lift);
        item.angle = THREE.MathUtils.clamp(item.angle, 0, 1.4);
      }
      // Torn free, it catches up with the hand.
      if (held && this.drag.catchUp) {
        item.centre.lerp(this.drag.target, step ? 1 - Math.exp(-step * WEIGHT.catchUp) : 1);
        if (item.centre.distanceTo(this.drag.target) < 1e-4) { item.centre.copy(this.drag.target); this.drag.catchUp = false; } else moving = true;
      }
      const swingTarget = held && !this.drag.pinned ? THREE.MathUtils.clamp(-(this.drag.velocity ?? 0) * MOTION.swing, -MOTION.swingMost, MOTION.swingMost) : 0;
      item.swing += (swingTarget - item.swing) * (step ? 1 - Math.exp(-step * 6) : 1);
      if (held && this.drag.velocity) this.drag.velocity *= Math.exp(-step * 6);
      if (Math.abs(swingTarget - item.swing) > 1e-4) moving = true;
      const u = item.uniforms;
      // Jostled over the coin as it fights them.
      const jostle = heaving && item.cover === 1 && !item.fly ? heaving * HEAVE.jitter * Math.sin(performance.now() * .031 + item.order * 1.7) : 0;
      u.uTilt.value = item.tilt + item.swing + jostle;
      // Flying home, held exactly as high as its arc (no spring lagging behind it).
      if (item.fly?.lift !== undefined) { item.lift = item.fly.lift; item.liftV = 0; u.uLift.value = item.lift; }
      u.uLift.value = item.lift;
      u.uPeel.value = item.peel;
      u.uAngle.value = Math.max(item.angle, .001);
      // Each above the ones stuck down before it, the one in the hand above them all: far enough apart (about a
      // pixel: a sticker's thickness) for the depth buffer to tell them apart where they overlap, and drawn in that
      // order, each pulled a step nearer than the one before, by more where it slopes (over the coin's rim, the
      // book turned edge on), so two never mix where they lie on one another, on any screen's depth buffer.
      // (Laid flatter as the covers close in on each other: Book, `flat`.)
      u.uLayer.value = (.0006 + rank * .003) * (1 - this.flat * .9);
      item.mesh.renderOrder = 2 + rank * .01;
      item.mesh.material.polygonOffsetFactor = -2 - rank;
      item.mesh.material.polygonOffsetUnits = -2 - rank * 4;
    });
    return moving || Boolean(this.drag);
  }

  dispose() {
    this.items.forEach(item => {
      item.mesh.parent?.remove(item.mesh);
      item.shadow.parent?.remove(item.shadow);
      item.mesh.material.dispose();
      item.shadow.material.dispose();
      item.map.dispose();
      item.skin.dispose();
    });
    this.geometry.dispose();
  }
}
