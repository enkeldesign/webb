import * as THREE from 'three';

const REVISION = 'r7-world-yaw-uv-raised-moon-direction-fix';
const SKY_NAME = 'Mountain star field skydome r6';
const MOON_NAME = 'Mountain full moon sprite r6';
const SKY_DISTANCE = 840;
const SKY_IMAGE_ASPECT = 2;
const SKY_HORIZONTAL_TILES = 4;
const SKY_YAW_CATCHUP = 0.14;
const SKY_POSITION_PARALLAX = 0.00004;
const SKY_PITCH_PARALLAX = 0.025;
const MOON_DISTANCE = 810;
const TAU = Math.PI * 2;

// Keep the moon at the same azimuth as the established composition, but raise
// it to 17 degrees above the world horizon. The previous ~5.6-degree elevation
// looked right in the high loading camera but spent most of a lap hidden below
// the surrounding peaks.
const MOON_DIRECTION = new THREE.Vector3(0.003344, 0.292372, 0.956299).normalize();

function shortestAngle(from, to) {
  let delta = to - from;
  while (delta > Math.PI) delta -= TAU;
  while (delta < -Math.PI) delta += TAU;
  return delta;
}

function worldLockSky(sky) {
  const texture = sky.material?.map;
  if (!texture) return false;

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
  let visualHeading = null;

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
    const heading = Math.atan2(forward.x, forward.z);
    if (visualHeading === null) visualHeading = heading;
    visualHeading += shortestAngle(visualHeading, heading) * SKY_YAW_CATCHUP;

    const verticalFov = THREE.MathUtils.degToRad(camera.fov);
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
    const visibleU = Math.max(0.01, horizontalFov / TAU * SKY_HORIZONTAL_TILES);
    const baseU = 0.5 - visibleU * 0.5;
    const yawU = -visualHeading / TAU * SKY_HORIZONTAL_TILES;
    const positionU = (camera.position.x - camera.position.z) * SKY_POSITION_PARALLAX;
    texture.repeat.set(visibleU, 1);
    texture.offset.set(
      baseU + yawU + positionU,
      forward.y * SKY_PITCH_PARALLAX
    );

    // Cover the camera frustum without stretching the texture around geometry.
    const visibleHeight = 2 * SKY_DISTANCE * Math.tan(verticalFov / 2);
    const visibleWidth = visibleHeight * camera.aspect;
    const coverHeight = Math.max(visibleHeight, visibleWidth / SKY_IMAGE_ASPECT) * 1.05;
    sky.scale.set(coverHeight * SKY_IMAGE_ASPECT, coverHeight, 1);
    sky.updateMatrixWorld(true);
  };

  sky.userData.turnMountainSkyLock = 'world-yaw-via-inverse-uv-with-world-up-roll-lock';
  sky.userData.turnMountainSkyHorizontalTiles = SKY_HORIZONTAL_TILES;
  sky.userData.turnMountainSkyYawCatchup = SKY_YAW_CATCHUP;
  return true;
}

function repositionMoon(moon) {
  if (!moon) return false;
  moon.onBeforeRender = (_renderer, _scene, camera) => {
    moon.position.copy(camera.position).addScaledVector(MOON_DIRECTION, MOON_DISTANCE);
    moon.updateMatrixWorld(true);
  };
  moon.userData.turnMountainMoonComposition = 'raised-world-moon-for-race-and-lower-intro-camera';
  return true;
}

export function installMountainR7SkyFix(world) {
  if (!world) return world;

  const sky = world.getObjectByName(SKY_NAME);
  const moon = world.getObjectByName(MOON_NAME);
  const horizonLockedSky = Boolean(sky && worldLockSky(sky));
  const moonRepositioned = repositionMoon(moon);

  world.userData.turnMountainR7Sky = Object.freeze({
    revision: REVISION,
    horizonLockedSky,
    skyYawLock: 'world-space-y-axis-via-inverse-four-tile-uv-rotation',
    skyGeometry: 'camera-facing-flat-backdrop',
    skyParallax: 'yaw-catchup-plus-subtle-position-and-pitch-drag',
    skyHorizontalTiles: SKY_HORIZONTAL_TILES,
    skyYawCatchup: SKY_YAW_CATCHUP,
    moonRepositioned,
    moonDirection: Object.freeze(MOON_DIRECTION.toArray()),
    moonElevationDegrees: 17,
    moonIntroTarget: Object.freeze({ x: 0.15, y: 0.18 }),
    noIndependentAnimationLoop: true
  });
  return world;
}
