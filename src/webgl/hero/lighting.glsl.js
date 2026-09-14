export const SURFACE_LIGHTING = /* glsl */ `
vec3 shadeSurface(vec3 viewPosition, vec3 n) {
  vec3 key = normalize(vec3(-0.65, 1.1, 1.3));
  vec3 view = normalize(-viewPosition);
  vec3 halfDir = normalize(key + view);
  float nl = max(dot(n, key), 0.0), nv = max(dot(n, view), 0.001);
  float nh = max(dot(n, halfDir), 0.0), vh = max(dot(view, halfDir), 0.0);
  float a2 = pow(uRoughness, 4.0);
  float denom = nh * nh * (a2 - 1.0) + 1.0;
  float distribution = a2 / max(3.14159 * denom * denom, 0.001);
  float k = pow(uRoughness + 1.0, 2.0) / 8.0;
  float geometry = (nl / (nl * (1.0-k)+k)) * (nv / (nv * (1.0-k)+k));
  vec3 fresnel = vec3(0.045) + vec3(0.955) * pow(1.0-vh, 5.0);
  vec3 specular = distribution * geometry * fresnel / max(4.0*nl*nv, 0.001);
  float fill = max(dot(n, normalize(vec3(0.8,-0.2,0.6))), 0.0);
  vec3 color = uColor * (0.46 + nl * 0.55 + fill * 0.11);
  color += uHighlight * specular * nl * 1.1;
  // Two large photographic softboxes: broad highlight on the shoulder,
  // narrow return on the edge. No external environment map is needed.
  vec3 reflected = reflect(-view, n);
  float box1 = exp(-pow((reflected.x + 0.5) / 0.32, 6.0) - pow((reflected.y - 0.6) / 0.85, 6.0));
  float box2 = exp(-pow((reflected.x - 0.85) / 0.10, 2.0) - pow(reflected.y / 1.3, 6.0));
  float grazing = pow(1.0-nv, 3.0);
  color += uHighlight * (box1 * 0.12 + box2 * 0.08) * (0.35 + grazing);
  return color;
}
`;
