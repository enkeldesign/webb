import * as THREE from 'three';

const LEARNER_CAR_ID = 'classic';
const LEARNER_YELLOW = new THREE.Color('#ffcc00');
const LEARNER_INK = new THREE.Color('#08090a');
const SIGN_FACE_TEXTURE_SIZE = 128;

// Exact Taxi roof-sign geometry from Kenney Car Kit 3.1 `taxi.obj`.
// These are the original eight authored positions and ten authored triangles
// (OBJ vertices 367–370 and 375–378). PR #690 removed only this geometry from
// the vendored Taxi body. Keeping the source coordinates here restores Kenney's
// sign exactly; no replacement/procedural sign shape is introduced.
const KENNEY_TAXI_SIGN_POSITIONS = Object.freeze([
  Object.freeze([-0.1, 1.3, -0.45]), // 367
  Object.freeze([0.1, 1.3, -0.45]),  // 368
  Object.freeze([-0.1, 1.3, 0.05]),  // 369
  Object.freeze([0.1, 1.3, 0.05]),   // 370
  Object.freeze([0.05, 1.5, 0.05]),  // 375
  Object.freeze([-0.05, 1.5, 0.05]), // 376
  Object.freeze([0.05, 1.5, -0.45]), // 377
  Object.freeze([-0.05, 1.5, -0.45]) // 378
]);

// Same order as the ten source triangles in Kenney's Taxi OBJ.
const KENNEY_TAXI_SIGN_TRIANGLES = Object.freeze([
  Object.freeze([4, 2, 3]),
  Object.freeze([2, 4, 5]),
  Object.freeze([4, 1, 6]),
  Object.freeze([1, 4, 3]),
  Object.freeze([7, 1, 0]),
  Object.freeze([1, 7, 6]),
  Object.freeze([7, 4, 6]),
  Object.freeze([4, 7, 5]),
  Object.freeze([2, 7, 0]),
  Object.freeze([7, 2, 5])
]);

// Broad sign faces in the source triangle list: +X (2,3) and -X (8,9).
const SIGN_GRAPHIC_TRIANGLES = new Set([2, 3, 8, 9]);
let signFaceTexture = null;

export function installLearnerCarLivery(model, car, { ghost = false } = {}) {
  if (!model?.isObject3D || car?.id !== LEARNER_CAR_ID) return null;
  if (model.userData?.turnLearnerCarLiveryInstalled) return model.userData.turnLearnerCarSign || null;

  installDoorLearnerMarks(model);
  const sign = createAuthenticKenneyTaxiSign({ ghost });
  model.add(sign);

  model.userData.turnLearnerCarLiveryInstalled = true;
  model.userData.turnLearnerCarSign = sign;
  model.userData.turnLearnerCarSignSource = 'Kenney Car Kit 3.1 taxi.obj vertices 367-370, 375-378';
  return sign;
}

function installDoorLearnerMarks(model) {
  model.traverse((node) => {
    if (!node?.isMesh || !node.material || String(node.name || '').toLowerCase() !== 'body') return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) installDoorMarkShader(material);
  });
}

function installDoorMarkShader(material) {
  if (!material || material.userData?.turnLearnerDoorMark) return;
  const previousCompile = material.onBeforeCompile;
  const previousCacheKey = material.customProgramCacheKey?.bind(material);
  const uniforms = {
    turnLearnerYellow: { value: LEARNER_YELLOW.clone() },
    turnLearnerInk: { value: LEARNER_INK.clone() }
  };

  material.onBeforeCompile = (shader, renderer) => {
    previousCompile?.(shader, renderer);
    shader.uniforms.turnLearnerYellow = uniforms.turnLearnerYellow;
    shader.uniforms.turnLearnerInk = uniforms.turnLearnerInk;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 turnLearnerLocalPosition;\nvarying vec3 turnLearnerLocalNormal;'
      )
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nturnLearnerLocalPosition = position;\nturnLearnerLocalNormal = normal;'
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 turnLearnerLocalPosition;\nvarying vec3 turnLearnerLocalNormal;\nuniform vec3 turnLearnerYellow;\nuniform vec3 turnLearnerInk;'
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        // Fixed learner identifier on the authored Taxi door surface. This changes
        // fragment colour only; the Kenney body mesh remains untouched.
        float turnLearnerSideFacing = smoothstep(0.72, 0.92, abs(normalize(turnLearnerLocalNormal).x));
        float turnLearnerRawU = (turnLearnerLocalPosition.z + 0.34) / 0.76;
        float turnLearnerU = turnLearnerLocalPosition.x >= 0.0 ? turnLearnerRawU : 1.0 - turnLearnerRawU;
        float turnLearnerV = (turnLearnerLocalPosition.y - 0.36) / 0.28;
        float turnLearnerInside = turnLearnerSideFacing
          * step(0.0, turnLearnerU) * step(turnLearnerU, 1.0)
          * step(0.0, turnLearnerV) * step(turnLearnerV, 1.0);
        float turnLearnerInner = step(0.055, turnLearnerU) * step(turnLearnerU, 0.945)
          * step(0.10, turnLearnerV) * step(turnLearnerV, 0.90);
        float turnLearnerBorder = turnLearnerInside * (1.0 - turnLearnerInner);
        float turnLearnerLStem = step(0.34, turnLearnerU) * step(turnLearnerU, 0.44)
          * step(0.25, turnLearnerV) * step(turnLearnerV, 0.74);
        float turnLearnerLFoot = step(0.34, turnLearnerU) * step(turnLearnerU, 0.67)
          * step(0.22, turnLearnerV) * step(turnLearnerV, 0.33);
        float turnLearnerGlyph = turnLearnerInside * clamp(turnLearnerLStem + turnLearnerLFoot, 0.0, 1.0);
        diffuseColor.rgb = mix(diffuseColor.rgb, turnLearnerYellow, turnLearnerInside);
        diffuseColor.rgb = mix(diffuseColor.rgb, turnLearnerInk, max(turnLearnerBorder, turnLearnerGlyph));`
      );
  };
  material.customProgramCacheKey = () => `${previousCacheKey?.() || ''}|turn-learner-door-livery-v1`;
  material.userData.turnLearnerDoorMark = { uniforms };
  material.needsUpdate = true;
}

function createAuthenticKenneyTaxiSign({ ghost }) {
  const positions = [];
  const uvs = [];
  const groups = [];

  KENNEY_TAXI_SIGN_TRIANGLES.forEach((triangle, triangleIndex) => {
    const start = positions.length / 3;
    for (const vertexIndex of triangle) positions.push(...KENNEY_TAXI_SIGN_POSITIONS[vertexIndex]);

    if (triangleIndex === 2) uvs.push(0, 0, 1, 0, 1, 1);
    else if (triangleIndex === 3) uvs.push(1, 0, 0, 1, 0, 0);
    else if (triangleIndex === 8) uvs.push(1, 0, 0, 1, 0, 0);
    else if (triangleIndex === 9) uvs.push(0, 1, 1, 0, 1, 1);
    else uvs.push(0, 0, 0, 0, 0, 0);

    groups.push({ start, count: 3, materialIndex: SIGN_GRAPHIC_TRIANGLES.has(triangleIndex) ? 1 : 0 });
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  for (const group of groups) geometry.addGroup(group.start, group.count, group.materialIndex);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  const yellowMaterial = new THREE.MeshStandardMaterial({
    color: ghost ? '#f2ca36' : '#ffcc00',
    roughness: 0.78,
    metalness: 0
  });
  yellowMaterial.name = 'learner-sign-yellow';

  const faceMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: getLearnerSignFaceTexture(),
    roughness: 0.78,
    metalness: 0
  });
  faceMaterial.name = 'learner-sign-l-face';

  const sign = new THREE.Mesh(geometry, [yellowMaterial, faceMaterial]);
  sign.name = 'kenney-taxi-roof-sign-learner-livery';
  sign.castShadow = !ghost;
  sign.receiveShadow = true;
  sign.userData.turnSourceGeometry = 'Kenney Car Kit 3.1 Taxi roof sign';
  sign.userData.turnFixedLearnerLivery = true;
  return sign;
}

function getLearnerSignFaceTexture() {
  if (signFaceTexture) return signFaceTexture;

  const size = SIGN_FACE_TEXTURE_SIZE;
  const border = 8;
  const pixels = new Uint8Array(size * size * 4);
  const yellow = [255, 204, 0, 255];
  const ink = [8, 9, 10, 255];

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const edge = x < border || x >= size - border || y < border || y >= size - border;
      const stem = x >= 53 && x <= 67 && y >= 31 && y <= 88;
      const foot = x >= 53 && x <= 88 && y >= 31 && y <= 45;
      const color = edge || stem || foot ? ink : yellow;
      const offset = (y * size + x) * 4;
      pixels[offset] = color[0];
      pixels[offset + 1] = color[1];
      pixels[offset + 2] = color[2];
      pixels[offset + 3] = color[3];
    }
  }

  signFaceTexture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  signFaceTexture.name = 'learner-car-yellow-black-l';
  signFaceTexture.colorSpace = THREE.SRGBColorSpace;
  signFaceTexture.magFilter = THREE.NearestFilter;
  signFaceTexture.minFilter = THREE.LinearMipmapLinearFilter;
  signFaceTexture.generateMipmaps = true;
  signFaceTexture.flipY = false;
  signFaceTexture.needsUpdate = true;
  return signFaceTexture;
}

export const LEARNER_CAR_KENNEY_SIGN_CONTRACT = Object.freeze({
  positions: KENNEY_TAXI_SIGN_POSITIONS,
  triangles: KENNEY_TAXI_SIGN_TRIANGLES,
  sourceVertexIds: Object.freeze([367, 368, 369, 370, 375, 376, 377, 378]),
  sourceTriangleCount: 10
});
