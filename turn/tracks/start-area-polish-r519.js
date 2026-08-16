import * as THREE from 'three';

const REVISION = 'r519-start-area-consistency';
const INK = 0x08090a;
const TURN_YELLOW = 0xffbd12;
const FLAG_RECHECK_DELAYS_MS = Object.freeze([0, 220, 700, 1600, 3200]);
const scheduledFlagCleanup = new WeakMap();

function currentTrackId(runtime, fallback = '') {
  return globalThis.__turnGetTrackId?.() || runtime?.trackId || fallback;
}

function activeWorld(runtime, trackId) {
  return runtime?.activeWorld || (trackId === 'countryside' ? runtime?.world : null);
}

function flatYellowMaterial() {
  return new THREE.MeshBasicMaterial({
    color: TURN_YELLOW,
    toneMapped: false
  });
}

function inkOutlineMaterial() {
  return new THREE.MeshBasicMaterial({
    color: INK,
    side: THREE.BackSide,
    toneMapped: false
  });
}

function materialEntries(material) {
  return Array.isArray(material) ? material : [material];
}

function isBackFaceMaterial(material) {
  return materialEntries(material).some((entry) => entry?.side === THREE.BackSide);
}

function replaceSurfaceWithSignatureYellow(mesh) {
  if (!mesh?.isMesh) return false;
  const oldMaterials = materialEntries(mesh.material);
  mesh.material = flatYellowMaterial();
  mesh.material.needsUpdate = true;
  for (const material of oldMaterials) material?.dispose?.();
  mesh.userData.turnSignatureYellow = true;
  return true;
}

function boxParameters(mesh) {
  const parameters = mesh?.geometry?.parameters;
  if (!mesh?.isMesh || mesh.geometry?.type !== 'BoxGeometry' || !parameters) return null;
  return {
    width: Number(parameters.width) || 0,
    height: Number(parameters.height) || 0,
    depth: Number(parameters.depth) || 0
  };
}

function directBoxSurface(root, predicate) {
  for (const child of root?.children || []) {
    if (child?.isMesh) {
      const parameters = boxParameters(child);
      if (parameters && predicate(parameters, child) && !isBackFaceMaterial(child.material)) return child;
      continue;
    }
    for (const mesh of child?.children || []) {
      const parameters = boxParameters(mesh);
      if (parameters && predicate(parameters, mesh) && !isBackFaceMaterial(mesh.material)) return mesh;
    }
  }
  return null;
}

function addInkContour(mesh, scale = 1.05) {
  if (!mesh?.isMesh || mesh.userData.turnStartBannerContour) return false;
  if (mesh.children.some((child) => child.userData?.turnStartBannerContour)) return true;

  const outline = new THREE.Mesh(mesh.geometry, inkOutlineMaterial());
  outline.name = `${mesh.name || 'Start banner'} black contour`;
  outline.scale.setScalar(scale);
  outline.castShadow = false;
  outline.receiveShadow = false;
  outline.userData.turnStartBannerContour = true;
  mesh.add(outline);
  mesh.userData.turnStartBannerContour = true;
  return true;
}

function polishCliffside(world, trackWidth) {
  const arch = world?.getObjectByName?.('Cliffside Start Arch');
  if (!arch) return false;

  const banner = directBoxSurface(arch, ({ width, height, depth }) =>
    width >= trackWidth - 4
    && height >= 2.4 && height <= 3.1
    && depth >= 1.4 && depth <= 2.1
  );
  if (!banner) return false;

  replaceSurfaceWithSignatureYellow(banner);
  banner.name = 'Cliffside signature yellow start banner';
  arch.userData.turnStartAreaPolish = REVISION;
  return true;
}

function polishHarbor(world, trackWidth) {
  const gate = world?.getObjectByName?.('Harbor start gate r81');
  if (!gate) return false;

  const beam = directBoxSurface(gate, ({ width, height, depth }) =>
    width > trackWidth
    && height >= 1.1 && height <= 1.7
    && depth >= 1.0 && depth <= 1.7
  );
  if (!beam) return false;

  replaceSurfaceWithSignatureYellow(beam);
  addInkContour(beam, 1.06);
  beam.name = 'Harbor signature yellow start banner';
  gate.userData.turnStartAreaPolish = REVISION;
  return true;
}

function makeMidnightStartTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 148;
  const context = canvas.getContext('2d');
  const yellow = '#ffbd12';
  const cyan = '#5de4ff';
  const pink = '#ff4fa3';

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = 'rgba(5, 7, 15, 0.72)';
  context.fillRect(5, 5, canvas.width - 10, canvas.height - 10);

  context.shadowColor = yellow;
  context.shadowBlur = 24;
  context.strokeStyle = yellow;
  context.lineWidth = 8;
  context.strokeRect(9, 9, canvas.width - 18, canvas.height - 18);

  context.shadowBlur = 18;
  context.fillStyle = yellow;
  context.font = '900 82px system-ui, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText('MIDNIGHT CITY', canvas.width / 2, canvas.height / 2 + 2);

  context.shadowBlur = 13;
  context.lineWidth = 7;
  context.strokeStyle = cyan;
  context.beginPath();
  context.moveTo(40, 25);
  context.lineTo(165, 25);
  context.stroke();
  context.strokeStyle = pink;
  context.beginPath();
  context.moveTo(canvas.width - 165, canvas.height - 25);
  context.lineTo(canvas.width - 40, canvas.height - 25);
  context.stroke();
  context.shadowBlur = 0;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

function disposeMeshMaterial(mesh) {
  for (const material of materialEntries(mesh?.material)) {
    material?.map?.dispose?.();
    material?.dispose?.();
  }
}

function polishMidnightCity(world, trackWidth) {
  const gate = world?.getObjectByName?.('Midnight City neon start gate');
  if (!gate) return false;

  const beam = directBoxSurface(gate, ({ width, height, depth }) =>
    width > trackWidth
    && height >= 1.0 && height <= 1.4
    && depth >= 0.9 && depth <= 1.3
  );
  if (beam) {
    beam.visible = false;
    beam.userData.turnStartPinkBeamRemoved = true;
  }

  const sign = gate.children.find((child) =>
    child?.isMesh
    && child.geometry?.type === 'PlaneGeometry'
    && materialEntries(child.material).some((material) => material?.map)
  );
  if (!sign) return false;

  sign.geometry?.dispose?.();
  disposeMeshMaterial(sign);
  sign.geometry = new THREE.PlaneGeometry(Math.max(trackWidth + 12, 39), 4.8);
  sign.material = new THREE.MeshBasicMaterial({
    map: makeMidnightStartTexture(),
    transparent: true,
    side: THREE.FrontSide,
    depthWrite: false,
    toneMapped: false
  });
  sign.name = 'Midnight City forward-facing yellow neon start sign';
  sign.position.set(0, 9.7, -0.16);
  sign.rotation.y = Math.PI;
  sign.renderOrder = 4;
  sign.userData.turnStartAreaPolish = REVISION;
  gate.userData.turnStartAreaPolish = REVISION;
  return true;
}

function countrysideFlagCandidates(world, samples, trackWidth) {
  const start = samples?.[0];
  if (!world?.children || !start?.point || !start?.tangent || !start?.normal) return [];

  const box = new THREE.Box3();
  const size = new THREE.Vector3();
  const centre = new THREE.Vector3();
  const delta = new THREE.Vector3();
  const minimumLateral = trackWidth / 2 + 1.5;
  const maximumLateral = trackWidth / 2 + 11.5;
  const candidates = [];

  for (const child of world.children) {
    if (!child?.visible || child.isMesh || child.isInstancedMesh) continue;
    box.setFromObject(child);
    if (box.isEmpty()) continue;
    box.getSize(size);
    box.getCenter(centre);
    delta.copy(centre).sub(start.point);
    const longitudinal = Math.abs(delta.dot(start.tangent));
    const lateral = delta.dot(start.normal);
    const horizontalSpan = Math.max(size.x, size.z);

    if (longitudinal > 36) continue;
    if (Math.abs(lateral) < minimumLateral || Math.abs(lateral) > maximumLateral) continue;
    if (size.y < 8 || size.y > 11.8) continue;
    if (horizontalSpan > 10) continue;

    candidates.push({
      child,
      side: lateral < 0 ? -1 : 1,
      longitudinal,
      startDistance: centre.distanceTo(start.point)
    });
  }

  return candidates;
}

function polishCountryside(world, samples, trackWidth) {
  const candidates = countrysideFlagCandidates(world, samples, trackWidth);
  let hidden = 0;

  for (const side of [-1, 1]) {
    const sideCandidates = candidates
      .filter((candidate) => candidate.side === side)
      .sort((a, b) => a.longitudinal - b.longitudinal || a.startDistance - b.startDistance);
    for (let index = 1; index < sideCandidates.length; index += 1) {
      sideCandidates[index].child.visible = false;
      sideCandidates[index].child.userData.turnExtraStartFlagHidden = REVISION;
      hidden += 1;
    }
  }

  if (candidates.length >= 2) world.userData.turnStartFlagCandidates = candidates.length;
  if (hidden > 0) world.userData.turnStartAreaPolish = REVISION;
  return { candidates: candidates.length, hidden };
}

export function applyStartAreaPolish(world, trackId, {
  samples = [],
  trackWidth = 27
} = {}) {
  if (!world) return false;
  if (trackId === 'countryside') return polishCountryside(world, samples, trackWidth).hidden > 0;
  if (trackId === 'cliffside') return polishCliffside(world, trackWidth);
  if (trackId === 'harbor') return polishHarbor(world, trackWidth);
  if (trackId === 'midnight-city') return polishMidnightCity(world, trackWidth);
  return false;
}

function scheduleCountrysideCleanup(runtime) {
  const world = activeWorld(runtime, 'countryside');
  if (!world || scheduledFlagCleanup.has(world)) return;

  const timers = FLAG_RECHECK_DELAYS_MS.map((delay) => setTimeout(() => {
    if (activeWorld(runtime, currentTrackId(runtime, 'countryside')) !== world) return;
    if (currentTrackId(runtime, 'countryside') !== 'countryside') return;
    polishCountryside(world, runtime?.samples || [], runtime?.trackWidth || 27);
  }, delay));
  scheduledFlagCleanup.set(world, timers);
}

function polishRuntime(runtime, fallbackTrackId = '') {
  if (!runtime) return;
  const trackId = currentTrackId(runtime, fallbackTrackId);
  const world = activeWorld(runtime, trackId);
  applyStartAreaPolish(world, trackId, {
    samples: runtime.samples || [],
    trackWidth: runtime.trackWidth || 27
  });
  if (trackId === 'countryside') scheduleCountrysideCleanup(runtime);
}

function bootstrap() {
  if (globalThis.__turnRuntime) polishRuntime(globalThis.__turnRuntime, 'countryside');
  else {
    window.addEventListener('turn:runtime-ready', (event) => {
      polishRuntime(event.detail || globalThis.__turnRuntime, 'countryside');
    }, { once: true });
  }

  window.addEventListener('turn:track-changed', (event) => {
    polishRuntime(globalThis.__turnRuntime, event?.detail?.trackId || '');
  });
}

if (typeof window !== 'undefined') bootstrap();
