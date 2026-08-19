import {
  CAR_CATALOG,
  getVehicleDefaultColor,
  getVehicleDefaultSecondaryColor
} from '../vehicle/catalog.js?build=20260804-r157-factory-colors';
import {
  LOCK_ICON,
  isPaintUnlocked,
  getTrophyRoadReward,
  showTrophyUnlockNotice
} from './trophy-road.js?revision=r166-bella-records';

const PAINT_REWARD_ID = 'paintjob';
const CAR_BY_ID = new Map(CAR_CATALOG.map((car) => [car.id, car]));
const activeGates = new WeakMap();

function findLotScreen(root) {
  if (root?.matches?.('.lot-screen')) return root;
  return root?.querySelector?.('.lot-screen') || null;
}

function selectedCarId(screen) {
  return screen.querySelector('.lot-car-option[aria-checked="true"]')?.dataset.carId || '';
}

function setInputValue(input, value) {
  if (!input || input.value.toLowerCase() === value.toLowerCase()) return;
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function contrastingInk(hexColor) {
  const match = /^#([0-9a-f]{6})$/i.exec(hexColor || '');
  if (!match) return '#08090a';
  const channels = [0, 2, 4].map((offset) => Number.parseInt(match[1].slice(offset, offset + 2), 16) / 255);
  const linear = channels.map((channel) => (
    channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4
  ));
  const luminance = linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  return luminance > 0.18 ? '#08090a' : '#fffdf6';
}

export function gateLotPaintNow(root = document.body) {
  const screen = findLotScreen(root);
  if (!screen) return () => {};
  const existing = activeGates.get(screen);
  if (existing) return existing.release;

  const colors = screen.querySelector('.lot-colors');
  const raceButton = screen.querySelector('.lot-race');
  const picker = screen.querySelector('.lot-car-picker');
  if (!colors || !raceButton || !picker) return () => {};

  let syncing = false;
  let lastCarId = selectedCarId(screen);
  let paintWasUnlocked = isPaintUnlocked();

  function forceFactoryPaint(carId) {
    const car = CAR_BY_ID.get(carId);
    if (!car || car.fixedLivery) return;
    const controls = [...colors.querySelectorAll('.lot-color-control')];
    const body = controls.find((control) => control.dataset.paintLabel?.toLowerCase() === 'body')
      ?.querySelector('input[type="color"]');
    const secondary = controls.find((control) => control.dataset.paintLabel?.toLowerCase() !== 'body')
      ?.querySelector('input[type="color"]');
    setInputValue(body, getVehicleDefaultColor(carId));
    setInputValue(secondary, getVehicleDefaultSecondaryColor(carId));
  }

  function reward() {
    return getTrophyRoadReward(PAINT_REWARD_ID);
  }

  function showLockedPaintInfo() {
    showTrophyUnlockNotice({
      reward: reward(),
      itemName: 'Vehicle paint controls'
    });
  }

  function applyLockColour(icon, carId) {
    const bodyColour = getVehicleDefaultColor(carId);
    icon.style.setProperty('--lot-paint-lock-background', bodyColour);
    icon.style.setProperty('--lot-paint-lock-foreground', contrastingInk(bodyColour));
  }

  function ensureLockButton(carId) {
    let button = colors.querySelector('.lot-paint-lock-button');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'lot-paint-lock-button';

      const copy = document.createElement('span');
      copy.className = 'lot-paint-lock-copy';
      copy.innerHTML = '<strong>PAINTJOB</strong>';

      const icon = document.createElement('span');
      icon.className = 'lot-paint-lock';
      icon.setAttribute('aria-hidden', 'true');
      icon.innerHTML = LOCK_ICON;

      button.append(copy, icon);
      button.addEventListener('click', showLockedPaintInfo);
      colors.prepend(button);
    }

    const threshold = reward()?.threshold || 900;
    button.setAttribute(
      'aria-label',
      `Paintjob locked. Vehicle paint controls unlock at ${threshold} trophies on Trophy Road.`
    );
    applyLockColour(button.querySelector('.lot-paint-lock'), carId);
    return button;
  }

  function removeLockPresentation() {
    colors.querySelector('.lot-paint-lock-button')?.remove();
  }

  function sync() {
    if (syncing) return;
    syncing = true;

    try {
      const carId = selectedCarId(screen);
      const car = CAR_BY_ID.get(carId);
      const paintUnlocked = isPaintUnlocked();
      const changedCar = Boolean(carId) && carId !== lastCarId;
      const controls = [...colors.querySelectorAll('.lot-color-control:not(.lot-fixed-livery)')];

      if (car && !car.fixedLivery && (!paintUnlocked || changedCar)) forceFactoryPaint(carId);

      const locked = Boolean(car && !car.fixedLivery && !paintUnlocked);
      colors.classList.toggle('is-paint-locked', locked);

      for (const control of controls) {
        control.hidden = locked;
        const input = control.querySelector('input');
        if (input) input.disabled = locked;
      }

      if (locked) ensureLockButton(carId);
      else removeLockPresentation();

      if (!paintWasUnlocked && paintUnlocked) {
        window.dispatchEvent(new CustomEvent('turn:paint-controls-unlocked'));
      }
      paintWasUnlocked = paintUnlocked;
      lastCarId = carId;
      screen.dataset.turnPaintUnlocked = String(paintUnlocked);
    } finally {
      syncing = false;
    }
  }

  const observer = new MutationObserver(sync);
  // Observe only the car picker. The lock presentation lives in the separate
  // paint rail, so adding or removing it cannot recursively trigger this observer.
  observer.observe(picker, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['aria-checked']
  });

  const handleReward = sync;
  const handleStorage = (event) => {
    if (event.key === 'turn-achievements-v1') sync();
  };
  window.addEventListener('turn:trophy-road-updated', handleReward);
  window.addEventListener('storage', handleStorage);
  raceButton.addEventListener('click', sync, { capture: true });
  sync();

  const release = () => {
    observer.disconnect();
    window.removeEventListener('turn:trophy-road-updated', handleReward);
    window.removeEventListener('storage', handleStorage);
    raceButton.removeEventListener('click', sync, { capture: true });
    removeLockPresentation();
    for (const control of colors.querySelectorAll('.lot-color-control')) {
      control.hidden = false;
      const input = control.querySelector('input');
      if (input) input.disabled = false;
    }
    colors.classList.remove('is-paint-locked');
    delete screen.dataset.turnPaintUnlocked;
    activeGates.delete(screen);
  };

  activeGates.set(screen, { release });
  return release;
}
