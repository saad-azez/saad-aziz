import * as THREE from 'three';
import gsap from 'gsap';

const clamp = value => Math.max(0, Math.min(1, value));
const smooth = (a, b, value) => { const t = clamp((value - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;

/** A bulge, a stretched neck, then a detached drop settling into a flat coin. */
export function liquidDotPose(progress, radius, base, rest, thickness) {
  const p = clamp(progress);
  const inflate = smooth(0, .30, p);
  const rise = smooth(.06, .57, p);
  const settle = smooth(.57, 1, p);
  const round = smooth(.28, .65, p);
  return {
    x: mix(.44, 1, inflate) * (1 - .18 * Math.sin(Math.PI * rise) * (1 - settle)),
    y: mix(.07, 1.28, inflate) - .28 * round,
    z: mix(radius * .56, thickness, smooth(.58, .98, p)),
    centre: mix(base + radius * .02, rest + radius * .70, rise) - radius * .70 * settle,
    flatten: smooth(.64, 1, p),
    neck: 1 - smooth(.31, .56, p),
    visible: p > 0 && p < 1,
  };
}

export default class LiquidDot {
  constructor(owner) {
    this.owner = owner;
    this.clock = { progress: 0 };
    this.complete = false;
    const dotBox = owner.dot.geometry.boundingBox;
    this.centre = dotBox.getCenter(new THREE.Vector3());
    this.radius = (dotBox.max.x - dotBox.min.x) / 2;
    this.thickness = (dotBox.max.z - dotBox.min.z) / 2;
    this.base = owner.bodies[4].geometry.boundingBox.max.y - .12;
    this.group = new THREE.Group();
    this.group.name = 'liquid-dot';
    owner.letters[4].add(this.group);
    this.bulb = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), owner.material);
    this.vertices = this.bulb.geometry.attributes.position.array.slice();
    this.neck = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 32, 32, true), owner.material);
    this.neck.geometry.translate(0, .5, 0);
    this.neckVertices = this.neck.geometry.attributes.position.array.slice();
    this.group.add(this.neck, this.bulb);
    this.reset();
  }

  apply() {
    const { radius: r, centre } = this;
    const p = this.clock.progress;
    this.setStem(smooth(0, .32, p));
    const stem = this.owner.bodies[4];
    const base = this.base * stem.scale.y + stem.position.y;
    const pose = liquidDotPose(p, r, base, centre.y, this.thickness);
    if (this.owner.iForm) pose.centre = Math.min(pose.centre, this.owner.iForm.top - r * pose.y);
    this.complete = p >= 1;
    this.group.visible = pose.visible && !this.owner.dotHidden;
    this.owner.dot.visible = this.complete && !this.owner.dotHidden && !this.owner.skillCoin;
    if (!pose.visible) return;
    this.bulb.position.set(centre.x, pose.centre, centre.z);
    this.bulb.scale.set(r * pose.x, r * pose.y, pose.z);
    const position = this.bulb.geometry.attributes.position;
    for (let i = 0; i < position.count; i++) {
      const x = this.vertices[i * 3], y = this.vertices[i * 3 + 1], z = this.vertices[i * 3 + 2];
      // Flatten the front/back of the liquid drop into the dot's coin faces.
      const flatZ = Math.sign(z) * Math.min(1, Math.abs(z) / .22);
      position.setXYZ(i, x, y, mix(z, flatZ, pose.flatten));
    }
    position.needsUpdate = true;
    this.bulb.geometry.computeVertexNormals();
    this.bulb.geometry.computeBoundingSphere();
    this.neck.visible = pose.neck > .001;
    if (this.neck.visible) {
      const top = Math.max(base + .01, pose.centre - r * pose.y * .65);
      const vertices = this.neck.geometry.attributes.position;
      for (let i = 0; i < vertices.count; i++) {
        const t = this.neckVertices[i * 3 + 1];
        const width = r * (.42 * (1 - t) ** 3 + pose.x * .76 * t ** 3 + .18 * Math.sin(Math.PI * t)) * pose.neck;
        vertices.setXYZ(i, centre.x + this.neckVertices[i * 3] * width,
          mix(base, top, t), centre.z + this.neckVertices[i * 3 + 2] * width * .65);
      }
      vertices.needsUpdate = true;
      this.neck.geometry.computeVertexNormals();
      this.neck.geometry.computeBoundingSphere();
    }
  }

  play() {
    this.reset();
    this.tween = gsap.to(this.clock, {
      progress: 1, duration: .98, ease: 'none',
      onUpdate: () => this.apply(), onComplete: () => this.finish(),
    });
    return this.tween;
  }

  syncVisibility() {
    this.owner.dot.visible = this.complete && !this.owner.dotHidden && !this.owner.skillCoin;
    this.group.visible = this.clock.progress > 0 && !this.complete && !this.owner.dotHidden;
  }

  reset() {
    this.tween?.kill();
    this.tween = null;
    this.clock.progress = 0;
    this.complete = false;
    this.setStem(0);
    this.owner.skillCoin?.reset();
    this.syncVisibility();
  }

  finish() {
    this.clock.progress = 1;
    this.complete = true;
    this.setStem(1);
    this.owner.dot.position.set(0, 0, 0);
    this.syncVisibility();
  }

  setStem(progress) {
    const form = this.owner.iForm;
    if (!form) return;
    const stem = this.owner.bodies[4];
    stem.scale.y = mix(form.capitalScale, 1, progress);
    stem.position.y = form.bottom * (1 - stem.scale.y);
  }

  dispose() {
    this.tween?.kill();
    this.bulb.geometry.dispose();
    this.neck.geometry.dispose();
    this.group.removeFromParent();
  }
}
