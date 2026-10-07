/** Hold each mark face-on, then make one smooth half-turn to the next skill. */
export function skillSpinPose(seconds, count) {
  const step = Math.floor(seconds / 3);
  const turn = Math.max(0, Math.min(1, (seconds % 3 - 2.2) / .8));
  const eased = turn * turn * (3 - 2 * turn);
  return { angle: (step + eased) * Math.PI, step, current: step % count, next: (step + 1) % count };
}

/**
 * Which skill each side of a coin turned to `angle` wears, as indices into the
 * skills. Between n and n + 1 half-turns, the side that faced the reader at n
 * shows skill n and the other side skill n + 1; a side only takes a new skill
 * while it faces away. Both coins (the hero's dot and the stage's) use this one
 * rule, so a coin handed over at any angle wears the same faces, and turning it
 * further, either way, carries on through the same sequence.
 */
export function skillFaces(angle, count) {
  const n = Math.floor(angle / Math.PI + 1e-6);
  const wrap = (i, m) => ((i % m) + m) % m;
  const faces = [];
  faces[wrap(n, 2)] = wrap(n, count);
  faces[wrap(n + 1, 2)] = wrap(n + 1, count);
  return faces;
}
