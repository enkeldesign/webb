import * as THREE from 'three';
import { installMidnightCityWorld as installMidnightCityWorldR6 } from './midnight-city-world-r6.js?base=20260801-r6';

const TRACK_Y = 0.16;
const COMMONS_CENTER = Object.freeze({ x: 80, z: 75 });
const COLORS = Object.freeze({
  trunk: 0x4b3024,
  foliage: 0x174f40,
  cyan: 0x5de4ff,
  violet: 0x9d7cff,
  yellow: 0xffdc68,
  path: 0x343d49,
  pathTrim: 0xb8f7ff
});

const SECONDARY_PARKS = Object.freeze([
  Object.freeze({
    label: 'VIOLET GARDENS',
    x: -590,
    z: -125,
    radius: 42,
    color: COLORS.violet,
    roadSide: 1
  }),
  Object.freeze({
    label: 'SUNRISE PARK',
    x: 570,
    z: 145,
    radius: 44,
    color: COLORS.yellow,
    roadSide: -1
  })
]);

export function installMidnightCityWorld(options) {
  const world = installMidnightCityWorldR6(options);

  const readableSigns = installReadableSignBacks(world);
  const relocatedParks = relocateSecondaryParks(world);
  const treeResult = rebuildParkTrees(world);

  world.name = 'TURN Midnight City r7';
  world.userData.turnMidnightCityArtDirection = Object.freeze({
    ...(world.userData.turnMidnightCityArtDirection || {}),
    version: 'r7',
    readableTwoSidedSigns: readableSigns,
    signTechnique: 'separate front-facing planes on each side, never mirrored DoubleSide text',
    secondaryParkLocations: Object.freeze(SECONDARY_PARKS.map(({ label, x, z }) => Object.freeze({ label, x, z }))),
    secondaryParksRelocatedTrackside: relocatedParks,
    secondaryParkApproaches: relocatedParks,
    rebuiltParkTreeCount: treeResult.treeCount,
    noDynamicLightsAdded: true,
    noIndependentAnimationLoop: true
  });

  return world;
}

function installReadableSignBacks(world) {
  const signs = [];
  world.traverse((node) => {
    if (!node.isMesh || !node.material || node.userData.turnReadableSignBack) return;
    const isCitySign =
      node.name?.startsWith('Midnight City neon sign ') ||
      node.name?.startsWith('Midnight City district sign ') ||
      node.name === 'Midnight City showcase park title TURN COMMONS';
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    if (isCitySign && materials.some((material) => material?.map)) signs.push(node);
  });

  for (const sign of signs) {
    const materials = Array.isArray(sign.material) ? sign.material : [sign.material];
    for (const material of materials) {
      material.side = THREE.FrontSide;
      material.needsUpdate = true;
    }

    const reverseMaterials = materials.map((material) => {
      const clone = material.clone();
      clone.side = THREE.FrontSide;
      clone.needsUpdate = true;
      return clone;
    });
    const reverse = new THREE.Mesh(
      sign.geometry,
      Array.isArray(sign.material) ? reverseMaterials : reverseMaterials[0]
    );
    reverse.name = `${sign.name} readable reverse`;
    reverse.position.z = -0.012;
    reverse.rotation.y = Math.PI;
    reverse.renderOrder = sign.renderOrder;
    reverse.frustumCulled = sign.frustumCulled;
    reverse.userData.turnReadableSignBack = true;
    sign.add(reverse);
    sign.userData.turnReadableSignPair = true;
  }

  return signs.length;
}

function relocateSecondaryParks(world) {
  let relocated = 0;
  for (const park of SECONDARY_PARKS) {
    const group = world.getObjectByName(`Midnight City park ${park.label}`);
    if (!group) continue;
    group.position.set(park.x, group.position.y, park.z);
    group.name = `Midnight City trackside park ${park.label}`;
    addParkApproach(group, park);
    relocated += 1;
  }
  return relocated;
}

function addParkApproach(group, park) {
  const approach = new THREE.Group();
  approach.name = `Midnight City ${park.label} track-facing entrance`;

  const path = new THREE.Mesh(
    new THREE.PlaneGeometry(park.radius * 0.72, 8.5),
    new THREE.MeshBasicMaterial({
      color: COLORS.path,
      side: THREE.DoubleSide,
      toneMapped: false
    })
  );
  path.rotation.x = -Math.PI / 2;
  path.position.set(park.roadSide * park.radius * 0.68, TRACK_Y + 0.07, 0);
  path.name = `${park.label} entrance path`;
  approach.add(path);

  for (const z of [-4.55, 4.55]) {
    const trim = new THREE.Mesh(
      new THREE.PlaneGeometry(park.radius * 0.72, 0.45),
      new THREE.MeshBasicMaterial({
        color: park.color,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        toneMapped: false
      })
    );
    trim.rotation.x = -Math.PI / 2;
    trim.position.set(park.roadSide * park.radius * 0.68, TRACK_Y + 0.082, z);
    approach.add(trim);
  }

  const gateMaterial = new THREE.MeshBasicMaterial({ color: park.color, toneMapped: false });
  for (const z of [-5.5, 5.5]) {
    const gate = new THREE.Mesh(new THREE.BoxGeometry(0.55, 4.6, 0.55), gateMaterial);
    gate.position.set(park.roadSide * (park.radius + 1.5), TRACK_Y + 2.3, z);
    approach.add(gate);
  }

  group.add(approach);
}

function rebuildParkTrees(world) {
  const removals = [];
  world.traverse((node) => {
    if (
      node.name === 'Midnight City reframed park tree trunks' ||
      node.name?.startsWith('Midnight City reframed park crowns ')
    ) {
      removals.push(node);
    }
  });
  for (const node of removals) disposeAndRemove(node);

  const trees = [];
  addCommonsTrees(trees);
  for (const park of SECONDARY_PARKS) addSecondaryParkTrees(trees, park);
  installTreeInstances(world, trees);
  return { removedMeshes: removals.length, treeCount: trees.length };
}

function addCommonsTrees(trees) {
  for (let index = 0; index < 23; index += 1) {
    const angle = (index / 23) * Math.PI * 2;
    const roadFacingOpening = angle > Math.PI * 1.52 || angle < Math.PI * 0.12;
    if (roadFacingOpening && index % 2 === 0) continue;
    const radiusX = 47 + pseudo(index * 11) * 3;
    const radiusZ = 38 + pseudo(index * 17) * 4;
    trees.push({
      x: COMMONS_CENTER.x + Math.cos(angle) * radiusX,
      z: COMMONS_CENTER.z + Math.sin(angle) * radiusZ,
      height: 7 + pseudo(index * 29) * 4,
      color: COLORS.cyan
    });
  }
}

function addSecondaryParkTrees(trees, park) {
  for (let index = 0; index < 15; index += 1) {
    const angle = (index / 15) * Math.PI * 2;
    const facesRoad = park.roadSide > 0
      ? Math.cos(angle) > 0.72
      : Math.cos(angle) < -0.72;
    if (facesRoad && index % 2 === 0) continue;
    const radius = park.radius * (0.74 + pseudo(index * 13 + park.x) * 0.14);
    trees.push({
      x: park.x + Math.cos(angle) * radius,
      z: park.z + Math.sin(angle) * radius,
      height: 5.4 + pseudo(index * 31 + park.z) * 3.5,
      color: park.color
    });
  }
}

function installTreeInstances(world, trees) {
  if (!trees.length) return;

  const trunkMesh = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.34, 0.52, 1, 7),
    new THREE.MeshStandardMaterial({ color: COLORS.trunk, roughness: 1 }),
    trees.length
  );
  trunkMesh.name = 'Midnight City trackside park tree trunks r7';

  const crownGroups = new Map();
  for (const tree of trees) {
    if (!crownGroups.has(tree.color)) crownGroups.set(tree.color, []);
    crownGroups.get(tree.color).push(tree);
  }

  const marker = new THREE.Object3D();
  for (let index = 0; index < trees.length; index += 1) {
    const tree = trees[index];
    const trunkHeight = tree.height * 0.42;
    marker.position.set(tree.x, TRACK_Y + trunkHeight / 2, tree.z);
    marker.scale.set(1, trunkHeight, 1);
    marker.rotation.set(0, pseudo(index) * Math.PI, 0);
    marker.updateMatrix();
    trunkMesh.setMatrixAt(index, marker.matrix);
  }
  trunkMesh.instanceMatrix.needsUpdate = true;
  world.add(trunkMesh);

  for (const [color, entries] of crownGroups) {
    const materialColor = new THREE.Color(COLORS.foliage).lerp(new THREE.Color(color), 0.18);
    const crownMesh = new THREE.InstancedMesh(
      new THREE.ConeGeometry(1, 1, 8),
      new THREE.MeshStandardMaterial({
        color: materialColor,
        roughness: 0.94,
        metalness: 0
      }),
      entries.length
    );
    crownMesh.name = `Midnight City trackside park crowns r7 ${color.toString(16)}`;
    for (let index = 0; index < entries.length; index += 1) {
      const tree = entries[index];
      marker.position.set(tree.x, TRACK_Y + tree.height * 0.76, tree.z);
      marker.scale.set(2.3 + tree.height * 0.2, tree.height * 0.82, 2.3 + tree.height * 0.2);
      marker.rotation.set(0, pseudo(index + color) * Math.PI, 0);
      marker.updateMatrix();
      crownMesh.setMatrixAt(index, marker.matrix);
    }
    crownMesh.instanceMatrix.needsUpdate = true;
    world.add(crownMesh);
  }
}

function disposeAndRemove(node) {
  node.parent?.remove(node);
  node.geometry?.dispose?.();
  const materials = Array.isArray(node.material) ? node.material : [node.material];
  for (const material of materials) material?.dispose?.();
}

function pseudo(seed) {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}
