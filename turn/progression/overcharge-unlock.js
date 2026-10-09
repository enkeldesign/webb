import { TROPHY_ROAD_STORAGE_KEY, isFeatureUnlocked, readTrophyRoadSnapshot } from './trophy-road.js';

// OVERCHARGE unlocks with DRIFT ATTACK (#1150): the first laps teach BOOST and DRIFT
// alone, and OVERCHARGE arrives once the player has raced with them. Players who knew
// TURN before this change keep it, judged once (the same "played before" rule as TURN
// TUTORIAL: any achievement, which FIRST TURN is). YOUR TURN has no TURN progress to
// gate on and always has it. Hiding the DRIFT HUD in SETTINGS never removes it.
export const OVERCHARGE_PROFILE_KEY = 'turn-overcharge-v1';
export const OVERCHARGE_FEATURE_ID = 'drift-attack';

function storageOf(storage) {
  if (storage !== undefined) return storage;
  try {
    return globalThis.localStorage;
  } catch (_) {
    return null;
  }
}

// The Trophy Road's own reading of a profile, legacy ones included: saved rivals or a
// historical car choice from before achievements count as having played.
function playedBefore(storage) {
  try {
    const snapshot = readTrophyRoadSnapshot(storage);
    if (snapshot.isLegacyProfile || snapshot.unlockedRewardIds.length || snapshot.legacyTrackIds.length) return true;
    const state = JSON.parse(storage?.getItem?.(TROPHY_ROAD_STORAGE_KEY) || 'null');
    return Object.keys(state?.unlocked || {}).length > 0;
  } catch (_) {
    return false;
  }
}

// Website data blocked: TURN plays from a memory stand-in that forgets every visit
// (index.html marks it), so no progress could ever reach DRIFT ATTACK.
function memoryOnly(documentRef) {
  return documentRef?.documentElement?.dataset?.turnStorage === 'memory';
}

// 'kept' for a profile that played before OVERCHARGE was gated, 'locked' for a new
// one, decided at its first launch of this release and then remembered. null without
// lasting storage: nothing could be earned or remembered, so nothing is held back.
export function settleOverchargeProfile(storage, documentRef = globalThis.document) {
  if (memoryOnly(documentRef)) return null;
  const target = storageOf(storage);
  try {
    const stored = target?.getItem?.(OVERCHARGE_PROFILE_KEY);
    if (stored === 'kept' || stored === 'locked') return stored;
    if (!target?.setItem) return null;
    const settled = playedBefore(target) ? 'kept' : 'locked';
    target.setItem(OVERCHARGE_PROFILE_KEY, settled);
    return settled;
  } catch (_) {
    return null;
  }
}

export function isOverchargeAvailable({ storage, documentRef = globalThis.document } = {}) {
  if (documentRef?.documentElement?.dataset?.turnDeployment === 'yourturn') return true;
  const profile = settleOverchargeProfile(storage, documentRef);
  if (profile !== 'locked') return true;
  try {
    return isFeatureUnlocked(OVERCHARGE_FEATURE_ID, storageOf(storage));
  } catch (_) {
    return true;
  }
}
