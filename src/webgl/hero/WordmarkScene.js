import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import typeface from './saadi.typeface.json';
import { WORDMARK } from './wordmark.paths.js';
import { createSolidMaterial, paintSolid } from './materials.js';
import { createBackdrop, paintBackdrop } from '../backdrop.js';
import { brandPalette, onSchemeChange } from '../../brand/palette.js';
import { reducedMotion } from '../../brand/motion.js';
import SignatureSequence from './SignatureSequence.js';

const REST_TURN = 0;
// Extrude once; render during the entrance, then only when the view changes.
export default class WordmarkScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.restTurn = REST_TURN;
    this.palette = brandPalette();
    this.handleResize = this.handleResize.bind(this);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
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
        dot.translate(centre.x, centre.y, 3.45);
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
    this.dotContact = stem.geometry.boundingBox.max.y - this.dot.geometry.boundingBox.min.y;
    this.extents = new THREE.Box3().setFromObject(this.word);
    this.sequence = new SignatureSequence(this);
    this.stopScheme = onSchemeChange(() => {
      this.palette = brandPalette();
      paintSolid(this.material, this.palette);
      paintBackdrop(this.backdrop.material, this.palette);
      this.sequence.paintPalette();
      this.render();
    });
  }

  mount() {
    window.addEventListener('resize', this.handleResize);
    this.handleResize();
  }

  setVisible(visible) {
    if (this.visible === visible) return;
    this.visible = visible;
    this.entrance?.kill();
    this.entrance = null;
    this.word.visible = visible;
    this.sequence.reset();
    if (visible && !reducedMotion) this.entrance = this.sequence.play();
    else if (visible) { this.sequence.paint(2.9); this.onRest?.(); }
    this.render();
  }

  setBand(top, bottom, left, right) {
    if (!(bottom > top) || !(right > left)) return;
    this.band = { top, bottom, left, right };
    this.handleResize();
  }

  handleResize() {
    const width = window.innerWidth, height = window.innerHeight;
    this.renderer.setSize(width, height, false);
    this.backdrop.material.uniforms.uAspect.value = width / height;
    this.camera.left = -width / 2; this.camera.right = width / 2;
    this.camera.top = height / 2; this.camera.bottom = -height / 2;
    this.camera.updateProjectionMatrix();
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
    this.render();
  }

  render() {
    if (this.disposed) return;
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.disposed = true;
    this.entrance?.kill();
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
