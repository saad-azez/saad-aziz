/**
 * The sheet the loader is printed on, and the tear through it.
 *
 * It needs no picture of the page: the sheet really is lying on top of the live
 * page, so where the tear opens (transparent here) the page itself shows through.
 *
 * The hole is the star's own shape grown: an astroid, whose four cusps run ahead
 * as tear lines to the edges of the screen and whose concave sides then open.
 * Its edge is kept minimal, like the glint it grows from: one fine ink outline,
 * only slightly ragged so it reads as torn paper rather than a cut.
 *
 * The raggedness comes from one baked tiling texture, so a full-screen pass stays
 * cheap on a phone.
 */
export const VERTEX = `
attribute vec2 aPosition;
void main() { gl_Position = vec4(aPosition, 0., 1.); }
`;

export const FRAGMENT = `
precision highp float;
uniform vec2 uRes;
uniform float uPx;
uniform vec2 uStar;
uniform float uHole, uAmp, uLine, uStarSize, uFade;
uniform vec4 uSmileRect, uCountRect;
uniform sampler2D uSmile, uCount, uNoise;
uniform vec3 uGlow, uGround, uEdge, uInk, uAccent;

const vec2 SHAPE = vec2(.52, 1.);

// The star's gauge: 1:1 with distance along the tall axis, and growing it grows the star.
float gauge(vec2 q) {
  vec2 a = abs(q) / SHAPE + .001;
  float s = sqrt(a.x) + sqrt(a.y);
  return s * s;
}
vec2 gaugeSlope(vec2 q) {
  vec2 a = abs(q) / SHAPE + .001;
  float s = sqrt(a.x) + sqrt(a.y);
  return sign(q) * vec2(s / sqrt(a.x) / SHAPE.x, s / sqrt(a.y));
}
vec4 noise(vec2 p, float tile) { return texture2D(uNoise, p / (uPx * tile)); }
vec4 printed(sampler2D map, vec4 rect, vec2 p) {
  vec2 uv = (p - rect.xy) / rect.zw;
  vec2 inside = step(vec2(0.), uv) * step(uv, vec2(1.));
  return texture2D(map, uv) * inside.x * inside.y;
}
vec3 sheet(vec2 p) {
  float t = length((p / uRes - .5) / .75);
  vec3 colour = t < .65 ? mix(uGlow, uGround, t / .65) : mix(uGround, uEdge, min((t - .65) / .35, 1.));
  return colour * (1. + (noise(p, 190.).a - .5) * .022);
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 q = p - uStar;
  float g = gauge(q);
  float steep = length(gaugeSlope(q));
  // Along the star's axes the slope runs to infinity. Outside the hole a steep limit makes the fine tear lines ahead
  // of the cusps; inside it a low one keeps the edge an even width, with no streak down the axis.
  float steepOut = clamp(steep, .001, 7.);
  float steepIn = clamp(steep, .001, 2.4);

  // Distance in device pixels from the tear's edge: negative inside the hole.
  float edge = 1e5;
  if (uHole > 0.) {
    float angle = atan(q.y, q.x) / 6.2831853;
    vec4 wide = noise(p, 780.);
    // Pulled along the tear, so the edge wavers in the direction the paper went.
    vec4 grain = texture2D(uNoise, vec2(angle * 7., length(q) / (uPx * 620.)));
    float jag = (wide.g - .5) + (grain.b - .5) * .7;
    edge = (g - uHole) / (g < uHole ? steepIn : steepOut) + jag * uAmp;
  }

  vec3 colour = sheet(p);
  colour = mix(colour, uInk, printed(uSmile, uSmileRect, p).r);
  vec4 count = printed(uCount, uCountRect, p);
  colour = mix(colour, uInk, count.r);
  colour = mix(colour, uAccent, count.g);

  // The star, before it goes through and while the hole is smaller than it.
  if (uStarSize > 0.) {
    float s = (g - uStarSize) / steepOut / uPx;
    colour += uGlow * .1 * exp(-g / (uStarSize * 2.2));
    colour = mix(colour, uGlow, smoothstep(.6, -.6, s));
    colour = mix(colour, uInk, smoothstep(1.25, .55, abs(s)));
  }

  // The outline: a fine ink line just outside the hole.
  float line = 1. - smoothstep(uLine, uLine + uPx, edge);
  colour = mix(colour, uInk, line);

  float cover = smoothstep(0., uPx, edge);
  gl_FragColor = vec4(colour, 1.) * cover * uFade;
}
`;
