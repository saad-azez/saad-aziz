// The rolodex under the hand: every landing is one spring that runs a little
// past and settles back, and a flick comes to rest on a whole project.
//   npm run check:leaf
import assert from 'node:assert/strict';
import { LEAF, landing, stepSpring } from '../src/webgl/stage/leafMotion.js';

// A flip by hand: from rest, one project on.
const state = { at: 0, velocity: 0 };
let peak = 0, time = 0, settled = false;
while (!settled && time < 4) { settled = stepSpring(state, 1, 1 / 60); peak = Math.max(peak, state.at); time += 1 / 60; }
assert.ok(settled, 'It comes to rest');
assert.equal(state.at, 1, 'Exactly on the project');
assert.ok(peak > 1.05 && peak < 1.2, `It runs a little past, and only a little (${peak.toFixed(3)})`);
assert.ok(time < 1.6, `It settles in good time (${time.toFixed(2)} s)`);

// A slow frame does not throw it.
const slow = { at: 0, velocity: 0 };
for (let i = 0; i < 20; i++) stepSpring(slow, 1, .25);
assert.ok(Math.abs(slow.at - 1) < 1e-3, 'Even at 4 frames a second');

// Flicks land on whole projects, the harder the further, and no further than reach.
assert.equal(landing(0, 0), 0);
assert.equal(landing(.4, 0), 0);
assert.equal(landing(0, 6), Math.round(6 * LEAF.coast));
assert.ok(landing(0, 20) > landing(0, 6), 'A harder flick turns it further');
assert.equal(landing(0, 1e6), LEAF.reach);
assert.equal(landing(0, -1e6), -LEAF.reach);
assert.ok(Number.isInteger(landing(2.3, 3.7)));

console.log(`Rolodex motion: flips run ${((peak - 1) * 100).toFixed(0)}% past and settle in ${time.toFixed(2)} s; flicks land on whole projects.`);
