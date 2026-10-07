const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));

/** Screen-space wind: +x right, +y up. Pointer speed is viewport-normalized. */
export default class WindField {
  constructor() {
    this.time = 0;
    this.cooldown = 0;
    this.clear();
  }

  clear() {
    this.previous = null;
    this.targetX = this.targetY = this.x = this.y = 0;
    this.charge = 0;
  }

  leave() {
    this.previous = null;
  }

  sample(x, y, milliseconds, width, height) {
    if (![x, y, milliseconds, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return;
    const before = this.previous;
    this.previous = { x, y, milliseconds };
    if (!before) return;
    const elapsed = (milliseconds - before.milliseconds) / 1000;
    // A re-entry or a delayed pointer event must not masquerade as a flick.
    if (elapsed <= 0 || elapsed > .16) return;
    const dt = Math.max(.002, elapsed);
    const dx = (x - before.x) / width, dy = (before.y - y) / height;
    const speed = Math.hypot(dx, dy) / dt;
    if (speed < .015) return;
    const pressure = Math.min(1.55, speed * .62);
    const distance = Math.hypot(dx, dy);
    const blend = 1 - Math.exp(-dt * 28);
    this.targetX += (dx / distance * pressure - this.targetX) * blend;
    this.targetY += (dy / distance * pressure - this.targetY) * blend;
  }

  step(seconds, ambient = { x: 0, y: 0 }) {
    const dt = clamp(seconds, 0, .05);
    this.time += dt;
    this.cooldown = Math.max(0, this.cooldown - dt);
    const follow = 1 - Math.exp(-dt * 9);
    this.x += (this.targetX - this.x) * follow;
    this.y += (this.targetY - this.y) * follow;
    this.targetX *= Math.exp(-dt * 3.2);
    this.targetY *= Math.exp(-dt * 3.2);
    const pointerPressure = Math.hypot(this.x, this.y);
    this.charge = Math.max(0, this.charge + (pointerPressure > .7 ? pointerPressure - .7 : -.35) * dt);
    const burst = this.cooldown === 0 && this.charge > .025;
    if (burst) { this.cooldown = 7; this.charge = 0; }
    const x = this.x + ambient.x, y = this.y + ambient.y;
    const pressure = Math.min(1.55, Math.hypot(x, y));
    return { x, y, pressure, burst, pointerPressure,
      directionX: pressure > .0001 ? x / Math.hypot(x, y) : 1,
      directionY: pressure > .0001 ? y / Math.hypot(x, y) : 0 };
  }
}

/** Mostly quiet weather; every fourth gust has enough pressure for a lift. */
export function ambientWind(time) {
  const cycle = Math.floor(time / 12.5);
  const t = clamp(((time % 12.5) - 2) / 4.6, 0, 1);
  const strength = Math.sin(Math.PI * t) ** 2 * (cycle % 4 === 3 ? .78 : .22);
  const angle = [0, Math.PI / 2, Math.PI, -Math.PI / 2, Math.PI / 4, -Math.PI * .75][cycle % 6];
  return { t, strength, x: Math.cos(angle) * strength, y: Math.sin(angle) * strength };
}
