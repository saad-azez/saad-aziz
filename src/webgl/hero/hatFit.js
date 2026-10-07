import * as THREE from 'three';

/** Lower the tilted hat onto the actual top surface of the S, in glyph space. */
export function fitHatToLetter(hat, mesh, body) {
  body.geometry.computeBoundingBox();
  const box = body.geometry.boundingBox;
  const width = box.max.x - box.min.x;
  const position = body.geometry.getAttribute('position');
  let crestX = 0, count = 0;
  for (let i = 0; i < position.count; i++) {
    if (position.getY(i) < box.max.y - .7) continue;
    crestX += position.getX(i); count++;
  }
  hat.position.set(crestX / Math.max(count, 1) + width * .02, 0, 0);
  hat.updateMatrix(); mesh.updateMatrix();
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const letter = new THREE.Mesh(body.geometry, material);
  const underside = new THREE.Mesh(mesh.geometry, material);
  underside.matrixAutoUpdate = false;
  underside.matrix.multiplyMatrices(hat.matrix, mesh.matrix);
  letter.updateMatrixWorld(true); underside.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  const down = new THREE.Vector3(0, -1, 0), up = new THREE.Vector3(0, 1, 0);
  let height = -Infinity, contact = new THREE.Vector3();
  for (let ix = 0; ix <= 72; ix++) {
    const x = THREE.MathUtils.lerp(box.min.x, box.max.x, ix / 72);
    for (let iz = 0; iz <= 10; iz++) {
      const z = THREE.MathUtils.lerp(box.min.z + .15, box.max.z - .15, iz / 10);
      ray.set(new THREE.Vector3(x, box.max.y + width, z), down);
      const top = ray.intersectObject(letter, false)[0];
      if (!top || top.point.y < box.max.y - width * .3) continue;
      ray.set(new THREE.Vector3(x, -width * 2, z), up);
      const bottom = ray.intersectObject(underside, false)[0];
      if (!bottom) continue;
      const support = top.point.y - bottom.point.y;
      if (support > height) { height = support; contact.copy(top.point); }
    }
  }
  material.dispose();
  // A hair of compression closes the outline seam without burying the brim.
  hat.position.y = Number.isFinite(height) ? height - .16 : box.max.y;
  return { point: contact, width, height: hat.position.y };
}
