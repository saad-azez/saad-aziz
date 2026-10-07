import assert from 'node:assert/strict';
import * as THREE from 'three';
import gsap from 'gsap';
import LiquidDot, { liquidDotPose } from '../src/webgl/hero/LiquidDot.js';
import { skillSpinPose } from '../src/webgl/hero/skillSpin.js';

const material = new THREE.MeshBasicMaterial();
const dot = new THREE.Mesh(new THREE.SphereGeometry(6.5), material);
dot.geometry.translate(0, 28.5, 0);
dot.geometry.computeBoundingBox();
const stem = new THREE.Mesh(new THREE.BoxGeometry(24, 53, 5), material);
stem.geometry.translate(0, -8.5, 0);
stem.geometry.computeBoundingBox();
const owner = { dot, bodies: [null, null, null, null, stem], letters: Array.from({ length: 5 }, () => new THREE.Group()), material };
owner.iForm = { bottom: -35, top: 35, capitalScale: 70 / 53 };
const liquid = new LiquidDot(owner);
try {
  assert.equal(dot.visible, false, 'The dot is absent before rope contact');
  assert.equal(liquid.group.visible, false);
  const stemTop = () => stem.geometry.boundingBox.max.y * stem.scale.y + stem.position.y;
  const stemBottom = () => stem.geometry.boundingBox.min.y * stem.scale.y + stem.position.y;
  assert.ok(Math.abs(stemTop() - 35) < 1e-6, 'Capital I starts at the cap line');
  assert.ok(Math.abs(stemBottom() + 35) < 1e-6, 'Capital I shares the baseline');
  const tween = liquid.play().pause();
  tween.progress(.20);
  assert.equal(dot.visible, false, 'Liquid and finished dot are never drawn together');
  assert.equal(liquid.bulb.visible, true);
  assert.equal(liquid.neck.visible, true, 'The emerging bulb is attached to the stem');
  for (let i = 1; i <= 99; i++) {
    tween.progress(i / 100);
    assert.ok(Math.abs(stemBottom() + 35) < 1e-6, 'Morphing keeps the foot planted');
    assert.ok(liquid.bulb.position.y + liquid.bulb.scale.y <= 35.00001, 'The liquid stays within the cap line');
    for (const mesh of [liquid.bulb, liquid.neck]) {
      assert.ok([...mesh.geometry.attributes.position.array].every(Number.isFinite));
      assert.ok([...mesh.geometry.attributes.normal.array].every(Number.isFinite));
    }
  }
  tween.progress(.65);
  assert.equal(liquid.neck.visible, false, 'The liquid neck pinches apart');
  owner.dotHidden = true; liquid.syncVisibility();
  assert.equal(liquid.group.visible, false, 'The stage can take ownership without a second dot');
  owner.dotHidden = false;
  tween.progress(1);
  assert.equal(dot.visible, true);
  assert.equal(liquid.group.visible, false);
  assert.equal(stem.scale.y, 1, 'Finished lowercase stem returns to its designed proportions');
  assert.deepEqual(dot.position.toArray(), [0, 0, 0]);
  liquid.reset(); assert.equal(dot.visible, false, 'Replay resets to an undotted i');
  liquid.finish(); assert.equal(dot.visible, true, 'Skip and reduced motion resolve immediately');
  const end = liquidDotPose(1, 6.5, 18, 28.5, 1.35);
  assert.ok(Math.abs(end.centre - 28.5) < 1e-8);
  assert.equal(end.z, 1.35);
  assert.equal(end.neck, 0);
  for (let i = 0; i < 24; i++) {
    const rest = skillSpinPose(i * 3 + 1, 8);
    assert.equal(rest.angle, i * Math.PI, 'Each skill has a face-on reading pause');
    assert.equal(rest.current, i % 8, 'All eight skills cycle and wrap');
    const turn = skillSpinPose(i * 3 + 2.6, 8);
    assert.ok(Math.abs(turn.angle - (i + .5) * Math.PI) < 1e-8, 'Skill changes use half-turns');
  }
  liquid.play(); liquid.dispose();
  assert.equal(gsap.getTweensOf(liquid.clock).length, 0);
  console.log('Liquid dot: hidden start, attached emergence, finite mesh/normals, separation, stage ownership, exact rest, replay, skip and disposal passed.');
} finally {
  liquid.dispose(); dot.geometry.dispose(); stem.geometry.dispose(); material.dispose(); gsap.ticker.sleep();
}
