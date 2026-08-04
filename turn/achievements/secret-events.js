const PENDING_KEY = '__turnPendingSecretAchievementIds';

function pendingIds() {
  if (!(globalThis[PENDING_KEY] instanceof Set)) globalThis[PENDING_KEY] = new Set();
  return globalThis[PENDING_KEY];
}

export function signalSecretAchievement(achievementId, context = {}) {
  if (!achievementId) return false;
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
