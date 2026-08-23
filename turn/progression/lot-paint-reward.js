import {
  CAR_CATALOG,
  getVehicleDefaultColor
} from '../vehicle/catalog.js?build=20260804-r157-factory-colors';
import { describeColorCue } from '../accessibility/color-cues.js?revision=r163';
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

function selectedCarButton(screen) {
  return screen.querySelector('.lot-car-option[aria-checked="true"]');
}

function selectedCarId(screen) {
  return selectedCarButton(screen)?.dataset.carId || '';
}

function selectedCarIsLocked(screen) {
  return selectedCarButton(screen)?.classList.contains('is-trophy-locked') === true;
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

function mutationTouchesPaintControl(mutation) {
  return [...mutation.addedNodes, ...mutation.removedNodes].some((node) => (
    node?.nodeType === 1
      && (node.matches?.('.lot-color-control') || node.querySelector?.('.lot-color-control'))
  ));
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

  function paintControl(label = 'body') {
    return [...colors.querySelectorAll('.lot-color-control')]
      .find((control) => String(control.dataset.paintLabel || '').toLowerCase() === label.toLowerCase());
  }

  function bodyColorValue(carId) {
    return paintControl('body')?.querySelector('input[type="color"]')?.value
      || getVehicleDefaultColor(carId);
  }


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
      itemName: 'Car color'
    });
  }

  function ensureVisibleLabel(car) {
    let label = colors.querySelector('.lot-color-visible-label');
    if (!car) {
      label?.remove();
      return null;
    }
    if (!label) {
      label = document.createElement('span');
      label.className = 'lot-color-visible-label';
      label.textContent = 'COLOR';
      label.setAttribute('aria-hidden', 'true');
      colors.prepend(label);
    }
    return label;
  }

  function applyNativeSwatchFace(control) {
    if (!control) return;
    const input = control.querySelector('input[type="color"]');
    if (!input) return;
    control.classList.add('has-turn-color-swatch');
    control.style.setProperty('--lot-color-swatch', input.value);
  }

  function syncNativeSwatchFaces() {
    for (const control of colors.querySelectorAll('.lot-color-control')) {
      applyNativeSwatchFace(control);
    }
  }

  function removeFixedColorDisplay() {
    colors.querySelector('.lot-fixed-color-display')?.remove();
  }

  function ensureFixedColorDisplay(car) {
    let swatch = colors.querySelector('.lot-fixed-color-display');
    if (!car?.fixedLivery) {
      swatch?.remove();
      return null;
    }

    if (!swatch) {
      swatch = document.createElement('span');
      swatch.className = 'lot-fixed-color-display';
      swatch.setAttribute('role', 'img');
      const label = colors.querySelector('.lot-color-visible-label');
      if (label) label.insertAdjacentElement('afterend', swatch);
      else colors.prepend(swatch);
    }

    const primary = getVehicleDefaultColor(car.id);
    const secondary = getVehicleDefaultSecondaryColor(car.id);
    const primaryName = describeColorCue(primary);
    const secondaryName = describeColorCue(secondary);
    swatch.style.setProperty('--lot-fixed-primary', primary);
    swatch.style.setProperty('--lot-fixed-secondary', secondary);
    swatch.classList.toggle('is-two-tone', secondary.toLowerCase() !== primary.toLowerCase());
    swatch.setAttribute(
      'aria-label',
      secondary.toLowerCase() !== primary.toLowerCase()
        ? `Fixed car colors. ${primaryName} and ${secondaryName}.`
        : `Fixed car color. ${primaryName}.`
    );
    swatch.title = 'Fixed vehicle colors';
    return swatch;
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

      const icon = document.createElement('span');
      icon.className = 'lot-paint-lock';
      icon.setAttribute('aria-hidden', 'true');
      icon.innerHTML = LOCK_ICON;

      const copy = document.createElement('span');
      copy.className = 'lot-paint-lock-copy';
      copy.setAttribute('aria-hidden', 'true');

      button.append(icon, copy);
      button.addEventListener('click', showLockedPaintInfo);
      const label = colors.querySelector('.lot-color-visible-label');
      if (label) label.insertAdjacentElement('afterend', button);
      else colors.prepend(button);
    }

    const threshold = reward()?.threshold || 900;
    const copy = button.querySelector('.lot-paint-lock-copy');
    if (copy) copy.innerHTML = `<strong>${threshold} 🏆</strong><small>TO UNLOCK</small>`;
    button.setAttribute(
      'aria-label',
      `Color locked. Car color controls unlock at ${threshold} trophies on Trophy Road.`
    );
    button.title = `Color unlocks at ${threshold} trophies`;
    applyLockColour(button.querySelector('.lot-paint-lock'), carId);
    return button;
  }

  function removeLockPresentation() {
    colors.querySelector('.lot-paint-lock-button')?.remove();
  }

  function colorCueDescription(car) {
    if (!car) return '';
    return describeColorCue(bodyColorValue(car.id)).toUpperCase();
  }

  function ensureVisualColorCue(car) {
    let cue = colors.querySelector('.lot-paint-color-cue');
    if (!car) {
      cue?.remove();
      return null;
    }
    if (!cue) {
      cue = document.createElement('span');
      cue.className = 'turn-color-cue lot-color-cue lot-paint-color-cue';
      cue.setAttribute('aria-hidden', 'true');
    }
    cue.textContent = `CAR COLOR · ${colorCueDescription(car)}`;
    if (cue.parentElement !== colors || cue !== colors.lastElementChild) colors.append(cue);
    return cue;
  }

  function sync() {
    if (syncing) return;
    syncing = true;

    try {
      const carId = selectedCarId(screen);
      const car = CAR_BY_ID.get(carId);
      const paintUnlocked = isPaintUnlocked();
      const changedCar = Boolean(carId) && carId !== lastCarId;
      const carLocked = selectedCarIsLocked(screen);
      const freeColor = Boolean(car && !car.fixedLivery);
      const controls = [...colors.querySelectorAll('.lot-color-control:not(.lot-fixed-livery)')];

      colors.hidden = false;
      colors.removeAttribute('aria-hidden');
      screen.classList.toggle('lot-color-baseline-active', Boolean(car));
      colors.dataset.vehicleColorMode = car?.fixedLivery ? 'fixed' : 'free';
      colors.dataset.paintState = car?.fixedLivery ? 'fixed' : (paintUnlocked ? 'editable' : 'locked');
      colors.dataset.carState = carLocked ? 'locked' : 'unlocked';

      ensureVisibleLabel(car);
      syncNativeSwatchFaces();

      if (freeColor && (!paintUnlocked || changedCar)) forceFactoryPaint(carId);

      const paintLocked = Boolean(freeColor && !paintUnlocked);
      colors.classList.toggle('is-paint-locked', paintLocked);

      for (const control of controls) {
        control.hidden = paintLocked;
        const input = control.querySelector('input');
        if (input) input.disabled = paintLocked;
        applyNativeSwatchFace(control);
      }

      if (car?.fixedLivery) {
        removeLockPresentation();
        ensureFixedColorDisplay(car);
      } else {
        removeFixedColorDisplay();
        if (paintLocked) ensureLockButton(carId);
        else removeLockPresentation();
      }

      ensureVisualColorCue(car);

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
  // Selection and car-lock state are independent inputs to the COLOR baseline.
  // Keep this observer scoped to the picker rather than the Lot screen.
  observer.observe(picker, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['aria-checked', 'class']
  });

  // The showroom replaces native color controls whenever a different paintable car
  // is selected. Watch only direct child-list changes that actually add/remove those
  // controls. Our own label, fixed-display, lock and cue mutations are ignored, so
  // this cannot recreate the old self-observer feedback loop.
  const controlObserver = new MutationObserver((mutations) => {
    if (mutations.some(mutationTouchesPaintControl)) sync();
  });
  controlObserver.observe(colors, { childList: true });

  const handlePaintInput = (event) => {
    if (!event.target?.matches?.('input[type="color"]')) return;
    applyNativeSwatchFace(event.target.closest('.lot-color-control'));
    const car = CAR_BY_ID.get(selectedCarId(screen));
    ensureVisualColorCue(car);
  };
  const handleReward = sync;
  const handleStorage = (event) => {
    if (event.key === 'turn-achievements-v1') sync();
  };
  colors.addEventListener('input', handlePaintInput);
  window.addEventListener('turn:trophy-road-updated', handleReward);
  window.addEventListener('storage', handleStorage);
  raceButton.addEventListener('click', sync, { capture: true });
  sync();

  const release = () => {
    observer.disconnect();
    controlObserver.disconnect();
    colors.removeEventListener('input', handlePaintInput);
    window.removeEventListener('turn:trophy-road-updated', handleReward);
    window.removeEventListener('storage', handleStorage);
    raceButton.removeEventListener('click', sync, { capture: true });
    removeLockPresentation();
    removeFixedColorDisplay();
    colors.querySelector('.lot-color-visible-label')?.remove();
    colors.querySelector('.lot-paint-color-cue')?.remove();
    for (const control of colors.querySelectorAll('.lot-color-control')) {
      control.hidden = false;
      control.classList.remove('has-turn-color-swatch');
      control.style.removeProperty('--lot-color-swatch');
      const input = control.querySelector('input');
      if (input) input.disabled = false;
    }
    colors.classList.remove('is-paint-locked');
    delete colors.dataset.vehicleColorMode;
    delete colors.dataset.paintState;
    delete colors.dataset.carState;
    screen.classList.remove('lot-color-baseline-active');
    delete screen.dataset.turnPaintUnlocked;
    activeGates.delete(screen);
  };

  activeGates.set(screen, { release });
  return release;
}
