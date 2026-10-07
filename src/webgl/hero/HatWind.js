import * as THREE from 'three';
import gsap from 'gsap';
import { reducedMotion } from '../../brand/motion.js';
import WindField, { ambientWind } from './WindField.js';
import { viewHeight } from '../../lib/viewport.js';

export const hatGust = ambientWind;

/** Ambient wind moves the hat independently of mouse interaction. */
export default class HatWind {
  constructor(owner, hat, uniforms) {
    this.owner = owner;
    this.hat = hat;
    this.uniforms = uniforms;
    this.time = 0;
    this.angle = 0;
    this.field = new WindField();
    if (reducedMotion) return;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 320 130');
    svg.setAttribute('aria-hidden', 'true');
    svg.classList.add('hero__wind');
    const strokes = [
      'M 4,54 C 51,54 63,32 103,36 S 168,55 194,35 S 250,24 305,29',
      'M 16,82 C 52,89 80,64 114,66 S 174,85 211,67 S 265,51 314,58',
      'M 60,106 C 103,106 110,87 145,91 S 207,109 242,88 C 267,72 249,59 236,68',
    ];
    this.paths = strokes.map(d => {
      const path = document.createElementNS(svg.namespaceURI, 'path');
      path.setAttribute('d', d); path.setAttribute('pathLength', '1');
      svg.append(path); return path;
    });
    this.surface = owner.canvas.parentElement;
    this.surface.append(svg);
    this.svg = svg;
    this.tick = this.tick.bind(this);
    gsap.ticker.add(this.tick);
    this.ticking = true;
  }

  awake() {
    return this.hat.visible && this.owner.visible && this.owner.atRest && !this.owner.offstage
      && !this.owner.dotHidden && !document.hidden;
  }

  tick(_, deltaMs) {
    const { owner, hat, uniforms } = this;
    const flight = owner.props.hatFlight;
    if (!this.awake() || gsap.isTweening(hat.position) || gsap.isTweening(hat.rotation)) {
      this.svg.style.opacity = '0';
      this.field.clear();
      if (uniforms.uWind.value) { uniforms.uWind.value = 0; uniforms.uStorm.value = 0; owner.render(); }
      return;
    }
    const dt = Math.min(deltaMs || 16, 50) / 1000;
    this.time += dt;
    const wind = this.field.step(dt, ambientWind(this.time));
    const moving = flight?.step(dt, wind);
    // Keep the launch gust's heading as the weather eases during a flight.
    const airborne = flight?.flight;
    const retainHeading = airborne && wind.pressure < flight.intensity * .3;
    const directionX = retainHeading ? airborne.dx : wind.directionX;
    const directionY = retainHeading ? airborne.dy : wind.directionY;
    const camera = owner.updateViewCamera?.() ?? owner.camera;
    const worldDirection = new THREE.Vector3(directionX, directionY, 0).applyQuaternion(camera.quaternion);
    const inverse = new THREE.Quaternion();
    if (!flight?.flight) {
      hat.parent.getWorldQuaternion(inverse).invert();
      const direction = worldDirection.clone().applyQuaternion(inverse);
      flight?.rock({ ...wind, directionX: direction.x, directionY: direction.y });
    }
    hat.updateWorldMatrix(true, false);
    hat.getWorldQuaternion(inverse).invert();
    uniforms.uWindDirection.value.copy(worldDirection).applyQuaternion(inverse).normalize();
    const was = uniforms.uWind.value;
    const pressure = Math.max(wind.pressure, flight?.intensity ?? 0);
    uniforms.uWind.value = pressure;
    uniforms.uStorm.value = THREE.MathUtils.smoothstep(pressure, .5, 1.25);
    uniforms.uWindTime.value = this.time;
    this.svg.style.opacity = String(Math.min(.34, pressure * .24));
    if (pressure > .005) {
      const project = point => point.applyMatrix4(hat.matrixWorld).project(camera);
      const centre = project(new THREE.Vector3(0, .16, 0));
      const left = project(new THREE.Vector3(-.5, .12, 0));
      const right = project(new THREE.Vector3(.5, .12, 0));
      const width = Math.max(100, Math.min(400, Math.hypot((right.x - left.x) * window.innerWidth, (right.y - left.y) * viewHeight())));
      const height = width * 130 / 320;
      const desired = Math.atan2(-directionY, directionX);
      this.angle += Math.atan2(Math.sin(desired - this.angle), Math.cos(desired - this.angle)) * (1 - Math.exp(-dt * 8));
      this.svg.style.width = `${width}px`;
      this.svg.style.height = `${height}px`;
      this.svg.style.transform = `translate3d(${(centre.x + 1) * window.innerWidth / 2 - width * .5}px, ${(1 - centre.y) * viewHeight() / 2 - height * .5}px, 0) rotate(${this.angle}rad)`;
      this.paths.forEach((path, i) => {
        const local = (this.time * (.24 + pressure * .3) + i * .24) % 1;
        path.style.strokeDashoffset = String(1 - local * 1.5);
        path.style.opacity = String(Math.sin(Math.PI * local) ** 2);
      });
    }
    if (moving || pressure > .001 || was > .001) owner.render();
  }

  reset() {
    this.field.clear(); this.field.cooldown = 0;
    this.time = 0; this.angle = 0;
    this.uniforms.uWind.value = 0;
    this.uniforms.uStorm.value = 0;
    if (this.svg) this.svg.style.opacity = '0';
  }

  dispose() {
    if (this.ticking) gsap.ticker.remove(this.tick);
    this.ticking = false;
    this.svg?.remove();
  }
}
