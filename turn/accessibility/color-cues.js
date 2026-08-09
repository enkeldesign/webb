export const COLOR_CUES_STORAGE_KEY = 'turn-color-cues-v1';

export const TRACK_COLOR_CUES = Object.freeze({
  countryside: 'pink / magenta',
  airport: 'yellow',
  harbor: 'orange',
  cliffside: 'cyan',
  'midnight-city': 'violet'
});

function normalizeHex(value) {
  const clean = String(value || '').trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(clean)) return clean;
  if (/^#[0-9a-f]{3}$/.test(clean)) {
    return `#${clean.slice(1).split('').map((digit) => digit + digit).join('')}`;
  }
  return null;
}

export function hexToHsl(value) {
  const hex = normalizeHex(value);
  if (!hex) return null;
  const channels = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255);
  const [red, green, blue] = channels;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  const lightness = (max + min) / 2;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  let hue = 0;
  if (delta !== 0) {
    if (max === red) hue = 60 * (((green - blue) / delta) % 6);
    else if (max === green) hue = 60 * (((blue - red) / delta) + 2);
    else hue = 60 * (((red - green) / delta) + 4);
  }
  if (hue < 0) hue += 360;
  return Object.freeze({ hue, saturation, lightness });
}

export function describeColorCue(value) {
  const hsl = hexToHsl(value);
  if (!hsl) return 'custom colour';
  const { hue, saturation, lightness } = hsl;

  if (lightness < 0.09) return 'black';
  if (lightness > 0.94 && saturation < 0.16) return 'white';
  if (saturation < 0.12) {
    if (lightness < 0.32) return 'dark grey';
    if (lightness > 0.72) return 'light grey';
    return 'grey';
  }

  let base;
  if (hue >= 345 || hue < 15) base = lightness > 0.62 ? 'pink' : 'red';
  else if (hue < 42) base = lightness < 0.42 ? 'brown' : 'orange';
  else if (hue < 70) base = 'yellow';
  else if (hue < 105) base = 'yellow green';
  else if (hue < 165) base = 'green';
  else if (hue < 205) base = 'cyan';
  else if (hue < 250) base = 'blue';
  else if (hue < 285) base = 'violet';
  else if (hue < 330) base = 'magenta';
  else base = 'pink';

  if (base === 'brown') return lightness < 0.28 ? 'dark brown' : 'brown';
  if (lightness < 0.28) return `dark ${base}`;
  if (lightness > 0.78) return `light ${base}`;
  return base;
}

export function trackColorCue(trackId) {
  return TRACK_COLOR_CUES[trackId] || '';
}

export function loadColorCuesEnabled(storage = globalThis.localStorage) {
  try {
    return storage?.getItem?.(COLOR_CUES_STORAGE_KEY) === 'true';
  } catch (_) {
    return false;
  }
}

export function saveColorCuesEnabled(enabled, storage = globalThis.localStorage) {
  const value = enabled === true;
  try {
    storage?.setItem?.(COLOR_CUES_STORAGE_KEY, String(value));
  } catch (_) {
    return false;
  }
  applyColorCuesState(value);
  globalThis.dispatchEvent?.(new CustomEvent('turn:color-cues-changed', { detail: { enabled: value } }));
  return true;
}

export function applyColorCuesState(enabled = loadColorCuesEnabled()) {
  const root = globalThis.document?.documentElement;
  if (root) root.dataset.turnColorCues = enabled ? 'on' : 'off';
  return enabled;
}

applyColorCuesState();
