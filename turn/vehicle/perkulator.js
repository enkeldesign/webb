// PERKULATOR (#1219): one perk INSTALLED on each car, which races run beside the car's
// ORIGINAL perk (perk-runtime.js). PERKULATOR holds every perk you have unlocked that may
// leave its car (#1228): there is nothing to collect first. Which perks may move is
// perks.js's to say, never their rarity.
//
// Stored in the page's own localStorage, never the storage TURN shares with YOUR TURN,
// so a challenger in YOUR TURN races without the installed perks of a TURN player on
// the same device.
import { CAR_CATALOG } from './catalog.js';
import { PERKS, getVehiclePerk, originalVehiclePerk } from './perks.js';
import {
  isFeatureUnlocked,
  isVehiclePerkUnlocked,
  isVehicleUnlocked,
  rewardForVehicle,
  rewardForVehiclePerk
} from '../progression/trophy-road.js';

import { getAchievement } from '../achievements/catalog.js';
import { loadAchievementState } from '../achievements/store.js';

export const PERKULATOR_FEATURE_ID = 'perkulator';
export const PERKULATOR_STORAGE_KEY = 'turn-perkulator-v1';
export const PERKULATOR_STORAGE_VERSION = 1;
export const PERKULATOR_CHANGE_EVENT = 'turn:perkulator-change';
const RARITY_ORDER = Object.freeze({ common: 0, rare: 1, epic: 2, legendary: 3, mythic: 4 });
export function comparePerks(a, b) {
  return RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity] || a.title.localeCompare(b.title, 'en');
}
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

// A perk a car may install: one that may leave its own car, and never the car's own, so
// no perk runs twice.
function mayInstall(vehicleId, perkId) {
  const perk = getVehiclePerk(perkId);
  return CAR_IDS.has(vehicleId)
    && perk?.installable === true
    && perk.id !== originalVehiclePerk(vehicleId)?.id;
}

// Only the installed perks are kept. A list of clones saved before #1228 is let go:
// PERKULATOR now holds every unlocked perk without one.
export function normalizePerkulatorState(value) {
  const parsed = parse(value);
  const installed = {};
  for (const [vehicleId, perkId] of Object.entries(parsed?.installed || {})) {
    if (mayInstall(vehicleId, perkId)) installed[vehicleId] = perkId;
  }
  return Object.freeze({
    version: PERKULATOR_STORAGE_VERSION,
    installed: Object.freeze(installed)
  });
}

// A saved installation that may no longer run (DRIFTAGE, which stays with its car since
// #1273) is dropped on read, and the clean state is written back so it cannot return.
export function readPerkulatorState(storage) {
  try {
    const target = storageFor(storage);
    const raw = target?.getItem?.(PERKULATOR_STORAGE_KEY);
    const state = normalizePerkulatorState(raw);
    const saved = parse(raw)?.installed;
    if (saved && typeof saved === 'object' && Object.keys(saved).length !== Object.keys(state.installed).length) {
      try { target.setItem(PERKULATOR_STORAGE_KEY, JSON.stringify(state)); } catch (_) { /* read stays clean */ }
    }
    return state;
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

// Whether PERKULATOR holds a perk: one that may leave its car, once one of its cars and
// the perk are unlocked on Trophy Road. LEGENDARY perks stay with their car.
export function isPerkAvailable(perkId, storage) {
  const target = storageFor(storage);
  const perk = getVehiclePerk(perkId);
  return perk?.installable === true
    && isPerkulatorUnlocked(target)
    && (globalThis.__turnSessionAdmin?.options.rewards || (perk.achievementId
      ? Boolean(loadAchievementState(target).state.unlocked[perk.achievementId])
      : perk.vehicleIds.some((vehicleId) => isVehicleUnlocked(vehicleId, target)
        && isVehiclePerkUnlocked(vehicleId, target))));
}

// The perks a car may install: every one PERKULATOR holds but its own.
export function installablePerksFor(vehicleId, storage) {
  const target = storageFor(storage);
  return PERKS.filter((perk) => mayInstall(vehicleId, perk.id) && isPerkAvailable(perk.id, target)).sort(comparePerks);
}

// The perk a car runs beside its own, while PERKULATOR holds it. Without PERKULATOR, none.
export function installedPerkFor(vehicleId, storage) {
  const target = storageFor(storage);
  const perkId = readPerkulatorState(target).installed[vehicleId] || '';
  return perkId && isPerkAvailable(perkId, target) ? perkId : '';
}

// What PERKULATOR shows a car (#1274): every perk it could ever install, available or
// still locked, in rarity and name order. This is presentation only. installPerk()
// keeps its own check, so a locked choice can never be installed.
export function perkulatorChoicesFor(vehicleId, storage) {
  const target = storageFor(storage);
  return PERKS.filter((perk) => mayInstall(vehicleId, perk.id)).sort(comparePerks)
    .map((perk) => Object.freeze({ perk, available: isPerkAvailable(perk.id, target) }));
}

// How a locked perk unlocks: its collection, or the Trophy Road reward for its car or
// for the perk itself.
export function perkUnlockRequirement(perk, storage) {
  const target = storageFor(storage);
  if (perk?.achievementId) return `Complete ${getAchievement(perk.achievementId)?.title || 'its collection'} to unlock.`;
  const vehicleId = perk?.vehicleIds?.[0];
  if (!vehicleId) return '';
  const reward = !isVehicleUnlocked(vehicleId, target) ? rewardForVehicle(vehicleId)
    : !isVehiclePerkUnlocked(vehicleId, target) ? rewardForVehiclePerk(vehicleId) : null;
  return reward ? `Unlocks with ${reward.title} at ${reward.threshold} trophies on Trophy Road.` : '';
}

// Installing replaces the car's installed perk, never its own.
export function installPerk(vehicleId, perkId, storage) {
  const target = storageFor(storage);
  const state = readPerkulatorState(target);
  if (!mayInstall(vehicleId, perkId) || !isPerkAvailable(perkId, target)) return false;
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
