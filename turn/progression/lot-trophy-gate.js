import {
  LOCK_ICON,
  isVehicleUnlocked,
  rewardForVehicle,
  showTrophyUnlockNotice
} from './trophy-road.js?revision=r157-paint-monster';

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
  const carTitle = screen.querySelector('.lot-car-title strong');
  if (!carPicker || !raceButton) return () => {};

  let initialSelectionChecked = false;
  let lastAnnouncedCarId = '';
  let syncing = false;

  function decorateButtons() {
    for (const button of carPicker.querySelectorAll('.lot-car-option')) {
      const reward = rewardForVehicle(button.dataset.carId);
      const locked = Boolean(reward) && !isVehicleUnlocked(button.dataset.carId);
      button.classList.toggle('is-trophy-locked', locked);
      if (reward) button.dataset.trophyLockLabel = `${reward.threshold} TROPHIES`;
      else delete button.dataset.trophyLockLabel;
      const name = button.textContent.trim() || 'Vehicle';
      button.setAttribute(
        'aria-label',
        locked
          ? `${name}. Locked. Unlocks at ${reward.threshold} trophies on Trophy Road. Select for unlock information.`
          : name
      );
    }
  }

  function setTitleLocked(locked) {
    if (!carTitle) return;
    carTitle.querySelector('.lot-selected-car-lock')?.remove();
    if (!locked) return;
    const lock = document.createElement('span');
    lock.className = 'lot-selected-car-lock';
    lock.setAttribute('aria-hidden', 'true');
    lock.innerHTML = LOCK_ICON;
    carTitle.prepend(lock);
  }

  function setRaceLocked({ locked, reward, selectedName }) {
    raceButton.disabled = locked;
    raceButton.classList.toggle('is-trophy-locked', locked);
    if (locked) {
      raceButton.dataset.trophyLocked = 'true';
      raceButton.innerHTML = `<span class="lot-race-lock-icon" aria-hidden="true">${LOCK_ICON}</span><span>RACE THIS CAR</span>`;
      raceButton.setAttribute('aria-label', `${selectedName} is locked. Unlocks at ${reward.threshold} trophies on Trophy Road.`);
      return;
    }

    delete raceButton.dataset.trophyLocked;
    raceButton.textContent = 'RACE THIS CAR';
    raceButton.setAttribute('aria-label', `Race the ${selectedName}`);
  }

  function sync() {
    if (syncing) return;
    syncing = true;
    decorateButtons();

    const selected = selectedCarButton(carPicker);
    const selectedId = selected?.dataset.carId || '';
    const selectedName = selected?.textContent.trim() || 'Vehicle';
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

    screen.dataset.trophyVehicleLocked = String(locked);
    setTitleLocked(locked);
    setRaceLocked({ locked, reward, selectedName });
    if (locked && selectedId !== lastAnnouncedCarId) {
      lastAnnouncedCarId = selectedId;
      showTrophyUnlockNotice({ reward, itemName: selectedName });
    } else if (!locked) {
      lastAnnouncedCarId = '';
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
  const handleStorage = (event) => {
    if (event.key === 'turn-achievements-v1') sync();
  };
  window.addEventListener('turn:trophy-road-updated', sync);
  window.addEventListener('storage', handleStorage);
  sync();

  const release = () => {
    observer.disconnect();
    window.removeEventListener('turn:trophy-road-updated', sync);
    window.removeEventListener('storage', handleStorage);
    raceButton.classList.remove('is-trophy-locked');
    delete raceButton.dataset.trophyLocked;
    delete screen.dataset.trophyVehicleLocked;
    carTitle?.querySelector('.lot-selected-car-lock')?.remove();
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
