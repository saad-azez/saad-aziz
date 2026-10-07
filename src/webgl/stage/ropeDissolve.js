// The transition is a pure function of scroll: no time-based noise or springs.
// Reversing the wheel reconstructs exactly the same fibers in the same places.
const clamp = value => Math.max(0, Math.min(1, value));
const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };

export function ropeTransition(progress, reduced = false) {
  const p = clamp(progress);
  if (reduced) return { erase: p, reveal: p, fibers: false };
  return {
    erase: 1 - (1 - clamp(p / .64)) ** 1.6,
    reveal: smooth((p - .12) / .76),
    fibers: true,
  };
}

// Domain-warped, layered noise gives the cut its torn, contour-like edge.
// The meshes and loose fibers use the same field, so fibers leave the surface
// exactly where it erodes and gather exactly where the rail reappears.
export const DISSOLVE_FIELD = /* glsl */ `
float dissolveHash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(.1, .2, .3));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float dissolveNoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(dissolveHash(i), dissolveHash(i + vec3(1,0,0)), f.x),
    mix(dissolveHash(i + vec3(0,1,0)), dissolveHash(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(dissolveHash(i + vec3(0,0,1)), dissolveHash(i + vec3(1,0,1)), f.x),
    mix(dissolveHash(i + vec3(0,1,1)), dissolveHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float erosionField(float along, vec3 coordinate) {
  vec3 q = coordinate + 1.8 * vec3(dissolveNoise(coordinate * .45),
    dissolveNoise(coordinate * .45 + 7.3), dissolveNoise(coordinate * .45 + 19.1));
  float grain = .58 * dissolveNoise(q) + .28 * dissolveNoise(q * 2.1) + .14 * dissolveNoise(q * 5.7);
  return clamp((.42 * (1.0 - along) + .58 * grain - .18) / .64, .002, .998);
}
`;

// Laid across the copy (turned a quarter turn, so its x is the screen's up), the rope sags: a little of itself
// (uDroop, px at its middle), and under the coin's weight to a point where the coin stands (uLoad px, at uLoadS
// along it), straight from each end, as a rope does under a load. The stage's sagAt is the same sum.
const ROPE_SAG = /* glsl */ `
uniform float uLoad, uLoadS, uDroop;
float ropeSag(float s) {
  float c = clamp(uLoadS, .02, .98);
  return uLoad * min(s / c, (1.0 - s) / (1.0 - c)) + uDroop * 4.0 * s * (1.0 - s);
}
`;

export const DISSOLVE_VERTEX = /* glsl */ `
uniform float uRail, uSpan, uScale, uOutline, uR, uDissolve, uMotion;
uniform float uDip, uDipS, uDipW;
${ROPE_SAG}
attribute float aAlong, aS, aHair;
attribute vec2 aRoll;
attribute vec3 aNormalLocal;
varying float vAlong, vS, vHair;
varying vec2 vRoll;
varying vec3 vNormal, vNoiseCoord;
${DISSOLVE_FIELD}
void main() {
  vAlong = aAlong; vS = aS; vHair = aHair; vRoll = aRoll;
  vNoiseCoord = vec3(aAlong * 65.0, aRoll / uR * 1.8);
  vec3 n = normal;
  vec3 p = position;
  if (uRail > .5) {
    n = normalize(vec3(aNormalLocal.y, -aNormalLocal.x, aNormalLocal.z));
    p = vec3(aRoll.x * uScale - ropeSag(aAlong), -aAlong * uSpan, aRoll.y * uScale);
  } else {
    p.y -= uDip * exp(-pow((aS - uDipS) / max(uDipW, .001), 2.0));
  }
  float field = erosionField(aAlong, vNoiseCoord);
  float cut = mix(-.12, 1.12, uDissolve);
  float edge = (1.0 - smoothstep(0.0, .12, abs(field - cut)))
    * smoothstep(0.0, .06, uDissolve) * (1.0 - smoothstep(.94, 1.0, uDissolve));
  // Only the dissolving boundary ripples; the rope stays on its original path.
  p += n * (uOutline + sin(field * 95.0 - cut * 24.0) * edge * uMotion);
  vNormal = normalize(normalMatrix * n);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

export const FIBER_VERTEX = /* glsl */ `
uniform float uRail, uSpan, uScale, uR, uDissolve, uMotion, uDpr;
attribute float aAlong, aSeed;
attribute vec2 aRoll;
varying float vAlpha, vSeed;
${DISSOLVE_FIELD}
${ROPE_SAG}
void main() {
  vec3 coordinate = vec3(aAlong * 65.0, aRoll / uR * 1.8);
  float field = erosionField(aAlong, coordinate);
  float age = (mix(-.12, 1.12, uDissolve) - field) / .24;
  float life = clamp(age, 0.0, 1.0);
  vAlpha = sin(life * 3.14159265) * (1.0 - smoothstep(.86, 1.0, uDissolve));
  vSeed = aSeed;
  vec3 p = position;
  float angle = aSeed * 6.2831853 + life * 4.0;
  if (uRail > .5) {
    p = vec3(aRoll.x * uScale - ropeSag(aAlong), -aAlong * uSpan, aRoll.y * uScale);
    p += vec3(-abs(sin(angle)) * 7.0, cos(angle) * 9.0, 0.0) * life;
  } else {
    p += vec3(sin(angle) * 7.0, cos(angle * .7) * 5.0 + life * 5.0,
      sin(angle * .8) * 3.0) * life * uMotion;
  }
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = (1.0 + aSeed * 1.8) * uDpr;
}
`;

export const FIBER_FRAGMENT = /* glsl */ `
uniform vec3 uLight, uInk;
varying float vAlpha, vSeed;
void main() {
  vec2 uv = gl_PointCoord - .5;
  float angle = vSeed * 6.2831853;
  vec2 q = mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * uv;
  float fiber = 1.0 - smoothstep(.12, .42, length(q * vec2(1.0, 2.8)));
  float alpha = fiber * vAlpha * .8;
  if (alpha < .015) discard;
  gl_FragColor = vec4(mix(uInk, uLight, step(.3, vSeed)), alpha);
  #include <colorspace_fragment>
}
`;
