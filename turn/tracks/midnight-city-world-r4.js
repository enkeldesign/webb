import * as THREE from 'three';
import { installMidnightCityWorld as installMidnightCityWorldR3 } from './midnight-city-world-r3.js?base=20260801-r3';

const TRACK_Y = 0.16;
const WARM_LIGHT = 0xffd27a;
const WINDOW_GOLD = 0xffc857;
const WINDOW_CYAN = 0x5de4ff;
const WINDOW_MAGENTA = 0xff4fa3;
const BUILDING_COLORS = Object.freeze([0x171a25, 0x20283a, 0x2b2138]);
const OLD_WINDOW_COLORS = Object.freeze([WINDOW_GOLD, WINDOW_CYAN]);
const DISTRICT_WINDOW_COLORS = Object.freeze([WINDOW_MAGENTA, WINDOW_CYAN, WINDOW_GOLD, 0x9d7cff]);
const REMOVED_BORDER_PREFIXES = Object.freeze([
  'Midnight City road edge',
  'Midnight City sidewalk'
]);

const DISTRICTS = Object.freeze([
  Object.freeze({
    id: 'neon-quarter',
    label: 'NEON QUARTER',
    centerX: -360,
    centerZ: 35,
    width: 310,
    depth: 250,
    columns: 4,
    rows: 3,
    minHeight: 22,
    maxHeight: 66,
    windowColor: WINDOW_MAGENTA,
    bodyPalette: 2
  }),
  Object.freeze({
    id: 'downtown-core',
    label: 'DOWNTOWN',
    centerX: 315,
    centerZ: 70,
    width: 330,
    depth: 310,
    columns: 4,
    rows: 4,
    minHeight: 46,
    maxHeight: 132,
    windowColor: WINDOW_CYAN,
    bodyPalette: 1
  }),
  Object.freeze({
    id: 'uptown',
    label: 'UPTOWN',
    centerX: -120,
    centerZ: 260,
    width: 430,
    depth: 155,
    columns: 6,
    rows: 2,
    minHeight: 30,
    maxHeight: 86,
    windowColor: WINDOW_GOLD,
    bodyPalette: 0
  }),
  Object.freeze({
    id: 'motor-mile',
    label: 'MOTOR MILE',
    centerX: 180,
    centerZ: -285,
    width: 500,
    depth: 150,
    columns: 7,
    rows: 2,
    minHeight: 15,
    maxHeight: 44,
    windowColor: 0x9d7cff,
    bodyPalette: 1
  })
]);

export function installMidnightCityWorld(options) {
  const world = installMidnightCityWorldR3(options);
  const samples = options.samples || [];
  const trackWidth = options.trackWidth || 27;

  const removedBorders = removeThickStreetBorders(world);
  const removedLegacyBuildings = removeLegacyBuildingInstances(world);
  const districtResult = installDistrictBuildings(world, samples, trackWidth);
  const lampPoolCount = installLampPostPools(world, samples, trackWidth);
  const detailCount = installDistrictDetails(world);

  world.name = 'TURN Midnight City r4';
  world.userData.turnMidnightCityArtDirection = Object.freeze({
    ...(world.userData.turnMidnightCityArtDirection || {}),
    version: 'r4',
    thickStreetBordersRemoved: removedBorders,
    legacyBuildingMeshesRemoved: removedLegacyBuildings,
    districtCount: DISTRICTS.length,
    districtBuildings: districtResult.buildingCount,
    districtBuildingsRejectedFromRoad: districtResult.rejectedCount,
    everyBuildingHasLitWindowBands: true,
    windowLightingTechnique: 'unlit emissive color bands on all four facades',
    lampPoolTechnique: 'one instanced radial-gradient quad beneath every visual lamp post',
    lampPoolCount,
    districtDetailCount: detailCount,
    externalAssetFiles: false,
    noIndependentAnimationLoop: true
  });

  return world;
}

function removeThickStreetBorders(world) {
  const removals = [];
  world.traverse((node) => {
    if (REMOVED_BORDER_PREFIXES.some((prefix) => node.name?.startsWith(prefix))) {
      removals.push(node);
    }
  });

  for (const node of removals) disposeAndRemove(node);
  return removals.length;
}

function removeLegacyBuildingInstances(world) {
  const removals = [];
  world.traverse((node) => {
    if (!node.isInstancedMesh) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    const isLegacyBuilding = materials.some((entry) => {
      const color = entry?.color?.getHex?.();
      const emissive = entry?.emissive?.getHex?.();
      return BUILDING_COLORS.includes(color) || OLD_WINDOW_COLORS.includes(emissive);
    });
    if (isLegacyBuilding) removals.push(node);
  });

  for (const node of removals) disposeAndRemove(node);
  return removals.length;
}

function disposeAndRemove(node) {
  node.parent?.remove(node);
  node.geometry?.dispose?.();
  const materials = Array.isArray(node.material) ? node.material : [node.material];
  for (const entry of materials) {
    entry?.map?.dispose?.();
    entry?.dispose?.();
  }
}

function installDistrictBuildings(world, samples, trackWidth) {
  const buildings = [];
  let rejectedCount = 0;

  for (let districtIndex = 0; districtIndex < DISTRICTS.length; districtIndex += 1) {
    const district = DISTRICTS[districtIndex];
    const cellWidth = district.width / district.columns;
    const cellDepth = district.depth / district.rows;

    for (let row = 0; row < district.rows; row += 1) {
      for (let column = 0; column < district.columns; column += 1) {
        const seed = districtIndex * 101 + row * 19 + column * 31;
        const width = cellWidth * (0.48 + pseudo(seed + 1) * 0.22);
        const depth = cellDepth * (0.46 + pseudo(seed + 2) * 0.23);
        const height = district.minHeight
          + pseudo(seed + 3) * (district.maxHeight - district.minHeight);
        const x = district.centerX - district.width / 2
          + cellWidth * (column + 0.5)
          + (pseudo(seed + 4) - 0.5) * Math.min(14, cellWidth * 0.16);
        const z = district.centerZ - district.depth / 2
          + cellDepth * (row + 0.5)
          + (pseudo(seed + 5) - 0.5) * Math.min(12, cellDepth * 0.16);
        const footprintRadius = Math.hypot(width, depth) / 2;

        if (!isBuildingClearOfTrack(x, z, footprintRadius, samples, trackWidth)) {
          rejectedCount += 1;
          continue;
        }

        buildings.push({
          district,
          x,
          z,
          width,
          depth,
          height,
          palette: (district.bodyPalette + column + row) % BUILDING_COLORS.length,
          windowColor: district.windowColor,
          seed
        });
      }
    }
  }

  installBuildingBodies(world, buildings);
  installWindowBands(world, buildings);
  installRoofDetails(world, buildings);
  installDistantDistrictSkyline(world, samples, trackWidth);

  return { buildingCount: buildings.length, rejectedCount };
}

function isBuildingClearOfTrack(x, z, footprintRadius, samples, trackWidth) {
  const requiredDistance = trackWidth / 2 + footprintRadius + 6;
  const requiredDistanceSquared = requiredDistance * requiredDistance;
  for (let index = 0; index < samples.length; index += 3) {
    const point = samples[index].point;
    const dx = x - point.x;
    const dz = z - point.z;
    if (dx * dx + dz * dz < requiredDistanceSquared) return false;
  }
  return true;
}

function installBuildingBodies(world, buildings) {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const materials = BUILDING_COLORS.map((color) => new THREE.MeshStandardMaterial({
    color,
    roughness: 0.82,
    metalness: 0.08
  }));
  const meshes = materials.map((entry, index) => {
    const mesh = new THREE.InstancedMesh(geometry, entry, buildings.length);
    mesh.name = `Midnight City district building bodies ${index + 1}`;
    return mesh;
  });
  const counts = materials.map(() => 0);
  const marker = new THREE.Object3D();

  for (const building of buildings) {
    marker.position.set(building.x, building.height / 2, building.z);
    marker.rotation.set(0, 0, 0);
    marker.scale.set(building.width, building.height, building.depth);
    marker.updateMatrix();
    meshes[building.palette].setMatrixAt(counts[building.palette], marker.matrix);
    counts[building.palette] += 1;
  }

  for (let index = 0; index < meshes.length; index += 1) {
    const mesh = meshes[index];
    mesh.count = counts[index];
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    world.add(mesh);
  }
}

function installWindowBands(world, buildings) {
  const geometry = new THREE.BoxGeometry(1, 1, 0.08);
  const byColor = new Map(DISTRICT_WINDOW_COLORS.map((color) => [color, []]));

  for (const building of buildings) {
    const bands = Math.max(2, Math.min(8, Math.floor(building.height / 12)));
    for (let band = 0; band < bands; band += 1) {
      const y = building.height * (0.2 + band * (0.64 / Math.max(1, bands - 1)));
      const bandHeight = Math.max(0.72, Math.min(1.7, building.height * 0.024));
      const entries = byColor.get(building.windowColor);
      entries.push(
        facadeTransform(building.x, y, building.z + building.depth / 2 + 0.07, 0, building.width * 0.72, bandHeight),
        facadeTransform(building.x, y, building.z - building.depth / 2 - 0.07, Math.PI, building.width * 0.72, bandHeight),
        facadeTransform(building.x + building.width / 2 + 0.07, y, building.z, Math.PI / 2, building.depth * 0.72, bandHeight),
        facadeTransform(building.x - building.width / 2 - 0.07, y, building.z, -Math.PI / 2, building.depth * 0.72, bandHeight)
      );
    }
  }

  for (const [color, transforms] of byColor) {
    const mesh = new THREE.InstancedMesh(
      geometry,
      new THREE.MeshBasicMaterial({ color, toneMapped: false }),
      Math.max(1, transforms.length)
    );
    mesh.name = `Midnight City lit windows ${color.toString(16)}`;
    const marker = new THREE.Object3D();
    for (let index = 0; index < transforms.length; index += 1) {
      const transform = transforms[index];
      marker.position.set(transform.x, transform.y, transform.z);
      marker.rotation.set(0, transform.rotation, 0);
      marker.scale.set(transform.width, transform.height, 1);
      marker.updateMatrix();
      mesh.setMatrixAt(index, marker.matrix);
    }
    mesh.count = transforms.length;
    mesh.instanceMatrix.needsUpdate = true;
    world.add(mesh);
  }
}

function facadeTransform(x, y, z, rotation, width, height) {
  return { x, y, z, rotation, width, height };
}

function installRoofDetails(world, buildings) {
  const crownGeometry = new THREE.BoxGeometry(1, 1, 1);
  const crownTransforms = [];
  const antennaTransforms = [];

  for (const building of buildings) {
    if (building.height > 60) {
      crownTransforms.push({
        x: building.x,
        y: building.height + 1.2,
        z: building.z,
        width: building.width * 0.55,
        height: 2.4,
        depth: building.depth * 0.55,
        color: building.windowColor
      });
    }
    if (building.height > 92 && pseudo(building.seed + 17) > 0.42) {
      antennaTransforms.push({
        x: building.x,
        y: building.height + 7,
        z: building.z,
        height: 14,
        color: building.windowColor
      });
    }
  }

  const crownsByColor = groupByColor(crownTransforms);
  for (const [color, transforms] of crownsByColor) {
    const mesh = new THREE.InstancedMesh(
      crownGeometry,
      new THREE.MeshBasicMaterial({ color, toneMapped: false }),
      Math.max(1, transforms.length)
    );
    mesh.name = `Midnight City rooftop crowns ${color.toString(16)}`;
    const marker = new THREE.Object3D();
    for (let index = 0; index < transforms.length; index += 1) {
      const entry = transforms[index];
      marker.position.set(entry.x, entry.y, entry.z);
      marker.scale.set(entry.width, entry.height, entry.depth);
      marker.updateMatrix();
      mesh.setMatrixAt(index, marker.matrix);
    }
    mesh.count = transforms.length;
    mesh.instanceMatrix.needsUpdate = true;
    world.add(mesh);
  }

  const antennaGeometry = new THREE.BoxGeometry(0.28, 1, 0.28);
  const antennasByColor = groupByColor(antennaTransforms);
  for (const [color, transforms] of antennasByColor) {
    const mesh = new THREE.InstancedMesh(
      antennaGeometry,
      new THREE.MeshBasicMaterial({ color, toneMapped: false }),
      Math.max(1, transforms.length)
    );
    mesh.name = `Midnight City rooftop antennas ${color.toString(16)}`;
    const marker = new THREE.Object3D();
    for (let index = 0; index < transforms.length; index += 1) {
      const entry = transforms[index];
      marker.position.set(entry.x, entry.y, entry.z);
      marker.scale.set(1, entry.height, 1);
      marker.updateMatrix();
      mesh.setMatrixAt(index, marker.matrix);
    }
    mesh.count = transforms.length;
    mesh.instanceMatrix.needsUpdate = true;
    world.add(mesh);
  }
}

function groupByColor(entries) {
  const groups = new Map();
  for (const entry of entries) {
    if (!groups.has(entry.color)) groups.set(entry.color, []);
    groups.get(entry.color).push(entry);
  }
  return groups;
}

function installDistantDistrictSkyline(world, samples, trackWidth) {
  const buildings = [];
  for (let index = 0; index < 40; index += 1) {
    const angle = (index / 40) * Math.PI * 2;
    const radiusX = 690 + pseudo(index * 9) * 110;
    const radiusZ = 505 + pseudo(index * 13 + 2) * 85;
    const width = 24 + pseudo(index * 17) * 42;
    const depth = 24 + pseudo(index * 19) * 40;
    const height = 82 + pseudo(index * 23) * 150;
    const x = Math.cos(angle) * radiusX;
    const z = Math.sin(angle) * radiusZ;
    if (!isBuildingClearOfTrack(x, z, Math.hypot(width, depth) / 2, samples, trackWidth)) continue;
    buildings.push({
      district: DISTRICTS[index % DISTRICTS.length],
      x,
      z,
      width,
      depth,
      height,
      palette: index % BUILDING_COLORS.length,
      windowColor: DISTRICT_WINDOW_COLORS[index % DISTRICT_WINDOW_COLORS.length],
      seed: index * 41
    });
  }
  installBuildingBodies(world, buildings);
  installWindowBands(world, buildings);
  installRoofDetails(world, buildings);
}

function installLampPostPools(world, samples, trackWidth) {
  if (!samples.length) return 0;

  const step = 10;
  const perSide = Math.ceil(samples.length / step);
  const total = perSide * 2;
  const texture = makeRadialLightTexture();
  const geometry = new THREE.PlaneGeometry(17, 17);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    color: WARM_LIGHT,
    transparent: true,
    opacity: 0.52,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false
  });
  const pools = new THREE.InstancedMesh(geometry, material, total);
  pools.name = 'Midnight City lamp-post gradient pools';
  const marker = new THREE.Object3D();
  let cursor = 0;

  for (const side of [-1, 1]) {
    for (let index = 0; index < samples.length; index += step) {
      const sample = samples[index];
      const bulbOffset = side * (trackWidth / 2 + 4.68);
      marker.position.copy(sample.point)
        .addScaledVector(sample.normal, bulbOffset)
        .setY(sample.point.y + TRACK_Y + 0.07);
      marker.rotation.set(-Math.PI / 2, 0, 0);
      marker.scale.set(1, 1, 1);
      marker.updateMatrix();
      pools.setMatrixAt(cursor, marker.matrix);
      cursor += 1;
    }
  }

  pools.count = cursor;
  pools.instanceMatrix.needsUpdate = true;
  pools.computeBoundingSphere?.();
  pools.renderOrder = 3;
  world.add(pools);
  return cursor;
}

function makeRadialLightTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255, 230, 150, 0.72)');
  gradient.addColorStop(0.34, 'rgba(255, 202, 92, 0.33)');
  gradient.addColorStop(1, 'rgba(255, 196, 70, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function installDistrictDetails(world) {
  let count = 0;
  for (const [index, district] of DISTRICTS.entries()) {
    const sign = makeDistrictSign(district.label, district.windowColor);
    const position = districtSignPosition(index);
    sign.position.set(position.x, position.y, position.z);
    sign.rotation.y = position.rotation;
    world.add(sign);
    count += 1;
  }

  const downtownSpireMaterial = new THREE.MeshBasicMaterial({ color: WINDOW_CYAN, toneMapped: false });
  for (const [x, z, height] of [[270, 205, 72], [350, 210, 58]]) {
    const spire = new THREE.Mesh(new THREE.ConeGeometry(3.2, height, 5), downtownSpireMaterial);
    spire.position.set(x, height / 2, z);
    world.add(spire);
    count += 1;
  }

  const canopyMaterial = new THREE.MeshBasicMaterial({ color: 0x9d7cff, toneMapped: false });
  for (const x of [-10, 70, 150, 230, 310]) {
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(34, 0.55, 9), canopyMaterial);
    canopy.position.set(x, 7.5, -325);
    world.add(canopy);
    count += 1;
  }

  return count;
}

function districtSignPosition(index) {
  return [
    { x: -470, y: 22, z: 35, rotation: Math.PI / 2 },
    { x: 455, y: 28, z: 70, rotation: -Math.PI / 2 },
    { x: -120, y: 22, z: 325, rotation: Math.PI },
    { x: 180, y: 16, z: -345, rotation: 0 }
  ][index];
}

function makeDistrictSign(label, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  const cssColor = `#${color.toString(16).padStart(6, '0')}`;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = 'rgba(5, 7, 15, 0.9)';
  context.fillRect(4, 4, canvas.width - 8, canvas.height - 8);
  context.strokeStyle = cssColor;
  context.lineWidth = 9;
  context.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
  context.fillStyle = cssColor;
  context.font = '900 62px system-ui, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(label, canvas.width / 2, canvas.height / 2 + 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(Math.max(28, label.length * 3.1), 7.5),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      toneMapped: false
    })
  );
  sign.name = `Midnight City district sign ${label}`;
  return sign;
}

function pseudo(seed) {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}
