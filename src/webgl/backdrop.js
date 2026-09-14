import * as THREE from 'three';
import { HASH_2D } from './glsl/chunks.js';

/**
 * The site's backdrop: one full-screen wash of light, hand-written GLSL, drawn
 * behind the loader and behind the hero alike so the two share a background
 * exactly. Its colours are the page's own ground tokens, so where the canvas
 * ends and the DOM begins is invisible in either colour scheme.
 *
 * Static — the wash is drawn once, exactly as it looks on the first frame,
 * and again only when the viewport or the reader's scheme changes. It does
 * not brighten, flare or grain over time.
 */

const BACKDROP_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 1.0, 1.0);
}
`;

const BACKDROP_FRAGMENT = /* glsl */ `
precision highp float;
${HASH_2D}

uniform vec3 uGround;
uniform vec3 uGlow;
uniform vec3 uEdge;
uniform float uAspect;

varying vec2 vUv;

void main() {
  vec2 p = vUv - vec2(0.5, 0.52);
  p.x *= uAspect;
  float d = length(p);

  // A wide, even lift toward the middle and a gentle fall to the corners —
  // a lit wall, not a spotlight. Held still: the backdrop never brightens,
  // flares or shifts.
  vec3 color = mix(uGround, uGlow, exp(-d * d * 1.5) * 0.7);
  color = mix(color, uEdge, smoothstep(0.45, 1.15, d) * 0.6);

  // The tokens are sRGB and were decoded to linear on the way in; back out the
  // same way, so the canvas matches the stylesheet's colours to the digit.
  color = pow(max(color, 0.0), vec3(1.0 / 2.2));

  // A fixed film grain keeps the flat tones from banding across the gradient
  // — added after the encode, so it is the same faint texture on a dark
  // ground as on a light one.
  float grain = hash21(vUv * 900.0);
  color += (grain - 0.5) * 0.012;

  gl_FragColor = vec4(color, 1.0);
}
`;

export function createBackdrop(palette) {
  const material = new THREE.ShaderMaterial({
    vertexShader: BACKDROP_VERTEX,
    fragmentShader: BACKDROP_FRAGMENT,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uGround: { value: new THREE.Color() },
      uGlow: { value: new THREE.Color() },
      uEdge: { value: new THREE.Color() },
      uAspect: { value: 1 },
    },
  });
  paintBackdrop(material, palette);

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  return mesh;
}

/** Re-colour a backdrop from a (possibly changed) palette. */
export function paintBackdrop(material, palette) {
  material.uniforms.uGround.value.set(palette.ground);
  material.uniforms.uGlow.value.set(palette.groundGlow);
  material.uniforms.uEdge.value.set(palette.groundEdge);
}
