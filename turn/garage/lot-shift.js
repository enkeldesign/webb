import { getCarDefinition } from '../vehicle/catalog.js?revision=r223-training-car-taxi';
import {
  isFeatureUnlocked,
  rewardForFeature,
  showTrophyUnlockNotice
} from '../progression/trophy-road.js?revision=r166-bella-records';
import {
  VEHICLE_SHIFT_FEATURE_ID,
  VEHICLE_SHIFT_STAT_FIELDS,
  blockedVehicleShiftReceivers,
  loadVehicleShiftProfile,
  requiredVehicleShiftReceivers,
  saveVehicleShiftProfile,
  setVehicleShiftProfileEnabled,
  shiftedVehicleStatsFromReceivers,
  vehicleShiftReceiversForReducers,
  vehicleShiftReducersForReceivers,
  vehicleStatsSupportShift
} from '../vehicle/shift-profile.js?revision=r227-shift-feedback';

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
      <p id="${descriptionId}" class="lot-shift-description">Choose three attributes to give +1. The other three get −1 automatically. During a race, slide from GAS into SHIFT to switch on or off.</p>
      <div class="lot-shift-options" role="group" aria-label="Attributes to gain one point in SHIFT"></div>
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
  let selectedReceivers = new Set();
  let previousFocus = null;

  function rewardUnlocked() {
    return !reward || isFeatureUnlocked(VEHICLE_SHIFT_FEATURE_ID);
  }

  function selectedDefinition() {
    const carId = selectedCarId(carPicker);
    return carId ? getCarDefinition(carId) : null;
  }

  function syncTrigger() {
    const car = selectedDefinition();
    const unlocked = rewardUnlocked();
    const supported = Boolean(car && vehicleStatsSupportShift(car.stats));
    const profile = car && supported
      ? loadVehicleShiftProfile(car.id, car.stats)
      : null;
    const active = unlocked && profile?.enabled === true;

    trigger.classList.toggle('is-locked', !unlocked);
    trigger.classList.toggle('is-active', active);
    trigger.classList.toggle('is-unavailable', unlocked && !supported);
    trigger.disabled = unlocked && !supported;
    trigger.setAttribute('aria-disabled', String(!unlocked || !supported));

    if (!unlocked) {
      triggerLabel.textContent = `SHIFT · ${reward?.threshold || 1500}`;
      trigger.setAttribute(
        'aria-label',
        `SHIFT for ${car?.name || 'this car'} is locked. Unlocks at ${reward?.threshold || 1500} trophies.`
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
      <i class="lot-shift-option-plus" aria-hidden="true">+</i>
      <span class="lot-shift-option-copy">
        <strong>${field.label}</strong>
        <small><b data-shift-from></b><i aria-hidden="true">→</i><b data-shift-to></b><em data-shift-direction></em></small>
      </span>`;
    button.addEventListener('click', handleOptionClick);
    return button;
  }

  function renderOptions() {
    if (!editingStats) return;
    // A 1-point attribute must receive +1; a 5-point attribute cannot receive
    // another point. Profiles continue to store the complementary reducers so
    // existing saved SHIFT setups remain compatible.
    const required = new Set(requiredVehicleShiftReceivers(editingStats));
    const blocked = new Set(blockedVehicleShiftReceivers(editingStats));
    for (const key of required) selectedReceivers.add(key);
    const complete = selectedReceivers.size === 3;
    const shifted = complete
      ? shiftedVehicleStatsFromReceivers(editingStats, [...selectedReceivers])
      : null;

    for (const option of options.querySelectorAll('.lot-shift-option')) {
      const key = option.dataset.shiftStat;
      const field = VEHICLE_SHIFT_STAT_FIELDS.find((candidate) => candidate.key === key);
      const selected = selectedReceivers.has(key);
      const isRequired = required.has(key);
      const isBlocked = blocked.has(key);
      const selectionFull = !selected && selectedReceivers.size >= 3;
      const knownReduction = isBlocked || complete;
      const nextValue = selected
        ? editingStats[key] + 1
        : knownReduction
          ? editingStats[key] - 1
          : null;

      option.setAttribute('aria-pressed', String(selected));
      option.setAttribute('aria-disabled', String(isRequired || isBlocked || selectionFull));
      option.classList.toggle('is-selected', selected);
      option.classList.toggle('is-required', isRequired);
      option.classList.toggle('is-blocked', isBlocked);
      option.classList.toggle('is-full', selectionFull && !isBlocked);
      option.querySelector('[data-shift-from]').textContent = String(editingStats[key]);
      option.querySelector('[data-shift-to]').textContent = nextValue == null ? '—' : String(nextValue);
      option.querySelector('[data-shift-direction]').textContent = isRequired
        ? '+1'
        : isBlocked
          ? '−1'
          : selected
            ? '+1'
            : complete
              ? '−1'
              : '';
      option.setAttribute(
        'aria-label',
        `${field?.label || key}, ${editingStats[key]}${nextValue == null ? '' : ` to ${nextValue}`}. ${
          isRequired
            ? 'Selected to gain one point because it is at the minimum.'
            : isBlocked
              ? 'Cannot gain a point because it is already at the maximum.'
              : selected
                ? 'Selected to gain one point.'
                : complete
                  ? 'Will lose one point.'
                  : 'Not selected.'
        }`
      );
    }

    saveButton.disabled = !shifted;
    saveButton.textContent = editingProfile?.enabled ? 'SAVE SHIFT' : 'ACTIVATE SHIFT';
    deactivateButton.hidden = editingProfile?.enabled !== true;
    if (shifted) {
      status.textContent = 'Ready. Three attributes gain 1, three lose 1, and the total stays 18.';
    } else {
      const remaining = Math.max(0, 3 - selectedReceivers.size);
      status.textContent = `${selectedReceivers.size} of 3 +1 attributes selected. Choose ${remaining} more.`;
    }
  }

  function handleOptionClick(event) {
    const option = event.currentTarget;
    if (option.getAttribute('aria-disabled') === 'true') return;
    const key = option.dataset.shiftStat;
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
    editingProfile = loadVehicleShiftProfile(car.id, car.stats);
    const reducedStats = new Set(editingProfile?.reducedStats || []);
    selectedReceivers = new Set(
      editingProfile
        ? vehicleShiftReceiversForReducers([...reducedStats])
        : requiredVehicleShiftReceivers(car.stats)
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
      enabled: true
    });
    if (!saved) return;
    editingProfile = saved;
    announceProfileChange(editingVehicleId, saved);
    syncTrigger();
    closeDialog();
  }

  function deactivateProfile() {
    if (!editingVehicleId || !editingStats) return;
    const saved = setVehicleShiftProfileEnabled(editingVehicleId, editingStats, false);
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
