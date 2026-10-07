import * as THREE from 'three';
import { INK, ROPE_OUTLINE, ROPE_FRAGMENT } from '../hero/Props.js';
import { reducedMotion } from '../../brand/motion.js';
import { scrollToY } from '../../lib/smoothScroll.js';
import { viewHeight } from '../../lib/viewport.js';
import { pixelRatio } from '../../lib/device.js';
import { ropeTransition, DISSOLVE_FIELD, DISSOLVE_VERTEX, FIBER_VERTEX, FIBER_FRAGMENT } from './ropeDissolve.js';

/**
 * Two stationary instances of the same rope. A grainy WebGL erosion removes
 * the woven instance in place; matching fibers assemble the narrow rail.
 * Nothing travels across the screen. All noise and motion are scroll-derived,
 * so stopping freezes the effect and scrolling back restores every strand.
 *
 * In the work, once a project is open (stage.tightrope, 0 → 1 with the
 * scroll), the same again: the rail erodes away where it is, on the edge of
 * the screen, and its fibers gather into a third instance lying straight across
 * the rope's lane (`.work__rope`, stage.work.rope), for the coin to walk; it
 * sags there, and under the coin's weight where the coin stands (placeLine).
 */
const EDGE = 9;
const DIAMETER = 4;
const THUMB_MIN = .16;
const FIBERS = 2400;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const smooth = t => t * t * (3 - 2 * t);
// On the full screen's height (lib/viewport), so it never jumps as a phone's address bar comes and goes.
const railBounds = () => {
  const H = viewHeight();
  const span = Math.min(200, Math.max(120, H * .24), H * .6);
  return { top: (H - span) / 2, span };
};

const ERASE = /* glsl */ `
  float field = erosionField(vAlong, vNoiseCoord);
  float distanceToEdge = field - mix(-.12, 1.12, uDissolve);
  if (distanceToEdge < 0.0) discard;
`;

const FRAGMENT = ROPE_FRAGMENT
  .replace('uniform float uReveal,', 'uniform float uDissolve, uThumb0, uThumb1, uThumbOn;\nuniform vec3 uBand, uBandShade, uInk;\nvarying vec3 vNoiseCoord;\nuniform float uReveal,')
  .replace('void main() {', `${DISSOLVE_FIELD}\nvoid main() {`)
  .replace('  if (vAlong > uReveal) discard;', `  if (vAlong > uReveal) discard;\n${ERASE}`)
  .replace('  gl_FragColor = vec4(color, 1.0);', /* glsl */ `
  float edge = .008;
  float band = smoothstep(uThumb0 - edge, uThumb0, vAlong)
    * (1.0 - smoothstep(uThumb1, uThumb1 + edge, vAlong)) * uThumbOn;
  if (band > 0.0 && vHair < .5) {
    vec3 twine = mix(uBandShade, uBand, smoothstep(-.2, .25, lambert));
    float turns = fract(vS / uR * 2.2 + atan(vRoll.y, vRoll.x) / 6.28318);
    twine = mix(twine, uInk, (1.0 - smoothstep(0.0, .16, turns)) * .65);
    color = mix(color, twine, band);
  }
  // Fine light contours trace the torn edge, like the supplied dissolve reference.
  float rim = (1.0 - smoothstep(0.0, .09, distanceToEdge))
    * smoothstep(0.0, .06, uDissolve) * (1.0 - smoothstep(.94, 1.0, uDissolve));
  float contour = .5 + .5 * sin(distanceToEdge * 180.0);
  color = mix(color, uHigh, rim * (.5 + .5 * contour));
  gl_FragColor = vec4(color, 1.0);`);

const OUTLINE_FRAGMENT = /* glsl */ `
uniform vec3 uInk;
uniform float uReveal, uDissolve;
varying float vAlong;
varying vec3 vNoiseCoord;
${DISSOLVE_FIELD}
void main() {
  if (vAlong > uReveal) discard;
  ${ERASE}
  gl_FragColor = vec4(uInk, 1.0);
  #include <colorspace_fragment>
}
`;

export default class RopeScrollbar {
  constructor(stage) {
    this.stage = stage;
    this.group = new THREE.Group();
    this.group.visible = false;
    stage.uiScene.add(this.group);
    this.thumb = { u0: 0, u1: 1 };
    this.buildDom();
  }

  /** Sample existing surface vertices once; the GPU animates these loose fibers. */
  makeFibers(geometry) {
    const position = geometry.getAttribute('position');
    const along = geometry.getAttribute('aAlong');
    const roll = geometry.getAttribute('aRoll');
    const points = [], lengths = [], rolls = [], seeds = [];
    for (let i = 0; i < FIBERS; i++) {
      const seed = (i * .61803398875) % 1;
      const index = Math.min(position.count - 1, Math.floor(seed * position.count));
      points.push(position.getX(index), position.getY(index), position.getZ(index));
      lengths.push(along.getX(index));
      rolls.push(roll.getX(index), roll.getY(index));
      seeds.push((i * .75487766625) % 1);
    }
    const fibers = new THREE.BufferGeometry();
    fibers.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    fibers.setAttribute('aAlong', new THREE.Float32BufferAttribute(lengths, 1));
    fibers.setAttribute('aRoll', new THREE.Float32BufferAttribute(rolls, 2));
    fibers.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1));
    return fibers;
  }

  adopt(props) {
    if (!props.rope || props.rope === this.source) return;
    this.dropMeshes();
    this.source = props.rope;
    this.props = props;
    const [body, hull] = props.rope.children;
    const shared = body.material.uniforms;
    this.fiberGeometry = this.makeFibers(body.geometry);
    const make = rail => {
      const common = {
        uRail: { value: rail ? 1 : 0 }, uSpan: { value: 200 },
        uScale: { value: 1 }, uDissolve: { value: rail ? 1 : 0 },
        uMotion: { value: 0 }, uDpr: { value: 1 },
        uLoad: { value: 0 }, uLoadS: { value: .5 }, uDroop: { value: 0 },
        uDip: shared.uDip, uDipS: shared.uDipS, uDipW: shared.uDipW,
        uReveal: shared.uReveal, uR: shared.uR,
      };
      const material = new THREE.ShaderMaterial({
        vertexShader: DISSOLVE_VERTEX, fragmentShader: FRAGMENT, side: THREE.DoubleSide,
        uniforms: {
          ...shared, ...common, uOutline: { value: 0 },
          uThumb0: { value: 0 }, uThumb1: { value: 0 }, uThumbOn: { value: 0 },
          uBand: { value: new THREE.Color('#c91d45') }, uBandShade: { value: new THREE.Color('#86122f') },
          uInk: { value: new THREE.Color(INK) },
        },
      });
      const outline = new THREE.ShaderMaterial({
        vertexShader: DISSOLVE_VERTEX, fragmentShader: OUTLINE_FRAGMENT, side: THREE.BackSide,
        uniforms: { ...common, uOutline: { value: ROPE_OUTLINE }, uInk: { value: new THREE.Color(INK) } },
      });
      const dust = new THREE.ShaderMaterial({
        vertexShader: FIBER_VERTEX, fragmentShader: FIBER_FRAGMENT,
        transparent: true, depthWrite: false,
        uniforms: { ...common, uMotion: { value: 1 }, uLight: shared.uHigh, uInk: { value: new THREE.Color(INK) } },
      });
      const particles = new THREE.Points(this.fiberGeometry, dust);
      const group = new THREE.Group();
      group.add(new THREE.Mesh(body.geometry, material), new THREE.Mesh(hull.geometry, outline), particles);
      group.traverse(object => { object.frustumCulled = false; });
      group.visible = false;
      return { group, material, outline, dust, particles };
    };
    this.inHero = make(false);
    props.group.add(this.inHero.group);
    this.onStage = make(true);
    this.onRope = make(true);
    this.onRope.group.rotation.z = Math.PI / 2;
    this.group.add(this.onStage.group, this.onRope.group);
    const hero = this.stage.hero;
    this.stage.warm(hero.scene, this.inHero.group, hero.renderer, hero.camera);
    this.stage.warm(this.stage.uiScene, this.onStage.group);
    this.stage.warm(this.stage.uiScene, this.onRope.group);
  }

  dropMeshes() {
    for (const part of [this.inHero, this.onStage, this.onRope]) {
      if (!part) continue;
      part.group.parent?.remove(part.group);
      part.material.dispose(); part.outline.dispose(); part.dust.dispose();
    }
    this.fiberGeometry?.dispose();
    this.fiberGeometry = null;
    this.inHero = this.onStage = this.onRope = this.source = null;
    this.lastKey = this.layoutKey = this.lineKey = null;
  }

  /** Geometry stays fixed. Only uniforms change during the transition. */
  update(progress) {
    const hero = this.stage.hero;
    const props = hero?.props;
    if (props?.rope && props.rope !== this.source) this.adopt(props);
    if (!this.source || !props.revealStarted) { this.setDom(false); return false; }
    const p = clamp(progress, 0, 1);
    this.lastP = p;
    const { erase, reveal, fibers } = ropeTransition(p, reducedMotion);
    const W = window.innerWidth, H = viewHeight();
    const max = Math.max(1, document.documentElement.scrollHeight - H);
    const size = clamp(H / document.documentElement.scrollHeight, THUMB_MIN, .45);
    const u0 = clamp(window.scrollY / max, 0, 1) * (1 - size);
    const view = hero.word.scale.x * hero.camera.zoom;
    const dpr = pixelRatio();
    const layoutKey = `${W}|${H}|${view}|${dpr}`;
    // In the work: how far it has gone into the copy as the tightrope, and where that is.
    const tight = this.stage.tightrope ?? 0, line = this.stage.ropeLine();
    const key = `${p}|${u0}|${size}|${layoutKey}|${tight}|${line ? 1 : 0}`;
    const changed = this.lastKey !== key;
    this.lastKey = key;
    if (layoutKey !== this.layoutKey) {
      this.layoutKey = layoutKey;
      const { top, span } = railBounds();
      // Pixel-space rail is independent of the hero camera's rotation/zoom.
      this.rail = { x: W - EDGE, y: top, span };
      const scale = DIAMETER / (2 * (props.ropeRadius + ROPE_OUTLINE));
      this.inHero.material.uniforms.uMotion.value = reducedMotion ? 0 : .7 / view;
      this.inHero.dust.uniforms.uMotion.value = 1.6 / view;
      for (const part of [this.onStage, this.onRope]) {
        part.material.uniforms.uScale.value = scale;
        part.outline.uniforms.uOutline.value = ROPE_OUTLINE * scale;
        part.material.uniforms.uMotion.value = reducedMotion ? 0 : .22;
      }
      for (const part of [this.inHero, this.onStage, this.onRope]) part.dust.uniforms.uDpr.value = dpr;
    }
    // Into the copy: the rail erodes on the edge as the hero's rope did, and the tightrope gathers across the lane.
    const across = ropeTransition(line ? tight : 0, reducedMotion);
    const original = p === 0;
    const dissolving = p > 0 && erase < 1;
    const onEdge = reveal > 0 && across.erase < 1;
    const onLine = Boolean(line) && across.reveal > 0;
    const heroChanged = props.rope.visible !== original || this.inHero.group.visible !== dissolving;
    props.rope.visible = original;
    this.inHero.group.visible = dissolving;
    this.onStage.group.visible = onEdge;
    this.onRope.group.visible = onLine;
    this.group.visible = onEdge || onLine;
    if (changed) {
      const rail = this.rail;
      this.onStage.group.position.set(rail.x, -rail.y, 0);
      this.onStage.material.uniforms.uSpan.value = rail.span;
      this.inHero.material.uniforms.uDissolve.value = erase;
      // Gone from the edge either way: not yet come from the hero, or gone on into the copy.
      this.onStage.material.uniforms.uDissolve.value = Math.max(1 - reveal, across.erase);
      this.onRope.material.uniforms.uDissolve.value = 1 - across.reveal;
      this.inHero.particles.visible = fibers && erase > 0 && erase < 1;
      this.onStage.particles.visible = fibers && ((reveal > 0 && reveal < 1) || (across.erase > 0 && across.erase < 1));
      this.onRope.particles.visible = across.fibers && across.reveal > 0 && across.reveal < 1;
      const band = this.onStage.material.uniforms;
      band.uThumb0.value = u0;
      band.uThumb1.value = u0 + size;
      band.uThumbOn.value = smooth(clamp((reveal - .55) / .45, 0, 1));
      this.thumb = { u0, u1: u0 + size };
    }
    const placed = this.placeLine(window.scrollY);
    if (heroChanged || (dissolving && changed)) hero.render();
    // A scrollbar to drag only on the edge, not as the tightrope.
    this.setDom(reveal >= .98 && tight < .05);
    return changed || heroChanged || placed;
  }

  /**
   * The tightrope where it is this frame (stage.ropeLine: risen with the copy
   * as it comes in), and sagging as it does under the coin (stage.walk). Asked
   * again by the stage once the coin has moved, so the two never part. Returns
   * whether it moved.
   */
  placeLine(scroll) {
    const line = this.stage.ropeLine();
    if (!this.onRope || !line) return false;
    const walk = this.stage.walk, pin = this.stage.pinOffset(scroll);
    const values = [line.x0, -(line.y + pin), Math.max(40, line.x1 - line.x0), walk.dip, walk.c, walk.droop];
    const key = values.join('|');
    if (key === this.lineKey) return false;
    this.lineKey = key;
    const u = this.onRope.material.uniforms;
    this.onRope.group.position.set(values[0], values[1], 0);
    u.uSpan.value = values[2];
    u.uLoad.value = walk.dip;
    u.uLoadS.value = walk.c;
    u.uDroop.value = walk.droop;
    return true;
  }

  /* ----- dragging ----------------------------------------------------- */

  buildDom() {
    const el = document.createElement('div');
    el.className = 'rope-scrollbar';
    el.setAttribute('aria-hidden', 'true');
    document.body.append(el);
    this.el = el;
    const toU = y => { const { top, span } = railBounds(); return clamp((y - top) / span, 0, 1); };
    let dragging = false;
    const scrollToThumb = u0 => {
      const size = this.thumb.u1 - this.thumb.u0;
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      scrollToY(clamp(u0 / Math.max(1e-6, 1 - size), 0, 1) * max, { immediate: dragging });
    };
    el.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      event.preventDefault();
      const u = toU(event.clientY);
      const size = this.thumb.u1 - this.thumb.u0;
      // On the band: drag it from where it was taken. Elsewhere: jump there, centred.
      const onBand = u >= this.thumb.u0 && u <= this.thumb.u1;
      const grab = onBand ? u - this.thumb.u0 : size / 2;
      // A click on the rope glides there; dragging the band follows the hand exactly.
      dragging = false;
      if (!onBand) scrollToThumb(u - grab);
      dragging = true;
      el.setPointerCapture(event.pointerId);
      el.classList.add('is-dragging');
      const move = e => scrollToThumb(toU(e.clientY) - grab);
      const up = () => {
        dragging = false;
        el.classList.remove('is-dragging');
        if (el.hasPointerCapture(event.pointerId)) el.releasePointerCapture(event.pointerId);
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
        el.removeEventListener('pointercancel', up);
        el.removeEventListener('lostpointercapture', up);
      };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('lostpointercapture', up);
    });
  }

  setDom(active) {
    const { top, span } = railBounds();
    const boundsKey = `${top}|${span}`;
    if (boundsKey !== this.domBounds) {
      this.domBounds = boundsKey;
      this.el.style.top = `${top - 8}px`;
      this.el.style.height = `${span + 16}px`;
    }
    if (this.domActive === active) return;
    this.domActive = active;
    this.el.classList.toggle('is-active', active);
  }

  dispose() {
    if (this.props?.rope) this.props.rope.visible = this.props.revealStarted;
    this.dropMeshes();
    this.stage.uiScene.remove(this.group);
    this.el.remove();
  }
}
