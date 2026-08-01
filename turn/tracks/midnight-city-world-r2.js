import * as THREE from 'three';
import { installMidnightCityWorld as installMidnightCityWorldR1 } from './midnight-city-world.js?base=20260801-r1';

const WARM_LIGHT = 0xffd27a;
const PLAYER_FILL = 0xffe3b3;
const PLAYER_LIGHT_RIG_NAME = 'TURN Midnight City player light rig';
const STREET_POOL_NAME = 'Midnight City street-light road pools';

export function installMidnightCityWorld(options) {
  const world = installMidnightCityWorldR1(options);
  const playerLightRig = installPlayerLightRig(options.runtime?.playerCar);
  const streetLightCount = strengthenStreetLights(world);
  const streetPools = makeStreetLightPools(world, options.samples || []);

  world.name = 'TURN Midnight City r2';
  world.userData.turnPlayerLightRig = playerLightRig;
  world.userData.turnMidnightCityArtDirection = Object.freeze({
    ...(world.userData.turnMidnightCityArtDirection || {}),
    version: 'r2',
    playerVisibilityLight: 'dual invisible local fill',
    streetLightReach: 'stronger point lights and instanced road pools',
    strengthenedStreetLightCount: streetLightCount,
    streetLightPoolCount: streetPools?.count || 0,
    noIndependentAnimationLoop: true
  });

  return world;
}

function installPlayerLightRig(playerCar) {
  if (!playerCar) return null;

  const existing = playerCar.getObjectByName?.(PLAYER_LIGHT_RIG_NAME);
  if (existing) return existing;

  const rig = new THREE.Group();
  rig.name = PLAYER_LIGHT_RIG_NAME;

  for (const side of [-1, 1]) {
    const light = new THREE.PointLight(PLAYER_FILL, 6.2, 58, 1.72);
    light.name = `Midnight City player fill ${side < 0 ? 'left' : 'right'}`;
    light.position.set(side * 1.55, 2.85, 2.4);
    light.castShadow = false;
    rig.add(light);
  }

  playerCar.add(rig);
  rig.visible = true;
  rig.userData.turnTrackVisibility = 'midnight-city';

  window.addEventListener('turn:track-changed', (event) => {
    rig.visible = event.detail?.trackId === 'midnight-city';
  });

  return rig;
}

function strengthenStreetLights(world) {
  let count = 0;
  world.traverse((node) => {
    if (!node.isPointLight || node.color?.getHex() !== WARM_LIGHT) return;
    node.intensity = Math.max(node.intensity, 11.5);
    node.distance = Math.max(node.distance, 96);
    node.decay = 1.5;
    node.castShadow = false;
    count += 1;
  });
  return count;
}

function makeStreetLightPools(world, samples) {
  if (!samples.length) return null;

  const step = 45;
  const count = Math.ceil(samples.length / step);
  const geometry = new THREE.CircleGeometry(11.5, 24);
  const poolMaterial = new THREE.MeshBasicMaterial({
    color: WARM_LIGHT,
    transparent: true,
    opacity: 0.13,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  });
  const pools = new THREE.InstancedMesh(geometry, poolMaterial, count);
  pools.name = STREET_POOL_NAME;
  pools.frustumCulled = false;

  const marker = new THREE.Object3D();
  let cursor = 0;
  for (let index = 0; index < samples.length; index += step) {
    const sample = samples[index];
    marker.position.copy(sample.point).setY(sample.point.y + 0.205);
    marker.rotation.set(-Math.PI / 2, 0, 0);
    marker.scale.set(1, 1, 1);
    marker.updateMatrix();
    pools.setMatrixAt(cursor, marker.matrix);
    cursor += 1;
  }

  pools.count = cursor;
  pools.instanceMatrix.needsUpdate = true;
  world.add(pools);
  return pools;
}
