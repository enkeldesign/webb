import * as THREE from 'three';
import {
  ABILITY_ZONES,
  ABILITY_ZONE_TYPE,
  zoneSampleIndices
} from '../race/ability-zones.js';

const ZONE_COLORS = Object.freeze({
  [ABILITY_ZONE_TYPE.DRIFT]: 0x2f9fe8,
  [ABILITY_ZONE_TYPE.BOOST]: 0xef3340
});

export function installAbilityZoneVisuals({ world, samples, trackWidth }) {
  const root = new THREE.Group();
  root.name = 'TURN Ability Zones';
  const visuals = new Map();

  for (const abilityZone of ABILITY_ZONES) {
    const visual = makeZoneVisual({ abilityZone, samples, trackWidth });
    root.add(visual.group);
    visuals.set(abilityZone.id, visual);
  }

  world.add(root);

  return Object.freeze({
    root,
    update(activeZoneId, now = performance.now()) {
      for (const [zoneId, visual] of visuals) {
        const active = zoneId === activeZoneId;
        visual.material.emissiveIntensity = active
          ? 0.46 + Math.sin(now * 0.014) * 0.16
          : 0.12;
        visual.material.opacity = active ? 1 : 0.88;
        visual.markerMaterial.emissiveIntensity = active ? 0.4 : 0.08;
      }
    }
  });
}

function makeZoneVisual({ abilityZone, samples, trackWidth }) {
  const group = new THREE.Group();
  group.name = abilityZone.id;
  const width = abilityZone.laneWidth * trackWidth;
  const laneCenter = abilityZone.laneCenter * trackWidth;
  const indices = zoneSampleIndices(abilityZone, samples.length);

  const outlineGeometry = makeStripGeometry({
    indices,
    samples,
    laneCenter,
    width: width + 0.9,
    height: 0.195
  });
  const outline = new THREE.Mesh(
    outlineGeometry,
    new THREE.MeshBasicMaterial({ color: 0x08090a, side: THREE.DoubleSide })
  );
  outline.receiveShadow = true;
  group.add(outline);

  const material = new THREE.MeshStandardMaterial({
    color: ZONE_COLORS[abilityZone.type],
    emissive: ZONE_COLORS[abilityZone.type],
    emissiveIntensity: 0.12,
    roughness: 0.72,
    metalness: 0,
    transparent: true,
    opacity: 0.88,
    depthWrite: true,
    side: THREE.DoubleSide
  });
  const strip = new THREE.Mesh(
    makeStripGeometry({ indices, samples, laneCenter, width, height: 0.22 }),
    material
  );
  strip.receiveShadow = true;
  group.add(strip);

  const markerMaterial = new THREE.MeshStandardMaterial({
    color: 0xfff8e8,
    emissive: 0xfff8e8,
    emissiveIntensity: 0.08,
    roughness: 0.8
  });
  const markerGeometry = new THREE.BoxGeometry(width * 0.72, 0.055, 0.82);
  const markerCount = Math.max(1, Math.floor(indices.length / 9));
  const markers = new THREE.InstancedMesh(markerGeometry, markerMaterial, markerCount);
  const marker = new THREE.Object3D();

  for (let markerIndex = 0; markerIndex < markerCount; markerIndex += 1) {
    const index = indices[Math.min(indices.length - 1, markerIndex * 9 + 4)];
    const sample = samples[index];
    marker.position.copy(sample.point).addScaledVector(sample.normal, laneCenter);
    marker.position.y = 0.255;
    const yaw = Math.atan2(sample.tangent.x, sample.tangent.z);
    marker.rotation.set(
      0,
      yaw + (abilityZone.type === ABILITY_ZONE_TYPE.DRIFT ? 0.48 : 0),
      0
    );
    marker.updateMatrix();
    markers.setMatrixAt(markerIndex, marker.matrix);
  }

  markers.instanceMatrix.needsUpdate = true;
  markers.receiveShadow = true;
  group.add(markers);

  return { group, material, markerMaterial };
}

function makeStripGeometry({ indices, samples, laneCenter, width, height }) {
  const positions = [];
  const triangleIndices = [];
  const halfWidth = width * 0.5;

  for (const index of indices) {
    const sample = samples[index];
    const leftOffset = laneCenter + halfWidth;
    const rightOffset = laneCenter - halfWidth;
    const left = sample.point.clone().addScaledVector(sample.normal, leftOffset).setY(height);
    const right = sample.point.clone().addScaledVector(sample.normal, rightOffset).setY(height);
    positions.push(left.x, left.y, left.z, right.x, right.y, right.z);
  }

  for (let segment = 0; segment < indices.length - 1; segment += 1) {
    const a = segment * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    triangleIndices.push(a, c, b, b, c, d);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(triangleIndices);
  geometry.computeVertexNormals();
  return geometry;
}
