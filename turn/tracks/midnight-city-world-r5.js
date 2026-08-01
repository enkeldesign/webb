import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { installMidnightCityWorld as installMidnightCityWorldR4 } from './midnight-city-world-r4.js?base=20260801-r4';

const TRACK_Y = 0.16;
const CITY_BUILDER_COMMIT = '4535092b740b378b700efd9df9e27a631815b84a';
const CITY_MODEL_BASE = `https://cdn.jsdelivr.net/gh/KenneyNL/Starter-Kit-City-Builder@${CITY_BUILDER_COMMIT}/models/`;
const FOUNTAIN_ASSET = `${CITY_MODEL_BASE}pavement-fountain.glb`;

const COLORS = Object.freeze({
  ink: 0x070a14,
  park: 0x10251f,
  parkPath: 0x29323b,
  pond: 0x16465e,
  water: 0x79eeff,
  lamp: 0xffffd8,
  purple: 0x9d7cff,
  cyan: 0x5de4ff,
  yellow: 0xffdc68,
  pink: 0xff4fa3,
  orange: 0xff8f3d,
  airport: 0xffd43b,
  cliffside: 0x26c7c3
});

const DISTRICTS = Object.freeze([
  Object.freeze({
    id: 'neon-quarter',
    label: 'NEON QUARTER',
    color: COLORS.pink,
    centerX: -360,
    centerZ: 35,
    width: 310,
    depth: 250
  }),
  Object.freeze({
    id: 'downtown-core',
    label: 'DOWNTOWN',
    color: COLORS.cyan,
    centerX: 315,
    centerZ: 70,
    width: 330,
    depth: 310
  }),
  Object.freeze({
    id: 'uptown',
    label: 'UPTOWN',
    color: COLORS.yellow,
    centerX: -120,
    centerZ: 260,
    width: 430,
    depth: 155
  }),
  Object.freeze({
    id: 'motor-mile',
    label: 'MOTOR MILE',
    color: COLORS.purple,
    centerX: 180,
    centerZ: -285,
    width: 500,
    depth: 150
  })
]);

const PARKS = Object.freeze([
  Object.freeze({
    id: 'turn-commons',
    label: 'TURN COMMONS',
    x: 0,
    z: 72,
    radius: 49,
    color: COLORS.cyan,
    pond: true,
    fountain: true
  }),
  Object.freeze({
    id: 'violet-gardens',
    label: 'VIOLET GARDENS',
    x: -418,
    z: -286,
    radius: 42,
    color: COLORS.purple,
    pond: false,
    fountain: false
  }),
  Object.freeze({
    id: 'sunrise-park',
    label: 'SUNRISE PARK',
    x: 405,
    z: 292,
    radius: 44,
    color: COLORS.yellow,
    pond: true,
    fountain: false
  })
]);

const LORE_ROADS = Object.freeze([
  Object.freeze({ label: 'BOOST STREET', color: 0xff6b6b, sampleRatio: 0.05, side: -1 }),
  Object.freeze({ label: 'TURN AVENUE', color: COLORS.cyan, sampleRatio: 0.24, side: 1 }),
  Object.freeze({ label: 'DRIFT LANE', color: 0x55c9ed, sampleRatio: 0.43, side: -1 }),
  Object.freeze({ label: 'AIRPORT', color: COLORS.airport, sampleRatio: 0.61, side: 1 }),
  Object.freeze({ label: 'HARBOR', color: COLORS.orange, sampleRatio: 0.79, side: -1 }),
  Object.freeze({ label: 'CLIFFSIDE', color: COLORS.cliffside, sampleRatio: 0.91, side: 1 })
]);

const loader = new GLTFLoader();
let fountainSourcePromise = null;

export function installMidnightCityWorld(options) {
  const world = installMidnightCityWorldR4(options);
  const samples = options.samples || [];
  const trackWidth = options.trackWidth || 27;

  const lampPoolUpdated = brightenLampPools(world);
  const parkResult = installParks(world, samples, trackWidth);
  const districtResult = installDistrictColorLanguage(world, samples, trackWidth);
  const loreResult = installLoreRoads(world, samples, trackWidth);
  const skylineResult = installSkylineBillboards(world);
  installKenneyFountain(world, parkResult.fountainAnchor);

  world.name = 'TURN Midnight City r5';
  world.userData.turnMidnightCityArtDirection = Object.freeze({
    ...(world.userData.turnMidnightCityArtDirection || {}),
    version: 'r5',
    lampPoolColor: 'lighter warm yellow with a pale centre',
    lampPoolUpdated,
    parkCount: parkResult.count,
    parkTreeCount: parkResult.treeCount,
    pondCount: parkResult.pondCount,
    fountainTechnique: 'static neon water plus one asynchronously loaded pinned Kenney CC0 fountain model',
    districtIdentity: 'pink, cyan, yellow and purple entrance stripes plus matching edge pylons',
    districtEntranceCount: districtResult.entrances,
    districtPylonCount: districtResult.pylons,
    loreRoadCount: loreResult.roads,
    loreSignCount: loreResult.signs,
    loreRoadsAreOutsideRaceBoundary: true,
    skylineTechnique: 'six low-detail generated skyline texture billboards',
    skylinePanelCount: skylineResult.panels,
    externalAssetFiles: true,
    externalAssetSource: 'Kenney Starter Kit City Builder, pinned commit, CC0',
    noIndependentAnimationLoop: true
  });

  return world;
}

function brightenLampPools(world) {
  const pools = world.getObjectByName('Midnight City lamp-post gradient pools');
  if (!pools?.material) return false;

  const material = pools.material;
  material.map?.dispose?.();
  material.map = makeRadialLightTexture();
  material.color.setHex(COLORS.lamp);
  material.opacity = 0.72;
  material.needsUpdate = true;
  return true;
}

function makeRadialLightTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255, 255, 234, 0.98)');
  gradient.addColorStop(0.2, 'rgba(255, 247, 181, 0.76)');
  gradient.addColorStop(0.5, 'rgba(255, 222, 105, 0.34)');
  gradient.addColorStop(1, 'rgba(255, 218, 92, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function installParks(world, samples, trackWidth) {
  const accepted = PARKS.filter((park) => isAreaClearOfTrack(
    park.x,
    park.z,
    park.radius + 8,
    samples,
    trackWidth
  ));

  const treeTrunks = [];
  const treeCrowns = [];
  let pondCount = 0;
  let fountainAnchor = null;

  for (const park of accepted) {
    const group = new THREE.Group();
    group.name = `Midnight City park ${park.label}`;
    group.position.set(park.x, 0, park.z);

    const lawn = new THREE.Mesh(
      new THREE.CircleGeometry(park.radius, 48),
      new THREE.MeshStandardMaterial({
        color: COLORS.park,
        roughness: 0.95,
        metalness: 0
      })
    );
    lawn.rotation.x = -Math.PI / 2;
    lawn.position.y = TRACK_Y + 0.015;
    lawn.receiveShadow = true;
    group.add(lawn);

    const path = new THREE.Mesh(
      new THREE.RingGeometry(park.radius * 0.54, park.radius * 0.67, 48),
      new THREE.MeshBasicMaterial({
        color: COLORS.parkPath,
        side: THREE.DoubleSide,
        toneMapped: false
      })
    );
    path.rotation.x = -Math.PI / 2;
    path.position.y = TRACK_Y + 0.035;
    group.add(path);

    const outline = new THREE.Mesh(
      new THREE.RingGeometry(park.radius * 0.96, park.radius, 48),
      new THREE.MeshBasicMaterial({
        color: park.color,
        transparent: true,
        opacity: 0.76,
        side: THREE.DoubleSide,
        toneMapped: false
      })
    );
    outline.rotation.x = -Math.PI / 2;
    outline.position.y = TRACK_Y + 0.055;
    group.add(outline);

    if (park.pond) {
      const pond = new THREE.Mesh(
        new THREE.CircleGeometry(park.radius * 0.29, 40),
        new THREE.MeshBasicMaterial({
          color: COLORS.pond,
          transparent: true,
          opacity: 0.94,
          side: THREE.DoubleSide,
          toneMapped: false
        })
      );
      pond.scale.set(1.4, 0.72, 1);
      pond.rotation.x = -Math.PI / 2;
      pond.rotation.z = park.id === 'sunrise-park' ? 0.7 : -0.35;
      pond.position.set(park.radius * 0.14, TRACK_Y + 0.06, -park.radius * 0.08);
      group.add(pond);

      const pondGlow = new THREE.Mesh(
        new THREE.RingGeometry(park.radius * 0.27, park.radius * 0.31, 40),
        new THREE.MeshBasicMaterial({
          color: COLORS.water,
          transparent: true,
          opacity: 0.78,
          side: THREE.DoubleSide,
          toneMapped: false
        })
      );
      pondGlow.scale.copy(pond.scale);
      pondGlow.rotation.copy(pond.rotation);
      pondGlow.position.copy(pond.position);
      pondGlow.position.y += 0.01;
      group.add(pondGlow);
      pondCount += 1;
    }

    addParkLabel(group, park);
    addParkBenches(group, park);

    for (let index = 0; index < 15; index += 1) {
      const angle = (index / 15) * Math.PI * 2 + pseudo(index + park.x) * 0.22;
      const radius = park.radius * (0.72 + pseudo(index * 13 + park.z) * 0.18);
      const x = park.x + Math.cos(angle) * radius;
      const z = park.z + Math.sin(angle) * radius;
      const height = 4.8 + pseudo(index * 31 + park.x - park.z) * 3.8;
      treeTrunks.push({ x, z, height: height * 0.42 });
      treeCrowns.push({
        x,
        z,
        y: height * 0.76,
        radius: 1.8 + height * 0.22,
        height: height * 0.82,
        color: park.color
      });
    }

    if (park.fountain) {
      fountainAnchor = new THREE.Vector3(
        park.x - park.radius * 0.2,
        TRACK_Y,
        park.z + park.radius * 0.12
      );
      addProceduralFountain(group, park, fountainAnchor.clone().sub(group.position));
    }

    world.add(group);
  }

  installParkTrees(world, treeTrunks, treeCrowns);
  return {
    count: accepted.length,
    treeCount: treeCrowns.length,
    pondCount,
    fountainAnchor
  };
}

function isAreaClearOfTrack(x, z, radius, samples, trackWidth) {
  const required = radius + trackWidth / 2 + 5;
  const requiredSquared = required * required;
  for (let index = 0; index < samples.length; index += 3) {
    const point = samples[index].point;
    const dx = x - point.x;
    const dz = z - point.z;
    if (dx * dx + dz * dz < requiredSquared) return false;
  }
  return true;
}

function addParkLabel(group, park) {
  const sign = makeNeonSign(park.label, park.color, { arrow: false, width: 30 });
  sign.position.set(0, 4.5, -park.radius * 0.76);
  sign.rotation.y = 0;
  group.add(sign);
}

function addParkBenches(group, park) {
  const material = new THREE.MeshStandardMaterial({
    color: 0x5d3c2a,
    roughness: 0.88,
    metalness: 0.04
  });
  for (const angle of [0.65, 2.6, 4.55]) {
    const bench = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.45, 1.6), material);
    seat.position.y = 1.05;
    bench.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(5.4, 1.9, 0.35), material);
    back.position.set(0, 1.85, -0.62);
    back.rotation.x = -0.1;
    bench.add(back);
    for (const x of [-2.1, 2.1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.1, 0.35), material);
      leg.position.set(x, 0.55, 0);
      bench.add(leg);
    }
    const radius = park.radius * 0.46;
    bench.position.set(Math.cos(angle) * radius, TRACK_Y, Math.sin(angle) * radius);
    bench.rotation.y = -angle + Math.PI / 2;
    group.add(bench);
  }
}

function addProceduralFountain(group, park, localPosition) {
  const baseMaterial = new THREE.MeshStandardMaterial({
    color: 0x8793a6,
    roughness: 0.58,
    metalness: 0.18
  });
  const waterMaterial = new THREE.MeshBasicMaterial({
    color: COLORS.water,
    transparent: true,
    opacity: 0.88,
    toneMapped: false
  });
  const fountain = new THREE.Group();
  fountain.name = 'Midnight City neon fountain fallback';
  fountain.position.copy(localPosition);

  const basin = new THREE.Mesh(new THREE.CylinderGeometry(8.2, 8.8, 1.1, 40), baseMaterial);
  basin.position.y = 0.55;
  fountain.add(basin);

  const water = new THREE.Mesh(new THREE.CylinderGeometry(7.4, 7.4, 0.18, 40), waterMaterial);
  water.position.y = 1.18;
  fountain.add(water);

  const centre = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.7, 4.8, 20), baseMaterial);
  centre.position.y = 3.4;
  fountain.add(centre);

  const jet = new THREE.Mesh(new THREE.ConeGeometry(1.7, 10.5, 20, 1, true), waterMaterial);
  jet.position.y = 8.2;
  fountain.add(jet);

  const glow = new THREE.Mesh(
    new THREE.RingGeometry(7.5, 8.2, 40),
    new THREE.MeshBasicMaterial({
      color: park.color,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
      toneMapped: false
    })
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 1.25;
  fountain.add(glow);
  group.add(fountain);
}

function installParkTrees(world, trunks, crowns) {
  if (!crowns.length) return;

  const trunkMesh = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.32, 0.5, 1, 7),
    new THREE.MeshStandardMaterial({ color: 0x4b3024, roughness: 1 }),
    trunks.length
  );
  trunkMesh.name = 'Midnight City park tree trunks';

  const crownMaterials = new Map();
  for (const crown of crowns) {
    if (!crownMaterials.has(crown.color)) crownMaterials.set(crown.color, []);
    crownMaterials.get(crown.color).push(crown);
  }

  const marker = new THREE.Object3D();
  for (let index = 0; index < trunks.length; index += 1) {
    const trunk = trunks[index];
    marker.position.set(trunk.x, TRACK_Y + trunk.height / 2, trunk.z);
    marker.scale.set(1, trunk.height, 1);
    marker.rotation.set(0, pseudo(index) * Math.PI, 0);
    marker.updateMatrix();
    trunkMesh.setMatrixAt(index, marker.matrix);
  }
  trunkMesh.instanceMatrix.needsUpdate = true;
  world.add(trunkMesh);

  for (const [color, entries] of crownMaterials) {
    const mesh = new THREE.InstancedMesh(
      new THREE.ConeGeometry(1, 1, 8),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(color).multiplyScalar(0.34),
        roughness: 0.94,
        metalness: 0
      }),
      entries.length
    );
    mesh.name = `Midnight City park crowns ${color.toString(16)}`;
    for (let index = 0; index < entries.length; index += 1) {
      const crown = entries[index];
      marker.position.set(crown.x, TRACK_Y + crown.y, crown.z);
      marker.scale.set(crown.radius, crown.height, crown.radius);
      marker.rotation.set(0, pseudo(index + color) * Math.PI, 0);
      marker.updateMatrix();
      mesh.setMatrixAt(index, marker.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    world.add(mesh);
  }
}

function installDistrictColorLanguage(world, samples, trackWidth) {
  let entranceCount = 0;
  const pylonsByColor = new Map(DISTRICTS.map((district) => [district.color, []]));

  for (const district of DISTRICTS) {
    const matchingIndices = [];
    for (let index = 0; index < samples.length; index += 1) {
      const point = samples[index].point;
      if (
        Math.abs(point.x - district.centerX) <= district.width / 2 + 35 &&
        Math.abs(point.z - district.centerZ) <= district.depth / 2 + 35
      ) {
        matchingIndices.push(index);
      }
    }
    if (!matchingIndices.length) continue;

    const entranceIndex = matchingIndices[0];
    const entrance = samples[entranceIndex];
    const stripeGroup = new THREE.Group();
    stripeGroup.name = `Midnight City district entrance ${district.label}`;
    const angle = Math.atan2(entrance.tangent.x, entrance.tangent.z);
    stripeGroup.position.copy(entrance.point).setY(entrance.point.y + TRACK_Y + 0.08);
    stripeGroup.rotation.y = angle;
    for (let stripe = -2; stripe <= 2; stripe += 1) {
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(trackWidth * 0.86, 0.055, 0.62),
        new THREE.MeshBasicMaterial({
          color: district.color,
          transparent: true,
          opacity: 0.82,
          toneMapped: false
        })
      );
      bar.position.z = stripe * 1.25;
      stripeGroup.add(bar);
    }
    world.add(stripeGroup);
    entranceCount += 1;

    for (let cursor = 0; cursor < matchingIndices.length; cursor += 22) {
      const sample = samples[matchingIndices[cursor]];
      for (const side of [-1, 1]) {
        const position = sample.point.clone()
          .addScaledVector(sample.normal, side * (trackWidth / 2 + 2.9));
        pylonsByColor.get(district.color).push({
          x: position.x,
          y: sample.point.y + 2.2,
          z: position.z,
          rotation: Math.atan2(sample.tangent.x, sample.tangent.z)
        });
      }
    }
  }

  let pylonCount = 0;
  for (const [color, entries] of pylonsByColor) {
    const mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.42, 4.4, 0.42),
      new THREE.MeshBasicMaterial({ color, toneMapped: false }),
      Math.max(1, entries.length)
    );
    mesh.name = `Midnight City district edge pylons ${color.toString(16)}`;
    const marker = new THREE.Object3D();
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      marker.position.set(entry.x, entry.y, entry.z);
      marker.rotation.set(0, entry.rotation, 0);
      marker.scale.set(1, 1, 1);
      marker.updateMatrix();
      mesh.setMatrixAt(index, marker.matrix);
    }
    mesh.count = entries.length;
    mesh.instanceMatrix.needsUpdate = true;
    world.add(mesh);
    pylonCount += entries.length;
  }

  return { entrances: entranceCount, pylons: pylonCount };
}

function installLoreRoads(world, samples, trackWidth) {
  if (!samples.length) return { roads: 0, signs: 0 };

  let roadCount = 0;
  let signCount = 0;
  for (const lore of LORE_ROADS) {
    const index = Math.round(lore.sampleRatio * (samples.length - 1));
    const sample = samples[index];
    const outward = sample.normal.clone().multiplyScalar(lore.side);
    const group = new THREE.Group();
    group.name = `Midnight City inaccessible lore road ${lore.label}`;
    group.position.copy(sample.point)
      .addScaledVector(outward, trackWidth / 2 + 39)
      .setY(sample.point.y + TRACK_Y);
    group.rotation.y = Math.atan2(outward.x, outward.z);

    const road = new THREE.Mesh(
      new THREE.BoxGeometry(16, 0.16, 64),
      new THREE.MeshStandardMaterial({
        color: 0x101522,
        roughness: 0.9,
        metalness: 0.02
      })
    );
    road.position.z = 25;
    road.receiveShadow = true;
    group.add(road);

    const centreLine = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.08, 48),
      new THREE.MeshBasicMaterial({
        color: lore.color,
        transparent: true,
        opacity: 0.74,
        toneMapped: false
      })
    );
    centreLine.position.set(0, 0.13, 28);
    group.add(centreLine);

    const barrier = makeRoadBarrier(lore.color);
    barrier.position.set(0, 1.15, -1.5);
    group.add(barrier);

    const sign = makeNeonSign(lore.label, lore.color, { arrow: true, width: 28 });
    sign.position.set(lore.side > 0 ? -12 : 12, 7.8, -4);
    sign.rotation.y = lore.side > 0 ? 0.12 : -0.12;
    group.add(sign);

    const closedPlate = makeNeonSign('ROAD CLOSED', 0xfff0c2, { arrow: false, width: 19 });
    closedPlate.position.set(0, 3.5, 3.5);
    closedPlate.scale.setScalar(0.64);
    group.add(closedPlate);

    world.add(group);
    roadCount += 1;
    signCount += 2;
  }

  return { roads: roadCount, signs: signCount };
}

function makeRoadBarrier(color) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: 0x131722,
    roughness: 0.78,
    metalness: 0.16
  });
  const glow = new THREE.MeshBasicMaterial({ color, toneMapped: false });
  const beam = new THREE.Mesh(new THREE.BoxGeometry(16, 1, 1), material);
  group.add(beam);
  for (const x of [-6.5, -2.2, 2.2, 6.5]) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.52, 1.08), glow);
    panel.position.set(x, 0, 0);
    panel.rotation.z = 0.25;
    group.add(panel);
  }
  for (const x of [-6.8, 6.8]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.7, 2.7, 0.7), material);
    post.position.set(x, -1.25, 0);
    group.add(post);
  }
  return group;
}

function makeNeonSign(label, color, { arrow = false, width = 28 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 192;
  const context = canvas.getContext('2d');
  const cssColor = `#${color.toString(16).padStart(6, '0')}`;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = 'rgba(3, 5, 12, 0.92)';
  context.fillRect(8, 8, canvas.width - 16, canvas.height - 16);
  context.shadowColor = cssColor;
  context.shadowBlur = 18;
  context.strokeStyle = cssColor;
  context.lineWidth = 12;
  context.strokeRect(14, 14, canvas.width - 28, canvas.height - 28);
  context.shadowBlur = 12;
  context.fillStyle = cssColor;
  context.font = '900 78px system-ui, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(`${arrow ? '← ' : ''}${label}`, canvas.width / 2, canvas.height / 2 + 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(width, width * 0.25),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false
    })
  );
  sign.name = `Midnight City neon sign ${label}`;
  return sign;
}

function installSkylineBillboards(world) {
  const texture = makeSkylineTexture();
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
    fog: true
  });
  const radius = 960;
  const panelCount = 6;

  for (let index = 0; index < panelCount; index += 1) {
    const angle = (index / panelCount) * Math.PI * 2;
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(520, 190), material);
    panel.name = `Midnight City skyline billboard ${index + 1}`;
    panel.position.set(Math.cos(angle) * radius, 88, Math.sin(angle) * radius);
    panel.rotation.y = -angle - Math.PI / 2;
    panel.renderOrder = -2;
    world.add(panel);
  }

  return { panels: panelCount };
}

function makeSkylineTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 384;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);

  const skyGradient = context.createLinearGradient(0, 0, 0, canvas.height);
  skyGradient.addColorStop(0, 'rgba(10, 13, 32, 0)');
  skyGradient.addColorStop(1, 'rgba(5, 7, 18, 0.94)');
  context.fillStyle = skyGradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  let x = 0;
  let building = 0;
  while (x < canvas.width) {
    const width = 28 + Math.floor(pseudo(building * 17 + 3) * 58);
    const height = 70 + Math.floor(pseudo(building * 23 + 7) * 240);
    const y = canvas.height - height;
    context.fillStyle = building % 3 === 0 ? '#0b1024' : '#080c1c';
    context.fillRect(x, y, width, height);

    const windowColor = ['#5de4ff', '#ffdc68', '#ff4fa3', '#9d7cff'][building % 4];
    context.fillStyle = windowColor;
    context.globalAlpha = 0.34;
    for (let wy = y + 18; wy < canvas.height - 12; wy += 22) {
      for (let wx = x + 9; wx < x + width - 7; wx += 18) {
        if (pseudo(wx * 0.7 + wy * 1.3) > 0.55) context.fillRect(wx, wy, 7, 3);
      }
    }
    context.globalAlpha = 1;
    x += width + 6;
    building += 1;
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function installKenneyFountain(world, anchor) {
  if (!anchor) return;
  fountainSourcePromise ||= loader.loadAsync(FOUNTAIN_ASSET).then((gltf) => gltf.scene);

  fountainSourcePromise
    .then((source) => {
      if (!world.parent) return;
      const model = prepareAsset(source, {
        targetSize: 17,
        tint: COLORS.cyan,
        tintAmount: 0.22
      });
      model.name = 'Midnight City Kenney fountain landmark';
      model.position.copy(anchor);
      model.position.y += 0.35;
      model.rotation.y = Math.PI / 4;
      world.add(model);

      const plaque = makeNeonSign('TURN COMMONS', COLORS.cyan, { arrow: false, width: 23 });
      plaque.position.copy(anchor).add(new THREE.Vector3(0, 5.8, -11));
      world.add(plaque);
    })
    .catch((error) => {
      console.warn('TURN: Midnight City fountain asset failed to load; procedural fountain remains.', error);
    });
}

function prepareAsset(source, { targetSize, tint, tintAmount }) {
  const model = source.clone(true);
  const tintColor = new THREE.Color(tint);
  model.traverse((node) => {
    if (!node.isMesh) return;
    const sourceMaterials = Array.isArray(node.material) ? node.material : [node.material];
    const materials = sourceMaterials.map((material) => {
      const clone = material.clone();
      clone.color?.lerp(tintColor, tintAmount);
      clone.roughness = Math.max(clone.roughness ?? 0.75, 0.72);
      clone.metalness = Math.min(clone.metalness ?? 0.08, 0.16);
      return clone;
    });
    node.material = Array.isArray(node.material) ? materials : materials[0];
    node.castShadow = false;
    node.receiveShadow = true;
  });

  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const scale = targetSize / Math.max(size.x, size.y, size.z, 0.001);
  model.scale.setScalar(scale);
  model.updateMatrixWorld(true);

  const scaledBounds = new THREE.Box3().setFromObject(model);
  const centre = scaledBounds.getCenter(new THREE.Vector3());
  model.position.x -= centre.x;
  model.position.y -= scaledBounds.min.y;
  model.position.z -= centre.z;
  return model;
}

function pseudo(seed) {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}
