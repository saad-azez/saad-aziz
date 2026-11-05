import * as THREE from 'three';

const scratch = new THREE.Vector3();

/**
 * Where a vertical line through each point of an x-z grid first meets the
 * geometry, from above (`side` 1: the highest surface) or from below (-1: the
 * lowest); NaN where it misses. Each triangle only visits the grid points under
 * it, which is what a raycast per point could not do: the hat has thousands of
 * triangles, and a raycast tries all of them each time.
 */
function heightsOnGrid(geometry, matrix, x0, x1, xs, z0, z1, zs, side) {
  const out = new Float64Array((xs + 1) * (zs + 1)).fill(NaN);
  const position = geometry.getAttribute('position');
  const index = geometry.getIndex();
  const count = index ? index.count : position.count;
  const dx = (x1 - x0) / xs, dz = (z1 - z0) / zs;
  const points = new Float64Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    scratch.fromBufferAttribute(position, i);
    if (matrix) scratch.applyMatrix4(matrix);
    points[i * 3] = scratch.x; points[i * 3 + 1] = scratch.y; points[i * 3 + 2] = scratch.z;
  }
  for (let t = 0; t < count; t += 3) {
    const a = (index ? index.getX(t) : t) * 3, b = (index ? index.getX(t + 1) : t + 1) * 3, c = (index ? index.getX(t + 2) : t + 2) * 3;
    const ax = points[a], ay = points[a + 1], az = points[a + 2];
    const bx = points[b], by = points[b + 1], bz = points[b + 2];
    const cx = points[c], cy = points[c + 1], cz = points[c + 2];
    const det = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
    if (Math.abs(det) < 1e-12) continue;   // edge-on to the line
    const ix0 = Math.max(0, Math.ceil((Math.min(ax, bx, cx) - x0) / dx)), ix1 = Math.min(xs, Math.floor((Math.max(ax, bx, cx) - x0) / dx));
    const iz0 = Math.max(0, Math.ceil((Math.min(az, bz, cz) - z0) / dz)), iz1 = Math.min(zs, Math.floor((Math.max(az, bz, cz) - z0) / dz));
    for (let ix = ix0; ix <= ix1; ix++) {
      const x = x0 + ix * dx;
      for (let iz = iz0; iz <= iz1; iz++) {
        const z = z0 + iz * dz;
        const u = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / det;
        const v = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / det;
        if (u < 0 || v < 0 || u + v > 1) continue;
        const y = u * ay + v * by + (1 - u - v) * cy;
        const at = ix * (zs + 1) + iz;
        if (Number.isNaN(out[at]) || (side > 0 ? y > out[at] : y < out[at])) out[at] = y;
      }
    }
  }
  return out;
}

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
  const XS = 72, ZS = 10;
  const z0 = box.min.z + .15, z1 = box.max.z - .15;
  const xAt = ix => THREE.MathUtils.lerp(box.min.x, box.max.x, ix / XS);
  const zAt = iz => THREE.MathUtils.lerp(z0, z1, iz / ZS);
  const underside = new THREE.Matrix4().multiplyMatrices(hat.matrix, mesh.matrix);
  // The highest of the letter and the lowest of the hat, at every point of the grid.
  const tops = heightsOnGrid(body.geometry, null, box.min.x, box.max.x, XS, z0, z1, ZS, 1);
  const bottoms = heightsOnGrid(mesh.geometry, underside, box.min.x, box.max.x, XS, z0, z1, ZS, -1);
  let height = -Infinity, contact = new THREE.Vector3();
  for (let ix = 0; ix <= XS; ix++) {
    for (let iz = 0; iz <= ZS; iz++) {
      const at = ix * (ZS + 1) + iz;
      const top = tops[at], bottom = bottoms[at];
      if (Number.isNaN(top) || top < box.max.y - width * .3 || Number.isNaN(bottom)) continue;
      const support = top - bottom;
      if (support > height) { height = support; contact.set(xAt(ix), top, zAt(iz)); }
    }
  }
  // A hair of compression closes the outline seam without burying the brim.
  hat.position.y = Number.isFinite(height) ? height - .16 : box.max.y;
  return { point: contact, width, height: hat.position.y };
}
