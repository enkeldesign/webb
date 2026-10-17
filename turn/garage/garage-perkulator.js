// PERKULATOR in GARAGE (#1219), inside the car's PERK disclosure: the car's ORIGINAL
// perk with its rarity and, where that perk may be cloned, CLONE PERK; then the car's
// INSTALLED perk, with INSTALL CLONED PERK, REPLACE and REMOVE. Installing opens a
// sheet of the cloned perks this car may run. Nothing here shows without PERKULATOR,
// and nothing for a locked preview. What may be cloned or installed is
// vehicle/perkulator.js's to say; GARAGE re-renders on its change event.
import { getCarDefinition } from '../vehicle/catalog.js';
import { getVehiclePerk, originalVehiclePerk } from '../vehicle/perks.js';
import {
  clonePerk,
  cloneablePerkFor,
  installPerk,
  installablePerksFor,
  installedPerkFor,
  isPerkCloned,
  isPerkulatorUnlocked,
  removeInstalledPerk
} from '../vehicle/perkulator.js';

const RARITY_LABELS = Object.freeze({
  common: 'COMMON',
  rare: 'RARE',
  epic: 'EPIC',
  legendary: 'LEGENDARY'
});

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function titleCase(name) {
  return String(name || '')
    .toLocaleLowerCase('en')
    .replace(/(^|\s)\p{L}/gu, (character) => character.toLocaleUpperCase('en'));
}

// Rarity in words, on its colour: never the colour alone.
export function rarityChip(perk) {
  const label = RARITY_LABELS[perk?.rarity];
  if (!label) return '';
  return `<span class="turn-pr-chip is-${perk.rarity}"><span class="garage-visually-hidden">Rarity </span>${label}</span>`;
}

function focusWithoutScroll(element) {
  try {
    element?.focus({ preventScroll: true });
  } catch (_) {
    element?.focus();
  }
}

export function createGaragePerkulator({
  documentRef = globalThis.document,
  panel,
  copy,
  dialogHost,
  announce = () => {},
  onSheetToggle = () => {}
}) {
  const meta = documentRef.createElement('p');
  meta.className = 'garage-perk-meta';
  meta.hidden = true;
  copy.before(meta);

  const tools = documentRef.createElement('div');
  tools.className = 'garage-perkulator';
  tools.hidden = true;
  tools.innerHTML = `
    <div class="garage-perk-clone"></div>
    <section class="garage-perk-installed" aria-labelledby="garageInstalledPerkTitle">
      <h4 class="garage-perk-installed-title" id="garageInstalledPerkTitle">INSTALLED PERK</h4>
      <div class="garage-perk-installed-body"></div>
    </section>`;
  copy.after(tools);
  const cloneSlot = tools.querySelector('.garage-perk-clone');
  const installedBody = tools.querySelector('.garage-perk-installed-body');

  const sheet = documentRef.createElement('dialog');
  sheet.className = 'turn-pr-sheet garage-install-perk';
  sheet.setAttribute('aria-labelledby', 'garageInstallPerkTitle');
  sheet.setAttribute('aria-describedby', 'garageInstallPerkLead');
  sheet.innerHTML = `
    <div class="turn-pr-sheet-card">
      <header class="turn-pr-sheet-head">
        <h2 class="turn-pr-sheet-title" id="garageInstallPerkTitle" tabindex="-1">INSTALL CLONED PERK</h2>
        <button class="turn-pr-close" type="button" aria-label="Close Install cloned perk"><span aria-hidden="true">×</span></button>
      </header>
      <div class="turn-pr-sheet-body">
        <p class="garage-install-perk-lead" id="garageInstallPerkLead"></p>
        <ul class="garage-install-perk-list" role="list"></ul>
      </div>
    </div>`;
  dialogHost.appendChild(sheet);
  const sheetLead = sheet.querySelector('.garage-install-perk-lead');
  const sheetList = sheet.querySelector('.garage-install-perk-list');

  let carId = '';
  let sheetTrigger = null;
  // Where focus goes once an action has re-rendered the panel.
  let focusAfterSync = '';

  function perkName(perk) {
    return titleCase(perk.title);
  }

  function originCar(perk) {
    return getCarDefinition(perk.vehicleIds[0]).name;
  }

  function syncClone(own) {
    const cloneable = cloneablePerkFor(carId);
    if (cloneable && !isPerkCloned(cloneable.id)) {
      cloneSlot.innerHTML = `
        <button class="turn-pr-button is-secondary is-compact garage-perk-clone-button" type="button" aria-label="Clone perk: ${escapeHtml(perkName(own))}">CLONE PERK</button>
        <p class="garage-perk-note">Then install it on any other car.</p>`;
    } else if (cloneable) {
      cloneSlot.innerHTML = `<p class="garage-perk-note garage-perk-cloned" tabindex="-1"><span aria-hidden="true">✓</span> CLONED · Install it on any other car.</p>`;
    } else if (own.cloneable !== true) {
      cloneSlot.innerHTML = '<p class="garage-perk-note">LEGENDARY perks stay with their car.</p>';
    } else {
      // A cloneable perk still locked on Trophy Road: its lock note says when.
      cloneSlot.replaceChildren();
    }
  }

  function syncInstalled(own) {
    const car = getCarDefinition(carId);
    const installed = getVehiclePerk(installedPerkFor(carId));
    const choices = installablePerksFor(carId);
    if (installed) {
      installedBody.innerHTML = `
        <p class="garage-perk-installed-name"><strong>${escapeHtml(perkName(installed))}</strong> ${rarityChip(installed)}</p>
        <p class="garage-perk-copy">${escapeHtml(installed.description)}</p>
        <div class="garage-perk-actions">
          <button class="turn-pr-button is-secondary is-compact garage-perk-replace" type="button" aria-haspopup="dialog" aria-label="Replace installed perk: ${escapeHtml(perkName(installed))}">REPLACE</button>
          <button class="turn-pr-button is-secondary is-compact garage-perk-remove" type="button" aria-label="Remove installed perk: ${escapeHtml(perkName(installed))}">REMOVE</button>
        </div>`;
      return installed;
    }
    if (choices.length) {
      installedBody.innerHTML = `
        <p class="garage-perk-note garage-perk-none" tabindex="-1">None. One cloned perk can run beside ${escapeHtml(perkName(own))}.</p>
        <button class="turn-pr-button is-secondary is-compact garage-perk-install" type="button" aria-haspopup="dialog" aria-label="Install cloned perk on ${escapeHtml(car.name)}">INSTALL CLONED PERK</button>`;
    } else {
      installedBody.innerHTML = `<p class="garage-perk-note garage-perk-none" tabindex="-1">None. Clone a perk on another car to install it here.</p>`;
    }
    return null;
  }

  // The car's perk card: returns its installed perk, or null.
  function sync(car, { playable = true } = {}) {
    carId = car?.id || '';
    const own = originalVehiclePerk(carId);
    const active = Boolean(own) && playable && isPerkulatorUnlocked();
    meta.hidden = !active;
    tools.hidden = !active;
    if (!active) {
      if (sheet.open) sheet.close();
      return null;
    }
    meta.innerHTML = `<span class="garage-perk-role">ORIGINAL PERK</span> ${rarityChip(own)}`;
    syncClone(own);
    const installed = syncInstalled(own);
    if (focusAfterSync) {
      // The first of the listed controls that is there now.
      const target = focusAfterSync.split(',').map((selector) => panel.querySelector(selector.trim())).find(Boolean);
      focusWithoutScroll(target);
      focusAfterSync = '';
    }
    return installed;
  }

  function openSheet(trigger) {
    const car = getCarDefinition(carId);
    const own = originalVehiclePerk(carId);
    const installedId = installedPerkFor(carId);
    sheetLead.textContent = `On ${car.name}, beside ${perkName(own)}. Each car runs its own perk and at most one installed perk.`;
    sheetList.innerHTML = installablePerksFor(carId).map((perk) => {
      const current = perk.id === installedId;
      return `
        <li>
          <button class="garage-install-perk-option${current ? ' is-installed' : ''}" type="button" data-perk-id="${escapeHtml(perk.id)}"${current ? ' aria-current="true"' : ''}>
            <span class="garage-install-perk-name"><strong>${escapeHtml(perkName(perk))}</strong> ${rarityChip(perk)}${current ? ' <span class="garage-install-perk-state">INSTALLED</span>' : ''}</span>
            <span class="garage-install-perk-copy">${escapeHtml(perk.description)}</span>
            <span class="garage-install-perk-origin">From ${escapeHtml(originCar(perk))}</span>
          </button>
        </li>`;
    }).join('');
    sheetTrigger = trigger;
    sheet.showModal();
    onSheetToggle(true);
    // Like every TURN dialog, the sheet opens on its heading.
    focusWithoutScroll(sheet.querySelector('.turn-pr-sheet-title'));
  }

  function closeSheet() {
    if (sheet.open) sheet.close();
  }

  tools.addEventListener('click', (event) => {
    const button = event.target.closest?.('button');
    if (!button || !carId) return;
    const car = getCarDefinition(carId);
    if (button.classList.contains('garage-perk-clone-button')) {
      const own = originalVehiclePerk(carId);
      focusAfterSync = '.garage-perk-cloned';
      if (clonePerk(carId)) announce(`${perkName(own)} cloned. Install it on any other car.`);
      else focusAfterSync = '';
    } else if (button.classList.contains('garage-perk-install') || button.classList.contains('garage-perk-replace')) {
      openSheet(button);
    } else if (button.classList.contains('garage-perk-remove')) {
      const removed = getVehiclePerk(installedPerkFor(carId));
      focusAfterSync = '.garage-perk-install, .garage-perk-none';
      if (removed && removeInstalledPerk(carId)) announce(`${perkName(removed)} removed from ${car.name}.`);
      else focusAfterSync = '';
    }
  });

  sheetList.addEventListener('click', (event) => {
    const option = event.target.closest?.('[data-perk-id]');
    if (!option || !carId) return;
    const perk = getVehiclePerk(option.dataset.perkId);
    const car = getCarDefinition(carId);
    sheetTrigger = null;
    closeSheet();
    focusAfterSync = '.garage-perk-replace';
    if (perk && installPerk(carId, perk.id)) {
      announce(`${perkName(perk)} installed on ${car.name}.`);
    } else {
      focusAfterSync = '';
      focusWithoutScroll(panel.querySelector('.garage-perk-replace'));
    }
  });
  sheet.querySelector('.turn-pr-close').addEventListener('click', closeSheet);
  sheet.addEventListener('click', (event) => {
    if (event.target === sheet) closeSheet();
  });
  sheet.addEventListener('close', () => {
    onSheetToggle(false);
    // Closed without a choice: back to the button that opened it.
    if (sheetTrigger?.isConnected) focusWithoutScroll(sheetTrigger);
    sheetTrigger = null;
  });

  return Object.freeze({
    sheet,
    sync,
    openSheet: () => openSheet(panel.querySelector('.garage-perk-install, .garage-perk-replace')),
    release: closeSheet
  });
}
