/**
 * How the book moves under the hand: like a real one, with weight.
 *
 * `at` is where it is, in projects (Book.update); `velocity` in projects a
 * second. A flick carries on, slowing as it goes, and the book comes to rest
 * on the project it would have stopped nearest; every landing (a flick, a flip
 * by hand, a key) is one spring, so it runs a little past and settles back.
 */
export const LEAF = {
  /** The spring's stiffness (rad/s) and damping ratio: about an eighth past the page, then back, in under a second. */
  omega: 9,
  zeta: .55,
  /** How far a flick carries: its speed times this, in seconds. */
  coast: .32,
  /** The most pages one flick can turn. */
  reach: 12,
};

/** The project a book at `at`, moving at `velocity`, comes to rest on. */
export function landing(at, velocity) {
  const carry = Math.max(-LEAF.reach, Math.min(LEAF.reach, velocity * LEAF.coast));
  return Math.round(at + carry);
}

/**
 * One step of the spring toward `target` over `dt` seconds, in small steps so a
 * slow frame never throws it. Changes `state` ({ at, velocity }); returns true
 * once it has come to rest there.
 */
export function stepSpring(state, target, dt) {
  const { omega, zeta } = LEAF;
  const steps = Math.max(1, Math.ceil(dt * 240)), h = dt / steps;
  for (let i = 0; i < steps; i++) {
    const acceleration = omega * omega * (target - state.at) - 2 * zeta * omega * state.velocity;
    state.velocity += acceleration * h;
    state.at += state.velocity * h;
  }
  if (Math.abs(target - state.at) < 5e-4 && Math.abs(state.velocity) < 5e-3) {
    state.at = target;
    state.velocity = 0;
    return true;
  }
  return false;
}
