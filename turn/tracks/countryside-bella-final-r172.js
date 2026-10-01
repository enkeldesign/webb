import * as THREE from 'three';

const PREVIOUS_CREAM = new THREE.Color(0xf4eada);
const FINAL_CREAM = new THREE.Color(0xfff8ec);
const SEAL_BROWN = new THREE.Color(0x382c1f);
const FINAL_EYE_HEIGHT_RATIO = 0.5;
const FINAL_EYE_SCALE = 1.1;

function getCatLocalBounds(cat, eyes) {
  cat.updateMatrixWorld(true);
  const bounds = new THREE.Box3().makeEmpty();
  const meshBounds = new THREE.Box3();
  const worldToCat = cat.matrixWorld.clone().invert();
  const meshToCat = new THREE.Matrix4();

  cat.traverse((node) => {
    if (!node.isMesh || eyes.includes(node) || !node.geometry) return;
    if (!node.geometry.boundingBox) node.geometry.computeBoundingBox();
    if (!node.geometry.boundingBox) return;

    meshToCat.multiplyMatrices(worldToCat, node.matrixWorld);
    meshBounds.copy(node.geometry.boundingBox).applyMatrix4(meshToCat);
    bounds.union(meshBounds);
  });

  return bounds;
}

// THREE.Color has no vector maths (lengthSq, dot, distanceTo), so the coat
// projection works on plain RGB triples.
const rgbDot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const rgbDifference = (a, b) => [a.r - b.r, a.g - b.g, a.b - b.b];

function remapCoatVertexColors(cat, eyes) {
  const coatVector = rgbDifference(SEAL_BROWN, PREVIOUS_CREAM);
  const coatLengthSquared = Math.max(rgbDot(coatVector, coatVector), Number.EPSILON);
  const source = new THREE.Color();
  const remapped = new THREE.Color();

  cat.traverse((node) => {
    if (!node.isMesh || eyes.includes(node)) return;

    const colors = node.geometry?.attributes?.color;
    if (colors && node.material?.vertexColors) {
      for (let index = 0; index < colors.count; index += 1) {
        source.fromBufferAttribute(colors, index);
        const offset = rgbDifference(source, PREVIOUS_CREAM);
        const darkMix = THREE.MathUtils.clamp(rgbDot(offset, coatVector) / coatLengthSquared, 0, 1);
        remapped.copy(FINAL_CREAM).lerp(SEAL_BROWN, darkMix);
        colors.setXYZ(index, remapped.r, remapped.g, remapped.b);
      }
      colors.needsUpdate = true;
      return;
    }

    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      if (!material?.color) continue;
      const difference = rgbDifference(material.color, PREVIOUS_CREAM);
      if (Math.sqrt(rgbDot(difference, difference)) < 0.02) {
        material.color.copy(FINAL_CREAM);
        material.needsUpdate = true;
      }
    }
  });
}

export function applyBellaFinalVisuals(root) {
  const cat = root?.userData?.turnBellaFocus;
  if (!cat) return root;

  const eyes = [];
  cat.traverse((node) => {
    if (node.isMesh && node.name?.startsWith('Bella eye')) eyes.push(node);
  });

  const bounds = getCatLocalBounds(cat, eyes);
  if (!bounds.isEmpty()) {
    const size = bounds.getSize(new THREE.Vector3());
    const eyeY = bounds.min.y + size.y * FINAL_EYE_HEIGHT_RATIO;
    for (const eye of eyes) {
      eye.position.y = eyeY;
      eye.scale.multiplyScalar(FINAL_EYE_SCALE);
    }
  }

  remapCoatVertexColors(cat, eyes);

  root.userData.turnBellaFinalVisuals = Object.freeze({
    cream: '#FFF8EC',
    eyeHeight: '50% of model height',
    eyeScale: '10% larger than r171',
    preserved: '#382C1F markings, #44CCFF irises, spacing, foliage and rescue behavior'
  });

  return root;
}
