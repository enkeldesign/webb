// PERKULATOR in GARAGE (#1219), inside the car's PERK disclosure: the car's ORIGINAL
// perk with its rarity and whether other cars may install it; then the car's INSTALLED
// perk, with INSTALL PERK, REPLACE and REMOVE. Installing opens a sheet of every perk
// this car may run (#1228): the ones PERKULATOR holds to choose, and the ones still
// locked, saying how they unlock (#1274). Nothing here shows without
// PERKULATOR, and nothing for a locked preview. What may be installed is
// vehicle/perkulator.js's to say; GARAGE re-renders on its change event.
import { filterButtons } from '../ui/filter-buttons.js';
import { perkSourceLabel } from '../vehicle/perk-presentation.js';
import { LOCK_ICON, isVehiclePerkUnlocked, rewardForVehiclePerk } from '../progression/trophy-road.js';
import { cornerMarkMarkup } from '../ui/corner-mark.js';
import { getCarDefinition } from '../vehicle/catalog.js';
import { getVehiclePerk, originalVehiclePerk } from '../vehicle/perks.js';
import {
  installPerk,
  installablePerksFor,
  installedPerkFor,
  isPerkAvailable,
  isPerkulatorUnlocked,
  perkUnlockRequirement,
  perkulatorChoicesFor,
  removeInstalledPerk
} from '../vehicle/perkulator.js';

const RARITY_LABELS = Object.freeze({
  common: 'COMMON',
  rare: 'RARE',
  epic: 'EPIC',
  legendary: 'LEGENDARY',
  mythic: 'MYTHIC'
});

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

// Rarity in words, on its colour: never the colour alone.
export function rarityChip(perk) {
  const label = RARITY_LABELS[perk?.rarity];
  if (!label) return '';
  return `<span class="turn-pr-chip is-${perk.rarity}"><span class="garage-visually-hidden">Rarity </span>${label}</span>`;
}

// The same content and surface primitive serves static Garage cards and choices.
// A locked choice (#1274) is the same card, but not a control: it says LOCKED in words
// and how it unlocks.
export function perkCardMarkup(perk, { original = false, current = false, interactive = false, locked = '', status = '' } = {}) {
  const choice = interactive || locked;
  const tag = interactive && !locked ? 'button' : 'div';
  const attributes = choice ? `${tag === 'button' ? ' type="button"' : ''} data-perk-id="${escapeHtml(perk.id)}"${current ? ' aria-current="true"' : ''}` : '';
  const source = original ? status : `From ${perkSourceLabel(perk)}`;
  const state = locked ? ` <span class="garage-install-perk-state is-locked"><span class="turn-pr-lock-icon" aria-hidden="true">${LOCK_ICON}</span> LOCKED</span>`
    : current ? ' <span class="garage-install-perk-state">INSTALLED</span>' : '';
  return `<${tag} class="garage-perk-card${original ? ' is-original' : ''}${choice ? ' garage-install-perk-option' : ''}${locked ? ' is-locked' : ''}${current ? ' is-installed' : ''}"${attributes}>
    <span class="garage-install-perk-name"><strong>${escapeHtml(perk.name)}</strong> ${rarityChip(perk)}${state}</span>
    <span class="garage-install-perk-copy">${escapeHtml(perk.description)}</span>
    ${source ? `<span class="garage-install-perk-origin">${escapeHtml(source)}</span>` : ''}
    ${locked ? `<span class="garage-install-perk-unlock">${escapeHtml(locked)}</span>` : ''}
  </${tag}>`;
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
  const meta = documentRef.createElement('section');
  meta.setAttribute('aria-labelledby', 'garageOriginalPerkTitle');
  meta.className = 'garage-perk-meta';
  meta.hidden = true;
  copy.before(meta);

  const tools = documentRef.createElement('div');
  tools.className = 'garage-perkulator';
  tools.hidden = true;
  tools.innerHTML = `
    <section class="garage-perk-installed" aria-labelledby="garageInstalledPerkTitle">
      <h4 class="garage-perk-installed-title" id="garageInstalledPerkTitle">INSTALLED PERK</h4>
      <div class="garage-perk-installed-body"></div>
    </section>`;
  copy.after(tools);
  const installedBody = tools.querySelector('.garage-perk-installed-body');

  const sheet = documentRef.createElement('dialog');
  sheet.className = 'turn-pr-sheet garage-install-perk';
  sheet.setAttribute('aria-labelledby', 'garageInstallPerkTitle');
  sheet.setAttribute('aria-describedby', 'garageInstallPerkLead');
  sheet.innerHTML = `
    <div class="turn-pr-sheet-card">
      <header class="turn-pr-sheet-head">
        <h2 class="turn-pr-sheet-title" id="garageInstallPerkTitle" tabindex="-1">INSTALL PERK</h2>
        <button class="turn-pr-close" type="button" aria-label="Close Install perk"><span aria-hidden="true">×</span></button>
      </header>
      <div class="turn-pr-sheet-body">
        <div class="garage-install-perk-intro">
          ${cornerMarkMarkup('perkulator')}
          <p class="garage-install-perk-lead" id="garageInstallPerkLead"></p>
        </div>
        <div class="turn-achievements-filters garage-perk-filters" role="group" aria-label="Perk rarity">
          ${filterButtons([['all', 'ALL'], ['common', 'COMMON'], ['rare', 'RARE'], ['epic', 'EPIC'], ['mythic', 'MYTHIC']], 'data-perk-rarity')}
        </div>
        <p class="garage-perk-empty" hidden>No perks of this rarity.</p>
        <ul class="garage-install-perk-list" role="list"></ul>
      </div>
    </div>`;
  dialogHost.appendChild(sheet);
  const sheetLead = sheet.querySelector('.garage-install-perk-lead');
  const sheetList = sheet.querySelector('.garage-install-perk-list');

  let rarity = 'all';
  let carId = '';
  let sheetTrigger = null;
  // Where focus goes once an action has re-rendered the panel.
  let focusAfterSync = '';

  function perkName(perk) {
    return perk.name;
  }

  function syncInstalled(own) {
    const car = getCarDefinition(carId);
    const installed = getVehiclePerk(installedPerkFor(carId));
    const choices = installablePerksFor(carId);
    if (installed) {
      installedBody.innerHTML = `
        ${perkCardMarkup(installed, { current: true })}
        <div class="garage-perk-actions">
          <button class="turn-pr-button is-secondary is-compact garage-perk-replace" type="button" aria-haspopup="dialog" aria-label="Replace installed perk: ${escapeHtml(perkName(installed))}">REPLACE</button>
          <button class="turn-pr-button is-destructive is-compact garage-perk-remove" type="button" aria-label="Remove installed perk: ${escapeHtml(perkName(installed))}">REMOVE</button>
        </div>`;
      return installed;
    }
    if (choices.length) {
      installedBody.innerHTML = `
        <p class="garage-perk-note garage-perk-none" tabindex="-1">None. Another perk can run beside ${escapeHtml(perkName(own))}.</p>
        <button class="turn-pr-button is-secondary is-compact garage-perk-install" type="button" aria-haspopup="dialog" aria-label="Install perk on ${escapeHtml(car.name)}">INSTALL PERK</button>`;
    } else {
      installedBody.innerHTML = `<p class="garage-perk-note garage-perk-none" tabindex="-1">None. Unlock perks on Trophy Road or complete achievement collections to install one here.</p>`;
    }
    return null;
  }

  // The car's perk card: returns its installed perk, or null.
  function sync(car, { playable = true } = {}) {
    carId = car?.id || '';
    const own = originalVehiclePerk(carId);
    const active = Boolean(own) && playable && isPerkulatorUnlocked();
    copy.hidden = active;
    meta.hidden = !active;
    tools.hidden = !active;
    if (!active) {
      if (sheet.open) sheet.close();
      return null;
    }
    const reward = rewardForVehiclePerk(carId);
    const status = reward && !isVehiclePerkUnlocked(carId)
      ? `Unlocks at ${reward.threshold} trophies on Trophy Road.`
      : own.installable ? 'Any other car can install it.' : 'Stays with this car.';
    meta.innerHTML = `<h4 class="garage-perk-role" id="garageOriginalPerkTitle">ORIGINAL PERK</h4>${perkCardMarkup(own, { original: true, status })}`;
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
    rarity = 'all';
    renderChoices(installedId);
    sheetTrigger = trigger;
    sheet.showModal();
    onSheetToggle(true);
    // Like every TURN dialog, the sheet opens on its heading.
    focusWithoutScroll(sheet.querySelector('.turn-pr-sheet-title'));
  }

  function renderChoices(installedId = installedPerkFor(carId)) {
    const choices = perkulatorChoicesFor(carId).filter(({ perk }) => rarity === 'all' || perk.rarity === rarity);
    sheetList.innerHTML = choices.map(({ perk, available }) => `<li>${perkCardMarkup(perk, {
      interactive: true,
      current: perk.id === installedId,
      locked: available ? '' : perkUnlockRequirement(perk) || 'Locked.'
    })}</li>`).join('');
    sheet.querySelector('.garage-perk-empty').hidden = choices.length > 0;
    for (const button of sheet.querySelectorAll('[data-perk-rarity]')) {
      button.setAttribute('aria-pressed', String(button.dataset.perkRarity === rarity));
    }
  }

  sheet.querySelector('.garage-perk-filters').addEventListener('click', (event) => {
    const button = event.target.closest?.('[data-perk-rarity]');
    if (!button) return;
    rarity = button.dataset.perkRarity;
    renderChoices();
  });

  function closeSheet() {
    if (sheet.open) sheet.close();
  }

  tools.addEventListener('click', (event) => {
    const button = event.target.closest?.('button');
    if (!button || !carId) return;
    const car = getCarDefinition(carId);
    if (button.classList.contains('garage-perk-install') || button.classList.contains('garage-perk-replace')) {
      openSheet(button);
    } else if (button.classList.contains('garage-perk-remove')) {
      const removed = getVehiclePerk(installedPerkFor(carId));
      focusAfterSync = '.garage-perk-install, .garage-perk-none';
      if (removed && removeInstalledPerk(carId)) announce(`${perkName(removed)} removed from ${car.name}.`);
      else focusAfterSync = '';
    }
  });

  sheetList.addEventListener('click', (event) => {
    // Only an available choice is a button; a locked card does nothing.
    const option = event.target.closest?.('button[data-perk-id]');
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
