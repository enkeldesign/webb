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

  const originalRole = colors.getAttribute('role');
  const originalTabIndex = colors.getAttribute('tabindex');
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

  function ensureLockLabel() {
    let label = colors.querySelector('.lot-paint-lock-copy');
    if (label) return label;
    label = document.createElement('span');
    label.className = 'lot-paint-lock-copy';
    label.setAttribute('aria-hidden', 'true');
    label.innerHTML = '<strong>Paintjob</strong><i>•</i><b>LOCKED</b>';
    colors.prepend(label);
    return label;
  }

  function ensureLockIcon() {
    let icon = colors.querySelector('.lot-paint-lock');
    if (icon) return icon;
    icon = document.createElement('span');
    icon.className = 'lot-paint-lock';
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = LOCK_ICON;
    colors.append(icon);
    return icon;
  }

  function removeLockPresentation() {
    colors.querySelector('.lot-paint-lock-copy')?.remove();
    colors.querySelector('.lot-paint-lock')?.remove();
  }

  function setLockedInteraction(locked) {
    if (locked) {
      const threshold = reward()?.threshold || 500;
      colors.setAttribute('role', 'button');
      colors.tabIndex = 0;
      colors.setAttribute(
        'aria-label',
        `Paintjob locked. Vehicle paint controls unlock at ${threshold} trophies on Trophy Road.`
      );
      ensureLockLabel();
      ensureLockIcon();
      return;
    }

    removeLockPresentation();
    if (originalRole == null) colors.removeAttribute('role');
    else colors.setAttribute('role', originalRole);
    if (originalTabIndex == null) colors.removeAttribute('tabindex');
    else colors.setAttribute('tabindex', originalTabIndex);
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

      setLockedInteraction(locked);
      if (!locked && car && !car.fixedLivery) {
        colors.setAttribute('aria-label', 'Choose car paint colours');
      }

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

  const handleLockedAreaClick = (event) => {
    if (!colors.classList.contains('is-paint-locked')) return;
    event.preventDefault();
    showLockedPaintInfo();
  };
  const handleLockedAreaKeydown = (event) => {
    if (!colors.classList.contains('is-paint-locked')) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    showLockedPaintInfo();
  };
  const handleReward = sync;
  const handleStorage = (event) => {
    if (event.key === 'turn-achievements-v1') sync();
  };
  window.addEventListener('turn:trophy-road-updated', handleReward);
  window.addEventListener('storage', handleStorage);
  raceButton.addEventListener('click', sync, { capture: true });
  colors.addEventListener('click', handleLockedAreaClick);
  colors.addEventListener('keydown', handleLockedAreaKeydown);
  sync();

  const release = () => {
    observer.disconnect();
    window.removeEventListener('turn:trophy-road-updated', handleReward);
    window.removeEventListener('storage', handleStorage);
    raceButton.removeEventListener('click', sync, { capture: true });
    colors.removeEventListener('click', handleLockedAreaClick);
    colors.removeEventListener('keydown', handleLockedAreaKeydown);
    removeLockPresentation();
    for (const control of colors.querySelectorAll('.lot-color-control')) {
      control.hidden = false;
      const input = control.querySelector('input');
      if (input) input.disabled = false;
    }
    colors.classList.remove('is-paint-locked');
    if (originalRole == null) colors.removeAttribute('role');
    else colors.setAttribute('role', originalRole);
    if (originalTabIndex == null) colors.removeAttribute('tabindex');
    else colors.setAttribute('tabindex', originalTabIndex);
    delete screen.dataset.turnPaintUnlocked;
    activeGates.delete(screen);
  };

  activeGates.set(screen, { release });
  return release;
}
