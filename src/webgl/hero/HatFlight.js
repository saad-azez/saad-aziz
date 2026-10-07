import * as THREE from 'three';

// Contact poses measured against straw_hat.glb and the SAADi font at cap 70.
// Keep these authored seats cached: ray-casting every triangle during a gust
// would introduce a visible main-thread pause just before take-off.
export const HAT_SEATS = [
  { position: [1.64294531695878, 19.75559327824076, 0], rotation: [.16, .12, .08], contact: [-10.49930583106147, 34.97196253180437, -2.799999809265137], width: 58.150001525878906 },
  { position: [1.64294531695878, 23.41794267287803, 0], rotation: [.16, -.1, -.08], contact: [-9.69166692097982, 34.97196253180437, -2.799999809265137], width: 58.150001525878906 },
  { position: [-4.22124912943158, 30.27594366735101, 0], rotation: [.16, .12, -.08], contact: [9.56333541870117, 32.43721753923368, 2.799999809265137], width: 57.38001251220703 },
];

const smooth = t => { t = THREE.MathUtils.clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const pivot = new THREE.Vector3(0, .19, 0);

/** Land on measured surfaces; all airborne turns pivot around the hat's centre. */
export default class HatFlight {
  constructor(props) {
    this.props = props;
    this.hat = props.hat;
    this.owner = props.owner;
    this.home = this.hat.position.clone();
    this.homeRotation = this.hat.rotation.clone();
    this.current = 0;
    this.age = 0;
    this.next = 19;
    this.rearm = 0;
    this.seated = true;
    this.intensity = 0;
    const contact = props.hatContact?.point.clone() ?? pivot.clone().multiply(this.hat.scale).applyEuler(this.homeRotation).add(this.home);
    this.spots = [this.seat(this.home, this.homeRotation, contact)];
  }

  seat(position, rotation, contact) {
    const matrix = new THREE.Matrix4().compose(position, new THREE.Quaternion().setFromEuler(rotation), this.hat.scale);
    return { position: position.clone(), rotation: rotation.clone(), contact: contact.clone(), anchor: contact.clone().applyMatrix4(matrix.invert()) };
  }

  prepare() {
    if (this.spots.length > 1) return;
    const unit = this.owner.capHeight / 70;
    for (const index of [1, 2, 3]) {
      const seat = HAT_SEATS[index - 1];
      const offset = this.owner.letters[index].position.clone().sub(this.owner.letters[0].position);
      const position = new THREE.Vector3().fromArray(seat.position).multiplyScalar(unit).add(offset);
      const rotation = new THREE.Euler().fromArray(seat.rotation);
      const contact = { point: new THREE.Vector3().fromArray(seat.contact).multiplyScalar(unit), width: seat.width * unit };
      this.spots.push(this.seat(position, rotation, contact.point.clone().add(offset)));
      this.props.addHatContactShade(this.owner.bodies[index], contact, index);
    }
  }

  step(dt, wind) {
    const input = typeof wind === 'number' ? { pressure: wind, pointerPressure: 0, directionX: 1, directionY: 0 } : wind;
    this.age += dt;
    const flick = input.burst && this.age >= this.rearm;
    const weather = this.age >= this.next && input.pointerPressure < .1 && input.pressure > .55;
    if (!this.flight && (flick || weather)) {
      this.prepare();
      let destination;
      if (flick) {
        // Vertical sweeps flip in place; lateral sweeps carry it to a neighbour.
        destination = Math.abs(input.directionX) < .55 ? this.current
          : THREE.MathUtils.clamp(this.current + Math.sign(input.directionX), 0, 3);
      } else {
        const choices = this.current === 0 ? [1, 2] : this.current === 3 ? [1, 2] : [0, 3];
        destination = choices[Math.floor(Math.random() * choices.length)];
      }
      this.flight = { from: this.current, to: destination, time: 0, flip: flick ? (input.directionY < -.3 ? 1 : -1) * Math.PI * 2 : 0,
        power: input.pressure, dx: input.directionX, dy: input.directionY, duration: flick ? 2.25 : 2.6,
        launch: this.hat.quaternion.clone() };
      this.seated = false;
      this.rearm = this.age + 7;
    }
    if (!this.flight) { this.intensity = 0; return false; }
    const flight = this.flight;
    flight.time += dt;
    const source = this.spots[flight.from], target = this.spots[flight.to];
    const duration = flight.duration ?? 2.6, anticipation = .35, end = anticipation + duration;
    const flip = flight.flip ?? 0;
    const lift = this.owner.capHeight * (flip ? .50 : .38);
    const phase = flight.time, p = this.hat.position, r = this.hat.rotation;
    this.intensity = (flight.power ?? .65) * (phase < end ? 1 : Math.exp(-(phase - end) * 3));
    if (phase < anticipation) {
      // Brim pressure provides the anticipation while the crown keeps its seat.
      this.hat.quaternion.copy(flight.launch ?? new THREE.Quaternion().setFromEuler(source.rotation))
        .slerp(new THREE.Quaternion().setFromEuler(source.rotation), smooth(phase / anticipation));
      p.copy(source.contact).sub(source.anchor.clone().multiply(this.hat.scale).applyQuaternion(this.hat.quaternion));
    } else if (phase < end) {
      const t = (phase - anticipation) / duration;
      const travel = smooth(t), turn = smooth((t - .22) / .56);
      const envelope = Math.sin(Math.PI * t);
      r.set(
        THREE.MathUtils.lerp(source.rotation.x, target.rotation.x, travel) + flip * turn + envelope * .14,
        THREE.MathUtils.lerp(source.rotation.y, target.rotation.y, travel) + Math.sin(Math.PI * t * 2) * .16,
        THREE.MathUtils.lerp(source.rotation.z, target.rotation.z, travel) - Math.sin(Math.PI * t * 2) * .18 * (flight.dx ?? 1),
      );
      const centre = pivot.clone().multiply(this.hat.scale).applyEuler(source.rotation).add(source.position);
      const arrival = pivot.clone().multiply(this.hat.scale).applyEuler(target.rotation).add(target.position);
      centre.lerp(arrival, travel);
      centre.y += envelope * lift;
      centre.z += envelope * (flip ? 12 : 7);
      // A vertical gust still has a little sideways personality, but always returns.
      if (flight.from === flight.to) centre.x += Math.sin(Math.PI * t * 2) * 3 * (flight.dx ?? .3);
      p.copy(centre).sub(pivot.clone().multiply(this.hat.scale).applyEuler(r));
    } else {
      const t = phase - end;
      p.copy(target.position);
      p.y += Math.abs(Math.sin(t * 10)) * Math.exp(-t * 6) * (flip ? 1.5 : 1.1);
      r.copy(target.rotation);
      r.z += Math.sin(t * 12) * Math.exp(-t * 5) * .055;
      if (t >= 1.1) {
        p.copy(target.position); r.copy(target.rotation);
        this.current = flight.to;
        this.flight = null;
        this.seated = true;
        this.intensity = 0;
        this.next = this.age + 23 + Math.random() * 8;
      }
    }
    return true;
  }

  rock(wind) {
    if (this.flight) return;
    const spot = this.spots[this.current];
    const tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(
      wind.directionY * wind.pressure * .012,
      0,
      -wind.directionX * wind.pressure * .015,
    ));
    this.hat.quaternion.setFromEuler(spot.rotation).multiply(tilt);
    this.hat.position.copy(spot.contact).sub(spot.anchor.clone().multiply(this.hat.scale).applyQuaternion(this.hat.quaternion));
    this.props.hatMesh.material.uniforms?.uHatAnchor?.value.copy(spot.anchor);
  }

  reset() {
    this.hat.position.copy(this.home);
    this.hat.rotation.copy(this.homeRotation);
    this.flight = null; this.current = 0; this.age = 0; this.next = 19; this.rearm = 0; this.seated = true; this.intensity = 0;
    this.props.hatMesh.material.uniforms?.uHatAnchor?.value.copy(this.spots[0].anchor);
  }
}
