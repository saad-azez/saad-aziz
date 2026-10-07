import * as THREE from 'three';
import gsap from 'gsap';
import { reducedMotion } from '../../brand/motion.js';
import { skillSpinPose, skillFaces } from './skillSpin.js';
import { markCanvas, isDark, COIN_SKILLS as SKILLS } from '../coinMarks.js';

const smooth = t => t * t * (3 - 2 * t);

/**
 * The dot on the i as a coin turning through the tools, each face the tool's
 * official mark in its own colours — the same drawing (coinMarks.js) the stage's
 * coin wears, so when the stage takes the dot over, nothing changes.
 */
export default class SkillCoin {
  constructor(owner) {
    this.owner = owner;
    this.elapsed = 0;
    this.group = new THREE.Group();
    this.group.name = 'skill-coin';
    this.rotor = new THREE.Group();
    this.group.add(this.rotor);
    owner.letters[4].add(this.group);
    const { centre, radius, thickness } = owner.liquidDot;
    this.centre = centre;
    this.thickness = thickness;
    this.body = new THREE.Mesh(owner.dot.geometry.clone().translate(-centre.x, -centre.y, -centre.z), owner.material);
    this.rotor.add(this.body);
    this.marks = SKILLS.map(name => ({ name }));
    this.textures = new Map();
    this.faces = [0, 1].map(side => {
      const material = new THREE.MeshBasicMaterial({
        transparent: true, depthWrite: false, opacity: 0, toneMapped: false,
        // Always in front of the dot's own face: the mark never flickers against it.
        polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
      });
      const mesh = new THREE.Mesh(new THREE.CircleGeometry(radius * .97, 128), material);
      mesh.position.z = (side ? -1 : 1) * (thickness + .04);
      mesh.rotation.y = side * Math.PI;
      mesh.renderOrder = 1;
      this.rotor.add(mesh);
      return mesh;
    });
    this.tick = (_, delta) => {
      if (reducedMotion || !owner.visible || owner.offstage || owner.dotHidden || !owner.liquidDot.complete || document.hidden) return;
      const before = skillSpinPose(this.elapsed, this.marks.length);
      this.elapsed += Math.min(delta, 40) / 1000;
      const after = skillSpinPose(this.elapsed, this.marks.length);
      if (before.angle !== after.angle) owner.render();
    };
    this.reset();
    gsap.ticker.add(this.tick);
  }

  sync() {
    const liquid = this.owner.liquidDot;
    const progress = liquid.clock.progress;
    this.group.visible = progress > .7 && !this.owner.dotHidden;
    if (!this.group.visible) return;
    this.body.visible = liquid.complete;
    this.group.position.copy(liquid.complete ? this.centre : liquid.bulb.position);
    const opacity = smooth(Math.min(1, Math.max(0, (progress - .7) / .24)));
    const pose = skillSpinPose(this.elapsed, this.marks.length);
    this.rotor.rotation.y = pose.angle;
    skillFaces(pose.angle, this.marks.length).forEach((skill, side) => this.show(this.faces[side], this.marks[skill].name, opacity));
    const faceDepth = liquid.complete ? this.thickness : liquid.bulb.scale.z;
    this.faces.forEach((face, side) => { face.position.z = (side ? -1 : 1) * (faceDepth + .04); });
  }

  /** The tool's face, in the version made for the dot's colour. */
  texture(name) {
    const dark = isDark(this.owner.palette.figure);
    const key = `${name}|${dark}`;
    if (!this.textures.has(key)) {
      const texture = new THREE.CanvasTexture(markCanvas(name, dark));
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 4;
      this.textures.set(key, texture);
      markCanvas(name, dark, () => { texture.needsUpdate = true; this.owner.render?.(); });
    }
    return this.textures.get(key);
  }

  show(face, name, opacity) {
    face.userData.name = name;
    face.material.opacity = opacity;
    const map = this.texture(name);
    if (face.material.map !== map) { face.material.map = map; face.material.needsUpdate = true; }
  }

  /**
   * Where the coin is, for the stage taking it over: its turn, and how the
   * pointer's parallax has the reader looking at it (the orbit's yaw and pitch,
   * in radians), so the stage's coin starts at exactly the same angle.
   */
  snapshot() {
    return {
      angle: this.rotor.rotation.y,
      tools: this.faces.map(face => face.userData.name),
      view: this.owner.parallax?.view() ?? { yaw: 0, pitch: 0 },
    };
  }

  /** A new scheme may want the other version of a mark; the faces pick theirs on the next sync. */
  paint() { this.sync?.(); }
  /** Each visit the dot starts on a different tool: none of them is the first. */
  reset() {
    this.elapsed = Math.floor(Math.random() * SKILLS.length) * 3;
    this.group.visible = false;
    this.rotor.rotation.y = 0;
  }
  dispose() {
    gsap.ticker.remove(this.tick);
    this.body.geometry.dispose();
    this.faces.forEach(face => { face.geometry.dispose(); face.material.dispose(); });
    this.textures.forEach(texture => texture.dispose());
    this.group.removeFromParent();
  }
}
