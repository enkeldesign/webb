const PENDING_KEY = '__turnPendingSecretAchievementIds';
const SAVE_BELLA_ID = 'save-bella';

function pendingIds() {
  if (!(globalThis[PENDING_KEY] instanceof Set)) globalThis[PENDING_KEY] = new Set();
  return globalThis[PENDING_KEY];
}

export function signalSecretAchievement(achievementId, context = {}) {
  if (!achievementId) return false;

  // SAVE BELLA! is a rescue action, not a visual discovery. Legacy camera/proximity
  // callers are deliberately rejected unless the rescue behavior confirms that Bella
  // has already reached the ground inside the Fire Truck siren zone.
  if (achievementId === SAVE_BELLA_ID && context.rescueConfirmed !== true) return false;

  pendingIds().add(achievementId);
  globalThis.dispatchEvent?.(new CustomEvent('turn:secret-achievement', {
    detail: { achievementId, context }
  }));
  return true;
}

export function takePendingSecretAchievementIds() {
  const ids = [...pendingIds()];
  pendingIds().clear();
  return ids;
}
