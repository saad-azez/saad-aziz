/**
 * Small hand-written GLSL chunks shared between the raw-shader materials.
 * Each export is a string that is spliced into a shader source with `${...}`.
 */

/**
 * `hash21(vec2) -> float` — a cheap, deterministic 2D hash in [0, 1).
 * The classic sin/fract construction: good enough for film grain and
 * dithering, stable across frames because it only depends on its input.
 */
export const HASH_2D = /* glsl */ `
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
`;

/**
 * `noise31(vec3) -> float` — smooth value noise in [0, 1), trilinear between
 * hashed lattice points. Cheap and stable: it depends only on its input, so
 * a surface noised by it does not crawl when the camera or the clock moves.
 */
export const NOISE_3D = /* glsl */ `
float hash31(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise31(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash31(i + vec3(0, 0, 0)), hash31(i + vec3(1, 0, 0)), f.x),
        mix(hash31(i + vec3(0, 1, 0)), hash31(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(hash31(i + vec3(0, 0, 1)), hash31(i + vec3(1, 0, 1)), f.x),
        mix(hash31(i + vec3(0, 1, 1)), hash31(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}
`;
