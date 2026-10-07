import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { WORDMARK } from '../src/webgl/hero/wordmark.paths.js';
import { fitHatToLetter } from '../src/webgl/hero/hatFit.js';
import HatFlight, { HAT_SEATS } from '../src/webgl/hero/HatFlight.js';

// Decode the actual supplied models without requiring a browser image decoder.
async function model(path) {
  const bytes = await fs.readFile(path), length = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + length)), bin = 28 + length;
  const root = new THREE.Group(), map = new THREE.Texture();
  for (const node of json.nodes) {
    if (node.mesh === undefined) continue;
    const primitive = json.meshes[node.mesh].primitives[0], geometry = new THREE.BufferGeometry();
    for (const [name, index] of Object.entries(primitive.attributes)) {
      const a = json.accessors[index], v = json.bufferViews[a.bufferView], size = { VEC3: 3, VEC2: 2 }[a.type];
      const array = new Float32Array(a.count * size);
      for (let i = 0; i < array.length; i++) array[i] = bytes.readFloatLE(bin + (v.byteOffset ?? 0) + (a.byteOffset ?? 0) + i * 4);
      geometry.setAttribute({ POSITION: 'position', NORMAL: 'normal', TEXCOORD_0: 'uv' }[name], new THREE.BufferAttribute(array, size));
    }
    const a = json.accessors[primitive.indices], v = json.bufferViews[a.bufferView], indices = [];
    for (let i = 0; i < a.count; i++) indices.push(bytes.readUInt16LE(bin + (v.byteOffset ?? 0) + (a.byteOffset ?? 0) + i * 2));
    geometry.setIndex(indices);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map }));
    if (node.translation) mesh.position.fromArray(node.translation);
    mesh.name = node.name; root.add(mesh);
  }
  return { scene: root };
}
const font = new FontLoader().parse(JSON.parse(await fs.readFile('src/webgl/hero/saadi.typeface.json')));
const word = new THREE.Group(), bodies = [], letters = [];
let cursor = 0;
for (const letter of WORDMARK.letters) {
  const geometry = new THREE.ExtrudeGeometry(font.generateShapes(letter.fontChar, WORDMARK.fontSize), {
    depth: 5, bevelEnabled: true, bevelThickness: .45, bevelSize: .06, bevelSegments: 3, curveSegments: 36,
  });
  geometry.translate(0, 0, -2.5); geometry.computeBoundingBox();
  const centre = geometry.boundingBox.getCenter(new THREE.Vector3());
  geometry.translate(-centre.x, -centre.y, -centre.z); geometry.computeBoundingBox();
  const body = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial()), glyph = new THREE.Group();
  glyph.add(body); glyph.userData.centre = centre;
  glyph.position.set(cursor - geometry.boundingBox.min.x, centre.y, 0);
  cursor += geometry.boundingBox.max.x - geometry.boundingBox.min.x + WORDMARK.capHeight * .018;
  word.add(glyph); letters.push(glyph); bodies.push(body);
}
const owner = { word, font, letters, bodies, capHeight: 70 };
const hatModel = await model('src/assets/3D/straw_hat.glb'), hatMesh = hatModel.scene.children[0];
const hat = new THREE.Group(); hat.add(hatMesh); hat.scale.setScalar((bodies[0].geometry.boundingBox.max.x - bodies[0].geometry.boundingBox.min.x) * 1.12);
hat.rotation.set(.18, .12, -.10); fitHatToLetter(hat, hatMesh, bodies[0]);
const flight = new HatFlight({ owner, hat, hatMesh, addHatContactShade() {} }); flight.prepare();
for (let i = 0; i < 3; i++) {
  const trial = new THREE.Group(); trial.scale.copy(hat.scale); trial.rotation.fromArray(HAT_SEATS[i].rotation);
  fitHatToLetter(trial, hatMesh, bodies[i + 1]);
  assert.ok(trial.position.distanceTo(new THREE.Vector3().fromArray(HAT_SEATS[i].position)) < .0001, 'Cached hat seats still touch actual geometry');
}
for (const to of [1, 3, 2, 0]) {
  flight.flight = { from: flight.current, to, time: 0 };
  for (let i = 0; i < 270; i++) flight.step(1 / 60, 0);
  assert.equal(flight.current, to); assert.ok(hat.position.distanceTo(flight.spots[to].position) < 1e-8);
}
flight.reset(); assert.equal(flight.current, 0); assert.equal(flight.flight, null);
console.log('Props: actual hat contact, four measured landings and flight reset passed.');
