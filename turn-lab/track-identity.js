import * as THREE from 'three';

const INK = 0x08090a;
const ZONES = [
  { name: 'Blossom', edge: 0xff8fbd, tint: 0xf08fb5, dark: 0xb84f7b, kind: 'blossom' },
  { name: 'Forest', edge: 0x38a169, tint: 0x276749, dark: 0x173f2e, kind: 'forest' },
  { name: 'Sunset', edge: 0xf6ad55, tint: 0xe67e22, dark: 0xa94f18, kind: 'sunset' },
  { name: 'Crystal', edge: 0x5c7cfa, tint: 0x6f62c7, dark: 0x3f3a86, kind: 'crystal' }
];

function materialList(material) {
  return Array.isArray(material) ? material : [material];
}

function isInk(material) {
  return materialList(material).some((entry) => entry?.color?.getHex?.() === INK);
}

function outlineMesh(mesh, scale = 1.024) {
  const outline = new THREE.Mesh(
    mesh.geometry,
    new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide })
  );
  outline.scale.setScalar(scale);
  outline.userData.turnOutline = true;
  outline.castShadow = false;
  outline.receiveShadow = false;
  mesh.add(outline);
  return mesh;
}

function makeRibbon(pointsOuter, pointsInner, material, y = 0.164) {
  const positions = [];
  const indices = [];
  const count = Math.min(pointsOuter.length, pointsInner.length);

  for (let i = 0; i < count; i += 1) {
    positions.push(
      pointsOuter[i].x, y, pointsOuter[i].z,
      pointsInner[i].x, y, pointsInner[i].z
    );
  }

  for (let i = 0; i < count - 1; i += 1) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, c, b, b, c, d);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  mesh.userData.turnZoneStyled = true;
  return mesh;
}

function hideOldRoadContour(world) {
  world.traverse((node) => {
    if (!node.isMesh || !node.userData.turnNoAutoOutline || !isInk(node.material)) return;
    if (!node.geometry?.attributes?.position) return;
    if (!node.geometry.boundingBox) node.geometry.computeBoundingBox();
    const size = node.geometry.boundingBox.getSize(new THREE.Vector3());
    const centerY = (node.geometry.boundingBox.min.y + node.geometry.boundingBox.max.y) * 0.5;
    if (Math.max(size.x, size.z) > 300 && centerY > 0.12 && centerY < 0.2) {
      node.visible = false;
    }
  });
}

function addSectionEdges(world, samples, trackWidth) {
  hideOldRoadContour(world);
  const sections = ZONES.length;
  const sectionLength = Math.floor(samples.length / sections);

  for (const side of [-1, 1]) {
    const fullOuter = [];
    const fullInner = [];
    for (let i = 0; i <= samples.length; i += 1) {
      const sample = samples[i % samples.length];
      fullInner.push(sample.point.clone().addScaledVector(sample.normal, side * (trackWidth / 2 + 1.72)));
      fullOuter.push(sample.point.clone().addScaledVector(sample.normal, side * (trackWidth / 2 + 2.25)));
    }
    world.add(makeRibbon(
      fullOuter,
      fullInner,
      new THREE.MeshBasicMaterial({ color: INK, side: THREE.DoubleSide }),
      0.166
    ));

    for (let zoneIndex = 0; zoneIndex < sections; zoneIndex += 1) {
      const outer = [];
      const inner = [];
      const start = zoneIndex * sectionLength;
      const end = zoneIndex === sections - 1 ? samples.length : (zoneIndex + 1) * sectionLength;
      for (let i = start; i <= end; i += 1) {
        const sample = samples[i % samples.length];
        inner.push(sample.point.clone().addScaledVector(sample.normal, side * (trackWidth / 2 + 2.28)));
        outer.push(sample.point.clone().addScaledVector(sample.normal, side * (trackWidth / 2 + 3.18)));
      }
      world.add(makeRibbon(
        outer,
        inner,
        new THREE.MeshStandardMaterial({
          color: ZONES[zoneIndex].edge,
          roughness: 0.9,
          metalness: 0,
          side: THREE.DoubleSide
        }),
        0.168
      ));
    }
  }
}

function addTrunk(group, x, z, height = 7) {
  const trunk = outlineMesh(new THREE.Mesh(
    new THREE.CylinderGeometry(0.72, 0.92, height, 7),
    new THREE.MeshStandardMaterial({ color: 0x6f4b35, roughness: 1, flatShading: true })
  ));
  trunk.position.set(x, height / 2, z);
  trunk.castShadow = true;
  group.add(trunk);
}

function blossomLandmark(zone) {
  const group = new THREE.Group();
  const positions = [[-4, 0, 8.5], [3.5, 2, 7.2], [0, -4, 6.4]];
  positions.forEach(([x, z, height], index) => {
    addTrunk(group, x, z, height);
    for (let puff = 0; puff < 3; puff += 1) {
      const blossom = outlineMesh(new THREE.Mesh(
        new THREE.IcosahedronGeometry(2.6 + puff * 0.28, 1),
        new THREE.MeshStandardMaterial({
          color: puff === 1 ? 0xffd1e3 : zone.edge,
          roughness: 0.95,
          flatShading: true
        })
      ));
      blossom.position.set(x + (puff - 1) * 1.6, height - 0.3 + (puff % 2) * 1.2, z + (puff - 1) * 0.8);
      blossom.castShadow = true;
      group.add(blossom);
    }
  });
  return group;
}

function forestLandmark(zone) {
  const group = new THREE.Group();
  [-4.2, 0, 4.2].forEach((x, index) => {
    const height = 10 + index * 2.2;
    addTrunk(group, x, index % 2 ? 1.5 : -1.5, height * 0.45);
    for (let layer = 0; layer < 3; layer += 1) {
      const pine = outlineMesh(new THREE.Mesh(
        new THREE.ConeGeometry(3.8 - layer * 0.6, 5.4, 7),
        new THREE.MeshStandardMaterial({
          color: layer === 1 ? zone.tint : zone.dark,
          roughness: 1,
          flatShading: true
        })
      ));
      pine.position.set(x, 4.2 + layer * 2.6, index % 2 ? 1.5 : -1.5);
      pine.castShadow = true;
      group.add(pine);
    }
  });
  return group;
}

function sunsetLandmark(zone) {
  const group = new THREE.Group();
  const ring = outlineMesh(new THREE.Mesh(
    new THREE.TorusGeometry(5.4, 1.15, 8, 20),
    new THREE.MeshStandardMaterial({ color: 0xffd43b, roughness: 0.85, flatShading: true })
  ));
  ring.position.y = 8.4;
  ring.rotation.y = Math.PI / 2;
  group.add(ring);

  for (const side of [-1, 1]) {
    const pillar = outlineMesh(new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 9.2, 2.2),
      new THREE.MeshStandardMaterial({ color: side > 0 ? zone.edge : zone.tint, roughness: 0.95 })
    ));
    pillar.position.set(side * 5.4, 4.6, 0);
    pillar.rotation.z = side * -0.11;
    group.add(pillar);
  }
  return group;
}

function crystalLandmark(zone) {
  const group = new THREE.Group();
  const positions = [[-4, 0, 9], [0, 1, 13], [4.5, -1, 8], [1.5, -4, 6]];
  positions.forEach(([x, z, height], index) => {
    const crystal = outlineMesh(new THREE.Mesh(
      new THREE.OctahedronGeometry(2.4 + index * 0.25, 0),
      new THREE.MeshStandardMaterial({
        color: index % 2 ? zone.edge : zone.tint,
        roughness: 0.65,
        metalness: 0.08,
        flatShading: true
      })
    ));
    crystal.scale.y = height / 5;
    crystal.position.set(x, height * 0.45, z);
    crystal.rotation.y = index * 0.6;
    crystal.castShadow = true;
    group.add(crystal);
  });
  return group;
}

function makeLandmark(zone) {
  if (zone.kind === 'blossom') return blossomLandmark(zone);
  if (zone.kind === 'forest') return forestLandmark(zone);
  if (zone.kind === 'sunset') return sunsetLandmark(zone);
  return crystalLandmark(zone);
}

function addTurnLandmarks(world, samples, trackWidth) {
  const center = samples.reduce((sum, sample) => sum.add(sample.point), new THREE.Vector3())
    .multiplyScalar(1 / samples.length);
  const indices = [55, 140, 225, 310, 395, 480, 565, 650];

  indices.forEach((index, landmarkIndex) => {
    const sample = samples[index % samples.length];
    const zoneIndex = Math.floor((index / samples.length) * ZONES.length) % ZONES.length;
    const zone = ZONES[zoneIndex];
    const outward = sample.point.clone().sub(center).setY(0);
    const side = outward.dot(sample.normal) >= 0 ? 1 : -1;
    const group = makeLandmark(zone);
    group.userData.turnZoneStyled = true;
    group.position.copy(sample.point).addScaledVector(sample.normal, side * (trackWidth / 2 + 18));
    group.rotation.y = Math.atan2(sample.tangent.x, sample.tangent.z) + (side < 0 ? Math.PI : 0);
    group.scale.setScalar(landmarkIndex % 2 ? 0.88 : 1);
    world.add(group);

    for (const gateSide of [-1, 1]) {
      const post = outlineMesh(new THREE.Mesh(
        new THREE.BoxGeometry(1.15, 5.8, 1.15),
        new THREE.MeshStandardMaterial({ color: zone.edge, roughness: 0.92 })
      ));
      post.position.copy(sample.point).addScaledVector(sample.normal, gateSide * (trackWidth / 2 + 4.4));
      post.position.y = 2.9;
      post.rotation.y = Math.atan2(sample.tangent.x, sample.tangent.z);
      post.userData.turnZoneStyled = true;
      world.add(post);
    }
  });
}

function nearestSampleIndex(samples, position) {
  let bestIndex = 0;
  let bestDistanceSq = Infinity;
  for (let i = 0; i < samples.length; i += 1) {
    const dx = position.x - samples[i].point.x;
    const dz = position.z - samples[i].point.z;
    const distanceSq = dx * dx + dz * dz;
    if (distanceSq < bestDistanceSq) {
      bestDistanceSq = distanceSq;
      bestIndex = i;
    }
  }
  return { index: bestIndex, distance: Math.sqrt(bestDistanceSq) };
}

function tintTracksideAssets(world, samples, trackWidth) {
  const position = new THREE.Vector3();
  world.updateMatrixWorld(true);

  world.traverse((node) => {
    if (!node.isMesh || node.userData.turnOutline || node.userData.turnZoneStyled || node.userData.turnZoneTinted) return;
    if (!node.material || isInk(node.material)) return;
    node.getWorldPosition(position);
    const nearest = nearestSampleIndex(samples, position);
    if (nearest.distance < trackWidth / 2 + 5 || nearest.distance > 105) return;

    const zoneIndex = Math.floor((nearest.index / samples.length) * ZONES.length) % ZONES.length;
    const zone = ZONES[zoneIndex];
    const materials = materialList(node.material).map((material) => {
      const clone = material.clone();
      clone.color?.lerp(new THREE.Color(zone.tint), 0.3);
      return clone;
    });
    node.material = Array.isArray(node.material) ? materials : materials[0];
    node.userData.turnZoneTinted = true;
  });
}

function thinContours(world) {
  world.traverse((node) => {
    if (!node.isMesh) return;
    if (node.userData.turnOutline || node.name === 'TURN outline') {
      node.scale.setScalar(1.024);
      return;
    }
    if (node.parent?.isMesh && isInk(node.material) && materialList(node.material).some((material) => material?.side === THREE.BackSide)) {
      node.scale.setScalar(1.024);
    }
  });
}

export function installTrackIdentity({ world, samples, trackWidth }) {
  addSectionEdges(world, samples, trackWidth);
  addTurnLandmarks(world, samples, trackWidth);
  thinContours(world);

  for (const delay of [500, 1300, 2600, 4200]) {
    window.setTimeout(() => {
      tintTracksideAssets(world, samples, trackWidth);
      thinContours(world);
    }, delay);
  }

  console.info('TURN: themed track identity loaded.');
}
