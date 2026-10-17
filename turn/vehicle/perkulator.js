// PERKULATOR (#1219): the perk a car comes with may be CLONED, and one cloned perk
// INSTALLED on each car, which races run beside the car's ORIGINAL perk
// (perk-runtime.js). A clone is a lasting entitlement to the perk, not a copy with a
// state of its own: cloned once, any other car may install it. Which perks may be
// cloned and installed is perks.js's to say, never their rarity.
//
// Stored in the page's own localStorage, never the storage TURN shares with YOUR TURN,
// so a challenger in YOUR TURN races without the installed perks of a TURN player on
// the same device.
import { CAR_CATALOG } from './catalog.js';
import { getVehiclePerk, originalVehiclePerk } from './perks.js';
import {
  isFeatureUnlocked,
  isVehiclePerkUnlocked,
  isVehicleUnlocked
} from '../progression/trophy-road.js';

export const PERKULATOR_FEATURE_ID = 'perkulator';
export const PERKULATOR_STORAGE_KEY = 'turn-perkulator-v1';
export const PERKULATOR_STORAGE_VERSION = 1;
export const PERKULATOR_CHANGE_EVENT = 'turn:perkulator-change';
const CAR_IDS = new Set(CAR_CATALOG.map(({ id }) => id));

function storageFor(storage) {
  if (storage !== undefined) return storage;
  try {
    return globalThis.localStorage;
  } catch (_) {
    return null;
  }
}

function parse(raw) {
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (_) {
    return null;
  }
}

// An installed perk is a cloned one, and never the car's own: no perk runs twice.
function mayInstall(vehicleId, perkId, cloned) {
  const perk = getVehiclePerk(perkId);
  return CAR_IDS.has(vehicleId)
    && perk?.installable === true
    && cloned.includes(perk.id)
    && perk.id !== originalVehiclePerk(vehicleId)?.id;
}

export function normalizePerkulatorState(value) {
  const parsed = parse(value);
  const cloned = [...new Set((Array.isArray(parsed?.cloned) ? parsed.cloned : [])
    .filter((perkId) => getVehiclePerk(perkId)?.cloneable === true))];
  const installed = {};
  for (const [vehicleId, perkId] of Object.entries(parsed?.installed || {})) {
    if (mayInstall(vehicleId, perkId, cloned)) installed[vehicleId] = perkId;
  }
  return Object.freeze({
    version: PERKULATOR_STORAGE_VERSION,
    cloned: Object.freeze(cloned),
    installed: Object.freeze(installed)
  });
}

export function readPerkulatorState(storage) {
  try {
    return normalizePerkulatorState(storageFor(storage)?.getItem?.(PERKULATOR_STORAGE_KEY));
  } catch (_) {
    return normalizePerkulatorState(null);
  }
}

function writePerkulatorState(next, detail, storage) {
  const state = normalizePerkulatorState(next);
  try {
    storageFor(storage)?.setItem?.(PERKULATOR_STORAGE_KEY, JSON.stringify(state));
  } catch (_) {
    return false;
  }
  const EventConstructor = globalThis.CustomEvent;
  if (typeof globalThis.dispatchEvent === 'function' && typeof EventConstructor === 'function') {
    globalThis.dispatchEvent(new EventConstructor(PERKULATOR_CHANGE_EVENT, { detail }));
  }
  return true;
}

// PERKULATOR is a Trophy Road reward.
export function isPerkulatorUnlocked(storage) {
  return isFeatureUnlocked(PERKULATOR_FEATURE_ID, storageFor(storage));
}

// A car's own perk, when it may be cloned: from a car you have, once its perk is
// unlocked. LEGENDARY perks stay with their car.
export function cloneablePerkFor(vehicleId, storage) {
  const target = storageFor(storage);
  const perk = originalVehiclePerk(vehicleId);
  if (perk?.cloneable !== true || !isPerkulatorUnlocked(target)) return null;
  if (!isVehicleUnlocked(vehicleId, target) || !isVehiclePerkUnlocked(vehicleId, target)) return null;
  return perk;
}

export function isPerkCloned(perkId, storage) {
  return readPerkulatorState(storage).cloned.includes(perkId);
}

export function clonePerk(vehicleId, storage) {
  const target = storageFor(storage);
  const perk = cloneablePerkFor(vehicleId, target);
  const state = readPerkulatorState(target);
  if (!perk || state.cloned.includes(perk.id)) return false;
  return writePerkulatorState(
    { ...state, cloned: [...state.cloned, perk.id] },
    { action: 'clone', vehicleId, perkId: perk.id },
    target
  );
}

// The cloned perks a car may install: every one but its own.
export function installablePerksFor(vehicleId, storage) {
  const target = storageFor(storage);
  if (!isPerkulatorUnlocked(target)) return [];
  const { cloned } = readPerkulatorState(target);
  return cloned.filter((perkId) => mayInstall(vehicleId, perkId, cloned)).map(getVehiclePerk);
}

// The perk a car runs beside its own. Without PERKULATOR, none.
export function installedPerkFor(vehicleId, storage) {
  const target = storageFor(storage);
  if (!isPerkulatorUnlocked(target)) return '';
  return readPerkulatorState(target).installed[vehicleId] || '';
}

// Installing replaces the car's installed perk, never its own.
export function installPerk(vehicleId, perkId, storage) {
  const target = storageFor(storage);
  const state = readPerkulatorState(target);
  if (!isPerkulatorUnlocked(target) || !mayInstall(vehicleId, perkId, state.cloned)) return false;
  if (state.installed[vehicleId] === perkId) return false;
  return writePerkulatorState(
    { ...state, installed: { ...state.installed, [vehicleId]: perkId } },
    { action: 'install', vehicleId, perkId },
    target
  );
}

export function removeInstalledPerk(vehicleId, storage) {
  const target = storageFor(storage);
  const state = readPerkulatorState(target);
  if (!state.installed[vehicleId]) return false;
  const installed = { ...state.installed };
  delete installed[vehicleId];
  return writePerkulatorState({ ...state, installed }, { action: 'remove', vehicleId, perkId: '' }, target);
}
