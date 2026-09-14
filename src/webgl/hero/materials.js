import * as THREE from 'three';
import { SURFACE_LIGHTING } from './lighting.glsl.js';

export function createSolidMaterial(palette) {
  const material = new THREE.ShaderMaterial({
    vertexShader: `
      varying vec3 vView, vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 view = modelViewMatrix * vec4(position, 1.0);
        vView = view.xyz;
        gl_Position = projectionMatrix * view;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor, uShade, uHighlight;
      uniform float uRoughness, uOpacity;
      varying vec3 vView, vNormal;
      ${SURFACE_LIGHTING}
      void main() {
        gl_FragColor = vec4(shadeSurface(vView, normalize(vNormal)), uOpacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    uniforms: {
      uColor: { value: new THREE.Color() },
      uShade: { value: new THREE.Color() },
      uHighlight: { value: new THREE.Color() },
      uRoughness: { value: .32 },
      uOpacity: { value: 1 },
    },
  });
  paintSolid(material, palette);
  return material;
}

export function paintSolid(material, palette) {
  material.uniforms.uColor.value.set(palette.figure);
  material.uniforms.uShade.value.set(palette.figureShade);
  material.uniforms.uHighlight.value.set(palette.figureHighlight);
}
