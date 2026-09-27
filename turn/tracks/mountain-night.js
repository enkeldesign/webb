import * as THREE from 'three';
import { installSharedNightSky } from '/turn/tracks/shared-night-sky.js';

const REVISION = 'r6-night-treatment';
const WARM_LIGHT = 0xffd27a;
const STREET_POOL_LIGHT = 0xffb000;
const WINDOW_LIGHT = 0xffc766;
const MOON_BLUE = 0xaed3ff;
const STREETLIGHT_PREFIX = 'Mountain Kenney Holiday lit streetlight r4';
const HOUSE_PREFIX = 'Mountain Kenney Suburban house r5';
const WINDOW_SURFACE_OFFSET = 0.025;

function collectNamed(world, prefix) {
  const result = [];
  world.traverse((object) => {
    if (object.name?.startsWith(prefix)) result.push(object);
  });
  return result;
}

function installStreetlightPoolsAndFill(world, terrainHeightAt) {
  const streetlights = collectNamed(world, STREETLIGHT_PREFIX);
  if (!streetlights.length) return { pools: null, poolCount: 0, pointLightCount: 0 };

  const poolGeometry = new THREE.CircleGeometry(11.5, 24);
  const poolMaterial = new THREE.MeshBasicMaterial({
    color: STREET_POOL_LIGHT,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false
  });
  const pools = new THREE.InstancedMesh(poolGeometry, poolMaterial, streetlights.length);
  pools.name = 'Mountain street-light snow pools r6';
  pools.frustumCulled = false;

  const marker = new THREE.Object3D();
  const bounds = new THREE.Box3();
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  let cursor = 0;

  for (const streetlight of streetlights) {
    streetlight.updateWorldMatrix(true, true);
    bounds.setFromObject(streetlight, true);
    if (bounds.isEmpty()) continue;
    bounds.getCenter(center);
    bounds.getSize(size);

    const groundY = typeof terrainHeightAt === 'function'
      ? terrainHeightAt(center.x, center.z)
      : bounds.min.y;
    marker.position.set(center.x, groundY + 0.16, center.z);
    marker.rotation.set(-Math.PI / 2, 0, 0);
    marker.scale.set(1, 1, 1);
    marker.updateMatrix();
    pools.setMatrixAt(cursor, marker.matrix);

    const light = new THREE.PointLight(WARM_LIGHT, 8.4, 66, 1.65);
    light.name = `Mountain warm streetlight fill r6 ${cursor + 1}`;
    light.position.set(center.x, bounds.max.y - size.y * 0.20, center.z);
    world.add(light);
    cursor += 1;
  }

  pools.count = cursor;
  pools.instanceMatrix.needsUpdate = true;
  world.add(pools);
  return { pools, poolCount: cursor, pointLightCount: cursor };
}

function localBounds(object) {
  object.updateWorldMatrix(true, true);
  const inverseRoot = object.matrixWorld.clone().invert();
  const result = new THREE.Box3();
  let hasBounds = false;

  object.traverse((node) => {
    if (!node?.isMesh || !node.geometry) return;
    if (!node.geometry.boundingBox) node.geometry.computeBoundingBox();
    if (!node.geometry.boundingBox) return;
    const nodeBox = node.geometry.boundingBox.clone();
    const relativeMatrix = inverseRoot.clone().multiply(node.matrixWorld);
    nodeBox.applyMatrix4(relativeMatrix);
    if (!hasBounds) {
      result.copy(nodeBox);
      hasBounds = true;
    } else {
      result.union(nodeBox);
    }
  });

  return hasBounds ? result : null;
}

function worldCorners(object, box) {
  const corners = [];
  for (const x of [box.min.x, box.max.x]) {
    for (const y of [box.min.y, box.max.y]) {
      for (const z of [box.min.z, box.max.z]) {
        corners.push(object.localToWorld(new THREE.Vector3(x, y, z)));
      }
    }
  }
  return corners;
}

function nearestTrackSample(samples, x, z) {
  let nearest = samples[0];
  let distanceSq = Infinity;
  for (const sample of samples) {
    const dx = sample.point.x - x;
    const dz = sample.point.z - z;
    const next = dx * dx + dz * dz;
    if (next < distanceSq) {
      nearest = sample;
      distanceSq = next;
    }
  }
  return nearest;
}

function snapWindowToFacade(house, candidate, towardRoad, rayDistance) {
  const raycaster = new THREE.Raycaster();
  const inward = towardRoad.clone().negate();
  const origin = candidate.clone().addScaledVector(towardRoad, 2.5);
  raycaster.set(origin, inward);
  raycaster.far = rayDistance + 5;

  const normalMatrix = new THREE.Matrix3();
  for (const hit of raycaster.intersectObject(house, true)) {
    if (!hit.face || !hit.object?.isMesh) continue;
    normalMatrix.getNormalMatrix(hit.object.matrixWorld);
    const normal = hit.face.normal.clone().applyMatrix3(normalMatrix).normalize();

    // Ignore roofs, floors and back-facing geometry. We want the first actual
    // vertical wall surface facing the road, not the building's bounding box or
    // a roof/eave that happens to stick farther out.
    if (Math.abs(normal.y) > 0.45) continue;
    if (normal.dot(towardRoad) < 0.25) continue;

    return {
      position: hit.point.clone().addScaledVector(normal, WINDOW_SURFACE_OFFSET),
      yaw: Math.atan2(normal.x, normal.z)
    };
  }
  return null;
}

function makeWindowSpecs(house, samples, houseIndex) {
  const box = localBounds(house);
  if (!box) return [];
  const corners = worldCorners(house, box);
  const center = corners.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / corners.length);
  const sample = nearestTrackSample(samples, center.x, center.z);
  if (!sample) return [];

  const towardRoad = new THREE.Vector3(sample.point.x - center.x, 0, sample.point.z - center.z);
  if (towardRoad.lengthSq() < 1e-6) return [];
  towardRoad.normalize();
  const alongFacade = new THREE.Vector3(towardRoad.z, 0, -towardRoad.x).normalize();

  let roadExtent = 0;
  let alongExtent = 0;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const corner of corners) {
    const delta = corner.clone().sub(center);
    roadExtent = Math.max(roadExtent, Math.abs(delta.dot(towardRoad)));
    alongExtent = Math.max(alongExtent, Math.abs(delta.dot(alongFacade)));
    minY = Math.min(minY, corner.y);
    maxY = Math.max(maxY, corner.y);
  }

  const facadeWidth = alongExtent * 2;
  const height = maxY - minY;
  if (facadeWidth < 2 || height < 3) return [];

  const columns = THREE.MathUtils.clamp(Math.floor(facadeWidth / 2.45), 2, 3);
  const windowWidth = THREE.MathUtils.clamp(facadeWidth / (columns * 2.05), 0.7, 1.18);
  const windowHeight = THREE.MathUtils.clamp(height * 0.085, 0.68, 0.95);
  const facadeCenter = center.clone().addScaledVector(towardRoad, roadExtent + 0.075);
  const rows = [0.31];
  if (height >= 9.6 && houseIndex % 2 === 0) rows.push(0.52);

  const specs = [];
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const count = rowIndex === 0 ? columns : Math.max(2, columns - 1);
    const spread = Math.min(facadeWidth * 0.68, (count - 1) * 2.05);
    for (let column = 0; column < count; column += 1) {
      const along = count === 1 ? 0 : THREE.MathUtils.lerp(-spread / 2, spread / 2, column / (count - 1));
      const candidate = facadeCenter.clone().addScaledVector(alongFacade, along);
      candidate.y = minY + height * rows[rowIndex];
      const surface = snapWindowToFacade(house, candidate, towardRoad, roadExtent * 2);
      if (!surface) continue;
      specs.push({
        position: surface.position,
        yaw: surface.yaw,
        width: windowWidth,
        height: windowHeight,
        surfaceSnapped: true
      });
    }
  }
  return specs;
}

function installHouseWindowGlow(world, samples) {
  const houses = collectNamed(world, HOUSE_PREFIX);
  const specs = houses.flatMap((house, index) => makeWindowSpecs(house, samples, index));
  if (!specs.length) return { core: null, halo: null, windowCount: 0, houseCount: houses.length, spillLightCount: 0, surfaceSnappedCount: 0 };

  const geometry = new THREE.PlaneGeometry(1, 1);
  const core = new THREE.InstancedMesh(
    geometry,
    new THREE.MeshBasicMaterial({
      color: WINDOW_LIGHT,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false
    }),
    specs.length
  );
  core.name = 'Mountain warm house windows r6';

  const halo = new THREE.InstancedMesh(
    geometry,
    new THREE.MeshBasicMaterial({
      color: WINDOW_LIGHT,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false
    }),
    specs.length
  );
  halo.name = 'Mountain warm house window halos r6';

  const marker = new THREE.Object3D();
  specs.forEach((spec, index) => {
    marker.position.copy(spec.position);
    marker.rotation.set(0, spec.yaw, 0);
    marker.scale.set(spec.width, spec.height, 1);
    marker.updateMatrix();
    core.setMatrixAt(index, marker.matrix);

    marker.scale.set(spec.width * 1.65, spec.height * 1.55, 1);
    marker.updateMatrix();
    halo.setMatrixAt(index, marker.matrix);
  });

  core.instanceMatrix.needsUpdate = true;
  halo.instanceMatrix.needsUpdate = true;
  core.frustumCulled = false;
  halo.frustumCulled = false;
  world.add(core, halo);

  // A small number of real local lights provide warm spill on nearby snow and
  // timber while every house still gets cheap emissive-looking window panels.
  let spillLightCount = 0;
  houses.forEach((house, index) => {
    if (index % 3 !== 0) return;
    const box = new THREE.Box3().setFromObject(house, true);
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const light = new THREE.PointLight(WINDOW_LIGHT, 2.8, 25, 1.85);
    light.name = `Mountain house window spill r6 ${index + 1}`;
    light.position.set(center.x, box.min.y + (box.max.y - box.min.y) * 0.36, center.z);
    world.add(light);
    spillLightCount += 1;
  });

  return {
    core,
    halo,
    windowCount: specs.length,
    houseCount: houses.length,
    spillLightCount,
    surfaceSnappedCount: specs.filter((spec) => spec.surfaceSnapped).length
  };
}

function strengthenMoonlitWater(world) {
  let count = 0;
  world.traverse((object) => {
    if (!object?.isMesh || !/waterfall|connector water/i.test(object.name || '')) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    const replacements = materials.map((material) => {
      if (!material?.isMeshStandardMaterial) return material;
      const clone = material.clone();
      clone.emissive = new THREE.Color(MOON_BLUE).multiplyScalar(0.34);
      clone.emissiveIntensity = Math.max(Number(clone.emissiveIntensity) || 0, 0.46);
      clone.needsUpdate = true;
      count += 1;
      return clone;
    });
    object.material = Array.isArray(object.material) ? replacements : replacements[0];
  });
  return count;
}

export async function installMountainR6Night(world, samples, _trackWidth, terrainContext) {
  if (!world || !Array.isArray(samples) || !samples.length) return world;

  const skyRuntime = installSharedNightSky(world, { trackId: 'mountain' });
  await skyRuntime?.ready;
  const skyContract = world.userData.turnSharedNightSky;
  const errors = skyRuntime?.errors ? [...skyRuntime.errors] : [];

  const streetlights = installStreetlightPoolsAndFill(world, terrainContext?.terrainHeightAt);
  const windows = installHouseWindowGlow(world, samples);
  const moonlitWaterMaterials = strengthenMoonlitWater(world);

  world.userData.turnMountainR6Night = Object.freeze({
    revision: REVISION,
    starSky: Boolean(skyRuntime?.sky),
    moon: Boolean(skyRuntime?.moon),
    proceduralSharedSky: Boolean(skyContract?.procedural),
    moonDirection: skyContract?.moonDirection || 'shared-southern-celestial-anchor',
    moonDistance: skyContract?.moonDistance ?? null,
    moonSize: skyContract?.moonApparentSize ?? null,
    streetLightPoolCount: streetlights.poolCount,
    streetLightPointLightCount: streetlights.pointLightCount,
    litHouseCount: windows.houseCount,
    windowPanelCount: windows.windowCount,
    surfaceSnappedWindowCount: windows.surfaceSnappedCount,
    houseSpillLightCount: windows.spillLightCount,
    moonlitWaterMaterials,
    noIndependentAnimationLoop: true
  });
  world.userData.turnMountainR6AssetErrors = errors;
  return world;
}
