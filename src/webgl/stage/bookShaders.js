import { NOISE } from '../lamp/lampShaders.js';

/**
 * The book's shaders (webgl/stage/Book.js): paper leaves that bend, plain
 * covers, the hide of the spine. All in the geometry's frame: x up from the
 * spine, y toward the reader, z along the spine (Book.frame turns that onto
 * the stage). Lit by one soft key from above and in front and an ambient;
 * clipped to the window onto the work while it opens (`uLens`, drawing-buffer
 * px; radius 0 draws everywhere).
 */

const ROOM = /* glsl */ `
uniform vec3 uKeyDir;
uniform vec3 uKeyColor;
uniform vec3 uAmbient;
uniform vec3 uLens;
uniform vec3 uCursor;
/** The glint of a small light held at the reader's pointer (uCursor, in front of the screen) off a surface at P. */
float cursorGlint(vec3 N, vec3 V, vec3 P, float sharp) {
  vec3 H = normalize(normalize(uCursor - P) + V);
  float nh = max(dot(N, H), 0.0);
  return pow(nh, sharp);
}
`;

/**
 * A leaf. position = (u out from the spine 0..1, v along it 0..1, side ±1 the
 * face or the back); aKind 0 a face, 1/2 the ends, 3 the fore edge, 4 the
 * spine edge. Hinged at `uRoot` on the spine arc, it leaves the spine the way
 * the spine faces there (`uRootAngle`) and bends round to its own angle
 * (`uAngle`) through its gutter (`uGutter` of its length), then runs
 * straight. On that it bends like paper (Book.js works out how far): bowed
 * like a sheet held at the spine, its fore edge `uBend` of its length aside,
 * more at one end than the other (`uTwist`), with a ripple (`uFlutter`). The
 * normal is the bent surface's own, so the light runs over the curl.
 * (Book.leafPoint is the same sum, for keeping the pages apart.) A page is one
 * sheet of thin paper, `uPaper` thick.
 */
export const PAGE_VERTEX = /* glsl */ `
uniform float uAngle;
uniform float uRootAngle;
uniform float uGutter;
uniform float uBend;
uniform float uTwist;
uniform float uFlutter;
uniform float uLength;
uniform float uHeight;
uniform float uPaper;
uniform vec2 uRoot;
attribute float aKind;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec2 vUv;
varying float vKind;
varying float vSide;
varying float vCurl;
float psi1(float u) { float u2 = u * u; return u2 * (6.0 - 4.0 * u + u2) / 3.0; }
float dpsi1(float u) { return (12.0 * u - 12.0 * u * u + 4.0 * u * u * u) / 3.0; }
float psi2(float u) { return 3.5714 * u * u * (u - 0.72); }
float dpsi2(float u) { return 3.5714 * (3.0 * u * u - 1.44 * u); }
void main() {
  float u = position.x, v = position.y, side = position.z;
  // The gutter: out of the spine along its own curve, turning on a circular arc to the page's angle; then straight.
  float angle = uAngle, rootAngle = uRootAngle;
  float da = angle - rootAngle;
  float ug = min(u, uGutter);
  float a = rootAngle + da * (ug / uGutter);
  vec2 p;
  if (abs(da) < 1e-4) p = uRoot + vec2(cos(rootAngle), sin(rootAngle)) * (ug * uLength);
  else { float r = uLength * uGutter / da; p = uRoot + r * vec2(sin(a) - sin(rootAngle), cos(rootAngle) - cos(a)); }
  if (u > uGutter) { a = angle; p += vec2(cos(a), sin(a)) * ((u - uGutter) * uLength); }
  vec2 d = vec2(cos(a), sin(a));
  vec2 n = vec2(-d.y, d.x);
  // The paper's bend: the bow (more at one end, the twist), and the ripple.
  float twist = uTwist;
  float bend = uBend + twist * (v - 0.5);
  float w = uLength * (bend * psi1(u) + uFlutter * psi2(u));
  float wu = uLength * (bend * dpsi1(u) + uFlutter * dpsi2(u));
  float wv = uLength * twist * psi1(u);
  p += n * w;
  vec3 Pu = vec3(d * uLength + n * wu, 0.0);
  vec3 Pv = vec3(n * wv, uHeight);
  vec3 surface = normalize(cross(Pv, Pu));
  vec2 across = normalize(vec2(-Pu.y, Pu.x));
  vec3 local = vec3(p + across * (side * 0.5 * uPaper), (v - 0.5) * uHeight);
  vec3 nl = aKind < 0.5 ? surface * side
          : aKind < 1.5 ? vec3(0.0, 0.0, -1.0)
          : aKind < 2.5 ? vec3(0.0, 0.0, 1.0)
          : vec3(normalize(Pu.xy) * (aKind < 3.5 ? 1.0 : -1.0), 0.0);
  vec4 world = modelMatrix * vec4(local, 1.0);
  vWorld = world.xyz;
  vNormal = normalize(mat3(modelMatrix) * nl);
  vUv = vec2(u, v);
  vKind = aKind;
  vSide = side;
  // How curled the paper is here (its curvature, per page length), for the light gathering in the curl.
  vCurl = uLength * (bend * (12.0 - 24.0 * u + 12.0 * u * u) / 3.0 + uFlutter * 3.5714 * (6.0 * u - 1.44)) / uLength;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

/**
 * Paper, printed on both sides as in the reel. The project is printed inside
 * a paper margin (wider at the gutter, as in a book), cropped to fill it from
 * the top of the site down, the ink taking the paper's tone; the back carries
 * it too, the right way round for that side, with the face's print showing
 * through faintly where the light comes through the sheet. Cream card with a little fibre, matt with a faint sheen, shaded
 * into the gutter and where the leaves pack, the light gathering a little in
 * the curl.
 */
export const PAGE_FRAGMENT = /* glsl */ `
${ROOM}
uniform sampler2D uMap;
uniform float uHasMap;
uniform vec3 uPaperColor;
uniform float uPack;
uniform float uLength;
uniform float uHeight;
uniform float uSeed;
uniform float uFocus;
uniform vec2 uTexel;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec2 vUv;
varying float vKind;
varying float vSide;
varying float vCurl;
${NOISE}
const float IMAGE = 1.6;
const float GUTTER_MARGIN = 0.065;
const float EDGE_MARGIN = 0.035;
/** The print, sharpened a little (what the mipmaps and the page's angle soften), its colour kept. */
vec3 printAt(vec2 uv) {
  vec3 c = texture2D(uMap, uv).rgb;
  vec3 blur = 0.25 * (texture2D(uMap, uv + vec2(uTexel.x, 0.0)).rgb + texture2D(uMap, uv - vec2(uTexel.x, 0.0)).rgb
                    + texture2D(uMap, uv + vec2(0.0, uTexel.y)).rgb + texture2D(uMap, uv - vec2(0.0, uTexel.y)).rgb);
  c = max(c + (c - blur) * 0.45, 0.0);
  // A touch more colour and contrast: prints on card read a little flatter than the screen they came from.
  float grey = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(grey), c, 1.08);
  return clamp((c - 0.5) * 1.04 + 0.5, 0.0, 1.0);
}
void main() {
  if (uLens.z > 0.0 && distance(gl_FragCoord.xy, uLens.xy) > uLens.z) discard;
  vec3 N = normalize(vNormal);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(cameraPosition - vWorld);
  // The card: a little fibre, fading out where it would be finer than a pixel.
  vec2 fp = vUv * vec2(9.0, 14.0) + uSeed;
  float fibre = 0.5 * vnoise(fp) + 0.3 * vnoise(fp * 2.1 + 3.0) + 0.2 * vnoise(fp * 4.3 + 7.0);
  float fineness = max(fwidth(fp.x), fwidth(fp.y)) * 4.3;
  fibre = mix(0.5, fibre, clamp(1.0 - fineness, 0.0, 1.0));
  vec3 paper = uPaperColor * (0.965 + 0.07 * fibre);
  bool face = vSide > 0.0;
  // The print, inside its margin: the same margin all round (in length), wider at the gutter.
  float mv = EDGE_MARGIN * uLength / uHeight;
  vec2 q = vec2((vUv.y - mv) / (1.0 - 2.0 * mv), (vUv.x - GUTTER_MARGIN) / (1.0 - GUTTER_MARGIN - EDGE_MARGIN));
  float area = uHeight * (1.0 - 2.0 * mv) / (uLength * (1.0 - GUTTER_MARGIN - EDGE_MARGIN));
  vec2 image = area > IMAGE ? vec2(q.x, 1.0 - (1.0 - q.y) * IMAGE / area)
                            : vec2(0.5 + (q.x - 0.5) * area / IMAGE, q.y);
  vec2 inside = min(q, 1.0 - q) * vec2(uHeight * (1.0 - 2.0 * mv), uLength * (1.0 - GUTTER_MARGIN - EDGE_MARGIN));
  float edge = min(inside.x, inside.y);
  float mask = clamp(edge / max(fwidth(edge), 1e-4) + 0.5, 0.0, 1.0);
  vec3 color = paper;
  float key = dot(N, uKeyDir);
  float printed = 0.0;
  if (vKind < 0.5 && uHasMap > 0.5 && mask > 0.0) {
    // This side's print, and faintly the other side's through the sheet (mirrored), when the light is behind it.
    vec3 ink = printAt(face ? image : vec2(1.0 - image.x, image.y));
    vec3 behind = texture2D(uMap, face ? vec2(1.0 - image.x, image.y) : image).rgb;
    ink = mix(ink, ink * behind, 0.05 * max(-key, 0.0));
    // Ink on card: the barest trace of the paper's grain, its colours its own.
    ink *= 0.99 + 0.02 * fibre;
    printed = mask;
    color = mix(paper, ink, mask);
  }
  // Light: a soft key and the room; into the gutter and where the leaves pack, darker; through the sheet, a little.
  float diffuse = max((key + 0.25) / 1.25, 0.0);
  float gutter = 1.0 - 0.32 * (1.0 - smoothstep(0.0, 0.16, vUv.x));
  float packed = 1.0 - uPack * 0.4 * (1.0 - smoothstep(0.0, 0.45, vUv.x));
  float curl = 1.0 - 0.1 * clamp(abs(vCurl) * 0.5, 0.0, 1.0);
  vec3 light = (uAmbient * (0.92 + 0.12 * N.y) + uKeyColor * diffuse) * gutter * packed * curl;
  vec3 through = uKeyColor * max(-key, 0.0) * 0.28;
  vec3 H = normalize(uKeyDir + V);
  float sheen = pow(max(dot(N, H), 0.0), 14.0) * 0.045;
  // The print reads clearly whatever way the page faces: nearly self-lit (the page on show fully), the
  // room's light only shading it; the bare paper round it is white paper in a bright room, half its light its
  // own, so it keeps its shade (into the gutter, the curl) without going grey.
  vec3 lit = light + through;
  vec3 bright = vec3(1.0) * (0.97 + 0.05 * diffuse);
  // Every page's print keeps its own colours wherever it hangs; the page on show is lit fully.
  float clarity = printed * (0.9 + 0.1 * uFocus);
  vec3 printLight = mix(mix(lit, bright * gutter * packed * curl, 0.5), bright, clarity);
  vec3 c = color * printLight + uKeyColor * sheen * (1.0 - 0.8 * clarity);
  if (vKind > 0.5) {
    // A sheet's cut edge: bare paper in the room's light, deeper into the gutter.
    c = paper * mix(uAmbient * 1.05 + uKeyColor * max(key, 0.0), vec3(0.95 + 0.05 * max(key, 0.0)), 0.45) * gutter;
  }
  c += pow(1.0 - max(dot(N, V), 0.0), 5.0) * 0.04;
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}
`;

/** A cover: local position (x out from the hinge, y through the board, z along the spine, in page lengths), normal and the cover's axes in the world. */
export const COVER_VERTEX = /* glsl */ `
uniform float uBow;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vLocal;
varying vec3 vLocalN;
varying vec3 vAxisX;
varying vec3 vAxisY;
varying vec3 vAxisZ;
void main() {
  // The board bowed outward toward its fore edge (uBow there), its faces' normals following the curve.
  float x = max(0.0, position.x);
  vec3 bowed = position + vec3(0.0, uBow * x * x, 0.0);
  vec3 n = normalize(normal + vec3(-2.0 * uBow * x * normal.y, 0.0, 0.0));
  vLocal = bowed;
  vLocalN = n;
  vec4 world = modelMatrix * vec4(bowed, 1.0);
  vWorld = world.xyz;
  mat3 m = mat3(modelMatrix);
  vNormal = normalize(m * n);
  vAxisX = normalize(m * vec3(1.0, 0.0, 0.0));
  vAxisY = normalize(m * vec3(0.0, 1.0, 0.0));
  vAxisZ = normalize(m * vec3(0.0, 0.0, 1.0));
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

/**
 * A cover: the journal's board. Outside, a pebbled, lacquered board in its
 * colour (uBoard), written on (uArt, the page as it is seen: the front's and
 * the back's each read from their own left, uFront saying which this is),
 * and its finish (uFinish: R gold foil, G matte ink). The lacquer and the foil
 * catch the room's light and, sharply, the light at the reader's pointer
 * (cursorGlint), so the cover shines wherever the pointer goes and as the
 * book turns. Inside, plain paper (uPaper) pasted down inside a turn-in.
 */
export const COVER_FRAGMENT = /* glsl */ `
${ROOM}
uniform vec3 uBoard;
uniform vec3 uPaper;
uniform sampler2D uArt;
uniform sampler2D uFinish;
uniform float uFront;
uniform vec2 uTexel;
uniform float uThick;
uniform float uFore;
uniform float uLip;
uniform float uHalf;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vLocal;
varying vec3 vLocalN;
varying vec3 vAxisX;
varying vec3 vAxisY;
varying vec3 vAxisZ;
${NOISE}
void main() {
  if (uLens.z > 0.0 && distance(gl_FragCoord.xy, uLens.xy) > uLens.z) discard;
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 N = normalize(vNormal);
  float key = max(dot(N, uKeyDir), 0.0);
  float across = (vLocal.x + uLip) / (uFore + uLip);
  if (normalize(vLocalN).y < -0.5) {
    // Inside: plain paper, inside a turn-in of the board.
    vec2 uv = vec2((vLocal.z + uHalf) / (2.0 * uHalf), across);
    vec2 turn = vec2(0.022 * uFore / (2.0 * uHalf), 0.022);
    vec2 inner = (vec2(1.0 - uv.x, uv.y) - turn) / (1.0 - 2.0 * turn);
    float inside = step(0.0, inner.x) * step(inner.x, 1.0) * step(0.0, inner.y) * step(inner.y, 1.0);
    vec3 lit = uAmbient * (0.95 + 0.25 * N.y) + uKeyColor * key * 1.3;
    vec3 c = mix(uBoard * lit, uPaper * mix(lit, vec3(1.0) * (0.95 + 0.08 * key), 0.6), inside);
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
    return;
  }
  // Outside: the page as it is seen.
  float along = (vLocal.z + uHalf) / (2.0 * uHalf);
  vec2 uv = uFront > 0.5 ? vec2(across, 1.0 - along) : vec2(1.0 - across, along);
  bool face = normalize(vLocalN).y > 0.5;
  vec4 art = face ? texture2D(uArt, uv) : vec4(0.0);
  vec3 finish = face ? texture2D(uFinish, uv).rgb : vec3(0.0);
  // The leather: a soft pebble in its colour and its surface, gone where it would be finer than a pixel.
  vec2 gp = uv * vec2(90.0, 143.0);
  float fine = clamp(1.0 - max(fwidth(gp.x), fwidth(gp.y)) * 2.5, 0.0, 1.0);
  float g0 = vnoise(gp);
  float gx = vnoise(gp + vec2(0.35, 0.0)) - g0, gy = vnoise(gp + vec2(0.0, 0.35)) - g0;
  // What is pressed into it (blind stamping, the foil, the coin's seat): its slope, so the light finds the edges.
  float px = 0.0, py = 0.0;
  if (face) {
    px = texture2D(uFinish, uv + vec2(uTexel.x * 1.5, 0.0)).b - texture2D(uFinish, uv - vec2(uTexel.x * 1.5, 0.0)).b;
    py = texture2D(uFinish, uv + vec2(0.0, uTexel.y * 1.5)).b - texture2D(uFinish, uv - vec2(0.0, uTexel.y * 1.5)).b;
  }
  // Across the page (u) and down it (v) in the cover's own axes: the front reads x and -z, the back -x and z.
  float sx = uFront > 0.5 ? 1.0 : -1.0;
  vec3 slope = vAxisX * (gx * 0.16 * fine * (1.0 - art.a) + px * 0.9 * sx) + vAxisZ * (gy * 0.16 * fine * (1.0 - art.a) - py * 0.9 * sx);
  N = normalize(N + slope);
  key = max(dot(N, uKeyDir), 0.0);
  vec3 board = uBoard * (0.95 + 0.08 * mix(0.5, g0, fine));
  vec3 base = mix(board, art.rgb, art.a);
  vec3 lit = uAmbient * (0.9 + 0.3 * N.y) + uKeyColor * key * 1.35;
  vec3 H = normalize(uKeyDir + V);
  float nh = max(dot(N, H), 0.0);
  float NV = max(dot(N, V), 0.0);
  // Leather has a quiet satin: a broad soft sheen from the room, and a soft warm pool where the pointer's light falls.
  float satin = (1.0 - finish.g * art.a) * (1.0 - finish.r * art.a);
  vec3 c = base * lit
    + satin * uKeyColor * pow(nh, 18.0) * 0.07
    + satin * vec3(1.0, 0.93, 0.86) * cursorGlint(N, V, vWorld, 22.0) * 0.06
    + satin * pow(1.0 - NV, 4.0) * 0.035;
  // Gold foil: warm metal, quiet, brightening as it turns to the light.
  vec3 R = reflect(-V, N);
  vec3 gold = vec3(0.8, 0.64, 0.36);
  vec3 metal = mix(gold * 0.55, gold * 1.05, smoothstep(-0.4, 0.9, R.y)) * (0.6 + 0.4 * key)
    + vec3(1.0, 0.92, 0.76) * (pow(nh, 40.0) * 0.25 + cursorGlint(N, V, vWorld, 36.0) * 0.18);
  c = mix(c, metal, finish.r * art.a);
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}
`;

/**
 * The spine: a strip of dark hide along the arc the leaves are hinged on
 * (the arc through uChordA → uChordB turning uArc, bulging toward the pages),
 * its back a little behind them and, while the book is shut, rounded out
 * (uRound) as a hardback's is. position = (s along the strip 0..1, v along
 * the spine, side -1 inside → +1 outside).
 */
export const HINGE_VERTEX = /* glsl */ `
uniform float uArc;
uniform vec2 uChordA;
uniform vec2 uChordB;
uniform float uHeight;
uniform float uInset;
uniform float uThick;
uniform float uRound;
attribute float aKind;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec2 vUv;
float sinc(float x) { return abs(x) < 1e-4 ? 1.0 - x * x / 6.0 : sin(x) / x; }
void main() {
  vec2 d = uChordB - uChordA;
  float chord = max(length(d), 1e-5);
  vec2 u = d / chord;
  vec2 r = vec2(u.y, -u.x);
  vec2 m = (uChordA + uChordB) * 0.5;
  float t = position.x - 0.5;
  float along = chord * t * sinc(uArc * t) / sinc(uArc * 0.5);
  float across = uArc > 1e-5 ? chord * 0.5 * (cos(uArc * t) - cos(uArc * 0.5)) / sin(uArc * 0.5) : 0.0;
  vec2 p = m + u * along + r * across;
  float dAlong = chord * cos(uArc * t) / sinc(uArc * 0.5);
  float dAcross = uArc > 1e-5 ? -chord * 0.5 * uArc * sin(uArc * t) / sin(uArc * 0.5) : 0.0;
  vec2 tangent = normalize(u * dAlong + r * dAcross);
  vec2 outN = vec2(-tangent.y, tangent.x);
  float side = position.z * 0.5 + 0.5;
  // The back rounded out (uRound at its middle, nothing at the boards), and its normal following the round.
  float bulge = uRound * (1.0 - 4.0 * t * t);
  vec2 roundN = normalize(outN + tangent * (8.0 * uRound * t / chord));
  vec2 q = p + outN * (uInset + side * uThick + bulge);
  vec3 nl = aKind < 0.5 ? vec3(roundN * position.z, 0.0) : vec3(0.0, 0.0, aKind < 1.5 ? -1.0 : 1.0);
  vec3 local = vec3(q, (position.y - 0.5) * uHeight);
  vec4 world = modelMatrix * vec4(local, 1.0);
  vWorld = world.xyz;
  vNormal = normalize(mat3(modelMatrix) * nl);
  vUv = position.xy;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const HINGE_FRAGMENT = /* glsl */ `
${ROOM}
uniform vec3 uHide;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec2 vUv;
${NOISE}
void main() {
  if (uLens.z > 0.0 && distance(gl_FragCoord.xy, uLens.xy) > uLens.z) discard;
  vec3 N = normalize(vNormal);
  vec3 V = normalize(cameraPosition - vWorld);
  // Whichever way its triangles wind, the side seen faces the reader.
  if (dot(N, V) < 0.0) N = -N;
  float grain = vnoise(vUv * vec2(30.0, 220.0));
  vec3 hide = uHide * (0.9 + 0.2 * grain);
  float key = max(dot(N, uKeyDir), 0.0);
  vec3 H = normalize(uKeyDir + V);
  float spec = pow(max(dot(N, H), 0.0), 16.0) * 0.12;
  // Round: brightest where it faces the reader, falling away toward the boards as it turns aside.
  float facing = max(dot(N, V), 0.0);
  float round = mix(0.3, 1.08, pow(facing, 1.8));
  vec3 color = hide * (uAmbient * (0.9 + 0.3 * N.y) + uKeyColor * key * 1.4) * round + uKeyColor * spec;
  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}
`;

/**
 * A sticker on a cover (journal/Stickers.js), drawn in the cover's own space
 * (x across from the hinge, y out through the board, z along the spine, in
 * page lengths; the mesh is the cover's child). position = (a, b) on the
 * sticker, -½ → ½ each way. It sits at `uCenter` (x, z) turned `uTilt`, its
 * right and up along `uRight` and `uUp` (which way those are depends on the
 * cover), `uSize` big, on the board's outer face (uThick out, bowed as the
 * board is, uBow), `uLayer` above the ones under it.
 *
 * Peeling, as a sticker comes off under a fingernail: from the point
 * `uPeelEdge` on its edge, in toward `uPeelDir`, the part nearer the edge
 * than `uPeel` has come away. It bends up off the board round a curl of
 * radius `uCurl` and runs on straight, `uAngle` up from the board, toward
 * the hand; what has come away is lifted `uLift` more. With `uPeel` past its
 * far edge the whole sticker is off, held at a slant from the edge in the hand.
 *
 * Laid over the coin in its seat (`uCoin`: its middle x, z on the board, its
 * radius, and how high its face stands off the board; height 0 when the coin
 * is not there), it is stretched over it: up onto a plateau just above the
 * coin's face, and down to the board again round its rim, so the coin shows
 * through as a bump.
 *
 * With `uShadow` it is its own shadow: the same shape laid flat on the board,
 * pushed away from the light by how high each part of it is, and softer
 * (vRaised) the higher it is; nothing under what is still stuck down.
 */
export const STICKER_VERTEX = /* glsl */ `
uniform vec2 uCenter;
uniform vec2 uRight;
uniform vec2 uUp;
uniform float uTilt;
uniform vec2 uSize;
uniform float uThick;
uniform float uBow;
uniform float uLayer;
uniform float uLift;
uniform vec2 uPeelEdge;
uniform vec2 uPeelDir;
uniform float uPeel;
uniform float uAngle;
uniform float uCurl;
uniform float uShadow;
uniform vec4 uCoin;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorld;
varying float vRaised;
varying vec2 vBoard;
varying float vBump;
/** How high the sticker is held off the board by the coin under it, at xz: a low dome over its face, a ramp down round its rim. */
float coinBump(vec2 xz) {
  if (uCoin.w <= 0.0) return 0.0;
  float d = length(xz - uCoin.xy) / uCoin.z;
  // Flat over its face right out to its rim (never below it), then stretched down to the board.
  float dome = 1.0 - 0.03 * d * d;
  return uCoin.w * dome * (1.0 - smoothstep(1.0, 1.6, d));
}
void main() {
  vUv = position.xy + 0.5;
  vec2 p = position.xy * uSize;
  float h = 0.0;
  vec2 bentN = vec2(0.0, 1.0);
  if (uPeel > 0.0) {
    float s = dot(p - uPeelEdge, uPeelDir);
    if (s < uPeel) {
      // How far into the part that has come away (0 where it still meets the board).
      float t = uPeel - s, along;
      float arc = uCurl * uAngle;
      if (t < arc) {
        float a = t / uCurl;
        along = uPeel - uCurl * sin(a);
        h = uCurl * (1.0 - cos(a));
        bentN = vec2(sin(a), cos(a));
      } else {
        float e = t - arc;
        along = uPeel - uCurl * sin(uAngle) - e * cos(uAngle);
        h = uCurl * (1.0 - cos(uAngle)) + e * sin(uAngle);
        bentN = vec2(sin(uAngle), cos(uAngle));
      }
      p += uPeelDir * (along - s);
      h += uLift * smoothstep(0.0, uCurl * 3.0 + 1e-5, t);
    }
  }
  if (uShadow > 0.5) {
    // Laid on the board, away from the light (down and a little right), by how high it is.
    p += vec2(0.28, -0.62) * h;
  }
  float c = cos(uTilt), sn = sin(uTilt);
  vec2 q = vec2(c * p.x - sn * p.y, sn * p.x + c * p.y);
  vec2 xz = uCenter + uRight * q.x + uUp * q.y;
  // Over the coin it rides up on it, wherever it has not already come away higher than that.
  float bump = uShadow > 0.5 ? 0.0 : coinBump(xz);
  float y = uThick + uBow * max(0.0, xz.x) * max(0.0, xz.x) + (uShadow > 0.5 ? uLayer * 0.5 : uLayer + max(h, bump));
  vec3 local = vec3(xz.x, y, xz.y);
  vBoard = xz;
  // The normal: up off the board, turned over the curl where it has come away.
  vec2 d = vec2(c * uPeelDir.x - sn * uPeelDir.y, sn * uPeelDir.x + c * uPeelDir.y);
  vec2 dxz = uRight * d.x + uUp * d.y;
  vec3 n = normalize(vec3(dxz.x * bentN.x, bentN.y, dxz.y * bentN.x));
  if (bump > h) {
    // Its slope over the coin: the light rolls over the bump and its rim.
    float e = uCoin.z * 0.04;
    float gx = (coinBump(xz + vec2(e, 0.0)) - coinBump(xz - vec2(e, 0.0))) / (2.0 * e);
    float gz = (coinBump(xz + vec2(0.0, e)) - coinBump(xz - vec2(0.0, e))) / (2.0 * e);
    n = normalize(vec3(-gx, 1.0, -gz));
    // Embossed: lighter where its rim turns toward the light (from the top left of the cover as it is seen),
    // shadowed where it turns away; flat over the coin's face.
    vBump = dot(n, normalize(vec3(-0.45, 1.0, -0.55))) - dot(vec3(0.0, 1.0, 0.0), normalize(vec3(-0.45, 1.0, -0.55)));
  } else {
    vBump = 0.0;
  }
  vec4 world = modelMatrix * vec4(local, 1.0);
  vWorld = world.xyz;
  vNormal = normalize(mat3(modelMatrix) * n);
  vRaised = max(h, bump * 0.35);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

/**
 * A sticker's face (uMap) and what it is made of (uSkin: R holographic foil,
 * G gloss, B metal): vinyl with a sharp glint, holographic foil whose colours
 * run with the angle and the pointer, a matte card; its back, where it curls
 * over, the white backing. Solid or not at all (its die-cut edge). With
 * `uShadow`, a soft dark shadow, deeper the higher it is lifted.
 */
export const STICKER_FRAGMENT = /* glsl */ `
${ROOM}
uniform sampler2D uMap;
uniform sampler2D uSkin;
uniform float uShadow;
uniform float uLift;
uniform float uPeel;
uniform vec4 uBounds;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorld;
varying float vRaised;
varying vec2 vBoard;
varying float vBump;
void main() {
  if (uLens.z > 0.0 && distance(gl_FragCoord.xy, uLens.xy) > uLens.z) discard;
  if (uShadow > 0.5) {
    // Only on the board (uBounds: x from, x to, z from, z to), never on the air past its edges.
    if (vBoard.x < uBounds.x || vBoard.x > uBounds.y || vBoard.y < uBounds.z || vBoard.y > uBounds.w) discard;
    // Nothing under what is still stuck down; just off the board, dark and sharp; higher, fainter and softer.
    float near = smoothstep(0.0, 0.003, vRaised);
    float spread = smoothstep(0.0, 0.07, vRaised);
    float a = texture2D(uMap, vUv, 1.5 + 4.0 * spread).a * near * mix(0.42, 0.16, spread);
    if (a < 0.004) discard;
    gl_FragColor = vec4(0.1, 0.03, 0.06, a);
    return;
  }
  vec4 tex = texture2D(uMap, vUv);
  if (tex.a < 0.5) discard;
  vec3 skin = texture2D(uSkin, vUv).rgb;
  vec3 N = normalize(vNormal);
  vec3 V = normalize(cameraPosition - vWorld);
  bool back = !gl_FrontFacing;
  if (back) N = -N;
  float key = max(dot(N, uKeyDir), 0.0);
  vec3 H = normalize(uKeyDir + V);
  float nh = max(dot(N, H), 0.0);
  float NV = max(dot(N, V), 0.0);
  // Printed stickers read clearly: mostly their own colours, the room only shading them.
  vec3 lit = mix(uAmbient * (0.95 + 0.2 * N.y) + uKeyColor * key * 1.25, vec3(1.0) * (0.96 + 0.06 * key), 0.5);
  if (back) {
    vec3 backing = vec3(0.93, 0.92, 0.9);
    gl_FragColor = vec4(backing * lit + uKeyColor * pow(nh, 20.0) * 0.1, 1.0);
    #include <colorspace_fragment>
    return;
  }
  vec3 c = tex.rgb * lit;
  float glint = cursorGlint(N, V, vWorld, 60.0);
  // Holographic foil: a rainbow that slides with the angle it is seen at and where the pointer's light is.
  vec3 L = normalize(uCursor - vWorld);
  float phase = NV * 2.2 + dot(N, L) * 1.4 + vUv.x * 0.9 + vUv.y * 0.6;
  vec3 rainbow = 0.5 + 0.5 * cos(6.2832 * (phase + vec3(0.0, 0.33, 0.67)));
  float sheen = 0.35 + 0.65 * pow(1.0 - NV, 1.5) + 0.6 * cursorGlint(N, V, vWorld, 12.0);
  c = mix(c, c * 0.85 + rainbow * 0.22 * sheen, skin.r * 0.4);
  // Gloss: vinyl and photo paper catch a soft highlight; matte card barely.
  c += vec3(1.0, 0.97, 0.94) * (glint * 0.16 + pow(nh, 50.0) * 0.12) * skin.g + uKeyColor * pow(nh, 8.0) * 0.02;
  // Metal foil.
  vec3 gold = vec3(0.86, 0.68, 0.36);
  c = mix(c, gold * (0.55 + 0.6 * key) + vec3(1.0, 0.94, 0.8) * glint * 0.4, skin.b);
  // Stretched over the coin: its rim catches the light on one side and falls into shade on the other.
  c *= 1.0 + clamp(vBump * 2.2, -0.35, 0.3);
  // A little darker in the curl, where the light falls off under it.
  c *= 1.0 - 0.08 * clamp(vRaised * 40.0, 0.0, 1.0);
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}
`;
