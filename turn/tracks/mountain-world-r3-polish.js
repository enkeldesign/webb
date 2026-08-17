import * as THREE from 'three';
import { MOUNTAIN_R3, material, offsetPoint } from './mountain-world-r3-terrain.js';

const { GRANITE_DARK, WATER, WATER_LIGHT, WATERFALL, LAKE, ROAD_HEIGHT } = MOUNTAIN_R3;
const FOUNDATION_DEPTH = 4.6;

function makeDeepRoadFoundations(world, samples, trackWidth) {
  const half = trackWidth / 2 + 0.02;
  const foundationMaterial = material(GRANITE_DARK, 1, 0, { side: THREE.DoubleSide });
  for (const side of [-1, 1]) {
    const positions = [];
    for (let index = 0; index < samples.length; index += 1) {
      const current = samples[index];
      const next = samples[(index + 1) % samples.length];
      const topA = offsetPoint(current, side * half, ROAD_HEIGHT - 0.02);
      const topB = offsetPoint(next, side * half, ROAD_HEIGHT - 0.02);
      const bottomA = offsetPoint(current, side * half, -FOUNDATION_DEPTH);
      const bottomB = offsetPoint(next, side * half, -FOUNDATION_DEPTH);
      positions.push(
        topA.x, topA.y, topA.z,
        topB.x, topB.y, topB.z,
        bottomA.x, bottomA.y, bottomA.z,
        topB.x, topB.y, topB.z,
        bottomB.x, bottomB.y, bottomB.z,
        bottomA.x, bottomA.y, bottomA.z
      );
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    const foundation = new THREE.Mesh(geometry, foundationMaterial);
    foundation.receiveShadow = true;
    foundation.name = 'Mountain deep retaining road foundation r3';
    world.add(foundation);
  }
  world.userData.turnMountainRoadFoundationDepth = FOUNDATION_DEPTH;
}

function quadGeometry(a, b, c, d) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    ...a, ...b, ...c,
    ...b, ...d, ...c
  ], 3));
  geometry.computeVertexNormals();
  return geometry;
}

function makeVisibleWaterfall(world) {
  const curtainMaterial = new THREE.MeshStandardMaterial({
    color: WATER_LIGHT,
    roughness: 0.2,
    transparent: true,
    opacity: 0.93,
    side: THREE.DoubleSide,
    emissive: 0x0a4e69,
    emissiveIntensity: 0.2,
    depthWrite: false
  });
  const whiteWaterMaterial = new THREE.MeshStandardMaterial({
    color: 0xe8fbff,
    roughness: 0.2,
    transparent: true,
    opacity: 0.66,
    side: THREE.DoubleSide,
    emissive: 0x315d69,
    emissiveIntensity: 0.15,
    depthWrite: false
  });

  const lipZ = WATERFALL.z + 2.6;
  const curtainZ = WATERFALL.z - 14.5;
  const bottomZ = LAKE.z + LAKE.rz * 0.86;
  const topY = WATERFALL.top + 0.08;
  const curtainTopY = WATERFALL.top - 0.75;
  const bottomY = LAKE.level + 0.34;

  const chute = new THREE.Mesh(
    quadGeometry(
      [WATERFALL.x - 9.5, topY, lipZ],
      [WATERFALL.x + 9.5, topY, lipZ],
      [WATERFALL.x - 9.5, curtainTopY, curtainZ],
      [WATERFALL.x + 9.5, curtainTopY, curtainZ]
    ),
    curtainMaterial
  );
  chute.name = 'Mountain river waterfall spillway r3';
  chute.renderOrder = 3;
  world.add(chute);

  for (const [offset, width, opacityMaterial] of [
    [-5.7, 7.2, curtainMaterial],
    [0, 8.0, whiteWaterMaterial],
    [5.7, 7.2, curtainMaterial]
  ]) {
    const half = width / 2;
    const curtain = new THREE.Mesh(
      quadGeometry(
        [WATERFALL.x + offset - half, curtainTopY, curtainZ],
        [WATERFALL.x + offset + half, curtainTopY, curtainZ],
        [WATERFALL.x + offset - half, bottomY, bottomZ],
        [WATERFALL.x + offset + half, bottomY, bottomZ]
      ),
      opacityMaterial
    );
    curtain.name = 'Mountain visible waterfall curtain r3';
    curtain.renderOrder = 4;
    world.add(curtain);
  }

  const plunge = new THREE.Mesh(
    new THREE.CircleGeometry(24, 32),
    new THREE.MeshBasicMaterial({ color: 0xe8fbff, transparent: true, opacity: 0.78, side: THREE.DoubleSide, depthWrite: false })
  );
  plunge.rotation.x = -Math.PI / 2;
  plunge.scale.set(1.32, 0.58, 1);
  plunge.position.set(WATERFALL.x, LAKE.level + 0.12, bottomZ - 3.8);
  plunge.name = 'Mountain waterfall plunge pool foam r3';
  plunge.renderOrder = 5;
  world.add(plunge);

  const sprayMaterial = new THREE.MeshBasicMaterial({ color: 0xe9fbff, transparent: true, opacity: 0.20, depthWrite: false });
  for (let index = 0; index < 9; index += 1) {
    const spray = new THREE.Mesh(new THREE.IcosahedronGeometry(2.8 + (index % 3) * 1.2, 1), sprayMaterial);
    spray.position.set(
      WATERFALL.x - 13 + (index % 5) * 6.2,
      bottomY + 2.2 + Math.floor(index / 5) * 3.6,
      bottomZ - 2 + (index % 2) * 3.2
    );
    spray.scale.y = 0.62;
    spray.name = 'Mountain waterfall visible spray r3';
    spray.renderOrder = 5;
    world.add(spray);
  }

  world.userData.turnMountainVisibleWaterfall = Object.freeze({
    top: Object.freeze([WATERFALL.x, topY, lipZ]),
    curtain: Object.freeze([WATERFALL.x, curtainTopY, curtainZ]),
    bottom: Object.freeze([WATERFALL.x, bottomY, bottomZ])
  });
}

export function installMountainR3Polish(world, samples, trackWidth) {
  makeDeepRoadFoundations(world, samples, trackWidth);
  makeVisibleWaterfall(world);
  return world;
}
