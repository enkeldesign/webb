import * as THREE from 'three';

const PREVIOUS_CREAM = new THREE.Color(0xf4eada);
const FINAL_CREAM = new THREE.Color(0xfff8ec);
const SEAL_BROWN = new THREE.Color(0x382c1f);
const FINAL_EYE_HEIGHT_RATIO = 0.5;
const FINAL_EYE_SCALE = 1.1;

function remapCoatVertexColors(cat, eyes) {
  const coatVector = SEAL_BROWN.clone().sub(PREVIOUS_CREAM);
  const coatLengthSquared = Math.max(coatVector.lengthSq(), Number.EPSILON);
  const source = new THREE.Color();
  const remapped = new THREE.Color();
  const offset = new THREE.Color();

  cat.traverse((node) => {
    if (!node.isMesh || eyes.includes(node)) return;

    const colors = node.geometry?.attributes?.color;
    if (colors && node.material?.vertexColors) {
      for (let index = 0; index < colors.count; index += 1) {
        source.fromBufferAttribute(colors, index);
        offset.copy(source).sub(PREVIOUS_CREAM);
        const darkMix = THREE.MathUtils.clamp(offset.dot(coatVector) / coatLengthSquared, 0, 1);
        remapped.copy(FINAL_CREAM).lerp(SEAL_BROWN, darkMix);
        colors.setXYZ(index, remapped.r, remapped.g, remapped.b);
      }
      colors.needsUpdate = true;
      return;
    }

    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      if (!material?.color) continue;
      if (material.color.distanceTo(PREVIOUS_CREAM) < 0.02) {
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

  for (const eye of eyes) eye.visible = false;
  cat.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(cat);
  for (const eye of eyes) eye.visible = true;

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
