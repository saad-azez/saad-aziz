import * as THREE from 'three';
import gsap from 'gsap';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { SIGNATURE_PATHS } from './signature.paths.js';
import { paintSolid } from './materials.js';

const smooth = (a, b, t) => {
  const p = THREE.MathUtils.clamp((t - a) / (b - a), 0, 1);
  return p * p * (3 - 2 * p);
};
const mix = THREE.MathUtils.lerp;

export const D_DEFAULTS = { glow: .9, softness: 3.2, lift: 1.2, starSize: 1, rise: 1, spread: 1, spin: 1, stagger: .045 };
/**
 * The short entrance (see brand/intro.js): the plain word, then straight to
 * the rope and liquid dot. The material studies between are all still here, and play
 * with `play(delay, { full: true })`. Each entry is [clock time, seconds]; a null seconds
 * value jumps the clock there.
 */
export const SHORT_BEATS = [[.1, .3], [2.9, null]];

export const SEQUENCE_BEATS = [[.233, .32], [.367, .34], [.50, .38], [.73, .48], [1.3, 1.15], [1.83, .62], [2.9, null]];

// A single, seekable sequence. Times are relative to the plain word appearing
// at 1.30s in Screen Recording 2026-09-12 223237 (30 fps). No entrance stagger.
export default class SignatureSequence {
  constructor(owner) {
    this.owner = owner;
    this.materials = new Set();
    this.textures = new Set();
    this.clock = { time: 0 };
    this.dSettings = { ...D_DEFAULTS };
    const { letters, bodies, renderer } = owner;
    this.widths = letters.map(g => {
      const b = new THREE.Box3().setFromObject(g);
      return b.max.x - b.min.x;
    });
    this.layers = letters.map(g => {
      const layer = new THREE.Group();
      g.add(layer);
      return layer;
    });
    this.ink = this.flat(owner.palette.figure);
    this.slate = this.flat(owner.palette.figure);
    this.accent = this.flat(owner.palette.accent);
    this.sage = this.flat(owner.palette.accent);
    this.secondary = this.flat(owner.palette.figure);
    this.sBase = owner.material.clone();
    this.sBase.transparent = true;
    this.sBase.uniforms.uReveal = { value: 1 };
    this.sBase.vertexShader = 'varying float vLetterX;\n' + this.sBase.vertexShader.replace('vView = view.xyz;', 'vView = view.xyz; vLetterX = position.x;');
    this.sBase.fragmentShader = 'uniform float uReveal; varying float vLetterX;\n' + this.sBase.fragmentShader.replace('void main() {', 'void main() { if (vLetterX > mix(-40.0, 40.0, uReveal)) discard;');
    this.materials.add(this.sBase);
    bodies[0].material = this.sBase;

    this.slash = this.outline(SIGNATURE_PATHS.slash, 25, 72, this.slate);
    this.layers[1].add(this.slash);
    this.createFirstAWriting(bodies[1]);
    this.braces = this.outline(SIGNATURE_PATHS.braces, 43, 55, this.sage);
    this.layers[2].add(this.braces);
    this.aWire = new THREE.LineSegments(new THREE.EdgesGeometry(bodies[2].geometry),
      this.keep(new THREE.LineBasicMaterial({ color: owner.palette.accent, transparent: true })));
    this.layers[2].add(this.aWire);
    this.code = this.outline(SIGNATURE_PATHS.code, 59, 44, this.accent);
    this.layers[3].add(this.code);
    this.terminal = this.outline(SIGNATURE_PATHS.terminal, 39, 36, this.secondary);
    this.layers[4].add(this.terminal);

    // A continuous sculpted S: fuller bowls, a pinched waist and softly
    // closed ends. The changing cross-section avoids the old uniform hose.
    const curve = new THREE.CurvePath();
    const v = (x, y) => new THREE.Vector3(x, y, 0);
    curve.add(new THREE.CubicBezierCurve3(v(19, 23), v(6, 39), v(-28, 31), v(-22, 12)));
    curve.add(new THREE.CubicBezierCurve3(v(-22, 12), v(-17, -2), v(25, 4), v(22, -15)));
    curve.add(new THREE.CubicBezierCurve3(v(22, -15), v(18, -35), v(-10, -36), v(-22, -22)));
    const section = (segments, sides) => {
      const positions = [], indices = [];
      for (let j = 0; j <= segments; j++) {
        const u = j / segments;
        const point = curve.getPointAt(u), tangent = curve.getTangentAt(u);
        const rim = Math.min(1, u / .045, (1 - u) / .045);
        const cap = Math.sqrt(Math.max(.00001, 1 - (1 - rim) ** 2));
        const radius = (7.5 + 1.5 * Math.sin(u * Math.PI * 2) ** 2) * cap;
        for (let k = 0; k <= sides; k++) {
          const angle = k / sides * Math.PI * 2;
          const across = Math.cos(angle) * radius;
          positions.push(point.x - tangent.y * across, point.y + tangent.x * across, Math.sin(angle) * radius * .82);
          if (j < segments && k < sides) {
            const a = j * (sides + 1) + k, b = a + sides + 1;
            indices.push(a, a + 1, b, b, a + 1, b + 1);
          }
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setIndex(indices);
      geometry.computeBoundingBox();
      const box = geometry.boundingBox, centre = box.getCenter(new THREE.Vector3());
      const scale = 72 / (box.max.y - box.min.y);
      geometry.translate(-centre.x, -centre.y, 0);
      geometry.scale(scale, scale, scale);
      geometry.computeVertexNormals();
      return geometry;
    };
    const tube = section(144, 40);
    // Controlled studio cards: broad key, narrow return and soft face/floor fill.
    const studio = new THREE.Scene();
    studio.background = new THREE.Color(.025, .018, .022);
    const cards = [[-6, 5, 7, 9, 16, 3.0], [7, 1, 5, 2.5, 14, 3.8], [0, -6, 5, 12, 5, .8], [1, 3, 12, 7, 16, 1.5]];
    cards.forEach(([x, y, z, width, height, strength]) => {
      const card = new THREE.Mesh(new THREE.PlaneGeometry(width, height),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(strength, strength, strength), side: THREE.DoubleSide }));
      card.position.set(x, y, z); card.lookAt(0, 0, 0); studio.add(card);
    });
    const pmrem = new THREE.PMREMGenerator(renderer);
    this.environment = pmrem.fromScene(studio, .025);
    studio.traverse(object => { object.geometry?.dispose(); object.material?.dispose(); });
    pmrem.dispose();
    // Fine longitudinal brushing. Deterministic data keeps refreshes identical.
    const grain = new Uint8Array(256 * 256 * 4);
    let seed = 19;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    for (let y = 0; y < 256; y++) {
      const stroke = random();
      for (let x = 0; x < 256; x++) {
        const value = Math.round(185 + stroke * 45 + random() * 25);
        const i = (y * 256 + x) * 4;
        grain[i] = grain[i + 1] = grain[i + 2] = value; grain[i + 3] = 255;
      }
    }
    const brushed = new THREE.DataTexture(grain, 256, 256);
    brushed.wrapS = brushed.wrapT = THREE.RepeatWrapping;
    brushed.repeat.set(2, 4); brushed.magFilter = THREE.LinearFilter;
    brushed.minFilter = THREE.LinearMipmapLinearFilter; brushed.generateMipmaps = true;
    brushed.needsUpdate = true; this.textures.add(brushed);
    this.satinColor = new THREE.Color(); this.polishedColor = new THREE.Color();
    this.satin = this.keep(new THREE.MeshPhysicalMaterial({
      metalness: .82, roughness: .43, clearcoat: .30, anisotropy: .35,
      clearcoatRoughness: .26, envMap: this.environment.texture,
      envMapIntensity: .95, roughnessMap: brushed, bumpMap: brushed,
      bumpScale: .025, transparent: true,
    }));
    this.sweep = { value: 0 };
    this.satin.onBeforeCompile = shader => {
      shader.uniforms.uSweep = this.sweep;
      shader.vertexShader = 'varying float vSculptX;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvSculptX = position.x;');
      shader.fragmentShader = 'uniform float uSweep; varying float vSculptX;\n' + shader.fragmentShader.replace('#include <alphatest_fragment>', '#include <alphatest_fragment>\nif (uSweep > 0.0 && vSculptX < mix(-45.0,45.0,uSweep)) discard;');
    };
    this.premium = new THREE.Group();
    this.premium.position.z = 8;
    this.premium.add(new THREE.Mesh(tube, this.satin));
    this.layers[0].add(this.premium);
    this.wireMaterial = this.keep(new THREE.LineBasicMaterial({ color: owner.palette.ink, transparent: true, opacity: 0 }));
    const cage = section(28, 8);
    this.wire = new THREE.LineSegments(new THREE.WireframeGeometry(cage), this.wireMaterial);
    cage.dispose();
    this.wire.position.z = 9;
    this.layers[0].add(this.wire);

    this.paragraph = new THREE.Group();
    [35, 45, 30].forEach((width, i) => {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(width, 5, 2), this.sage);
      bar.position.set(-22 + width / 2, 14 - i * 14, 4);
      this.paragraph.add(bar);
    });
    this.caret = new THREE.Group();
    [[1.5, 48, 0, 0], [8, 1.5, 0, 24], [8, 1.5, 0, -24]].forEach(([w, h, x, y]) => {
      const part = new THREE.Mesh(new THREE.BoxGeometry(w, h, 1), this.ink);
      part.position.set(x, y, 7); this.caret.add(part);
    });
    this.paragraph.add(this.caret);
    this.layers[3].add(this.paragraph);

    // Blur the actual front-face silhouette behind the untouched D. The body
    // occludes its fill, leaving light around both the outer rim and counter.
    const dBox = bodies[3].geometry.boundingBox;
    this.dTop = dBox.max.y;
    this.dMask = document.createElement('canvas'); this.dMask.width = this.dMask.height = 512;
    this.dGlowCanvas = document.createElement('canvas'); this.dGlowCanvas.width = this.dGlowCanvas.height = 512;
    const margin = 20, width = dBox.max.x - dBox.min.x + margin * 2;
    const height = dBox.max.y - dBox.min.y + margin * 2;
    this.dGlowSize = { width, height };
    const mask = this.dMask.getContext('2d'); mask.fillStyle = '#fff';
    const positions = bodies[3].geometry.attributes.position, normals = bodies[3].geometry.attributes.normal;
    mask.beginPath();
    for (let n = 0; n < positions.count; n += 3) {
      if (normals.getZ(n) < .999 || normals.getZ(n + 1) < .999 || normals.getZ(n + 2) < .999) continue;
      for (let k = 0; k < 3; k++) {
        const x = (positions.getX(n + k) - dBox.min.x + margin) / width * 512;
        const y = (dBox.max.y + margin - positions.getY(n + k)) / height * 512;
        if (!k) mask.moveTo(x, y); else mask.lineTo(x, y);
      }
      mask.closePath();
    }
    mask.fill();
    this.dGlowTexture = new THREE.CanvasTexture(this.dGlowCanvas);
    this.textures.add(this.dGlowTexture);
    this.dGlowMaterial = this.keep(new THREE.MeshBasicMaterial({ map: this.dGlowTexture,
      transparent: true, depthWrite: false, opacity: 0 }));
    this.dGlow = new THREE.Mesh(new THREE.PlaneGeometry(width, height), this.dGlowMaterial);
    this.dGlow.position.set((dBox.min.x + dBox.max.x) / 2, (dBox.min.y + dBox.max.y) / 2, -5);
    this.layers[3].add(this.dGlow);
    this.updateGlow();
    this.stars = [0, 1, 2].map(() => {
      const shape = new THREE.Shape();
      for (let k = 0; k < 8; k++) {
        const angle = Math.PI / 2 + k * Math.PI / 4;
        const radius = k % 2 ? 2.3 : 7.7;
        const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
        if (!k) shape.moveTo(x, y); else shape.lineTo(x, y);
      }
      shape.closePath();
      const material = this.keep(new THREE.MeshPhysicalMaterial({
        color: owner.palette.accent, metalness: .7, roughness: .28,
        clearcoat: .65, envMap: this.environment.texture,
      }));
      const star = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, {
        depth: 3, bevelEnabled: true, bevelSize: .8,
        bevelThickness: .8, bevelSegments: 3,
      }), material);
      this.layers[3].add(star); return star;
    });

    // The terminal becomes a cloth flag. Its mesh unfurls and folds back into
    // the stem; the coin remains separate geometry throughout the sequence.
    const flagCanvas = document.createElement('canvas'); flagCanvas.width = 512; flagCanvas.height = 384;
    const f = flagCanvas.getContext('2d');
    f.fillStyle = '#12151b'; f.fillRect(0, 0, 512, 384);
    f.strokeStyle = '#f6f3ec'; f.lineWidth = 24; f.lineCap = 'round';
    [[165, 115, 345, 300], [345, 115, 165, 300]].forEach(([a,b,c,d]) => { f.beginPath(); f.moveTo(a,b); f.lineTo(c,d); f.stroke(); });
    f.fillStyle = '#f6f3ec'; f.beginPath(); f.ellipse(256, 177, 87, 79, 0, 0, Math.PI * 2); f.fill();
    f.fillRect(212, 220, 88, 60);
    f.fillStyle = '#12151b';
    [221, 291].forEach(x => { f.beginPath(); f.ellipse(x, 181, 21, 26, 0, 0, Math.PI * 2); f.fill(); });
    f.beginPath(); f.moveTo(256, 209); f.lineTo(244, 230); f.lineTo(268, 230); f.fill();
    f.strokeStyle = '#12151b'; f.lineWidth = 5; f.lineCap = 'butt';
    [232, 256, 280].forEach(x => { f.beginPath(); f.moveTo(x, 246); f.lineTo(x, 280); f.stroke(); });
    const flagTexture = new THREE.CanvasTexture(flagCanvas); flagTexture.colorSpace = THREE.SRGBColorSpace; this.textures.add(flagTexture);
    this.flag = new THREE.Mesh(new THREE.PlaneGeometry(42, 45, 24, 12),
      this.keep(new THREE.MeshBasicMaterial({ map: flagTexture, side: THREE.DoubleSide })));
    this.flag.position.set(0, -7, 4);
    this.stemBounds = bodies[4].geometry.boundingBox.clone();
    this.flagVertices = this.flag.geometry.attributes.position.array.slice();
    this.layers[4].add(this.flag);
    this.paintPalette();
    this.reset();
    const rate = 180;
    const raw = Array.from({ length: Math.ceil(2.9 * rate) + 1 }, (_, i) => {
      this.paint(i / rate);
      return letters.map(letter => letter.position.x);
    });
    this.layoutRate = rate;
    this.layoutTrack = raw.map((row, i) => row.map((_, letter) => {
      let total = 0, weight = 0;
      for (let k = -7; k <= 7; k++) {
        const w = 8 - Math.abs(k);
        total += raw[Math.max(0, Math.min(raw.length - 1, i + k))][letter] * w;
        weight += w;
      }
      return total / weight;
    }));
    this.reset();

    // Compile every variant before the loader reports WebGL ready.
    this.layers.forEach(layer => layer.traverse(obj => { obj.visible = true; }));
    renderer.compile(owner.scene, owner.camera);
    this.reset();
  }

  createFirstAWriting(body) {
    const lowerGeometry = new THREE.ExtrudeGeometry(this.owner.font.generateShapes('a', 70), {
      depth: 5, bevelEnabled: true, bevelThickness: .45, bevelSize: .06,
      bevelSegments: 3, curveSegments: 36,
    });
    lowerGeometry.computeBoundingBox();
    const lowerWidth = lowerGeometry.boundingBox.max.x - lowerGeometry.boundingBox.min.x;
    const lowerHeight = lowerGeometry.boundingBox.max.y - lowerGeometry.boundingBox.min.y;
    lowerGeometry.scale(44 / lowerWidth, 47 / lowerHeight, 1);
    lowerGeometry.center();
    const lower = new THREE.Mesh(lowerGeometry, body.material);
    lower.geometry.computeBoundingBox();
    lower.geometry.translate(0,body.geometry.boundingBox.min.y-lower.geometry.boundingBox.min.y,0);
    lower.position.z = 0;
    this.firstAWriting = new THREE.Group();
    this.layers[1].add(this.firstAWriting);
    const filledReveal = (source, strokes) => {
      // Copy the existing filled front face exactly. No substitute outline,
      // stroke mesh, or exposed extrusion is used during the reveal.
      const pos = source.geometry.attributes.position, normal = source.geometry.attributes.normal;
      const vertices = [], normals = [];
      for (let i=0; i<pos.count; i+=3) {
        if (normal.getZ(i)<.999 || normal.getZ(i+1)<.999 || normal.getZ(i+2)<.999) continue;
        for (let j=i;j<i+3;j++) { vertices.push(pos.getX(j),pos.getY(j),pos.getZ(j)); normals.push(0,0,1); }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
      geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
      geometry.computeBoundingBox();
      const box = geometry.boundingBox, size = box.getSize(new THREE.Vector3());
      const canvas = document.createElement('canvas'); canvas.width=canvas.height=512;
      const context = canvas.getContext('2d');
      const texture = new THREE.CanvasTexture(canvas);
      texture.minFilter=texture.magFilter=THREE.LinearFilter; texture.generateMipmaps=false;
      this.textures.add(texture);
      const material = this.keep(this.owner.material.clone());
      material.transparent=true;
      material.uniforms.uInkMask={value:texture};
      material.uniforms.uInkBounds={value:new THREE.Vector4(box.min.x,box.min.y,size.x,size.y)};
      material.vertexShader='varying vec2 vInkPoint;\n'+material.vertexShader.replace('vView = view.xyz;','vView = view.xyz; vInkPoint = position.xy;');
      material.fragmentShader='uniform sampler2D uInkMask; uniform vec4 uInkBounds; varying vec2 vInkPoint;\n'+material.fragmentShader.replace('gl_FragColor = vec4(shadeSurface(vView, normalize(vNormal)), uOpacity);',`
        vec2 uv=(vInkPoint-uInkBounds.xy)/uInkBounds.zw;
        float coverage=texture2D(uInkMask,uv).a;
        if (coverage < .004) discard;
        gl_FragColor=vec4(shadeSurface(vView,normalize(vNormal)),uOpacity*coverage);`);
      const mesh = new THREE.Mesh(geometry,material);
      mesh.position.copy(source.position);
      mesh.userData.reveal={context,texture,last:-1,strokes:strokes.map(([points,start,end])=>({
        curve:new THREE.CatmullRomCurve3(points.map(([x,y,r])=>new THREE.Vector3(x,y,r)),false,'centripetal'),start,end,
      }))};
      return mesh;
    };
    this.lowerA=filledReveal(lower,[
      [[[.62,.88,.13],[.36,.95,.20],[.11,.72,.25],[.10,.28,.26],[.27,.07,.22],[.51,.18,.15],[.62,.62,.12],[.62,.90,.12]],0,.67],
      [[[.76,.99,.21],[.79,.64,.21],[.80,.24,.22],[.87,.06,.22],[1,.02,.14]],.70,1],
    ]);
    this.writtenA=filledReveal(body,[
      [[[.05,.02,.19],[.24,.05,.22],[.29,.30,.09],[.38,.63,.085],[.48,.92,.10],[.41,1,.15]],0,.32],
      [[[.37,1,.15],[.54,.95,.18],[.63,.62,.18],[.77,.21,.20],[.84,.06,.23],[.99,.02,.17]],.35,.79],
      [[[.66,.35,.10],[.48,.43,.09],[.29,.45,.09],[.08,.44,.09]],.82,1],
    ]);
    this.firstAWriting.add(this.lowerA,this.writtenA);
    const oldSlash=this.slash;
    this.slash=filledReveal(oldSlash,[[[[.86,.99,.21],[.5,.5,.21],[.15,.01,.21]],0,1]]);
    this.layers[1].remove(oldSlash);this.layers[1].add(this.slash);
    oldSlash.geometry.dispose(); lower.geometry.dispose();
  }

  revealFilledLetter(mesh, progress, opacity=1) {
    mesh.material.uniforms.uOpacity.value=opacity;
    const state=mesh.userData.reveal;
    if (state.last===progress) return;
    state.last=progress;
    const ctx=state.context, size=512;
    ctx.clearRect(0,0,size,size); ctx.fillStyle='#fff';ctx.strokeStyle='#fff';ctx.lineCap='round';ctx.lineJoin='round';
    if (progress>=1) ctx.fillRect(0,0,size,size);
    else for (const {curve,start,end} of state.strokes) {
      const p=THREE.MathUtils.clamp((progress-start)/(end-start),0,1);
      if (p<=0) continue;
      // The moving coverage is invisible. Only the original filled face shows
      // through it, so nib width can never alter the type's actual outline.
      const travel=p*p*(3-2*p), steps=Math.ceil(travel*240);
      for (let i=0;i<=steps;i++) {
        const point=curve.getPoint(travel*i/steps);
        ctx.beginPath();ctx.ellipse(point.x*size,(1-point.y)*size,point.z*size,point.z*size*.80,0,0,Math.PI*2);ctx.fill();
      }
    }
    state.texture.needsUpdate=true;
  }

  keep(material) { this.materials.add(material); return material; }
  flat(color) { return this.keep(new THREE.MeshBasicMaterial({ color })); }
  outline(path, width, height, material) {
    const svg = new SVGLoader().parse(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${path}"/></svg>`);
    const shapes = svg.paths.flatMap(p => p.toShapes());
    const geometry = new THREE.ExtrudeGeometry(shapes, { depth: 3, bevelEnabled: true, bevelSize: .3, bevelThickness: .3, bevelSegments: 2, curveSegments: 16 });
    geometry.rotateX(Math.PI); geometry.computeBoundingBox();
    const size = geometry.boundingBox.getSize(new THREE.Vector3());
    const centre = geometry.boundingBox.getCenter(new THREE.Vector3());
    const scale = Math.min(width / size.x, height / size.y);
    geometry.translate(-centre.x, -centre.y, -centre.z);
    geometry.scale(scale, scale, 1);
    const mesh = new THREE.Mesh(geometry, material); mesh.position.z = 4;
    return mesh;
  }

  updateGlow() {
    const ctx = this.dGlowCanvas.getContext('2d');
    ctx.clearRect(0, 0, 512, 512);
    const radius = this.dSettings.softness * 512 / this.dGlowSize.height;
    // A broad falloff plus a tighter luminous rim remains legible in motion.
    ctx.globalAlpha = .65;
    ctx.filter = `blur(${radius * 1.8}px)`;
    ctx.drawImage(this.dMask, 0, 0);
    ctx.globalAlpha = 1;
    ctx.filter = `blur(${radius * .55}px)`;
    ctx.drawImage(this.dMask, 0, 0);
    ctx.filter = 'none';
    this.dGlowTexture.needsUpdate = true;
  }

  paintPalette() {
    const p = this.owner.palette;
    const accent = new THREE.Color(p.accent);
    this.ink.color.set(p.figure);
    this.slate.color.set(p.figure).lerp(accent, .18);
    this.accent.color.copy(accent);
    this.sage.color.copy(accent).lerp(new THREE.Color(p.figureHighlight), .25);
    this.secondary.color.set(p.figure).lerp(accent, .38);
    this.aWire.material.color.copy(accent);
    this.wireMaterial.color.set(p.ink);
    const ground = new THREE.Color(p.ground);
    const lightGround = ground.r * .2126 + ground.g * .7152 + ground.b * .0722 > .35;
    // A tinted rim shadow reads on porcelain; soft light reads on graphite.
    this.dGlowMaterial.color.set(lightGround ? p.accent : p.figureHighlight)
      .lerp(accent, lightGround ? 0 : .10);
    this.dGlowContrast = 1;
    this.satinColor.set(p.groundGlow).lerp(new THREE.Color(0xffffff), .62);
    this.polishedColor.copy(accent).lerp(new THREE.Color(0xffffff), .32);
    this.stars.forEach((star, i) => {
      star.material.color.copy(i === 1 ? this.satinColor : this.polishedColor);
      if (i === 2) star.material.color.lerp(accent, .55);
    });
    paintSolid(this.sBase, p);
    [this.lowerA, this.writtenA, this.slash].forEach(mesh => paintSolid(mesh.material, p));
    if (this.clock.time) this.paint(this.clock.time);
  }

  // Pack the actual visible silhouettes, not the old font's empty slots.
  // Glow and stars are secondary decoration and do not push letters apart.
  layout(t, collapse) {
    const { word, letters, restX, gap } = this.owner;
    if (this.layoutTrack) {
      const frame = Math.min(t * this.layoutRate, this.layoutTrack.length - 1);
      const a = Math.floor(frame), b = Math.min(a + 1, this.layoutTrack.length - 1);
      letters.forEach((letter, i) => { letter.position.x = mix(this.layoutTrack[a][i], this.layoutTrack[b][i], frame - a); });
      return;
    }
    if (t < .1 || t >= 1.83) {
      letters.forEach((letter, i) => { letter.position.x = restX[i]; });
      return;
    }
    word.updateMatrixWorld(true);
    const scale = word.scale.x;
    const bounds = letters.map(letter => {
      const box = new THREE.Box3();
      letter.traverseVisible(object => {
        if (!object.geometry || object === this.dGlow || this.stars.includes(object)) return;
        if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
        box.union(object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld));
      });
      return {
        width: (box.max.x - box.min.x) / scale,
        offset: ((box.max.x + box.min.x) / 2 - word.position.x) / scale - letter.position.x,
      };
    });
    const overlap = this.slash.visible ? collapse * 9 : 0;
    let cursor = -(bounds.reduce((total, b) => total + b.width, 0) + gap * 4 - overlap) / 2;
    letters.forEach((letter, i) => {
      letter.position.x = cursor + bounds[i].width / 2 - bounds[i].offset;
      cursor += bounds[i].width + gap - (i === 0 ? overlap : 0);
    });
  }

  reset() {
    this.clock.time = 0;
    this.paint(0);
  }

  play(delay = 1.10, { full = true } = {}) {
    const timeline = gsap.timeline({
      delay: full ? delay : Math.min(delay, .35),
      onComplete: () => { this.owner.entrance = null; this.paint(2.9); this.owner.render(); this.owner.rest(); },
    });
    // Keep the choreography intact, but give the material studies room to read.
    for (const [time, duration] of full ? SEQUENCE_BEATS : SHORT_BEATS) {
      if (duration === null) {
        timeline.call(() => { this.paint(time); this.owner.render(); });
        timeline.set(this.clock, { time });
        continue;
      }
      timeline.to(this.clock, { time, duration, ease: 'none', onUpdate: () => {
        this.paint(this.clock.time); this.owner.render();
      } });
    }
    return timeline;
  }

  paint(t) {
    this.clock.time = t;
    const { letters, bodies, dot, restX, restY } = this.owner;
    this.phase = t < .1 ? 'plain' : t < .233 ? 'symbols' : t < .367 ? 'satin' : t < .50 ? 'gloss-cursor' : t < .73 ? 'wire-flag' : t < 1.3 ? 'glow-stars' : t < 1.83 ? 'restore' : t < 2.8 ? 'dot' : 'rest';
    this.layers.forEach(layer => { layer.visible = true; layer.children.forEach(obj => { obj.visible = false; }); });
    bodies.forEach(body => { body.visible = true; });
    letters.forEach((letter, i) => { letter.position.set(restX[i], restY[i], 0); letter.rotation.set(0, this.owner.restTurn, 0); });
    dot.visible = false; dot.position.set(0, 0, 0);
    this.sBase.uniforms.uOpacity.value = 1;
    this.sBase.uniforms.uReveal.value = 1;


    const slash = t >= .133 && t < .43;
    const firstAWriting = t >= .30 && t < 1.52;
    const braces = t >= .20 && t < .50;
    const aWire = t >= .50 && t < .73;
    const code = t >= .10 && t < .367;
    const paragraph = t >= .367 && t < .73;
    const terminal = t >= .20 && t < .567;
    const flag = t >= .567 && t < 1.83;
    bodies[1].visible = !slash && !firstAWriting;
    bodies[2].visible = !braces;
    bodies[3].visible = !code && !paragraph;
    bodies[4].visible = !terminal && !flag;
    // The rope owns the dot's emergence, after this letter sequence finishes.
    this.slash.visible = slash; this.firstAWriting.visible = firstAWriting;
    this.braces.visible = braces; this.aWire.visible = aWire;
    this.code.visible = code; this.paragraph.visible = paragraph;
    this.terminal.visible = terminal; this.flag.visible = flag;

    // Intentional overlap only for S + slash. The S is in front of the slash;
    // changes in slot width reflow the row horizontally, never in a stagger.
    const collapse = smooth(.133, .23, t) * (1 - smooth(.33, .40, t));
    this.slash.position.z = -5;
    this.slash.rotation.z = -.10 * collapse;
    this.lowerA.visible = firstAWriting && t < 1.17;
    this.writtenA.visible = firstAWriting && t >= 1.02;
    this.revealFilledLetter(this.slash, 1 - smooth(.30,.43,t));
    this.revealFilledLetter(this.lowerA, smooth(.30,.80,t), 1 - smooth(1.01,1.17,t));
    this.revealFilledLetter(this.writtenA, smooth(1.02,1.45,t));

    if (t >= .233 && t < .73) {
      const glossy = t >= .367 ? 1 - smooth(.50, .56, t) : 0;
      const fade = smooth(.53, .70, t);
      this.premium.visible = t < .70;
      this.satin.color.copy(this.satinColor).lerp(this.polishedColor, glossy);
      this.satin.metalness = mix(.32, .94, glossy);
      this.satin.clearcoat = mix(.65, 1, glossy);
      this.satin.clearcoatRoughness = mix(.26, .13, glossy);
      this.satin.bumpScale = mix(.025, .004, glossy);
      this.satin.envMapIntensity = mix(1.05, 3.2, glossy);
      this.satin.roughness = mix(.30, .13, glossy);
      this.satin.opacity = 1;
      this.sweep.value = fade;
      this.premium.rotation.y = mix(-.26, .16, smooth(.233, .54, t));
      this.premium.rotation.x = mix(.10, -.06, smooth(.233, .54, t));
      this.satin.envMapRotation.y = mix(-.16, .26, smooth(.233, .54, t));
      this.wire.rotation.copy(this.premium.rotation);
      this.sBase.uniforms.uReveal.value = fade;
      bodies[0].visible = fade > 0;
      this.wire.visible = t >= .53;
      this.wireMaterial.opacity = smooth(.53, .58, t) * (1 - smooth(.64, .73, t)) * .72;
    }
    if (aWire) this.aWire.material.opacity = 1 - smooth(.59, .73, t);
    if (paragraph) {
      this.caret.position.x = mix(-26, 23, smooth(.367, .73, t));
      this.caret.position.y = -2 * Math.sin(smooth(.367, .73, t) * Math.PI);
    }
    // Give the rim its own beat before any star begins moving.
    const glow = smooth(.73, .84, t) * (1 - smooth(1.28, 1.56, t));
    this.dGlow.visible = glow > 0;
    this.dGlowMaterial.opacity = glow * this.dSettings.glow * this.dGlowContrast;
    const dLift = smooth(.73, .84, t) * (1 - smooth(1.50, 1.78, t));
    letters[3].position.y += dLift * this.dSettings.lift;
    this.stars.forEach((star, i) => {
      const settings = this.dSettings;
      const delay = i * settings.stagger;
      const out = smooth(1.04 + delay, 1.35 + delay, t);
      const back = smooth(1.50 + delay, 1.78 + delay, t);
      const p = out * (1 - back);
      star.visible = p > .001;
      // Travel through the solid left stem first, then fan out over the rim.
      // Actual depth testing hides the back travel; no overflow/clipping mask.
      const fan = smooth(.7, 1, p);
      star.scale.setScalar(settings.starSize * mix(.35, 1, smooth(0, .65, p)));
      star.position.set(-15.5 + fan * (24 + i * 8) * settings.spread,
        this.dTop - 5 + p * (18 + i * 12) * settings.rise, -8 + p * 2);
      star.rotation.set(.14, p * Math.PI * (i % 2 ? -1 : 1) * settings.spin, p * .3);

    });

    if (flag) {
      const unfurl = smooth(.567, .90, t);
      const fold = smooth(1.63, 1.83, t);
      const width = mix(2, 42, unfurl) * (1 - fold) + 8.3 * fold;
      const stemHeight = this.stemBounds.max.y - this.stemBounds.min.y;
      this.flag.position.y = mix(-7, (this.stemBounds.min.y + this.stemBounds.max.y) / 2, fold);
      const pos = this.flag.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = this.flagVertices[i * 3], y = this.flagVertices[i * 3 + 1];
        const u = (x + 21) / 42;
        const wave = Math.sin(u * Math.PI * 2 - t * 9);
        pos.setXYZ(i, x * width / 42,
          y * mix(1, stemHeight / 45, fold) + wave * 1.6 * u * (1 - fold),
          wave * 3.2 * u * (1 - fold));
      }
      pos.needsUpdate = true;
      this.flag.geometry.computeBoundingBox();
      this.flag.geometry.computeBoundingSphere();
    }
    this.layout(t, collapse);
  }

  dispose() {
    this.materials.forEach(material => material.dispose());
    this.textures.forEach(texture => texture.dispose());
    this.environment.dispose();
  }
}
