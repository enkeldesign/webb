import * as THREE from 'three';

const TAU = Math.PI * 2;
const INK = 0x08090a;
const OUTLINE_MATERIAL = new THREE.MeshBasicMaterial({
  color: INK,
  side: THREE.BackSide
});

function seeded01(seed) {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function getTrackCenter(samples) {
  const center = new THREE.Vector3();
  for (const sample of samples) center.add(sample.point);
  return center.multiplyScalar(1 / Math.max(1, samples.length));
}

function materialList(material) {
  return Array.isArray(material) ? material : [material];
}

function isOutlineMaterial(material) {
  return materialList(material).some((entry) => {
    if (!entry || entry.side !== THREE.BackSide || !entry.color) return false;
    return entry.color.getHex() === INK;
  });
}

function hasExistingOutline(mesh) {
  return mesh.children.some((child) => child.isMesh && isOutlineMaterial(child.material));
}

function geometryIsTooFlat(mesh) {
  const geometry = mesh.geometry;
  if (!geometry?.attributes?.position) return true;
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const size = geometry.boundingBox.getSize(new THREE.Vector3());
  const dimensions = [Math.abs(size.x), Math.abs(size.y), Math.abs(size.z)].sort((a, b) => a - b);
  return dimensions[0] < 0.08 || dimensions[2] < 0.35;
}

function addContour(mesh, scale = 1.055) {
  if (!mesh?.isMesh || mesh.isInstancedMesh || mesh.userData.turnOutline || mesh.userData.turnOutlined) return;
  if (isOutlineMaterial(mesh.material) || hasExistingOutline(mesh) || geometryIsTooFlat(mesh)) {
    mesh.userData.turnOutlined = true;
    return;
  }

  const outline = new THREE.Mesh(mesh.geometry, OUTLINE_MATERIAL);
  outline.name = 'TURN outline';
  outline.scale.setScalar(scale);
  outline.castShadow = false;
  outline.receiveShadow = false;
  outline.userData.turnOutline = true;
  outline.frustumCulled = mesh.frustumCulled;
  mesh.add(outline);
  mesh.userData.turnOutlined = true;
}

function contourObject(root, scale = 1.055) {
  const meshes = [];
  root.traverse((node) => {
    if (node.isMesh && !node.userData.turnOutline) meshes.push(node);
  });
  for (const mesh of meshes) addContour(mesh, scale);
}

function applyWorldContours(world) {
  const meshes = [];
  world.traverse((node) => {
    if (node.isMesh && !node.userData.turnOutline) meshes.push(node);
  });

  for (const mesh of meshes) {
    const materials = materialList(mesh.material);
    const mostlyTransparent = materials.length > 0 && materials.every((material) =>
      material?.transparent && (material.opacity ?? 1) < 0.45
    );
    if (!mostlyTransparent) addContour(mesh, 1.055);
  }
}

function makeGraphicGrassTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 768;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#8ed985';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const broadPalette = ['#79c978', '#a6e497', '#6fbe72', '#b3dd83', '#88d487'];
  for (let i = 0; i < 120; i += 1) {
    const x = seeded01(20000 + i) * canvas.width;
    const y = seeded01(21000 + i) * canvas.height;
    const radiusX = 34 + seeded01(22000 + i) * 125;
    const radiusY = 24 + seeded01(23000 + i) * 96;
    ctx.globalAlpha = 0.08 + seeded01(24000 + i) * 0.11;
    ctx.fillStyle = broadPalette[i % broadPalette.length];
    ctx.beginPath();
    ctx.ellipse(x, y, radiusX, radiusY, seeded01(25000 + i) * Math.PI, 0, TAU);
    ctx.fill();
  }

  ctx.lineCap = 'round';
  const strokePalette = ['#5bad67', '#74c777', '#a8df8f'];
  for (let i = 0; i < 190; i += 1) {
    const x = seeded01(26000 + i) * canvas.width;
    const y = seeded01(27000 + i) * canvas.height;
    const length = 7 + seeded01(28000 + i) * 19;
    const angle = (seeded01(29000 + i) - 0.5) * 1.1 - 0.25;
    ctx.globalAlpha = 0.08 + seeded01(30000 + i) * 0.1;
    ctx.strokeStyle = strokePalette[i % strokePalette.length];
    ctx.lineWidth = 2 + seeded01(31000 + i) * 4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(5.5, 5.5);
  texture.anisotropy = 8;
  return texture;
}

function restyleGround(world, texture) {
  const candidates = [];
  world.traverse((node) => {
    const radius = node.geometry?.parameters?.radius;
    if (node.isMesh && node.geometry?.type === 'CircleGeometry' && Number(radius) >= 480) {
      candidates.push(node);
    }
  });

  if (!candidates.length) return;
  candidates.sort((a, b) => (b.geometry.parameters.radius || 0) - (a.geometry.parameters.radius || 0));

  const primary = candidates[0];
  const materials = materialList(primary.material).map((material) => {
    const styled = material.clone();
    styled.map = texture;
    styled.color?.set(0xffffff);
    styled.roughness = 1;
    styled.metalness = 0;
    styled.needsUpdate = true;
    return styled;
  });
  primary.material = Array.isArray(primary.material) ? materials : materials[0];
  primary.visible = true;
  primary.position.y = -0.015;

  for (let i = 1; i < candidates.length; i += 1) candidates[i].visible = false;
}

function trackInsetContour(samples, center, inset, step = 7) {
  const points = [];
  for (let i = 0; i < samples.length; i += step) {
    const sample = samples[i];
    const towardCenter = center.clone().sub(sample.point).setY(0);
    const distance = towardCenter.length();
    if (distance < 0.001) continue;
    towardCenter.multiplyScalar(1 / distance);
    const wobble = (seeded01(32000 + i) - 0.5) * 5;
    points.push(sample.point.clone().addScaledVector(towardCenter, inset + wobble).setY(0));
  }
  return points;
}

function offsetContour(points, center, amount) {
  return points.map((point) => {
    const outward = point.clone().sub(center).setY(0);
    if (outward.lengthSq() < 0.001) return point.clone();
    return point.clone().addScaledVector(outward.normalize(), amount);
  });
}

function makeRibbon(outer, inner, y, material) {
  const positions = [];
  const indices = [];
  const count = Math.min(outer.length, inner.length);

  for (let i = 0; i < count; i += 1) {
    positions.push(outer[i].x, y, outer[i].z, inner[i].x, y, inner[i].z);
  }

  for (let i = 0; i < count; i += 1) {
    const next = (i + 1) % count;
    const a = i * 2;
    const b = a + 1;
    const c = next * 2;
    const d = c + 1;
    indices.push(a, c, b, b, c, d);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  mesh.userData.turnNoAutoOutline = true;
  return mesh;
}

function makeShape(points, material, y) {
  const shape = new THREE.Shape();
  points.forEach((point, index) => {
    const x = point.x;
    const zAsShapeY = -point.z;
    if (index === 0) shape.moveTo(x, zAsShapeY);
    else shape.lineTo(x, zAsShapeY);
  });
  shape.closePath();

  const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  mesh.receiveShadow = true;
  mesh.userData.turnNoAutoOutline = true;
  return mesh;
}

function makeWaterTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#39ccef';
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 24; i += 1) {
    ctx.globalAlpha = 0.08 + seeded01(33000 + i) * 0.12;
    ctx.fillStyle = i % 2 ? '#8cecff' : '#1eb6df';
    ctx.beginPath();
    ctx.ellipse(
      seeded01(34000 + i) * 512,
      seeded01(35000 + i) * 512,
      45 + seeded01(36000 + i) * 120,
      14 + seeded01(37000 + i) * 42,
      (seeded01(38000 + i) - 0.5) * 0.45,
      0,
      TAU
    );
    ctx.fill();
  }

  ctx.globalAlpha = 0.23;
  ctx.strokeStyle = '#f3fdff';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  for (let i = 0; i < 12; i += 1) {
    const y = 24 + i * 41 + seeded01(39000 + i) * 18;
    const x = seeded01(40000 + i) * 270;
    const width = 70 + seeded01(41000 + i) * 160;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + width * 0.5, y - 9, x + width, y);
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2.2, 2.2);
  texture.anisotropy = 8;
  return texture;
}

function addLake(world, samples) {
  const center = getTrackCenter(samples);
  const shoreOuter = trackInsetContour(samples, center, 72, 7);
  const blackOuter = offsetContour(shoreOuter, center, 2.7);
  const shoreInner = offsetContour(shoreOuter, center, -8.5);
  const waterOuter = offsetContour(shoreInner, center, -2.1);

  const blackMaterial = new THREE.MeshBasicMaterial({ color: INK, side: THREE.DoubleSide });
  const sandMaterial = new THREE.MeshStandardMaterial({ color: 0xf2cf83, roughness: 1, metalness: 0, side: THREE.DoubleSide });
  const waterMaterial = new THREE.MeshStandardMaterial({
    map: makeWaterTexture(),
    color: 0xffffff,
    roughness: 0.34,
    metalness: 0.02,
    side: THREE.DoubleSide
  });

  world.add(makeRibbon(blackOuter, shoreOuter, 0.038, blackMaterial));
  world.add(makeRibbon(shoreOuter, shoreInner, 0.042, sandMaterial));
  world.add(makeRibbon(shoreInner, waterOuter, 0.047, blackMaterial));
  world.add(makeShape(waterOuter, waterMaterial, 0.051));

  const rockMaterial = new THREE.MeshStandardMaterial({ color: 0x697481, roughness: 0.96, flatShading: true });
  for (let i = 0; i < 11; i += 1) {
    const point = shoreOuter[Math.floor((i / 11) * shoreOuter.length) % shoreOuter.length];
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.3 + seeded01(42000 + i) * 1.6, 0), rockMaterial);
    rock.position.copy(point);
    rock.position.y = 0.75 + seeded01(43000 + i) * 0.7;
    rock.scale.y = 0.55 + seeded01(44000 + i) * 0.45;
    rock.rotation.set(seeded01(45000 + i), seeded01(46000 + i) * TAU, seeded01(47000 + i));
    rock.castShadow = true;
    rock.receiveShadow = true;
    contourObject(rock, 1.09);
    world.add(rock);
  }

  addLakeIsland(world, center);
}

function addLakeIsland(world, center) {
  const islandCenter = center.clone().add(new THREE.Vector3(22, 0, -9));
  const ellipse = (radiusX, radiusZ, segments = 38) => Array.from({ length: segments }, (_, index) => {
    const angle = (index / segments) * TAU;
    const wobble = 1 + Math.sin(angle * 3 + 0.8) * 0.08 + Math.sin(angle * 5) * 0.035;
    return new THREE.Vector3(
      islandCenter.x + Math.cos(angle) * radiusX * wobble,
      0,
      islandCenter.z + Math.sin(angle) * radiusZ * wobble
    );
  });

  const black = makeShape(ellipse(20, 13), new THREE.MeshBasicMaterial({ color: INK, side: THREE.DoubleSide }), 0.058);
  const sand = makeShape(ellipse(17.8, 10.8), new THREE.MeshStandardMaterial({ color: 0xf2cf83, roughness: 1 }), 0.064);
  const grass = makeShape(ellipse(13.8, 7.8), new THREE.MeshStandardMaterial({ color: 0x78c976, roughness: 1 }), 0.071);
  world.add(black, sand, grass);

  const rockPalette = [0x596573, 0x74808a, 0x8a949c];
  for (let i = 0; i < 5; i += 1) {
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(1.7 + seeded01(48000 + i) * 1.8, 0),
      new THREE.MeshStandardMaterial({ color: rockPalette[i % rockPalette.length], roughness: 1, flatShading: true })
    );
    rock.position.set(
      islandCenter.x - 7 + i * 3.4,
      1.1 + seeded01(49000 + i) * 0.7,
      islandCenter.z + (seeded01(50000 + i) - 0.5) * 7
    );
    rock.scale.y = 0.65 + seeded01(51000 + i) * 0.65;
    rock.rotation.y = seeded01(52000 + i) * TAU;
    rock.castShadow = true;
    contourObject(rock, 1.09);
    world.add(rock);
  }
}

function addRoadOuterContour(world, samples, trackWidth) {
  const material = new THREE.MeshBasicMaterial({ color: INK, side: THREE.DoubleSide });
  for (const side of [-1, 1]) {
    const inner = [];
    const outer = [];
    for (const sample of samples) {
      inner.push(sample.point.clone().addScaledVector(sample.normal, side * (trackWidth / 2 + 1.72)));
      outer.push(sample.point.clone().addScaledVector(sample.normal, side * (trackWidth / 2 + 2.75)));
    }
    world.add(makeRibbon(outer, inner, 0.158, material));
  }
}

function addDistantMountains(world, samples) {
  const center = getTrackCenter(samples);
  let maxRadius = 0;
  for (const sample of samples) maxRadius = Math.max(maxRadius, sample.point.distanceTo(center));

  const frontPalette = [0x53647f, 0x60708d, 0x687795, 0x4f607c, 0x71809b];
  const backPalette = [0x7d8daa, 0x8797b2, 0x7486a5, 0x93a1bb];

  const addRing = ({ count, extraDistance, back = false }) => {
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * TAU + (back ? 0.11 : 0);
      const random = seeded01(53000 + i + (back ? 400 : 0));
      const distance = maxRadius + extraDistance + random * 58;
      const height = (back ? 92 : 78) + seeded01(54000 + i + (back ? 400 : 0)) * (back ? 82 : 68);
      const width = (back ? 68 : 58) + seeded01(55000 + i + (back ? 400 : 0)) * (back ? 72 : 62);
      const depth = width * (0.48 + seeded01(56000 + i) * 0.24);
      const material = new THREE.MeshStandardMaterial({
        color: (back ? backPalette : frontPalette)[i % (back ? backPalette.length : frontPalette.length)],
        roughness: 1,
        metalness: 0,
        flatShading: true
      });

      const mountain = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 5 + (i % 2), 1, false), material);
      mountain.scale.set(width, height, depth);
      mountain.position.set(
        center.x + Math.cos(angle) * distance,
        height * 0.5 - 18,
        center.z + Math.sin(angle) * distance
      );
      mountain.rotation.y = -angle + seeded01(57000 + i) * 0.7;
      mountain.castShadow = false;
      mountain.receiveShadow = false;
      contourObject(mountain, back ? 1.032 : 1.045);
      world.add(mountain);

      if (!back && i % 3 === 0) {
        const shoulder = new THREE.Mesh(
          new THREE.ConeGeometry(1, 1, 5, 1, false),
          new THREE.MeshStandardMaterial({ color: frontPalette[(i + 2) % frontPalette.length], roughness: 1, flatShading: true })
        );
        shoulder.scale.set(width * 0.58, height * 0.58, depth * 0.72);
        shoulder.position.copy(mountain.position).add(new THREE.Vector3(
          Math.cos(angle + 1.2) * width * 0.45,
          -height * 0.18,
          Math.sin(angle + 1.2) * width * 0.45
        ));
        shoulder.rotation.y = mountain.rotation.y + 0.45;
        contourObject(shoulder, 1.045);
        world.add(shoulder);
      }
    }
  };

  addRing({ count: 18, extraDistance: 315, back: false });
  addRing({ count: 14, extraDistance: 420, back: true });
}

function tuneAtmosphere(scene) {
  const sky = new THREE.Color(0x53d3f2);
  scene.background = sky;
  if (scene.fog) {
    scene.fog.color.copy(sky);
    scene.fog.near = 250;
    scene.fog.far = 865;
  }
}

export async function installArtPass({ world, scene, samples, trackWidth }) {
  const grassTexture = makeGraphicGrassTexture();

  tuneAtmosphere(scene);
  restyleGround(world, grassTexture);
  addLake(world, samples);
  addRoadOuterContour(world, samples, trackWidth);
  addDistantMountains(world, samples);

  applyWorldContours(world);

  // Other scenery modules load models asynchronously. Revisit the world a few times so
  // late Kenney assets receive the same thick contour language without blocking the game.
  window.setTimeout(() => {
    restyleGround(world, grassTexture);
    applyWorldContours(world);
  }, 700);
  window.setTimeout(() => {
    restyleGround(world, grassTexture);
    applyWorldContours(world);
  }, 1800);
  window.setTimeout(() => applyWorldContours(world), 3600);

  console.info('TURN: bold surroundings art pass loaded.');
}
