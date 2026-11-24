/**
 * The Flower Dimension — Surreal 3D Botanical Universe (Three.js / WebGL)
 *
 * Renders an interactive, floating, iridescent glass-and-light 3D lily sculpture
 * surrounded by floating glass pearls, secondary blossoms, holographic ribbons,
 * and depth-layered luminous pollen particles.
 */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const ASCII_GLYPHS = '.,:;!|+~=*#%@';

// Pre-allocated scratch math objects (zero per-frame allocations)
const _tmpVec3 = new THREE.Vector3();
const _tmpWorld = new THREE.Vector3();
const _tmpColor = new THREE.Color();

/**
 * Detect software WebGL rasterizers (SwiftShader, llvmpipe, etc.) so we can
 * scale passes/materials smoothly without freezing or stalling frames.
 * @returns {boolean}
 */
function detectSoftwareWebGL() {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
    if (!gl) return true;
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const rendererStr = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
    const isSoft = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(rendererStr);
    const lose = gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
    return isSoft;
  } catch {
    return false;
  }
}

/**
 * Create a custom parametric 3D lily petal BufferGeometry with:
 * - Graceful lanceolate silhouette & tapered apex
 * - Concave cup cross-section + delicate midrib ridge
 * - Subtle marginal wave & organic S-curve arch / recurved tip
 *
 * @param {{
 *   length?: number,
 *   maxWidth?: number,
 *   uSegs?: number,
 *   vSegs?: number,
 *   cupDepth?: number,
 *   arch?: number,
 *   tipRecurve?: number,
 *   ruffle?: number,
 *   midribHeight?: number
 * }} [opts]
 * @returns {THREE.BufferGeometry}
 */
function createSculptedPetalGeometry(opts = {}) {
  const length = opts.length ?? 2.35;
  const maxWidth = opts.maxWidth ?? 0.92;
  const uSegs = opts.uSegs ?? 22;
  const vSegs = opts.vSegs ?? 38;
  const cupDepth = opts.cupDepth ?? 0.22;
  const arch = opts.arch ?? 0.48;
  const tipRecurve = opts.tipRecurve ?? 0.56;
  const ruffle = opts.ruffle ?? 0.045;
  const midribHeight = opts.midribHeight ?? 0.055;

  const cols = uSegs + 1;
  const rows = vSegs + 1;
  const vertCount = cols * rows;

  const positions = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);
  const indices = new Uint16Array(uSegs * vSegs * 6);

  for (let iv = 0; iv <= vSegs; iv++) {
    const v = iv / vSegs; // 0 = base, 1 = tip

    // Width profile: narrow throat -> lush mid-bell -> pointed lily apex
    const baseExpand = Math.pow(Math.sin(Math.PI * Math.pow(v, 0.72)), 0.86);
    const widthProfile = maxWidth * (0.12 + 0.88 * baseExpand) * (1 - 0.14 * Math.pow(v, 3));

    // Spine arch: rises forward (+Y), curves gracefully outward (+Z) near tip
    const spineY = length * (v * 0.92 - 0.12 * Math.pow(v, 2.6));
    const spineZ =
      arch * Math.sin(v * Math.PI * 0.65) * v +
      tipRecurve * Math.pow(Math.max(0, v - 0.42) / 0.58, 2.2);

    for (let iu = 0; iu <= uSegs; iu++) {
      const uNorm = iu / uSegs; // 0..1 across width
      const s = uNorm * 2 - 1; // -1..1
      const absS = Math.abs(s);

      // Transverse coordinates
      const x = s * widthProfile * (1 - 0.08 * absS * absS);

      // Concave cup + central midrib vein + delicate ruffled edge near outer margin
      const cup = cupDepth * (1 - v * 0.35) * (s * s);
      const midrib = midribHeight * Math.exp(-absS * absS * 18) * (1 - v * 0.7);
      const edgeRipple =
        ruffle *
        Math.pow(absS, 1.6) *
        Math.sin(v * Math.PI * 4.5 + s * 1.4) *
        Math.sin(v * Math.PI);

      // Slight droop of lateral edges near upper half
      const edgeDrop = -0.14 * Math.pow(v, 1.4) * (s * s) * (1 - 0.4 * v);

      const y = spineY + edgeDrop * 0.25;
      const z = spineZ - cup + midrib + edgeRipple + edgeDrop;

      const idx = iv * cols + iu;
      positions[idx * 3] = x;
      positions[idx * 3 + 1] = y;
      positions[idx * 3 + 2] = z;

      uvs[idx * 2] = uNorm;
      uvs[idx * 2 + 1] = v;
    }
  }

  let ptr = 0;
  for (let iv = 0; iv < vSegs; iv++) {
    for (let iu = 0; iu < uSegs; iu++) {
      const a = iv * cols + iu;
      const b = a + 1;
      const c = (iv + 1) * cols + iu;
      const d = c + 1;
      indices[ptr++] = a;
      indices[ptr++] = b;
      indices[ptr++] = c;
      indices[ptr++] = b;
      indices[ptr++] = d;
      indices[ptr++] = c;
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geom.setIndex(new THREE.BufferAttribute(indices, 1));
  geom.computeVertexNormals();
  geom.computeBoundingSphere();
  return geom;
}

/**
 * Inject a holographic Fresnel rim & inner-petal gradient shimmer into
 * MeshPhysicalMaterial via onBeforeCompile so glass petals catch surreal edges.
 *
 * @param {THREE.MeshPhysicalMaterial} material
 * @param {{ rimColor: number, rimStrength?: number, tipTint?: number }} cfg
 */
function applyHolographicFresnelShader(material, cfg) {
  const rimCol = new THREE.Color(cfg.rimColor);
  const tipCol = new THREE.Color(cfg.tipTint ?? cfg.rimColor);
  const rimStrength = cfg.rimStrength ?? 0.55;

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uHoloRimColor = { value: rimCol };
    shader.uniforms.uHoloTipColor = { value: tipCol };
    shader.uniforms.uHoloStrength = { value: rimStrength };
    shader.uniforms.uTime = { value: 0 };
    material.userData.holoShader = shader;

    shader.vertexShader =
      'varying vec2 vPetalUv;\n' +
      shader.vertexShader.replace(
        '#include <uv_vertex>',
        `#include <uv_vertex>\nvPetalUv = uv;`
      );

    shader.fragmentShader =
      `varying vec2 vPetalUv;\nuniform vec3 uHoloRimColor;\nuniform vec3 uHoloTipColor;\nuniform float uHoloStrength;\nuniform float uTime;\n` +
      shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        vec3 holoViewDir = normalize(vViewPosition);
        float holoFresnel = pow(1.0 - clamp(abs(dot(normal, holoViewDir)), 0.0, 1.0), 2.35);
        float tipGrad = smoothstep(0.18, 0.96, vPetalUv.y);
        float edgeWave = 0.85 + 0.15 * sin(vPetalUv.y * 9.0 - uTime * 1.4);
        vec3 holoGlow = mix(uHoloRimColor, uHoloTipColor, tipGrad) * holoFresnel * uHoloStrength * edgeWave;
        totalEmissiveRadiance += holoGlow;`
      );
  };
  material.customProgramCacheKey = () =>
    `holo-petal-${cfg.rimColor.toString(16)}-${(cfg.tipTint ?? 0).toString(16)}-${rimStrength}`;
}

/**
 * Atmospheric deep-dimension radial/vertical gradient sky sphere shader.
 * @returns {THREE.Mesh}
 */
function createDimensionBackdrop() {
  const geo = new THREE.SphereGeometry(48, 32, 24);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uWarp: { value: 0 },
    },
    vertexShader: `
      varying vec3 vWorldDir;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldDir = normalize(position);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      varying vec3 vWorldDir;
      uniform float uTime;
      uniform float uWarp;

      void main() {
        vec3 d = normalize(vWorldDir);
        float yMix = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);

        // Deep plum-obsidian zenith to twilight violet & velvety rose-plum horizon
        vec3 abyss = vec3(0.032, 0.015, 0.048);
        vec3 deepPlum = vec3(0.105, 0.044, 0.155);
        vec3 nebulaViolet = vec3(0.195, 0.095, 0.275);
        vec3 dustyRose = vec3(0.285, 0.115, 0.215);

        vec3 col = mix(abyss, deepPlum, smoothstep(0.08, 0.55, yMix));
        col = mix(col, abyss, smoothstep(0.58, 0.96, yMix));

        // Subtle off-center luminous aurora behind the hero flower sculpture
        vec3 auraCenter = normalize(vec3(0.22, 0.05, -0.96));
        float aura = pow(max(0.0, dot(d, auraCenter)), 3.2);
        float secondaryAura = pow(max(0.0, dot(d, normalize(vec3(-0.48, 0.34, -0.82)))), 4.0);
        float pulse = 0.92 + 0.08 * sin(uTime * 0.65);

        col += nebulaViolet * aura * 0.85 * pulse;
        col += dustyRose * secondaryAura * 0.52;

        // Subtle darken toward pure #030303 during dissolve warp
        col = mix(col, vec3(0.012, 0.012, 0.012), clamp(uWarp * 1.15, 0.0, 1.0));

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return mesh;
}

/**
 * Build a soft glowing particle system with custom GLSL radial bokeh & depth parallax.
 * @param {number} count
 * @returns {THREE.Points}
 */
function createBotanicalParticles(count) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const seeds = new Float32Array(count * 3); // [size, phase, speed]

  const palette = [
    new THREE.Color(0xf8dde5), // blush pink
    new THREE.Color(0xe9e1f5), // iridescent lavender
    new THREE.Color(0xff92c2), // electric soft pink
    new THREE.Color(0xffb5a0), // soft coral
    new THREE.Color(0xfff6fb), // pearl white
  ];

  for (let i = 0; i < count; i++) {
    const spreadR = 1.6 + Math.pow(Math.random(), 0.72) * 14.5;
    const theta = Math.random() * Math.PI * 2;
    const z = -9.5 + Math.random() * 13.5;

    positions[i * 3] = Math.cos(theta) * spreadR;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 12.0;
    positions[i * 3 + 2] = z;

    const c = palette[i % palette.length];
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;

    seeds[i * 3] = 0.55 + Math.random() * 1.55;
    seeds[i * 3 + 1] = Math.random() * Math.PI * 2;
    seeds[i * 3 + 2] = 0.4 + Math.random() * 0.9;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: 1 },
      uPointer: { value: new THREE.Vector2(0, 0) },
      uWarp: { value: 0 },
    },
    vertexShader: `
      attribute vec3 aColor;
      attribute vec3 aSeed;
      varying vec3 vColor;
      varying float vAlpha;

      uniform float uTime;
      uniform float uPixelRatio;
      uniform vec2 uPointer;
      uniform float uWarp;

      void main() {
        vColor = aColor;
        float sizeMul = aSeed.x;
        float phase = aSeed.y;
        float speed = aSeed.z;

        vec3 p = position;
        p.x += sin(uTime * 0.35 * speed + phase) * 0.28 + uPointer.x * (0.18 + max(0.0, p.z + 5.0) * 0.05);
        p.y += mod(uTime * 0.22 * speed + phase * 1.9, 12.0) - 6.0 - position.y * 0.25 + uPointer.y * 0.22;
        p.z += cos(uTime * 0.28 * speed + phase) * 0.22;

        // Subtle radial warp acceleration on garden entry
        p.xy *= (1.0 + uWarp * 0.95);
        p.z += uWarp * 4.5;

        vec4 mvPos = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPos;

        float twinkle = 0.45 + 0.55 * sin(uTime * 1.7 * speed + phase * 3.0);
        vAlpha = twinkle * (1.0 - smoothstep(0.55, 1.0, uWarp));

        float dist = max(1.0, -mvPos.z);
        gl_PointSize = clamp((36.0 * sizeMul * uPixelRatio) / dist, 1.5, 24.0);
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        vec2 uv = gl_PointCoord - vec2(0.5);
        float d = length(uv);
        if (d > 0.5) discard;
        float core = exp(-d * d * 18.0);
        float halo = smoothstep(0.5, 0.0, d) * 0.55;
        float a = (core + halo) * vAlpha * 0.88;
        gl_FragColor = vec4(vColor, a);
      }
    `,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return points;
}

export class FlowerDimensionScene {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {() => void} onEnterGarden
   */
  constructor(canvas, onEnterGarden) {
    this.canvas = canvas;
    this.onEnterGarden = onEnterGarden;

    this.landingView = document.getElementById('landing-view');
    this.enterBtn = document.getElementById('enter-garden-btn');
    this.heroUi = document.getElementById('dimension-ui');

    this.isSoftwareGl = detectSoftwareWebGL();
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.isRunning = false;
    this.isDisposed = false;
    this.rafId = 0;
    this.fenceTimerId = 0;

    this.elapsed = 0;
    this.lastTime = 0;
    this.transitionProgress = 0; // 0 = normal, 0..1 = zooming & expanding into ASCII dissolve
    this.pointerTarget = new THREE.Vector2(0, 0);
    this.pointerCurrent = new THREE.Vector2(0, 0);

    /** @type {Array<{ pivot: THREE.Group, baseTilt: number, azimuth: number, roll: number, phase: number, amp: number, whorl: number }>} */
    this.heroPetals = [];
    /** @type {Array<{ mesh: THREE.Mesh, basePos: THREE.Vector3, phase: number, speed: number, depthFactor: number }>} */
    this.floatingPearls = [];
    /** @type {Array<{ group: THREE.Group, basePos: THREE.Vector3, baseRot: THREE.Euler, phase: number, speed: number, depthFactor: number }>} */
    this.secondaryFlowers = [];
    /** @type {Array<{ mesh: THREE.Mesh, speed: number, phase: number }>} */
    this.ribbons = [];
    /** @type {Array<THREE.MeshPhysicalMaterial>} */
    this.holoMaterials = [];
    /** @type {Array<{ dispose: () => void }>} */
    this.disposables = [];

    this.baseCamPos = new THREE.Vector3(0, 0.15, 7.6);
    this.baseLookAt = new THREE.Vector3(0.45, 0.0, 0);
    this.heroRestPos = new THREE.Vector3(1.38, -0.04, 0);

    this.webglReady = this._initThree();
    this._bindEvents();
    this._updateResponsiveFraming();

    if (this.webglReady) {
      this.start();
    } else {
      this.landingView?.classList.add('webgl-fallback');
    }
  }

  /**
   * Initialize Three.js WebGLRenderer, RoomEnvironment IBL, hero flower sculpture,
   * pearls, secondary blossoms, holographic ribbons, and particle universe.
   * @returns {boolean}
   */
  _initThree() {
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: !this.isSoftwareGl,
        alpha: false,
        powerPreference: 'high-performance',
      });
    } catch {
      return false;
    }

    this.renderer = renderer;
    const dpr = this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = false;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0c0512);
    scene.fog = new THREE.FogExp2(0x12071b, 0.032);
    this.scene = scene;

    // Mandatory Studio IBL Environment via PMREMGenerator + RoomEnvironment
    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmrem.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    scene.environmentIntensity = 1.15;
    roomEnv.dispose();
    pmrem.dispose();
    this.disposables.push(envTarget);

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      42,
      Math.max(1, window.innerWidth) / Math.max(1, window.innerHeight),
      0.1,
      100
    );
    this.camera.position.copy(this.baseCamPos);

    // Atmospheric backdrop dome
    this.backdrop = createDimensionBackdrop();
    scene.add(this.backdrop);
    this.disposables.push(this.backdrop.geometry, this.backdrop.material);

    // Multi-layered Dramatic Lighting
    const hemi = new THREE.HemisphereLight(0xe9e1f5, 0x260922, 0.78);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xffe2ee, 2.35);
    keyLight.position.set(4.5, 5.8, 6.4);
    scene.add(keyLight);

    const rimPink = new THREE.SpotLight(0xff4da6, 72, 26, Math.PI / 3.4, 0.8, 1.75);
    rimPink.position.set(-5.0, 4.2, -4.4);
    scene.add(rimPink);
    scene.add(rimPink.target);

    const rimLavender = new THREE.PointLight(0xa385ff, 34, 22, 1.65);
    rimLavender.position.set(5.2, -2.5, -3.8);
    scene.add(rimLavender);

    const softCoralBounce = new THREE.PointLight(0xff9c84, 22, 18, 1.7);
    softCoralBounce.position.set(-2.4, -3.6, 3.8);
    scene.add(softCoralBounce);

    // Shared geometries
    const outerPetalGeo = createSculptedPetalGeometry({
      length: 2.52,
      maxWidth: 0.96,
      cupDepth: 0.24,
      arch: 0.58,
      tipRecurve: 0.68,
      ruffle: 0.055,
      midribHeight: 0.06,
      uSegs: this.isSoftwareGl ? 14 : 22,
      vSegs: this.isSoftwareGl ? 24 : 38,
    });
    const innerPetalGeo = createSculptedPetalGeometry({
      length: 2.08,
      maxWidth: 0.78,
      cupDepth: 0.28,
      arch: 0.4,
      tipRecurve: 0.45,
      ruffle: 0.045,
      midribHeight: 0.05,
      uSegs: this.isSoftwareGl ? 14 : 20,
      vSegs: this.isSoftwareGl ? 22 : 34,
    });
    const crownPetalGeo = createSculptedPetalGeometry({
      length: 1.48,
      maxWidth: 0.56,
      cupDepth: 0.26,
      arch: 0.26,
      tipRecurve: 0.28,
      ruffle: 0.035,
      midribHeight: 0.04,
      uSegs: this.isSoftwareGl ? 12 : 18,
      vSegs: this.isSoftwareGl ? 18 : 28,
    });
    this.disposables.push(outerPetalGeo, innerPetalGeo, crownPetalGeo);

    // Materials (Iridescent glass petals with software WebGL fallback)
    const useTransmission = !this.isSoftwareGl;

    const outerPetalMat = new THREE.MeshPhysicalMaterial({
      color: 0xe6d6fa,
      roughness: 0.14,
      metalness: 0.02,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
      iridescence: 1.0,
      iridescenceIOR: 1.38,
      iridescenceThicknessRange: [160, 540],
      sheen: 0.6,
      sheenRoughness: 0.35,
      sheenColor: new THREE.Color(0xffb5da),
      ior: 1.46,
      thickness: 0.65,
      attenuationColor: new THREE.Color(0xcf9cff),
      attenuationDistance: 2.6,
      transmission: useTransmission ? 0.78 : 0,
      transparent: !useTransmission,
      opacity: useTransmission ? 1.0 : 0.74,
      side: THREE.DoubleSide,
    });
    applyHolographicFresnelShader(outerPetalMat, {
      rimColor: 0xcca6ff,
      tipTint: 0xff6ec7,
      rimStrength: 0.62,
    });

    const innerPetalMat = new THREE.MeshPhysicalMaterial({
      color: 0xfad2e4,
      roughness: 0.11,
      metalness: 0.02,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      iridescence: 1.0,
      iridescenceIOR: 1.42,
      iridescenceThicknessRange: [200, 620],
      sheen: 0.75,
      sheenRoughness: 0.3,
      sheenColor: new THREE.Color(0xffe0ee),
      ior: 1.48,
      thickness: 0.55,
      attenuationColor: new THREE.Color(0xff7cb8),
      attenuationDistance: 2.2,
      transmission: useTransmission ? 0.74 : 0,
      transparent: !useTransmission,
      opacity: useTransmission ? 1.0 : 0.78,
      side: THREE.DoubleSide,
    });
    applyHolographicFresnelShader(innerPetalMat, {
      rimColor: 0xff80c4,
      tipTint: 0xffbca8,
      rimStrength: 0.7,
    });

    const crownPetalMat = new THREE.MeshPhysicalMaterial({
      color: 0xfff4f8,
      roughness: 0.09,
      metalness: 0.02,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      iridescence: 1.0,
      iridescenceIOR: 1.32,
      iridescenceThicknessRange: [120, 460],
      ior: 1.44,
      thickness: 0.4,
      attenuationColor: new THREE.Color(0xffc9dc),
      attenuationDistance: 2.0,
      transmission: useTransmission ? 0.62 : 0,
      transparent: !useTransmission,
      opacity: useTransmission ? 1.0 : 0.85,
      side: THREE.DoubleSide,
    });
    applyHolographicFresnelShader(crownPetalMat, {
      rimColor: 0xffe4f2,
      tipTint: 0xff9ec9,
      rimStrength: 0.58,
    });

    this.holoMaterials.push(outerPetalMat, innerPetalMat, crownPetalMat);
    this.disposables.push(outerPetalMat, innerPetalMat, crownPetalMat);

    // =========================================================================
    // CENTRAL HERO 3D FLOWER SCULPTURE
    // =========================================================================
    this.heroGroup = new THREE.Group();
    this.heroGroup.position.copy(this.heroRestPos);
    this.heroGroup.rotation.set(0.32, -0.35, -0.14);
    scene.add(this.heroGroup);

    // Subtle glowing core light nested inside the flower throat
    this.coreGlowLight = new THREE.PointLight(0xffb5da, 14, 9, 1.8);
    this.coreGlowLight.position.set(0, 0.75, 0.2);
    this.heroGroup.add(this.coreGlowLight);

    // Build 3 whorls of independently breathing sculpted petals
    const addWhorl = (count, geo, mat, baseTilt, offsetAngle, whorlIdx, scaleScalar = 1) => {
      for (let i = 0; i < count; i++) {
        const azimuth = (i / count) * Math.PI * 2 + offsetAngle;
        const radialHolder = new THREE.Group();
        radialHolder.rotation.y = azimuth;

        const pivot = new THREE.Group();
        pivot.position.set(0, 0.04, 0.08);
        const tiltJitter = (Math.sin(i * 2.1 + whorlIdx) * 0.06);
        const tilt = baseTilt + tiltJitter;
        pivot.rotation.x = tilt;

        const mesh = new THREE.Mesh(geo, mat);
        mesh.scale.setScalar(scaleScalar);
        pivot.add(mesh);
        radialHolder.add(pivot);
        this.heroGroup.add(radialHolder);

        this.heroPetals.push({
          pivot,
          baseTilt: tilt,
          azimuth,
          roll: Math.sin(i * 1.7 + whorlIdx) * 0.05,
          phase: i * 1.15 + whorlIdx * 0.85,
          amp: 0.04 + whorlIdx * 0.012,
          whorl: whorlIdx,
        });
      }
    };

    addWhorl(6, outerPetalGeo, outerPetalMat, 0.96, 0.12, 0, 1.0);
    addWhorl(6, innerPetalGeo, innerPetalMat, 0.64, Math.PI / 6 + 0.12, 1, 0.96);
    addWhorl(3, crownPetalGeo, crownPetalMat, 0.36, 0.35, 2, 0.94);

    // Luminous Pistil Core + 6 Curved Stamens & Glowing Pollen Anthers
    const coreMat = new THREE.MeshPhysicalMaterial({
      color: 0xffeef6,
      emissive: 0xff6fb5,
      emissiveIntensity: 0.55,
      roughness: 0.15,
      clearcoat: 1.0,
      iridescence: 0.9,
    });
    const antherMat = new THREE.MeshStandardMaterial({
      color: 0xffbfa0,
      emissive: 0xff6fa8,
      emissiveIntensity: 1.35,
      roughness: 0.25,
      metalness: 0.1,
    });
    const filamentMat = new THREE.MeshPhysicalMaterial({
      color: 0xfff0f7,
      emissive: 0xd9a7ff,
      emissiveIntensity: 0.3,
      roughness: 0.2,
      clearcoat: 0.8,
    });
    this.disposables.push(coreMat, antherMat, filamentMat);

    // Central pistil shaft + stigma jewel
    const pistilCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.03, 0.62, 0.04),
      new THREE.Vector3(0.06, 1.28, 0.08),
    ]);
    const pistilGeo = new THREE.TubeGeometry(pistilCurve, 20, 0.032, 10, false);
    const pistilMesh = new THREE.Mesh(pistilGeo, filamentMat);
    this.heroGroup.add(pistilMesh);

    const stigmaGeo = new THREE.OctahedronGeometry(0.11, 2);
    stigmaGeo.scale(1.0, 1.35, 1.0);
    const stigmaMesh = new THREE.Mesh(stigmaGeo, coreMat);
    stigmaMesh.position.set(0.06, 1.32, 0.08);
    this.heroGroup.add(stigmaMesh);
    this.disposables.push(pistilGeo, stigmaGeo);

    const antherGeo = new THREE.CapsuleGeometry(0.038, 0.12, 6, 12);
    this.disposables.push(antherGeo);

    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.25;
      const spread = 0.44 + (i % 2) * 0.08;
      const h = 1.02 + (i % 3) * 0.09;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(Math.cos(a) * 0.04, 0.06, Math.sin(a) * 0.04),
        new THREE.Vector3(Math.cos(a) * spread * 0.55, h * 0.62, Math.sin(a) * spread * 0.55),
        new THREE.Vector3(Math.cos(a) * spread, h, Math.sin(a) * spread),
      ]);
      const filGeo = new THREE.TubeGeometry(curve, 16, 0.016, 8, false);
      const filMesh = new THREE.Mesh(filGeo, filamentMat);
      this.heroGroup.add(filMesh);
      this.disposables.push(filGeo);

      const anther = new THREE.Mesh(antherGeo, antherMat);
      anther.position.set(Math.cos(a) * spread, h, Math.sin(a) * spread);
      anther.rotation.set(Math.sin(a) * 0.6, a, Math.cos(a) * 0.6);
      this.heroGroup.add(anther);
    }

    // Translucent Plum-Glass Stem & Calyx Base
    const stemMat = new THREE.MeshPhysicalMaterial({
      color: 0x7a4e8c,
      roughness: 0.22,
      metalness: 0.05,
      clearcoat: 1.0,
      iridescence: 0.85,
      iridescenceIOR: 1.35,
      transparent: true,
      opacity: 0.86,
    });
    const stemCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.04, 0),
      new THREE.Vector3(-0.08, -1.25, -0.14),
      new THREE.Vector3(-0.32, -2.85, -0.25),
      new THREE.Vector3(-0.55, -4.6, -0.1),
    ]);
    const stemGeo = new THREE.TubeGeometry(stemCurve, 28, 0.065, 12, false);
    const stemMesh = new THREE.Mesh(stemGeo, stemMat);
    this.heroGroup.add(stemMesh);

    const calyxGeo = new THREE.SphereGeometry(0.16, 16, 12);
    calyxGeo.scale(1.15, 0.82, 1.15);
    const calyxMesh = new THREE.Mesh(calyxGeo, stemMat);
    calyxMesh.position.set(0, -0.04, 0);
    this.heroGroup.add(calyxMesh);
    this.disposables.push(stemMat, stemGeo, calyxGeo);

    // =========================================================================
    // FLOATING IRIDESCENT GLASS PEARLS & CRYSTAL ORBS
    // =========================================================================
    const pearlGeo = new THREE.SphereGeometry(1, 28, 24);
    this.disposables.push(pearlGeo);

    const pearlTints = [0xfff4f8, 0xe9e1f5, 0xf8dde5, 0xffd0e6, 0xffcab8];
    const pearlPlacements = [
      { pos: [-2.75, 2.15, -1.6], r: 0.26, depth: 0.65 },
      { pos: [-1.45, -1.9, 1.2], r: 0.16, depth: 1.2 },
      { pos: [3.65, 1.85, -0.9], r: 0.34, depth: 0.78 },
      { pos: [2.85, -1.75, 1.45], r: 0.21, depth: 1.28 },
      { pos: [0.15, 2.55, -2.4], r: 0.3, depth: 0.52 },
      { pos: [4.3, -0.35, -2.6], r: 0.42, depth: 0.45 },
      { pos: [-3.85, 0.45, -3.2], r: 0.38, depth: 0.42 },
      { pos: [0.65, -2.35, -1.4], r: 0.18, depth: 0.7 },
      { pos: [2.25, 2.75, 0.8], r: 0.12, depth: 1.12 },
      { pos: [-0.35, 1.35, 2.1], r: 0.11, depth: 1.35 },
      { pos: [3.35, 0.72, 1.9], r: 0.09, depth: 1.32 },
      { pos: [-2.15, -2.45, -2.9], r: 0.28, depth: 0.48 },
      { pos: [1.45, -0.45, 2.35], r: 0.085, depth: 1.42 },
      { pos: [-3.2, 2.8, -4.1], r: 0.35, depth: 0.32 },
      { pos: [4.8, 2.5, -4.4], r: 0.31, depth: 0.3 },
      { pos: [-0.95, 2.95, -0.5], r: 0.14, depth: 0.92 },
    ];

    pearlPlacements.forEach((cfg, idx) => {
      const pMat = new THREE.MeshPhysicalMaterial({
        color: pearlTints[idx % pearlTints.length],
        roughness: idx % 3 === 0 ? 0.05 : 0.12,
        metalness: idx % 4 === 0 ? 0.18 : 0.04,
        clearcoat: 1.0,
        clearcoatRoughness: 0.04,
        iridescence: 1.0,
        iridescenceIOR: 1.36,
        iridescenceThicknessRange: [150, 560],
        ior: 1.48,
        transmission: useTransmission && idx % 2 === 0 ? 0.65 : 0,
        transparent: !useTransmission && idx % 2 === 0,
        opacity: !useTransmission && idx % 2 === 0 ? 0.78 : 1.0,
      });
      this.disposables.push(pMat);

      const mesh = new THREE.Mesh(pearlGeo, pMat);
      mesh.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
      mesh.scale.setScalar(cfg.r);
      scene.add(mesh);

      this.floatingPearls.push({
        mesh,
        basePos: new THREE.Vector3(...cfg.pos),
        phase: idx * 0.93,
        speed: 0.45 + (idx % 5) * 0.11,
        depthFactor: cfg.depth,
      });
    });

    // =========================================================================
    // SECONDARY FLOATING 3D BLOSSOMS (Peripheral Depth Layers)
    // =========================================================================
    const buildMiniBlossom = (scale, tiltEuler, matA, matB) => {
      const g = new THREE.Group();
      for (let i = 0; i < 5; i++) {
        const az = (i / 5) * Math.PI * 2;
        const holder = new THREE.Group();
        holder.rotation.y = az;
        const p = new THREE.Mesh(crownPetalGeo, i % 2 === 0 ? matA : matB);
        p.rotation.x = 0.85;
        holder.add(p);
        g.add(holder);
      }
      const centerOrb = new THREE.Mesh(pearlGeo, antherMat);
      centerOrb.scale.setScalar(0.14);
      centerOrb.position.y = 0.28;
      g.add(centerOrb);
      g.scale.setScalar(scale);
      g.rotation.copy(tiltEuler);
      return g;
    };

    const secondarySpecs = [
      { pos: [-3.4, 2.35, -3.4], scale: 0.44, rot: new THREE.Euler(0.6, 0.5, 0.35), depth: 0.42 },
      { pos: [4.25, -2.05, -2.9], scale: 0.5, rot: new THREE.Euler(-0.4, -0.7, -0.3), depth: 0.5 },
      { pos: [4.1, 2.65, -4.6], scale: 0.36, rot: new THREE.Euler(0.45, -0.4, 0.2), depth: 0.32 },
      { pos: [-3.75, -2.35, -4.0], scale: 0.38, rot: new THREE.Euler(0.3, 0.8, -0.45), depth: 0.36 },
    ];

    secondarySpecs.forEach((spec, idx) => {
      const group = buildMiniBlossom(spec.scale, spec.rot, outerPetalMat, innerPetalMat);
      group.position.copy(new THREE.Vector3(...spec.pos));
      scene.add(group);
      this.secondaryFlowers.push({
        group,
        basePos: new THREE.Vector3(...spec.pos),
        baseRot: spec.rot.clone(),
        phase: idx * 1.7 + 0.5,
        speed: 0.35 + idx * 0.07,
        depthFactor: spec.depth,
      });
    });

    // =========================================================================
    // ORGANIC CURVED HOLOGRAPHIC RIBBONS
    // =========================================================================
    const ribbonMat = new THREE.MeshPhysicalMaterial({
      color: 0xdfb8ff,
      roughness: 0.16,
      metalness: 0.08,
      clearcoat: 1.0,
      iridescence: 1.0,
      iridescenceIOR: 1.4,
      iridescenceThicknessRange: [180, 620],
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
    });
    this.disposables.push(ribbonMat);

    const ribbonPaths = [
      [
        new THREE.Vector3(-2.6, -2.8, -1.8),
        new THREE.Vector3(-0.4, -1.4, 1.35),
        new THREE.Vector3(2.85, 0.65, 1.15),
        new THREE.Vector3(4.3, 2.45, -1.4),
      ],
      [
        new THREE.Vector3(4.4, -2.5, -1.9),
        new THREE.Vector3(2.6, -0.95, 1.6),
        new THREE.Vector3(-0.1, 1.45, -0.8),
        new THREE.Vector3(-2.4, 2.65, -2.8),
      ],
    ];

    ribbonPaths.forEach((pts, idx) => {
      const curve = new THREE.CatmullRomCurve3(pts);
      const geo = new THREE.TubeGeometry(curve, 64, 0.022, 8, false);
      this.disposables.push(geo);
      const mesh = new THREE.Mesh(geo, ribbonMat);
      scene.add(mesh);
      this.ribbons.push({ mesh, speed: 0.25 + idx * 0.12, phase: idx * 2.1 });
    });

    // =========================================================================
    // BOTANICAL STARLIGHT / POLLEN PARTICLE UNIVERSE
    // =========================================================================
    const particleCount = this.isSoftwareGl ? 520 : 1350;
    this.particles = createBotanicalParticles(particleCount);
    this.particles.material.uniforms.uPixelRatio.value = dpr;
    scene.add(this.particles);
    this.disposables.push(this.particles.geometry, this.particles.material);

    return true;
  }

  _bindEvents() {
    this._onResize = () => this._handleResize();
    this._onPointerMove = (e) => {
      const nx = (e.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
      const ny = -(e.clientY / Math.max(1, window.innerHeight)) * 2 + 1;
      this.pointerTarget.set(nx, ny);
    };
    this._onTouchMove = (e) => {
      if (e.touches.length > 0) {
        const t = e.touches[0];
        const nx = (t.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
        const ny = -(t.clientY / Math.max(1, window.innerHeight)) * 2 + 1;
        this.pointerTarget.set(nx, ny);
      }
    };
    this._onPointerLeave = () => {
      this.pointerTarget.set(0, 0);
    };
    this._onContextLost = (e) => {
      e.preventDefault();
      this.stop();
    };
    this._onContextRestored = () => {
      if (!this.isDisposed && !this.landingView?.hidden) {
        this.start();
      }
    };
    this._onEnterClick = () => {
      this.onEnterGarden();
    };

    window.addEventListener('resize', this._onResize);
    window.addEventListener('pointermove', this._onPointerMove, { passive: true });
    window.addEventListener('touchmove', this._onTouchMove, { passive: true });
    window.addEventListener('pointerleave', this._onPointerLeave, { passive: true });
    this.canvas.addEventListener('webglcontextlost', this._onContextLost);
    this.canvas.addEventListener('webglcontextrestored', this._onContextRestored);
    this.enterBtn?.addEventListener('click', this._onEnterClick);
  }

  _updateResponsiveFraming() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const aspect = w / Math.max(1, h);

    if (!this.camera) return;

    this.camera.aspect = aspect;
    if (aspect < 0.6) {
      this.camera.fov = 52;
      this.baseCamPos.set(0, -0.35, 9.4);
      this.baseLookAt.set(0, -0.45, 0);
      this.heroRestPos.set(0, 1.25, -0.2);
    } else if (aspect < 0.78) {
      // Mobile portrait: place 3D flower elegantly in upper-center above editorial block
      this.camera.fov = 48;
      this.baseCamPos.set(0, -0.2, 8.7);
      this.baseLookAt.set(0, -0.35, 0);
      this.heroRestPos.set(0, 0.98, -0.15);
    } else if (aspect < 1.15) {
      // Tablet / square: slight right offset
      this.camera.fov = 44;
      this.baseCamPos.set(0, 0.05, 8.1);
      this.baseLookAt.set(0.25, -0.08, 0);
      this.heroRestPos.set(0.85, 0.25, 0);
    } else {
      // Desktop widescreen: asymmetrical balance — editorial copy left, giant flower right-center
      this.camera.fov = 41;
      this.baseCamPos.set(0, 0.14, 7.55);
      this.baseLookAt.set(0.32, 0.0, 0);
      this.heroRestPos.set(1.42, -0.05, 0);
    }
    this.camera.updateProjectionMatrix();
  }

  _handleResize() {
    if (!this.webglReady || !this.renderer || !this.camera) return;
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    const dpr = this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2);

    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    if (this.particles) {
      this.particles.material.uniforms.uPixelRatio.value = dpr;
    }
    this._updateResponsiveFraming();
  }

  /**
   * Software-WebGL-safe frame pacing using fenceSync when available.
   * @param {() => void} cb
   */
  _scheduleNextTick(cb) {
    if (!this.isRunning) return;
    if (!this.isSoftwareGl) {
      this.rafId = window.requestAnimationFrame(cb);
      return;
    }

    const gl = this.renderer?.getContext();
    if (gl && typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext) {
      const fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const pollFence = () => {
        if (!this.isRunning) {
          gl.deleteSync(fence);
          return;
        }
        const status = gl.clientWaitSync(fence, 0, 0);
        if (status === gl.ALREADY_SIGNALED || status === gl.CONDITION_SATISFIED) {
          gl.deleteSync(fence);
          this.fenceTimerId = window.setTimeout(cb, 75);
        } else {
          this.fenceTimerId = window.setTimeout(pollFence, 16);
        }
      };
      this.fenceTimerId = window.setTimeout(pollFence, 16);
    } else {
      this.fenceTimerId = window.setTimeout(cb, 80);
    }
  }

  /**
   * Update scene state for a single animation step.
   * @param {number} dt
   */
  _update(dt) {
    if (!this.webglReady || !this.camera || !this.heroGroup) return;

    this.elapsed += dt;
    const t = this.elapsed;
    const p = this.transitionProgress;
    const easeWarp = p * p * (3 - 2 * p);

    // Smoothly damp pointer tracking
    const dampLambda = this.reducedMotion ? 2 : 5.2;
    this.pointerCurrent.x = THREE.MathUtils.damp(
      this.pointerCurrent.x,
      this.pointerTarget.x,
      dampLambda,
      dt
    );
    this.pointerCurrent.y = THREE.MathUtils.damp(
      this.pointerCurrent.y,
      this.pointerTarget.y,
      dampLambda,
      dt
    );

    const px = this.reducedMotion ? 0 : this.pointerCurrent.x;
    const py = this.reducedMotion ? 0 : this.pointerCurrent.y;

    // Camera parallax + smooth dive toward the flower heart during transition
    const targetCamX = this.baseCamPos.x + px * 0.48 * (1 - easeWarp) + this.heroRestPos.x * easeWarp * 0.88;
    const targetCamY = this.baseCamPos.y + py * 0.34 * (1 - easeWarp) + (this.heroRestPos.y + 0.55) * easeWarp;
    const targetCamZ = THREE.MathUtils.lerp(this.baseCamPos.z, 2.35, easeWarp);

    this.camera.position.set(targetCamX, targetCamY, targetCamZ);

    const lookX = THREE.MathUtils.lerp(this.baseLookAt.x + px * 0.14, this.heroRestPos.x, easeWarp);
    const lookY = THREE.MathUtils.lerp(this.baseLookAt.y + py * 0.1, this.heroRestPos.y + 0.52, easeWarp);
    _tmpVec3.set(lookX, lookY, 0);
    this.camera.lookAt(_tmpVec3);

    // Hero flower floating, breathing, cursor tilt & petal expansion
    const breath = this.reducedMotion ? 0 : Math.sin(t * 0.95);
    const scalePulse = (1 + breath * 0.022) * (1 + easeWarp * 0.42);
    this.heroGroup.scale.setScalar(scalePulse);

    this.heroGroup.position.set(
      this.heroRestPos.x + px * 0.14 * (1 - easeWarp),
      this.heroRestPos.y + (this.reducedMotion ? 0 : Math.sin(t * 0.72) * 0.11) + py * 0.1 * (1 - easeWarp),
      this.heroRestPos.z + easeWarp * 0.85
    );

    this.heroGroup.rotation.x = 0.34 - py * 0.16 * (1 - easeWarp) + easeWarp * 0.38;
    this.heroGroup.rotation.y =
      -0.36 + px * 0.24 * (1 - easeWarp) + (this.reducedMotion ? 0 : Math.sin(t * 0.28) * 0.14) + easeWarp * 0.55;
    this.heroGroup.rotation.z = -0.13 + (this.reducedMotion ? 0 : Math.cos(t * 0.42) * 0.04);

    // Individual petal breathing + dramatic outward unfurl during transition
    for (let i = 0; i < this.heroPetals.length; i++) {
      const pet = this.heroPetals[i];
      const wave = this.reducedMotion ? 0 : Math.sin(t * 1.15 + pet.phase) * pet.amp;
      const expand = easeWarp * (0.42 + pet.whorl * 0.14);
      pet.pivot.rotation.x = pet.baseTilt + wave + expand;
      pet.pivot.rotation.z = pet.roll + (this.reducedMotion ? 0 : Math.cos(t * 0.85 + pet.phase) * 0.025);
    }

    // Core light pulse
    if (this.coreGlowLight) {
      this.coreGlowLight.intensity = 13.5 + breath * 2.5 + easeWarp * 16;
    }

    // Floating pearls depth parallax & gentle drift
    for (let i = 0; i < this.floatingPearls.length; i++) {
      const item = this.floatingPearls[i];
      const bobY = this.reducedMotion ? 0 : Math.sin(t * item.speed + item.phase) * 0.18;
      const bobX = this.reducedMotion ? 0 : Math.cos(t * item.speed * 0.7 + item.phase) * 0.12;
      item.mesh.position.set(
        item.basePos.x + bobX - px * 0.28 * item.depthFactor + (item.basePos.x - this.heroRestPos.x) * easeWarp * 0.55,
        item.basePos.y + bobY - py * 0.22 * item.depthFactor + item.basePos.y * easeWarp * 0.45,
        item.basePos.z + easeWarp * 2.2
      );
    }

    // Secondary flowers orbit & depth parallax
    for (let i = 0; i < this.secondaryFlowers.length; i++) {
      const sf = this.secondaryFlowers[i];
      const bob = this.reducedMotion ? 0 : Math.sin(t * sf.speed + sf.phase) * 0.22;
      sf.group.position.set(
        sf.basePos.x - px * 0.2 * sf.depthFactor + sf.basePos.x * easeWarp * 0.4,
        sf.basePos.y + bob - py * 0.16 * sf.depthFactor,
        sf.basePos.z + easeWarp * 1.8
      );
      if (!this.reducedMotion) {
        sf.group.rotation.y = sf.baseRot.y + t * 0.12 * (i % 2 === 0 ? 1 : -1);
        sf.group.rotation.x = sf.baseRot.x + Math.sin(t * 0.5 + sf.phase) * 0.08;
      }
    }

    // Ribbons subtle breathing
    for (let i = 0; i < this.ribbons.length; i++) {
      const r = this.ribbons[i];
      if (!this.reducedMotion) {
        r.mesh.rotation.y = Math.sin(t * r.speed + r.phase) * 0.08 + px * 0.08;
        r.mesh.rotation.x = Math.cos(t * r.speed * 0.8 + r.phase) * 0.05 - py * 0.06;
      }
    }

    // Update shader uniforms
    if (this.backdrop) {
      this.backdrop.material.uniforms.uTime.value = t;
      this.backdrop.material.uniforms.uWarp.value = easeWarp;
    }
    if (this.particles) {
      const u = this.particles.material.uniforms;
      u.uTime.value = t;
      u.uPointer.value.set(px, py);
      u.uWarp.value = easeWarp;
    }
    for (let i = 0; i < this.holoMaterials.length; i++) {
      const sh = this.holoMaterials[i].userData.holoShader;
      if (sh) {
        sh.uniforms.uTime.value = t;
      }
    }
  }

  /**
   * Sample actual 3D world-space points from the hero petals, stamens, pearls,
   * and secondary blossoms projected onto screen coordinates so the ASCII
   * dissolve erupts directly from the 3D botanical geometry.
   *
   * @param {number} count
   * @returns {Array<{ x: number, y: number, r: number, g: number, b: number, char: string }>}
   */
  sampleDissolvePoints(count) {
    const results = [];
    if (!this.webglReady || !this.camera || !this.heroGroup) return results;

    this.scene?.updateMatrixWorld(true);
    const w = window.innerWidth;
    const h = window.innerHeight;

    const meshPool = [];
    this.heroGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.geometry?.attributes?.position) {
        meshPool.push(obj);
      }
    });
    for (let i = 0; i < this.floatingPearls.length; i++) {
      meshPool.push(this.floatingPearls[i].mesh);
    }

    if (meshPool.length === 0) return results;

    for (let i = 0; i < count; i++) {
      const mesh = meshPool[i % meshPool.length];
      const posAttr = mesh.geometry.attributes.position;
      const vertIdx = Math.floor(Math.random() * posAttr.count);

      _tmpWorld.fromBufferAttribute(posAttr, vertIdx);
      _tmpWorld.applyMatrix4(mesh.matrixWorld);
      _tmpWorld.project(this.camera);

      if (_tmpWorld.z > 1) continue;

      const sx = (_tmpWorld.x * 0.5 + 0.5) * w;
      const sy = (-_tmpWorld.y * 0.5 + 0.5) * h;
      if (sx < -60 || sx > w + 60 || sy < -60 || sy > h + 60) continue;

      const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      if (mat && 'color' in mat && mat.color) {
        _tmpColor.copy(mat.color);
      } else {
        _tmpColor.setHex(0xf8dde5);
      }

      // Add subtle iridescent sparkle shift
      const shift = (Math.random() - 0.5) * 0.16;
      const r = Math.min(255, Math.max(120, Math.round((_tmpColor.r + shift) * 255)));
      const g = Math.min(255, Math.max(95, Math.round((_tmpColor.g + shift * 0.5) * 255)));
      const b = Math.min(255, Math.max(140, Math.round((_tmpColor.b + shift * 0.8) * 255)));

      const glyphIdx = Math.floor((0.2 + Math.random() * 0.8) * (ASCII_GLYPHS.length - 1));

      results.push({
        x: sx,
        y: sy,
        r,
        g,
        b,
        char: ASCII_GLYPHS[glyphIdx],
      });
    }

    return results;
  }

  /**
   * @param {number} progress 0..1
   */
  setTransitionProgress(progress) {
    this.transitionProgress = THREE.MathUtils.clamp(progress, 0, 1);
  }

  resetTransition() {
    this.transitionProgress = 0;
  }

  start() {
    if (this.isDisposed || !this.webglReady || this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();

    const loop = () => {
      if (!this.isRunning) return;
      const now = performance.now();
      const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTime) / 1000));
      this.lastTime = now;

      this._update(dt);
      this.renderer?.render(this.scene, this.camera);
      this._scheduleNextTick(loop);
    };

    this._update(0.016);
    this.renderer?.render(this.scene, this.camera);
    this._scheduleNextTick(loop);
  }

  stop() {
    this.isRunning = false;
    if (this.rafId) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
    if (this.fenceTimerId) {
      window.clearTimeout(this.fenceTimerId);
      this.fenceTimerId = 0;
    }
  }

  beginLeave() {
    if (this.enterBtn) {
      this.enterBtn.classList.add('is-opening');
    }
    if (this.heroUi) {
      this.heroUi.classList.add('is-leaving');
    }
  }

  fadeToDarkness() {
    if (this.landingView) {
      this.landingView.classList.add('is-leaving');
      this.landingView.classList.remove('is-active');
    }
  }

  hide() {
    if (this.landingView) {
      this.landingView.hidden = true;
      this.landingView.classList.remove('is-leaving', 'is-active');
    }
    if (this.heroUi) {
      this.heroUi.classList.remove('is-leaving');
    }
    if (this.enterBtn) {
      this.enterBtn.classList.remove('is-opening');
    }
    this.resetTransition();
    this.stop();
  }

  show() {
    this.resetTransition();
    if (this.heroUi) {
      this.heroUi.classList.remove('is-leaving');
    }
    if (this.enterBtn) {
      this.enterBtn.classList.remove('is-opening');
    }
    if (this.landingView) {
      this.landingView.hidden = false;
      this.landingView.classList.remove('is-leaving');
      void this.landingView.offsetWidth;
      this.landingView.classList.add('is-active');
    }
    this._updateResponsiveFraming();
    this.start();
  }

  dispose() {
    this.isDisposed = true;
    this.stop();
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('pointermove', this._onPointerMove);
    window.removeEventListener('touchmove', this._onTouchMove);
    window.removeEventListener('pointerleave', this._onPointerLeave);
    this.canvas.removeEventListener('webglcontextlost', this._onContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this._onContextRestored);
    this.enterBtn?.removeEventListener('click', this._onEnterClick);

    for (const item of this.disposables) {
      item.dispose();
    }
    this.disposables.length = 0;
    this.renderer?.dispose();
  }
}
