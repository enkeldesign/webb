import * as THREE from 'three';

const REVISION = 'r7-world-yaw-cylinder-raised-moon';
const SKY_NAME = 'Mountain star field skydome r6';
const MOON_NAME = 'Mountain full moon sprite r6';
const SKY_RADIUS = 840;
const SKY_HEIGHT = 3000;
const SKY_REPEAT_X = 4;
const SKY_REPEAT_Y = 2;
const SKY_TRANSLATION_FOLLOW = 0.96;
const MOON_DISTANCE = 810;

// Keep the moon at the same azimuth as the established composition, but raise
// it to 17 degrees above the world horizon. The previous ~5.6-degree elevation
// looked right in the high loading camera but spent most of a lap hidden below
// the surrounding peaks.
const MOON_DIRECTION = new THREE.Vector3(0.003344, 0.292372, 0.956299).normalize();

function worldLockSky(sky) {
  const texture = sky.material?.map;
  if (!texture) return false;

  // The generated source is deliberately tiny. Repeat it around a cylindrical
  // world-space backdrop rather than stretching one 512px image through all
  // 360 degrees. A cylinder keeps the texture's verticals linear — unlike a
  // sphere, which visibly smears this non-equirectangular source toward its
  // poles — while mirrored wrapping hides hard repeat seams.
  texture.wrapS = THREE.MirroredRepeatWrapping;
  texture.wrapT = THREE.MirroredRepeatWrapping;
  texture.repeat.set(SKY_REPEAT_X, SKY_REPEAT_Y);
  texture.offset.set(0, 0);
  texture.needsUpdate = true;

  sky.geometry?.dispose?.();
  sky.geometry = new THREE.CylinderGeometry(
    SKY_RADIUS,
    SKY_RADIUS,
    SKY_HEIGHT,
    64,
    1,
    true
  );
  sky.material.side = THREE.BackSide;
  sky.material.depthWrite = false;
  sky.material.depthTest = true;
  sky.material.fog = false;
  sky.material.toneMapped = false;
  sky.material.needsUpdate = true;
  sky.scale.set(1, 1, 1);
  sky.rotation.set(0, 0, 0);
  sky.frustumCulled = false;
  sky.renderOrder = -100;

  sky.onBeforeRender = (_renderer, _scene, camera) => {
    // Rotation stays fixed in world space. Turning left/right therefore moves
    // the stars together with the mountain horizon instead of leaving the
    // texture glued to the phone screen.
    //
    // Follow 96% of camera translation in X/Z. The remaining 4% creates a very
    // small distant drag/parallax without making the sky feel like nearby
    // scenery. Y follows exactly so the tall open cylinder remains centred on
    // the camera vertically.
    sky.position.set(
      camera.position.x * SKY_TRANSLATION_FOLLOW,
      camera.position.y,
      camera.position.z * SKY_TRANSLATION_FOLLOW
    );
    sky.updateMatrixWorld(true);
  };

  sky.userData.turnMountainSkyLock = 'world-yaw-cylinder-with-subtle-translation-drag';
  sky.userData.turnMountainSkyRepeatX = SKY_REPEAT_X;
  sky.userData.turnMountainSkyRepeatY = SKY_REPEAT_Y;
  sky.userData.turnMountainSkyTranslationFollow = SKY_TRANSLATION_FOLLOW;
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
    skyYawLock: 'world-space-y-axis',
    skyGeometry: 'open-cylinder',
    skyParallax: 'four-percent-translation-drag',
    skyRepeatX: SKY_REPEAT_X,
    skyRepeatY: SKY_REPEAT_Y,
    skyTranslationFollow: SKY_TRANSLATION_FOLLOW,
    moonRepositioned,
    moonDirection: Object.freeze(MOON_DIRECTION.toArray()),
    moonElevationDegrees: 17,
    moonIntroTarget: Object.freeze({ x: 0.15, y: 0.18 }),
    noIndependentAnimationLoop: true
  });
  return world;
}
