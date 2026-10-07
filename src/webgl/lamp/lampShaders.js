/**
 * The book lamp's shaders. Everything is lit by hand in GLSL: a warm LED bar
 * along the spine (a line light), one soft key light from the room and an
 * ambient, then an HDR bloom and a soft-clip tone map on the way to the
 * screen. Nothing here uses three's lights or built-in materials.
 *
 * Colours are linear; every scene shader writes linear HDR to a half-float
 * target and only `COMPOSITE` encodes to sRGB.
 */

/** Value noise and fbm, for paper fibre and wood grain. */
export const NOISE = /* glsl */ `
float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
             mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * vnoise(p); p = p * 2.03 + vec2(17.1, 9.7); a *= 0.5; }
  return v;
}
`;

/**
 * The lights every surface shares. `lampLight(P, soft)` is the LED bar as a
 * line light: xyz the direction to its nearest point, w its strength there,
 * softened so the hub does not blow to infinity.
 */
export const LIGHTS = /* glsl */ `
uniform vec3 uLampA;
uniform vec3 uLampB;
uniform vec3 uWarm;
uniform float uLight;
uniform float uPower;
uniform vec3 uKeyDir;
uniform vec3 uKeyColor;
uniform vec3 uAmbient;
uniform vec3 uCamPos;
vec4 lampLight(vec3 P, float soft) {
  vec3 ab = uLampB - uLampA;
  float t = clamp(dot(P - uLampA, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
  vec3 d = uLampA + ab * t - P;
  float d2 = dot(d, d);
  return vec4(d * inversesqrt(max(d2, 1e-6)), uLight * uPower / (d2 + soft * soft));
}
`;

/**
 * A page of the accordion. The geometry is abstract: position = (u along the
 * page from fold to fold, v along the spine, side across the sheet), aFace
 * the page, aKind 0 the sheet, 1 its bottom cut edge, 2 its top. The folds
 * are read from a float texture (`uFolds`, one texel per fold: x, y, then the
 * page's sag and how packed it is), so the whole lamp is one draw call and
 * the shape lives on the GPU.
 */
export const PAPER_VERTEX = /* glsl */ `
#define PI 3.14159265
uniform sampler2D uFolds;
uniform float uHeight;
uniform float uPaper;
attribute float aFace;
attribute float aKind;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec2 vUv;
varying float vFace;
varying float vKind;
varying float vPack;
void main() {
  int f = int(aFace + 0.5);
  vec4 fa = texelFetch(uFolds, ivec2(f, 0), 0);
  vec4 fb = texelFetch(uFolds, ivec2(f + 1, 0), 0);
  vec2 A = fa.xy, B = fb.xy;
  vec2 d = B - A;
  float len = max(length(d), 1e-4);
  vec2 T = d / len;
  vec2 N2 = vec2(-T.y, T.x);
  float u = position.x, v = position.y, side = position.z;
  // The sheet bows between its folds under gravity (sag solved on the CPU, never into a neighbour).
  float sag = fa.z;
  float s = sag * sin(PI * u);
  float ds = sag * PI * cos(PI * u);
  vec2 p = A + T * (len * u) + N2 * s;
  vec2 n2 = normalize(N2 * len - T * ds);
  // The sheet is a paper thick, but never thicker than the wedge it shares with its neighbour at either
  // fold, so the two sheets of a pleat fill their spike without passing through each other.
  vec4 wedge = texelFetch(uFolds, ivec2(f, 1), 0);
  float thick = min(uPaper * 0.5, 0.5 * min(wedge.x * u, wedge.y * (1.0 - u)));
  vec3 local = vec3(p + n2 * (side * thick), (v - 0.5) * uHeight);
  // The sheet's two faces and its cut edges (along z).
  vec3 nl = aKind < 0.5 ? vec3(n2 * side, 0.0) : vec3(0.0, 0.0, aKind < 1.5 ? -1.0 : 1.0);
  vec4 world = modelMatrix * vec4(local, 1.0);
  vWorld = world.xyz;
  vNormal = normalize(mat3(modelMatrix) * nl);
  vUv = vec2(u, v);
  vFace = aFace;
  vKind = aKind;
  vPack = fa.w;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

/**
 * Tyvek, lit through. The LED light diffuses through the sheet almost the
 * same either side, falling off from the spine; the pockets between pleats
 * shade the room light near the folds; the cut edges leak the most; a faint
 * satin sheen on the fibre.
 */
export const PAPER_FRAGMENT = /* glsl */ `
uniform vec3 uPaperColor;
uniform float uDebug;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec2 vUv;
varying float vFace;
varying float vKind;
varying float vPack;
void main() {
  vec3 N = normalize(vNormal);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(uCamPos - vWorld);
  // Fibre in the Tyvek, fading out where it would be finer than a pixel (seen edge on, or far off).
  vec2 fp = vec2(vUv.x * 9.0 + vFace * 1.7, vUv.y * 10.0);
  float fibre = 0.5 * vnoise(fp) + 0.3 * vnoise(fp * 2.1 + 3.0) + 0.2 * vnoise(fp * 4.3 + 7.0);
  float fineness = max(fwidth(fp.x), fwidth(fp.y)) * 4.3;
  fibre = mix(0.5, fibre, clamp(1.0 - fineness, 0.0, 1.0));
  vec3 albedo = uPaperColor * (0.97 + 0.06 * fibre);
  // Even pages run out from the spine, odd pages run back in (rounded: the varying is never exactly whole).
  float odd = mod(floor(vFace + 0.5), 2.0);
  float innerDist = mix(vUv.x, 1.0 - vUv.x, odd);
  float outerDist = 1.0 - innerDist;
  float pocket = 1.0 - 0.7 * (1.0 - smoothstep(0.0, 0.25, innerDist))
                     - 0.6 * vPack * (1.0 - smoothstep(0.0, 0.2, outerDist));
  float key = max(dot(N, uKeyDir), 0.0);
  vec3 room = (uAmbient * (0.75 + 0.25 * N.y) + uKeyColor * key * 0.5) * max(pocket, 0.05) * 0.8;
  vec4 ll = lampLight(vWorld, 2.2);
  float E = ll.w;
  float facing = dot(N, ll.xyz);
  float through = E * (0.78 + 0.22 * abs(facing)) * (1.0 - 0.3 * vPack);
  float graze = E * max(facing, 0.0) * 0.22;
  vec3 warm = uWarm * (through + graze);
  if (vKind > 0.5) { warm *= 1.3; room *= 1.1; }
  float fres = pow(1.0 - max(dot(N, V), 0.0), 4.0);
  vec3 color = albedo * (room + warm) + fres * 0.04 * (uKeyColor * 0.5 + warm);
  if (uDebug > 0.5) {
    if (uDebug < 1.5) color = uPaperColor * (room + warm);
    else if (uDebug < 2.5) color = albedo * (uAmbient + warm);
    else if (uDebug < 3.5) color = N * 0.5 + 0.5;
    else color = vec3(0.8);
  }
  gl_FragColor = vec4(color, 1.0);
}
`;

/** A cover: local position (x out from the spine, y through the wood, z along the spine) and normal, for the grain. */
export const WOOD_VERTEX = /* glsl */ `
varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vLocal;
varying vec3 vLocalN;
void main() {
  vLocal = position;
  vLocalN = normal;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

/**
 * Walnut veneer over plywood: grain along the cover, dark pores, a satin
 * finish; the cut edges show the pale core and glue lines; the front cover
 * carries the magnet's slot at its fore edge.
 */
export const WOOD_FRAGMENT = /* glsl */ `
uniform vec3 uWoodDark;
uniform vec3 uWoodMid;
uniform vec3 uWoodLight;
uniform float uMagnet;
uniform float uThick;
uniform float uFore;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vLocal;
varying vec3 vLocalN;
void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(uCamPos - vWorld);
  vec3 ln = normalize(vLocalN);
  float edge = 1.0 - smoothstep(0.35, 0.75, abs(ln.y));
  // Straight, fine walnut grain running along the cover, gently wandering; a few darker bands.
  float warp = fbm(vec2(vLocal.x * 0.25, vLocal.z * 0.5) + 2.0);
  float streak = fbm(vec2(vLocal.x * 1.2, vLocal.z * 22.0 + warp * 4.0) + 9.0);
  float bands = 0.5 + 0.5 * sin((vLocal.z * 0.6 + warp * 2.0) * 3.0);
  float pores = vnoise(vec2(vLocal.x * 60.0, vLocal.z * 6.0));
  vec3 wood = mix(uWoodDark, uWoodMid, 0.35 + 0.5 * streak);
  wood = mix(wood, uWoodLight, 0.22 * smoothstep(0.6, 0.95, streak) * bands);
  wood = mix(wood, uWoodDark, 0.25 * smoothstep(0.7, 1.0, bands));
  wood *= 0.92 + 0.08 * pores;
  float t = clamp(vLocal.y / uThick, 0.0, 1.0);
  float core = smoothstep(0.1, 0.16, t) * (1.0 - smoothstep(0.84, 0.9, t));
  float lines = smoothstep(0.02, 0.0, abs(t - 0.34)) + smoothstep(0.02, 0.0, abs(t - 0.66));
  vec3 ply = mix(uWoodDark * 0.7, uWoodMid * 1.15, core) * (1.0 + 0.5 * lines);
  wood = mix(wood, ply, edge);
  if (uMagnet > 0.5 && ln.y > 0.5) {
    vec2 q = abs(vec2(vLocal.x - (uFore - 0.9), vLocal.z)) - vec2(0.7, 0.28);
    float sd = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
    float slot = 1.0 - smoothstep(-0.03, 0.03, sd);
    wood = mix(wood, vec3(0.02, 0.018, 0.016), slot * 0.9);
  }
  float key = max(dot(N, uKeyDir), 0.0);
  vec3 H = normalize(uKeyDir + V);
  float spec = pow(max(dot(N, H), 0.0), 38.0) * 0.35;
  vec4 ll = lampLight(vWorld, 2.0);
  float warmDiff = ll.w * max(dot(N, ll.xyz), 0.0);
  vec3 color = wood * (uAmbient * (0.7 + 0.3 * N.y) + uKeyColor * key + uWarm * warmDiff * 0.9) + uKeyColor * spec;
  float fres = pow(1.0 - max(dot(N, V), 0.0), 5.0);
  color += fres * 0.06 * (uKeyColor + uWarm * ll.w * 0.3);
  gl_FragColor = vec4(color, 1.0);
}
`;

/**
 * The spine: a strip of dark hide bent along the hub arc the folds sit on
 * (the arc through uChordA → uChordB turning uArc, bulging toward the pages),
 * its back a little behind the folds. position = (s along the strip 0..1, v
 * along the spine, side -1 inside → +1 outside).
 */
export const HINGE_VERTEX = /* glsl */ `
uniform float uArc;
uniform vec2 uChordA;
uniform vec2 uChordB;
uniform float uHeight;
uniform float uInset;
uniform float uThick;
attribute float aKind;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec2 vUv;
float sinc(float x) { return abs(x) < 1e-4 ? 1.0 - x * x / 6.0 : sin(x) / x; }
void main() {
  vec2 d = uChordB - uChordA;
  float chord = max(length(d), 1e-5);
  vec2 u = d / chord;
  vec2 r = vec2(u.y, -u.x);   // to the right of the chord: the pages' side
  vec2 m = (uChordA + uChordB) * 0.5;
  float t = position.x - 0.5;
  float along = chord * t * sinc(uArc * t) / sinc(uArc * 0.5);
  float across = uArc > 1e-5 ? chord * 0.5 * (cos(uArc * t) - cos(uArc * 0.5)) / sin(uArc * 0.5) : 0.0;
  vec2 p = m + u * along + r * across;
  // The tangent along the strip, and the outward normal (away from the pages): the left of the travel direction.
  float dAlong = chord * cos(uArc * t) / sinc(uArc * 0.5);
  float dAcross = uArc > 1e-5 ? -chord * 0.5 * uArc * sin(uArc * t) / sin(uArc * 0.5) : 0.0;
  vec2 tangent = normalize(u * dAlong + r * dAcross);
  vec2 outN = vec2(-tangent.y, tangent.x);
  float side = position.z * 0.5 + 0.5;
  vec2 q = p + outN * (uInset + side * uThick);
  vec3 nl = aKind < 0.5 ? vec3(outN * position.z, 0.0) : vec3(0.0, 0.0, aKind < 1.5 ? -1.0 : 1.0);
  vec3 local = vec3(q, (position.y - 0.5) * uHeight);
  vec4 world = modelMatrix * vec4(local, 1.0);
  vWorld = world.xyz;
  vNormal = normalize(mat3(modelMatrix) * nl);
  vUv = position.xy;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const HINGE_FRAGMENT = /* glsl */ `
uniform vec3 uHide;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec2 vUv;
void main() {
  vec3 N = normalize(vNormal);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(uCamPos - vWorld);
  float grain = vnoise(vUv * vec2(30.0, 220.0));
  vec3 hide = uHide * (0.9 + 0.2 * grain);
  float key = max(dot(N, uKeyDir), 0.0);
  vec4 ll = lampLight(vWorld, 1.0);
  float warmDiff = ll.w * max(dot(N, ll.xyz), 0.0);
  vec3 H = normalize(uKeyDir + V);
  float spec = pow(max(dot(N, H), 0.0), 16.0) * 0.12;
  vec3 color = hide * (uAmbient * (0.7 + 0.3 * N.y) + uKeyColor * key + uWarm * warmDiff * 0.6) + uKeyColor * spec;
  gl_FragColor = vec4(color, 1.0);
}
`;

/** The LED bar itself: a dark part when off, far brighter than white when on, for the bloom. */
export const EMITTER_VERTEX = /* glsl */ `
void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
export const EMITTER_FRAGMENT = /* glsl */ `
uniform vec3 uWarm;
uniform float uLight;
void main() { gl_FragColor = vec4(mix(vec3(0.05, 0.045, 0.04), uWarm * 12.0, uLight), 1.0); }
`;

/** The desk: the page's own ground, the lamp's pool of light on it, a soft shadow under the lamp, fading into the backdrop. */
export const FLOOR_VERTEX = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;
export const FLOOR_FRAGMENT = /* glsl */ `
uniform vec3 uGround;
uniform vec3 uShadowCenter;
uniform vec2 uShadowHalf;
uniform float uShadowStrength;
varying vec3 vWorld;
void main() {
  vec4 ll = lampLight(vWorld, 2.5);
  float pool = ll.w * max(ll.xyz.y, 0.0) * 0.7;
  vec2 q = abs(vWorld.xz - uShadowCenter.xz) - uShadowHalf;
  float sd = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
  float shadow = 1.0 - uShadowStrength * (1.0 - smoothstep(-0.6, 2.4, sd));
  vec3 base = uGround * (uAmbient * 0.95 + uKeyColor * max(uKeyDir.y, 0.0) * 0.6);
  vec3 color = base * shadow + uWarm * pool * (0.4 + 0.6 * uGround);
  float away = smoothstep(30.0, 140.0, length(vWorld.xz));
  color = mix(color, uGround, away);
  gl_FragColor = vec4(color, 1.0);
}
`;

/** Full-screen passes. */
export const SCREEN_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

/** Bright pass with a soft knee. */
export const BRIGHT_FRAGMENT = /* glsl */ `
uniform sampler2D uTex;
uniform float uThreshold;
uniform float uKnee;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(uTex, vUv).rgb;
  float l = max(c.r, max(c.g, c.b));
  float soft = clamp(l - uThreshold + uKnee, 0.0, 2.0 * uKnee);
  soft = soft * soft / (4.0 * uKnee + 1e-4);
  float contrib = max(soft, l - uThreshold) / max(l, 1e-4);
  gl_FragColor = vec4(c * contrib, 1.0);
}
`;

/** A 13-tap gaussian along uDir (already divided by the texture size). */
export const BLUR_FRAGMENT = /* glsl */ `
uniform sampler2D uTex;
uniform vec2 uDir;
varying vec2 vUv;
void main() {
  float w[7];
  w[0] = 0.1964; w[1] = 0.1747; w[2] = 0.1210; w[3] = 0.0653; w[4] = 0.0274; w[5] = 0.0090; w[6] = 0.0023;
  vec3 c = texture2D(uTex, vUv).rgb * w[0];
  for (int i = 1; i < 7; i++) {
    vec2 o = uDir * float(i);
    c += texture2D(uTex, vUv + o).rgb * w[i];
    c += texture2D(uTex, vUv - o).rgb * w[i];
  }
  gl_FragColor = vec4(c, 1.0);
}
`;

/**
 * Scene + bloom, exposed, soft-clipped (linear below the knee, a shoulder to
 * white above it, per channel so the hub burns to white like the video),
 * dithered, encoded to sRGB.
 */
export const COMPOSITE_FRAGMENT = /* glsl */ `
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform float uBloomStrength;
uniform float uExposure;
varying vec2 vUv;
vec3 softclip(vec3 x) {
  const float k = 0.86;
  vec3 over = k + (1.0 - k) * (1.0 - exp(-(x - k) / (1.0 - k)));
  return mix(x, over, step(vec3(k), x));
}
void main() {
  vec3 c = texture2D(uScene, vUv).rgb + texture2D(uBloom, vUv).rgb * uBloomStrength;
  c = softclip(c * uExposure);
  float dither = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
  c += dither / 255.0;
  gl_FragColor = vec4(max(c, 0.0), 1.0);
  #include <colorspace_fragment>
}
`;
