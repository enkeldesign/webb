import * as THREE from 'three';

const INK = 0x08090a;
const ZONES = [
  { edge: 0xff69a8, tint: 0xf45fa2 },
  { edge: 0x22a35a, tint: 0x176b3d },
  { edge: 0xff922b, tint: 0xe76f1f },
  { edge: 0x6574ff, tint: 0x6651cf }
];

function materialList(material) {
  return Array.isArray(material) ? material : [material];
}

function makeRibbon(outer, inner, material, y) {
  const positions = [];
  const indices = [];
  const count = Math.min(outer.length, inner.length);

  for (let i = 0; i < count; i += 1) {
    positions.push(
      outer[i].x, y, outer[i].z,
      inner[i].x, y, inner[i].z
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
  mesh.userData.turnSectionIntensity = true;
  mesh.receiveShadow = true;
  return mesh;
}

function addZoneVerges(world, samples, trackWidth) {
  const sectionLength = Math.floor(samples.length / ZONES.length);

  for (let zoneIndex = 0; zoneIndex < ZONES.length; zoneIndex += 1) {
    const start = zoneIndex * sectionLength;
    const end = zoneIndex === ZONES.length - 1 ? samples.length : (zoneIndex + 1) * sectionLength;

    for (const side of [-1, 1]) {
      const inner = [];
      const outer = [];
      for (let i = start; i <= end; i += 1) {
        const sample = samples[i % samples.length];
        inner.push(sample.point.clone().addScaledVector(sample.normal, side * (trackWidth / 2 + 3.35)));
        outer.push(sample.point.clone().addScaledVector(sample.normal, side * (trackWidth / 2 + 12.5)));
      }

      world.add(makeRibbon(
        outer,
        inner,
        new THREE.MeshStandardMaterial({
          color: ZONES[zoneIndex].edge,
          transparent: true,
          opacity: 0.28,
          roughness: 1,
          metalness: 0,
          depthWrite: false,
          side: THREE.DoubleSide
        }),
        0.092
      ));
    }
  }
}

function outlinedMarker(color) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.25, 3.7, 1.25),
    new THREE.MeshStandardMaterial({ color, roughness: 0.9 })
  );
  const outline = new THREE.Mesh(
    body.geometry,
    new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide })
  );
  outline.scale.setScalar(1.018);
  outline.userData.turnOutline = true;
  body.add(outline);
  body.position.y = 1.85;
  group.add(body);

  const cap = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.62, 2.2),
    new THREE.MeshStandardMaterial({ color, roughness: 0.88 })
  );
  const capOutline = new THREE.Mesh(
    cap.geometry,
    new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide })
  );
  capOutline.scale.setScalar(1.018);
  capOutline.userData.turnOutline = true;
  cap.add(capOutline);
  cap.position.y = 3.7;
  group.add(cap);
  group.userData.turnSectionIntensity = true;
  return group;
}

function addRepeaterMarkers(world, samples, trackWidth) {
  const step = 52;
  for (let index = 26; index < samples.length; index += step) {
    const sample = samples[index];
    const zoneIndex = Math.floor((index / samples.length) * ZONES.length) % ZONES.length;
    const side = Math.floor(index / step) % 2 ? 1 : -1;
    const marker = outlinedMarker(ZONES[zoneIndex].edge);
    marker.position.copy(sample.point).addScaledVector(sample.normal, side * (trackWidth / 2 + 8.5));
    marker.rotation.y = Math.atan2(sample.tangent.x, sample.tangent.z);
    world.add(marker);
  }
}

function nearestSample(samples, position) {
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

function punchSceneryColors(world, samples, trackWidth) {
  const position = new THREE.Vector3();
  world.updateMatrixWorld(true);

  world.traverse((node) => {
    if (!node.isMesh || node.userData.turnOutline || node.userData.turnSectionIntensity) return;
    if (node.userData.turnSectionPunch) return;
    if (!node.material) return;

    const materials = materialList(node.material);
    if (materials.some((material) => material?.color?.getHex?.() === INK)) return;

    if (node.geometry?.attributes?.position) {
      if (!node.geometry.boundingBox) node.geometry.computeBoundingBox();
      const size = node.geometry.boundingBox.getSize(new THREE.Vector3());
      if (Math.max(size.x, size.y, size.z) > 75) return;
    }

    node.getWorldPosition(position);
    const nearest = nearestSample(samples, position);
    if (nearest.distance < trackWidth / 2 + 5.5 || nearest.distance > 100) return;

    const zoneIndex = Math.floor((nearest.index / samples.length) * ZONES.length) % ZONES.length;
    const zoneColor = new THREE.Color(ZONES[zoneIndex].tint);
    const styled = materials.map((material) => {
      const clone = material.clone();
      clone.color?.lerp(zoneColor, 0.48);
      return clone;
    });
    node.material = Array.isArray(node.material) ? styled : styled[0];
    node.userData.turnSectionPunch = true;
  });
}

export function installSectionIntensity({ world, samples, trackWidth }) {
  addZoneVerges(world, samples, trackWidth);
  addRepeaterMarkers(world, samples, trackWidth);
  punchSceneryColors(world, samples, trackWidth);

  for (const delay of [650, 1500, 3000, 4600]) {
    window.setTimeout(() => punchSceneryColors(world, samples, trackWidth), delay);
  }

  console.info('TURN: stronger world section colors loaded.');
}