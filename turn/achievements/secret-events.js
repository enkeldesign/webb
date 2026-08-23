const PENDING_KEY = '__turnPendingSecretAchievementIds';
const PENDING_CONTEXT_KEY = '__turnPendingSecretAchievementContexts';
const SAVE_BELLA_ID = 'save-bella';
const MAX_STORED_EVIDENCE = 32;

export const SECRET_ACHIEVEMENT_EVIDENCE_STORAGE_KEY = 'turn-secret-achievement-evidence-v1';

function pendingIds() {
  if (!(globalThis[PENDING_KEY] instanceof Set)) globalThis[PENDING_KEY] = new Set();
  return globalThis[PENDING_KEY];
}

function pendingContexts() {
  if (!(globalThis[PENDING_CONTEXT_KEY] instanceof Map)) globalThis[PENDING_CONTEXT_KEY] = new Map();
  return globalThis[PENDING_CONTEXT_KEY];
}

function safeContext(context = {}) {
  const result = {};
  for (const [key, value] of Object.entries(context || {})) {
    if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
      result[key] = value;
    }
  }
  return result;
}

function readStoredEvidence(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem?.(SECRET_ACHIEVEMENT_EVIDENCE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry) => entry && typeof entry.achievementId === 'string')
      .slice(-MAX_STORED_EVIDENCE)
      .map((entry) => ({
        achievementId: entry.achievementId,
        context: safeContext(entry.context)
      }));
  } catch (_) {
    return [];
  }
}

function writeStoredEvidence(entries, storage = globalThis.localStorage) {
  try {
    if (!storage?.setItem) return false;
    storage.setItem(
      SECRET_ACHIEVEMENT_EVIDENCE_STORAGE_KEY,
      JSON.stringify(entries.slice(-MAX_STORED_EVIDENCE))
    );
    return true;
  } catch (_) {
    return false;
  }
}

function persistEvidence(achievementId, context, storage = globalThis.localStorage) {
  const byId = new Map(
    readStoredEvidence(storage).map((entry) => [entry.achievementId, entry])
  );
  byId.set(achievementId, {
    achievementId,
    context: safeContext(context)
  });
  return writeStoredEvidence([...byId.values()], storage);
}

export function pendingSecretAchievements(storage = globalThis.localStorage) {
  const byId = new Map(
    readStoredEvidence(storage).map((entry) => [entry.achievementId, entry])
  );
  const contexts = pendingContexts();
  for (const achievementId of pendingIds()) {
    byId.set(achievementId, {
      achievementId,
      context: safeContext(contexts.get(achievementId) || {})
    });
  }
  return [...byId.values()];
}

export function acknowledgeSecretAchievement(achievementId, storage = globalThis.localStorage) {
  if (!achievementId) return false;
  pendingIds().delete(achievementId);
  pendingContexts().delete(achievementId);
  const remaining = readStoredEvidence(storage)
    .filter((entry) => entry.achievementId !== achievementId);
  writeStoredEvidence(remaining, storage);
  return true;
}

export function signalSecretAchievement(achievementId, context = {}) {
  if (!achievementId) return false;

  // SAVE BELLA! is a rescue action, not a visual discovery. Legacy camera/proximity
  // callers are deliberately rejected unless the rescue behavior confirms that Bella
  // has already reached the ground inside the Fire Truck siren zone.
  if (achievementId === SAVE_BELLA_ID && context.rescueConfirmed !== true) return false;

  pendingIds().add(achievementId);
  pendingContexts().set(achievementId, context);

  // Keep durable evidence until the achievement runtime confirms the unlock. This
  // protects one-shot events such as MAYDAY! if a future catalog/cache regression
  // temporarily prevents the achievement from being recognized.
  persistEvidence(achievementId, context);

  globalThis.dispatchEvent?.(new CustomEvent('turn:secret-achievement', {
    detail: { achievementId, context }
  }));
  return true;
}

export function takePendingSecretAchievements(storage = globalThis.localStorage) {
  const entries = pendingSecretAchievements(storage);
  for (const { achievementId } of entries) {
    acknowledgeSecretAchievement(achievementId, storage);
  }
  return entries;
}

export function takePendingSecretAchievementIds(storage = globalThis.localStorage) {
  return takePendingSecretAchievements(storage).map(({ achievementId }) => achievementId);
}
