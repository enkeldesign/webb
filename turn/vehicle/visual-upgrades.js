import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { setThreeColor } from './wide-gamut.js?revision=r157-display-p3';

const OUTLINE_COLOR = 0x08090a;
const FACTORY_FINISH = 'factory-finish-v1';
const RALLY_COMPETITION_KIT = 'rally-competition';
const installers = Object.freeze({
  [RALLY_COMPETITION_KIT]: installRallyCompetitionKit
});

// These recipes describe the cabin and lamp locations in normalized body
// coordinates. Placement is then snapped to nearby authored vertices, so the
// same recipe survives every target size and rendering surface without
// replacing or editing the source GLB.
const SURFACE_FINISH_PROFILES = Object.freeze({
  convertible: finishProfile({
    windshield: { z: 0.50, y: 0.75, width: 0.74, height: 0.28, topScale: 0.82, tilt: 23 },
    sideWindow: { z: 0.59, y: 0.72, x: 0.29, snap: false, length: 0.25, height: 0.20, topScale: 0.72, topShift: 0.05 },
    lamps: { y: 0.34, spread: 0.30, width: 0.13, height: 0.13, round: true }
  }),
  classic: finishProfile({
    windshield: { z: 0.39, y: 0.75, width: 0.70, height: 0.27, topScale: 0.88, tilt: 12 },
    sideWindow: { z: 0.57, y: 0.74, length: 0.30, height: 0.25, topScale: 0.82, topShift: 0.05 },
    lamps: { y: 0.36, spread: 0.29, width: 0.12, height: 0.15, round: true }
  }),
  'vintage-racer': finishProfile({
    windshield: { z: 0.56, y: 0.82, width: 0.55, height: 0.22, topScale: 0.78, tilt: 28, snap: false },
    sideWindow: { z: 0.61, y: 0.79, x: 0.29, snap: false, length: 0.24, height: 0.18, topScale: 0.70, topShift: 0.03 },
    lamps: { y: 0.31, spread: 0.27, width: 0.14, height: 0.09 },
    accents: [
      { kind: 'top', z: 0.29, y: 0.48, width: 0.16, length: 0.45, height: 0.026 },
      { kind: 'top', z: 0.76, y: 0.60, width: 0.52, length: 0.14, height: 0.03 }
    ]
  }),
  'toy-racer': finishProfile({
    windshield: { z: 0.43, y: 0.68, width: 0.67, height: 0.21, topScale: 0.86, tilt: 18 },
    sideWindow: { z: 0.55, y: 0.67, length: 0.23, height: 0.18, topScale: 0.80, topShift: 0.04 },
    lamps: { y: 0.30, spread: 0.27, width: 0.10, height: 0.07, headlights: false }
  }),
  'monster-truck': finishProfile({
    windshield: { z: 0.32, y: 0.78, width: 0.72, height: 0.24, topScale: 0.90, tilt: 7 },
    sideWindow: { z: 0.53, y: 0.77, length: 0.27, height: 0.21, topScale: 0.84, topShift: 0.04 },
    lamps: { y: 0.52, spread: 0.28, width: 0.13, height: 0.10 },
    accents: [{ kind: 'monster-suspension' }, { kind: 'mirror-caps' }]
  }),
  'race-future': finishProfile({
    windshield: { z: 0.57, y: 0.80, width: 0.50, height: 0.21, topScale: 0.72, tilt: 36, snap: false },
    sideWindow: { z: 0.63, y: 0.77, x: 0.29, snap: false, length: 0.25, height: 0.18, topScale: 0.68, topShift: 0.04 },
    lamps: { y: 0.29, spread: 0.26, width: 0.12, height: 0.07 },
    accents: [
      { kind: 'top', z: 0.29, y: 0.40, width: 0.16, length: 0.48, height: 0.024 },
      { kind: 'top', z: 0.70, y: 0.54, width: 0.54, length: 0.11, height: 0.028 },
      { kind: 'top-pair', z: 0.86, y: 0.48, x: 0.27, width: 0.16, length: 0.20, height: 0.028 }
    ]
  }),
  race: finishProfile({
    windshield: { z: 0.55, y: 0.81, width: 0.50, height: 0.20, topScale: 0.74, tilt: 34, snap: false },
    sideWindow: { z: 0.61, y: 0.78, x: 0.29, snap: false, length: 0.24, height: 0.18, topScale: 0.70, topShift: 0.03 },
    lamps: { y: 0.29, spread: 0.27, width: 0.12, height: 0.07 }
  }),
  'sedan-sports': finishProfile({
    windshield: { z: 0.39, y: 0.75, width: 0.70, height: 0.27, topScale: 0.84, tilt: 27 },
    sideWindow: { z: 0.55, y: 0.75, length: 0.35, height: 0.25, topScale: 0.80, topShift: 0.06 },
    lamps: { y: 0.32, spread: 0.31, width: 0.15, height: 0.075 }
  }),
  sedan: finishProfile({
    windshield: { z: 0.39, y: 0.76, width: 0.70, height: 0.28, topScale: 0.86, tilt: 24 },
    sideWindow: { z: 0.55, y: 0.76, length: 0.37, height: 0.27, topScale: 0.82, topShift: 0.06 },
    lamps: { y: 0.32, spread: 0.31, width: 0.15, height: 0.075 }
  }),
  suv: finishProfile({
    windshield: { z: 0.34, y: 0.75, width: 0.71, height: 0.29, topScale: 0.90, tilt: 16 },
    sideWindow: { z: 0.53, y: 0.75, length: 0.42, height: 0.28, topScale: 0.86, topShift: 0.04 },
    lamps: { y: 0.34, spread: 0.31, width: 0.15, height: 0.08 }
  }),
  firetruck: finishProfile({
    windshield: { z: 0.10, y: 0.72, width: 0.72, height: 0.27, topScale: 0.93, tilt: 4 },
    sideWindow: { z: 0.23, y: 0.72, length: 0.23, height: 0.26, topScale: 0.90, topShift: 0.02 },
    lamps: { y: 0.39, spread: 0.31, width: 0.14, height: 0.11 }
  }),
  police: finishProfile({
    windshield: { z: 0.38, y: 0.75, width: 0.72, height: 0.31, topScale: 0.84, tilt: 25 },
    sideWindow: { z: 0.54, y: 0.75, length: 0.37, height: 0.31, topScale: 0.80, topShift: 0.06 },
    lamps: { y: 0.33, spread: 0.31, width: 0.15, height: 0.08 }
  }),
  ambulance: finishProfile({
    windshield: { z: 0.12, y: 0.68, width: 0.70, height: 0.25, topScale: 0.92, tilt: 8 },
    sideWindow: { z: 0.24, y: 0.68, length: 0.23, height: 0.24, topScale: 0.88, topShift: 0.03 },
    lamps: { y: 0.35, spread: 0.31, width: 0.15, height: 0.09 }
  }),
  truck: finishProfile({
    windshield: { z: 0.32, y: 0.76, width: 0.70, height: 0.28, topScale: 0.86, tilt: 18 },
    sideWindow: { z: 0.46, y: 0.75, length: 0.27, height: 0.26, topScale: 0.82, topShift: 0.05 },
    lamps: { y: 0.31, spread: 0.31, width: 0.15, height: 0.075 }
  }),
  van: finishProfile({
    windshield: { z: 0.13, y: 0.69, width: 0.70, height: 0.27, topScale: 0.92, tilt: 8 },
    sideWindow: { z: 0.27, y: 0.69, length: 0.25, height: 0.25, topScale: 0.88, topShift: 0.03 },
    lamps: { y: 0.34, spread: 0.31, width: 0.15, height: 0.08 }
  })
});

/**
 * Gives every catalog car the same authored finish vocabulary: glass, front
 * and rear lamps, and painted wheel centres. Reward-car secondary accents are
 * recipes in the same pipeline; emergency service paint remains fixed.
 */
export function installVehicleSurfaceFinish({
  root,
  model,
  car,
  primaryColor,
  secondaryColor,
  ghost = false,
  outline = true,
  primaryPaintMaterials = [],
  secondaryPaintMaterials = []
}) {
  const profile = SURFACE_FINISH_PROFILES[car?.id];
  if (!profile || !root || !model) return null;

  model.updateMatrixWorld(true);
  const bodyBounds = boundsForBody(model);
  if (!bodyBounds) return null;
  const size = bodyBounds.getSize(new THREE.Vector3());
  const center = bodyBounds.getCenter(new THREE.Vector3());
  if (!validSize(size)) return null;

  const bodyVertices = collectBodyVertices(model);
  const bodyMeshes = collectBodyMeshes(model);
  const glassGeometry = [];
  const lampGeometry = [];
  const rimGeometry = [];
  const accentGeometry = [];
  addCabinGlass({ profile, bodyBounds, size, center, bodyVertices, glassGeometry });
  addRoadLamps({ profile, bodyBounds, size, center, lampGeometry });
  addWheelRimCenters({ model, bodyBounds, rimGeometry });
  addProfileAccents({ profile, model, bodyBounds, size, center, bodyVertices, bodyMeshes, accentGeometry });

  const glassMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: ghost ? 0.74 : 0.20,
    metalness: ghost ? 0 : 0.08
  });
  setThreeColor(glassMaterial.color, ghost ? primaryColor : '#d4f3ff');
  const lampMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    vertexColors: true,
    toneMapped: false
  });
  const rimMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.34,
    metalness: ghost ? 0 : 0.24
  });
  setThreeColor(rimMaterial.color, primaryColor);
  const accentMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.42,
    metalness: ghost ? 0 : 0.15
  });
  setThreeColor(accentMaterial.color, secondaryColor);

  const group = new THREE.Group();
  group.name = 'turn-factory-surface-finish';
  group.userData.turnVehicleSurfaceFinish = FACTORY_FINISH;
  group.userData.turnVehicleSurfaceProfile = car.id;
  addMergedFeature(group, glassGeometry, glassMaterial, 'factory-glass', outline);
  addMergedFeature(group, lampGeometry, lampMaterial, 'factory-lamps', outline);
  const rims = addMergedFeature(group, rimGeometry, rimMaterial, 'factory-rim-centres', outline);
  const accents = addMergedFeature(group, accentGeometry, accentMaterial, 'factory-secondary-accents', outline);
  if (rims && !car.fixedLivery) primaryPaintMaterials.push(rimMaterial);
  if (accents && car.secondaryPaint && !car.fixedLivery) secondaryPaintMaterials.push(accentMaterial);

  root.add(group);
  root.userData.turnSurfaceFinish = FACTORY_FINISH;
  root.userData.turnSurfaceFinishProfile = car.id;
  return group;
}

function finishProfile({ windshield, sideWindow = null, lamps, accents = [] }) {
  return Object.freeze({
    windshield: Object.freeze({ ...windshield }),
    sideWindow: sideWindow ? Object.freeze({ ...sideWindow }) : null,
    lamps: Object.freeze({ headlights: true, taillights: true, ...lamps }),
    accents: Object.freeze(accents.map((accent) => Object.freeze({ ...accent })))
  });
}

function addCabinGlass({ profile, bodyBounds, size, center, bodyVertices, glassGeometry }) {
  const front = profile.windshield;
  const width = size.x * front.width;
  const height = size.y * front.height;
  const nominalY = bodyBounds.min.y + size.y * front.y;
  const nominalZ = bodyBounds.min.z + size.z * front.z;
  const depth = Math.max(0.018, size.z * 0.008);
  const surfaceZ = front.snap === false ? null : localFrontSurfaceZ(bodyVertices, {
    x: center.x,
    y: nominalY,
    z: nominalZ,
    width,
    height,
    length: size.z * 0.14
  });
  glassGeometry.push(trapezoidPrismGeometry({
    width,
    height,
    topScale: front.topScale,
    topShift: 0,
    depth,
    position: new THREE.Vector3(
      center.x,
      nominalY,
      front.snap === false ? nominalZ : (surfaceZ ?? nominalZ) - depth * 0.62
    ),
    rotation: new THREE.Euler(THREE.MathUtils.degToRad(front.tilt), 0, 0)
  }));

  const side = profile.sideWindow;
  if (!side) return;
  const length = size.z * side.length;
  const sideHeight = size.y * side.height;
  const sideY = bodyBounds.min.y + size.y * side.y;
  const sideZ = bodyBounds.min.z + size.z * side.z;
  const sideDepth = Math.max(0.016, size.x * 0.008);
  const gap = Math.max(0.006, size.x * 0.003);
  for (const direction of [-1, 1]) {
    const surfaceX = side.snap === false ? null : localSideSurfaceX(bodyVertices, {
      direction,
      y: sideY,
      z: sideZ,
      height: sideHeight,
      length
    });
    const fallbackX = center.x + direction * size.x * (side.x ?? 0.42);
    glassGeometry.push(trapezoidPrismGeometry({
      width: length,
      height: sideHeight,
      topScale: side.topScale,
      topShift: length * side.topShift * direction,
      depth: sideDepth,
      position: new THREE.Vector3(
        (surfaceX ?? fallbackX) + direction * (gap + sideDepth * 0.5),
        sideY,
        sideZ
      ),
      rotation: new THREE.Euler(0, direction * Math.PI / 2, 0)
    }));
  }
}

function addRoadLamps({ profile, bodyBounds, size, center, lampGeometry }) {
  const lamps = profile.lamps;
  const depth = Math.max(0.025, size.z * 0.018);
  const width = size.x * lamps.width;
  const height = size.y * lamps.height;
  const headY = bodyBounds.min.y + size.y * lamps.y;
  if (lamps.headlights) {
    for (const direction of [-1, 1]) {
      const position = new THREE.Vector3(
        center.x + direction * size.x * lamps.spread,
        headY,
        bodyBounds.min.z + depth * 0.34
      );
      const geometry = lamps.round
        ? transformedGeometry(
          new THREE.CylinderGeometry(Math.min(width, height) * 0.5, Math.min(width, height) * 0.5, depth, 14),
          position,
          new THREE.Euler(Math.PI / 2, 0, 0)
        )
        : boxGeometry(new THREE.Vector3(width, height, depth), position);
      lampGeometry.push(colorGeometry(geometry, 0xffef9a));
    }
  }

  if (!lamps.taillights) return;
  const tailWidth = width * 0.86;
  const tailHeight = Math.max(height * 0.78, size.y * 0.045);
  const tailY = bodyBounds.min.y + size.y * Math.max(0.30, lamps.y - 0.015);
  for (const direction of [-1, 1]) {
    lampGeometry.push(colorGeometry(boxGeometry(
      new THREE.Vector3(tailWidth, tailHeight, depth),
      new THREE.Vector3(
        center.x + direction * size.x * lamps.spread,
        tailY,
        bodyBounds.max.z - depth * 0.34
      )
    ), 0xff4f5e));
  }
}

function addWheelRimCenters({ model, bodyBounds, rimGeometry }) {
  const bodyCenterX = (bodyBounds.min.x + bodyBounds.max.x) * 0.5;
  model.traverse((node) => {
    if (!node.isMesh || node.userData?.turnOutline || !/wheel|tire|tyre/i.test(node.name || '')) return;
    const bounds = new THREE.Box3().setFromObject(node);
    if (bounds.isEmpty()) return;
    const size = bounds.getSize(new THREE.Vector3());
    if (size.x > Math.min(size.y, size.z) * 0.72) return;
    const center = bounds.getCenter(new THREE.Vector3());
    const radius = Math.max(0.035, Math.min(size.y, size.z) * 0.27);
    const depth = Math.max(0.018, size.x * 0.08);
    const outside = center.x < bodyCenterX
      ? bounds.min.x - depth * 0.54
      : bounds.max.x + depth * 0.54;
    rimGeometry.push(transformedGeometry(
      new THREE.CylinderGeometry(radius, radius, depth, 16),
      new THREE.Vector3(outside, center.y, center.z),
      new THREE.Euler(0, 0, Math.PI / 2)
    ));
  });
}

function addProfileAccents({ profile, model, bodyBounds, size, center, bodyVertices, bodyMeshes, accentGeometry }) {
  for (const accent of profile.accents) {
    if (accent.kind === 'top') {
      addTopAccent({ accent, bodyBounds, size, center, bodyVertices, bodyMeshes, accentGeometry });
    } else if (accent.kind === 'top-pair') {
      for (const direction of [-1, 1]) {
        addTopAccent({
          accent: { ...accent, x: direction * accent.x },
          bodyBounds,
          size,
          center,
          bodyVertices,
          bodyMeshes,
          accentGeometry
        });
      }
    } else if (accent.kind === 'monster-suspension') {
      addMonsterSuspension({ model, bodyBounds, accentGeometry });
    } else if (accent.kind === 'mirror-caps') {
      addMirrorCaps({ bodyBounds, size, center, accentGeometry });
    }
  }
}

function addTopAccent({ accent, bodyBounds, size, center, bodyVertices, bodyMeshes, accentGeometry }) {
  const width = size.x * accent.width;
  const length = size.z * accent.length;
  const height = Math.max(0.018, size.y * accent.height);
  const x = center.x + size.x * (accent.x || 0);
  const z = bodyBounds.min.z + size.z * accent.z;
  const sample = (sampleZ) => raycastTopSurfaceY(bodyMeshes, bodyBounds, x, sampleZ, width)
    ?? localTopSurfaceY(bodyVertices, {
      x,
      z: sampleZ,
      width: Math.max(width * 1.8, size.x * 0.16),
      length: Math.max(length * 0.32, size.z * 0.075)
    });
  const frontY = sample(z - length * 0.42);
  const rearY = sample(z + length * 0.42);
  const fallbackY = bodyBounds.min.y + size.y * (accent.y ?? 0.52);
  const startY = frontY ?? rearY ?? fallbackY;
  const endY = rearY ?? frontY ?? fallbackY;
  const angle = -Math.atan2(endY - startY, length * 0.84);
  accentGeometry.push(transformedGeometry(
    new THREE.BoxGeometry(width, height, length),
    new THREE.Vector3(x, (startY + endY) * 0.5 + height * 0.58, z),
    new THREE.Euler(angle, 0, 0)
  ));
}

function addMonsterSuspension({ model, bodyBounds, accentGeometry }) {
  const center = bodyBounds.getCenter(new THREE.Vector3());
  const bodySize = bodyBounds.getSize(new THREE.Vector3());
  model.traverse((node) => {
    if (!node.isMesh || node.userData?.turnOutline || !/wheel|tire|tyre/i.test(node.name || '')) return;
    const wheel = new THREE.Box3().setFromObject(node);
    if (wheel.isEmpty()) return;
    const wheelSize = wheel.getSize(new THREE.Vector3());
    if (wheelSize.x > Math.min(wheelSize.y, wheelSize.z) * 0.72) return;
    const hub = wheel.getCenter(new THREE.Vector3());
    const side = hub.x < center.x ? -1 : 1;
    const outsideX = side < 0
      ? wheel.min.x - Math.max(0.012, wheelSize.x * 0.06)
      : wheel.max.x + Math.max(0.012, wheelSize.x * 0.06);
    const anchor = new THREE.Vector3(
      outsideX,
      bodyBounds.min.y + bodySize.y * 0.34,
      hub.z + (hub.z < center.z ? 1 : -1) * bodySize.z * 0.075
    );
    const lower = new THREE.Vector3(outsideX, hub.y + wheelSize.y * 0.05, hub.z);
    const radius = Math.max(0.022, bodySize.x * 0.025);
    accentGeometry.push(cylinderBetween(anchor, lower, radius));
    accentGeometry.push(cylinderBetween(
      anchor.clone().add(new THREE.Vector3(0, 0, (hub.z < center.z ? -1 : 1) * bodySize.z * 0.12)),
      lower,
      radius
    ));
  });
}

function addMirrorCaps({ bodyBounds, size, center, accentGeometry }) {
  const mirrorSize = new THREE.Vector3(size.x * 0.16, size.y * 0.08, size.z * 0.10);
  const y = bodyBounds.min.y + size.y * 0.68;
  const z = bodyBounds.min.z + size.z * 0.34;
  for (const direction of [-1, 1]) {
    accentGeometry.push(boxGeometry(
      mirrorSize,
      new THREE.Vector3(center.x + direction * size.x * 0.57, y, z)
    ));
  }
}

function trapezoidPrismGeometry({ width, height, topScale, topShift, depth, position, rotation }) {
  const topWidth = width * topScale;
  const shape = new THREE.Shape([
    new THREE.Vector2(-width * 0.5, -height * 0.5),
    new THREE.Vector2(width * 0.5, -height * 0.5),
    new THREE.Vector2(topShift + topWidth * 0.5, height * 0.5),
    new THREE.Vector2(topShift - topWidth * 0.5, height * 0.5)
  ]);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    curveSegments: 1,
    steps: 1
  });
  geometry.translate(0, 0, -depth * 0.5);
  return transformedGeometry(geometry, position, rotation);
}

function colorGeometry(geometry, colorValue) {
  const color = new THREE.Color(colorValue);
  const count = geometry.getAttribute('position')?.count || 0;
  const colors = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    colors[index * 3] = color.r;
    colors[index * 3 + 1] = color.g;
    colors[index * 3 + 2] = color.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

function collectBodyVertices(model) {
  const vertices = [];
  const point = new THREE.Vector3();
  model.traverse((node) => {
    if (!node.isMesh || node.userData?.turnOutline) return;
    const label = `${node.name || ''} ${node.material?.name || ''}`;
    if (/wheel|tire|tyre/i.test(label)) return;
    const position = node.geometry?.getAttribute?.('position');
    if (!position) return;
    for (let index = 0; index < position.count; index += 1) {
      point.fromBufferAttribute(position, index).applyMatrix4(node.matrixWorld);
      vertices.push(Object.freeze({ x: point.x, y: point.y, z: point.z }));
    }
  });
  return vertices;
}

function collectBodyMeshes(model) {
  const meshes = [];
  model.traverse((node) => {
    if (!node.isMesh || node.userData?.turnOutline) return;
    const label = `${node.name || ''} ${node.material?.name || ''}`;
    if (/wheel|tire|tyre/i.test(label)) return;
    meshes.push(node);
  });
  return meshes;
}

function raycastTopSurfaceY(meshes, bodyBounds, x, z, width) {
  if (!meshes.length) return null;
  const raycaster = new THREE.Raycaster();
  const offsets = [0, -width * 0.28, width * 0.28];
  let best = null;
  for (const offset of offsets) {
    raycaster.set(
      new THREE.Vector3(x + offset, bodyBounds.max.y + 1, z),
      new THREE.Vector3(0, -1, 0)
    );
    const hit = raycaster.intersectObjects(meshes, false)[0];
    if (hit && (best == null || hit.point.y > best)) best = hit.point.y;
  }
  return best;
}

function localFrontSurfaceZ(vertices, { x, y, z, width, height, length }) {
  return median(vertices
    .filter((point) => Math.abs(point.x - x) <= width * 0.64
      && Math.abs(point.y - y) <= height * 0.72
      && Math.abs(point.z - z) <= length)
    .map((point) => point.z));
}

function localSideSurfaceX(vertices, { direction, y, z, height, length }) {
  const candidates = vertices.filter((point) => Math.abs(point.y - y) <= height * 0.72
    && Math.abs(point.z - z) <= length * 0.62)
    .map((point) => point.x);
  if (!candidates.length) return null;
  return direction < 0 ? Math.min(...candidates) : Math.max(...candidates);
}

function localTopSurfaceY(vertices, { x, z, width, length }) {
  const candidates = vertices.filter((point) => Math.abs(point.x - x) <= width * 0.62
    && Math.abs(point.z - z) <= length * 0.62)
    .map((point) => point.y);
  return candidates.length ? Math.max(...candidates) : null;
}

function median(values) {
  if (!values.length) return null;
  values.sort((a, b) => a - b);
  const middle = Math.floor(values.length / 2);
  return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) * 0.5;
}

/**
 * Installs a catalog-selected visual upgrade after the source GLB has been
 * normalized. Upgrade geometry is generated from the painted body and wheel
 * bounds, so one kit stays correctly proportioned in the race, The Lot,
 * Trophy Road cards, thumbnails and ghosts.
 */
export function installVehicleVisualUpgrade({
  root,
  model,
  car,
  secondaryColor,
  ghost = false,
  outline = true,
  secondaryPaintMaterials = []
}) {
  const installer = installers[car?.visualUpgrade];
  if (!installer || !root || !model) return null;

  const group = installer({
    model,
    secondaryColor,
    ghost,
    outline,
    secondaryPaintMaterials
  });
  if (!group) return null;

  root.add(group);
  root.userData.turnVisualUpgrade = car.visualUpgrade;
  return group;
}

function installRallyCompetitionKit({
  model,
  secondaryColor,
  ghost,
  outline,
  secondaryPaintMaterials
}) {
  model.updateMatrixWorld(true);
  const bodyBounds = boundsForBody(model);
  if (!bodyBounds) return null;

  const size = bodyBounds.getSize(new THREE.Vector3());
  const center = bodyBounds.getCenter(new THREE.Vector3());
  if (!validSize(size)) return null;

  const accentMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.38,
    metalness: ghost ? 0 : 0.18
  });
  setThreeColor(accentMaterial.color, secondaryColor);
  secondaryPaintMaterials.push(accentMaterial);

  const darkMaterial = new THREE.MeshStandardMaterial({
    color: ghost ? accentMaterial.color : new THREE.Color(0x11151a),
    roughness: 0.76,
    metalness: ghost ? 0 : 0.12
  });
  const lampMaterial = new THREE.MeshStandardMaterial({
    color: ghost ? accentMaterial.color : new THREE.Color(0xfff4c2),
    emissive: ghost ? accentMaterial.color : new THREE.Color(0xffd56a),
    emissiveIntensity: ghost ? 0 : 0.52,
    roughness: 0.3,
    metalness: 0
  });

  const accentGeometry = [];
  const darkGeometry = [];
  const lampGeometry = [];

  addRallyLampBank({ bodyBounds, size, center, accentGeometry, lampGeometry });
  addBonnetStripes({ bodyBounds, size, center, accentGeometry });
  addCompetitionWing({ bodyBounds, size, center, accentGeometry, darkGeometry });
  addRollHoop({ bodyBounds, size, center, darkGeometry });
  addRockerSteps({ bodyBounds, size, center, accentGeometry });
  addWheelRimAccents({ model, bodyBounds, accentGeometry });

  const group = new THREE.Group();
  group.name = 'turn-rally-competition-kit';
  group.userData.turnVehicleVisualUpgrade = RALLY_COMPETITION_KIT;
  addMergedFeature(group, accentGeometry, accentMaterial, 'rally-accent', outline);
  addMergedFeature(group, darkGeometry, darkMaterial, 'rally-structure', outline);
  addMergedFeature(group, lampGeometry, lampMaterial, 'rally-lamps', outline);
  return group;
}

function addBonnetStripes({ bodyBounds, size, center, accentGeometry }) {
  const stripeSize = new THREE.Vector3(size.x * 0.065, size.y * 0.025, size.z * 0.31);
  const y = bodyBounds.min.y + size.y * 0.575;
  const z = bodyBounds.min.z + size.z * 0.18;
  for (const direction of [-1, 1]) {
    accentGeometry.push(boxGeometry(
      stripeSize,
      new THREE.Vector3(center.x + direction * size.x * 0.11, y, z)
    ));
  }
}

function addRallyLampBank({ bodyBounds, size, center, accentGeometry, lampGeometry }) {
  const radius = Math.min(size.x * 0.075, size.y * 0.115);
  const housingDepth = Math.max(size.z * 0.048, radius * 0.52);
  const lampY = bodyBounds.min.y + size.y * 0.35;
  const housingZ = bodyBounds.min.z - housingDepth * 0.2;
  const lensZ = bodyBounds.min.z - housingDepth * 0.76;

  for (const factor of [-0.3, -0.1, 0.1, 0.3]) {
    const x = center.x + size.x * factor;
    accentGeometry.push(transformedGeometry(
      new THREE.CylinderGeometry(radius * 1.16, radius * 1.16, housingDepth, 16),
      new THREE.Vector3(x, lampY, housingZ),
      new THREE.Euler(Math.PI / 2, 0, 0)
    ));
    lampGeometry.push(transformedGeometry(
      new THREE.CylinderGeometry(radius, radius, housingDepth * 0.18, 16),
      new THREE.Vector3(x, lampY, lensZ),
      new THREE.Euler(Math.PI / 2, 0, 0)
    ));
  }

  accentGeometry.push(boxGeometry(
    new THREE.Vector3(size.x * 0.82, size.y * 0.065, size.z * 0.045),
    new THREE.Vector3(center.x, bodyBounds.min.y + size.y * 0.14, bodyBounds.min.z - size.z * 0.012)
  ));
}

function addCompetitionWing({ bodyBounds, size, center, accentGeometry, darkGeometry }) {
  const wingSize = new THREE.Vector3(size.x * 0.96, size.y * 0.075, size.z * 0.115);
  const wingY = bodyBounds.max.y + wingSize.y * 0.5 + size.y * 0.035;
  const wingZ = bodyBounds.max.z + wingSize.z * 0.1;
  accentGeometry.push(boxGeometry(wingSize, new THREE.Vector3(center.x, wingY, wingZ)));

  const supportSize = new THREE.Vector3(size.x * 0.055, size.y * 0.34, size.z * 0.05);
  const supportY = wingY - wingSize.y * 0.5 - supportSize.y * 0.5;
  for (const direction of [-1, 1]) {
    darkGeometry.push(boxGeometry(
      supportSize,
      new THREE.Vector3(center.x + direction * size.x * 0.27, supportY, wingZ)
    ));
  }
}

function addRollHoop({ bodyBounds, size, center, darkGeometry }) {
  const z = center.z - size.z * 0.045;
  const lowerY = bodyBounds.min.y + size.y * 0.59;
  const topY = bodyBounds.max.y + size.y * 0.025;
  const lowerSpread = size.x * 0.29;
  const topSpread = size.x * 0.255;
  const radius = Math.max(size.x * 0.017, 0.03);
  const lowerLeft = new THREE.Vector3(center.x - lowerSpread, lowerY, z);
  const lowerRight = new THREE.Vector3(center.x + lowerSpread, lowerY, z);
  const topLeft = new THREE.Vector3(center.x - topSpread, topY, z);
  const topRight = new THREE.Vector3(center.x + topSpread, topY, z);
  darkGeometry.push(cylinderBetween(lowerLeft, topLeft, radius));
  darkGeometry.push(cylinderBetween(topLeft, topRight, radius));
  darkGeometry.push(cylinderBetween(topRight, lowerRight, radius));
}

function addRockerSteps({ bodyBounds, size, center, accentGeometry }) {
  const stepSize = new THREE.Vector3(
    Math.max(size.x * 0.025, 0.035),
    size.y * 0.07,
    size.z * 0.29
  );
  const y = bodyBounds.min.y + size.y * 0.16;
  for (const direction of [-1, 1]) {
    accentGeometry.push(boxGeometry(
      stepSize,
      new THREE.Vector3(
        direction < 0
          ? bodyBounds.min.x - stepSize.x * 0.25
          : bodyBounds.max.x + stepSize.x * 0.25,
        y,
        center.z
      )
    ));
  }
}

function addWheelRimAccents({ model, bodyBounds, accentGeometry }) {
  const wheelBounds = [];
  model.traverse((node) => {
    if (!node.isMesh || node.userData?.turnOutline || !/wheel|tire|tyre/i.test(node.name || '')) return;
    const bounds = new THREE.Box3().setFromObject(node);
    if (!bounds.isEmpty()) wheelBounds.push(bounds);
  });

  const bodyCenterX = (bodyBounds.min.x + bodyBounds.max.x) * 0.5;
  for (const bounds of wheelBounds) {
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const radius = Math.max(0.035, Math.min(size.y, size.z) * 0.285);
    const tube = Math.max(0.018, radius * 0.18);
    const outside = center.x < bodyCenterX ? bounds.min.x - tube * 0.2 : bounds.max.x + tube * 0.2;
    accentGeometry.push(transformedGeometry(
      new THREE.TorusGeometry(radius, tube, 7, 16),
      new THREE.Vector3(outside, center.y, center.z),
      new THREE.Euler(0, Math.PI / 2, 0)
    ));
  }
}

function boundsForBody(model) {
  const bounds = new THREE.Box3();
  let found = false;
  model.traverse((node) => {
    if (!node.isMesh || node.userData?.turnOutline) return;
    const label = `${node.name || ''} ${node.material?.name || ''}`;
    if (/wheel|tire|tyre/i.test(label)) return;
    bounds.expandByObject(node);
    found = true;
  });
  return found && !bounds.isEmpty() ? bounds : null;
}

function addMergedFeature(group, geometries, material, name, outline) {
  if (!geometries.length) {
    material.dispose();
    return null;
  }
  const geometry = mergeGeometries(geometries, false);
  for (const source of geometries) source.dispose();
  if (!geometry) {
    material.dispose();
    return null;
  }

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.turnOwnedGeometry = true;
  group.add(mesh);

  if (outline) {
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry, 32),
      new THREE.LineBasicMaterial({ color: OUTLINE_COLOR, toneMapped: false })
    );
    edges.name = `${name}-outline`;
    edges.userData.turnOutline = true;
    edges.userData.turnOwnedGeometry = true;
    edges.renderOrder = 3;
    group.add(edges);
  }
  return mesh;
}

function boxGeometry(size, position) {
  return transformedGeometry(new THREE.BoxGeometry(size.x, size.y, size.z), position);
}

function cylinderBetween(start, end, radius) {
  const direction = end.clone().sub(start);
  const length = direction.length();
  if (length <= 0.0001) return new THREE.BufferGeometry();
  const geometry = new THREE.CylinderGeometry(radius, radius, length, 12);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize()
  );
  const matrix = new THREE.Matrix4().compose(
    start.clone().add(end).multiplyScalar(0.5),
    quaternion,
    new THREE.Vector3(1, 1, 1)
  );
  geometry.applyMatrix4(matrix);
  return geometry;
}

function transformedGeometry(geometry, position, rotation = new THREE.Euler()) {
  const matrix = new THREE.Matrix4().compose(
    position,
    new THREE.Quaternion().setFromEuler(rotation),
    new THREE.Vector3(1, 1, 1)
  );
  geometry.applyMatrix4(matrix);
  return geometry;
}

function validSize(size) {
  return Number.isFinite(size.x) && size.x > 0
    && Number.isFinite(size.y) && size.y > 0
    && Number.isFinite(size.z) && size.z > 0;
}
