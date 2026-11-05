import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { SURFACE_LIGHTING } from '../hero/lighting.glsl.js';
import { discPieces } from './puzzle.js';
import { drawn, turned, PROCESS_AT } from './processTransition.js';
import { blurPlane, channel } from '../../lib/canvasBlur.js';

/**
 * The process's puzzle (DotStage stepProcess; components/process lays it out, processTransition has the
 * choreography): the coin itself, in nine pieces (puzzle discPieces), each a solid of the coin's own thickness and
 * bevel, in the coin's own material and light (the letters' colours, BRAND.md "figure"), so that put together they are
 * the coin and the stage can hand one over for the other without a seam showing.
 *
 * The seams' bevels, as they shut (uReveal to 0), are lit more and more as the face is, so the coin reads as one; open,
 * they catch the light as any cut edge does. What is said on it is cut through to the ground behind (BRAND.md
 * "ground"), so it reads in either scheme: across the face, what the coin says (uWords: coinWords, the stage's one
 * drawing); on each piece's back, what it is, whole, as big as its piece
 * allows. And far pieces sink a little into the ground's colour, never so far that what they say is lost.
 *
 * All of it in the stage's own world (a px a unit, y up, the screen at z 0), drawn in its own scene before the coin's.
 * The pieces hang from `pivot`, at the disc's middle, which turns as the coin opens so its layers show; their shadows,
 * on a wall far behind them all, do not turn with it.
 */
/** The wall the shadows fall on (of the disc's radius, behind the screen), and how far the light throws them. */
const WALL = { depth: 2.3, throw: .16 };
/**
 * The bevel round every piece, of a cell: under the narrowest neck of a tab (.068 of a cell), or the face inside it
 * folds over itself. (A touch less than the coin's own rim; the coin itself is shown whenever the puzzle is shut.)
 */
const BEVEL = .05;
/** How far each piece goes as the coin opens: out from the middle (of the radius), and toward the reader (+) or back. */
const OPEN = { out: .3, depth: [.45, -.3, -.55, -.8, -.45, -1.05, -1.3, -.95, -1.2], tip: .16 };
/** The view as the coin opens: turned about its upright (rad) and tipped back, less on an upright screen. */
const VIEW = { wide: { yaw: .44, pitch: .18 }, tall: { yaw: .26, pitch: .12 } };
/**
 * As each piece comes back in: how far toward the reader its way bows (of the radius), how far the middle leans to it
 * (rad), and how much of the way it keeps showing what it is before it turns face up.
 */
const DRAW = { bow: .5, lean: .22, back: .55 };
/** How far a far piece sinks into the ground's colour, at most (so what it says still reads). */
const FOG = .34;
/**
 * What each piece says on its back: as big as this of the coin's radius, and no wider than this of its piece (or of a
 * corner's, which the rim cuts away, so it narrows across its middle).
 */
const LABEL = { size: .1, fill: .7, corner: .5 };
/** The light, in the view's own terms: where it is as the coin is everywhere else, and low across the face from the left. */
const KEY = { up: new THREE.Vector3(-.65, 1.1, 1.3).normalize(), low: new THREE.Vector3(-1, .16, .12).normalize() };

const VERTEX = /* glsl */ `
attribute vec2 aDisc;
attribute float aSeam;
uniform float uReveal;
varying vec3 vView, vNormal;
varying vec2 vDisc;
varying float vCap, vBack, vFront;
void main() {
  vDisc = aDisc;
  // (The words run on over a seam's bevel, so a seam never breaks a letter; only a cut edge's side has none.)
  vFront = smoothstep(.15, .4, normal.z);
  vBack = normal.z < -.5 ? 1.0 : 0.0;
  vCap = smoothstep(.85, .99, abs(normal.z));
  // (Shut, a seam's bevel is lit as the face is: the pieces read as one coin.)
  vec3 n = normalize(mix(normal, vec3(0.0, 0.0, vBack > .5 ? -1.0 : 1.0), (1.0 - uReveal) * aSeam));
  vNormal = normalize(normalMatrix * n);
  vec4 view = modelViewMatrix * vec4(position, 1.0);
  vView = view.xyz;
  gl_Position = projectionMatrix * view;
}
`;
// (The coin's light, from wherever uKey has it, as rough as the coin's face or rim.)
const LIGHTING = SURFACE_LIGHTING
  .replace('vec3 key = normalize(vec3(-0.65, 1.1, 1.3));', 'vec3 key = uKey;')
  .replaceAll('uColor', 'surface')
  .replaceAll('uRoughness', 'roughness');
const FRAGMENT = /* glsl */ `
uniform vec3 uColor, uHighlight, uGround, uKey;
uniform float uFog, uGlint;
uniform sampler2D uWords, uLabels;
varying vec3 vView, vNormal;
varying vec2 vDisc;
varying float vCap, vBack, vFront;
vec3 surface;
float roughness;
${LIGHTING}
void main() {
  vec3 n = normalize(vNormal);
  float face = vCap * (1.0 - vBack);
  roughness = mix(.32, .48, vCap);
  surface = uColor;
  vec3 color = shadeSurface(vView, n);
  // A glint (the coin's own): a band of light run once across the face, corner to corner, as it shuts.
  vec2 uv = vDisc * .5 + .5;
  float band = (uv.x + uv.y) * .5 - (uGlint * 1.5 - .25);
  color += uHighlight * exp(-band * band / .0035) * sin(3.14159265 * uGlint) * .7 * face;
  // What it says, cut through to the ground: the words on its face, and on its back what it is (drawn mirrored, to
  // be read from behind).
  // (The words' canvas spans the face: .97 of the radius each way.)
  float said = vFront * texture2D(uWords, vDisc / (2.0 * .97) + .5).a + vBack * texture2D(uLabels, uv).a;
  color = mix(color, uGround, clamp(said, 0.0, 1.0));
  color = mix(color, uGround, uFog);
  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;
/** The uniforms every piece shares (the rest, its fog, are its own). */
const SHARED = ['uColor', 'uHighlight', 'uGround', 'uKey', 'uReveal', 'uGlint', 'uWords', 'uLabels'];

const clamp01 = v => Math.max(0, Math.min(1, v));
const smooth = v => { const t = clamp01(v); return t * t * (3 - 2 * t); };
const smoother = v => { const t = clamp01(v); return t ** 3 * (t * (t * 6 - 15) + 10); };
const mix = (a, b, t) => a + (b - a) * t;

/** A soft shadow, a rounded square blurred, for every piece to cast (in white: its material gives it its colour). */
function shadowTexture() {
  const S = 128, canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const c = canvas.getContext('2d', { willReadFrequently: true });
  c.fillStyle = '#fff';
  c.beginPath();
  c.roundRect(S * .24, S * .24, S * .52, S * .52, S * .12);
  c.fill();
  // White throughout; only how solid it is softens (lib/canvasBlur: no canvas filter, which Safari before 18 ignores).
  const image = c.getImageData(0, 0, S, S);
  const alpha = blurPlane(channel(image, 3), S, S, S * .09);
  for (let i = 0; i < alpha.length; i++) image.data.set([255, 255, 255, alpha[i]], i * 4);
  c.putImageData(image, 0, 0);
  return new THREE.CanvasTexture(canvas);
}

export class Puzzle {
  constructor() {
    this.scene = new THREE.Scene();
    this.group = new THREE.Group();
    this.group.visible = false;
    this.pivot = new THREE.Group();
    this.shades = new THREE.Group();
    this.group.add(this.shades, this.pivot);
    this.scene.add(this.group);
    this.labelCanvas = document.createElement('canvas');
    this.labelCanvas.width = this.labelCanvas.height = 1024;
    this.labels = new THREE.CanvasTexture(this.labelCanvas);
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: {
        uColor: { value: new THREE.Color() }, uHighlight: { value: new THREE.Color() },
        uGround: { value: new THREE.Color() }, uKey: { value: KEY.up.clone() },
        uReveal: { value: 0 }, uGlint: { value: 0 }, uFog: { value: 0 },
        uWords: { value: null }, uLabels: { value: this.labels },
      },
    });
    this.shadow = shadowTexture();
    this.shadowMaterial = new THREE.MeshBasicMaterial({ map: this.shadow, color: new THREE.Color(), transparent: true, depthWrite: false });
    this.pieces = [];
    this.key = null;
  }

  /**
   * The coin in pieces, as components/process laid it out (`disc`: `{ x, y, r }`, its middle and radius on the pinned
   * screen; `spots`: where each of the eight goes, `{ x, y, z, rx, rz }`; `labels`: what each is, and `heart`, what
   * the middle is; `tall`, an upright
   * screen), each piece `thick` px through, as the coin is at that size. Made again only when that changes.
   */
  build(layout, thick) {
    this.layout = layout;
    const { disc, labels } = layout, R = disc.r;
    const key = `${R.toFixed(2)}|${thick.toFixed(2)}|${layout.heart}|${labels.join('|')}`;
    if (key === this.key) return;
    this.key = key;
    this.clear();
    const { centre, ring, cell } = discPieces();
    const bevel = Math.min(R * cell * BEVEL, thick * .45), depth = Math.max(.5, thick - bevel * 2);
    this.thick = thick;
    [centre, ...ring].forEach((piece, i) => {
      let geometry = new THREE.ExtrudeGeometry(new THREE.Shape(piece.outline.map(([x, y]) => new THREE.Vector2(x * R, y * R))), {
        // (Its bevel inside its line, so the coin's rim is where the coin's is; a hair over it, so no crack shows.)
        depth, steps: 1, curveSegments: 1,
        bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelOffset: .35 - bevel, bevelSegments: 3,
      });
      geometry.translate(0, 0, -depth / 2);
      geometry.deleteAttribute('uv');
      geometry.deleteAttribute('normal');
      geometry = mergeVertices(geometry);
      geometry.computeVertexNormals();
      // Where each point is on the coin (its radii), and whether it is on a seam (1) or the coin's own rim (0).
      const position = geometry.attributes.position, count = position.count;
      const onDisc = new Float32Array(count * 2), seam = new Float32Array(count), rim = 1 - bevel * 2.6 / R;
      for (let k = 0; k < count; k++) {
        const x = position.getX(k) / R + piece.home[0], y = position.getY(k) / R + piece.home[1];
        onDisc[k * 2] = x;
        onDisc[k * 2 + 1] = y;
        seam[k] = 1 - smooth((Math.hypot(x, y) - rim) / (1 - rim));
      }
      geometry.setAttribute('aDisc', new THREE.BufferAttribute(onDisc, 2));
      geometry.setAttribute('aSeam', new THREE.BufferAttribute(seam, 1));
      const material = this.material.clone();
      SHARED.forEach(name => { material.uniforms[name] = this.material.uniforms[name]; });
      const mesh = new THREE.Mesh(geometry, material);
      const shade = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.shadowMaterial.clone());
      shade.material.color = this.shadowMaterial.color;
      this.pivot.add(mesh);
      this.shades.add(shade);
      // (The eight in DOCK order, after the middle: which one it is of them, -1 for the middle.)
      this.pieces.push({ ...piece, mesh, shade, order: i - 1, far: Math.hypot(...piece.home) });
    });
    this.drawLabels();
  }

  /**
   * What each piece is, on its back, whole (the eight their parts, the middle the coin's heart): across its middle in the body face's capitals, as big as LABEL lets
   * it be across its own piece, and mirrored, so it reads the right way round once the piece has turned over to it.
   * (The canvas spans the coin, two radii across; only the letters' shape is used: the shader cuts them through.)
   */
  drawLabels() {
    const canvas = this.labelCanvas, c = canvas.getContext('2d'), S = canvas.width, labels = this.layout?.labels;
    c.clearRect(0, 0, S, S);
    if (!labels || !this.ground) return;
    const body = getComputedStyle(document.documentElement).getPropertyValue('--font-body').trim() || 'sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = this.ground;
    this.pieces.forEach(piece => {
      const label = (piece.order < 0 ? this.layout.heart : labels[piece.order])?.toUpperCase();
      if (!label) return;
      const xs = piece.outline.map(([x]) => x), across = (Math.max(...xs) - Math.min(...xs)) * (piece.c !== 1 && piece.r !== 1 ? LABEL.corner : LABEL.fill) * S / 2;
      c.font = `700 100px ${body}`;
      c.letterSpacing = '6px';
      const size = Math.min(LABEL.size * S / 2, 100 * across / c.measureText(label).width);
      c.font = `700 ${size.toFixed(1)}px ${body}`;
      c.letterSpacing = `${(size * .06).toFixed(1)}px`;
      const x = (piece.home[0] + piece.middle[0]) * .5 + .5, y = .5 - (piece.home[1] + piece.middle[1]) * .5;
      c.save();
      c.translate(x * S, y * S);
      c.scale(-1, 1);
      c.fillText(label, 0, 0);
      c.restore();
    });
    this.labels.needsUpdate = true;
  }

  paint(palette) {
    const u = this.material.uniforms;
    u.uColor.value.set(palette.figure);
    u.uHighlight.value.set(palette.figureHighlight);
    u.uGround.value.set(palette.ground);
    this.shadowMaterial.color.set(palette.figureShade);
    this.ground = palette.ground;
    this.drawLabels();
    document.fonts?.ready.then(() => this.drawLabels());
  }

  /**
   * This frame, at `m` (screens through the process: processTransition, its values `t`), the pinned screen `off` px
   * down the screen (coming up, or scrolling away). Each of the eight, in turn:
   *
   *   open     out from the middle and toward the reader or back, tipped a little, and over to its back, one after
   *            another, the whole turned (VIEW) so its layers show;
   *   scatter  on out to its own place (layout.spots), near or far, still showing its back, the view face on again;
   *   drawn    back in to its place, its way bowing toward the reader, turning face up as it comes, out of the far
   *            ground's colour into the light; the middle leaning toward it;
   *   lock     a press run out through them from the middle.
   *
   * The middle piece opens toward the reader and turns over with the rest, to what it is, the coin's heart; it says so
   * all the while it draws them back in, and turns face up last of all, as the lock starts, so its own part of the
   * reader's words is what makes them whole. (`reduced`: no turning, no flight; each is where its turn has put it.)
   */
  place({ m, off, t, words, reduced = false }) {
    const { layout } = this;
    if (!layout) return;
    const { disc, spots, tall } = layout, R = disc.r;
    const view = tall ? VIEW.tall : VIEW.wide;
    this.pivot.position.set(disc.x, -(disc.y + off), 0);
    this.pivot.rotation.set(-view.pitch * t.view, view.yaw * t.view, 0);
    const u = this.material.uniforms;
    u.uKey.value.copy(KEY.up).lerp(KEY.low, t.graze).normalize();
    u.uReveal.value = t.reveal;
    u.uWords.value = words;
    u.uGlint.value = t.glint;
    let leanX = 0, leanY = 0;
    this.pieces.forEach(piece => {
      const { mesh, order, home } = piece, hx = home[0] * R, hy = home[1] * R;
      const centre = order < 0;
      // Opened: out along the line from the coin's middle to the piece's own, and toward the reader or back.
      const outX = home[0] + piece.middle[0], outY = home[1] + piece.middle[1], len = Math.hypot(outX, outY) || 1;
      const open = t.open * (1 - t.scatter);
      let x = hx + (centre ? 0 : outX / len * R * OPEN.out * t.open);
      let y = hy + (centre ? 0 : outY / len * R * OPEN.out * t.open);
      let z = OPEN.depth[order + 1] * R * open;
      let rx = OPEN.tip * open * (outY / len), rz = 0;
      const [lock] = PROCESS_AT.lock;
      let ry = Math.PI * (reduced ? t.scatter : smoother(turned(m, Math.max(0, order))));
      // (The middle, face up again once the last of them is in.)
      if (centre) ry *= reduced ? (m < lock ? 1 : 0) : 1 - smoother((m - lock + .08) / .22);
      let fog = 0;
      if (!centre) {
        rx -= OPEN.tip * (outX / len) * open * .5;
        const spot = spots[order], sx = spot.x - disc.x, sy = -(spot.y - disc.y), sz = spot.z * R;
        if (t.scatter > 0) {
          x = mix(x, sx, t.scatter);
          y = mix(y, sy, t.scatter);
          z = mix(z, sz, t.scatter);
          rx = mix(rx, spot.rx, t.scatter);
          rz = spot.rz * t.scatter;
        }
        // Drawn back in: on a curve from its place to its home, bowed toward the reader, still showing what it is until
        // it is nearly there, then turning face up.
        const flight = drawn(m, order), go = reduced ? (flight >= .5 ? 1 : 0) : flight;
        if (go > 0) {
          const e = smoother(go), bow = Math.max(sz, 0) * .5 + R * DRAW.bow;
          const cx = (sx + hx) / 2, cy = (sy + hy) / 2;
          x = (1 - e) ** 2 * sx + 2 * (1 - e) * e * cx + e * e * hx;
          y = (1 - e) ** 2 * sy + 2 * (1 - e) * e * cy + e * e * hy;
          z = (1 - e) ** 2 * sz + 2 * (1 - e) * e * bow;
          const back = 1 - smoother(go * 1.1);
          rx = spot.rx * back;
          rz = spot.rz * back;
          ry = Math.PI * (1 - smoother((go - DRAW.back) / (1 - DRAW.back)));
          // (The middle leans toward the one on its way, most as it is half way.)
          const w = Math.sin(Math.PI * go) * (reduced ? 0 : 1), d = Math.hypot(hx, hy) || 1;
          leanX += -hy / d * w;
          leanY += hx / d * w;
        }
        fog = clamp01((-z - R * .2) / (R * 2)) * FOG;
      }
      // The lock: a press run out from the middle, each lifted a touch toward the reader and set down as it passes.
      if (t.lock > 0) z += Math.sin(Math.PI * clamp01((t.lock * 1.6 - piece.far * 1.1) / .45)) * R * .07;
      mesh.position.set(x, y, z);
      mesh.rotation.set(rx, ry, rz, 'YXZ');
      mesh.material.uniforms.uFog.value = fog;
    });
    const middle = this.pieces[0]?.mesh;
    if (middle) middle.rotation.set(middle.rotation.x + leanX * DRAW.lean, middle.rotation.y + leanY * DRAW.lean, middle.rotation.z, 'YXZ');
    // Each piece's shadow, on the wall far behind: thrown down and right of it (the light is above left), wider and
    // fainter the further it is from the wall. Only once the coin is open: shut, it casts none, as the coin itself does not.
    this.pivot.updateMatrixWorld(true);
    const wall = -WALL.depth * R, cast = smooth(t.open * 2) * (1 - smoother(t.lock));
    const at = this._at ??= new THREE.Vector3();
    this.pieces.forEach(({ mesh, shade }) => {
      mesh.getWorldPosition(at);
      const height = at.z - wall;
      shade.visible = cast > .002 && height > 0;
      if (!shade.visible) return;
      const thrown = height * WALL.throw * (1 + t.graze * .7);
      shade.position.set(at.x + thrown, at.y - thrown * 1.25, wall);
      shade.rotation.z = mesh.rotation.z;
      shade.scale.setScalar(R * (1.15 + height / R * .22));
      shade.material.opacity = cast * .34 * Math.max(.25, 1 - height / (R * 4));
    });
  }

  clear() {
    this.pieces.forEach(({ mesh, shade }) => {
      mesh.geometry.dispose();
      mesh.material.dispose();
      shade.geometry.dispose();
      shade.material.dispose();
      this.pivot.remove(mesh);
      this.shades.remove(shade);
    });
    this.pieces = [];
  }

  dispose() {
    this.clear();
    this.material.dispose();
    this.shadowMaterial.dispose();
    this.shadow.dispose();
    this.labels.dispose();
  }
}
