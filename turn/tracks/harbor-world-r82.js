import * as THREE from 'three';
import { installHarborWorld as installHarborWorldR81 } from './harbor-world-r81.js?revision=r164-container-batching';

const CONTAINER_SIZE = Object.freeze({ width: 19, height: 7.3, depth: 7.4 });
const RIB_SIZE = Object.freeze({ width: 17.8, height: 6.45, depth: 7.48 });
const SIZE_EPSILON = 0.02;

function boxDimensions(mesh) {
  const parameters = mesh?.geometry?.parameters;
  if (mesh?.geometry?.type !== 'BoxGeometry' || !parameters) return null;
  return {
    width: Number(parameters.width),
    height: Number(parameters.height),
    depth: Number(parameters.depth)
  };
}

function matchesSize(dimensions, target) {
  return dimensions
    && Math.abs(dimensions.width - target.width) <= SIZE_EPSILON
    && Math.abs(dimensions.height - target.height) <= SIZE_EPSILON
    && Math.abs(dimensions.depth - target.depth) <= SIZE_EPSILON;
}

function isContainerShell(mesh) {
  if (!mesh?.isMesh || mesh.isInstancedMesh || !mesh.material) return false;
  const material = Array.isArray(mesh.material) ? null : mesh.material;
  return matchesSize(boxDimensions(mesh), CONTAINER_SIZE)
    && material?.isMeshStandardMaterial === true
    && material.color;
}

function isContainerRibs(mesh) {
  if (!mesh?.isMesh || mesh.isInstancedMesh || !mesh.material) return false;
  const material = Array.isArray(mesh.material) ? null : mesh.material;
  return matchesSize(boxDimensions(mesh), RIB_SIZE)
    && material?.wireframe === true;
}

function disposeDetachedMesh(mesh) {
  mesh.geometry?.dispose?.();
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const material of materials) material?.dispose?.();
}

function batchContainerYards(world) {
  const shellsByColor = new Map();
  const ribs = [];

  // Container-yard pieces are direct children of the Harbor world. Restricting the
  // scan to direct children plus exact source dimensions prevents accidental batching
  // of start gates, buildings or ship geometry that merely happen to be box-shaped.
  for (const child of [...world.children]) {
    if (isContainerShell(child)) {
      const color = child.material.color.getHex(THREE.SRGBColorSpace);
      if (!shellsByColor.has(color)) shellsByColor.set(color, []);
      child.updateMatrix();
      shellsByColor.get(color).push(child);
    } else if (isContainerRibs(child)) {
      child.updateMatrix();
      ribs.push(child);
    }
  }

  const shellCount = [...shellsByColor.values()].reduce((total, entries) => total + entries.length, 0);
  if (!shellCount) return Object.freeze({ shells: 0, ribs: 0, drawGroups: 0 });

  const containerGeometry = new THREE.BoxGeometry(
    CONTAINER_SIZE.width,
    CONTAINER_SIZE.height,
    CONTAINER_SIZE.depth
  );

  let drawGroups = 0;
  for (const [color, entries] of shellsByColor) {
    const sourceMaterial = entries[0].material;
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: sourceMaterial.roughness,
      metalness: sourceMaterial.metalness
    });
    const batch = new THREE.InstancedMesh(containerGeometry, material, entries.length);
    batch.name = `Harbor container batch ${color.toString(16).padStart(6, '0')}`;
    for (let index = 0; index < entries.length; index += 1) {
      batch.setMatrixAt(index, entries[index].matrix);
    }
    batch.instanceMatrix.needsUpdate = true;
    batch.castShadow = true;
    batch.receiveShadow = true;
    world.add(batch);
    drawGroups += 1;
  }

  if (ribs.length) {
    const ribGeometry = new THREE.BoxGeometry(RIB_SIZE.width, RIB_SIZE.height, RIB_SIZE.depth);
    const sourceMaterial = ribs[0].material;
    const ribMaterial = new THREE.MeshBasicMaterial({
      color: sourceMaterial.color?.getHex?.(THREE.SRGBColorSpace) ?? 0x08090a,
      wireframe: true,
      transparent: true,
      opacity: sourceMaterial.opacity,
      depthWrite: sourceMaterial.depthWrite
    });
    const ribBatch = new THREE.InstancedMesh(ribGeometry, ribMaterial, ribs.length);
    ribBatch.name = 'Harbor container rib batch';
    for (let index = 0; index < ribs.length; index += 1) ribBatch.setMatrixAt(index, ribs[index].matrix);
    ribBatch.instanceMatrix.needsUpdate = true;
    world.add(ribBatch);
    drawGroups += 1;
  }

  for (const entries of shellsByColor.values()) {
    for (const mesh of entries) {
      world.remove(mesh);
      disposeDetachedMesh(mesh);
    }
  }
  for (const mesh of ribs) {
    world.remove(mesh);
    disposeDetachedMesh(mesh);
  }

  return Object.freeze({ shells: shellCount, ribs: ribs.length, drawGroups });
}

export function installHarborWorld(options) {
  const world = installHarborWorldR81(options);
  const batching = batchContainerYards(world);
  world.name = 'TURN Harbor r82';
  world.userData.turnHarborArtDirection = Object.freeze({
    ...(world.userData.turnHarborArtDirection || {}),
    version: 'r82',
    containerDrawCallBatching: batching,
    gameplayGeometryUnchanged: true,
    noIndependentAnimationLoop: true
  });
  return world;
}
