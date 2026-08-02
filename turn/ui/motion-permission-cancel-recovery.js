const RETRY_STORAGE_KEY = 'turn-motion-permission-retry-v2';
const DENIED_MESSAGE = 'Motion permission was not granted.';
const BLOCKED_MESSAGE = 'Motion access is still blocked by iOS. Close and reopen TURN to try device rotation again.';
const MAX_RETRY_AGE_MS = 2 * 60 * 1000;

function permissionWasDismissed(error) {
  return error instanceof Error && error.message === DENIED_MESSAGE;
}

function isStandaloneApp(environment) {
  if (environment.navigator?.standalone === true) return true;
  try {
    return environment.matchMedia?.('(display-mode: standalone)')?.matches === true;
  } catch (_) {
    return false;
  }
}

function readCurrentLotSelection(documentRef) {
  const selectedCar = documentRef?.querySelector?.('.lot-car-option[aria-checked="true"]');
  const controls = [...(documentRef?.querySelectorAll?.('.lot-color-control') || [])];
  const selection = {
    carId: selectedCar?.dataset?.carId || null,
    color: null,
    secondaryColor: null
  };

  for (const control of controls) {
    const input = control.querySelector?.('.lot-color-input');
    const label = String(control.dataset?.paintLabel || '').toLowerCase();
    if (!input?.value) continue;
    if (label === 'body') selection.color = input.value;
    else if (!selection.secondaryColor) selection.secondaryColor = input.value;
  }

  return selection;
}

function saveRetryState(environment, documentRef) {
  const storage = environment.sessionStorage;
  if (!storage?.setItem) return false;

  const home = environment.__turnHome || environment.__turnNextHome;
  const state = {
    savedAt: Date.now(),
    trackId: home?.getSelectedTrackId?.() || environment.__turnGetTrackId?.() || null,
    selection: readCurrentLotSelection(documentRef)
  };

  try {
    storage.setItem(RETRY_STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (_) {
    return false;
  }
}

function takeRetryState(environment) {
  const storage = environment.sessionStorage;
  if (!storage?.getItem || !storage?.removeItem) return null;

  try {
    const raw = storage.getItem(RETRY_STORAGE_KEY);
    storage.removeItem(RETRY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || Date.now() - Number(parsed.savedAt) > MAX_RETRY_AGE_MS) return null;
    return parsed;
  } catch (_) {
    return null;
  }
}

function applySelection(runtime, selection) {
  if (!runtime?.state || !selection) return;
  if (selection.carId) runtime.state.vehicleId = selection.carId;
  if (selection.color) runtime.state.vehicleColor = selection.color;
  if (selection.secondaryColor) runtime.state.vehicleSecondaryColor = selection.secondaryColor;
}

function reload(environment) {
  const location = environment.location;
  if (typeof location?.reload !== 'function') return false;
  try {
    location.reload();
    return true;
  } catch (_) {
    return false;
  }
}

function waitForever() {
  return new Promise(() => {});
}

export function installMotionPermissionCancelRecovery({ environment = globalThis } = {}) {
  const documentRef = environment.document;
  const retryState = takeRetryState(environment);
  const MotionEvent = environment.DeviceMotionEvent;
  const requestPermission = MotionEvent?.requestPermission;
  const standaloneApp = isStandaloneApp(environment);
  let standaloneDismissals = 0;

  if (typeof requestPermission === 'function') {
    Object.defineProperty(MotionEvent, 'requestPermission', {
      configurable: true,
      value: async function requestPermissionWithCancelRecovery(...args) {
        try {
          const permission = await requestPermission.apply(this, args);
          standaloneDismissals = 0;
          return permission;
        } catch (error) {
          const lotOpen = documentRef?.body?.classList?.contains?.('turn-lot-open');

          if (permissionWasDismissed(error) && lotOpen && standaloneApp) {
            standaloneDismissals += 1;
            if (standaloneDismissals === 1) throw error;
            throw new Error(BLOCKED_MESSAGE);
          }

          if (
            permissionWasDismissed(error)
            && lotOpen
            && saveRetryState(environment, documentRef)
            && reload(environment)
          ) {
            return waitForever();
          }
          throw error;
        }
      }
    });
  }

  return Object.freeze({
    route: standaloneApp
      ? 'standalone-motion-denial-recovery'
      : 'fresh-document-motion-retry',
    resume(home, runtime = environment.__turnRuntime) {
      if (!retryState || typeof home?.continueToTrack !== 'function') return false;
      applySelection(runtime, retryState.selection);
      const resume = () => {
        void home.continueToTrack();
      };
      if (typeof environment.requestAnimationFrame === 'function') {
        environment.requestAnimationFrame(resume);
      } else {
        environment.setTimeout?.(resume, 0);
      }
      return true;
    }
  });
}
