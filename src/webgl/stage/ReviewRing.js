import * as THREE from 'three';

/**
 * The ring of glass round the coin on the about's card: what clients said of
 * him (the page's only reviews), each on a pane of glass curved round the coin
 * as a band round a head is, the ring seen from a little above
 * and leaning, turning slowly (with the page's scroll too, and faster while
 * the coin is spun; a pane under the pointer stops it, to be read).
 *
 * Drawn with the coin (DotStage's coinScene), so the panes at the back pass
 * behind it. The ring sits low on it, as on a neck, so those at the front pass
 * under it; and a front pane that would still cross it fades out over it, so
 * the coin is never covered.
 *
 * In the stage's world: x across, y up, a pixel a unit, z toward the eye.
 */
export const RING = {
  /** The ring's radius (of the coin's), how far it is seen from above (rad), its lean (rad: its right side up). */
  radius: 2.5, tilt: .2, lean: -.09,
  /** How far clear of the coin a pane in front keeps (px). */
  gap: 16,
  /** Its turn: by itself (rad/s), with the scroll (rad/px), with the coin's spin (of its rad/s); the ease to a stop on hover (/s). */
  speed: .1, scroll: .0011, spin: .045, settle: 4,
  /** A pane: its width (px), its corners; how far apart round the ring (of their widths). */
  pane: 222, corner: 16, apart: 1.06,
  /**
   * Opening and closing (`open` 0 ? 1, from DotStage: once the coin has landed on the card, and as it leaves):
   * the panes come out from behind the coin one after another round the ring (each starting `stagger` of the way
   * after the one before, in all), overshooting a little (`overshoot`), the ring spinning (`whirl` rad/s) and
   * standing up from flat (`unfurl` rad more tilt) as it opens, settling as it comes; closing, the same backwards.
   */
  stagger: .45, overshoot: 1.6, whirl: 4, unfurl: .95,
  /** The coin's radius (px) the panes are drawn at full size for, and the least they shrink to round a smaller one. */
  fullAt: 140, least: .62,
  /** The texture's pixels to a pane's. */
  sharp: 3,
};

const VERTEX = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorld;
varying vec3 vNormal;
void main() {
  vUv = uv;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const FRAGMENT = /* glsl */ `
uniform sampler2D uMap;
uniform float uHasMap, uCorner, uOpacity, uFace, uDpr;
uniform vec2 uSize;
uniform vec3 uTop, uFoot, uEdge, uShade, uCoin;
uniform float uGlass, uGap;
varying vec2 vUv;
varying vec3 vWorld;
varying vec3 vNormal;

float box(vec2 p, vec2 extent, float r) {
  vec2 q = abs(p) - (extent - r);
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void main() {
  vec2 p = (vUv - .5) * uSize;
  float d = box(p, uSize * .5, uCorner);
  float aa = max(fwidth(d), .5);
  float inside = 1.0 - smoothstep(-aa, aa, d);
  if (inside <= .001) discard;
  vec3 toEye = normalize(cameraPosition - vWorld);
  float facing = abs(dot(normalize(vNormal), toEye));
  // Glass: lighter at its top, a bright edge, brighter where it turns away (its curve), and a soft sheen down it.
  vec3 colour = mix(uFoot, uTop, vUv.y);
  float rim = 1.0 - smoothstep(0.0, 2.2, -d);
  float turn = pow(1.0 - facing, 2.0);
  float sheen = smoothstep(.15, .5, vUv.x) * (1.0 - smoothstep(.5, .85, vUv.x)) * .18 * vUv.y;
  float alpha = uGlass * (.7 + .3 * vUv.y) + turn * .25 + sheen;
  colour = mix(colour, uEdge, clamp(rim * .8 + turn * .4 + sheen, 0.0, 1.0));
  alpha = max(alpha, rim * .85);
  // A hairline of shade round its very edge, so it reads against a light ground.
  float line = 1.0 - smoothstep(0.0, 1.1, -d);
  colour = mix(colour, uShade, line * .5);
  alpha = max(alpha, line * .55);
  if (gl_FrontFacing && uHasMap > .5) {
    // The review written on it.
    vec4 ink = texture2D(uMap, vUv);
    colour = mix(colour, ink.rgb / max(ink.a, 1e-3), ink.a * uFace);
    alpha = max(alpha, ink.a * uFace);
  } else if (!gl_FrontFacing) {
    alpha *= .7;
  }
  // In front of the coin and over it: gone, so the coin is never covered.
  vec2 here = gl_FragCoord.xy / uDpr;
  float over = 1.0 - smoothstep(uCoin.z, uCoin.z + uGap, distance(here, uCoin.xy));
  alpha *= 1.0 - over * smoothstep(0.0, 24.0, vWorld.z);
  gl_FragColor = vec4(colour, alpha * inside * uOpacity);
  #include <colorspace_fragment>
}
`;

/** The hand-drawn ring round the name (as in components/about), in a 100 × 40 box: its cubic pieces. */
const CIRCLE = [
  [[60, 4], [26, 1], [3, 9], [4, 21]],
  [[4, 21], [5, 34], [38, 38], [66, 36]],
  [[66, 36], [94, 34], [99, 23], [95, 12]],
  [[95, 12], [91, 3], [70, 2], [44, 6]],
];
const CIRCLE_POINTS = CIRCLE.flatMap(([a, b, c, d], n) => Array.from({ length: n === 3 ? 17 : 16 }, (_, i) => {
  const t = i / 16, u = 1 - t;
  return [0, 1].map(k => u * u * u * a[k] + 3 * u * u * t * b[k] + 3 * u * t * t * c[k] + t * t * t * d[k]);
}));

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mixHex = (a, b, t) => `#${new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString()}`;

export default class ReviewRing {
  /** `quotes`: [{ text, by }] (the name circled where it is in one). */
  constructor(scene, { quotes }) {
    this.outer = new THREE.Group();
    this.tilted = new THREE.Group();
    this.turning = new THREE.Group();
    this.outer.add(this.tilted);
    this.tilted.add(this.turning);
    this.outer.visible = false;
    scene.add(this.outer);
    this.angle = 0;
    this.rate = RING.speed;
    this.held = null;
    this.radius = 0;
    this.raycaster = new THREE.Raycaster();
    this.palette = null;
    // The panes in their order round the ring.
    this.panes = quotes.map(quote => this.makePane(quote));
    this.panes.forEach(pane => this.turning.add(pane.mesh));
    // The words need their typeface: laid out once it has come.
    (document.fonts?.ready ?? Promise.resolve()).then(() => { this.fonts = true; this.redraw(); });
  }

  makePane(quote) {
    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: {
        uMap: { value: null }, uHasMap: { value: 0 },
        uCorner: { value: RING.corner }, uOpacity: { value: 0 }, uFace: { value: 1 }, uDpr: { value: 1 },
        uSize: { value: new THREE.Vector2(1, 1) },
        uTop: { value: new THREE.Color() }, uFoot: { value: new THREE.Color() }, uEdge: { value: new THREE.Color() }, uShade: { value: new THREE.Color() },
        uCoin: { value: new THREE.Vector3() }, uGlass: { value: .6 }, uGap: { value: RING.gap },
      },
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
    mesh.frustumCulled = false;
    const pane = { mesh, material, quote, w: RING.pane, h: 80, circle: -1, canvas: document.createElement('canvas') };
    pane.texture = new THREE.CanvasTexture(pane.canvas);
    pane.texture.colorSpace = THREE.SRGBColorSpace;
    pane.texture.premultiplyAlpha = true;
    material.uniforms.uMap.value = pane.texture;
    return pane;
  }

  /** The scheme changed: the glass and the ink in its colours, the words drawn again. */
  paint(palette) {
    this.palette = palette;
    const night = new THREE.Color(palette.ground).getHSL({}).l < .4;
    const glass = night
      ? { top: mixHex(palette.ground, '#ffffff', .2), foot: mixHex(palette.ground, '#ffffff', .07), edge: mixHex(palette.ground, '#ffffff', .4), shade: '#000000', alpha: .66 }
      : { top: '#ffffff', foot: mixHex(palette.ground, palette.ink, .07), edge: '#ffffff', shade: mixHex(palette.ground, palette.ink, .28), alpha: .78 };
    this.panes.forEach(({ material }) => {
      const u = material.uniforms;
      u.uTop.value.set(glass.top);
      u.uFoot.value.set(glass.foot);
      u.uEdge.value.set(glass.edge);
      u.uShade.value.set(glass.shade);
      u.uGlass.value = glass.alpha;
    });
    this.redraw();
  }

  redraw() {
    if (!this.fonts || !this.palette) return;
    this.panes.forEach(pane => this.drawQuote(pane, Math.max(0, pane.circle)));
    this.radius = 0;
  }

  /** A review on its pane: who said it (their initial on a chip), the words, the name in them circled `circle` of the way round, who, five stars. */
  drawQuote(pane, circle) {
    const { quote, canvas } = pane, palette = this.palette, S = RING.sharp;
    const editorial = getComputedStyle(document.documentElement).getPropertyValue('--font-editorial').trim() || 'Georgia, serif';
    const body = getComputedStyle(document.body).fontFamily || 'sans-serif';
    const w = pane.w, pad = 14, chip = 26, x0 = pad + chip + 10, width = w - x0 - pad - 2, size = 14, lead = 18;
    const g = canvas.getContext('2d');
    // The words, wrapped to the pane, the name kept whole.
    g.font = `400 ${size * S}px ${editorial}`;
    const words = `“${quote.text}”`.split(' ');
    const lines = [[]];
    let used = 0;
    const space = g.measureText(' ').width / S;
    for (const word of words) {
      const wide = g.measureText(word).width / S;
      if (used && used + space + wide > width) { lines.push([]); used = 0; }
      lines[lines.length - 1].push(word);
      used += (used ? space : 0) + wide;
    }
    const h = Math.max(pad * 2 + chip, 14 + lines.length * lead + 20 + 10);
    pane.h = h;
    canvas.width = Math.round(w * S);
    canvas.height = Math.round(h * S);
    g.setTransform(S, 0, 0, S, 0, 0);
    g.clearRect(0, 0, w, h);
    // The chip.
    const grad = g.createLinearGradient(pad, 14, pad + chip, 14 + chip);
    grad.addColorStop(0, mixHex(palette.accent, '#ffffff', .28));
    grad.addColorStop(1, palette.accent);
    g.fillStyle = grad;
    g.beginPath();
    g.roundRect(pad, 14, chip, chip, 9);
    g.fill();
    g.fillStyle = '#ffffff';
    g.font = `400 13px ${editorial}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(quote.by[0].toUpperCase(), pad + chip / 2, 14 + chip / 2 + 1);
    // The words, the name in the accent and circled.
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    g.font = `400 ${size}px ${editorial}`;
    let y = 14 + size;
    for (const line of lines) {
      let x = x0;
      line.forEach((word, n) => {
        const name = word.indexOf('Saadi');
        if (name < 0) { g.fillStyle = palette.ink; g.fillText(word, x, y); }
        else {
          const before = word.slice(0, name), after = word.slice(name + 5);
          g.fillStyle = palette.ink;
          g.fillText(before, x, y);
          const at = x + g.measureText(before).width, wide = g.measureText('Saadi').width;
          g.fillStyle = palette.accent;
          g.fillText('Saadi', at, y);
          g.fillStyle = palette.ink;
          g.fillText(after, at + wide, y);
          if (circle > 0) this.drawCircle(g, at - 5, y - size * .82, wide + 10, size * 1.12, circle, palette.accent);
        }
        x += g.measureText(word).width + (n < line.length - 1 ? g.measureText(' ').width : 0);
      });
      y += lead;
    }
    // Who, and the stars.
    g.font = `600 9.5px ${body}`;
    g.letterSpacing = '1px';
    g.fillStyle = mixHex(palette.ink, palette.ground, .45);
    const by = quote.by.toUpperCase();
    const foot = y - lead + 18;
    g.fillText(by, x0, foot);
    g.fillStyle = palette.accent;
    g.font = `400 9px ${body}`;
    g.fillText('★★★★★', x0 + g.measureText(by).width + by.length + 8, foot);
    g.letterSpacing = '0px';
    pane.texture.needsUpdate = true;
    pane.material.uniforms.uHasMap.value = 1;
    pane.circle = circle;
  }

  drawCircle(g, x, y, w, h, amount, colour) {
    const count = Math.max(2, Math.round(CIRCLE_POINTS.length * amount));
    g.strokeStyle = colour;
    g.lineWidth = 1.3;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.beginPath();
    CIRCLE_POINTS.slice(0, count).forEach(([px, py], i) => {
      const X = x + px / 100 * w, Y = y + py / 40 * h;
      if (i) g.lineTo(X, Y); else g.moveTo(X, Y);
    });
    g.stroke();
  }

  /** Each pane's curved sheet, for a ring of radius R: an arc of a cylinder as wide as the pane, as tall. */
  shape(R) {
    if (Math.abs(R - this.radius) < .5) return;
    this.radius = R;
    this.panes.forEach(pane => {
      const span = pane.w / R;
      pane.mesh.geometry.dispose();
      pane.mesh.geometry = new THREE.CylinderGeometry(R, R, pane.h, 28, 1, true, -span / 2, span);
      pane.material.uniforms.uSize.value.set(pane.w, pane.h);
    });
  }

  /**
   * This frame: round a coin at (x, y) (screen px), radius r, `open` (0 → 1)
   * of the way. Returns whether it is drawn.
   */
  place({ x, y, r, open, dt, scrolled, spin, pointer, camera, dpr }) {
    if (!this.fonts || !this.palette || open <= .001) { this.hide(); return false; }
    this.outer.visible = true;
    // As wide as the coin asks, and never so small that the panes crowd one another.
    const R = Math.max(r * RING.radius, this.panes.reduce((sum, pane) => sum + pane.w, 0) * RING.apart / (Math.PI * 2));
    this.shape(R);
    // The whole ring smaller round a smaller coin (a short screen's).
    const k = Math.min(1, Math.max(RING.least, r / RING.fullAt));
    this.outer.scale.setScalar(k);
    // Turning, unless a pane is under the pointer.
    this.held = this.under(pointer, camera);
    const want = this.held ? 0 : RING.speed + Math.abs(spin) * RING.spin;
    this.rate += (want - this.rate) * Math.min(1, dt * RING.settle);
    this.angle += this.rate * dt + scrolled * RING.scroll + (1 - open) * RING.whirl * dt;
    // Low enough that the pane right in front stands clear under the coin (seen nearer, so larger: d / (d - z)).
    const tilt = RING.tilt + (1 - smooth(0, 1, open)) * RING.unfurl;
    const distance = camera.position.z, sinT = Math.sin(tilt), cosT = Math.cos(tilt);
    const tallest = Math.max(...this.panes.map(pane => pane.h));
    const near = distance / (distance - R * k * cosT);
    const drop = Math.max(r * .35, (r + RING.gap) / near - R * k * sinT + tallest * k / 2 * cosT) * smooth(0, 1, open);
    this.outer.position.set(x, -(y + drop), 0);
    this.outer.rotation.set(0, 0, RING.lean);
    this.tilted.rotation.set(tilt, 0, 0);
    this.turning.rotation.set(0, this.angle, 0);
    const count = this.panes.length;
    this.panes.forEach((pane, i) => {
      // Out from behind the coin, one after another round the ring, overshooting a little and settling.
      const t = Math.min(1, Math.max(0, (open - i / count * RING.stagger) / (1 - RING.stagger)));
      const c = RING.overshoot, grow = 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
      const theta = i / count * Math.PI * 2;
      pane.mesh.rotation.set(0, theta, 0);
      pane.mesh.scale.setScalar(Math.max(1e-3, grow));
      const u = pane.material.uniforms;
      u.uOpacity.value = smooth(0, .35, t);
      u.uDpr.value = dpr;
      u.uCoin.value.set(x, this.viewH - y, r);
      // Read only while it faces this way enough.
      const facing = Math.cos(theta + this.angle);
      u.uFace.value = smooth(.15, .55, facing);
      // The front drawn over the back.
      pane.mesh.renderOrder = 10 + Math.round((facing + 1) * 10);
      // The name circled once the pane is out.
      const circle = smooth(.7, 1, t);
      if (Math.abs(circle - pane.circle) > .02 || (circle === 1 && pane.circle !== 1)) this.drawQuote(pane, circle);
    });
    return true;
  }

  /** The pane under the pointer (screen px), if any. */
  under(pointer, camera) {
    if (!pointer || !this.viewW) return null;
    this.raycaster.setFromCamera({ x: pointer.x / this.viewW * 2 - 1, y: -(pointer.y / this.viewH) * 2 + 1 }, camera);
    const hit = this.raycaster.intersectObjects(this.panes.map(pane => pane.mesh), false)
      .find(({ object }) => this.panes.find(pane => pane.mesh === object).material.uniforms.uOpacity.value > .5);
    return hit ? this.panes.find(pane => pane.mesh === hit.object) : null;
  }

  /** The screen's size (px), for the pointer and the coin's place in the drawing. */
  setView(width, height) {
    this.viewW = width;
    this.viewH = height;
  }

  hide() {
    this.outer.visible = false;
    this.held = null;
  }

  dispose() {
    this.panes.forEach(pane => { pane.mesh.geometry.dispose(); pane.material.dispose(); pane.texture.dispose(); });
    this.outer.removeFromParent();
  }
}
