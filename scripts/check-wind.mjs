import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from 'three';
import WindField, { ambientWind } from '../src/webgl/hero/WindField.js';
import HatFlight from '../src/webgl/hero/HatFlight.js';

function sweep(dx, dy, frames = 8) {
  const field = new WindField();
  field.sample(100, 100, 0, 1440, 900);
  let peak = 0, bursts = 0;
  for (let i = 1; i <= frames + 180; i++) {
    if (i <= frames) field.sample(100 + dx * i, 100 + dy * i, i * 1000 / 60, 1440, 900);
    const wind = field.step(1 / 60);
    peak = Math.max(peak, wind.pressure); bursts += Number(wind.burst);
  }
  return { field, peak, bursts };
}
assert.equal(sweep(2, 0).bursts, 0, 'Gentle pointer movement never flips the hat');
assert.equal(sweep(60, 0).bursts, 1, 'One fast sweep produces one burst');
assert.equal(sweep(0, -60).bursts, 1, 'An upward sweep can also flip');
assert.ok(sweep(60, 0).peak > sweep(2, 0).peak * 10);
assert.ok(Math.abs(sweep(60, 0).field.x) < .001, 'Pressure dissipates after the mouse stops');
const entry = new WindField();
entry.sample(0, 0, 0, 1000, 800); entry.sample(900, 700, 1000, 1000, 800);
assert.equal(entry.step(1 / 60).pressure, 0, 'Re-entry never creates a teleport gust');
for (const [cycle, axis, sign] of [[0, 'x', 1], [1, 'y', 1], [2, 'x', -1], [3, 'y', -1]]) {
  assert.ok(ambientWind(cycle * 12.5 + 4.3)[axis] * sign > .1, 'Ambient gusts cover all four directions');
}

const listeners = new Map(), tickers = new Set();
const element = () => ({ style: {}, namespaceURI: 'http://www.w3.org/2000/svg', classList: { add() {} },
  setAttribute() {}, append() {}, remove() { this.removed = true; } });
const surface = { append() {}, addEventListener(name, callback) { listeners.set(name, callback); }, removeEventListener(name) { listeners.delete(name); } };
const document = { hidden: false, createElementNS: element };
const code = (await fs.readFile('src/webgl/hero/HatWind.js', 'utf8')).replace(/^import .*;\r?\n/gm, '').replace('export const ', 'const ').replace('export default class ', 'class ');
const Wind = vm.runInNewContext(`${code}\nHatWind`, { THREE, WindField, ambientWind, document,
  window: { innerWidth: 1000, innerHeight: 800 }, reducedMotion: false,
  gsap: { isTweening: () => false, ticker: { add: f => tickers.add(f), remove: f => tickers.delete(f) } } });
const word = new THREE.Group(), letters = Array.from({ length: 4 }, () => new THREE.Group());
letters.forEach((letter, i) => { letter.position.x = i * 60; word.add(letter); });
const hat = new THREE.Group(); hat.scale.setScalar(50); hat.position.set(8, 28, 0); letters[0].add(hat);
const uniforms = { uWind: { value: 0 }, uStorm: { value: 0 }, uWindTime: { value: 0 },
  uWindDirection: { value: new THREE.Vector3(1, 0, 0) }, uHatAnchor: { value: new THREE.Vector3(.1, .2, 0) } };
const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.ShaderMaterial({ uniforms })); hat.add(mesh);
const owner = { word, letters, bodies: [], capHeight: 70, canvas: { parentElement: surface },
  camera: new THREE.OrthographicCamera(-500, 500, 400, -400, .1, 2000), visible: true, atRest: true, render() {} };
owner.camera.position.z = 600; owner.camera.updateMatrixWorld();
owner.props = { owner, hat, hatMesh: mesh, hatRest: 28, addHatContactShade() {} };
const flight = owner.props.hatFlight = new HatFlight(owner.props);
const wind = new Wind(owner, hat, uniforms);
const reset = () => { wind.reset(); flight.reset(); };
const move = (x, y, time, extra = {}) => listeners.get('pointermove')?.({ clientX: x, clientY: y, timeStamp: time, pointerType: 'mouse', buttons: 0, ...extra });
try {
  assert.equal(listeners.size, 0, 'The hat has no mouse or hover listeners');
  for (const [dx, dy] of [[60, 0], [-60, 0], [0, -45], [0, 45]]) {
    reset();
    for (let i = 0; i < 30; i++) { move(500 + dx * i, 400 + dy * i, i * 1000 / 60); wind.tick(0, 1000 / 60); }
    assert.equal(flight.flight, null, 'Fast mouse movement cannot launch the hat');
    assert.equal(uniforms.uWind.value, 0, 'Mouse movement cannot generate brim pressure');
    assert.ok(hat.position.distanceTo(flight.home) < 1e-8, 'The hat stays seated during mouse movement');
  }
  reset(); wind.time = 41.8; flight.age = 20;
  wind.tick(0, 1000 / 60);
  assert.ok(flight.flight, 'Strong ambient weather still lifts the hat');
  const target = flight.flight.to;
  for (let i = 0; i < 270; i++) wind.tick(0, 1000 / 60);
  assert.equal(flight.flight, null); assert.equal(flight.current, target);
  const seat = flight.spots[target];
  const pinned = seat.anchor.clone().multiply(hat.scale).applyQuaternion(hat.quaternion).add(hat.position);
  assert.ok(pinned.distanceTo(seat.contact) < 1e-8, 'Ambient rocking maintains contact');
  assert.ok(Number(wind.svg.style.opacity) <= .34);
  reset(); wind.time = 4.3; wind.tick(0, 16);
  owner.offstage = true; const time = wind.time; wind.tick(0, 40);
  assert.equal(wind.time, time); assert.equal(uniforms.uWind.value, 0); assert.equal(wind.svg.style.opacity, '0');
  owner.offstage = false; document.hidden = true; wind.tick(0, 40); assert.equal(wind.time, time);
  document.hidden = false;
} finally {
  wind.dispose(); mesh.geometry.dispose(); mesh.material.dispose();
}
assert.equal(listeners.size, 0); assert.equal(tickers.size, 0); assert.equal(wind.svg.removed, true);
const QuietWind = vm.runInNewContext(`${code}\nHatWind`, { WindField, ambientWind, reducedMotion: true });
const quiet = new QuietWind(owner, hat, uniforms); quiet.dispose();
assert.equal(quiet.svg, undefined); assert.equal(listeners.size, 0);
console.log('Wind: mouse reactions disabled, ambient gusts/landing, fixed contact, pause, reduced motion and cleanup passed.');
