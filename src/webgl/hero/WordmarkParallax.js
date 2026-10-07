import * as THREE from 'three';

const clamp = THREE.MathUtils.clamp;
const axis = () => ({ position: 0, velocity: 0 });
/** The farthest the camera orbits, in radians, with the pointer at the canvas edge. */
const REACH = { yaw: .18, pitch: .085 };

function spring(state, target, dt, frequency, damping) {
  // Small integration steps keep mouse flicks stable at 30–144 Hz.
  const steps = Math.max(1, Math.ceil(dt * 120)), h = dt / steps;
  for (let i = 0; i < steps; i++) {
    state.velocity += ((target - state.position) * frequency ** 2 - 2 * damping * frequency * state.velocity) * h;
    state.position += state.velocity * h;
  }
  if (Math.abs(state.position - target) < .00002 && Math.abs(state.velocity) < .0001) {
    state.position = target; state.velocity = 0;
  }
}

/** A restrained camera orbit; the lettering and its attachments never move. */
export default class WordmarkParallax {
  constructor(baseCamera) {
    this.baseCamera = baseCamera;
    this.camera = new THREE.PerspectiveCamera();
    this.reset();
  }

  reset() {
    this.turn = [axis(), axis()];
  }

  step(aim, milliseconds, active = true) {
    const dt = clamp(milliseconds / 1000, 0, .05);
    const previous = this.turn.map(state => state.position);
    const targets = [aim.x, aim.y].map(value => active ? clamp(value, -1, 1) : 0);
    for (let i = 0; i < 2; i++) {
      spring(this.turn[i], targets[i], dt, 10, 1);
    }
    return this.turn.some((state, i) => state.position !== previous[i]);
  }

  /** How far the camera has orbited round the word just now, in radians. */
  view() {
    return { yaw: this.turn[0].position * REACH.yaw, pitch: this.turn[1].position * REACH.pitch };
  }

  update(target) {
    const base = this.baseCamera, camera = this.camera;
    base.updateMatrixWorld(true);
    const distance = Math.max(1, base.position.distanceTo(target));
    const offset = base.position.clone().sub(target).applyQuaternion(base.quaternion.clone().invert());
    const { yaw, pitch } = this.view();
    offset.applyEuler(new THREE.Euler(-pitch, yaw, 0, 'YXZ'));
    camera.position.copy(target).add(offset.applyQuaternion(base.quaternion));
    camera.up.copy(base.up);
    camera.lookAt(target);
    // Match the authored framing at the word's centre, with real perspective at its edges.
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan((base.top - base.bottom) / (2 * distance * base.zoom)));
    camera.aspect = (base.right - base.left) / (base.top - base.bottom);
    camera.near = base.near; camera.far = base.far;
    camera.updateProjectionMatrix();
    camera.projectionMatrix.elements[8] = -base.projectionMatrix.elements[12];
    camera.projectionMatrix.elements[9] = -base.projectionMatrix.elements[13];
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    camera.updateMatrixWorld(true);
    return camera;
  }
}
