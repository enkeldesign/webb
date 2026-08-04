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
} from './trophy-road.js?revision=r157-paint-monster';

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

  function ensureLockNotice() {
    let notice = colors.querySelector('.lot-paint-lock');
    if (notice) return notice;
    const reward = getTrophyRoadReward(PAINT_REWARD_ID);
    notice = document.createElement('button');
    notice.type = 'button';
    notice.className = 'lot-paint-lock';
    notice.innerHTML = `
      <span aria-hidden="true">${LOCK_ICON}</span>
      <strong>PAINTJOB</strong>
      <small>UNLOCKS AT ${reward?.threshold || 500} TROPHIES</small>`;
    notice.setAttribute(
      'aria-label',
      `Paint controls locked. Paintjob unlocks at ${reward?.threshold || 500} trophies on Trophy Road.`
    );
    notice.addEventListener('click', () => showTrophyUnlockNotice({
      reward,
      itemName: 'Vehicle paint controls'
    }));
    colors.prepend(notice);
    return notice;
  }

  function sync() {
    if (syncing) return;
    syncing = true;

    const carId = selectedCarId(screen);
    const car = CAR_BY_ID.get(carId);
    const paintUnlocked = isPaintUnlocked();
    const changedCar = Boolean(carId) && carId !== lastCarId;
    const controls = [...colors.querySelectorAll('.lot-color-control:not(.lot-fixed-livery)')];

    if (car && !car.fixedLivery && (!paintUnlocked || changedCar)) forceFactoryPaint(carId);

    const locked = Boolean(car && !car.fixedLivery && !paintUnlocked);
    colors.classList.toggle('is-paint-locked', locked);
    colors.querySelector('.lot-paint-lock')?.remove();

    for (const control of controls) {
      control.hidden = locked;
      const input = control.querySelector('input');
      if (input) input.disabled = locked;
    }

    if (locked) {
      ensureLockNotice();
      colors.setAttribute('aria-label', 'Vehicle paint controls locked');
    } else if (car && !car.fixedLivery) {
      colors.setAttribute('aria-label', 'Choose car paint colours');
    }

    if (!paintWasUnlocked && paintUnlocked) {
      window.dispatchEvent(new CustomEvent('turn:paint-controls-unlocked'));
    }
    paintWasUnlocked = paintUnlocked;
    lastCarId = carId;
    screen.dataset.turnPaintUnlocked = String(paintUnlocked);
    syncing = false;
  }

  const observer = new MutationObserver(sync);
  observer.observe(screen, {
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
    colors.querySelector('.lot-paint-lock')?.remove();
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
