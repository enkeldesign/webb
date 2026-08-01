import * as THREE from 'three';
import { installMidnightCityWorld as installMidnightCityWorldR2 } from './midnight-city-world-r2.js?base=20260801-r2';

const WARM_LIGHT = 0xffd27a;
const PLAYER_FILL = 0xffe3b3;
const LEFT_EDGE = 0x74e8ff;
const RIGHT_EDGE = 0xffd27a;
const PLAYER_LIGHT_RIG_NAME = 'TURN Midnight City player light rig';
const STREET_POOL_NAME = 'Midnight City street-light road pools';
const HEADLIGHT_PROJECTION_NAME = 'Midnight City projected headlights';
const EDGE_GUIDANCE_NAME = 'Midnight City reflective track borders';
const TRACK_Y = 0.16;

export function installMidnightCityWorld(options) {
  const world = installMidnightCityWorldR2(options);
  const samples = options.samples || [];
  const trackWidth = options.trackWidth || 27;

  const removedPoolCount = removeUnanchoredStreetPools(world);
  const playerLighting = replacePlayerLighting(options.runtime?.playerCar);
  const streetLighting = alignSparseStreetLights(world, samples, trackWidth);
  const edgeGuidance = makeTrackBorderGuidance(world, samples, trackWidth);

  world.name = 'TURN Midnight City r3';
  world.userData.turnPlayerLightRig = playerLighting;
  world.userData.turnMidnightCityArtDirection = Object.freeze({
    ...(world.userData.turnMidnightCityArtDirection || {}),
    version: 'r3',
    playerVisibilityLight: 'one short-range fill plus projected unlit headlights',
    streetLightReach: 'six sparse real lights anchored to visible lamp posts',
    randomRoadPoolsRemoved: removedPoolCount > 0,
    activeStreetLightCount: streetLighting.active,
    disabledStreetLightCount: streetLighting.disabled,
    trackBorderGuidance: 'continuous cyan-left amber-right reflective ribbons and studs',
    edgeGuidanceMeshes: edgeGuidance,
    noIndependentAnimationLoop: true
  });

  return world;
}

function removeUnanchoredStreetPools(world) {
  const pools = world.getObjectByName(STREET_POOL_NAME);
  if (!pools) return 0;

  pools.parent?.remove(pools);
  pools.geometry?.dispose?.();
  if (Array.isArray(pools.material)) {
    for (const entry of pools.material) entry.dispose?.();
  } else {
    pools.material?.dispose?.();
  }
  return pools.count || 1;
}

function replacePlayerLighting(playerCar) {
  if (!playerCar) return null;

  const rig = playerCar.getObjectByName?.(PLAYER_LIGHT_RIG_NAME);
  if (!rig) return null;

  for (const child of [...rig.children]) rig.remove(child);

  const fill = new THREE.PointLight(PLAYER_FILL, 3.1, 17, 2);
  fill.name = 'Midnight City player visibility fill';
  fill.position.set(0, 2.55, 0.45);
  fill.castShadow = false;
  rig.add(fill);

  const headlights = new THREE.Group();
  headlights.name = HEADLIGHT_PROJECTION_NAME;
  headlights.add(
    makeHeadlightWedge({
      nearWidth: 3.8,
      farWidth: 17,
      nearZ: -1.7,
      farZ: -38,
      opacity: 0.075
    }),
    makeHeadlightWedge({
      nearWidth: 2.5,
      farWidth: 9.5,
      nearZ: -1.4,
      farZ: -28,
      opacity: 0.14
    })
  );
  rig.add(headlights);

  return rig;
}

function makeHeadlightWedge({ nearWidth, farWidth, nearZ, farZ, opacity }) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -nearWidth / 2, 0.24, nearZ,
    nearWidth / 2, 0.24, nearZ,
    -farWidth / 2, 0.24, farZ,
    farWidth / 2, 0.24, farZ
  ], 3));
  geometry.setIndex([0, 2, 1, 1, 2, 3]);
  geometry.computeVertexNormals();

  const beam = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      color: PLAYER_FILL,
      transparent: true,
      opacity,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -2
    })
  );
  beam.renderOrder = 5;
  return beam;
}

function alignSparseStreetLights(world, samples, trackWidth) {
  if (!samples.length) return { active: 0, disabled: 0 };

  const lights = [];
  world.traverse((node) => {
    if (node.isPointLight && node.color?.getHex() === WARM_LIGHT) lights.push(node);
  });

  let active = 0;
  let disabled = 0;
  for (let index = 0; index < lights.length; index += 1) {
    const light = lights[index];
    if (index % 2 === 1) {
      light.visible = false;
      disabled += 1;
      continue;
    }

    const sampleIndex = (index * 90) % samples.length;
    const sample = samples[sampleIndex];
    const side = active % 2 === 0 ? 1 : -1;
    const bulbOffset = side * (trackWidth / 2 + 4.68);

    light.visible = true;
    light.position.copy(sample.point)
      .addScaledVector(sample.normal, bulbOffset)
      .setY(sample.point.y + 7.35);
    light.intensity = 7.2;
    light.distance = 62;
    light.decay = 1.9;
    light.castShadow = false;
    light.name = `Midnight City anchored street light ${active + 1}`;
    active += 1;
  }

  return { active, disabled };
}

function makeTrackBorderGuidance(world, samples, trackWidth) {
  if (!samples.length) return 0;

  const guidance = new THREE.Group();
  guidance.name = EDGE_GUIDANCE_NAME;

  for (const side of [1, -1]) {
    const color = side > 0 ? LEFT_EDGE : RIGHT_EDGE;
    const ribbon = makeEdgeRibbon(samples, side, trackWidth, color);
    const studs = makeEdgeStuds(samples, side, trackWidth, color);
    guidance.add(ribbon, studs);
  }

  world.add(guidance);
  return guidance.children.length;
}

function makeEdgeRibbon(samples, side, trackWidth, color) {
  const halfWidth = trackWidth / 2;
  const ribbonWidth = 0.46;
  const centreOffset = side * (halfWidth - 0.18);
  const innerOffset = centreOffset - ribbonWidth / 2;
  const outerOffset = centreOffset + ribbonWidth / 2;
  const positions = [];
  const indices = [];

  for (let index = 0; index <= samples.length; index += 1) {
    const sample = samples[index % samples.length];
    const inner = sample.point.clone()
      .addScaledVector(sample.normal, innerOffset)
      .setY(sample.point.y + TRACK_Y + 0.085);
    const outer = sample.point.clone()
      .addScaledVector(sample.normal, outerOffset)
      .setY(sample.point.y + TRACK_Y + 0.085);
    positions.push(inner.x, inner.y, inner.z, outer.x, outer.y, outer.z);
  }

  for (let index = 0; index < samples.length; index += 1) {
    const a = index * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, c, b, b, c, d);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);

  const ribbon = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false
    })
  );
  ribbon.name = `Midnight City ${side > 0 ? 'left' : 'right'} reflective edge ribbon`;
  ribbon.renderOrder = 4;
  return ribbon;
}

function makeEdgeStuds(samples, side, trackWidth, color) {
  const step = 9;
  const count = Math.ceil(samples.length / step);
  const geometry = new THREE.BoxGeometry(0.48, 0.055, 1.35);
  const studs = new THREE.InstancedMesh(
    geometry,
    new THREE.MeshBasicMaterial({ color, toneMapped: false }),
    count
  );
  const marker = new THREE.Object3D();
  let cursor = 0;

  for (let index = 0; index < samples.length; index += step) {
    const sample = samples[index];
    marker.position.copy(sample.point)
      .addScaledVector(sample.normal, side * (trackWidth / 2 - 0.72))
      .setY(sample.point.y + TRACK_Y + 0.125);
    marker.rotation.set(0, Math.atan2(sample.tangent.x, sample.tangent.z), 0);
    marker.updateMatrix();
    studs.setMatrixAt(cursor, marker.matrix);
    cursor += 1;
  }

  studs.count = cursor;
  studs.instanceMatrix.needsUpdate = true;
  studs.name = `Midnight City ${side > 0 ? 'left' : 'right'} reflective edge studs`;
  studs.frustumCulled = false;
  return studs;
}
