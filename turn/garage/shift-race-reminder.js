import { getCarDefinition } from '../vehicle/catalog.js?revision=r243-mountain-1300';
import { introducesOnUnlock } from '../progression/unlock-introductions.js';
import { pointOutInGarage } from './garage-focus.js';

// SHIFT, once per car (#1167): after SHIFT unlocks, the first RACE on a car that can
// SHIFT but has no SHIFT setup points at ACTIVATE SHIFT instead of racing. The second
// RACE races, and that car is never reminded again.
export const SHIFT_RACE_REMINDER_KEY = 'turn-shift-race-reminder-v1';
// RACE has just been pressed: said soon after VoiceOver reads the button.
const SAY_AFTER_MS = 400;

function remindedCars(storage) {
  try {
    const ids = JSON.parse(storage?.getItem?.(SHIFT_RACE_REMINDER_KEY) || '[]');
    return Array.isArray(ids) ? ids : [];
  } catch (_) {
    return [];
  }
}

// The SHIFT trigger already says what the car's SHIFT is (garage/shift-setup.js):
// locked before the reward, unavailable for a car that cannot SHIFT, active once set.
export function shiftNeedsSetup(trigger) {
  return Boolean(trigger?.isConnected)
    && !trigger.classList.contains('is-locked')
    && !trigger.classList.contains('is-unavailable')
    && !trigger.classList.contains('is-active')
    && !trigger.disabled
    && !trigger.hidden
    && Boolean(trigger.offsetParent);
}

// True when RACE pointed at ACTIVATE SHIFT this time instead of racing.
export function remindShiftBeforeRace(carId, trigger, {
  storage = globalThis.localStorage,
  documentRef = globalThis.document,
  windowRef = globalThis
} = {}) {
  if (!carId || !shiftNeedsSetup(trigger)) return false;
  // Like the unlock sheets, not in automated runs, where tests race all the time.
  if (!introducesOnUnlock(windowRef, storage)) return false;
  const reminded = remindedCars(storage);
  if (reminded.includes(carId)) return false;
  try {
    storage?.setItem?.(SHIFT_RACE_REMINDER_KEY, JSON.stringify([...reminded, carId]));
  } catch (_) {
    return false;
  }
  const name = getCarDefinition(carId)?.name || 'this car';
  return pointOutInGarage([{
    element: trigger,
    say: `No SHIFT setup on the ${name} yet. ACTIVATE SHIFT is below the car’s name. Press RACE again to race.`
  }], { sayAfterMs: SAY_AFTER_MS, documentRef, windowRef });
}
