import { getCarDefinition } from '../vehicle/catalog.js?revision=r243-mountain-1300';
import {
  isFeatureUnlocked,
  isVehiclePerkUnlocked,
  rewardForFeature,
  showTrophyUnlockNotice
} from '../progression/trophy-road.js?revision=r243-mountain-1300';
import {
  VEHICLE_SHIFT_FEATURE_ID,
  VEHICLE_SHIFT_STAT_FIELDS,
  loadVehicleShiftProfile,
  requiredVehicleShiftReceivers,
  saveVehicleShiftProfile,
  setVehicleShiftProfileEnabled,
  vehicleShiftAmount,
  vehicleShiftReceiversForReducers,
  vehicleShiftReducersForReceivers,
  vehicleStatsSupportShift
} from '../vehicle/shift-profile.js?revision=r232-double-shift';
import {
  VEHICLE_SHIFT_LEVER_STATES,
  resolveVehicleShiftGearbox
} from './lot-shift-gearbox.js?revision=r232-double-shift';

const activeShiftSetups = new WeakMap();
let dialogSerial = 0;

function findLotScreen(root) {
  if (root?.matches?.('.lot-screen')) return root;
  return root?.querySelector?.('.lot-screen') || null;
}

function selectedCarId(carPicker) {
  return carPicker?.querySelector?.('.lot-car-option[aria-checked="true"]')?.dataset.carId
    || carPicker?.querySelector?.('.lot-car-option[tabindex="0"]')?.dataset.carId
    || '';
}

function focusWithoutScroll(element) {
  if (!element) return;
  try {
    element.focus({ preventScroll: true });
  } catch (_) {
    element.focus();
  }
}

function announceProfileChange(vehicleId, profile) {
  const EventConstructor = globalThis.CustomEvent;
  if (typeof globalThis.dispatchEvent !== 'function' || typeof EventConstructor !== 'function') return;
  globalThis.dispatchEvent(new EventConstructor('turn:shift-profile-change', {
    detail: { vehicleId, profile }
  }));
}

export function installLotShift(root = document.body) {
  const screen = findLotScreen(root);
  if (!screen?.classList.contains('lot-showroom')) return () => {};

  const existing = activeShiftSetups.get(screen);
  if (existing) return existing.release;

  const attributesRow = screen.querySelector('.lot-attributes-row');
  const carPicker = screen.querySelector('.lot-car-picker');
  if (!attributesRow || !carPicker) return () => {};

  dialogSerial += 1;
  const dialogId = `turn-lot-shift-dialog-${dialogSerial}`;
  const titleId = `${dialogId}-title`;
  const descriptionId = `${dialogId}-description`;

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'lot-shift-trigger';
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-controls', dialogId);
  trigger.innerHTML = '<span>ACTIVATE SHIFT</span><i aria-hidden="true">●</i>';
  attributesRow.appendChild(trigger);

  const dialog = document.createElement('dialog');
  dialog.className = 'lot-shift-dialog';
  dialog.id = dialogId;
  dialog.setAttribute('aria-labelledby', titleId);
  dialog.setAttribute('aria-describedby', descriptionId);
  dialog.innerHTML = `
    <section class="lot-shift-dialog-card">
      <header class="lot-shift-dialog-head">
        <div><span>ALTERNATE SETUP</span><h2 id="${titleId}">SHIFT</h2></div>
        <button type="button" class="lot-shift-close" aria-label="Close SHIFT setup">×</button>
      </header>
      <p id="${descriptionId}" class="lot-shift-description">Move three attribute levers up by 1. The other three move down by 1 automatically. Attributes at 1 must move up; attributes at 5 must move down. During a race, slide from GAS into SHIFT to switch on or off.</p>
      <div class="lot-shift-options" role="group" aria-label="SHIFT attribute gearbox. Choose three attributes to gain one point."></div>
      <p class="lot-shift-status" role="status" aria-live="polite"></p>
      <div class="lot-shift-actions">
        <button type="button" class="lot-shift-cancel">CANCEL</button>
        <button type="button" class="lot-shift-deactivate">DEACTIVATE SHIFT</button>
        <button type="button" class="lot-shift-save" disabled>ACTIVATE SHIFT</button>
      </div>
    </section>`;
  screen.appendChild(dialog);

  const triggerLabel = trigger.querySelector('span');
  const title = dialog.querySelector('h2');
  const options = dialog.querySelector('.lot-shift-options');
  const status = dialog.querySelector('.lot-shift-status');
  const closeButton = dialog.querySelector('.lot-shift-close');
  const cancelButton = dialog.querySelector('.lot-shift-cancel');
  const deactivateButton = dialog.querySelector('.lot-shift-deactivate');
  const saveButton = dialog.querySelector('.lot-shift-save');
  const reward = rewardForFeature(VEHICLE_SHIFT_FEATURE_ID);
  let editingVehicleId = '';
  let editingStats = null;
  let editingProfile = null;
  let editingShiftAmount = 1;
  let selectedReceivers = new Set();
  let previousFocus = null;
  let currentGearbox = null;
  let constraintFeedbackTimer = 0;
  let constraintFeedbackOption = null;

  function rewardUnlocked() {
    return !reward || isFeatureUnlocked(VEHICLE_SHIFT_FEATURE_ID);
  }

  function selectedDefinition() {
    const carId = selectedCarId(carPicker);
    return carId ? getCarDefinition(carId) : null;
  }

  function shiftAmountForCar(car) {
    return car ? vehicleShiftAmount(car.id, isVehiclePerkUnlocked(car.id)) : 1;
  }

  function syncTrigger() {
    const car = selectedDefinition();
    const unlocked = rewardUnlocked();
    const supported = Boolean(car && vehicleStatsSupportShift(car.stats));
    const shiftAmount = shiftAmountForCar(car);
    const profile = car && supported
      ? loadVehicleShiftProfile(car.id, car.stats, undefined, shiftAmount)
      : null;
    const active = unlocked && profile?.enabled === true;

    trigger.classList.toggle('is-locked', !unlocked);
    trigger.classList.toggle('is-active', active);
    trigger.classList.toggle('is-unavailable', unlocked && !supported);
    trigger.disabled = unlocked && !supported;
    trigger.setAttribute('aria-disabled', String(!unlocked || !supported));

    if (!unlocked) {
      triggerLabel.textContent = `SHIFT · ${reward?.threshold || 1000}`;
      trigger.setAttribute(
        'aria-label',
        `SHIFT for ${car?.name || 'this car'} is locked. Unlocks at ${reward?.threshold || 1000} trophies.`
      );
      return;
    }
    if (!supported) {
      triggerLabel.textContent = 'SHIFT UNAVAILABLE';
      trigger.setAttribute('aria-label', `SHIFT is unavailable for ${car?.name || 'this special setup'}.`);
      return;
    }

    triggerLabel.textContent = active ? 'EDIT SHIFT' : 'ACTIVATE SHIFT';
    trigger.setAttribute(
      'aria-label',
      active
        ? `Edit SHIFT for ${car.name}. SHIFT setup active.`
        : `Activate SHIFT for ${car.name}.`
    );
  }

  function makeOption(field) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'lot-shift-option';
    button.dataset.shiftStat = field.key;
    button.innerHTML = `
      <strong class="lot-shift-option-label">${field.label}</strong>
      <span class="lot-shift-lever" aria-hidden="true">
        <i class="lot-shift-lever-track"></i>
        <span class="lot-shift-lever-knob"><span data-shift-value></span></span>
      </span>`;
    button.addEventListener('click', handleOptionClick);
    return button;
  }

  function leverAriaLabel(lever) {
    const amount = Math.abs(lever.shiftedValue - lever.baseValue);
    const points = `${amount} ${amount === 1 ? 'point' : 'points'}`;
    const value = lever.state === VEHICLE_SHIFT_LEVER_STATES.NEUTRAL
      ? String(lever.baseValue)
      : `${lever.baseValue} to ${lever.shiftedValue}`;
    if (lever.forced && lever.state === VEHICLE_SHIFT_LEVER_STATES.GAIN) {
      return `${lever.label}, ${value}. Must gain ${points} because it is at the minimum.`;
    }
    if (lever.forced) {
      return `${lever.label}, ${value}. Must lose ${points} because it is at the maximum.`;
    }
    if (lever.selectedToGain) {
      return `${lever.label}, ${value}. Selected to gain ${points}. Activate to return this lever to neutral.`;
    }
    if (lever.automaticallyLoses) {
      return `${lever.label}, ${value}. Automatically loses ${points} because three gains are selected.`;
    }
    return `${lever.label}, ${value}. Neutral. Activate to make this attribute gain ${editingShiftAmount} ${editingShiftAmount === 1 ? 'point' : 'points'}.`;
  }

  function renderOptions() {
    if (!editingStats) return;
    const gearbox = resolveVehicleShiftGearbox(editingStats, [...selectedReceivers], editingShiftAmount);
    if (!gearbox) return;
    currentGearbox = gearbox;
    selectedReceivers = new Set(gearbox.selectedReceivers);
    options.classList.toggle('is-complete', gearbox.complete);

    for (const option of options.querySelectorAll('.lot-shift-option')) {
      const key = option.dataset.shiftStat;
      const lever = gearbox.levers.find((candidate) => candidate.key === key);
      if (!lever) continue;

      option.dataset.leverState = lever.state;
      option.setAttribute('aria-pressed', String(lever.selectedToGain));
      option.setAttribute('aria-disabled', String(!lever.interactive));
      option.classList.toggle('is-gain', lever.state === VEHICLE_SHIFT_LEVER_STATES.GAIN);
      option.classList.toggle('is-neutral', lever.state === VEHICLE_SHIFT_LEVER_STATES.NEUTRAL);
      option.classList.toggle('is-loss', lever.state === VEHICLE_SHIFT_LEVER_STATES.LOSS);
      option.classList.toggle('is-forced', lever.forced);
      option.classList.toggle('is-automatic', lever.automaticallyLoses);
      option.querySelector('[data-shift-value]').textContent = lever.displayValue;
      option.setAttribute('aria-label', leverAriaLabel(lever));
    }

    saveButton.disabled = !gearbox.complete;
    saveButton.textContent = editingProfile?.enabled ? 'SAVE SHIFT' : 'ACTIVATE SHIFT';
    deactivateButton.hidden = editingProfile?.enabled !== true;
    if (gearbox.complete) {
      status.textContent = `Ready. Three attributes gain ${editingShiftAmount}, three lose ${editingShiftAmount}, and the total stays 18.`;
    } else {
      const remaining = 3 - gearbox.selectedReceivers.length;
      status.textContent = `${gearbox.selectedReceivers.length} of 3 upward levers set. Choose ${remaining} more.`;
    }
  }

  function constraintMessage(lever) {
    if (lever.forced && lever.state === VEHICLE_SHIFT_LEVER_STATES.GAIN) {
      return `${lever.label} is fixed at ${lever.baseValue}→${lever.shiftedValue}. It must gain ${editingShiftAmount} ${editingShiftAmount === 1 ? 'point' : 'points'} to stay within the gearbox.`;
    }
    if (lever.forced && lever.state === VEHICLE_SHIFT_LEVER_STATES.LOSS) {
      return `${lever.label} is fixed at ${lever.baseValue}→${lever.shiftedValue}. It must lose ${editingShiftAmount} ${editingShiftAmount === 1 ? 'point' : 'points'} to stay within the gearbox.`;
    }
    if (lever.automaticallyLoses) {
      return `${lever.label} is set automatically. Move one green lever back to neutral before choosing a different gain.`;
    }
    return `${lever.label} cannot move from its current position.`;
  }

  function showConstraintFeedback(option, lever) {
    window.clearTimeout(constraintFeedbackTimer);
    constraintFeedbackOption?.classList.remove('has-constraint-feedback');
    constraintFeedbackOption = option;
    option.classList.remove('has-constraint-feedback');
    void option.offsetWidth;
    option.classList.add('has-constraint-feedback');
    status.textContent = constraintMessage(lever);
    try {
      navigator.vibrate?.(8);
    } catch (_) {}
    constraintFeedbackTimer = window.setTimeout(() => {
      option.classList.remove('has-constraint-feedback');
      if (constraintFeedbackOption === option) constraintFeedbackOption = null;
      constraintFeedbackTimer = 0;
    }, 720);
  }

  function handleOptionClick(event) {
    const option = event.currentTarget;
    const key = option.dataset.shiftStat;
    const lever = currentGearbox?.levers.find((candidate) => candidate.key === key);
    if (!lever) return;
    if (!lever.interactive) {
      showConstraintFeedback(option, lever);
      return;
    }
    if (selectedReceivers.has(key)) {
      selectedReceivers.delete(key);
    } else {
      if (selectedReceivers.size < 3) selectedReceivers.add(key);
    }
    renderOptions();
  }

  function openDialog() {
    const car = selectedDefinition();
    if (!rewardUnlocked()) {
      showTrophyUnlockNotice({ reward, itemName: 'SHIFT' });
      return;
    }
    if (!car || !vehicleStatsSupportShift(car.stats)) return;

    editingVehicleId = car.id;
    editingStats = car.stats;
    editingShiftAmount = shiftAmountForCar(car);
    editingProfile = loadVehicleShiftProfile(car.id, car.stats, undefined, editingShiftAmount);
    const reducedStats = new Set(editingProfile?.reducedStats || []);
    selectedReceivers = new Set(
      editingProfile
        ? vehicleShiftReceiversForReducers([...reducedStats])
        : requiredVehicleShiftReceivers(car.stats, editingShiftAmount)
    );
    const points = `${editingShiftAmount} ${editingShiftAmount === 1 ? 'point' : 'points'}`;
    dialog.querySelector('.lot-shift-description').textContent =
      `Move three attribute levers up by ${points}. The other three move down by ${points} automatically. Attributes that cannot move down must move up; attributes that cannot move up must move down. During a race, slide from GAS into SHIFT to switch on or off.`;
    options.setAttribute(
      'aria-label',
      `SHIFT attribute gearbox. Choose three attributes to gain ${points}.`
    );
    title.textContent = `SHIFT · ${car.name.toUpperCase()}`;
    options.replaceChildren(...VEHICLE_SHIFT_STAT_FIELDS.map(makeOption));
    renderOptions();
    previousFocus = document.activeElement;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    focusWithoutScroll(closeButton);
  }

  function closeDialog() {
    if (dialog.open && typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
    focusWithoutScroll(previousFocus?.isConnected ? previousFocus : trigger);
  }

  function saveProfile() {
    if (!editingVehicleId || !editingStats) return;
    const reducedStats = vehicleShiftReducersForReceivers([...selectedReceivers]);
    const saved = saveVehicleShiftProfile({
      vehicleId: editingVehicleId,
      stats: editingStats,
      reducedStats,
      enabled: true,
      shiftAmount: editingShiftAmount
    });
    if (!saved) return;
    editingProfile = saved;
    announceProfileChange(editingVehicleId, saved);
    syncTrigger();
    closeDialog();
  }

  function deactivateProfile() {
    if (!editingVehicleId || !editingStats) return;
    const saved = setVehicleShiftProfileEnabled(
      editingVehicleId,
      editingStats,
      false,
      undefined,
      editingShiftAmount
    );
    if (!saved) return;
    editingProfile = saved;
    announceProfileChange(editingVehicleId, saved);
    syncTrigger();
    closeDialog();
  }

  function handleDialogClick(event) {
    if (event.target === dialog) closeDialog();
  }

  function handleDialogCancel(event) {
    event.preventDefault();
    closeDialog();
  }

  trigger.addEventListener('click', openDialog);
  closeButton.addEventListener('click', closeDialog);
  cancelButton.addEventListener('click', closeDialog);
  saveButton.addEventListener('click', saveProfile);
  deactivateButton.addEventListener('click', deactivateProfile);
  dialog.addEventListener('click', handleDialogClick);
  dialog.addEventListener('cancel', handleDialogCancel);

  const selectionObserver = new MutationObserver(syncTrigger);
  selectionObserver.observe(carPicker, {
    subtree: true,
    attributes: true,
    attributeFilter: ['aria-checked']
  });
  globalThis.addEventListener?.('turn:trophy-road-updated', syncTrigger);
  globalThis.addEventListener?.('turn:shift-profile-change', syncTrigger);
  syncTrigger();

  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    window.clearTimeout(constraintFeedbackTimer);
    constraintFeedbackOption?.classList.remove('has-constraint-feedback');
    selectionObserver.disconnect();
    globalThis.removeEventListener?.('turn:trophy-road-updated', syncTrigger);
    globalThis.removeEventListener?.('turn:shift-profile-change', syncTrigger);
    trigger.removeEventListener('click', openDialog);
    dialog.removeEventListener('click', handleDialogClick);
    dialog.removeEventListener('cancel', handleDialogCancel);
    if (dialog.open && typeof dialog.close === 'function') dialog.close();
    dialog.remove();
    trigger.remove();
    activeShiftSetups.delete(screen);
  };

  activeShiftSetups.set(screen, { release });
  return release;
}
