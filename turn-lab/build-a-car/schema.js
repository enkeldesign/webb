import {
  CUSTOM_CAR_PERKS,
  CUSTOM_CAR_STAT_ROWS,
  PART_CATEGORIES,
  PARTS_BY_CATEGORY,
  getPart,
  getPerk,
  isPartCombinationCompatible
} from './parts-manifest.js';

export const CUSTOM_CAR_SCHEMA_VERSION = 1;
export const CUSTOM_CAR_STAT_BUDGET = 18;
export const CUSTOM_CAR_STAT_MIN = 1;
export const CUSTOM_CAR_STAT_MAX = 5;

const CUSTOM_CAR_ID_PATTERN = /^custom-[A-Za-z0-9_-]{1,48}$/;
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/;

const DEFAULT_PARTS = Object.freeze(Object.fromEntries(
  PART_CATEGORIES.map(({ id }) => [id, PARTS_BY_CATEGORY[id][0].id])
));

const DEFAULT_STATS = Object.freeze({
  speed: 4,
  acceleration: 3,
  control: 3,
  drift: 4,
  boostPower: 2,
  boostDuration: 2
});

const DEFAULT_COLORS = Object.freeze({
  primary: '#ff4fa3',
  secondary: '#38d9ff',
  accent: '#ffd43b'
});

export function createDefaultCustomCarBuild(now = new Date().toISOString()) {
  const build = {
    schemaVersion: CUSTOM_CAR_SCHEMA_VERSION,
    id: 'custom-01',
    name: 'MY CAR',
    parts: { ...DEFAULT_PARTS },
    colors: { ...DEFAULT_COLORS },
    stats: { ...DEFAULT_STATS },
    perkId: CUSTOM_CAR_PERKS[0].id,
    createdAt: now,
    updatedAt: now
  };
  return withCustomCarBuildHash(build);
}

export function customCarStatTotal(stats) {
  return CUSTOM_CAR_STAT_ROWS.reduce((total, { id }) => total + Number(stats?.[id] || 0), 0);
}

export function normalizeCustomCarBuild(candidate, { now = new Date().toISOString() } = {}) {
  const fallback = createDefaultCustomCarBuild(now);
  const input = candidate && typeof candidate === 'object' ? candidate : {};
  const parts = {};
  for (const { id: category } of PART_CATEGORIES) {
    const requested = String(input.parts?.[category] || '');
    parts[category] = getPart(category, requested)?.id || fallback.parts[category];
  }

  const stats = {};
  for (const { id } of CUSTOM_CAR_STAT_ROWS) {
    const value = Number(input.stats?.[id]);
    stats[id] = Number.isInteger(value)
      ? Math.min(CUSTOM_CAR_STAT_MAX, Math.max(CUSTOM_CAR_STAT_MIN, value))
      : fallback.stats[id];
  }

  const build = {
    schemaVersion: CUSTOM_CAR_SCHEMA_VERSION,
    id: CUSTOM_CAR_ID_PATTERN.test(String(input.id || '')) ? String(input.id) : fallback.id,
    name: normalizeName(input.name, fallback.name),
    parts,
    colors: {
      primary: normalizeHexColor(input.colors?.primary, fallback.colors.primary),
      secondary: normalizeHexColor(input.colors?.secondary, fallback.colors.secondary),
      accent: normalizeHexColor(input.colors?.accent, fallback.colors.accent)
    },
    stats,
    perkId: getPerk(String(input.perkId || ''))?.id || fallback.perkId,
    createdAt: normalizeDate(input.createdAt, fallback.createdAt),
    updatedAt: now
  };
  return withCustomCarBuildHash(build);
}

export function validateCustomCarBuild(build) {
  const errors = [];
  if (!build || typeof build !== 'object') {
    return Object.freeze({ valid: false, errors: Object.freeze(['Build must be an object.']), total: 0 });
  }
  if (build.schemaVersion !== CUSTOM_CAR_SCHEMA_VERSION) errors.push('Unsupported build version.');
  if (!CUSTOM_CAR_ID_PATTERN.test(String(build.id || ''))) errors.push('Invalid custom-car ID.');
  const name = String(build.name || '').trim();
  if (name.length < 1 || name.length > 20) errors.push('Name must contain 1–20 characters.');

  for (const { id: category, label } of PART_CATEGORIES) {
    if (!getPart(category, build.parts?.[category])) errors.push(`${label} selection is invalid.`);
  }
  if (!isPartCombinationCompatible(build.parts)) errors.push('The selected parts are not compatible.');

  for (const channel of ['primary', 'secondary', 'accent']) {
    if (!HEX_COLOR_PATTERN.test(String(build.colors?.[channel] || '').toLowerCase())) {
      errors.push(`${channel} colour must be a six-digit hex colour.`);
    }
  }

  for (const { id, label } of CUSTOM_CAR_STAT_ROWS) {
    const value = build.stats?.[id];
    if (!Number.isInteger(value) || value < CUSTOM_CAR_STAT_MIN || value > CUSTOM_CAR_STAT_MAX) {
      errors.push(`${label} must be between ${CUSTOM_CAR_STAT_MIN} and ${CUSTOM_CAR_STAT_MAX}.`);
    }
  }
  const total = customCarStatTotal(build.stats);
  if (total !== CUSTOM_CAR_STAT_BUDGET) {
    errors.push(`Use exactly ${CUSTOM_CAR_STAT_BUDGET} stat points; current total is ${total}.`);
  }
  if (!getPerk(build.perkId)) errors.push('Choose one valid perk.');
  if (!isIsoDate(build.createdAt) || !isIsoDate(build.updatedAt)) errors.push('Build timestamps are invalid.');
  if (build.buildHash !== customCarBuildHash(build)) errors.push('Build identity does not match its contents.');

  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors), total });
}

export function withCustomCarBuildHash(build) {
  const copy = {
    ...build,
    parts: { ...build.parts },
    colors: { ...build.colors },
    stats: { ...build.stats }
  };
  copy.buildHash = customCarBuildHash(copy);
  return copy;
}

export function customCarBuildHash(build) {
  const identity = JSON.stringify({
    schemaVersion: CUSTOM_CAR_SCHEMA_VERSION,
    id: String(build?.id || ''),
    name: String(build?.name || ''),
    parts: Object.fromEntries(PART_CATEGORIES.map(({ id }) => [id, String(build?.parts?.[id] || '')])),
    colors: {
      primary: String(build?.colors?.primary || '').toLowerCase(),
      secondary: String(build?.colors?.secondary || '').toLowerCase(),
      accent: String(build?.colors?.accent || '').toLowerCase()
    },
    stats: Object.fromEntries(CUSTOM_CAR_STAT_ROWS.map(({ id }) => [id, Number(build?.stats?.[id] || 0)])),
    perkId: String(build?.perkId || '')
  });
  let hash = 0x811c9dc5;
  for (let index = 0; index < identity.length; index += 1) {
    hash ^= identity.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `v${CUSTOM_CAR_SCHEMA_VERSION}-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function normalizeName(value, fallback) {
  const normalized = String(value || '').trim().replace(/\s+/g, ' ').slice(0, 20);
  return normalized || fallback;
}

function normalizeHexColor(value, fallback) {
  const normalized = String(value || '').toLowerCase();
  return HEX_COLOR_PATTERN.test(normalized) ? normalized : fallback;
}

function normalizeDate(value, fallback) {
  return isIsoDate(value) ? String(value) : fallback;
}

function isIsoDate(value) {
  if (typeof value !== 'string' || !value) return false;
  return !Number.isNaN(Date.parse(value));
}
