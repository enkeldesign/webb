import { TRACK_IDS } from './catalog-chromatic-r183.js';
import { getStoredBestLap } from '../race/rival-storage.js';

export const CHROMATIC_CAMOUFLAGE_ID = 'chromatic-camouflage';

const COLOR_LIMITS = Object.freeze({
  minSaturation: 0.30,
  minLightness: 0.28,
  maxLightness: 0.85
});

export const TRACK_COLOR_RULES = Object.freeze({
  countryside: Object.freeze({ hueMin: 305, hueMax: 350, name: 'pink' }),
  airport: Object.freeze({ hueMin: 40, hueMax: 65, name: 'yellow' }),
  harbor: Object.freeze({ hueMin: 15, hueMax: 39.999, name: 'orange' }),
  cliffside: Object.freeze({ hueMin: 165, hueMax: 205, name: 'cyan' }),
  'midnight-city': Object.freeze({ hueMin: 240, hueMax: 285, name: 'violet' })
});

function normalizeHex(color) {
  if (typeof color !== 'string') return null;
  const value = color.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(value)) return value;
  if (/^#[0-9a-f]{3}$/.test(value)) {
    return `#${value.slice(1).split('').map((digit) => digit + digit).join('')}`;
  }
  return null;
}

export function hexToHsl(color) {
  const hex = normalizeHex(color);
  if (!hex) return null;

  const channels = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255);
  const [red, green, blue] = channels;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  const lightness = (max + min) / 2;

  let hue = 0;
  let saturation = 0;
  if (delta > 0) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1));
    if (max === red) hue = 60 * (((green - blue) / delta) % 6);
    else if (max === green) hue = 60 * (((blue - red) / delta) + 2);
    else hue = 60 * (((red - green) / delta) + 4);
    if (hue < 0) hue += 360;
  }

  return Object.freeze({ hue, saturation, lightness });
}

export function matchesTrackColor(trackId, color) {
  const rule = TRACK_COLOR_RULES[trackId];
  const hsl = hexToHsl(color);
  if (!rule || !hsl) return false;
  if (hsl.saturation < COLOR_LIMITS.minSaturation) return false;
  if (hsl.lightness < COLOR_LIMITS.minLightness || hsl.lightness > COLOR_LIMITS.maxLightness) return false;
  return hsl.hue >= rule.hueMin && hsl.hue <= rule.hueMax;
}

export function qualifyingChromaticCamouflage(getBestLap = getStoredBestLap) {
  const matches = [];
  for (const trackId of TRACK_IDS) {
    const bestLap = getBestLap(trackId);
    if (!bestLap || !matchesTrackColor(trackId, bestLap.carColor)) return null;
    matches.push(Object.freeze({
      trackId,
      time: Number(bestLap.time),
      carId: bestLap.carId || '',
      carColor: bestLap.carColor
    }));
  }
  return Object.freeze(matches);
}

function achievementContext(matches) {
  const activeTrackId = globalThis.__turnRuntime?.state?.trackId || '';
  const active = matches.find((entry) => entry.trackId === activeTrackId) || matches.at(-1);
  return {
    trackId: active?.trackId || '',
    vehicleId: active?.carId || '',
    time: Number.isFinite(active?.time) ? active.time : null
  };
}

export function installChromaticCamouflageAchievement() {
  if (globalThis.__turnChromaticCamouflage) return globalThis.__turnChromaticCamouflage;

  let achievements = globalThis.__turnAchievements || null;
  let retryTimer = 0;
  let disposed = false;

  const evaluate = () => {
    if (disposed) return false;
    achievements ||= globalThis.__turnAchievements || null;
    if (!achievements?.store || !achievements?.unlock) return false;
    if (achievements.store.isUnlocked(CHROMATIC_CAMOUFLAGE_ID)) return true;
    const matches = qualifyingChromaticCamouflage();
    if (!matches) return false;
    achievements.unlock(CHROMATIC_CAMOUFLAGE_ID, achievementContext(matches));
    return true;
  };

  const scheduleEvaluation = () => globalThis.setTimeout?.(evaluate, 0);
  const retryUntilReady = () => {
    if (disposed || evaluate()) return;
    retryTimer = globalThis.setTimeout?.(retryUntilReady, 100) || 0;
  };

  globalThis.addEventListener?.('turn:lap-result', scheduleEvaluation);
  globalThis.addEventListener?.('turn:home-ready', scheduleEvaluation);
  retryUntilReady();

  const api = Object.freeze({
    evaluate,
    matchesTrackColor,
    disconnect() {
      disposed = true;
      globalThis.clearTimeout?.(retryTimer);
      globalThis.removeEventListener?.('turn:lap-result', scheduleEvaluation);
      globalThis.removeEventListener?.('turn:home-ready', scheduleEvaluation);
      globalThis.__turnChromaticCamouflage = null;
    }
  });
  globalThis.__turnChromaticCamouflage = api;
  return api;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  installChromaticCamouflageAchievement();
}
