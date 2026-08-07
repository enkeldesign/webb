const RACER_ID_KEY = 'turn-social-racer-id-v1';
const RACER_NAME_KEY = 'turn-social-racer-name-v1';
const MAX_NAME_LENGTH = 24;

function sharedStorage() {
  const bridged = globalThis.__TURN_SHARED_LOCAL_STORAGE__;
  if (bridged?.getItem && bridged?.setItem) return bridged;
  try {
    return globalThis.localStorage || null;
  } catch (_) {
    return null;
  }
}

export function normalizeSocialRacerName(value) {
  return String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME_LENGTH);
}

export function normalizeSocialRacerId(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 64);
}

export function createSocialRacerId() {
  const random = globalThis.crypto?.randomUUID?.()
    || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return normalizeSocialRacerId(`r-${random}`);
}

export function loadSocialRacerProfile() {
  const storage = sharedStorage();
  let id = '';
  let name = '';

  try {
    id = normalizeSocialRacerId(storage?.getItem?.(RACER_ID_KEY));
    name = normalizeSocialRacerName(storage?.getItem?.(RACER_NAME_KEY));
  } catch (_) {}

  if (!id) {
    id = createSocialRacerId();
    try {
      storage?.setItem?.(RACER_ID_KEY, id);
    } catch (_) {}
  }

  return Object.freeze({ id, name });
}

export function saveSocialRacerName(value) {
  const name = normalizeSocialRacerName(value);
  if (!name) return '';
  try {
    sharedStorage()?.setItem?.(RACER_NAME_KEY, name);
  } catch (_) {}
  return name;
}

export function adoptSocialRacerIdentity({ id, name } = {}) {
  const racerId = normalizeSocialRacerId(id);
  const racerName = normalizeSocialRacerName(name);
  if (!racerId) return loadSocialRacerProfile();

  const storage = sharedStorage();
  try {
    storage?.setItem?.(RACER_ID_KEY, racerId);
    if (racerName) storage?.setItem?.(RACER_NAME_KEY, racerName);
  } catch (_) {}

  return Object.freeze({ id: racerId, name: racerName });
}
