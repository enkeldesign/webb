export const VEHICLE_SHIFT_FEATURE_ID = 'vehicle-shift';
export const VEHICLE_SHIFT_REWARD_ID = 'shift';
export const VEHICLE_SHIFT_STORAGE_KEY = 'turn-vehicle-shift-v1';
export const VEHICLE_SHIFT_STORAGE_VERSION = 1;
export const VEHICLE_SHIFT_STAT_BUDGET = 18;

export const VEHICLE_SHIFT_STAT_FIELDS = Object.freeze([
  Object.freeze({ key: 'speed', label: 'TOP SPEED' }),
  Object.freeze({ key: 'acceleration', label: 'ACCELERATION' }),
  Object.freeze({ key: 'control', label: 'CONTROL' }),
  Object.freeze({ key: 'drift', label: 'DRIFT' }),
  Object.freeze({ key: 'boostPower', label: 'BOOST POWER' }),
  Object.freeze({ key: 'boostDuration', label: 'BOOST TANK' })
]);

export const VEHICLE_SHIFT_STAT_KEYS = Object.freeze(
  VEHICLE_SHIFT_STAT_FIELDS.map(({ key }) => key)
);

const STAT_KEY_SET = new Set(VEHICLE_SHIFT_STAT_KEYS);

function storageFor(preferredStorage) {
  if (preferredStorage !== undefined) return preferredStorage;
  try {
    return globalThis.__TURN_SHARED_LOCAL_STORAGE__ || globalThis.localStorage;
  } catch (_) {
    return null;
  }
}

function parseState(raw) {
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (_) {
    return null;
  }
}

function normalizedReducedStats(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((key) => STAT_KEY_SET.has(key)))];
}

function normalizedVehicleId(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizedStoredProfile(value) {
  if (!value || typeof value !== 'object') return null;
  const reducedStats = normalizedReducedStats(value.reducedStats);
  if (reducedStats.length !== 3) return null;
  return Object.freeze({
    enabled: value.enabled === true,
    reducedStats: Object.freeze(reducedStats)
  });
}

export function normalizeVehicleShiftState(value) {
  const parsed = parseState(value);
  const profiles = {};
  for (const [vehicleId, profileValue] of Object.entries(parsed?.profiles || {})) {
    const id = normalizedVehicleId(vehicleId);
    const profile = normalizedStoredProfile(profileValue);
    if (id && profile) profiles[id] = profile;
  }
  return Object.freeze({
    version: VEHICLE_SHIFT_STORAGE_VERSION,
    profiles: Object.freeze(profiles)
  });
}

export function readVehicleShiftState(storage) {
  const target = storageFor(storage);
  try {
    return normalizeVehicleShiftState(target?.getItem?.(VEHICLE_SHIFT_STORAGE_KEY));
  } catch (_) {
    return normalizeVehicleShiftState(null);
  }
}

export function vehicleStatsSupportShift(stats) {
  return VEHICLE_SHIFT_STAT_KEYS.every((key) => {
    const value = Number(stats?.[key]);
    return Number.isInteger(value) && value >= 1 && value <= 5;
  }) && VEHICLE_SHIFT_STAT_KEYS.reduce((total, key) => total + Number(stats[key]), 0) === VEHICLE_SHIFT_STAT_BUDGET;
}

export function requiredVehicleShiftReducers(stats) {
  if (!vehicleStatsSupportShift(stats)) return Object.freeze([]);
  return Object.freeze(VEHICLE_SHIFT_STAT_KEYS.filter((key) => Number(stats[key]) === 5));
}

export function blockedVehicleShiftReducers(stats) {
  if (!vehicleStatsSupportShift(stats)) return Object.freeze([...VEHICLE_SHIFT_STAT_KEYS]);
  return Object.freeze(VEHICLE_SHIFT_STAT_KEYS.filter((key) => Number(stats[key]) === 1));
}

function complementaryVehicleShiftStats(selectedStats) {
  const selected = normalizedReducedStats(selectedStats);
  if (selected.length !== 3) return Object.freeze([]);
  const selectedSet = new Set(selected);
  return Object.freeze(VEHICLE_SHIFT_STAT_KEYS.filter((key) => !selectedSet.has(key)));
}

export function requiredVehicleShiftReceivers(stats) {
  return blockedVehicleShiftReducers(stats);
}

export function blockedVehicleShiftReceivers(stats) {
  return requiredVehicleShiftReducers(stats);
}

export function vehicleShiftReceiversForReducers(reducedStats) {
  return complementaryVehicleShiftStats(reducedStats);
}

export function vehicleShiftReducersForReceivers(receivingStats) {
  return complementaryVehicleShiftStats(receivingStats);
}

export function shiftedVehicleStats(stats, reducedStats) {
  if (!vehicleStatsSupportShift(stats)) return null;
  const reduced = normalizedReducedStats(reducedStats);
  if (reduced.length !== 3) return null;
  const reducedSet = new Set(reduced);
  const shifted = {};
  for (const key of VEHICLE_SHIFT_STAT_KEYS) {
    const value = Number(stats[key]) + (reducedSet.has(key) ? -1 : 1);
    if (value < 1 || value > 5) return null;
    shifted[key] = value;
  }
  const total = VEHICLE_SHIFT_STAT_KEYS.reduce((sum, key) => sum + shifted[key], 0);
  return total === VEHICLE_SHIFT_STAT_BUDGET ? Object.freeze(shifted) : null;
}

export function shiftedVehicleStatsFromReceivers(stats, receivingStats) {
  const reducedStats = vehicleShiftReducersForReceivers(receivingStats);
  return reducedStats.length === 3 ? shiftedVehicleStats(stats, reducedStats) : null;
}

export function isVehicleShiftConfigurationValid(stats, reducedStats) {
  return Boolean(shiftedVehicleStats(stats, reducedStats));
}

export function loadVehicleShiftProfile(vehicleId, stats, storage) {
  const id = normalizedVehicleId(vehicleId);
  const profile = readVehicleShiftState(storage).profiles[id];
  if (!profile || !isVehicleShiftConfigurationValid(stats, profile.reducedStats)) return null;
  return Object.freeze({
    enabled: profile.enabled,
    reducedStats: profile.reducedStats,
    shiftedStats: shiftedVehicleStats(stats, profile.reducedStats)
  });
}

function writeVehicleShiftState(state, storage) {
  const target = storageFor(storage);
  try {
    target?.setItem?.(VEHICLE_SHIFT_STORAGE_KEY, JSON.stringify(state));
    return Boolean(target);
  } catch (_) {
    return false;
  }
}

export function saveVehicleShiftProfile({
  vehicleId,
  stats,
  reducedStats,
  enabled = true,
  storage
} = {}) {
  const id = normalizedVehicleId(vehicleId);
  const reduced = normalizedReducedStats(reducedStats);
  if (!id || !isVehicleShiftConfigurationValid(stats, reduced)) return null;

  const current = readVehicleShiftState(storage);
  const next = {
    version: VEHICLE_SHIFT_STORAGE_VERSION,
    profiles: {
      ...current.profiles,
      [id]: {
        enabled: enabled === true,
        reducedStats: reduced
      }
    }
  };
  if (!writeVehicleShiftState(next, storage)) return null;
  return loadVehicleShiftProfile(id, stats, storage);
}

export function setVehicleShiftProfileEnabled(vehicleId, stats, enabled, storage) {
  const current = loadVehicleShiftProfile(vehicleId, stats, storage);
  if (!current) return null;
  return saveVehicleShiftProfile({
    vehicleId,
    stats,
    reducedStats: current.reducedStats,
    enabled,
    storage
  });
}
