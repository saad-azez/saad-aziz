import * as THREE from 'three';
import gsap from 'gsap';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { reducedMotion } from '../../brand/motion.js';
import { WORDMARK } from './wordmark.paths.js';
import hatUrl from '../../assets/3D/straw_hat.glb?url';
import ropeUrl from '../../assets/3D/rope.glb?url';
import { fitHatToLetter } from './hatFit.js';
import HatWind from './HatWind.js';
import HatFlight from './HatFlight.js';

/**
 * The props on the wordmark: the straw hat on the S, and the rope hung
 * through the letters.
 *
 * Both are the models in src/assets/3D, drawn as illustrations: flat colour
 * in a lit and a shaded tone split cleanly, fine texture on top, and a dark
 * ink outline (an inverted hull — the mesh pushed out along its normals and
 * drawn from behind).
 *
 * The hat keeps its own painted texture for the straw weave and the hatch
 * lines, remapped onto the drawing's palette: a pale crown, a tan brim and a
 * crimson band, each with its own shadow colour.
 *
 * The rope is rope.glb itself — its three sculpted strands, its stray hairs
 * and its brushed ends. The model is one short straight length, so copies of
 * it are laid end to end along the rope's path and bent onto it. The copies
 * are cut from a window of the model whose two ends match once the next copy
 * is turned about the axis (measured from the model: see MODEL), so the
 * strands run on unbroken; the first copy keeps the model's left end and
 * the last its right end. The model has no texture coordinates, so its
 * texture is worked out from the geometry: how far a point sits from the
 * axis finds the grooves between strands, and the angle round the axis
 * against the distance along lays the fibres down each strand. Every vertex
 * also carries which strand, which copy and which piece of the model it came
 * from, and where it sat in the model, for animating the strands later.
 *
 * The rope's path hangs from real supports, with gravity between them: it is
 * draped over the tip of the S's lower curl, lies in the S's lower bowl,
 * runs up through the first A's counter to rest on its crossbar, sags in
 * front of the letters to the second A and rests on that crossbar too, sags
 * behind to the floor of the D's bowl, and comes down across the front of the
 * D to pass under the i, which stands on it, and hang away. Each end hangs
 * free. Where the path overlaps a letter the rope is set in front of it or
 * behind it; it only changes sides where nothing is in the way — inside a
 * counter, or in the air between letters — so it never cuts through a stroke.
 *
 * The path is data: a list of points, each on a letter in that letter's own
 * type coordinates, with the side the rope is on from there to the next point
 * and, optionally, how low it sags on the way, measured from the letters'
 * own outlines in `layoutFromLetters`.
 *
 * Both are hidden through the entrance and revealed at rest: the hat drops
 * onto the S, then the rope is paid out from its left end.
 */

/** The rope's radius, in the type's units (the cap height is 70). */
const R = 2.6;
/** Half the depth of a letter, bevels included, and how far off a letter's middle the rope passes. */
const LETTER_HALF_DEPTH = 2.95;
const Z = LETTER_HALF_DEPTH + R + .6;
/**
 * The rope keeps to the letters' feet so the word reads clearly: it crosses
 * each letter at this height (type units; the cap height is 70), and between
 * letters it hangs down to `SWAG` below the baseline.
 */
const CROSS = 7;
const SWAG = -6.5;


/**
 * Measured from rope.glb by casting rays at its body. The body's axis runs
 * along x at this height; the strands' crowns sit at `radius` and the grooves
 * between them go down to `groove[0]`. The window `seam` of the model matches
 * end to end when the next copy is turned by `seamTurn` about the axis; the
 * strands twist `twist` radians per unit of length.
 */
const MODEL = {
  axisY: .0471,
  radius: .034,
  groove: [.019, .031],
  seam: [-.38, .38],
  seamTurn: THREE.MathUtils.degToRad(255),
  twist: 23.2,
};

export const INK = '#1a1210';
export const ROPE_OUTLINE = .34;
const HAT_OUTLINE = .62;
/** The rope's colours, read off the reference drawing. */
export const ROPE = { high: '#f3d3a1', light: '#dcae74', mid: '#c28b53', dark: '#8a5a2f', groove: '#3a2414', hair: '#6f4424' };
/** The hat's colours, read off the reference drawing: lit and shaded, and its hatching ink. */
const HAT = { crown: '#d8c08e', crownShade: '#b3a17b', brim: '#c89e67', brimShade: '#ae8654', band: '#c91d45', bandShade: '#86122f', ink: '#231811' };

/** How far the rope is pressed down at arc length `uDipS`, falling off over `uDipW`. */
const DIP = /* glsl */ `
uniform float uDip, uDipS, uDipW, uImpact, uImpactTime;
float dip(float s) {
  float distance = abs(s - uDipS);
  float age = max(0.0, uImpactTime - distance / 95.0);
  float recoil = sin(age * 22.0) * exp(-age * 6.0) * smoothstep(0.0, .025, age)
    * smoothstep(4.0, 14.0, distance) * exp(-distance * .025);
  return uDip * exp(-pow(abs(s - uDipS) / uDipW, 2.0)) + uImpact * recoil;
}
`;

const ROPE_ENTRY = /* glsl */ `
uniform float uReveal, uFeed, uFeedTime;
attribute vec3 aCenter;
vec3 feedRope(vec3 p, float along) {
  float tip = smoothstep(uReveal - .035, uReveal, along) * uFeed;
  p = aCenter + (p - aCenter) * (1.0 - tip * .82);
  float wake = exp(-pow(abs(along - uReveal + .04) / .07, 2.0)) * uFeed;
  p.y += sin(along * 56.0 - uFeedTime * 10.0) * wake * 1.15;
  p.z += sin(along * 42.0 - uFeedTime * 8.0) * wake * .3;
  return p;
}
`;

const OUTLINE_VERTEX = /* glsl */ `
uniform float uWidth;
attribute float aAlong, aS;
varying float vAlong;
${DIP}
${ROPE_ENTRY}
void main() {
  vAlong = aAlong;
  vec3 p = feedRope(position + normal * uWidth, aAlong);
  p.y -= dip(aS);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

const OUTLINE_FRAGMENT = /* glsl */ `
uniform vec3 uInk;
uniform float uReveal;
varying float vAlong;
void main() {
  if (vAlong > uReveal) discard;
  gl_FragColor = vec4(uInk, 1.0);
  #include <colorspace_fragment>
}
`;

const ROPE_VERTEX = /* glsl */ `
${DIP}
${ROPE_ENTRY}
attribute float aAlong, aS, aHair;
attribute vec2 aRoll;
varying float vAlong, vS, vHair;
varying vec2 vRoll;
varying vec3 vNormal;
void main() {
  vAlong = aAlong; vS = aS; vHair = aHair; vRoll = aRoll;
  vNormal = normalize(normalMatrix * normal);
  vec3 p = feedRope(position, aAlong);
  p.y -= dip(aS);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

export const ROPE_FRAGMENT = /* glsl */ `
uniform vec3 uHigh, uLight, uMid, uDark, uGroove, uHair;
uniform float uReveal, uTwist, uR, uGroove0, uGroove1;
varying float vAlong, vS, vHair;
varying vec2 vRoll;
varying vec3 vNormal;

float hash(float n) { return fract(sin(n) * 43758.5453123); }
float noise(float x) { float i = floor(x), f = fract(x); return mix(hash(i), hash(i + 1.0), f * f * (3.0 - 2.0 * f)); }
/** A hairline down the middle of each lane. */
float hairline(float lane, float width) {
  float d = abs(fract(lane) - 0.5);
  return 1.0 - smoothstep(width * 0.5, width * 0.5 + 0.09, d);
}

void main() {
  if (vAlong > uReveal) discard;
  vec3 n = normalize(vNormal);
  if (!gl_FrontFacing) n = -n;
  float lambert = dot(n, normalize(vec3(-0.35, 0.85, 0.55)));

  // Cel tones: shade, lit, and a narrow band of highlight.
  vec3 color = mix(uDark, uMid, smoothstep(-0.45, -0.1, lambert));
  color = mix(color, uLight, smoothstep(0.2, 0.42, lambert));
  color = mix(color, uHigh, smoothstep(0.8, 0.92, lambert) * 0.55);

  float r = length(vRoll);
  if (vHair > 0.5) {
    // Stray hairs and the brushed ends: darker fibre, darkest at the tips.
    float tip = smoothstep(uR * 0.95, uR * 1.9, r);
    color = mix(color * 0.85, uHair, 0.55);
    color = mix(color, uGroove, tip * 0.6);
  } else {
    // How high on its strand a point sits: the crown is lit, the groove falls into ink.
    float crown = smoothstep(uGroove0, uGroove1, r);
    color *= mix(0.62, 1.0, crown);

    // Fibres laid down each strand, broken into strokes, and a few catching the light.
    float phi = atan(vRoll.y, vRoll.x);
    float q = (phi - uTwist * vS) * 3.0 / 6.28318;
    float along = vS / uR;
    float lane = q * 9.0;
    float stroke = step(0.42, noise(along * 1.4 + floor(lane) * 7.31));
    color = mix(color, color * 0.55, hairline(lane, 0.22) * stroke * 0.9);
    float lane2 = q * 7.0 + 0.37;
    float glint = step(0.6, noise(along * 0.9 + floor(lane2) * 3.17));
    color = mix(color, uHigh, hairline(lane2, 0.14) * glint * 0.45 * smoothstep(0.0, 0.5, lambert));

    color = mix(color, uGroove, (1.0 - smoothstep(0.0, 0.25, crown)) * 0.85);
  }

  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}
`;

const HAT_VERTEX = /* glsl */ `
uniform float uWind, uWindTime, uOutline, uStorm;
uniform vec3 uHatAnchor, uWindDirection;
varying vec2 vUv;
varying vec3 vNormal, vPos;
vec3 bendBrim(vec3 p) {
  float rim = smoothstep(.31, .49, length(p.xz));
  float low = 1.0 - smoothstep(.28, .34, p.y);
  float pinned = smoothstep(.10, .22, distance(p, uHatAnchor));
  float weight = rim * low * pinned * uWind;
  vec2 direction = uWindDirection.xz;
  float horizontal = length(direction);
  direction /= max(horizontal, .001);
  float across = dot(p.xz, direction);
  float wave = sin(across * 16.0 - uWindTime * (4.2 + uStorm * 3.5))
    + .3 * sin(p.z * 23.0 + p.x * 13.0 - uWindTime * 6.3);
  // A coherent cup/fold through the whole outside brim, followed by flutter.
  // Vertical gusts lift/press it; lateral gusts bend the windward edge.
  float cup = uWindDirection.y * (.038 + uStorm * .024)
    + across * horizontal * (.075 + uStorm * .055);
  p.y += (cup + wave * (.004 + uStorm * .009)) * weight;
  p.xz += direction * (.002 + uStorm * .004) * weight;
  return p;
}
void main() {
  vUv = uv;
  vPos = position;
  vec3 p = bendBrim(position);
  vec3 n = normal;
  if (uWind > .001) {
    vec3 t = normalize(cross(n, abs(n.y) > .9 ? vec3(1,0,0) : vec3(0,1,0)));
    vec3 b = cross(n, t);
    n = normalize(cross(bendBrim(position + t * .001) - p, bendBrim(position + b * .001) - p));
  }
  vNormal = normalize(normalMatrix * n);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p + n * uOutline, 1.0);
}
`;

const HAT_OUTLINE_FRAGMENT = /* glsl */ `
uniform vec3 uInk;
void main() {
  gl_FragColor = vec4(uInk, 1.0);
  #include <colorspace_fragment>
}
`;

/**
 * The hat, as the drawing has it: flat colour, a lit and a shaded tone with a
 * hard edge between, and short ink strokes — down the crown along its
 * meridians, and round the brim. The strokes are laid out on the model
 * itself, so they stay put as it turns. The painted texture only says where
 * the band is.
 */
const HAT_FRAGMENT = /* glsl */ `
uniform sampler2D uMap;
uniform float uTexel;
uniform vec3 uCrown, uCrownShade, uBrim, uBrimShade, uBand, uBandShade, uInk;
varying vec2 vUv;
varying vec3 vNormal, vPos;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

/** At most one short, tapered stroke per cell, laid along the first axis of p. */
float strokes(vec2 p, vec2 cell, float keep, float seed) {
  vec2 g = p / cell;
  vec2 id = floor(g) + seed;
  if (hash(id) > keep) return 0.0;
  vec2 f = fract(g);
  float len = 0.45 + 0.4 * hash(id + 1.7);
  vec2 c = vec2(0.5 + (hash(id + 3.1) - 0.5) * (1.0 - len), 0.25 + 0.5 * hash(id + 5.3));
  vec2 d = f - c;
  float tilt = (hash(id + 9.7) - 0.5) * 0.6;
  float along = abs(d.x) / (len * 0.5);
  float across = abs(d.y - d.x * tilt * cell.x / cell.y);
  float px = fwidth(g.y);
  float width = px * 0.42 * (1.0 - along * along * 0.8);
  return (1.0 - smoothstep(0.85, 1.0, along)) * (1.0 - smoothstep(width, width + px, across));
}

void main() {
  // Where the band is, from the painted texture, softened over a few texels.
  vec3 t = texture2D(uMap, vUv).rgb * 0.4;
  t += texture2D(uMap, vUv + vec2(uTexel, 0.0)).rgb * 0.15;
  t += texture2D(uMap, vUv - vec2(uTexel, 0.0)).rgb * 0.15;
  t += texture2D(uMap, vUv + vec2(0.0, uTexel)).rgb * 0.15;
  t += texture2D(uMap, vUv - vec2(0.0, uTexel)).rgb * 0.15;
  float band = smoothstep(0.55, 0.72, (t.r - t.g) / (t.r + 0.001));

  float radius = length(vPos.xz);
  float brim = smoothstep(0.3, 0.34, radius);
  vec3 n = normalize(vNormal);
  if (!gl_FrontFacing) n = -n;
  float lit = smoothstep(-0.05, 0.05, dot(n, normalize(vec3(-0.8, 0.45, 0.4))));

  vec3 color = mix(mix(uCrownShade, uCrown, lit), mix(uBrimShade, uBrim, lit), brim);
  color = mix(color, mix(uBandShade, uBand, lit), band);

  // Ink hatching: denser on the shaded side of the crown, none on the band.
  float theta = atan(vPos.z, vPos.x);
  // Clear toward the top of the crown, as in the drawing.
  float lower = 1.0 - smoothstep(0.3, 0.44, vPos.y);
  float crownInk = strokes(vec2(vPos.y, theta * 0.27), vec2(0.045, 0.02), mix(0.34, 0.14, lit) * (0.35 + 0.65 * lower), 0.0);
  crownInk = max(crownInk, strokes(vec2(vPos.y + 0.02, theta * 0.27 + 0.01), vec2(0.045, 0.02), mix(0.16, 0.03, lit) * lower, 11.0));
  float brimInk = strokes(vec2(theta * radius, radius), vec2(0.075, 0.022), 0.2, 23.0);
  float ink = mix(crownInk, brimInk, brim) * (1.0 - band);
  color = mix(color, uInk, ink * 0.85);

  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}
`;

const colour = hex => ({ value: new THREE.Color(hex) });

/** Even-odd: is (x, y) inside these closed outlines? */
function inside(contours, x, y) {
  let odd = false;
  for (const c of contours) {
    for (let i = 0, j = c.length - 1; i < c.length; j = i++) {
      const a = c[i], b = c[j];
      if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) odd = !odd;
    }
  }
  return odd;
}

/** Keep the part of a polygon on one side of the plane x = `at`; each vertex is [x, y, z, nx, ny, nz]. */
function clipX(polygon, at, keepAbove) {
  const out = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    const inA = keepAbove ? a[0] >= at : a[0] <= at;
    const inB = keepAbove ? b[0] >= at : b[0] <= at;
    if (inA) out.push(a);
    if (inA !== inB) {
      const t = (at - a[0]) / (b[0] - a[0]);
      out.push(a.map((v, k) => v + (b[k] - v) * t));
    }
  }
  return out;
}

export default class Props {
  constructor(owner) {
    this.owner = owner;
    this.group = new THREE.Group();
    this.group.name = 'props';
    this.owner.word.add(this.group);
    this.tweens = [];
    this.ropeReveal = { value: 0 };
    this.feed = { uFeed: { value: 0 }, uFeedTime: { value: 0 } };
    this.noDip = { uDip: { value: 0 }, uDipS: { value: 0 }, uDipW: { value: 1 }, uImpact: { value: 0 }, uImpactTime: { value: 0 } };
    this.dip = { uDip: { value: 0 }, uDipS: { value: 0 }, uDipW: { value: 11 }, uImpact: { value: 0 }, uImpactTime: { value: 0 } };
    this.shapes = new Map();
    this.wordShapes = new Map();
    const loader = new GLTFLoader();
    loader.load(hatUrl, gltf => {
      if (this.disposed) return;
      this.buildHat(gltf);
      if (this.owner.atRest) this.reveal({ instant: reducedMotion, hatInstant: this.owner.instant });
    }, undefined, () => {});
    loader.load(ropeUrl, gltf => {
      if (this.disposed) return;
      this.ropeSource = gltf.scene.getObjectByProperty('isMesh', true)?.geometry ?? null;
      if (this.owner.atRest) this.reveal({ instant: reducedMotion, hatInstant: this.owner.instant });
    }, undefined, () => {});
  }

  /* ----- the hat ----------------------------------------------------- */

  buildHat(gltf) {
    const mesh = gltf.scene.getObjectByProperty('isMesh', true);
    if (!mesh) return;
    const map = mesh.material.map;
    mesh.material.dispose();
    mesh.material = new THREE.ShaderMaterial({
      vertexShader: HAT_VERTEX,
      fragmentShader: HAT_FRAGMENT,
      side: THREE.DoubleSide,
      uniforms: {
        uWind: { value: 0 }, uWindTime: { value: 0 }, uHatAnchor: { value: new THREE.Vector3() },
        uWindDirection: { value: new THREE.Vector3(1, 0, 0) }, uStorm: { value: 0 },
        uOutline: { value: 0 },
        uMap: { value: map },
        uCrown: colour(HAT.crown), uCrownShade: colour(HAT.crownShade),
        uBrim: colour(HAT.brim), uBrimShade: colour(HAT.brimShade),
        uBand: colour(HAT.band), uBandShade: colour(HAT.bandShade),
        uInk: colour(HAT.ink), uTexel: { value: 1 / (map?.image?.width || 512) },
      },
    });
    this.hatMap = map;

    // The S wears the open crown: seat the real underside on its curved top.
    const glyph = this.owner.letters[0];
    const body = glyph.children.find(child => child.isMesh);
    body.geometry.computeBoundingBox();
    const box = body.geometry.boundingBox;
    const width = box.max.x - box.min.x;
    const scale = width * 1.12;
    const hat = new THREE.Group();
    hat.add(mesh);
    mesh.add(new THREE.Mesh(mesh.geometry, new THREE.ShaderMaterial({
      vertexShader: HAT_VERTEX, fragmentShader: HAT_OUTLINE_FRAGMENT, side: THREE.BackSide,
      uniforms: { ...mesh.material.uniforms, uOutline: { value: HAT_OUTLINE / scale } },
    })));
    this.hatMesh = mesh;
    hat.scale.setScalar(scale);
    hat.rotation.set(.18, .12, -.10);
    const contact = fitHatToLetter(hat, mesh, body);
    hat.updateMatrix();
    mesh.material.uniforms.uHatAnchor.value.copy(contact.point).applyMatrix4(hat.matrix.clone().invert());
    hat.visible = false;
    glyph.add(hat);
    this.hat = hat;
    this.hatRest = hat.position.y;
    this.hatRestTurn = hat.rotation.z;
    this.hatContact = contact;
    this.hatFlight = new HatFlight(this);
    this.addHatContactShade(body, contact);
    this.hatWind = new HatWind(this.owner, hat, mesh.material.uniforms);
  }

  /** A soft contact shade on the S; palette uniforms stay shared with the word. */
  addHatContactShade(body, contact, index = 0) {
    if (!body.material.isShaderMaterial) return;
    const source = body.material;
    const material = source.clone();
    material.uniforms = {
      ...source.uniforms,
      uHatContact: { value: contact.point.clone() },
      uHatWidth: { value: contact.width * .25 },
      uHatShade: { value: 0 },
    };
    material.vertexShader = `varying vec3 vHatLocal;\n${source.vertexShader}`
      .replace('void main() {', 'void main() {\n vHatLocal = position;');
    material.fragmentShader = `varying vec3 vHatLocal;\nuniform vec3 uHatContact;\nuniform float uHatWidth, uHatShade;\n${source.fragmentShader}`
      .replace('#include <tonemapping_fragment>', `
        vec2 underBrim = (vHatLocal.xy - uHatContact.xy) / vec2(uHatWidth, 4.0);
        gl_FragColor.rgb *= 1.0 - uHatShade * exp(-dot(underBrim, underBrim) * 1.6);
        #include <tonemapping_fragment>`);
    body.material = material;
    this.hatShades ??= [];
    this.hatShades.push({ material, index });
    if (index === 0) this.hatShade = material;
  }

  updateHatShade() {
    for (const { material, index } of this.hatShades ?? []) {
      const seat = this.hatFlight?.spots[index]?.position;
      material.uniforms.uHatShade.value = this.hat?.visible && seat
        ? .2 * Math.exp(-this.hat.position.distanceTo(seat) * .4) : 0;
    }
  }

  outlineMaterial(width, reveal, dip = this.noDip) {
    return new THREE.ShaderMaterial({
      vertexShader: OUTLINE_VERTEX,
      fragmentShader: OUTLINE_FRAGMENT,
      side: THREE.BackSide,
      uniforms: { uWidth: { value: width }, uInk: colour(INK), uReveal: reveal, ...dip, ...this.feed },
    });
  }

  /* ----- measuring the letters ---------------------------------------- */

  /** A letter's outline, as closed polygons in the type's own coordinates. */
  contours(index) {
    if (!this.shapes.has(index)) {
      const shapes = this.owner.font.generateShapes(WORDMARK.letters[index].fontChar, WORDMARK.fontSize);
      this.shapes.set(index, shapes.flatMap(shape => {
        const { shape: outer, holes } = shape.extractPoints(12);
        return [outer, ...holes];
      }));
    }
    return this.shapes.get(index);
  }

  /** The same outline where the letter rests in the word, with its bounds. */
  wordContours(index) {
    if (!this.wordShapes.has(index)) {
      const contours = this.contours(index).map(c => c.map(p => {
        const v = this.at(index, p.x, p.y, 0);
        return { x: v.x, y: v.y };
      }));
      const all = contours.flat();
      const bounds = {
        minX: Math.min(...all.map(p => p.x)), maxX: Math.max(...all.map(p => p.x)),
        minY: Math.min(...all.map(p => p.y)), maxY: Math.max(...all.map(p => p.y)),
      };
      this.wordShapes.set(index, { contours, bounds });
    }
    return this.wordShapes.get(index);
  }

  /** Does a disc of radius `r` at (x, y), in the word's space, touch any letter? */
  touches(x, y, r) {
    const probes = [[0, 0]];
    for (let k = 0; k < 12; k++) probes.push([Math.cos(k * Math.PI / 6) * r, Math.sin(k * Math.PI / 6) * r]);
    for (let k = 0; k < 6; k++) probes.push([Math.cos(k * Math.PI / 3 + .5) * r * .55, Math.sin(k * Math.PI / 3 + .5) * r * .55]);
    for (let i = 0; i < this.owner.letters.length; i++) {
      const { contours, bounds } = this.wordContours(i);
      if (x + r < bounds.minX || x - r > bounds.maxX || y + r < bounds.minY || y - r > bounds.maxY) continue;
      if (probes.some(([dx, dy]) => inside(contours, x + dx, y + dy))) return true;
    }
    return false;
  }

  /** Where a letter is filled along the line at height `y`: sorted [from, to] spans. */
  spans(index, y) {
    const xs = [];
    for (const contour of this.contours(index)) {
      for (let i = 0; i < contour.length; i++) {
        const a = contour[i], b = contour[(i + 1) % contour.length];
        if ((a.y > y) !== (b.y > y)) xs.push(a.x + (y - a.y) / (b.y - a.y) * (b.x - a.x));
      }
    }
    xs.sort((p, q) => p - q);
    const spans = [];
    for (let i = 0; i + 1 < xs.length; i += 2) spans.push([xs[i], xs[i + 1]]);
    return spans;
  }

  /** The middle of the open space at height `y` that contains `near` (or the widest one). */
  gapMiddle(index, y, near) {
    const spans = this.spans(index, y);
    let best = null;
    for (let i = 0; i + 1 < spans.length; i++) {
      const gap = [spans[i][1], spans[i + 1][0]];
      if (near !== undefined && gap[0] <= near && near <= gap[1]) return (gap[0] + gap[1]) / 2;
      if (!best || gap[1] - gap[0] > best[1] - best[0]) best = gap;
    }
    return (best[0] + best[1]) / 2;
  }

  /** The height a rope comes to rest at when lowered into a letter's open space at x. */
  restOn(index, x, from) {
    let floor = -Infinity;
    for (let dx = -R * .7; dx <= R * .71; dx += R * .35) {
      let y = from;
      while (y > -10 && !inside(this.contours(index), x + dx, y)) y -= .1;
      floor = Math.max(floor, y);
    }
    return floor + R + .1;
  }

  /** A point given in a letter's type coordinates (z from its middle), in the word's space as it rests. */
  at(index, x, y, z) {
    const glyph = this.owner.letters[index];
    const centre = glyph.userData.centre;
    glyph.updateMatrix();
    return new THREE.Vector3(x - centre.x, y - centre.y, z - centre.z).applyMatrix4(glyph.matrix);
  }

  /* ----- the rope's path ---------------------------------------------- */

  /** The first and last filled x across a letter at height `y`, in its type coordinates. */
  edges(index, y) {
    const spans = this.spans(index, y);
    return spans.length ? [spans[0][0], spans.at(-1)[1]] : null;
  }

  /**
   * The rope's path, measured from the letters: points on the letters, in
   * each letter's type coordinates, with the side the rope is on from each to
   * the next (1 in front, -1 behind, 0 in the letters' own plane) and, where
   * it hangs, the height it sags down to.
   *
   * The rope is there to dress the word, not to cover it, so it only ever
   * crosses the letters low, at their feet, and the letters read clearly
   * above it. The free end hangs down on the left and rises in front of the
   * S's foot. Under the S it swings down, and weaves through each letter after
   * it: behind the first foot (or the D's stem), forward through the open
   * space between, in front of the last foot, and down in a swag under the
   * gap to the next letter. After the D it runs under the i, which sits on it,
   * and the other end hangs away.
   */
  layoutFromLetters() {
    const point = (letter, x, y, side, extra = {}) => ({ letter, x, y, side, ...extra });
    const low = -R - 1.2;
    const path = [];

    // S: the free end hangs under the S and rises behind its bottom stroke into
    // the space inside its lower bowl, comes forward there, and crosses the
    // front of the bowl's right side on its way out.
    const s = this.spans(0, CROSS);
    const sRight = s.at(-1)[1];
    const bowlX = this.gapMiddle(0, CROSS + 2);
    const bowlY = Math.max(this.restOn(0, bowlX, CROSS + 6), CROSS + 2);
    const outer = s.at(-1);
    // It rises behind the thickest part of the stroke, low on the left, so the
    // letter visibly hides it before it comes out inside the bowl.
    const thick = this.spans(0, 5)[0];
    const riseX = (thick[0] + thick[1]) / 2 + 1;
    path.push(
      point(0, riseX - 1, -26, 0),
      point(0, riseX - 1.5, -13, 0),
      point(0, riseX, -1.5, -1),
      point(0, riseX + 1.5, 5, -1),
      point(0, bowlX, bowlY, 1),
      point(0, (outer[0] + outer[1]) / 2, CROSS + .5, 1),
      point(0, sRight + 1.2, low - .6, -1, { sag: SWAG }),
    );

    // A, A, D: behind the first stroke, forward in the space, in front of the last.
    for (const k of [1, 2, 3]) {
      const spans = this.spans(k, CROSS);
      const first = spans[0], last = spans.at(-1);
      path.push(
        point(k, (first[0] + first[1]) / 2, CROSS, -1),
        point(k, (first[1] + last[0]) / 2, CROSS + .5, 1),
        point(k, (last[0] + last[1]) / 2, CROSS, 1),
        k < 3 ? point(k, last[1] + 1.2, low - .6, -1, { sag: SWAG }) : point(k, last[1] + .5, low, 0),
      );
    }

    // i: level under the foot, so the letter sits on the rope; the end hangs away.
    const stem = this.contours(4).filter(c => Math.max(...c.map(q => q.y)) < 56).flat();
    const foot = Math.min(...stem.map(q => q.y));
    const [f0, f1] = this.edges(4, foot + .6);
    const under = foot - R - .12;
    // The rope arrives from the D; the flat stretch under the i reaches as far
    // to the right of the foot's centre as it does to the left, so the i sits
    // in the middle of it, and only then does the end turn down.
    const centre = (f0 + f1) / 2;
    const arrive = path.at(-1);
    const reach = Math.max(centre - (this.at(3, arrive.x, 0, 0).x - this.at(4, 0, 0, 0).x), (f1 - f0) / 2 + R * 2);
    // The rope rising from the D eases into the level stretch, which takes about
    // this much off its left end; the right end gives up the same, so the
    // stretch that is actually level is centred on the foot.
    const right = reach - 10;
    path.pop();
    path.push(
      point(4, centre - reach, under, 0),
      point(4, centre - (f1 - f0) / 2, under, 0),
      point(4, centre, under, 0, { seat: true }),
      point(4, centre + (f1 - f0) / 2, under, 0),
      point(4, centre + right, under, 0),
      point(4, centre + right + 4.5, under - 3, 0),
      point(4, centre + right + 6, under - 11, 0),
      point(4, centre + right + 6, under - 19, 0),
    );
    return path;
  }

  /** The layout in use, measured once. */
  get layout() {
    if (!this.layoutData) this.layoutData = this.layoutFromLetters();
    return this.layoutData;
  }

  /** The layout's points, placed in the word as it rests. Sags are type heights, so they move with the word too. */
  anchors() {
    return this.layout.map(p => ({ p: this.at(p.letter, p.x, p.y, 0), side: p.side, sag: p.sag === undefined ? undefined : this.typeToWordY(p.sag), seat: p.seat }));
  }

  /** A height in the type (0 is the baseline) in the word's space. */
  typeToWordY(y) {
    return this.at(0, 0, y, 0).y;
  }

  /** The rope's centreline: sagging between supports, smoothed, and set in front of or behind the letters. */
  ropeCurve() {
    const anchors = this.anchors();
    const samples = [];
    const STEP = .35;
    anchors.forEach((a, i) => {
      const b = anchors[i + 1];
      if (!b) { samples.push({ x: a.p.x, y: a.p.y, side: a.side, pin: true }); return; }
      const length = Math.hypot(b.p.x - a.p.x, b.p.y - a.p.y);
      const count = Math.max(2, Math.ceil(length / STEP));
      // A sag: the parabola through both supports whose lowest point is `sag`.
      let sag = null;
      if (a.sag !== undefined && a.sag < Math.min(a.p.y, b.p.y) - .05) {
        const s0 = Math.sqrt(a.p.y - a.sag), s1 = Math.sqrt(b.p.y - a.sag);
        const xm = (a.p.x * s1 + b.p.x * s0) / (s0 + s1);
        const k = Math.abs(a.p.x - xm) > 1e-6 ? (a.p.y - a.sag) / (a.p.x - xm) ** 2 : (b.p.y - a.sag) / (b.p.x - xm) ** 2;
        sag = { xm, k, bottom: a.sag };
      }
      for (let j = 0; j < count; j++) {
        const t = j / count;
        const x = a.p.x + (b.p.x - a.p.x) * t;
        const y = sag ? sag.k * (x - sag.xm) ** 2 + sag.bottom : a.p.y + (b.p.y - a.p.y) * t;
        samples.push({ x, y, side: a.side, pin: j === 0 && (a.pin || i === 0) });
      }
    });
    const last = samples.length - 1;
    samples[0].pin = samples[last].pin = true;

    // Smooth the corners away, then pull the supports back to where they are,
    // spreading the correction along the rope so it stays smooth.
    const at = samples.map(s => ({ x: s.x, y: s.y }));
    // Enough passes that no bend is tighter than the rope is thick.
    for (let pass = 0; pass < 140; pass++) {
      for (let i = 1; i < last; i++) {
        samples[i].x = (at[i - 1].x + 2 * at[i].x + at[i + 1].x) / 4;
        samples[i].y = (at[i - 1].y + 2 * at[i].y + at[i + 1].y) / 4;
      }
      for (let i = 1; i < last; i++) { at[i].x = samples[i].x; at[i].y = samples[i].y; }
    }
    const arc = [0];
    for (let i = 1; i <= last; i++) arc.push(arc[i - 1] + Math.hypot(at[i].x - at[i - 1].x, at[i].y - at[i - 1].y));
    const pins = anchors.map(a => a.p);
    const sigma = R * 2.2;
    for (let round = 0; round < 6; round++) {
      pins.forEach(pin => {
        let nearest = 0, best = Infinity;
        at.forEach((p, i) => { const d = Math.hypot(p.x - pin.x, p.y - pin.y); if (d < best) { best = d; nearest = i; } });
        const dx = pin.x - at[nearest].x, dy = pin.y - at[nearest].y;
        at.forEach((p, i) => {
          const w = Math.exp(-((arc[i] - arc[nearest]) ** 2) / (2 * sigma * sigma));
          p.x += dx * w; p.y += dy * w;
        });
      });
    }

    // In front of or behind: fixed wherever the rope overlaps a letter, free
    // (and eased between) wherever it doesn't.
    const z = new Array(at.length).fill(null);
    at.forEach((p, i) => {
      const side = samples[i].side;
      if (this.touches(p.x, p.y, side === 0 ? R * 1.25 : R * .98)) z[i] = side * Z;
    });
    const fixed = z.map((v, i) => (v === null ? -1 : i)).filter(i => i >= 0);
    if (!fixed.length) z.fill(0);
    else {
      for (let i = 0; i < z.length; i++) {
        if (z[i] !== null) continue;
        const before = fixed.filter(f => f < i).at(-1), after = fixed.find(f => f > i);
        if (before === undefined) z[i] = z[after];
        else if (after === undefined) z[i] = z[before];
        else {
          const t = (arc[i] - arc[before]) / (arc[after] - arc[before]);
          z[i] = z[before] + (z[after] - z[before]) * (t * t * (3 - 2 * t));
        }
      }
    }

    const points = at.filter((p, i) => i % 3 === 0 || i === last).map((p, j, list) => {
      const i = j === list.length - 1 ? last : j * 3;
      return new THREE.Vector3(p.x, p.y, z[i]);
    });
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', .5);
    curve.arcLengthDivisions = 4000;
    const seat = anchors.find(a => a.seat)?.p;
    if (seat) {
      let best = Infinity;
      for (let k = 0; k <= 2000; k++) {
        const q = curve.getPointAt(k / 2000);
        const d = Math.hypot(q.x - seat.x, q.y - seat.y);
        if (d < best) { best = d; curve.userData = { seat: k / 2000 }; }
      }
    }
    return curve;
  }

  /* ----- the rope ---------------------------------------------------- */

  buildRope() {
    const source = this.ropeSource;
    const curve = this.ropeCurve();
    const length = curve.getLength();

    // A table of points and frames along the path, for bending the model onto it.
    const divisions = Math.ceil(length / .25);
    const frames = curve.computeFrenetFrames(divisions, false);
    const points = Array.from({ length: divisions + 1 }, (unused, i) => curve.getPointAt(i / divisions));
    const frameAt = s => {
      const f = Math.min(Math.max(s / length, 0), 1) * divisions;
      const i = Math.min(Math.floor(f), divisions - 1), t = f - i;
      const p = points[i].clone().lerp(points[i + 1], t);
      const tangent = frames.tangents[i].clone().lerp(frames.tangents[i + 1], t).normalize();
      const normal = frames.normals[i].clone().lerp(frames.normals[i + 1], t);
      normal.addScaledVector(tangent, -normal.dot(tangent)).normalize();
      const binormal = new THREE.Vector3().crossVectors(tangent, normal);
      return { p, tangent, normal, binormal };
    };

    // The model's pieces: its body, and every hair and brush of fibres.
    const position = source.getAttribute('position'), normal = source.getAttribute('normal');
    const index = source.getIndex();
    const count = position.count;
    const parent = Int32Array.from({ length: count }, (unused, i) => i);
    const find = i => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
    const triangles = index ? index.count / 3 : count / 3;
    const corner = (t, k) => (index ? index.getX(t * 3 + k) : t * 3 + k);
    for (let t = 0; t < triangles; t++) {
      const a = find(corner(t, 0));
      parent[find(corner(t, 1))] = a;
      parent[find(corner(t, 2))] = find(a);
    }
    const welded = new Map();
    for (let i = 0; i < count; i++) {
      const key = `${position.getX(i).toFixed(5)},${position.getY(i).toFixed(5)},${position.getZ(i).toFixed(5)}`;
      if (welded.has(key)) parent[find(i)] = find(welded.get(key)); else welded.set(key, i);
    }
    const pieceOf = new Map(), pieceX = new Map();
    for (let i = 0; i < count; i++) {
      const root = find(i);
      if (!pieceOf.has(root)) { pieceOf.set(root, pieceOf.size); pieceX.set(root, [0, 0]); }
      const sum = pieceX.get(root); sum[0] += position.getX(i); sum[1]++;
    }
    const sizes = new Map();
    for (let i = 0; i < count; i++) sizes.set(find(i), (sizes.get(find(i)) || 0) + 1);
    const bodyRoot = [...sizes.entries()].sort((a, b) => b[1] - a[1])[0][0];

    // The copies: the first keeps the model's left end, the last its right end.
    const [XA, XB] = MODEL.seam;
    const scale = R / MODEL.radius;
    const middles = Math.max(0, Math.round((length / scale - (XB + .5) - (.5 - XA)) / (XB - XA)));
    const windows = [[-.5, XB], ...Array.from({ length: middles }, () => [XA, XB]), [XA, .5]];
    const modelLength = windows.reduce((total, [lo, hi]) => total + hi - lo, 0);
    const stretch = length / (modelLength * scale);
    const twist = MODEL.twist / (scale * stretch);

    const out = { center: [], nlocal: [], position: [], normal: [], along: [], s: [], roll: [], hair: [], strand: [], copy: [], piece: [], model: [] };
    const bodyIndex = [], allIndex = [];
    const v3 = new THREE.Vector3();
    let start = 0, turn = 0;

    windows.forEach(([lo, hi], copy) => {
      const cos = Math.cos(turn), sin = Math.sin(turn);
      const first = copy === 0, last = copy === windows.length - 1;
      const emit = (vx, vy, vz, nx, ny, nz, isHair, pieceId) => {
        const s = start + (vx - lo) * scale * stretch;
        const dy = vy - MODEL.axisY, dz = vz;
        const ry = (dy * cos - dz * sin) * scale, rz = (dy * sin + dz * cos) * scale;
        const f = frameAt(s);
        out.center.push(f.p.x, f.p.y, f.p.z);
        v3.copy(f.p).addScaledVector(f.normal, ry).addScaledVector(f.binormal, rz);
        out.position.push(v3.x, v3.y, v3.z);
        const ny2 = ny * cos - nz * sin, nz2 = ny * sin + nz * cos;
        v3.set(0, 0, 0).addScaledVector(f.tangent, nx).addScaledVector(f.normal, ny2).addScaledVector(f.binormal, nz2).normalize();
        out.normal.push(v3.x, v3.y, v3.z);
        // The same normal in the rope's own frame, so the rope can be bent onto another path (webgl/stage/RopeScrollbar).
        { const l = Math.hypot(nx, ny2, nz2) || 1; out.nlocal.push(nx / l, ny2 / l, nz2 / l); }
        out.along.push(s / length);
        out.s.push(s);
        out.roll.push(ry, rz);
        out.hair.push(isHair ? 1 : 0);
        const q = ((Math.atan2(rz, ry) - twist * s) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
        out.strand.push(Math.floor(q / (Math.PI * 2 / 3)));
        out.copy.push(copy);
        out.piece.push(pieceId);
        out.model.push(vx, vy, vz);
        return out.along.length - 1;
      };
      const mapped = new Map();
      const vertex = i => {
        if (!mapped.has(i)) {
          const root = find(i);
          mapped.set(i, emit(position.getX(i), position.getY(i), position.getZ(i), normal.getX(i), normal.getY(i), normal.getZ(i), root !== bodyRoot, pieceOf.get(root)));
        }
        return mapped.get(i);
      };
      for (let t = 0; t < triangles; t++) {
        const ids = [corner(t, 0), corner(t, 1), corner(t, 2)];
        const root = find(ids[0]);
        if (root !== bodyRoot) {
          // A hair goes with the copy its middle falls in.
          const [sum, n] = pieceX.get(root);
          const cx = sum / n;
          if ((first || cx >= lo) && (last || cx < hi)) ids.forEach(i => allIndex.push(vertex(i)));
          continue;
        }
        const xs = ids.map(i => position.getX(i));
        const below = !first && Math.max(...xs) < lo, above = !last && Math.min(...xs) > hi;
        if (below || above) continue;
        if ((first || Math.min(...xs) >= lo) && (last || Math.max(...xs) <= hi)) {
          const tri = ids.map(vertex);
          bodyIndex.push(...tri); allIndex.push(...tri);
          continue;
        }
        // Cut at the window's ends.
        let polygon = ids.map(i => [position.getX(i), position.getY(i), position.getZ(i), normal.getX(i), normal.getY(i), normal.getZ(i)]);
        if (!first) polygon = clipX(polygon, lo, true);
        if (!last) polygon = clipX(polygon, hi, false);
        if (polygon.length < 3) continue;
        const piece = pieceOf.get(bodyRoot);
        const fan = polygon.map(([x, y, z, nx, ny, nz]) => emit(x, y, z, nx, ny, nz, false, piece));
        for (let k = 1; k + 1 < fan.length; k++) {
          bodyIndex.push(fan[0], fan[k], fan[k + 1]);
          allIndex.push(fan[0], fan[k], fan[k + 1]);
        }
      }
      start += (hi - lo) * scale * stretch;
      turn += MODEL.seamTurn;
    });

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(out.position, 3));
    geometry.setAttribute('aCenter', new THREE.Float32BufferAttribute(out.center, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(out.normal, 3));
    geometry.setAttribute('aAlong', new THREE.Float32BufferAttribute(out.along, 1));
    geometry.setAttribute('aS', new THREE.Float32BufferAttribute(out.s, 1));
    geometry.setAttribute('aRoll', new THREE.Float32BufferAttribute(out.roll, 2));
    geometry.setAttribute('aNormalLocal', new THREE.Float32BufferAttribute(out.nlocal, 3));
    geometry.setAttribute('aHair', new THREE.Float32BufferAttribute(out.hair, 1));
    // For animating the rope later: the strand, the copy and the model piece each vertex belongs to, and where it sat in the model.
    geometry.setAttribute('aStrand', new THREE.Float32BufferAttribute(out.strand, 1));
    geometry.setAttribute('aCopy', new THREE.Float32BufferAttribute(out.copy, 1));
    geometry.setAttribute('aPiece', new THREE.Float32BufferAttribute(out.piece, 1));
    geometry.setAttribute('aModel', new THREE.Float32BufferAttribute(out.model, 3));
    geometry.setIndex(allIndex);

    const hull = new THREE.BufferGeometry();
    ['position', 'normal', 'aCenter', 'aAlong', 'aS', 'aRoll', 'aNormalLocal', 'aHair'].forEach(name => hull.setAttribute(name, geometry.getAttribute(name)));
    hull.setIndex(bodyIndex);

    const material = new THREE.ShaderMaterial({
      vertexShader: ROPE_VERTEX,
      fragmentShader: ROPE_FRAGMENT,
      side: THREE.DoubleSide,
      uniforms: {
        uHigh: colour(ROPE.high), uLight: colour(ROPE.light), uMid: colour(ROPE.mid),
        uDark: colour(ROPE.dark), uGroove: colour(ROPE.groove), uHair: colour(ROPE.hair),
        uReveal: this.ropeReveal, uTwist: { value: twist }, uR: { value: R }, ...this.dip, ...this.feed,
        uGroove0: { value: MODEL.groove[0] * scale }, uGroove1: { value: MODEL.groove[1] * scale },
      },
    });
    const rope = new THREE.Group();
    rope.name = 'rope';
    rope.add(new THREE.Mesh(geometry, material));
    rope.add(new THREE.Mesh(hull, this.outlineMaterial(ROPE_OUTLINE, this.ropeReveal, this.dip)));
    rope.traverse(object => { object.frustumCulled = false; });
    rope.userData = { length, copies: windows.length, strands: 3 };
    // Where the i sits: along the rope for the reveal, and in arc length for the rope's give.
    this.seatAlong = curve.userData?.seat ?? 1;
    this.dip.uDipS.value = this.seatAlong * length;
    rope.visible = false;
    this.group.add(rope);
    this.rope = rope;
    // The path's points and frames, for the rope as the scrollbar.
    this.frameAt = frameAt;
    this.ropeRadius = R;
  }

  /* ----- showing and hiding ------------------------------------------ */

  /** The word is at rest: the hat drops on, then the rope is paid out. */
  reveal({ instant = false, hatInstant = false } = {}) {
    if (this.disposed) return;
    const render = () => this.owner.render();
    if (!this.rope && this.ropeSource) this.buildRope();
    if (instant || this.introSkipped) { this.finish(); return; }
    if (this.hat && !this.hat.visible) {
      const hat = this.hat;
      hat.visible = true;
      if (reducedMotion || hatInstant) {
        hat.position.y = this.hatRest;
        hat.rotation.z = this.hatRestTurn;
      } else {
        hat.position.y = this.hatRest + this.owner.capHeight * .9;
        hat.rotation.z = -.55;
        this.tweens.push(
          gsap.to(hat.position, { y: this.hatRest, duration: 1.1, ease: 'bounce.out', onUpdate: render }),
          gsap.to(hat.rotation, { z: this.hatRestTurn, duration: 1.1, ease: 'power2.out', onUpdate: render }),
        );
      }
    }
    if (this.rope && !this.rope.visible && !this.revealStarted) {
      this.revealStarted = true;
      this.rope.visible = true;
      if (reducedMotion) {
        this.ropeReveal.value = 1;
      } else {
        this.playRopeEntrance();
      }
    }
    render();
  }

  /** One score for the feeding rope and the i: the rope passes underneath at the apex. */
  playRopeEntrance() {
    this.owner.liquidDot.reset();
    this.ropeReveal.value = 0;
    this.feed.uFeed.value = 1;
    this.feed.uFeedTime.value = 0;
    this.jumped = false;
    const approach = Math.max(0, this.seatAlong - .14);
    const pass = Math.min(1, this.seatAlong + .025);
    const lead = 1;
    const start = .12;
    const jumpAt = start + lead;
    const sequence = gsap.timeline({
      onUpdate: () => this.owner.render(),
      onComplete: () => {
        this.feed.uFeed.value = 0;
        this.dip.uImpact.value = 0;
        this.settleI();
        this.owner.render();
      },
    });
    sequence.to(this.ropeReveal, { value: approach, duration: lead, ease: 'power1.inOut' }, start);
    sequence.to(this.ropeReveal, { value: pass, duration: .4, ease: 'sine.inOut' }, jumpAt);
    sequence.to(this.ropeReveal, { value: 1, duration: .32, ease: 'power2.out' }, jumpAt + .4);
    sequence.to(this.feed.uFeedTime, { value: jumpAt + 1.42, duration: jumpAt + 1.42, ease: 'none' }, 0);
    sequence.to(this.feed.uFeed, { value: 0, duration: .35, ease: 'sine.out' }, jumpAt + .4);
    sequence.add(this.jump({ register: false }), jumpAt);
    // Invert the rope's sine.inOut ease: emergence begins at physical contact.
    const contact = (this.seatAlong - approach) / (pass - approach);
    const contactAt = jumpAt + Math.acos(1 - 2 * contact) / Math.PI * .4;
    sequence.add(this.owner.liquidDot.play(), contactAt);
    this.ropeIntro = sequence;
    this.tweens.push(sequence);
  }

  /** Anticipation, one clean jump, then a weighted landing with a fading rope wave. */
  jump({ register = true } = {}) {
    const glyph = this.owner.letters[4];
    const restY = this.owner.restY[4], restX = this.owner.restX[4];
    const foot = Math.min(...glyph.children.filter(c => c.isMesh).map(c => {
      c.geometry.computeBoundingBox(); return c.geometry.boundingBox.min.y;
    }));
    const cap = this.owner.capHeight;
    const state = { lift: 0, sx: 1, sy: 1, turn: 0, dip: 0 };
    const apply = () => {
      glyph.scale.set(state.sx, state.sy, 1);
      glyph.rotation.z = state.turn;
      // Rotate and squash around the foot, so the grounded letter never slides.
      glyph.position.x = restX + foot * state.sy * Math.sin(state.turn);
      glyph.position.y = restY + state.lift * cap - state.dip + foot * (1 - state.sy * Math.cos(state.turn));
      this.dip.uDip.value = state.dip;
      this.owner.render();
    };
    const timeline = gsap.timeline({ onStart: () => { this.jumped = true; }, onUpdate: apply });
    timeline.to(state, { sy: .86, sx: 1.08, turn: -.025, duration: .14, ease: 'power2.out' }, 0);
    timeline.to(state, { lift: .32, sy: 1.1, sx: .94, turn: .055, duration: .25, ease: 'power2.out' }, .14);
    timeline.to(state, { sy: 1, sx: 1, turn: -.045, duration: .13, ease: 'sine.inOut' }, .33);
    timeline.to(state, { lift: 0, sy: 1.06, sx: .97, turn: 0, duration: .25, ease: 'power2.in' }, .46);
    timeline.to(state, { dip: 2.0, sy: .82, sx: 1.12, duration: .09, ease: 'power2.out' }, .71);
    timeline.set(this.dip.uImpact, { value: 1.5 }, .71);
    timeline.fromTo(this.dip.uImpactTime, { value: 0 }, { value: .95, duration: .95, ease: 'none' }, .71);
    timeline.to(state, { dip: 0, sy: 1, sx: 1, duration: .62, ease: 'elastic.out(1, .48)' }, .8);
    timeline.set(this.dip.uImpact, { value: 0 }, 1.66);
    this.jumpTimeline = timeline;
    if (register) this.tweens.push(timeline);
    return timeline;
  }

  /** Everything at its end at once: the hat on the S, the rope in place, the i sat on it. */
  finish() {
    if (this.disposed || !this.owner.atRest) return;
    this.introSkipped = true;
    this.stop();
    this.feed.uFeed.value = 0;
    if (!this.rope && this.ropeSource) this.buildRope();
    if (this.hat) {
      this.hat.visible = true;
      // Scrolling skips the entrance, but must not teleport an already
      // travelling hat back to S before the hero recedes.
      if (!this.hatFlight?.current && !this.hatFlight?.flight) {
        this.hat.position.y = this.hatRest;
        this.hat.rotation.z = this.hatRestTurn;
      }
    }
    if (this.rope) {
      this.revealStarted = true;
      this.rope.visible = true;
      this.ropeReveal.value = 1;
      this.jumped = true;
    }
    this.settleI();
    this.owner.liquidDot.finish();
    this.owner.render();
  }

  /** Put the i back exactly as it rests, and the rope with it. */
  settleI() {
    const glyph = this.owner.letters[4];
    if (!glyph) return;
    glyph.scale.set(1, 1, 1);
    glyph.position.y = this.owner.restY[4];
    glyph.position.x = this.owner.restX[4];
    glyph.rotation.z = 0;
    this.owner.dot.position.y = 0;
    this.dip.uImpact.value = 0;
    this.dip.uImpactTime.value = 0;
    this.dip.uDip.value = 0;
  }

  /** The entrance is playing again (or the word is hidden): nothing shows. */
  hide() {
    this.hatWind?.reset();
    this.hatFlight?.reset();
    this.owner.liquidDot.reset();
    this.introSkipped = false;
    this.feed.uFeed.value = 0;
    this.stop();
    this.settleI();
    if (this.hat) this.hat.visible = false;
    if (this.rope) this.rope.visible = false;
    this.revealStarted = false;
    this.ropeReveal.value = 0;
  }

  stop() {
    this.tweens.forEach(tween => tween.kill());
    this.tweens = [];
  }

  dispose() {
    this.disposed = true;
    this.stop();
    this.hatWind?.dispose();
    this.hatShades?.forEach(({ material }) => material.dispose());
    this.hatMap?.dispose();
    this.ropeSource?.dispose();
    for (const root of [this.hat, this.rope]) {
      root?.traverse(object => { object.geometry?.dispose(); object.material?.dispose(); });
    }
  }
}
