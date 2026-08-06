const PENDING_KEY = '__turnPendingSecretAchievementIds';
const PENDING_CONTEXT_KEY = '__turnPendingSecretAchievementContexts';
const SAVE_BELLA_ID = 'save-bella';

function pendingIds() {
  if (!(globalThis[PENDING_KEY] instanceof Set)) globalThis[PENDING_KEY] = new Set();
  return globalThis[PENDING_KEY];
}

function pendingContexts() {
  if (!(globalThis[PENDING_CONTEXT_KEY] instanceof Map)) globalThis[PENDING_CONTEXT_KEY] = new Map();
  return globalThis[PENDING_CONTEXT_KEY];
}

export function signalSecretAchievement(achievementId, context = {}) {
  if (!achievementId) return false;

  // SAVE BELLA! is a rescue action, not a visual discovery. Legacy camera/proximity
  // callers are deliberately rejected unless the rescue behavior confirms that Bella
  // has already reached the ground inside the Fire Truck siren zone.
  if (achievementId === SAVE_BELLA_ID && context.rescueConfirmed !== true) return false;

  pendingIds().add(achievementId);
  pendingContexts().set(achievementId, context);
  globalThis.dispatchEvent?.(new CustomEvent('turn:secret-achievement', {
    detail: { achievementId, context }
  }));
  return true;
}

export function takePendingSecretAchievements() {
  const ids = [...pendingIds()];
  const contexts = pendingContexts();
  const entries = ids.map((achievementId) => ({
    achievementId,
    context: contexts.get(achievementId) || {}
  }));
  pendingIds().clear();
  contexts.clear();
  return entries;
}

export function takePendingSecretAchievementIds() {
  return takePendingSecretAchievements().map(({ achievementId }) => achievementId);
}
