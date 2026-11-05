import * as THREE from 'three';

/**
 * Type's outlines, ready to extrude with as few triangles as they need and no fewer.
 *
 * ExtrudeGeometry cuts every curve of a glyph into the same number of pieces (`curveSegments`), the long bowl of an
 * S and a serif's tiny bend alike. Here each curve gets only as many as its bend needs: no piece turns more than
 * `maxTurn`, and none is cut finer than `most` (what it had before). With `maxTurn` at or under the sharpest piece
 * a fixed count gave, the outline and its shading cannot change; only the flat-ish curves lose pieces nobody saw.
 *
 * Extrude the result with any `curveSegments`: its outlines are straight runs already.
 */

const DEGREE = Math.PI / 180;

/** How far a curve turns along its length, in radians. */
function turnOf(curve) {
  const points = curve.getPoints(48);
  let turn = 0;
  for (let i = 2; i < points.length; i++) {
    const ax = points[i - 1].x - points[i - 2].x, ay = points[i - 1].y - points[i - 2].y;
    const bx = points[i].x - points[i - 1].x, by = points[i].y - points[i - 1].y;
    if ((!ax && !ay) || (!bx && !by)) continue;
    turn += Math.abs(Math.atan2(ax * by - ay * bx, ax * bx + ay * by));
  }
  return turn;
}

function resample(path, Kind, maxTurn, most) {
  const points = [];
  for (const curve of path.curves) {
    const pieces = curve.isLineCurve ? 1 : Math.min(most, Math.max(1, Math.ceil(turnOf(curve) / maxTurn)));
    const along = curve.getPoints(pieces);
    points.push(...(points.length ? along.slice(1) : along));
  }
  return new Kind(points);
}

/** `shapes` (from font.generateShapes) with each curve cut by its bend: see above. */
export function adaptiveShapes(shapes, { maxTurn = 2.5 * DEGREE, most = 36 } = {}) {
  return shapes.map(shape => {
    const out = resample(shape, THREE.Shape, maxTurn, most);
    out.holes = shape.holes.map(hole => resample(hole, THREE.Path, maxTurn, most));
    return out;
  });
}
