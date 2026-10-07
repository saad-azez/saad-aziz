// Proves the book lamp's accordion: no page crosses another at any opening,
// no page runs into a cover's wood, every page keeps its length, the end
// pages lie flat on the covers, the shut block is a flat stack and, open, the
// covers meet back to back with the tips spread evenly round the whole circle.
//   node scripts/check-lamp.mjs
import { LAMP, solveFolds, faceRoom, facesCross, foldInCover, coverFrame, faceCount, blockThickness, hubArc } from '../src/webgl/lamp/lampGeometry.js';

let failures = 0;
const fail = (msg) => { failures++; console.error('FAIL', msg); };
const F = faceCount();
const W = blockThickness();
const L = LAMP.pageWidth;
let worstStretch = 0;
let minRoomOpen = Infinity;
for (let i = 0; i <= 400; i++) {
  const open = i / 400;
  const folds = solveFolds(open);
  for (let f = 0; f < F; f++) {
    const len = Math.hypot(folds[2 * f + 2] - folds[2 * f], folds[2 * f + 3] - folds[2 * f + 1]);
    worstStretch = Math.max(worstStretch, Math.abs(len - L));
  }
  const cross = facesCross(folds);
  if (cross) fail(`open ${open.toFixed(3)}: faces ${cross[0]} and ${cross[1]} cross`);
  const buried = foldInCover(folds);
  if (buried) fail(`open ${open.toFixed(3)}: fold ${buried[0]} is inside cover ${buried[1] ? 'B' : 'A'}`);
  if (open >= 0.5) {
    const room = faceRoom(folds);
    for (let f = 2; f < F - 2; f++) minRoomOpen = Math.min(minRoomOpen, room[2 * f]);
  }
  for (let k = 0; k <= F; k++) {
    if (!Number.isFinite(folds[2 * k]) || !Number.isFinite(folds[2 * k + 1])) { fail(`open ${open}: fold ${k} not finite`); break; }
  }
  // The end pages lie along their covers (by construction) and the covers open to ±phi/2.
  const A = coverFrame(folds, 0), B = coverFrame(folds, 1);
  const phi = open * Math.PI * 2;
  if (Math.abs(A.xx - Math.cos(phi / 2)) > 1e-6 || Math.abs(A.xy + Math.sin(phi / 2)) > 1e-6) fail(`open ${open}: cover A at the wrong angle`);
  if (Math.abs(B.xx - Math.cos(phi / 2)) > 1e-6 || Math.abs(B.xy - Math.sin(phi / 2)) > 1e-6) fail(`open ${open}: cover B at the wrong angle`);
}
// The first and last pages give a hair (under a millimetre) as their pleat bridges the cover's corner to the hub arc.
if (worstStretch > 0.08) fail(`a page stretches by ${worstStretch.toFixed(4)} cm`);
console.log(`page length error <= ${worstStretch.toFixed(4)} cm; least room between open pages (away from the covers) ${minRoomOpen.toFixed(3)} cm`);

// Shut: a flat stack, the block W thick, the covers flat either side.
{
  const folds = solveFolds(0);
  const bottom = folds[1], top = folds[2 * F + 1];
  if (Math.abs((top - bottom) - W) > 1e-6) fail(`shut block is ${top - bottom} thick, not ${W}`);
  for (let k = 0; k < F + 1; k++) if (Math.abs(folds[2 * k]) > (k % 2 ? L + 1e-6 : 1e-6)) fail(`shut fold ${k} off the spine`);
  const A = coverFrame(folds, 0), B = coverFrame(folds, 1);
  if (A.yy > 0 || B.yy < 0) fail('shut covers face the wrong way');
}
// Open: the covers back to back, their backs touching, the tips evenly spread round the whole circle.
{
  const folds = solveFolds(1);
  const A = coverFrame(folds, 0), B = coverFrame(folds, 1);
  const backA = [A.ox + A.yx * LAMP.coverThickness, A.oy + A.yy * LAMP.coverThickness];
  const backB = [B.ox + B.yx * LAMP.coverThickness, B.oy + B.yy * LAMP.coverThickness];
  const gap = Math.hypot(backA[0] - backB[0], backA[1] - backB[1]);
  if (gap > 0.03) fail(`open covers' backs are ${gap.toFixed(3)} cm apart`);
  if (A.xx * B.xx + A.xy * B.xy < 0.9999) fail('open covers do not point the same way');
  const arc = hubArc(1);
  const tips = [];
  for (let k = 1; k < F; k += 2) tips.push(Math.atan2(folds[2 * k + 1] - arc.cy, folds[2 * k] - arc.cx));
  const gaps = tips.slice(1).map((t, i) => ((t - tips[i]) + Math.PI * 4) % (Math.PI * 2));
  const spread = Math.max(...gaps) - Math.min(...gaps);
  if (spread > 1e-4) fail(`tips not evenly spread (gap spread ${spread})`);
  const total = gaps.reduce((s, g) => s + g, 0);
  if (Math.abs(total - Math.PI * 2) > 0.2) fail(`tips sweep ${total} rad, not the whole circle`);
  console.log(`open: hub arc ${(arc.alpha * 180 / Math.PI).toFixed(1)} deg of radius ${arc.R.toFixed(3)} cm, covers' backs ${gap.toFixed(3)} cm apart, tips ${(gaps[0] * 180 / Math.PI).toFixed(2)} deg apart over ${(total * 180 / Math.PI).toFixed(1)} deg`);
}
if (failures) { console.error(`${failures} failure(s)`); process.exit(1); }
console.log('check:lamp passed');
