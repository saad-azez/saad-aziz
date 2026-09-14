import * as THREE from 'three';

// The shadow pass uses the very same deformation and reveal as the colour
// pass. A tight light frustum preserves detail in the thin letter strokes.
export default class ContactShadow {
  constructor(word, materials) {
    this.materials = materials;
    const size = window.innerWidth < 600 ? 512 : 1024;
    this.target = new THREE.WebGLRenderTarget(size, size, {
      minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
      depthBuffer: true,
    });
    this.target.depthTexture = new THREE.DepthTexture(size, size, THREE.UnsignedIntType);
    this.camera = new THREE.OrthographicCamera(-230, 230, 135, -135, 1, 900);
    this.matrix = new THREE.Matrix4();
    this.receiver = new THREE.Mesh(new THREE.PlaneGeometry(470, 250), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: {
        uDepth: { value: this.target.depthTexture },
        uShadowMatrix: { value: this.matrix },
        uTexel: { value: 1 / size },
        uStrength: { value: 0.14 },
      },
      vertexShader: /* glsl */ `
        uniform mat4 uShadowMatrix;
        varying vec4 vShadow;
        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          vShadow = uShadowMatrix * world;
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform sampler2D uDepth;
        uniform float uTexel, uStrength;
        varying vec4 vShadow;
        void main() {
          vec3 q = vShadow.xyz / vShadow.w;
          if (any(lessThan(q, vec3(0.0))) || any(greaterThan(q, vec3(1.0)))) discard;
          float blocked = 0.0, blocker = 0.0;
          for (int i = 0; i < 8; i++) {
            float a = float(i) * 2.399963;
            vec2 offset = vec2(cos(a), sin(a)) * sqrt(float(i)+0.5) * uTexel * 2.0;
            float z = texture2D(uDepth, q.xy + offset).r;
            if (z < q.z - 0.001) { blocked += 1.0; blocker += z; }
          }
          if (blocked < 0.5) discard;
          float spread = clamp((q.z - blocker / blocked) * 160.0, 1.0, 5.0);
          float shadow = 0.0;
          float rotation = fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)*6.28318;
          for (int i = 0; i < 24; i++) {
            float a = float(i) * 2.399963 + rotation;
            vec2 offset = vec2(cos(a), sin(a)) * sqrt((float(i)+0.5)/24.0) * uTexel * spread * 2.5;
            shadow += step(texture2D(uDepth, q.xy + offset).r + 0.0007, q.z);
          }
          gl_FragColor = vec4(0.035, 0.04, 0.045, uStrength * shadow / 24.0);
        }
      `,
    }));
    this.receiver.position.set(0, -2, -14);
    this.receiver.renderOrder = -10;
    this.receiver.frustumCulled = false;
    word.add(this.receiver);
  }

  fit(word) {
    const s = word.scale.x;
    this.camera.left = -230 * s; this.camera.right = 230 * s;
    this.camera.top = 135 * s; this.camera.bottom = -135 * s;
    this.camera.near = s; this.camera.far = 900 * s;
    this.camera.position.set(word.position.x - 45*s, word.position.y + 75*s, 300*s);
    this.camera.lookAt(word.position.x, word.position.y, 0);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld(true);
    this.matrix.set(0.5,0,0,0.5, 0,0.5,0,0.5, 0,0,0.5,0.5, 0,0,0,1)
      .multiply(this.camera.projectionMatrix).multiply(this.camera.matrixWorldInverse);
  }

  render(renderer, scene, backdrop, extras = []) {
    const previous = renderer.getRenderTarget();
    const clear = renderer.getClearColor(new THREE.Color()), alpha = renderer.getClearAlpha();
    const objects = [this.receiver, backdrop, ...extras];
    const visible = objects.map(o => o.visible);
    objects.forEach(o => { o.visible = false; });
    this.materials.forEach(m => { m.uniforms.uShadowPass.value = 1; });
    renderer.setRenderTarget(this.target);
    renderer.setClearColor(0xffffff, 1);
    renderer.clear();
    renderer.render(scene, this.camera);
    renderer.setRenderTarget(previous);
    renderer.setClearColor(clear, alpha);
    this.materials.forEach(m => { m.uniforms.uShadowPass.value = 0; });
    objects.forEach((o, i) => { o.visible = visible[i]; });
  }

  dispose() {
    this.target.dispose();
    this.receiver.geometry.dispose();
    this.receiver.material.dispose();
  }
}

