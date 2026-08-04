import * as THREE from 'three';

const DISPLAY_P3_QUERY = 'color(display-p3 1 0 0)';
const RENDERER_PATCH = Symbol.for('turn.display-p3.renderer-patch');
const P3_ACCENTS_BY_FALLBACK = Object.freeze({
  '#00aabb': Object.freeze([0, 0.68, 0.74]),
  '#38d9ff': Object.freeze([0.05, 0.82, 1]),
  '#5de4ff': Object.freeze([0.16, 0.88, 1]),
  '#2ab7ff': Object.freeze([0.03, 0.62, 1]),
  '#b8f7ff': Object.freeze([0.62, 0.96, 1]),
  '#ff3158': Object.freeze([1, 0.05, 0.22]),
  '#ff4fa3': Object.freeze([1, 0.16, 0.58]),
  '#ffcc00': Object.freeze([1, 0.76, 0]),
  '#ffd43b': Object.freeze([1, 0.79, 0.03]),
  '#ffdc68': Object.freeze([1, 0.82, 0.18]),
  '#9775fa': Object.freeze([0.55, 0.35, 1]),
  '#9d7cff': Object.freeze([0.58, 0.37, 1]),
  '#8ce99a': Object.freeze([0.36, 0.91, 0.48]),
  '#ff6b6b': Object.freeze([1, 0.26, 0.25]),
  '#ff922b': Object.freeze([1, 0.45, 0.05])
});

let cachedSupport;

export function supportsDisplayP3() {
  if (cachedSupport !== undefined) return cachedSupport;
  cachedSupport = Boolean(
    THREE.DisplayP3ColorSpace
    && globalThis.CSS?.supports?.('color', DISPLAY_P3_QUERY)
  );
  return cachedSupport;
}

export function makeWideGamutSpec(fallback, p3 = null) {
  const normalizedFallback = String(fallback || '#000000').toLowerCase();
  return Object.freeze({
    fallback: normalizedFallback,
    p3: Array.isArray(p3) && p3.length === 3
      ? Object.freeze(p3.map((channel) => Math.max(0, Math.min(1, Number(channel) || 0))))
      : (P3_ACCENTS_BY_FALLBACK[normalizedFallback] || null)
  });
}

export function setThreeColor(target, value) {
  if (!target?.set) return target;
  const spec = typeof value === 'string' ? makeWideGamutSpec(value) : value;
  if (supportsDisplayP3() && spec?.p3 && typeof target.setRGB === 'function') {
    target.setRGB(spec.p3[0], spec.p3[1], spec.p3[2], THREE.DisplayP3ColorSpace);
  } else {
    target.set(spec?.fallback || value || '#000000');
  }
  return target;
}

export function threeColorFromSpec(value) {
  return setThreeColor(new THREE.Color(), value);
}

export function configureRendererWideGamut(renderer) {
  if (!renderer) return false;
  renderer.outputColorSpace = supportsDisplayP3()
    ? THREE.DisplayP3ColorSpace
    : THREE.SRGBColorSpace;
  return supportsDisplayP3();
}

export function installWideGamutRendererPatch() {
  const prototype = THREE.WebGLRenderer?.prototype;
  if (!prototype || prototype[RENDERER_PATCH]) return false;
  const originalSetSize = prototype.setSize;
  prototype.setSize = function turnWideGamutSetSize(...args) {
    configureRendererWideGamut(this);
    return originalSetSize.apply(this, args);
  };
  Object.defineProperty(prototype, RENDERER_PATCH, { value: true });
  return true;
}

function fallbackHex(color) {
  if (!color?.getHexString) return '';
  try {
    return `#${color.getHexString(THREE.SRGBColorSpace)}`.toLowerCase();
  } catch (_) {
    return `#${color.getHexString()}`.toLowerCase();
  }
}

function enhanceColor(color) {
  const fallback = fallbackHex(color);
  const p3 = P3_ACCENTS_BY_FALLBACK[fallback];
  if (!p3) return false;
  setThreeColor(color, makeWideGamutSpec(fallback, p3));
  return true;
}

export function enhanceWideGamutScene(root) {
  if (!root || !supportsDisplayP3()) return 0;
  let enhanced = 0;
  root.traverse?.((node) => {
    if (node?.isLight && enhanceColor(node.color)) enhanced += 1;
    if (!node?.material) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      let materialEnhanced = false;
      if (enhanceColor(material?.color)) {
        enhanced += 1;
        materialEnhanced = true;
      }
      if (enhanceColor(material?.emissive)) {
        enhanced += 1;
        materialEnhanced = true;
      }
      if (materialEnhanced) material.needsUpdate = true;
    }
  });
  return enhanced;
}

export function installWideGamutRuntime(runtime = globalThis.__turnRuntime) {
  if (!runtime || globalThis.__turnWideGamutRuntime) {
    return globalThis.__turnWideGamutRuntime || null;
  }

  installWideGamutRendererPatch();
  const apply = () => {
    configureRendererWideGamut(runtime.renderer);
    enhanceWideGamutScene(runtime.scene || runtime.world);
    document.documentElement.dataset.turnColorGamut = supportsDisplayP3() ? 'display-p3' : 'srgb';
  };

  const scheduleApply = () => {
    apply();
    requestAnimationFrame(apply);
    globalThis.setTimeout?.(apply, 180);
    globalThis.setTimeout?.(apply, 900);
  };

  window.addEventListener('turn:track-changed', scheduleApply);
  scheduleApply();

  const api = Object.freeze({
    supported: supportsDisplayP3(),
    apply,
    disconnect() {
      window.removeEventListener('turn:track-changed', scheduleApply);
    }
  });
  globalThis.__turnWideGamutRuntime = api;
  return api;
}
