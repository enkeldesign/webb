import * as THREE from 'three';
import { installMidnightCityWorld as installMidnightCityWorldR5 } from './midnight-city-world-r5.js?base=20260801-r5';

const TRACK_Y = 0.16;
const SHOWCASE_CENTER = Object.freeze({ x: 80, z: 75 });
const SHOWCASE_FOUNTAIN = Object.freeze({ x: 20, z: -27 });
const SHOWCASE_ASSET_SCALE = 1.42;

const COLORS = Object.freeze({
  ink: 0x070a14,
  lawn: 0x102a22,
  lawnAccent: 0x16382d,
  path: 0x343d49,
  pathLight: 0x596677,
  water: 0x143f58,
  waterGlow: 0x79eeff,
  cyan: 0x5de4ff,
  paleCyan: 0xb8f7ff,
  warmWhite: 0xfff4cf,
  trunk: 0x4b3024,
  foliage: 0x174f40,
  violet: 0x9d7cff,
  yellow: 0xffdc68,
  bench: 0x6a432d
});

const OTHER_PARKS = Object.freeze([
  Object.freeze({ x: -418, z: -286, radius: 42, color: COLORS.violet }),
  Object.freeze({ x: 405, z: 292, radius: 44, color: COLORS.yellow })
]);

export function installMidnightCityWorld(options) {
  const world = installMidnightCityWorldR5(options);

  const hiddenOriginal = hideOriginalCommons(world);
  const removedLegacyTrees = removeLegacyParkTrees(world);
  const showcase = installTracksideCommons(world);
  const treeCount = installReframedParkTrees(world);
  const assetRedirectInstalled = redirectAsyncFountainAsset(world, showcase);

  world.name = 'TURN Midnight City r6';
  world.userData.turnMidnightCityArtDirection = Object.freeze({
    ...(world.userData.turnMidnightCityArtDirection || {}),
    version: 'r6',
    originalCommonsHidden: hiddenOriginal,
    originalParkTreeMeshesRemoved: removedLegacyTrees,
    showcasePark: 'TURN COMMONS moved to the central trackside block and framed as an approach landmark',
    showcaseParkCenter: Object.freeze({ ...SHOWCASE_CENTER }),
    showcaseFountainPosition: Object.freeze({
      x: SHOWCASE_CENTER.x + SHOWCASE_FOUNTAIN.x,
      z: SHOWCASE_CENTER.z + SHOWCASE_FOUNTAIN.z
    }),
    showcaseComposition: 'road-facing fountain plaza, axial promenade, reflecting pond, bridge, paths, benches and framed trees',
    showcaseTreeCount: treeCount,
    kenneyFountainRedirectedToShowcase: assetRedirectInstalled,
    noDynamicLightsAdded: true,
    noIndependentAnimationLoop: true
  });

  return world;
}

function hideOriginalCommons(world) {
  const original = world.getObjectByName('Midnight City park TURN COMMONS');
  if (!original) return false;
  original.visible = false;
  original.name = 'Midnight City retired park TURN COMMONS';
  return true;
}

function removeLegacyParkTrees(world) {
  const removals = [];
  world.traverse((node) => {
    if (
      node.name === 'Midnight City park tree trunks' ||
      node.name?.startsWith('Midnight City park crowns ')
    ) {
      removals.push(node);
    }
  });

  for (const node of removals) {
    node.parent?.remove(node);
    node.geometry?.dispose?.();
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) material?.dispose?.();
  }
  return removals.length;
}

function installTracksideCommons(world) {
  const group = new THREE.Group();
  group.name = 'Midnight City showcase park TURN COMMONS';
  group.position.set(SHOWCASE_CENTER.x, 0, SHOWCASE_CENTER.z);

  addParkGround(group);
  addParkPaths(group);
  addReflectingWater(group);
  const fallback = addShowcaseFountain(group);
  addParkFurniture(group);
  addParkLanterns(group);
  addParkTitle(group);

  world.add(group);

  return {
    group,
    fallback,
    fountainAnchor: new THREE.Vector3(
      SHOWCASE_CENTER.x + SHOWCASE_FOUNTAIN.x,
      TRACK_Y,
      SHOWCASE_CENTER.z + SHOWCASE_FOUNTAIN.z
    ),
    plaqueAnchor: new THREE.Vector3(
      SHOWCASE_CENTER.x + 20,
      TRACK_Y + 8.2,
      SHOWCASE_CENTER.z - 47
    )
  };
}

function addParkGround(group) {
  const lawn = new THREE.Mesh(
    makeRoundedRectGeometry(108, 92, 16),
    new THREE.MeshStandardMaterial({
      color: COLORS.lawn,
      roughness: 0.96,
      metalness: 0
    })
  );
  lawn.rotation.x = -Math.PI / 2;
  lawn.position.y = TRACK_Y + 0.018;
  lawn.receiveShadow = true;
  lawn.name = 'TURN Commons lawn';
  group.add(lawn);

  const innerLawn = new THREE.Mesh(
    makeRoundedRectGeometry(88, 72, 13),
    new THREE.MeshBasicMaterial({
      color: COLORS.lawnAccent,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
      toneMapped: false
    })
  );
  innerLawn.rotation.x = -Math.PI / 2;
  innerLawn.position.y = TRACK_Y + 0.038;
  innerLawn.name = 'TURN Commons inner lawn';
  group.add(innerLawn);

  const neonEdge = new THREE.Mesh(
    makeRoundedRectRingGeometry(108, 92, 16, 1.15),
    new THREE.MeshBasicMaterial({
      color: COLORS.cyan,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      toneMapped: false
    })
  );
  neonEdge.rotation.x = -Math.PI / 2;
  neonEdge.position.y = TRACK_Y + 0.07;
  neonEdge.name = 'TURN Commons neon perimeter';
  group.add(neonEdge);
}

function addParkPaths(group) {
  const pathMaterial = new THREE.MeshBasicMaterial({
    color: COLORS.path,
    side: THREE.DoubleSide,
    toneMapped: false
  });
  const trimMaterial = new THREE.MeshBasicMaterial({
    color: COLORS.pathLight,
    transparent: true,
    opacity: 0.72,
    side: THREE.DoubleSide,
    toneMapped: false
  });

  const promenade = new THREE.Mesh(new THREE.PlaneGeometry(15, 42), pathMaterial);
  promenade.rotation.x = -Math.PI / 2;
  promenade.position.set(20, TRACK_Y + 0.06, -25);
  promenade.name = 'TURN Commons road-facing promenade';
  group.add(promenade);

  for (const x of [12.15, 27.85]) {
    const trim = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 42), trimMaterial);
    trim.rotation.x = -Math.PI / 2;
    trim.position.set(x, TRACK_Y + 0.075, -25);
    group.add(trim);
  }

  const crossPath = new THREE.Mesh(new THREE.PlaneGeometry(82, 8.5), pathMaterial);
  crossPath.rotation.x = -Math.PI / 2;
  crossPath.position.set(-5, TRACK_Y + 0.058, 5);
  group.add(crossPath);

  const pondWalk = new THREE.Mesh(
    new THREE.RingGeometry(24.5, 30.5, 56),
    pathMaterial
  );
  pondWalk.scale.set(1.18, 0.68, 1);
  pondWalk.rotation.x = -Math.PI / 2;
  pondWalk.position.set(-13, TRACK_Y + 0.062, 14);
  pondWalk.name = 'TURN Commons pond walk';
  group.add(pondWalk);

  const fountainPlaza = new THREE.Mesh(
    new THREE.CircleGeometry(14.5, 40),
    pathMaterial
  );
  fountainPlaza.rotation.x = -Math.PI / 2;
  fountainPlaza.position.set(
    SHOWCASE_FOUNTAIN.x,
    TRACK_Y + 0.064,
    SHOWCASE_FOUNTAIN.z
  );
  fountainPlaza.name = 'TURN Commons fountain plaza';
  group.add(fountainPlaza);

  const plazaRing = new THREE.Mesh(
    new THREE.RingGeometry(13.3, 14.3, 40),
    new THREE.MeshBasicMaterial({
      color: COLORS.paleCyan,
      transparent: true,
      opacity: 0.84,
      side: THREE.DoubleSide,
      toneMapped: false
    })
  );
  plazaRing.rotation.x = -Math.PI / 2;
  plazaRing.position.copy(fountainPlaza.position);
  plazaRing.position.y += 0.02;
  group.add(plazaRing);
}

function addReflectingWater(group) {
  const pond = new THREE.Mesh(
    new THREE.CircleGeometry(22, 56),
    new THREE.MeshBasicMaterial({
      color: COLORS.water,
      transparent: true,
      opacity: 0.96,
      side: THREE.DoubleSide,
      toneMapped: false
    })
  );
  pond.scale.set(1.25, 0.72, 1);
  pond.rotation.x = -Math.PI / 2;
  pond.position.set(-13, TRACK_Y + 0.082, 14);
  pond.name = 'TURN Commons reflecting pond';
  group.add(pond);

  const waterRim = new THREE.Mesh(
    new THREE.RingGeometry(21.2, 22.4, 56),
    new THREE.MeshBasicMaterial({
      color: COLORS.waterGlow,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      toneMapped: false
    })
  );
  waterRim.scale.copy(pond.scale);
  waterRim.rotation.copy(pond.rotation);
  waterRim.position.copy(pond.position);
  waterRim.position.y += 0.018;
  group.add(waterRim);

  const bridge = new THREE.Group();
  bridge.name = 'TURN Commons illuminated footbridge';
  bridge.position.set(-13, TRACK_Y + 0.32, 14);
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(4.8, 0.45, 34),
    new THREE.MeshStandardMaterial({
      color: 0x66717f,
      roughness: 0.74,
      metalness: 0.12
    })
  );
  bridge.add(deck);
  for (const x of [-2.65, 2.65]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.28, 34),
      new THREE.MeshBasicMaterial({ color: COLORS.cyan, toneMapped: false })
    );
    rail.position.set(x, 1.15, 0);
    bridge.add(rail);
  }
  group.add(bridge);
}

function addShowcaseFountain(group) {
  const baseMaterial = new THREE.MeshStandardMaterial({
    color: 0x9aa6b8,
    roughness: 0.5,
    metalness: 0.2
  });
  const waterMaterial = new THREE.MeshBasicMaterial({
    color: COLORS.waterGlow,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
    toneMapped: false
  });

  const fountain = new THREE.Group();
  fountain.name = 'Midnight City showcase fountain fallback';
  fountain.position.set(SHOWCASE_FOUNTAIN.x, TRACK_Y, SHOWCASE_FOUNTAIN.z);

  const basin = new THREE.Mesh(new THREE.CylinderGeometry(10.4, 11.2, 1.35, 48), baseMaterial);
  basin.position.y = 0.68;
  fountain.add(basin);

  const basinWater = new THREE.Mesh(new THREE.CylinderGeometry(9.6, 9.6, 0.2, 48), waterMaterial);
  basinWater.position.y = 1.43;
  fountain.add(basinWater);

  const centre = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 2.1, 5.8, 24), baseMaterial);
  centre.position.y = 4.2;
  fountain.add(centre);

  const mainJet = new THREE.Mesh(new THREE.ConeGeometry(2.1, 14.5, 24, 1, true), waterMaterial);
  mainJet.position.y = 10.1;
  fountain.add(mainJet);

  for (let index = 0; index < 6; index += 1) {
    const angle = (index / 6) * Math.PI * 2;
    const jet = new THREE.Mesh(new THREE.ConeGeometry(0.72, 7.2, 14, 1, true), waterMaterial);
    jet.position.set(Math.cos(angle) * 5.6, 5.0, Math.sin(angle) * 5.6);
    jet.rotation.z = Math.cos(angle) * 0.18;
    jet.rotation.x = Math.sin(angle) * 0.18;
    fountain.add(jet);
  }

  const glow = new THREE.Mesh(
    new THREE.RingGeometry(9.7, 10.7, 48),
    new THREE.MeshBasicMaterial({
      color: COLORS.cyan,
      transparent: true,
      opacity: 0.96,
      side: THREE.DoubleSide,
      toneMapped: false
    })
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 1.53;
  fountain.add(glow);

  group.add(fountain);
  return fountain;
}

function addParkFurniture(group) {
  const material = new THREE.MeshStandardMaterial({
    color: COLORS.bench,
    roughness: 0.88,
    metalness: 0.04
  });
  const placements = [
    [-39, -4, Math.PI / 2],
    [-38, 28, Math.PI / 2],
    [25, 22, -Math.PI / 2],
    [36, 8, -Math.PI / 2],
    [-4, 39, Math.PI]
  ];

  for (const [x, z, rotation] of placements) {
    const bench = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.45, 1.65), material);
    seat.position.y = 1.05;
    bench.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(5.8, 2, 0.35), material);
    back.position.set(0, 1.9, -0.64);
    back.rotation.x = -0.1;
    bench.add(back);
    for (const legX of [-2.25, 2.25]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.34, 1.1, 0.34), material);
      leg.position.set(legX, 0.55, 0);
      bench.add(leg);
    }
    bench.position.set(x, TRACK_Y, z);
    bench.rotation.y = rotation;
    group.add(bench);
  }
}

function addParkLanterns(group) {
  const postMaterial = new THREE.MeshStandardMaterial({
    color: 0x151a22,
    roughness: 0.78,
    metalness: 0.18
  });
  const lampMaterial = new THREE.MeshBasicMaterial({
    color: COLORS.warmWhite,
    toneMapped: false
  });
  const positions = [
    [-30, -31], [-8, -31], [42, -31],
    [-42, 10], [39, 10],
    [-31, 36], [8, 39], [36, 34]
  ];

  for (const [x, z] of positions) {
    const lantern = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 4.6, 7), postMaterial);
    post.position.y = 2.3;
    lantern.add(post);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.62, 0.9), lampMaterial);
    lamp.position.y = 4.75;
    lantern.add(lamp);
    lantern.position.set(x, TRACK_Y, z);
    group.add(lantern);
  }
}

function addParkTitle(group) {
  const sign = makeParkSign('TURN COMMONS', COLORS.cyan);
  sign.position.set(20, TRACK_Y + 7.6, -45);
  sign.rotation.y = 0;
  group.add(sign);
}

function makeParkSign(label, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 192;
  const context = canvas.getContext('2d');
  const cssColor = `#${color.toString(16).padStart(6, '0')}`;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = 'rgba(3, 5, 12, 0.92)';
  context.fillRect(8, 8, canvas.width - 16, canvas.height - 16);
  context.shadowColor = cssColor;
  context.shadowBlur = 20;
  context.strokeStyle = cssColor;
  context.lineWidth = 12;
  context.strokeRect(14, 14, canvas.width - 28, canvas.height - 28);
  context.shadowBlur = 12;
  context.fillStyle = cssColor;
  context.font = '900 78px system-ui, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(label, canvas.width / 2, canvas.height / 2 + 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(31, 7.75),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false
    })
  );
  sign.name = 'Midnight City showcase park title TURN COMMONS';
  return sign;
}

function installReframedParkTrees(world) {
  const trees = [];

  for (let index = 0; index < 23; index += 1) {
    const angle = (index / 23) * Math.PI * 2;
    const southEastView = angle > Math.PI * 1.52 || angle < Math.PI * 0.12;
    if (southEastView && index % 2 === 0) continue;
    const radiusX = 47 + pseudo(index * 11) * 3;
    const radiusZ = 38 + pseudo(index * 17) * 4;
    trees.push({
      x: SHOWCASE_CENTER.x + Math.cos(angle) * radiusX,
      z: SHOWCASE_CENTER.z + Math.sin(angle) * radiusZ,
      height: 7 + pseudo(index * 29) * 4,
      color: COLORS.cyan
    });
  }

  for (const [parkIndex, park] of OTHER_PARKS.entries()) {
    for (let index = 0; index < 15; index += 1) {
      const angle = (index / 15) * Math.PI * 2 + parkIndex * 0.2;
      const radius = park.radius * (0.74 + pseudo(index * 13 + park.x) * 0.14);
      trees.push({
        x: park.x + Math.cos(angle) * radius,
        z: park.z + Math.sin(angle) * radius,
        height: 5.4 + pseudo(index * 31 + park.z) * 3.5,
        color: park.color
      });
    }
  }

  const trunkMesh = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.34, 0.52, 1, 7),
    new THREE.MeshStandardMaterial({ color: COLORS.trunk, roughness: 1 }),
    trees.length
  );
  trunkMesh.name = 'Midnight City reframed park tree trunks';

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
    const base = new THREE.Color(COLORS.foliage);
    const accent = new THREE.Color(color);
    const materialColor = base.lerp(accent, 0.18);
    const crownMesh = new THREE.InstancedMesh(
      new THREE.ConeGeometry(1, 1, 8),
      new THREE.MeshStandardMaterial({
        color: materialColor,
        roughness: 0.94,
        metalness: 0
      }),
      entries.length
    );
    crownMesh.name = `Midnight City reframed park crowns ${color.toString(16)}`;
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

  return trees.length;
}

function redirectAsyncFountainAsset(world, showcase) {
  if (world.userData.turnCommonsFountainRedirectInstalled) return false;

  const originalAdd = world.add;
  world.add = function addWithFountainRedirect(...objects) {
    for (const object of objects) {
      if (object.name === 'Midnight City Kenney fountain landmark') {
        object.position.copy(showcase.fountainAnchor);
        object.position.y += 0.4;
        object.scale.multiplyScalar(SHOWCASE_ASSET_SCALE);
        object.rotation.y = -Math.PI / 8;
        showcase.fallback.visible = false;
      }
      if (object.name === 'Midnight City neon sign TURN COMMONS') {
        object.visible = false;
      }
    }
    return originalAdd.apply(this, objects);
  };

  world.userData.turnCommonsFountainRedirectInstalled = true;
  return true;
}

function makeRoundedRectGeometry(width, height, radius) {
  const shape = roundedRectShape(width, height, radius);
  return new THREE.ShapeGeometry(shape, 24);
}

function makeRoundedRectRingGeometry(width, height, radius, thickness) {
  const outer = roundedRectShape(width, height, radius);
  const hole = roundedRectShape(
    width - thickness * 2,
    height - thickness * 2,
    Math.max(1, radius - thickness)
  );
  outer.holes.push(hole);
  return new THREE.ShapeGeometry(outer, 24);
}

function roundedRectShape(width, height, radius) {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const r = Math.min(radius, halfWidth, halfHeight);
  const shape = new THREE.Shape();
  shape.moveTo(-halfWidth + r, -halfHeight);
  shape.lineTo(halfWidth - r, -halfHeight);
  shape.quadraticCurveTo(halfWidth, -halfHeight, halfWidth, -halfHeight + r);
  shape.lineTo(halfWidth, halfHeight - r);
  shape.quadraticCurveTo(halfWidth, halfHeight, halfWidth - r, halfHeight);
  shape.lineTo(-halfWidth + r, halfHeight);
  shape.quadraticCurveTo(-halfWidth, halfHeight, -halfWidth, halfHeight - r);
  shape.lineTo(-halfWidth, -halfHeight + r);
  shape.quadraticCurveTo(-halfWidth, -halfHeight, -halfWidth + r, -halfHeight);
  return shape;
}

function pseudo(seed) {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}
