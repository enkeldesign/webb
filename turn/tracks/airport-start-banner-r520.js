import * as THREE from 'three';

const REVISION = 'r520-airport-start-banner-yellow';
const TURN_YELLOW = 0xffbd12;

function materialEntries(material) {
  return Array.isArray(material) ? material : [material];
}

function isOutlineMaterial(material) {
  return materialEntries(material).some((entry) => entry?.side === THREE.BackSide);
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

function findStartBannerSurface(gate, trackWidth) {
  let match = null;
  gate?.traverse?.((node) => {
    if (match || !node?.isMesh || isOutlineMaterial(node.material)) return;
    const box = boxParameters(node);
    if (!box) return;
    if (
      box.width >= trackWidth + 5
      && box.height >= 2.1 && box.height <= 2.7
      && box.depth >= 1.8 && box.depth <= 2.3
    ) {
      match = node;
    }
  });
  return match;
}

export function applyAirportStartBannerYellow(world, trackWidth = 27) {
  const gate = world?.getObjectByName?.('TURN Airport Start Finish');
  if (!gate) return false;

  const banner = findStartBannerSurface(gate, trackWidth);
  if (!banner) return false;
  if (banner.userData.turnAirportStartBannerYellow === REVISION) return true;

  for (const oldMaterial of materialEntries(banner.material)) oldMaterial?.dispose?.();
  banner.material = new THREE.MeshBasicMaterial({
    color: TURN_YELLOW,
    toneMapped: false
  });
  banner.material.needsUpdate = true;
  banner.name = 'Airport signature yellow start banner';
  banner.userData.turnAirportStartBannerYellow = REVISION;
  gate.userData.turnAirportStartBannerYellow = REVISION;
  return true;
}

function polishRuntime(runtime, fallbackTrackId = '') {
  if (!runtime) return;
  const trackId = globalThis.__turnGetTrackId?.() || runtime.trackId || fallbackTrackId;
  if (trackId !== 'airport') return;
  applyAirportStartBannerYellow(runtime.activeWorld, runtime.trackWidth || 27);
}

function bootstrap() {
  if (globalThis.__turnRuntime) polishRuntime(globalThis.__turnRuntime);
  else {
    window.addEventListener('turn:runtime-ready', (event) => {
      polishRuntime(event.detail || globalThis.__turnRuntime);
    }, { once: true });
  }

  window.addEventListener('turn:track-changed', (event) => {
    polishRuntime(globalThis.__turnRuntime, event?.detail?.trackId || '');
  });
}

if (typeof window !== 'undefined') bootstrap();
