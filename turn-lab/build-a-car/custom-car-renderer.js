import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { getPart } from './parts-manifest.js';

const buildKey = globalThis.__TURN_BUILD__?.cacheKey || '';
const sourceCache = new Map();
const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;
const paletteProfiles = Object.freeze({
  'hatchback-sports': Object.freeze({
    primary: [[3, 2], [3, 3]],
    secondary: [[3, 4], [3, 5]],
    accent: []
  }),
  'sedan-sports': Object.freeze({
    primary: [[6, 2], [6, 3]],
    secondary: [[3, 4], [3, 5]],
    accent: [[3, 2], [3, 3]]
  })
});

const loadingManager = new THREE.LoadingManager();
loadingManager.setURLModifier((url) => (
  /(?:^|\/)Textures\/colormap\.png(?:[?#]|$)/i.test(url)
    ? withBuild('/turn/assets/cars/palettes/car-kit.png')
    : url
));
const loader = new GLTFLoader(loadingManager);

export async function createCustomCarVisual(build) {
  const bodyPart = getPart('body', build.parts.body);
  const cabinPart = getPart('cabin', build.parts.cabin);
  const wheelsPart = getPart('wheels', build.parts.wheels);
  const spoilerPart = getPart('spoiler', build.parts.spoiler);
  const roofPart = getPart('roofAccessory', build.parts.roofAccessory);
  const lightsPart = getPart('lights', build.parts.lights);

  const [bodyScene, cabinScene, wheelsScene, spoilerScene] = await Promise.all([
    loadSource(bodyPart.source),
    loadSource(cabinPart.source),
    loadSource(wheelsPart.source),
    spoilerPart.source ? loadSource(spoilerPart.source) : Promise.resolve(null)
  ]);

  const root = new THREE.Group();
  root.name = 'turn-custom-car';
  const assembly = new THREE.Group();
  assembly.name = 'custom-car-assembly';
  root.add(assembly);

  const bodyNode = findMesh(bodyScene, bodyPart.node);
  const cabinNode = findMesh(cabinScene, cabinPart.node);
  const bodyMesh = makeSlicedPart(bodyNode, bodyPart, build.colors, 'body');
  const cabinMesh = makeSlicedPart(cabinNode, cabinPart, build.colors, 'cabin');
  bodyMesh.name = bodyPart.id;
  cabinMesh.name = cabinPart.id;
  assembly.add(bodyMesh, cabinMesh);

  const seam = new THREE.Mesh(
    new THREE.BoxGeometry(1.08, 0.055, 1.18),
    makeSolidMaterial(build.colors.accent, { roughness: 0.62 })
  );
  seam.name = 'cabin-seam-trim';
  seam.position.set(0, 0.64, -0.02);
  assembly.add(seam);
  addOutline(seam, 1.026);
  for (const x of [-0.625, 0.625]) {
    const sideCollar = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.14, 1.3),
      makeSolidMaterial(build.colors.accent, { roughness: 0.62 })
    );
    sideCollar.name = x < 0 ? 'cabin-seam-right' : 'cabin-seam-left';
    sideCollar.position.set(x, 0.64, -0.02);
    assembly.add(sideCollar);
    addOutline(sideCollar, 1.026);
  }

  const wheelAnchors = getWheelAnchors(bodyScene);
  const wheelSource = findFirstMesh(wheelsScene);
  const wheelSpinners = [];
  for (const anchor of wheelAnchors) {
    const wheel = new THREE.Mesh(
      wheelSource.geometry.clone(),
      makePaletteMaterial(wheelSource.material, {
        primaryCells: wheelsPart.rimCells || [],
        secondaryCells: [],
        accentCells: [],
        primaryColor: build.colors.accent,
        secondaryColor: build.colors.secondary,
        accentColor: build.colors.accent,
        cacheKey: `${wheelsPart.id}:rim`
      })
    );
    wheel.name = anchor.name;
    wheel.position.copy(anchor.position);
    if (anchor.position.x < 0) wheel.rotation.y = Math.PI;
    wheel.userData.turnWheelRole = anchor.name;
    assembly.add(wheel);
    addOutline(wheel, 1.045);
    wheelSpinners.push(wheel);
  }

  if (spoilerScene) {
    const source = findStandaloneMesh(spoilerScene, spoilerPart.node);
    const spoiler = new THREE.Mesh(
      source.geometry.clone(),
      makeSolidMaterial(build.colors.accent, { roughness: 0.48 })
    );
    spoiler.name = spoilerPart.id;
    spoiler.scale.setScalar(Number(spoilerPart.scale) || 1);
    spoiler.position.set(0, 0.7, bodyPart.id === 'body-hatch' ? -1.28 : -1.15);
    assembly.add(spoiler);
    addOutline(spoiler, 1.035);
  }

  addRoofAccessory(assembly, roofPart, build.colors);
  addHeadlights(assembly, lightsPart);
  normalizeAssembly(assembly, 5.2);

  root.userData.turnCustomCarBuild = build;
  root.userData.frontWheelPivots = wheelSpinners.filter((wheel) => /front/.test(wheel.name));
  root.userData.wheelSpinners = wheelSpinners;
  return root;
}

export function createCustomCarPreview(host) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d1013);
  scene.fog = new THREE.Fog(0x0d1013, 12, 22);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 1.45));
  renderer.domElement.setAttribute('aria-hidden', 'true');
  renderer.domElement.className = 'build-a-car-canvas';
  host.appendChild(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 50);
  camera.position.set(6.5, 3.45, 7.6);
  camera.lookAt(0, 1.05, 0);

  scene.add(new THREE.HemisphereLight(0xeaf7ff, 0x272d26, 3.6));
  const key = new THREE.DirectionalLight(0xfff1cb, 5.2);
  key.position.set(-5, 8, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x38d9ff, 3.1);
  rim.position.set(6, 4, -6);
  scene.add(rim);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(6.2, 72),
    new THREE.MeshStandardMaterial({ color: 0x252a2e, roughness: 0.96, metalness: 0 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.025;
  scene.add(ground);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(4.3, 4.37, 72),
    new THREE.MeshBasicMaterial({ color: 0xffd43b, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = -0.018;
  scene.add(ring);

  let visual = null;
  let generation = 0;
  let disposed = false;
  let yaw = Math.PI - 0.55;
  let dragPointer = null;
  let dragX = 0;
  let dragYaw = yaw;

  const resize = () => {
    if (disposed) return;
    const rect = host.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  resize();

  renderer.domElement.addEventListener('pointerdown', (event) => {
    dragPointer = event.pointerId;
    dragX = event.clientX;
    dragYaw = yaw;
    renderer.domElement.setPointerCapture?.(event.pointerId);
  });
  renderer.domElement.addEventListener('pointermove', (event) => {
    if (dragPointer !== event.pointerId) return;
    yaw = dragYaw + (event.clientX - dragX) * 0.012;
  });
  const finishDrag = (event) => {
    if (dragPointer !== event.pointerId) return;
    renderer.domElement.releasePointerCapture?.(event.pointerId);
    dragPointer = null;
  };
  renderer.domElement.addEventListener('pointerup', finishDrag);
  renderer.domElement.addEventListener('pointercancel', finishDrag);

  const previewStartedAt = globalThis.performance?.now?.() || Date.now();
  renderer.setAnimationLoop(() => {
    if (disposed) return;
    if (visual) {
      const elapsed = ((globalThis.performance?.now?.() || Date.now()) - previewStartedAt) / 1000;
      const idle = reducedMotion || dragPointer != null ? 0 : Math.sin(elapsed * 0.55) * 0.08;
      visual.rotation.y = yaw + idle;
    }
    renderer.render(scene, camera);
  });

  return Object.freeze({
    async setBuild(build) {
      const request = ++generation;
      host.classList.add('is-loading');
      try {
        const next = await createCustomCarVisual(build);
        if (disposed || request !== generation) {
          disposeCustomCarVisual(next);
          return;
        }
        if (visual) {
          scene.remove(visual);
          disposeCustomCarVisual(visual);
        }
        visual = next;
        visual.rotation.y = yaw;
        scene.add(visual);
      } finally {
        if (request === generation) host.classList.remove('is-loading');
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      generation += 1;
      resizeObserver.disconnect();
      renderer.setAnimationLoop(null);
      if (visual) disposeCustomCarVisual(visual);
      renderer.dispose();
      renderer.domElement.remove();
    }
  });
}

export function disposeCustomCarVisual(root) {
  root?.traverse?.((node) => {
    if (!node.isMesh) return;
    node.geometry?.dispose?.();
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) material?.dispose?.();
  });
  root?.removeFromParent?.();
}

function makeSlicedPart(node, part, colors, role) {
  const profile = paletteProfiles[part.paintProfile] || { primary: [], secondary: [] };
  const geometry = sliceGeometry(node, part.extraction, part.splitY);
  const material = makePaletteMaterial(node.material, {
    primaryCells: profile.primary,
    secondaryCells: profile.secondary,
    accentCells: profile.accent,
    primaryColor: role === 'cabin' ? colors.secondary : colors.primary,
    secondaryColor: role === 'cabin' ? colors.accent : colors.secondary,
    accentColor: colors.accent,
    cacheKey: `${part.id}:${role}`
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  addOutline(mesh, 1.022);
  return mesh;
}

function sliceGeometry(node, extraction, splitY) {
  node.updateWorldMatrix(true, false);
  const source = node.geometry;
  const positions = source.getAttribute('position');
  const normals = source.getAttribute('normal');
  const uvs = source.getAttribute('uv');
  const index = source.index;
  const matrix = node.matrixWorld;
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix);
  const outputPositions = [];
  const outputNormals = [];
  const outputUvs = [];
  const triangleCount = Math.floor((index?.count || positions.count) / 3);

  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const vertexIndexes = [0, 1, 2].map((offset) => (
      index ? index.getX(triangle * 3 + offset) : triangle * 3 + offset
    ));
    const sourceTriangle = vertexIndexes.map((vertexIndex) => ({
      position: new THREE.Vector3().fromBufferAttribute(positions, vertexIndex).applyMatrix4(matrix),
      normal: normals
        ? new THREE.Vector3().fromBufferAttribute(normals, vertexIndex).applyNormalMatrix(normalMatrix)
        : null,
      uv: uvs ? new THREE.Vector2(uvs.getX(vertexIndex), uvs.getY(vertexIndex)) : null
    }));
    const polygon = clipPolygonAtY(sourceTriangle, extraction, splitY);
    for (let cursor = 1; cursor < polygon.length - 1; cursor += 1) {
      for (const vertex of [polygon[0], polygon[cursor], polygon[cursor + 1]]) {
        outputPositions.push(vertex.position.x, vertex.position.y, vertex.position.z);
        if (vertex.normal) outputNormals.push(vertex.normal.x, vertex.normal.y, vertex.normal.z);
        if (vertex.uv) outputUvs.push(vertex.uv.x, vertex.uv.y);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(outputPositions, 3));
  if (outputNormals.length) geometry.setAttribute('normal', new THREE.Float32BufferAttribute(outputNormals, 3));
  else geometry.computeVertexNormals();
  if (outputUvs.length) geometry.setAttribute('uv', new THREE.Float32BufferAttribute(outputUvs, 2));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function clipPolygonAtY(vertices, extraction, splitY) {
  const inside = extraction === 'upper'
    ? (vertex) => vertex.position.y >= splitY - 1e-6
    : (vertex) => vertex.position.y <= splitY + 1e-6;
  const output = [];
  for (let index = 0; index < vertices.length; index += 1) {
    const current = vertices[index];
    const next = vertices[(index + 1) % vertices.length];
    const currentInside = inside(current);
    const nextInside = inside(next);
    if (currentInside && nextInside) {
      output.push(cloneVertex(next));
    } else if (currentInside && !nextInside) {
      output.push(intersectionAtY(current, next, splitY));
    } else if (!currentInside && nextInside) {
      output.push(intersectionAtY(current, next, splitY), cloneVertex(next));
    }
  }
  return output;
}

function intersectionAtY(from, to, y) {
  const denominator = to.position.y - from.position.y;
  const alpha = Math.abs(denominator) < 1e-8 ? 0 : (y - from.position.y) / denominator;
  return {
    position: from.position.clone().lerp(to.position, alpha),
    normal: from.normal && to.normal ? from.normal.clone().lerp(to.normal, alpha).normalize() : null,
    uv: from.uv && to.uv ? from.uv.clone().lerp(to.uv, alpha) : null
  };
}

function cloneVertex(vertex) {
  return {
    position: vertex.position.clone(),
    normal: vertex.normal?.clone() || null,
    uv: vertex.uv?.clone() || null
  };
}

function getWheelAnchors(scene) {
  scene.updateMatrixWorld(true);
  const anchors = [];
  scene.traverse((node) => {
    if (!/^wheel-(?:front|back)-(?:left|right)$/i.test(node.name || '')) return;
    anchors.push({ name: node.name.toLowerCase(), position: node.getWorldPosition(new THREE.Vector3()) });
  });
  return anchors.sort((a, b) => a.name.localeCompare(b.name));
}

function addRoofAccessory(assembly, part, colors) {
  if (!part?.procedural) return;
  if (part.procedural === 'taxi-sign') {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.18, 0.17),
      makeSolidMaterial(colors.accent, { roughness: 0.44, emissive: colors.accent, emissiveIntensity: 0.32 })
    );
    sign.name = 'roof-taxi-sign';
    sign.position.set(0, 1.17, -0.03);
    assembly.add(sign);
    addOutline(sign, 1.045);
    return;
  }

  const bar = new THREE.Group();
  bar.name = 'roof-emergency-lightbar';
  bar.position.set(0, 1.16, -0.03);
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(0.82, 0.07, 0.17),
    makeSolidMaterial('#17191c', { roughness: 0.78 })
  );
  const red = makeLamp('#ff3158');
  const blue = makeLamp('#2ab7ff');
  red.position.x = -0.22;
  blue.position.x = 0.22;
  red.position.y = blue.position.y = 0.075;
  bar.add(base, red, blue);
  assembly.add(bar);
  addOutline(base, 1.035);
}

function addHeadlights(assembly, part) {
  const material = new THREE.MeshStandardMaterial({
    color: 0xeaf8ff,
    emissive: 0xbceeff,
    emissiveIntensity: 1.25,
    roughness: 0.2,
    metalness: 0
  });
  if (part?.procedural === 'light-strip') {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.085, 0.05), material);
    strip.name = 'front-light-strip';
    strip.position.set(0, 0.45, 1.405);
    assembly.add(strip);
    return;
  }
  for (const x of [-0.42, 0.42]) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.11, 18, 12), material.clone());
    lamp.name = x < 0 ? 'headlight-right' : 'headlight-left';
    lamp.scale.z = 0.36;
    lamp.position.set(x, 0.44, 1.39);
    assembly.add(lamp);
  }
}

function makeLamp(color) {
  return new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.12, 0.15),
    makeSolidMaterial(color, { roughness: 0.18, emissive: color, emissiveIntensity: 0.92 })
  );
}

function normalizeAssembly(assembly, targetLength) {
  assembly.updateMatrixWorld(true);
  const initialBounds = new THREE.Box3().setFromObject(assembly);
  const initialSize = initialBounds.getSize(new THREE.Vector3());
  const scale = targetLength / Math.max(0.001, initialSize.z);
  assembly.scale.setScalar(scale);
  assembly.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(assembly);
  const center = bounds.getCenter(new THREE.Vector3());
  assembly.position.x -= center.x;
  assembly.position.z -= center.z;
  assembly.position.y -= bounds.min.y;
  assembly.updateMatrixWorld(true);
}

function addOutline(mesh, scale) {
  const outline = new THREE.Mesh(
    mesh.geometry,
    new THREE.MeshBasicMaterial({
      color: 0x060708,
      side: THREE.BackSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1
    })
  );
  outline.name = `${mesh.name || 'part'}-outline`;
  outline.scale.setScalar(scale);
  outline.userData.turnOutline = true;
  mesh.add(outline);
}

function makePaletteMaterial(source, {
  primaryCells,
  secondaryCells,
  accentCells,
  primaryColor,
  secondaryColor,
  accentColor,
  cacheKey
}) {
  const base = Array.isArray(source) ? source[0] : source;
  const material = base.clone();
  material.color?.set(0xffffff);
  material.side = THREE.DoubleSide;
  if ('roughness' in material) material.roughness = Math.max(Number(material.roughness) || 0, 0.72);
  const uniforms = {
    turnBuildPrimary: { value: new THREE.Color(primaryColor) },
    turnBuildSecondary: { value: new THREE.Color(secondaryColor) },
    turnBuildAccent: { value: new THREE.Color(accentColor) }
  };
  const primaryExpression = cellMaskExpression(primaryCells);
  const secondaryExpression = cellMaskExpression(secondaryCells);
  const accentExpression = cellMaskExpression(accentCells);
  material.onBeforeCompile = (shader) => {
    shader.uniforms.turnBuildPrimary = uniforms.turnBuildPrimary;
    shader.uniforms.turnBuildSecondary = uniforms.turnBuildSecondary;
    shader.uniforms.turnBuildAccent = uniforms.turnBuildAccent;
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <map_pars_fragment>',
        '#include <map_pars_fragment>\nuniform vec3 turnBuildPrimary;\nuniform vec3 turnBuildSecondary;\nuniform vec3 turnBuildAccent;'
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>\n#ifdef USE_MAP\n  ivec2 turnBuildCell = ivec2(floor(vMapUv * 8.0));\n  float turnBuildPrimaryMask = clamp(${primaryExpression}, 0.0, 1.0);\n  float turnBuildSecondaryMask = clamp(${secondaryExpression}, 0.0, 1.0);\n  float turnBuildAccentMask = clamp(${accentExpression}, 0.0, 1.0);\n  float turnBuildShade = mod(float(turnBuildCell.y), 2.0) < 0.5 ? 1.08 : 0.82;\n  diffuseColor.rgb = mix(diffuseColor.rgb, turnBuildPrimary * turnBuildShade, turnBuildPrimaryMask);\n  diffuseColor.rgb = mix(diffuseColor.rgb, turnBuildSecondary * turnBuildShade, turnBuildSecondaryMask);\n  diffuseColor.rgb = mix(diffuseColor.rgb, turnBuildAccent * turnBuildShade, turnBuildAccentMask);\n#endif`
      );
  };
  material.customProgramCacheKey = () => `turn-build-a-car:${cacheKey}:${primaryExpression}:${secondaryExpression}:${accentExpression}`;
  material.needsUpdate = true;
  return material;
}

function makeSolidMaterial(color, {
  roughness = 0.7,
  emissive = '#000000',
  emissiveIntensity = 0
} = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity,
    roughness,
    metalness: 0.04
  });
}

function cellMaskExpression(cells) {
  if (!cells?.length) return '0.0';
  return cells
    .map(([x, y]) => `(all(equal(turnBuildCell, ivec2(${x}, ${y}))) ? 1.0 : 0.0)`)
    .join(' + ');
}

function findMesh(scene, name) {
  const direct = scene.getObjectByName(name);
  if (direct?.isMesh) return direct;
  let found = null;
  scene.traverse((node) => {
    if (!found && node.isMesh && node.name === name) found = node;
  });
  if (!found) throw new Error(`BUILD-A-CAR part node not found: ${name}`);
  return found;
}

function findFirstMesh(scene) {
  let found = null;
  scene.traverse((node) => {
    if (!found && node.isMesh) found = node;
  });
  if (!found) throw new Error('BUILD-A-CAR asset contains no mesh.');
  return found;
}

function findStandaloneMesh(scene, preferredName) {
  const preferred = scene.getObjectByName(preferredName);
  if (preferred?.isMesh) return preferred;
  return findFirstMesh(scene);
}

function loadSource(path) {
  if (!sourceCache.has(path)) {
    sourceCache.set(path, loader.loadAsync(withBuild(path)).then((gltf) => {
      gltf.scene.updateMatrixWorld(true);
      return gltf.scene;
    }));
  }
  return sourceCache.get(path);
}

function withBuild(path) {
  const url = new URL(path, globalThis.location?.href || 'https://enkel.design/turn-lab/');
  if (buildKey) url.searchParams.set('build', buildKey);
  return url.href;
}
