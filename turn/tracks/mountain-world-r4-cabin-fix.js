import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MOUNTAIN_R3, material, safeTracksidePosition } from './mountain-world-r3-terrain.js';

const { GRANITE_DARK, HOLIDAY_ROOT } = MOUNTAIN_R3;

function prepareAsset(root) {
  root.traverse((node) => {
    if (!node?.isMesh) return;
    node.castShadow = true;
    node.receiveShadow = true;
    node.userData.turnOutlined = true;
  });
  return root;
}

function nativeGroundedClone(template) {
  const clone = prepareAsset(template.clone(true));
  clone.position.set(0, 0, 0);
  clone.rotation.set(0, 0, 0);
  clone.scale.set(1, 1, 1);
  clone.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3().setFromObject(clone, true);
  if (!bounds.isEmpty()) clone.position.y = -bounds.min.y;
  return clone;
}

function centeredGroundedClone(template) {
  const clone = nativeGroundedClone(template);
  clone.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3().setFromObject(clone, true);
  if (!bounds.isEmpty()) {
    const center = bounds.getCenter(new THREE.Vector3());
    clone.position.x -= center.x;
    clone.position.z -= center.z;
  }
  return clone;
}

function removeOldCabins(world) {
  const removals = [];
  world.traverse((object) => {
    if (object !== world && object.name?.includes('Mountain Kenney Holiday cabin prefab r3 assembled r4')) {
      removals.push(object);
    }
  });
  for (const object of removals) object.parent?.remove(object);
  return removals.length;
}

function addPanel(cabin, template, yaw, name) {
  const panel = nativeGroundedClone(template);
  panel.rotation.y = yaw;
  panel.name = name;
  cabin.add(panel);
  return panel;
}

function makeGable(z, color = 0x8a5c3f) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -0.51, 1.0, z,
     0.51, 1.0, z,
     0.00, 2.02, z
  ], 3));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material(color, 1, 0, { side: THREE.DoubleSide }));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.turnOutlined = true;
  mesh.name = 'Mountain closed Holiday cabin gable native-pivot r4';
  return mesh;
}

function makeNativePivotCabin(templates, variant = 0) {
  const cabin = new THREE.Group();

  // Kenney's wall panels already carry their half-cell outward offset in the
  // model origin. Rotating four panels around one origin closes a 1 x 1 hut;
  // translating those panels outward again creates the loose-log effect seen
  // in the earlier build.
  addPanel(cabin, templates.doorway, 0, 'Mountain Holiday native front doorway r4');
  addPanel(cabin, templates.wall, Math.PI, 'Mountain Holiday native back wall r4');
  addPanel(cabin, variant ? templates.window : templates.wall, -Math.PI / 2, 'Mountain Holiday native left wall r4');
  addPanel(cabin, templates.window, Math.PI / 2, 'Mountain Holiday native right window r4');

  // This repo already carries a small preprocessed Holiday roof specifically
  // for safe TURN use. Center that single asset over the native-pivot wall
  // square instead of trying to reconstruct a roof from the sloped half.
  const roof = centeredGroundedClone(templates.roof);
  roof.position.y = 0.98;
  roof.name = 'Mountain Holiday centered safe snow roof r4';
  cabin.add(roof);

  cabin.add(makeGable(0.51), makeGable(-0.51));

  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(1.18, 0.12, 1.18),
    material(GRANITE_DARK, 1)
  );
  plinth.position.y = 0.02;
  plinth.name = 'Mountain Holiday compact stone plinth r4';
  cabin.add(plinth);

  cabin.userData.turnKenneyNativePivotAssembly = Object.freeze({
    footprint: '1x1',
    panelOriginsPreserved: true,
    outwardTranslations: 0,
    roofPieces: 1,
    roofAsset: 'cabin-roof-safe.glb',
    roofCentered: true,
    gablesClosed: true,
    revision: 'r4-native-pivot-safe-roof'
  });
  return cabin;
}

function groundCabin(world, cabin, { x, z, yaw, scale, terrainHeightAt, name }) {
  cabin.position.set(x, 0, z);
  cabin.rotation.y = yaw;
  cabin.scale.setScalar(scale);
  cabin.updateWorldMatrix(true, true);
  const before = new THREE.Box3().setFromObject(cabin, true);
  if (before.isEmpty()) return null;
  const groundY = terrainHeightAt(x, z);
  cabin.position.y += groundY - before.min.y - 0.08;
  cabin.updateWorldMatrix(true, true);
  const after = new THREE.Box3().setFromObject(cabin, true);
  cabin.name = name;
  world.add(cabin);

  if (Array.isArray(world.userData.turnMountainGroundingDiagnostics)) {
    world.userData.turnMountainGroundingDiagnostics.push(Object.freeze({
      name,
      groundY,
      minY: after.min.y,
      maxY: after.max.y,
      delta: after.min.y - groundY,
      height: after.max.y - after.min.y
    }));
  }
  return cabin;
}

function trackYaw(sample, faceRoad) {
  return Math.atan2(sample.tangent.x, sample.tangent.z) + (faceRoad ? Math.PI : 0);
}

async function loadTemplates() {
  const loader = new GLTFLoader();
  const [wall, doorway, windowLarge, roof] = await Promise.all([
    loader.loadAsync(`${HOLIDAY_ROOT}/cabin-wall.glb`),
    loader.loadAsync(`${HOLIDAY_ROOT}/cabin-doorway.glb`),
    loader.loadAsync(`${HOLIDAY_ROOT}/cabin-window-large.glb`),
    loader.loadAsync(`${HOLIDAY_ROOT}/cabin-roof-safe.glb`)
  ]);
  return {
    wall: prepareAsset(wall.scene),
    doorway: prepareAsset(doorway.scene),
    window: prepareAsset(windowLarge.scene),
    roof: prepareAsset(roof.scene)
  };
}

export async function installMountainR4CabinFix(world, samples, trackWidth, terrainContext) {
  if (!world || !Array.isArray(samples) || !terrainContext?.terrainHeightAt) return world;
  const templates = await loadTemplates();
  const removed = removeOldCabins(world);
  const { terrainHeightAt } = terrainContext;
  const sites = [
    [4, 1, 8.8, 0],
    [18, 1, 8.3, 1],
    [34, -1, 8.0, 0],
    [52, 1, 8.9, 1],
    [70, -1, 7.8, 0],
    [1008, 1, 8.1, 1],
    [1025, -1, 8.7, 0],
    [1042, -1, 8.0, 1],
    [1058, 1, 8.9, 0],
    [1073, -1, 8.3, 1]
  ];

  let placed = 0;
  for (let cursor = 0; cursor < sites.length; cursor += 1) {
    const [index, side, scale, variant] = sites[cursor];
    const point = safeTracksidePosition(samples, index, side, trackWidth, 5.4, 26, 53, 2.8);
    if (!point) continue;
    const sample = samples[index % samples.length];
    const cabin = groundCabin(world, makeNativePivotCabin(templates, variant), {
      x: point.x,
      z: point.z,
      yaw: trackYaw(sample, side > 0) + (cursor % 2 ? 0.10 : -0.08),
      scale,
      terrainHeightAt,
      name: `Mountain Kenney Holiday cabin prefab r3 assembled r4 corrected ${cursor + 1}`
    });
    if (cabin) placed += 1;
  }

  world.userData.turnMountainR4CabinFix = Object.freeze({
    removed,
    placed,
    nativePanelOrigins: true,
    outwardPanelTranslations: 0,
    roofAsset: 'cabin-roof-safe.glb',
    footprint: '1x1'
  });
  return world;
}
