import * as THREE from 'three';
import { SURFACE_LIGHTING } from '../hero/lighting.glsl.js';
import { isDark } from '../coinMarks.js';

/**
 * The coin as a ring: a wristband, engraved, threaded through the band of words under the process (components/about,
 * the about's last part; moreTransition has the choreography). It is the coin itself: one mesh that is the coin (a
 * plain disc, as big and as thick: once the coin's mark has gone, the stage swaps one for the other face on, and they
 * cannot be told apart) and is punched out into the ring, in two moves: `hole` 0 → 1, a hole opening at its middle
 * and growing out to the rim, a flat ring face on; then `depth` 0 → 1, the rim deepening into a band. Then the
 * engraving is written round it (`engrave`).
 *
 * All three shapes are the same sweep round the axis (z, the coin's) of a closed outline (across: out from the axis;
 * along: z), with the same points, so each goes into the next point for point (the vertex shader mixes them):
 *
 *   coin   out to `outer`, the middle solid (`inner` 0), `half` thick either side, its rim's corners rounded `corner`
 *   flat   the coin punched out: a flat ring as thick as it was
 *   ring   a band from `inner` out to `outer`, `half` wide either side, its corners rounded `corner`
 *
 * At radius 1 (the stage scales it to the coin's radius). The engraving is on the outside of the band, all the way
 * round: lines of monospaced type (`lines`), drawn into a strip as long as the band is round.
 */
const COIN = { inner: 0, outer: 1.05, half: .12, corner: .05 };
const FLAT = { inner: .955, outer: 1.04, half: .1, corner: .03 };
const RING = { inner: .955, outer: 1.04, half: .21, corner: .03 };
/** Points round the axis, and along each straight side and each corner of the outline. */
const ROUND = 220, SIDE = 6, CORNER = 6;
/** The engraving's strip (px): as long as the band is round for its width (2π · 1.04 : 0.42). */
const STRIP = { w: 4096, h: 264 };

/** The outline, for a shape: points (across, along) and which way out of the solid each faces, in order round it. */
function outline({ inner, outer, half, corner }) {
  const points = [];
  const rIn = Math.min(corner, inner), rOut = corner;
  const arc = (cx, cz, r, from) => {
    for (let k = 1; k <= CORNER; k++) {
      const a = from + k / CORNER * Math.PI / 2;
      points.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r, 'corner']);
    }
  };
  const side = (a0, z0, a1, z1, kind) => {
    for (let k = 0; k < SIDE; k++) points.push([a0 + (a1 - a0) * k / SIDE, z0 + (z1 - z0) * k / SIDE, kind]);
  };
  // Round it anticlockwise (across as x, along as y): up the outside, in across the top, down the inside, out across
  // the foot. Each straight side, then the corner after it.
  side(outer, -half + rOut, outer, half - rOut, 'outside');
  arc(outer - rOut, half - rOut, rOut, 0);
  side(outer - rOut, half, inner + rIn, half, 'top');
  arc(inner + rIn, half - rIn, rIn, Math.PI / 2);
  side(inner, half - rIn, inner, -half + rIn, 'inside');
  arc(inner + rIn, -half + rIn, rIn, Math.PI);
  side(inner + rIn, -half, outer - rOut, -half, 'foot');
  arc(outer - rOut, -half + rOut, rOut, Math.PI * 1.5);
  // Which way out each point faces: square to the outline there (anticlockwise, so out is (dz, -da)).
  return points.map((point, i) => {
    const before = points[(i - 1 + points.length) % points.length], after = points[(i + 1) % points.length];
    let da = after[0] - before[0], dz = after[1] - before[1];
    // (Where the outline folds back on itself, at the coin's axis, square to the side it is on.)
    if (Math.hypot(da, dz) < 1e-6) { da = 0; dz = -1; }
    const length = Math.hypot(da, dz);
    return { a: point[0], z: point[1], na: dz / length, nz: -da / length, kind: point[2] };
  });
}

function geometry() {
  const coin = outline(COIN), flat = outline(FLAT), ring = outline(RING), count = coin.length;
  const positions = [], normals = [], flatPositions = [], flatNormals = [], ringPositions = [], ringNormals = [], text = [], index = [];
  for (let j = 0; j <= ROUND; j++) {
    const theta = j / ROUND * Math.PI * 2, c = Math.cos(theta), s = Math.sin(theta);
    for (let i = 0; i < count; i++) {
      const p = coin[i], f = flat[i], q = ring[i];
      positions.push(p.a * c, p.a * s, p.z);
      normals.push(p.na * c, p.na * s, p.nz);
      flatPositions.push(f.a * c, f.a * s, f.z);
      flatNormals.push(f.na * c, f.na * s, f.nz);
      ringPositions.push(q.a * c, q.a * s, q.z);
      ringNormals.push(q.na * c, q.na * s, q.nz);
      // The engraving's place: round the band, and up the outside of it (0 at its foot, 1 at its top); and whether
      // this is the outside at all (its corners too, there only the strip's empty margins are read).
      const outside = q.kind === 'outside' || (q.kind === 'corner' && q.a > (RING.inner + RING.outer) / 2);
      text.push(j / ROUND, Math.min(1, Math.max(0, (q.z + RING.half) / (RING.half * 2))), outside ? 1 : 0);
    }
  }
  for (let j = 0; j < ROUND; j++) {
    for (let i = 0; i < count; i++) {
      const a = j * count + i, b = j * count + (i + 1) % count, c = (j + 1) * count + i, d = (j + 1) * count + (i + 1) % count;
      // (Facing out: round the axis, then along the outline.)
      index.push(a, c, b, b, c, d);
    }
  }
  const shape = new THREE.BufferGeometry();
  shape.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  shape.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  shape.setAttribute('aFlat', new THREE.Float32BufferAttribute(flatPositions, 3));
  shape.setAttribute('aFlatNormal', new THREE.Float32BufferAttribute(flatNormals, 3));
  shape.setAttribute('aRing', new THREE.Float32BufferAttribute(ringPositions, 3));
  shape.setAttribute('aRingNormal', new THREE.Float32BufferAttribute(ringNormals, 3));
  shape.setAttribute('aText', new THREE.Float32BufferAttribute(text, 3));
  shape.setIndex(index);
  return shape;
}

const VERTEX = /* glsl */ `
attribute vec3 aFlat, aFlatNormal, aRing, aRingNormal, aText;
uniform float uHole, uDepth;
varying vec3 vView, vNormal, vText;
varying float vDepth;
void main() {
  vec3 p = mix(mix(position, aFlat, uHole), aRing, uDepth);
  vNormal = normalize(normalMatrix * normalize(mix(mix(normal, aFlatNormal, uHole), aRingNormal, uDepth)));
  vec4 world = modelMatrix * vec4(p, 1.0);
  vDepth = world.z;
  vec4 view = viewMatrix * world;
  vView = view.xyz;
  vText = aText;
  gl_Position = projectionMatrix * view;
}
`;

const FRAGMENT = /* glsl */ `
uniform vec3 uColor, uShade, uHighlight, uInk, uGold;
uniform float uRoughness, uEngrave;
uniform sampler2D uText;
/**
 * The band of words on the page as it is just now (css px: its top and foot down the screen, its left and right
 * across), and the screen's height and pixel ratio.
 */
uniform vec4 uBand, uBandX;
uniform vec2 uView;
varying vec3 vView, vNormal, vText;
varying float vDepth;
${SURFACE_LIGHTING}
void main() {
  vec3 color = shadeSurface(vView, normalize(vNormal));
  // The engraving, written round the outside of the band (uEngrave 0 → 1, from the front round), as if it were being
  // cut: what is just cut glows the monogram's gold, cooling to the ink behind the cut.
  float written = uEngrave * 1.08 - vText.x, cut = smoothstep(0.0, .012, written);
  float ink = texture2D(uText, vText.xy).a * step(.5, vText.z) * cut;
  vec3 engraved = mix(uInk, uGold, exp(-max(written, 0.0) * 14.0) * (1.0 - smoothstep(.85, 1.0, uEngrave)));
  color = mix(color, engraved, ink * .94);
  // Threaded through the band of words: what of it is behind the page (behind its middle), where the band is, is
  // seen only faintly through it.
  float down = uView.x - gl_FragCoord.y / uView.y, across = gl_FragCoord.x / uView.y;
  float under = step(vDepth, 0.0) * step(uBand.x, down) * step(down, uBand.y) * step(uBandX.x, across) * step(across, uBandX.y);
  gl_FragColor = vec4(color, mix(1.0, .12, under));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export class Band {
  constructor(scene) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = STRIP.w;
    this.canvas.height = STRIP.h;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.wrapS = THREE.RepeatWrapping;
    this.texture.anisotropy = 8;
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: {
        uColor: { value: new THREE.Color() }, uShade: { value: new THREE.Color() }, uHighlight: { value: new THREE.Color() },
        uInk: { value: new THREE.Color() }, uGold: { value: new THREE.Color('#d9b06a') }, uRoughness: { value: .46 },
        uHole: { value: 0 }, uDepth: { value: 0 }, uEngrave: { value: 0 }, uText: { value: this.texture },
        uBand: { value: new THREE.Vector4(-1, -1, 0, 0) }, uBandX: { value: new THREE.Vector4(-1, -1, 0, 0) }, uView: { value: new THREE.Vector2(1, 1) },
      },
      transparent: true,
    });
    this.group = new THREE.Group();
    this.spin = new THREE.Group();
    this.mesh = new THREE.Mesh(geometry(), this.material);
    this.mesh.frustumCulled = false;
    this.spin.add(this.mesh);
    this.group.add(this.spin);
    this.group.visible = false;
    scene.add(this.group);
    this.lines = [];
  }

  /** What is engraved round it: lines of type, each said over until it is all the way round. */
  engrave(lines) {
    this.lines = lines;
    this.draw();
  }

  /** The scheme changed: the coin's own colours, and the engraving in the ink that shows on them. */
  paint(palette) {
    const u = this.material.uniforms;
    u.uColor.value.set(palette.figure);
    u.uShade.value.set(palette.figureShade);
    u.uHighlight.value.set(palette.figureHighlight);
    u.uInk.value.set(isDark(palette.figure) ? '#efe6da' : '#1d1820');
    this.draw();
  }

  draw() {
    const g = this.canvas.getContext('2d'), { w, h } = STRIP;
    g.clearRect(0, 0, w, h);
    if (!this.lines.length) return;
    g.fillStyle = '#fff';
    g.textBaseline = 'middle';
    const size = 62, gap = 1.22, rows = this.lines.length, top = h / 2 - (rows - 1) * size * gap / 2;
    g.font = `500 ${size}px "Cascadia Mono", "JetBrains Mono", "SF Mono", Menlo, Consolas, monospace`;
    this.lines.forEach((line, n) => {
      const text = `${line}   `, wide = g.measureText(text).width, times = Math.max(1, Math.round(w / wide));
      // (Spread to fit the strip exactly, so it meets itself round the back with no seam.)
      const spread = (w - wide * times) / (text.length * times);
      g.letterSpacing = `${spread.toFixed(2)}px`;
      g.fillText(text.repeat(times), 0, top + n * size * gap);
    });
    g.letterSpacing = '0px';
    this.texture.needsUpdate = true;
  }

  /**
   * This frame: at (x, y) on the screen (px), of radius r, turned `quaternion` and spun `spin` (rad) round its own
   * axis; punched out `hole` and deepened `depth` of the way (0 → 1 each), its engraving written `engrave` of the way
   * round; `band` the band of words on the screen as it is just now (css px: top, bottom, left, right; none, nothing
   * of it threaded), `viewH` the screen's height and `dpr` its pixel ratio.
   */
  place({ x, y, r, quaternion, spin, hole, depth, engrave, band, viewH, dpr }) {
    this.group.visible = true;
    this.group.position.set(x, -y, 0);
    this.group.scale.setScalar(r);
    this.group.quaternion.copy(quaternion);
    this.spin.rotation.set(0, 0, spin);
    const u = this.material.uniforms;
    u.uHole.value = hole;
    u.uDepth.value = depth;
    u.uEngrave.value = engrave;
    u.uBand.value.set(band ? band.top : -1, band ? band.bottom : -1, 0, 0);
    u.uBandX.value.set(band ? band.left : -1, band ? band.right : -1, 0, 0);
    u.uView.value.set(viewH, dpr);
  }

  hide() { this.group.visible = false; }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
  }
}
