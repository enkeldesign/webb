import * as THREE from 'three';

const REVISION = 'r7-world-yaw-uv-raised-moon-celestial-layer-cut-snap-reduced-motion';
const SKY_NAME = 'Mountain star field skydome r6';
const MOON_NAME = 'Mountain full moon sprite r6';
const SKY_DISTANCE = 840;
const SKY_IMAGE_ASPECT = 2;
const SKY_HORIZONTAL_TILES = 4;
const SKY_YAW_CATCHUP = 0.14;
const SKY_POSITION_PARALLAX = 0.00004;
const SKY_PITCH_PARALLAX = 0.025;
const SKY_CAMERA_CUT_DISTANCE = 48;
const SKY_CAMERA_CUT_HEADING = Math.PI / 8;
const LEGACY_MOON_DISTANCE = 810;
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const TAU = Math.PI * 2;

// The moon is now a literal part of the same visual celestial layer as the
// stars. These are unwrapped star-texture coordinates calibrated against the
// established MOUNTAIN intro frame (15% from the left, 18% from the top).
// Keeping the anchor in texture space means every bit of sky motion — yaw drag,
// position parallax, pitch drift and horizon roll — moves the moon identically.
const MOON_SKY_ANCHOR_U = 0.580888;
const MOON_SKY_ANCHOR_V = 0.783222;
const MOON_WORLD_U_PERIOD = SKY_HORIZONTAL_TILES;

function shortestAngle(from, to) {
  let delta = to - from;
  while (delta > Math.PI) delta -= TAU;
  while (delta < -Math.PI) delta += TAU;
  return delta;
}

function worldLockSky(sky) {
  const texture = sky.material?.map;
  if (!texture) return null;

  // Keep the generated star field on the flat backdrop that looked good on the
  // phone. The earlier sphere/cylinder experiments correctly solved yaw but
  // distorted this deliberately non-equirectangular 512x256 source. Instead,
  // rotate through the texture in UV space as camera heading changes.
  texture.wrapS = THREE.MirroredRepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;

  sky.geometry?.dispose?.();
  sky.geometry = new THREE.PlaneGeometry(1, 1);
  sky.material.side = THREE.DoubleSide;
  sky.material.depthWrite = false;
  sky.material.depthTest = true;
  sky.material.fog = false;
  sky.material.toneMapped = false;
  sky.material.needsUpdate = true;
  sky.frustumCulled = false;
  sky.renderOrder = -100;

  const forward = new THREE.Vector3();
  const previousCameraPosition = new THREE.Vector3();
  let hasPreviousCameraPose = false;
  const motion = {
    heading: null,
    visualHeading: null,
    positionU: 0,
    pitchV: 0,
    visibleU: null,
    offsetU: null,
    offsetV: null,
    coverHeight: null,
    cameraCutCount: 0,
    reducedMotion: false
  };

  const reducedMotionMedia = globalThis.matchMedia?.(REDUCED_MOTION_QUERY) || null;
  const applyReducedMotionPreference = () => {
    motion.reducedMotion = reducedMotionMedia?.matches === true;

    // Under prefers-reduced-motion, do not present the moving star field at
    // all. The track's existing scene.background is the solid deep-blue night
    // colour, so making this backdrop transparent reveals that colour while
    // still letting its child moon render normally.
    sky.material.transparent = motion.reducedMotion;
    sky.material.opacity = motion.reducedMotion ? 0 : 1;
    sky.material.needsUpdate = true;
    sky.userData.turnMountainReducedMotionSky = motion.reducedMotion
      ? 'solid-track-background-with-moon-only'
      : 'animated-star-field';
  };
  applyReducedMotionPreference();
  reducedMotionMedia?.addEventListener?.('change', applyReducedMotionPreference);
  if (!reducedMotionMedia?.addEventListener) {
    reducedMotionMedia?.addListener?.(applyReducedMotionPreference);
  }

  sky.onBeforeRender = (_renderer, _scene, camera) => {
    camera.getWorldDirection(forward);
    sky.position.copy(camera.position).addScaledVector(forward, SKY_DISTANCE);

    // World-up keeps the backdrop aligned with the rendered road/mountain
    // horizon when TURN rolls the race camera. We deliberately do not copy the
    // camera quaternion.
    sky.up.set(0, 1, 0);
    sky.lookAt(camera.position);

    // Four copies of the compact star field represent one 360-degree turn.
    // Heading therefore moves the sampled UV region in the opposite direction
    // to camera yaw, exactly as a fixed distant sky should appear when the car
    // turns. A small catch-up lag gives the requested gentle parallax drag.
    //
    // The loading showcase is a deliberate camera cut, not a physical camera
    // move. If that large jump is fed through the same catch-up, the sky visibly
    // rolls into the pretty loading composition and rolls back out before the
    // race. Detect those discontinuities and snap the celestial layer on the
    // cut frame; normal driving still keeps the subtle parallax lag.
    const heading = Math.atan2(forward.x, forward.z);
    const headingJump = motion.heading === null
      ? 0
      : Math.abs(shortestAngle(motion.heading, heading));
    const positionJump = hasPreviousCameraPose
      ? previousCameraPosition.distanceTo(camera.position)
      : 0;
    const cameraCut = hasPreviousCameraPose
      && (headingJump >= SKY_CAMERA_CUT_HEADING || positionJump >= SKY_CAMERA_CUT_DISTANCE);

    // Reduced-motion users keep the moon as a world landmark, but get none of
    // the deliberate sky drag/parallax. Snap celestial heading directly to the
    // camera heading and suppress the extra position/pitch drift.
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
    const visibleU = Math.max(0.01, horizontalFov / TAU * SKY_HORIZONTAL_TILES);
    const baseU = 0.5 - visibleU * 0.5;
    const yawU = -motion.visualHeading / TAU * SKY_HORIZONTAL_TILES;
    motion.positionU = motion.reducedMotion
      ? 0
      : (camera.position.x - camera.position.z) * SKY_POSITION_PARALLAX;
    motion.pitchV = motion.reducedMotion ? 0 : forward.y * SKY_PITCH_PARALLAX;
    motion.visibleU = visibleU;
    motion.offsetU = baseU + yawU + motion.positionU;
    motion.offsetV = motion.pitchV;
    texture.repeat.set(visibleU, 1);
    texture.offset.set(motion.offsetU, motion.offsetV);

    // Cover the camera frustum without stretching the texture around geometry.
    const visibleHeight = 2 * SKY_DISTANCE * Math.tan(verticalFov / 2);
    const visibleWidth = visibleHeight * camera.aspect;
    const coverHeight = Math.max(visibleHeight, visibleWidth / SKY_IMAGE_ASPECT) * 1.05;
    motion.coverHeight = coverHeight;
    sky.scale.set(coverHeight * SKY_IMAGE_ASPECT, coverHeight, 1);
    sky.updateMatrixWorld(true);
  };

  sky.userData.turnMountainSkyLock = 'world-yaw-via-inverse-uv-with-world-up-roll-lock';
  sky.userData.turnMountainSkyHorizontalTiles = SKY_HORIZONTAL_TILES;
  sky.userData.turnMountainSkyYawCatchup = SKY_YAW_CATCHUP;
  sky.userData.turnMountainSkyCameraCuts = 'snap-large-camera-jumps-without-parallax-roll';
  sky.userData.turnMountainReducedMotionPolicy = 'hide-star-field-show-solid-track-background-keep-moon';
  return motion;
}

function lockMoonToSkyLayer(moon, sky, skyMotion) {
  const texture = moon?.material?.map;
  if (!moon || !sky || !skyMotion || !texture) return false;

  // The r6 moon lived 810 units from the camera while the stars lived at 840.
  // Move the moon onto the exact star plane and compensate its world size so
  // its apparent diameter is unchanged at the slightly greater distance.
  const legacySize = Math.max(Number(moon.scale?.x) || 0, Number(moon.scale?.y) || 0, 1);
  const apparentSize = legacySize * SKY_DISTANCE / LEGACY_MOON_DISTANCE;
  const moonMaterial = new THREE.MeshBasicMaterial({
    map: texture,
    color: moon.material?.color?.clone?.() || new THREE.Color(0xffffff),
    transparent: true,
    alphaTest: Number(moon.material?.alphaTest) || 0.025,
    depthTest: true,
    depthWrite: false,
    fog: false,
    toneMapped: false,
    side: THREE.DoubleSide
  });
  const moonLayer = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), moonMaterial);
  moonLayer.name = MOON_NAME;
  moonLayer.frustumCulled = false;
  moonLayer.renderOrder = -90;
  moonLayer.userData = {
    ...moon.userData,
    turnMountainMoonComposition: 'same-depth-child-of-star-plane-with-shared-xyz-and-uv-motion'
  };

  moon.parent?.remove(moon);
  moon.material?.dispose?.();
  sky.add(moonLayer);

  moonLayer.onBeforeRender = () => {
    if (!Number.isFinite(skyMotion.visibleU)
      || !Number.isFinite(skyMotion.offsetU)
      || !Number.isFinite(skyMotion.offsetV)) return;

    // Pick the equivalent anchor from the current 360-degree cycle. This keeps
    // one moon in the world rather than repeating it with every mirrored star
    // tile, while still bringing it back to the same place after a full turn.
    const centreSampleU = skyMotion.offsetU + skyMotion.visibleU * 0.5;
    const anchorU = MOON_SKY_ANCHOR_U
      + Math.round((centreSampleU - MOON_SKY_ANCHOR_U) / MOON_WORLD_U_PERIOD) * MOON_WORLD_U_PERIOD;

    // Invert the exact texture transform used by the stars. The moon therefore
    // sits on one fixed point of the star field in X and Y; because it is also a
    // child of the sky plane, it inherits the same Z depth, pitch and roll.
    const localU = (anchorU - skyMotion.offsetU) / skyMotion.visibleU;
    const localV = MOON_SKY_ANCHOR_V - skyMotion.offsetV;
    moonLayer.position.set(localU - 0.5, localV - 0.5, 0);

    // Parent scaling makes the backdrop cover the viewport. Divide it back out
    // so the moon keeps the same apparent diameter even though it now really is
    // at SKY_DISTANCE instead of the old 810-unit sprite distance.
    moonLayer.scale.set(
      apparentSize / Math.max(Math.abs(sky.scale.x), 1e-6),
      apparentSize / Math.max(Math.abs(sky.scale.y), 1e-6),
      1
    );
    moonLayer.updateMatrixWorld(true);
  };

  return true;
}

export function installMountainR7SkyFix(world) {
  if (!world) return world;

  const sky = world.getObjectByName(SKY_NAME);
  const moon = world.getObjectByName(MOON_NAME);
  const skyMotion = sky ? worldLockSky(sky) : null;
  const horizonLockedSky = Boolean(skyMotion);
  const moonSkyLocked = lockMoonToSkyLayer(moon, sky, skyMotion);

  world.userData.turnMountainR7Sky = Object.freeze({
    revision: REVISION,
    horizonLockedSky,
    skyYawLock: 'world-space-y-axis-via-inverse-four-tile-uv-rotation',
    skyGeometry: 'camera-facing-flat-backdrop',
    skyParallax: 'yaw-catchup-plus-subtle-position-and-pitch-drag',
    skyCameraCuts: 'snap-large-camera-jumps-so-loading-cuts-are-not-animated',
    skyHorizontalTiles: SKY_HORIZONTAL_TILES,
    skyYawCatchup: SKY_YAW_CATCHUP,
    reducedMotionSky: 'solid-track-background-with-moon-only-and-no-deliberate-sky-parallax',
    moonRepositioned: moonSkyLocked,
    moonSkyLock: 'literal-star-plane-child-with-shared-xyz-transform-and-fixed-uv-anchor',
    moonDistance: SKY_DISTANCE,
    moonSkyAnchor: Object.freeze({ u: MOON_SKY_ANCHOR_U, v: MOON_SKY_ANCHOR_V }),
    moonIntroTarget: Object.freeze({ x: 0.15, y: 0.18 }),
    noIndependentAnimationLoop: true
  });
  return world;
}
