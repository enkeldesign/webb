import * as THREE from 'three';

const REVISION = 'r7-horizon-locked-sky';
const SKY_NAME = 'Mountain star field skydome r6';
const MOON_NAME = 'Mountain full moon sprite r6';
const SKY_DISTANCE = 840;
const SKY_IMAGE_ASPECT = 2;
const SKY_UV_REPEAT = 0.86;
const SKY_PARALLAX_X = 0.04;
const SKY_PARALLAX_Y = 0.025;
const MOON_DISTANCE = 810;

// World-space celestial direction chosen against the actual production MOUNTAIN
// intro camera (285,128,-338 -> 6,45,92, 48deg FOV). It puts the moon around
// 15% from the left and 18% from the top so the lower edge tucks behind the
// left mountain peak, matching the supplied mockup rather than hiding behind
// the central terrain mass.
const MOON_DIRECTION = new THREE.Vector3(0.003480, 0.097952, 0.995185).normalize();

function horizonLockSky(sky) {
  const texture = sky.material?.map;
  if (!texture) return false;

  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.repeat.set(SKY_UV_REPEAT, SKY_UV_REPEAT);
  texture.needsUpdate = true;

  const forward = new THREE.Vector3();
  const baseOffset = (1 - SKY_UV_REPEAT) * 0.5;

  sky.onBeforeRender = (_renderer, _scene, camera) => {
    camera.getWorldDirection(forward);
    sky.position.copy(camera.position).addScaledVector(forward, SKY_DISTANCE);

    // The r6 backdrop copied camera.quaternion, which made the stars behave as
    // screen furniture when TURN rolled the race camera. Face the camera using
    // world-up instead: the backdrop still covers the view, but its vertical is
    // now the same vertical as the mountains/road and therefore rolls with the
    // rendered horizon rather than with the physical phone screen.
    sky.up.set(0, 1, 0);
    sky.lookAt(camera.position);

    // Keep the tiny generated texture crisp and mostly static, but let heading
    // and pitch reveal a few percent of neighbouring texture so it has the very
    // slight distant parallax expected from a sky rather than a fixed overlay.
    texture.offset.set(
      baseOffset + forward.x * SKY_PARALLAX_X,
      baseOffset + forward.y * SKY_PARALLAX_Y
    );

    const visibleHeight = 2 * SKY_DISTANCE * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const visibleWidth = visibleHeight * camera.aspect;
    const coverHeight = Math.max(visibleHeight, visibleWidth / SKY_IMAGE_ASPECT) * 1.05;
    sky.scale.set(coverHeight * SKY_IMAGE_ASPECT, coverHeight, 1);
    sky.updateMatrixWorld(true);
  };

  sky.userData.turnMountainSkyLock = 'world-up-horizon-with-subtle-heading-parallax';
  return true;
}

function repositionMoon(moon) {
  if (!moon) return false;
  moon.onBeforeRender = (_renderer, _scene, camera) => {
    moon.position.copy(camera.position).addScaledVector(MOON_DIRECTION, MOON_DISTANCE);
    moon.updateMatrixWorld(true);
  };
  moon.userData.turnMountainMoonComposition = 'production-intro-left-peak';
  return true;
}

export function installMountainR7SkyFix(world) {
  if (!world) return world;

  const sky = world.getObjectByName(SKY_NAME);
  const moon = world.getObjectByName(MOON_NAME);
  const horizonLockedSky = Boolean(sky && horizonLockSky(sky));
  const moonRepositioned = repositionMoon(moon);

  world.userData.turnMountainR7Sky = Object.freeze({
    revision: REVISION,
    horizonLockedSky,
    skyParallax: 'subtle-heading-and-pitch-texture-drift',
    moonRepositioned,
    moonDirection: Object.freeze(MOON_DIRECTION.toArray()),
    moonIntroTarget: Object.freeze({ x: 0.15, y: 0.18 }),
    noIndependentAnimationLoop: true
  });
  return world;
}
