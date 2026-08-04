import {
  isVehicleUnlocked,
  rewardForVehicle
} from './trophy-road.js?revision=r153-trophy-road';

const FALLBACK_VEHICLE_ID = 'classic';
const activeGates = new WeakMap();

function findLotScreen(root) {
  if (root?.matches?.('.lot-screen')) return root;
  return root?.querySelector?.('.lot-screen') || null;
}

function selectedCarButton(carPicker) {
  return [...carPicker.querySelectorAll('.lot-car-option')]
    .find((button) => button.getAttribute('aria-checked') === 'true')
    || carPicker.querySelector('.lot-car-option[tabindex="0"]')
    || carPicker.querySelector('.lot-car-option');
}

export function gateLotNow(root = document.body) {
  const screen = findLotScreen(root);
  if (!screen) return () => {};
  const existing = activeGates.get(screen);
  if (existing) return existing.release;

  const carPicker = screen.querySelector('.lot-car-picker');
  const raceButton = screen.querySelector('.lot-race');
  const colors = screen.querySelector('.lot-colors');
  const description = screen.querySelector('.lot-car-description');
  if (!carPicker || !raceButton || !colors || !description) return () => {};

  const lockMessage = document.createElement('div');
  lockMessage.className = 'lot-lock-message';
  lockMessage.hidden = true;
  lockMessage.setAttribute('role', 'status');
  description.insertAdjacentElement('afterend', lockMessage);

  let initialSelectionChecked = false;
  let syncing = false;

  function decorateButtons() {
    for (const button of carPicker.querySelectorAll('.lot-car-option')) {
      const reward = rewardForVehicle(button.dataset.carId);
      const locked = Boolean(reward) && !isVehicleUnlocked(button.dataset.carId);
      button.classList.toggle('is-trophy-locked', locked);
      button.setAttribute('aria-disabled', String(locked));
      if (reward) {
        button.dataset.trophyLockLabel = `${reward.threshold} TROPHIES`;
      } else {
        delete button.dataset.trophyLockLabel;
      }
      const name = button.textContent.trim() || 'Vehicle';
      button.setAttribute(
        'aria-label',
        locked
          ? `${name}. Locked. Unlocks at ${reward.threshold} trophies on Trophy Road.`
          : name
      );
    }
  }

  function sync() {
    if (syncing) return;
    syncing = true;
    decorateButtons();

    const selected = selectedCarButton(carPicker);
    const selectedId = selected?.dataset.carId || '';
    const reward = rewardForVehicle(selectedId);
    const locked = Boolean(reward) && !isVehicleUnlocked(selectedId);

    if (!initialSelectionChecked) {
      initialSelectionChecked = true;
      if (locked) {
        const fallback = carPicker.querySelector(`[data-car-id="${FALLBACK_VEHICLE_ID}"]`);
        syncing = false;
        fallback?.click();
        return;
      }
    }

    colors.hidden = locked;
    raceButton.disabled = locked;
    if (locked) {
      raceButton.textContent = `UNLOCKS AT ${reward.threshold} TROPHIES`;
      raceButton.setAttribute(
        'aria-label',
        `${reward.shortTitle} is locked. Unlocks at ${reward.threshold} trophies on Trophy Road.`
      );
      lockMessage.innerHTML = `<strong>UNLOCKS AT ${reward.threshold} TROPHIES</strong><small>${reward.description}</small>`;
      lockMessage.hidden = false;
    } else {
      raceButton.textContent = 'RACE THIS CAR';
      lockMessage.hidden = true;
      lockMessage.replaceChildren();
    }
    syncing = false;
  }

  const observer = new MutationObserver(sync);
  observer.observe(carPicker, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['aria-checked']
  });
  sync();

  const release = () => {
    observer.disconnect();
    lockMessage.remove();
    activeGates.delete(screen);
  };
  activeGates.set(screen, { release });
  return release;
}

export function installLotTrophyGateRuntime(root = document.body) {
  let currentScreen = null;
  let releaseCurrent = () => {};

  const sync = () => {
    const nextScreen = findLotScreen(root);
    if (nextScreen === currentScreen) return;
    releaseCurrent();
    currentScreen = nextScreen;
    releaseCurrent = nextScreen ? gateLotNow(nextScreen) : () => {};
  };

  const observer = new MutationObserver(sync);
  observer.observe(root, { childList: true, subtree: true });
  sync();

  const runtime = Object.freeze({
    sync,
    disconnect() {
      observer.disconnect();
      releaseCurrent();
      currentScreen = null;
      releaseCurrent = () => {};
    }
  });
  globalThis.__turnLotTrophyGate = runtime;
  return runtime;
}
