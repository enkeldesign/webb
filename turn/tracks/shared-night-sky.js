import * as THREE from 'three';

const MOON_TEXTURE_URL = new URL('../assets/mountain/mountain-moon.png', import.meta.url).href;
const SKY_DISTANCE = 840;
const SKY_PLANE_ASPECT = 2;
const SKY_WORLD_CYCLES = 4;
const SKY_YAW_CATCHUP = 0.14;
const SKY_POSITION_PARALLAX = 0.00004;
const SKY_PITCH_PARALLAX = 0.025;
const SKY_CAMERA_CUT_DISTANCE = 48;
const SKY_CAMERA_CUT_HEADING = Math.PI / 8;
const SKY_OVERSCAN = 1.05;
const SKY_REFERENCE_ASPECT = 1536 / 709;
const LEGACY_MOON_DISTANCE = 810;
const LEGACY_MOON_SIZE = 174;
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const TAU = Math.PI * 2;
const MOON_SKY_ANCHOR_U = 0.580888;
const MOON_SKY_ANCHOR_V = 0.783222;
const MOON_WORLD_U_PERIOD = SKY_WORLD_CYCLES;
let moonTexturePromise = null;

const SKY_STYLES = Object.freeze({
  mountain: Object.freeze({
    zenith: 0x020817,
    horizon: 0x081a38,
    glow: 0x18365a,
    glowStrength: 0.08,
    starStrength: 0.92
  }),
  'midnight-city': Object.freeze({
    zenith: 0x020817,
    horizon: 0x0b102b,
    glow: 0x8b2aa8,
    glowStrength: 0.12,
    starStrength: 0.58
  })
});

const VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  varying vec2 vUv;
  uniform vec2 uSampleScale;
  uniform vec2 uSampleOffset;
  uniform vec3 uZenithColor;
  uniform vec3 uHorizonColor;
  uniform vec3 uGlowColor;
  uniform float uGlowStrength;
  uniform float uStarStrength;

  float hash21(vec2 point) {
    point = fract(point * vec2(123.34, 345.45));
    point += dot(point, point + 34.345);
    return fract(point.x * point.y);
  }

  float starField(vec2 sampleUv) {
    vec2 cellUv = sampleUv * vec2(88.0, 44.0);
    vec2 cell = floor(cellUv);
    vec2 local = fract(cellUv) - 0.5;
    float seed = hash21(cell);
    vec2 jitter = fract(vec2(seed * 13.37, seed * 47.11)) - 0.5;
    float distanceToStar = length(local - jitter * 0.36);
    float radius = mix(0.030, 0.072, fract(seed * 91.7));
    float core = 1.0 - smoothstep(radius * 0.35, radius, distanceToStar);
    float present = step(0.972, seed);
    float brightness = mix(0.34, 1.0, fract(seed * 37.3));
    return core * present * brightness;
  }

  void main() {
    vec2 sampleUv = vUv * uSampleScale + uSampleOffset;
    float heightBlend = smoothstep(0.04, 0.96, vUv.y);
    vec3 color = mix(uHorizonColor, uZenithColor, heightBlend);
    float horizonGlow = pow(max(0.0, 1.0 - vUv.y), 3.2) * uGlowStrength;
    color += uGlowColor * horizonGlow;
    color += vec3(starField(sampleUv) * uStarStrength);
    gl_FragColor = vec4(color, 1.0);
  }
`;

function shortestAngle(from, to) {
  let delta = to - from;
  while (delta > Math.PI) delta -= TAU;
  while (delta < -Math.PI) delta += TAU;
  return delta;
}

function planeCoverageForAspect(aspect) {
  const safeAspect = Math.max(0.1, Number(aspect) || SKY_REFERENCE_ASPECT);
  const coverHeightInVisibleHeights = Math.max(1, safeAspect / SKY_PLANE_ASPECT) * SKY_OVERSCAN;
  return Object.freeze({
    x: Math.min(1, safeAspect / (coverHeightInVisibleHeights * SKY_PLANE_ASPECT)),
    y: Math.min(1, 1 / coverHeightInVisibleHeights)
  });
}

const REFERENCE_SKY_COVERAGE = planeCoverageForAspect(SKY_REFERENCE_ASPECT);

function makeSkyMaterial(style) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uSampleScale: { value: new THREE.Vector2(1, 1) },
      uSampleOffset: { value: new THREE.Vector2(0, 0) },
      uZenithColor: { value: new THREE.Color(style.zenith) },
      uHorizonColor: { value: new THREE.Color(style.horizon) },
      uGlowColor: { value: new THREE.Color(style.glow) },
      uGlowStrength: { value: style.glowStrength },
      uStarStrength: { value: style.starStrength }
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false,
    fog: false,
    toneMapped: false
  });
}

function makeSky(world, style, trackId) {
  const material = makeSkyMaterial(style);
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  sky.name = trackId === 'mountain'
    ? 'Mountain star field skydome r6'
    : 'Midnight City shared procedural night sky';
  sky.frustumCulled = false;
  sky.renderOrder = -100;
  world.add(sky);
  return sky;
}

async function loadMoonTexture() {
  if (!moonTexturePromise) {
    moonTexturePromise = new THREE.TextureLoader().loadAsync(MOON_TEXTURE_URL)
      .then((texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.generateMipmaps = false;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.needsUpdate = true;
        return texture;
      })
      .catch((error) => {
        moonTexturePromise = null;
        throw error;
      });
  }
  return moonTexturePromise;
}

function makeMoon(texture, trackId) {
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    color: 0xffffff,
    transparent: true,
    alphaTest: 0.025,
    depthTest: true,
    depthWrite: false,
    fog: false,
    toneMapped: false,
    side: THREE.DoubleSide
  });
  const moon = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  moon.name = trackId === 'mountain'
    ? 'Mountain full moon sprite r6'
    : 'Midnight City shared southern moon';
  moon.frustumCulled = false;
  moon.renderOrder = -90;
  moon.userData.turnSharedMoon = 'canonical-mountain-moon-image';
  return moon;
}

function updateMoon(moon, sky, motion) {
  if (!moon
    || !Number.isFinite(motion.repeatU)
    || !Number.isFinite(motion.repeatV)
    || !Number.isFinite(motion.offsetU)
    || !Number.isFinite(motion.offsetV)) return;

  const centreSampleU = motion.offsetU + motion.repeatU * 0.5;
  const anchorU = MOON_SKY_ANCHOR_U
    + Math.round((centreSampleU - MOON_SKY_ANCHOR_U) / MOON_WORLD_U_PERIOD) * MOON_WORLD_U_PERIOD;
  const localU = (anchorU - motion.offsetU) / motion.repeatU;
  const localV = (MOON_SKY_ANCHOR_V - motion.offsetV) / motion.repeatV;
  moon.position.set(localU - 0.5, localV - 0.5, 0);

  const apparentSize = LEGACY_MOON_SIZE * SKY_DISTANCE / LEGACY_MOON_DISTANCE;
  moon.scale.set(
    apparentSize / Math.max(Math.abs(sky.scale.x), 1e-6),
    apparentSize / Math.max(Math.abs(sky.scale.y), 1e-6),
    1
  );
  moon.updateMatrixWorld(true);
}

function attachWorldLock(sky, getMoon) {
  const forward = new THREE.Vector3();
  const previousCameraPosition = new THREE.Vector3();
  let hasPreviousCameraPose = false;
  const motion = {
    heading: null,
    visualHeading: null,
    positionU: 0,
    pitchV: 0,
    repeatU: null,
    repeatV: null,
    offsetU: null,
    offsetV: null,
    coverHeight: null,
    cameraCutCount: 0,
    reducedMotion: false
  };

  const reducedMotionMedia = globalThis.matchMedia?.(REDUCED_MOTION_QUERY) || null;
  const applyReducedMotionPreference = () => {
    motion.reducedMotion = reducedMotionMedia?.matches === true;
    sky.userData.turnReducedMotionNightSky = motion.reducedMotion
      ? 'world-locked-without-drag-or-parallax'
      : 'world-locked-with-gentle-drag';
  };
  applyReducedMotionPreference();
  reducedMotionMedia?.addEventListener?.('change', applyReducedMotionPreference);
  if (!reducedMotionMedia?.addEventListener) reducedMotionMedia?.addListener?.(applyReducedMotionPreference);

  sky.onBeforeRender = (_renderer, _scene, camera) => {
    camera.getWorldDirection(forward);
    sky.position.copy(camera.position).addScaledVector(forward, SKY_DISTANCE);
    sky.up.set(0, 1, 0);
    sky.lookAt(camera.position);

    const heading = Math.atan2(forward.x, forward.z);
    const headingJump = motion.heading === null ? 0 : Math.abs(shortestAngle(motion.heading, heading));
    const positionJump = hasPreviousCameraPose ? previousCameraPosition.distanceTo(camera.position) : 0;
    const cameraCut = hasPreviousCameraPose
      && (headingJump >= SKY_CAMERA_CUT_HEADING || positionJump >= SKY_CAMERA_CUT_DISTANCE);

    if (motion.visualHeading === null || cameraCut || motion.reducedMotion) {
      motion.visualHeading = heading;
      if (cameraCut) motion.cameraCutCount += 1;
    } else {
      motion.visualHeading += shortestAngle(motion.visualHeading, heading) * SKY_YAW_CATCHUP;
    }
    motion.heading = heading;
    previousCameraPosition.copy(camera.position);
    hasPreviousCameraPose = true;

    const verticalFov = THREE.MathUtils.degToRad(camera.fov);
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
    const visibleU = Math.max(0.01, horizontalFov / TAU * SKY_WORLD_CYCLES);
    const visibleHeight = 2 * SKY_DISTANCE * Math.tan(verticalFov / 2);
    const visibleWidth = visibleHeight * camera.aspect;
    const coverHeight = Math.max(visibleHeight, visibleWidth / SKY_PLANE_ASPECT) * SKY_OVERSCAN;
    const visiblePlaneX = Math.max(1e-6, Math.min(1, visibleWidth / (coverHeight * SKY_PLANE_ASPECT)));
    const visiblePlaneY = Math.max(1e-6, Math.min(1, visibleHeight / coverHeight));
    const repeatU = visibleU * REFERENCE_SKY_COVERAGE.x / visiblePlaneX;
    const repeatV = REFERENCE_SKY_COVERAGE.y / visiblePlaneY;
    const baseU = 0.5 - repeatU * 0.5;
    const baseV = 0.5 - repeatV * 0.5;
    const yawU = -motion.visualHeading / TAU * SKY_WORLD_CYCLES;

    motion.positionU = motion.reducedMotion ? 0 : (camera.position.x - camera.position.z) * SKY_POSITION_PARALLAX;
    motion.pitchV = motion.reducedMotion ? 0 : forward.y * SKY_PITCH_PARALLAX;
    motion.repeatU = repeatU;
    motion.repeatV = repeatV;
    motion.offsetU = baseU + yawU + motion.positionU;
    motion.offsetV = baseV + motion.pitchV;
    motion.coverHeight = coverHeight;

    sky.material.uniforms.uSampleScale.value.set(repeatU, repeatV);
    sky.material.uniforms.uSampleOffset.value.set(motion.offsetU, motion.offsetV);
    sky.scale.set(coverHeight * SKY_PLANE_ASPECT, coverHeight, 1);
    sky.updateMatrixWorld(true);
    updateMoon(getMoon(), sky, motion);
  };

  return motion;
}

export function installSharedNightSky(world, { trackId = 'mountain' } = {}) {
  if (!world) return null;
  const existing = world.userData.turnSharedNightSkyRuntime;
  if (existing?.sky?.parent === world) return existing;

  const style = SKY_STYLES[trackId] || SKY_STYLES.mountain;
  const sky = makeSky(world, style, trackId);
  const runtime = {
    sky,
    moon: null,
    motion: null,
    errors: [],
    ready: null
  };
  runtime.motion = attachWorldLock(sky, () => runtime.moon);
  world.userData.turnSharedNightSkyRuntime = runtime;

  const publishContract = () => {
    world.userData.turnSharedNightSky = Object.freeze({
      trackId,
      procedural: true,
      oneBackgroundDraw: true,
      skyShader: 'single-pass-gradient-and-static-hash-stars',
      rasterSkyAsset: false,
      moonImage: 'assets/mountain/mountain-moon.png',
      moonLoaded: Boolean(runtime.moon),
      moonDirection: 'shared-southern-celestial-anchor',
      moonSkyAnchor: Object.freeze({ u: MOON_SKY_ANCHOR_U, v: MOON_SKY_ANCHOR_V }),
      moonDistance: SKY_DISTANCE,
      moonApparentSize: LEGACY_MOON_SIZE,
      worldUpHorizon: true,
      aspectPolicy: 'wide-phone-reference-normalized-across-plane-overcoverage',
      cameraCuts: 'snap-large-camera-jumps',
      reducedMotion: 'no-deliberate-yaw-drag-position-parallax-or-pitch-drift',
      cityVariation: trackId === 'midnight-city' ? 'restrained-purple-horizon-glow' : 'deep-blue',
      starStrength: style.starStrength,
      dynamicLightsAdded: 0,
      independentAnimationLoop: false,
      perFrameAllocations: 0,
      errors: Object.freeze([...runtime.errors])
    });
  };
  publishContract();

  runtime.ready = loadMoonTexture()
    .then((moonTexture) => {
      if (sky.parent !== world) return runtime;
      runtime.moon = makeMoon(moonTexture, trackId);
      sky.add(runtime.moon);
      publishContract();
      return runtime;
    })
    .catch((error) => {
      runtime.errors.push(`moon: ${String(error?.message || error)}`);
      publishContract();
      return runtime;
    });

  return runtime;
}

export const SHARED_NIGHT_SKY_CONTRACT = Object.freeze({
  skyDistance: SKY_DISTANCE,
  referenceAspect: SKY_REFERENCE_ASPECT,
  worldCycles: SKY_WORLD_CYCLES,
  moonSkyAnchor: Object.freeze({ u: MOON_SKY_ANCHOR_U, v: MOON_SKY_ANCHOR_V }),
  moonAsset: 'assets/mountain/mountain-moon.png'
});
