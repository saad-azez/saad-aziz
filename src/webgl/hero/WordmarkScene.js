import * as THREE from 'three';
import gsap from 'gsap';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import typeface from './saadi.typeface.json';
import { WORDMARK } from './wordmark.paths.js';
import { createSolidMaterial, paintSolid } from './materials.js';
import { createBackdrop, paintBackdrop } from '../backdrop.js';
import { brandPalette, onSchemeChange } from '../../brand/palette.js';
import { reducedMotion } from '../../brand/motion.js';
import SignatureSequence from './SignatureSequence.js';
import Props from './Props.js';
import LiquidDot from './LiquidDot.js';
import SkillCoin from './SkillCoin.js';
import WordmarkParallax from './WordmarkParallax.js';
import { INTRO, markIntroSeen } from '../../brand/intro.js';
import { viewHeight } from '../../lib/viewport.js';
import { pixelRatio } from '../../lib/device.js';

const REST_TURN = 0;
/** How far the camera stands from the word's centre. */
const CAMERA_DISTANCE = 1200;
/** How far the word can be zoomed out and in. */
const ZOOM_MIN = .6;
const ZOOM_MAX = 4;
// Extrude once; render during the entrance, then only when the view changes.
export default class WordmarkScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.restTurn = REST_TURN;
    this.palette = brandPalette();
    this.handleResize = this.handleResize.bind(this);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(pixelRatio());
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 2000);
    this.camera.position.z = 600;
    this.backdrop = createBackdrop(this.palette);
    this.scene.add(this.backdrop);
    this.material = createSolidMaterial(this.palette);
    this.word = new THREE.Group();
    this.scene.add(this.word);
    this.letters = [];
    this.bodies = [];
    this.font = new FontLoader().parse(typeface);
    this.gap = WORDMARK.capHeight * .018;
    const gap = this.gap;
    let cursor = 0;
    WORDMARK.letters.forEach(letter => {
      const glyph = new THREE.Group();
      glyph.name = letter.char;
      const shapes = this.font.generateShapes(letter.fontChar, WORDMARK.fontSize);
      if (letter.char === 'i') {
        // Replace only the font's upper contour with a bevelled circular disc.
        const bounds = shapes.map(shape => new THREE.Box2().setFromPoints(shape.getPoints()));
        const dotIndex = bounds.findIndex(box => box.max.y === Math.max(...bounds.map(item => item.max.y)));
        const box = bounds[dotIndex];
        const centre = box.getCenter(new THREE.Vector2());
        const radius = (box.max.x - box.min.x) / 2;
        const circle = new THREE.Shape();
        circle.absarc(0, 0, radius - .35, 0, Math.PI * 2, false);
        const dot = new THREE.ExtrudeGeometry(circle, {
          depth: 2, bevelEnabled: true, bevelThickness: .35,
          bevelSize: .35, bevelSegments: 3, curveSegments: 32,
        });
        // Centred in the letter's thickness: the disc is 2 deep (0 to 2), the stem is centred on 0.
        dot.translate(centre.x, centre.y, -1);
        this.dot = new THREE.Mesh(dot, this.material);
        glyph.add(this.dot);
        shapes.splice(dotIndex, 1);
      }
      const geometry = new THREE.ExtrudeGeometry(shapes, {
        depth: 5, bevelEnabled: true, bevelThickness: .45,
        bevelSize: .06, bevelSegments: 3, curveSegments: 36,
      });
      // Font contours already use upward Y; center the extrusion on Z.
      geometry.translate(0, 0, -2.5);
      const body = new THREE.Mesh(geometry, this.material);
      glyph.add(body);
      this.bodies.push(body);

      // Each letter pivots around itself; the coin dot travels with its stem.
      const centre = new THREE.Box3().setFromObject(glyph).getCenter(new THREE.Vector3());
      glyph.children.forEach(mesh => mesh.geometry.translate(-centre.x, -centre.y, -centre.z));
      // Kept so a point in the type's own coordinates can be found on the letter (see Props).
      glyph.userData.centre = centre.clone();
      glyph.position.y = centre.y;
      glyph.rotation.y = REST_TURN;
      const bounds = new THREE.Box3().setFromObject(glyph);
      // Use the visible bounds after the slight turn, including the bevels,
      // rather than the font's unequal side bearings and kerning pairs.
      glyph.position.x = cursor - bounds.min.x;
      cursor += bounds.max.x - bounds.min.x + gap;
      this.word.add(glyph);
      this.letters.push(glyph);
    });
    const centre = new THREE.Box3().setFromObject(this.word).getCenter(new THREE.Vector3());
    this.letters.forEach(glyph => glyph.position.sub(centre));
    this.restY = this.letters.map(glyph => glyph.position.y);
    this.restX = this.letters.map(glyph => glyph.position.x);
    const stem = this.letters.at(-1).children[1];
    stem.geometry.computeBoundingBox();
    this.dot.geometry.computeBoundingBox();
    // Use the flat A's baseline/cap line, including the coin, for both I and i.
    this.bodies[1].geometry.computeBoundingBox();
    const reference = this.bodies[1].geometry.boundingBox;
    const glyph = this.letters[4];
    const bottom = reference.min.y + this.restY[1] - glyph.position.y;
    const top = reference.max.y + this.restY[1] - glyph.position.y;
    const dotBox = this.dot.geometry.boundingBox;
    const dotCenter = dotBox.getCenter(new THREE.Vector3());
    const radius = (dotBox.max.x - dotBox.min.x) / 2;
    const readableRadius = radius * 1.65;
    this.dot.geometry.translate(-dotCenter.x, -dotCenter.y, 0);
    this.dot.geometry.scale(1.65, 1.65, 1);
    this.dot.geometry.translate(dotCenter.x, top - readableRadius, 0);
    this.dot.geometry.computeBoundingBox();
    const stemTop = top - readableRadius * 2 - 3.7;
    const oldBox = stem.geometry.boundingBox;
    const positions = stem.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const t = (positions.getY(i) - oldBox.min.y) / (oldBox.max.y - oldBox.min.y);
      positions.setY(i, bottom + t * (stemTop - bottom));
    }
    positions.needsUpdate = true;
    stem.geometry.computeVertexNormals();
    stem.geometry.computeBoundingBox();
    stem.geometry.computeBoundingSphere();
    this.iForm = { bottom, top, capitalScale: (top - bottom) / (stemTop - bottom) };
    this.dotContact = stem.geometry.boundingBox.max.y - this.dot.geometry.boundingBox.min.y;
    this.extents = new THREE.Box3().setFromObject(this.word);
    this.parallax = new WordmarkParallax(this.camera);
    this.liquidDot = new LiquidDot(this);
    this.skillCoin = new SkillCoin(this);
    this.sequence = new SignatureSequence(this);
    // The hat and the rope: hidden through the entrance, revealed at rest.
    this.letterDepth = 5;
    this.capHeight = WORDMARK.capHeight;
    this.atRest = false;
    this.props = new Props(this);
    this.stopScheme = onSchemeChange(() => {
      this.palette = brandPalette();
      paintSolid(this.material, this.palette);
      paintBackdrop(this.backdrop.material, this.palette);
      this.sequence.paintPalette();
      this.skillCoin.paint();
      this.render();
    });
  }

  mount() {
    window.addEventListener('resize', this.handleResize);
    this.handleResize();
  }

  /**
   * Move the camera round the word with a mouse or pen, on `element`:
   * - drag to turn round the word's centre;
   * - right-drag, or Shift-drag, to move the camera sideways and up and down;
   * - Ctrl or Alt with the wheel (what a trackpad pinch sends) to zoom — the
   *   plain wheel still scrolls the page and drives the transition below;
   * - double-click to glide back to the front, centred, at normal size.
   * It is on whenever the device has any mouse or pen — a touchscreen laptop
   * reports touch as its main pointer — and a finger still scrolls the page.
   */
  enableOrbit(element) {
    if (this.controls || !element || !window.matchMedia('(any-pointer: fine)').matches) return;
    const controls = new OrbitControls(this.camera, element);
    controls.enableZoom = false;
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    // Fingers are left to the page: no turning by touch, and the page scrolls.
    controls.touches = { ONE: null, TWO: null };
    element.style.touchAction = 'pan-x pan-y pinch-zoom';
    controls.enableDamping = true;
    controls.dampingFactor = .09;
    controls.rotateSpeed = .75;
    controls.target.copy(this.word.position);
    controls.addEventListener('change', () => this.render());
    // Turned or zoomed and then left alone, the word glides back to face the
    // reader, so a stray drag never leaves the name tilted.
    const IDLE = 3.5;
    this.orbitIdle = null;
    const idleBack = () => {
      this.orbitIdle?.kill();
      this.orbitIdle = gsap.delayedCall(IDLE, () => this.faceFront(true));
    };
    controls.addEventListener('start', () => { this.orbitDragging = true; this.parallaxAim?.set(0, 0); element.style.cursor = 'grabbing'; this.orbitIdle?.kill(); });
    controls.addEventListener('end', () => { this.orbitDragging = false; element.style.cursor = 'grab'; idleBack(); });
    element.style.cursor = 'grab';
    this.controls = controls;
    this.orbitElement = element;
    this.faceFrontOnDoubleClick = () => this.faceFront(true);
    element.addEventListener('dblclick', this.faceFrontOnDoubleClick);
    this.zoomOnWheel = event => {
      if (!(event.ctrlKey || event.altKey) || !controls.enabled) return;
      // Keep the browser from zooming the page, and smooth scrolling from taking it, instead.
      event.preventDefault();
      event.stopPropagation();
      const lines = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
      const factor = Math.exp(-event.deltaY * lines * .0022);
      this.zoomTo(this.camera.zoom * factor);
      idleBack();
    };
    element.addEventListener('wheel', this.zoomOnWheel, { passive: false });
    if (!reducedMotion) {
      this.parallaxAim = new THREE.Vector2();
      this.parallaxLeave = () => this.parallaxAim.set(0, 0);
      this.parallaxMove = event => {
        if (event.pointerType === 'touch' || event.buttons || this.orbitDragging || !controls.enabled
          || !this.visible || !this.atRest || this.offstage || this.dotHidden) { this.parallaxLeave(); return; }
        const rect = element.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        this.parallaxAim.set(
          THREE.MathUtils.clamp((event.clientX - rect.left) / rect.width * 2 - 1, -1, 1),
          THREE.MathUtils.clamp(1 - (event.clientY - rect.top) / rect.height * 2, -1, 1),
        );
      };
      element.addEventListener('pointermove', this.parallaxMove, { passive: true });
      element.addEventListener('pointerleave', this.parallaxLeave, { passive: true });
      element.addEventListener('pointerdown', this.parallaxLeave, { passive: true });
    }
    this.orbitTick = (_, deltaMs) => {
      if (controls.enabled && !this.offstage) controls.update();
      this.stepParallax(deltaMs);
    };
    gsap.ticker.add(this.orbitTick);
    this.handleResize();
  }

  /** Change the viewing angle while preserving the sculpture's authored poses. */
  stepParallax(deltaMs = 16) {
    if (!this.parallaxAim || !this.visible || !this.atRest || this.offstage || this.dotHidden || document.hidden) return;
    const active = this.controls.enabled && !this.orbitDragging;
    if (this.parallax.step(this.parallaxAim, deltaMs, active)) this.render();
  }

  /** Skip the rest of the introduction: the word at rest, the hat on, the rope in place. */
  skipIntro() {
    if (!this.visible) return;
    if (this.entrance) this.entrance.progress(1);
    this.props.finish();
  }

  /**
   * The hero is covered by the work (see stage): nothing here needs to move.
   * The orbit's damping stops being stepped, and picks up again on return.
   */
  setOffstage(offstage) {
    this.offstage = offstage;
  }

  /** Zoom about the word's centre, within reason. */
  zoomTo(zoom) {
    gsap.killTweensOf(this.camera, 'zoom');
    this.camera.zoom = THREE.MathUtils.clamp(zoom, ZOOM_MIN, ZOOM_MAX);
    this.camera.updateProjectionMatrix();
    this.render();
  }

  setOrbitEnabled(enabled) {
    if (this.controls) this.controls.enabled = enabled;
  }

  /** Turn the camera back to face the word, at once or with a short glide. */
  faceFront(glide = false) {
    if (!this.controls) return;
    const target = this.controls.target;
    const home = this.word.position.clone();
    const front = new THREE.Vector3(home.x, home.y, home.z + CAMERA_DISTANCE);
    gsap.killTweensOf(this.camera.position);
    gsap.killTweensOf(target);
    gsap.killTweensOf(this.camera, 'zoom');
    if (!glide) {
      this.camera.zoom = 1;
      this.camera.updateProjectionMatrix();
      target.copy(home);
      this.camera.position.copy(front);
      this.controls.update();
      this.render();
      return;
    }
    // Moved back from wherever it was panned to, as it turns to the front.
    gsap.to(target, { x: home.x, y: home.y, z: home.z, duration: .7, ease: 'power3.inOut' });
    gsap.to(this.camera, {
      zoom: 1, duration: .7, ease: 'power3.inOut',
      onUpdate: () => { this.camera.updateProjectionMatrix(); this.render(); },
    });
    gsap.to(this.camera.position, {
      x: front.x, y: front.y, z: front.z, duration: .7, ease: 'power3.inOut',
      onUpdate: () => {
        // Kept at its distance from the word, so the glide is an arc.
        const offset = this.camera.position.clone().sub(target).setLength(CAMERA_DISTANCE);
        this.camera.position.copy(target).add(offset);
        this.controls.update();
      },
    });
  }

  setVisible(visible) {
    if (this.visible === visible) return;
    this.visible = visible;
    this.parallaxAim?.set(0, 0);
    this.parallax.reset();
    this.word.rotation.set(0, 0, 0);
    this.entrance?.kill();
    this.entrance = null;
    this.atRest = false;
    this.props.hide();
    this.word.visible = visible;
    this.sequence.reset();
    // A reader who has seen the introduction starts with the word at rest.
    this.instant = reducedMotion || INTRO.seen;
    if (visible && !this.instant) this.entrance = this.sequence.play(1.10, { full: false });
    else if (visible) { this.sequence.paint(2.9); this.rest(); }
    this.render();
  }

  /** The entrance has finished: the word is at rest, the props come out, and whoever is listening is told. */
  rest() {
    this.atRest = true;
    this.props.reveal({ instant: reducedMotion, hatInstant: this.instant });
    markIntroSeen();
    this.onRest?.();
  }

  setBand(top, bottom, left, right) {
    if (!(bottom > top) || !(right > left)) return;
    this.band = { top, bottom, left, right };
    this.handleResize();
  }

  handleResize() {
    // The full screen's height (lib/viewport), as the canvas is (Hero.css): a phone's address bar coming and going stretches nothing.
    const width = window.innerWidth, height = viewHeight();
    // (Put away by the stage while something covers the screen: DotStage suspend brings it back.)
    if (this.suspended) return;
    this.renderer.setSize(width, height, false);
    this.backdrop.material.uniforms.uAspect.value = width / height;

    const size = this.extents.getSize(new THREE.Vector3());
    const band = this.band ?? { top: 0, bottom: height, left: 0, right: width };
    // Sit on the viewport's centre line when the band allows it, but never so
    // near the band's edge that the word keeps less than 70% of the room — a
    // tall footer on a short screen would otherwise crush it.
    const keep = (band.bottom - band.top) * .35;
    const centreY = height / 2 > band.top && height / 2 < band.bottom
      ? Math.min(Math.max(height / 2, band.top + keep), band.bottom - keep)
      : (band.top + band.bottom) / 2;
    const room = Math.max(0, 2 * Math.min(centreY - band.top, band.bottom - centreY));
    this.word.scale.setScalar(Math.min((band.right - band.left) * (width < height ? .74 : .64) / size.x, room * .92 / size.y));
    this.word.position.set((band.left + band.right) / 2 - width / 2, height / 2 - centreY, 0);
    // The camera looks at the word's centre from wherever it has been turned
    // to, and the view is shifted back so the word is drawn where it was placed.
    const { x: wx, y: wy } = this.word.position;
    const offset = this.controls ? this.camera.position.clone().sub(this.controls.target) : new THREE.Vector3(0, 0, 1);
    if (offset.lengthSq() < 1e-6) offset.set(0, 0, 1);
    offset.setLength(CAMERA_DISTANCE);
    this.camera.position.copy(this.word.position).add(offset);
    this.camera.left = -width / 2 - wx; this.camera.right = width / 2 - wx;
    this.camera.top = height / 2 - wy; this.camera.bottom = -height / 2 - wy;
    this.camera.near = .1; this.camera.far = CAMERA_DISTANCE * 4;
    this.camera.lookAt(this.word.position);
    this.camera.updateProjectionMatrix();
    if (this.controls) { this.controls.target.copy(this.word.position); this.controls.update(); }
    this.render();
  }

  /**
   * The dot of the i, in page pixels: its centre and its radius. The hero's
   * canvas sits at the top of the page, so screen and page agree at scroll 0.
   * The stage (webgl/stage) asks for this when it takes the dot over.
   */
  dotPoint() {
    this.word.updateMatrixWorld(true);
    const camera = this.updateViewCamera();
    const box = new THREE.Box3().setFromObject(this.dot);
    const worldCentre = box.getCenter(new THREE.Vector3());
    const centre = worldCentre.clone().project(camera);
    const edge = worldCentre.clone().add(new THREE.Vector3(box.getSize(new THREE.Vector3()).x / 2, 0, 0)
      .applyQuaternion(camera.quaternion)).project(camera);
    return { x: (centre.x + 1) / 2 * window.innerWidth, y: (1 - centre.y) / 2 * viewHeight(),
      r: Math.abs(edge.x - centre.x) * window.innerWidth / 2 };
  }

  /** While the stage carries the dot, the hero does not draw its own. */
  setDotHidden(hidden) {
    this.dotHidden = hidden;
    this.liquidDot.syncVisibility();
    this.render();
  }

  updateViewCamera() {
    return this.viewCamera = this.parallax.update(this.controls?.target ?? this.word.position);
  }

  render() {
    // (Not while the stage has put the drawing away: DotStage suspend.)
    if (this.disposed || this.renderer.getSize(this._size ??= new THREE.Vector2()).x <= 1) return;
    this.props?.updateHatShade();
    this.renderCount = (this.renderCount ?? 0) + 1;
    this.liquidDot?.syncVisibility();
    this.skillCoin?.sync();
    this.renderer.render(this.scene, this.updateViewCamera());
  }

  dispose() {
    this.disposed = true;
    if (this.controls) {
      gsap.ticker.remove(this.orbitTick);
      gsap.killTweensOf(this.camera.position);
      this.orbitElement.removeEventListener('dblclick', this.faceFrontOnDoubleClick);
      this.orbitElement.removeEventListener('wheel', this.zoomOnWheel);
      if (this.parallaxMove) {
        this.orbitElement.removeEventListener('pointermove', this.parallaxMove);
        this.orbitElement.removeEventListener('pointerleave', this.parallaxLeave);
        this.orbitElement.removeEventListener('pointerdown', this.parallaxLeave);
      }
      this.orbitIdle?.kill();
      gsap.killTweensOf(this.camera, 'zoom');
      this.orbitElement.style.cursor = '';
      this.controls.dispose();
    }
    this.entrance?.kill();
    this.props.dispose();
    this.skillCoin.dispose();
    this.liquidDot.dispose();
    window.removeEventListener('resize', this.handleResize);
    this.stopScheme();
    this.word.traverse(object => { object.geometry?.dispose(); });
    this.sequence.dispose();
    this.material.dispose();
    this.backdrop.geometry.dispose();
    this.backdrop.material.dispose();
    this.renderer.dispose();
  }
}
