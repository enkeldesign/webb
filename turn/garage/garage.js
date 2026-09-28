// GARAGE: choose your car. One owner for the featured car, its specifications, perk,
// paint and SHIFT entry points, previous/next browsing, the locked-car preview and the
// RACE dock. Styles: pre-race.css (shared with ROADBOOK) and garage/garage.css.
//
// showGarage() keeps The Lot's contract: it resolves to the chosen
// { carId, color, secondaryColor } when the player races, or null when they go back.
// Selection rules live in garage-selection.js; nothing here writes the saved car, which
// the race start does, as before.

import {
  CAR_CATALOG,
  VEHICLE_STAT_LEGEND,
  getCarDefinition,
  getEffectiveVehicleStats,
  getVehicleDefaultColor,
  getVehicleDefaultSecondaryColor,
  isSportsSedanEasterEgg,
  normalizeVehicleColor,
  normalizeVehicleSecondaryColor,
  normalizeVehicleSelection
} from '../vehicle/catalog.js?revision=r250-supercar-finish';
import { vehiclePerkPresentation } from '../vehicle/perk-presentation.js?revision=r220-apex-grip';
import {
  VEHICLE_SHIFT_STAT_FIELDS,
  loadVehicleShiftProfile,
  vehicleShiftAmount,
  vehicleStatsSupportShift
} from '../vehicle/shift-profile.js?revision=r232-double-shift';
import {
  LOCK_ICON,
  TROPHY_ICON,
  getTrophyRoadReward,
  isFeatureUnlocked,
  isPaintUnlocked,
  isVehiclePerkUnlocked,
  isVehicleUnlocked,
  rewardForVehicle,
  rewardForVehiclePerk,
  showTrophyUnlockNotice
} from '../progression/trophy-road.js';
import { describeColorCue } from '../accessibility/color-cues.js?revision=r163';
import { signalSecretAchievement } from '../achievements/secret-events.js?revision=r157-hidden-achievements';
import { getSavedLotPaint, lotPaintMatches, resetLotPaint, resolveLotPaint, saveLotPaint } from './lot-saved-paint.js?revision=r246-lot-saved-paint';
import { hasTriedTrainingCar, installTrainingCarGuide, TRAINING_CAR_ID } from './training-car-guide.js?revision=r1';
import { createShiftSetup } from './lot-shift.js?revision=r243-mountain-1300';
import { createShowroomViewer } from './showroom-viewer.js';
import { GARAGE_STARTER_CAR_ID, garageCarDescription, garageCarOrder } from './garage-cars.js';
import { createGarageSelection } from './garage-selection.js';

const ROOT_ID = 'turnGarage';
const ENTRY_TAP_GUARD_MS = 600;
const PAINT_REWARD_ID = 'paintjob';
const SECRET_NAME = 'SATAN’S SPORTS CAR';
const STAT_KEYS = VEHICLE_STAT_LEGEND.map((entry) => entry.key);
// Specifications are always open where the screen has room for them.
const SPACIOUS_QUERY = '(min-width: 768px) and (min-height: 640px)';

const ORDER = garageCarOrder(CAR_CATALOG.map((car) => car.id));

// The playable choice outlives one visit, so GARAGE -> ROADBOOK -> GARAGE keeps it.
let sessionChoice = null;
// Disclosures stay as the player left them while browsing cars.
const disclosureState = { specs: false, perk: false, paint: false };
let stylesPromise = null;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function ordinal(index) {
  return String(index + 1).padStart(2, '0');
}

function titleCase(name) {
  return String(name || '')
    .toLocaleLowerCase('en')
    .replace(/(^|\s)\p{L}/gu, (character) => character.toLocaleUpperCase('en'));
}

function trophyTotal() {
  const total = Number(globalThis.__turnAchievements?.store?.trophyTotal?.());
  return Number.isFinite(total) ? total : null;
}

function carLock(carId) {
  const reward = rewardForVehicle(carId);
  return reward && !isVehicleUnlocked(carId) ? reward : null;
}

function prepareStylesheet(id, relativeUrl) {
  return new Promise((resolve, reject) => {
    const existing = document.getElementById(id);
    if (existing?.sheet) {
      resolve();
      return;
    }
    const link = existing || document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    const url = new URL(relativeUrl, import.meta.url);
    const buildKey = globalThis.__TURN_BUILD__?.cacheKey;
    if (buildKey) url.searchParams.set('build', buildKey);
    link.href = url.href;
    link.addEventListener('load', resolve, { once: true });
    link.addEventListener('error', () => {
      link.remove();
      reject(new Error(`TURN: GARAGE stylesheet could not be loaded: ${relativeUrl}`));
    }, { once: true });
    if (!existing) document.head.appendChild(link);
  });
}

// GARAGE's stylesheets load while Home prepares the chosen track.
export function prepareGarage() {
  if (!stylesPromise) {
    stylesPromise = Promise.all([
      prepareStylesheet('turn-garage-styles', './garage.css'),
      prepareStylesheet('turn-garage-shift-styles', './lot-shift.css?revision=r229-shift-feedback')
    ]).catch((error) => {
      stylesPromise = null;
      throw error;
    });
  }
  return stylesPromise;
}

function statRows(stats, shift) {
  return VEHICLE_STAT_LEGEND.map(({ key, label, description }) => {
    const value = Number(stats[key]) || 0;
    const change = shift?.[key] || 0;
    const marker = change > 0 ? '<span class="garage-shift-mark is-gain" aria-hidden="true">▲</span>'
      : change < 0 ? '<span class="garage-shift-mark is-loss" aria-hidden="true">▼</span>' : '';
    const shiftCopy = change ? ` SHIFT ${change > 0 ? 'adds' : 'removes'} ${Math.abs(change)}.` : '';
    return `
      <li class="garage-spec" aria-label="${escapeHtml(titleCase(label))}: ${value} out of 5.${shiftCopy}">
        <span class="garage-spec-label" aria-hidden="true">${escapeHtml(titleCase(label))}${marker}</span>
        <span class="garage-spec-meter" aria-hidden="true">${Array.from({ length: 5 }, (_, index) => `<i class="${index < value ? 'is-full' : ''}"></i>`).join('')}</span>
        <span class="garage-spec-value" aria-hidden="true">${value}/5</span>
        <small class="garage-spec-help" aria-hidden="true">${escapeHtml(description)}</small>
      </li>`;
  }).join('');
}

function shiftChanges(car) {
  if (!isFeatureUnlocked('vehicle-shift') || !vehicleStatsSupportShift(car.stats)) return null;
  const amount = vehicleShiftAmount(car.id, isVehiclePerkUnlocked(car.id));
  const profile = loadVehicleShiftProfile(car.id, car.stats, undefined, amount);
  if (!profile?.enabled || !Array.isArray(profile.reducedStats)) return null;
  const reduced = new Set(profile.reducedStats);
  return Object.fromEntries(VEHICLE_SHIFT_STAT_FIELDS.map(({ key }) => [key, reduced.has(key) ? -amount : amount]));
}

export function showGarage({
  initialSelection,
  trackId = '',
  trackName = '',
  trackDifficulty = '',
  trackIcon = '',
  backLabel = 'TRACKS',
  documentRef = document,
  windowRef = window
} = {}) {
  installTrainingCarGuide();
  documentRef.getElementById(ROOT_ID)?.remove();

  return new Promise((resolve) => {
    const saved = normalizeVehicleSelection(initialSelection || undefined);
    const selection = createGarageSelection({
      order: ORDER,
      initial: sessionChoice && !carLock(sessionChoice.carId) ? sessionChoice : saved,
      fallbackCarId: GARAGE_STARTER_CAR_ID,
      isLocked: (carId) => Boolean(carLock(carId)),
      paintFor: (carId) => resolveLotPaint(carId)
    });
    const openedAt = globalThis.performance?.now?.() ?? Date.now();
    const beginner = !hasTriedTrainingCar();

    const root = documentRef.createElement('section');
    root.id = ROOT_ID;
    root.className = 'garage';
    root.setAttribute('aria-labelledby', 'garageTitle');
    root.innerHTML = `
      <header class="garage-bar">
        <img class="garage-logo" src="/turn/TURNicon.PNG?icon=20260803-profile-512" alt="TURN">
        <button class="garage-back" type="button"><span aria-hidden="true">←</span> ${escapeHtml(backLabel)}</button>
      </header>
      <div class="garage-page">
        <header class="turn-pr-page-head garage-head">
          <div>
            <h1 class="turn-pr-display" id="garageTitle" tabindex="-1">GARAGE</h1>
            <p class="turn-pr-lead">Choose your car</p>
          </div>
          <p class="garage-progress">
            <strong class="garage-available"></strong>
            <span class="garage-next"></span>
          </p>
        </header>
        <div class="garage-layout">
          <section class="garage-feature" aria-labelledby="garageCarName">
            <div class="garage-stage">
              <span class="garage-ordinal"></span>
              <div class="garage-view" aria-hidden="true"></div>
              <p class="garage-view-state" role="status"></p>
              <button class="garage-step is-previous" type="button" aria-label="Previous car"><span aria-hidden="true">‹</span></button>
              <button class="garage-step is-next" type="button" aria-label="Next car"><span aria-hidden="true">›</span></button>
              <div class="garage-rotate">
                <button class="garage-rotate-button" type="button" data-rotate="-45" aria-label="Turn the car left"><span aria-hidden="true">↺</span></button>
                <button class="garage-rotate-button" type="button" data-rotate="45" aria-label="Turn the car right"><span aria-hidden="true">↻</span></button>
              </div>
            </div>
            <div class="garage-identity">
              <h2 class="garage-name" id="garageCarName"></h2>
              <p class="garage-description"></p>
              <p class="garage-lock-note" hidden></p>
              <section class="garage-secret" role="status" aria-live="polite" hidden>
                <span class="turn-pr-chip garage-secret-chip">SECRET UNLOCKED</span>
                <p>Sport trim <strong>color code #666</strong> maxes every attribute. Lap results with this secret car are not saved.</p>
              </section>
            </div>
            <div class="garage-tools">
              <button class="turn-pr-button is-secondary is-compact garage-paint-toggle" type="button" aria-expanded="false" aria-controls="garagePaint">PAINT</button>
            </div>
            <div class="garage-paint" id="garagePaint" hidden></div>
          </section>
          <div class="garage-details">
            <section class="garage-disclosure garage-specs" data-disclosure="specs">
              <h3 class="garage-disclosure-head">
                <button class="garage-disclosure-toggle" type="button" aria-expanded="false" aria-controls="garageSpecs">
                  <span class="garage-disclosure-title">Specifications</span>
                  <span class="garage-setup-label"></span>
                  <span class="garage-disclosure-chevron" aria-hidden="true"></span>
                </button>
              </h3>
              <div class="garage-disclosure-panel" id="garageSpecs" hidden>
                <ul class="garage-spec-list"></ul>
                <p class="garage-spec-note">Every car has 18 attribute points in total. What changes is how they are shared out.</p>
                <p class="garage-shift-note" hidden><span aria-hidden="true">▲▼</span> Your SHIFT setup. Switch it on during a race.</p>
              </div>
            </section>
            <section class="garage-disclosure garage-perk" data-disclosure="perk" hidden>
              <h3 class="garage-disclosure-head">
                <button class="garage-disclosure-toggle" type="button" aria-expanded="false" aria-controls="garagePerk">
                  <span class="turn-pr-chip garage-perk-chip">PERK</span>
                  <span class="garage-disclosure-title garage-perk-title"></span>
                  <span class="garage-perk-state"></span>
                  <span class="garage-disclosure-chevron" aria-hidden="true"></span>
                </button>
              </h3>
              <div class="garage-disclosure-panel" id="garagePerk" hidden>
                <p class="garage-perk-copy"></p>
              </div>
            </section>
          </div>
        </div>
      </div>
      <div class="turn-pr-dock garage-dock">
        <div class="turn-pr-dock-inner">
          <div class="turn-pr-dock-context garage-dock-context" id="garageDockContext">
            <span class="garage-dock-track">
              <span class="turn-pr-icon" aria-hidden="true">${trackIcon}</span>
              <span class="turn-pr-dock-name">${escapeHtml(trackName)}</span>
              ${trackDifficulty ? `<span class="turn-pr-dock-detail">${escapeHtml(trackDifficulty)}</span>` : ''}
            </span>
            <span class="garage-dock-car"></span>
            <span class="lot-race-status garage-race-status" role="status" aria-live="polite"></span>
          </div>
          <div class="turn-pr-dock-actions">
            <button class="turn-pr-button is-secondary garage-leave-preview" type="button" hidden></button>
            <button class="turn-pr-button is-primary garage-race" type="button" aria-describedby="garageDockContext">
              <span class="turn-pr-button-label">RACE</span><span class="turn-pr-button-arrow" aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </div>`;
    documentRef.body.appendChild(root);
    documentRef.body.classList.add('turn-lot-open');

    const $ = (selector) => root.querySelector(selector);
    const title = $('#garageTitle');
    const available = $('.garage-available');
    const nextUnlock = $('.garage-next');
    const ordinalBadge = $('.garage-ordinal');
    const viewHost = $('.garage-view');
    const viewState = $('.garage-view-state');
    const name = $('.garage-name');
    const description = $('.garage-description');
    const lockNote = $('.garage-lock-note');
    const secret = $('.garage-secret');
    const tools = $('.garage-tools');
    const paintToggle = $('.garage-paint-toggle');
    const paintPanel = $('.garage-paint');
    const specs = $('.garage-specs');
    const specsToggle = specs.querySelector('.garage-disclosure-toggle');
    const specsPanel = specs.querySelector('.garage-disclosure-panel');
    const setupLabel = $('.garage-setup-label');
    const specList = $('.garage-spec-list');
    const shiftNote = $('.garage-shift-note');
    const perk = $('.garage-perk');
    const perkToggle = perk.querySelector('.garage-disclosure-toggle');
    const perkPanel = perk.querySelector('.garage-disclosure-panel');
    const perkTitle = $('.garage-perk-title');
    const perkState = $('.garage-perk-state');
    const perkCopy = $('.garage-perk-copy');
    const dockCar = $('.garage-dock-car');
    const leavePreviewButton = $('.garage-leave-preview');
    const raceButton = $('.garage-race');
    const raceLabel = raceButton.querySelector('.turn-pr-button-label');
    const backButton = $('.garage-back');
    const dock = $('.garage-dock');
    const spaciousMedia = windowRef.matchMedia?.(SPACIOUS_QUERY) || null;

    const viewer = createShowroomViewer(viewHost);
    const shift = createShiftSetup({
      triggerHost: tools,
      dialogHost: root,
      getCarId: () => (selection.state().preview ? '' : selection.state().choice.carId),
      triggerClassName: 'turn-pr-button is-secondary is-compact garage-shift'
    });
    let shownCarKey = '';
    let secretSignalled = false;
    let disposed = false;

    function viewedCar() {
      return getCarDefinition(selection.state().viewedCarId);
    }

    function effectiveSelection() {
      const { choice, preview } = selection.state();
      return preview
        ? { carId: preview, color: resolveLotPaint(preview).color, secondaryColor: resolveLotPaint(preview).secondaryColor }
        : choice;
    }

    function syncProgress() {
      const locks = ORDER.map(carLock);
      const open = locks.filter((lock) => !lock).length;
      available.textContent = `${open} / ${ORDER.length} AVAILABLE`;
      const thresholds = locks.filter(Boolean).map((lock) => lock.threshold);
      const total = trophyTotal();
      if (!thresholds.length) {
        nextUnlock.textContent = 'Every car is yours';
      } else {
        const next = Math.min(...thresholds);
        nextUnlock.textContent = total === null
          ? `Next car at ${next} trophies`
          : `${total} trophies · next car at ${next}`;
      }
    }

    function setDisclosure(key, toggle, panel, open) {
      disclosureState[key] = open;
      toggle.setAttribute('aria-expanded', String(open));
      panel.hidden = !open;
    }

    function syncDisclosures() {
      const spacious = Boolean(spaciousMedia?.matches);
      root.classList.toggle('is-spacious', spacious);
      // Spacious layouts show every specification directly.
      specsToggle.disabled = spacious;
      setDisclosure('specs', specsToggle, specsPanel, spacious || disclosureState.specs);
      if (spacious) disclosureState.specs = false;
      setDisclosure('perk', perkToggle, perkPanel, spacious || disclosureState.perk);
      if (spacious) disclosureState.perk = false;
    }

    function syncIdentity(car, lock, secretActive) {
      const displayName = secretActive ? SECRET_NAME : car.name;
      name.innerHTML = `${lock ? `<span class="turn-pr-lock-icon garage-name-lock" aria-hidden="true">${LOCK_ICON}</span>` : ''}${escapeHtml(displayName)}${car.id === TRAINING_CAR_ID && beginner ? ' <span class="turn-pr-chip is-easy garage-beginner">Beginner-friendly</span>' : ''}`;
      description.textContent = garageCarDescription(car.id);
      const index = ORDER.indexOf(car.id);
      ordinalBadge.textContent = `${ordinal(index)} / ${ORDER.length}`;
      if (lock) {
        const total = trophyTotal();
        const remaining = total === null ? null : Math.max(0, lock.threshold - total);
        lockNote.innerHTML = `<span class="turn-pr-lock-icon" aria-hidden="true">${LOCK_ICON}</span><span>Locked. ${escapeHtml(car.name)} unlocks at <strong>${lock.threshold}</strong> trophies on Trophy Road${remaining ? ` · ${remaining} to go` : ''}.</span>`;
      }
      lockNote.hidden = !lock;
      secret.hidden = !secretActive;
      root.classList.toggle('is-previewing', Boolean(lock));
    }

    function syncSpecs(car, secretActive) {
      const stats = getEffectiveVehicleStats(effectiveSelection());
      const stock = STAT_KEYS.every((key) => Number(stats[key]) === Number(car.stats[key]));
      setupLabel.textContent = stock ? 'Stock' : 'Current setup';
      const changes = selection.state().preview || secretActive ? null : shiftChanges(car);
      specList.innerHTML = statRows(stats, changes);
      shiftNote.hidden = !changes;
    }

    function syncPerk(car) {
      const presented = vehiclePerkPresentation(car.id, car.perk);
      perk.hidden = !presented;
      if (!presented) return;
      const reward = rewardForVehiclePerk(car.id);
      const unlocked = !reward || isVehiclePerkUnlocked(car.id);
      perkTitle.textContent = titleCase(presented.title);
      perkState.innerHTML = unlocked
        ? '<span aria-hidden="true">✓</span><span class="garage-visually-hidden">Unlocked</span>'
        : `<span class="turn-pr-lock-icon" aria-hidden="true">${LOCK_ICON}</span><span>${reward.threshold}</span>`;
      perkCopy.innerHTML = `${escapeHtml(presented.description)}${unlocked ? '' : `<br><span class="garage-perk-lock">Unlocks at ${reward.threshold} trophies on Trophy Road.</span>`}`;
    }

    function colorControl(label, value, secondary) {
      const control = documentRef.createElement('label');
      control.className = 'garage-swatch';
      control.innerHTML = `
        <input class="garage-swatch-input" type="color" value="${escapeHtml(value)}" aria-label="${escapeHtml(label)} colour">
        <span class="garage-swatch-face" aria-hidden="true"></span>
        <span class="garage-swatch-copy">
          <span class="garage-swatch-label">${escapeHtml(label)}</span>
          <span class="garage-swatch-name"></span>
        </span>`;
      const input = control.querySelector('input');
      const colorName = control.querySelector('.garage-swatch-name');
      const face = control.querySelector('.garage-swatch-face');
      const syncName = () => {
        colorName.textContent = titleCase(describeColorCue(input.value));
        face.style.background = input.value;
      };
      input.addEventListener('input', () => {
        syncName();
        selection.paint(secondary
          ? { secondaryColor: normalizeVehicleSecondaryColor(input.value) }
          : { color: normalizeVehicleColor(input.value) });
        const { choice } = selection.state();
        sessionChoice = choice;
        viewer.recolor(choice.color, choice.secondaryColor);
        syncPaintAction();
        render({ viewer: false });
      });
      syncName();
      return control;
    }

    function syncPaintAction() {
      const action = paintPanel.querySelector('.garage-paint-save');
      if (!action) return;
      const { choice } = selection.state();
      const car = getCarDefinition(choice.carId);
      const savedPaint = getSavedLotPaint(choice.carId);
      const factory = {
        color: getVehicleDefaultColor(choice.carId),
        secondaryColor: getVehicleDefaultSecondaryColor(choice.carId)
      };
      const matchesSaved = Boolean(savedPaint && lotPaintMatches(choice, savedPaint));
      const resetMode = Boolean(savedPaint && (matchesSaved || lotPaintMatches(choice, factory)));
      action.dataset.mode = resetMode ? 'reset' : 'save';
      action.textContent = resetMode ? 'Reset to factory' : 'Save colours';
      action.disabled = !resetMode && !savedPaint && lotPaintMatches(choice, factory);
      action.setAttribute('aria-label', resetMode
        ? `Reset ${car.name} colours to factory colours`
        : `Save ${car.name} colours for GARAGE`);
    }

    // Paint belongs to the playable choice: locked before its Trophy Road reward,
    // fixed for the emergency liveries, never offered for a locked preview.
    function renderPaint() {
      const { choice, preview } = selection.state();
      const car = getCarDefinition(choice.carId);
      paintToggle.hidden = Boolean(preview);
      if (preview) {
        paintPanel.hidden = true;
        return;
      }
      const reward = getTrophyRoadReward(PAINT_REWARD_ID);
      if (car.fixedLivery) {
        const primary = getVehicleDefaultColor(car.id);
        const secondary = getVehicleDefaultSecondaryColor(car.id);
        paintPanel.innerHTML = `
          <p class="garage-paint-fixed">
            <span class="garage-fixed-swatch" style="--garage-fixed-primary:${escapeHtml(primary)};--garage-fixed-secondary:${escapeHtml(secondary)}" role="img" aria-label="Fixed livery: ${escapeHtml(describeColorCue(primary))} and ${escapeHtml(describeColorCue(secondary))}"></span>
            <span>${escapeHtml(car.name)} wears its fixed service livery.</span>
          </p>`;
      } else if (!isPaintUnlocked()) {
        paintPanel.innerHTML = `
          <p class="turn-pr-lock-note garage-paint-locked">
            <span class="turn-pr-lock-icon" aria-hidden="true">${LOCK_ICON}</span>
            <span>Paint unlocks at <strong>${reward?.threshold || 800}</strong> trophies on Trophy Road. Until then every car wears its factory colours.</span>
          </p>`;
      } else {
        paintPanel.replaceChildren();
        const swatches = documentRef.createElement('div');
        swatches.className = 'garage-swatches';
        swatches.append(colorControl('Body', choice.color, false));
        if (car.secondaryPaint) swatches.append(colorControl(car.secondaryPaint.label, choice.secondaryColor, true));
        const action = documentRef.createElement('button');
        action.type = 'button';
        action.className = 'turn-pr-button is-secondary is-compact garage-paint-save';
        action.addEventListener('click', () => {
          const current = selection.state().choice;
          if (action.dataset.mode === 'reset') {
            const factory = resetLotPaint(current.carId);
            selection.paint(factory);
            sessionChoice = selection.state().choice;
            viewer.recolor(factory.color, factory.secondaryColor);
            renderPaint();
            render({ viewer: false });
            return;
          }
          saveLotPaint(current.carId, current);
          syncPaintAction();
        });
        paintPanel.append(swatches, action);
        syncPaintAction();
      }
      paintToggle.textContent = car.fixedLivery ? 'LIVERY' : 'PAINT';
      paintToggle.classList.toggle('is-locked', !car.fixedLivery && !isPaintUnlocked());
      paintPanel.hidden = !disclosureState.paint;
      paintToggle.setAttribute('aria-expanded', String(disclosureState.paint));
    }

    function syncDock(car, lock, secretActive) {
      const { choice } = selection.state();
      const choiceCar = getCarDefinition(choice.carId);
      // A locked preview has no race: the dock says what unlocks it and leads back to
      // the playable choice.
      if (lock) {
        dockCar.textContent = `${car.name} · UNLOCKS AT ${lock.threshold}`;
        leavePreviewButton.hidden = false;
        leavePreviewButton.textContent = `Back to ${choiceCar.name}`;
        raceButton.hidden = true;
        raceButton.classList.add('is-locked');
        raceButton.setAttribute('aria-disabled', 'true');
        raceLabel.textContent = `UNLOCKS AT ${lock.threshold}`;
        raceButton.setAttribute('aria-label', `${car.name} is locked until ${lock.threshold} trophies.`);
      } else {
        raceButton.hidden = false;
        const displayName = secretActive ? SECRET_NAME : car.name;
        dockCar.textContent = displayName;
        leavePreviewButton.hidden = true;
        raceButton.classList.remove('is-locked');
        raceButton.removeAttribute('aria-disabled');
        raceLabel.textContent = 'RACE';
        raceButton.setAttribute('aria-label', `Race ${titleCase(displayName)}`);
      }
    }

    function render({ viewer: refreshViewer = true } = {}) {
      if (disposed) return;
      const car = viewedCar();
      const lock = carLock(car.id);
      const secretActive = !lock && isSportsSedanEasterEgg(selection.state().choice);
      syncIdentity(car, lock, secretActive);
      syncSpecs(car, secretActive);
      syncPerk(car);
      syncDock(car, lock, secretActive);
      shift.sync();
      shift.trigger.hidden = Boolean(lock);
      if (secretActive && !secretSignalled) {
        secretSignalled = true;
        signalSecretAchievement('satans-sedan', {
          trackId: trackId || globalThis.__turnRuntime?.state?.trackId || '',
          vehicleId: 'sedan-sports'
        });
      }
      if (!refreshViewer) return;
      const paint = effectiveSelection();
      const key = `${paint.carId}`;
      if (key === shownCarKey) {
        viewer.recolor(paint.color, paint.secondaryColor);
        return;
      }
      shownCarKey = key;
      root.classList.add('is-loading');
      viewState.textContent = '';
      void viewer.show(paint.carId, paint.color, paint.secondaryColor).then((ok) => {
        if (disposed || shownCarKey !== key) return;
        root.classList.remove('is-loading');
        root.classList.toggle('has-view-error', !ok);
        viewState.textContent = ok ? '' : `The 3D ${car.name} could not load. You can still race it.`;
      });
    }

    function showCar(carId) {
      selection.view(carId);
      sessionChoice = selection.state().choice;
      renderPaint();
      render();
      navigatorVibrate(12);
    }

    function step(direction) {
      selection.step(direction);
      sessionChoice = selection.state().choice;
      renderPaint();
      render();
      navigatorVibrate(12);
    }

    function navigatorVibrate(pattern) {
      try {
        globalThis.navigator?.vibrate?.(pattern);
      } catch (_) {}
    }

    function finish(result) {
      if (disposed) return;
      disposed = true;
      windowRef.removeEventListener('turn:trophy-road-updated', handleProgress);
      windowRef.removeEventListener('turn:shift-profile-change', handleShiftChange);
      windowRef.removeEventListener('storage', handleStorage);
      spaciousMedia?.removeEventListener?.('change', syncDisclosures);
      resizeObserver?.disconnect();
      shift.release();
      viewer.stop();
      root.remove();
      documentRef.body.classList.remove('turn-lot-open');
      viewer.dispose();
      if (globalThis.__turnGarage === api) delete globalThis.__turnGarage;
      if (result) sessionChoice = null;
      resolve(result ? normalizeVehicleSelection(result) : null);
    }

    function race(event) {
      const now = globalThis.performance?.now?.() ?? Date.now();
      // A VoiceOver double-tap that opened GARAGE can leave a second activation
      // behind where RACE now sits; only a deliberate tap races.
      if (now - openedAt < ENTRY_TAP_GUARD_MS) {
        event.preventDefault();
        return;
      }
      const state = selection.state();
      if (!state.raceable) {
        const car = viewedCar();
        showTrophyUnlockNotice({ reward: carLock(car.id), itemName: car.name });
        return;
      }
      finish({ ...state.choice });
    }

    const handleProgress = () => {
      selection.refreshLocks();
      syncProgress();
      renderPaint();
      render();
    };
    const handleShiftChange = () => render({ viewer: false });
    const handleStorage = (event) => {
      if (event.key === 'turn-achievements-v1') handleProgress();
    };

    root.querySelector('.garage-step.is-previous').addEventListener('click', () => step(-1));
    root.querySelector('.garage-step.is-next').addEventListener('click', () => step(1));
    for (const button of root.querySelectorAll('.garage-rotate-button')) {
      button.addEventListener('click', () => viewer.rotateBy(Number(button.dataset.rotate)));
    }
    root.querySelector('.garage-stage').addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft' && event.target.closest('.garage-step')) {
        event.preventDefault();
        step(-1);
      } else if (event.key === 'ArrowRight' && event.target.closest('.garage-step')) {
        event.preventDefault();
        step(1);
      }
    });
    specsToggle.addEventListener('click', () => setDisclosure('specs', specsToggle, specsPanel, specsPanel.hidden));
    perkToggle.addEventListener('click', () => setDisclosure('perk', perkToggle, perkPanel, perkPanel.hidden));
    paintToggle.addEventListener('click', () => {
      const car = getCarDefinition(selection.state().choice.carId);
      if (!car.fixedLivery && !isPaintUnlocked() && paintPanel.hidden) {
        showTrophyUnlockNotice({ reward: getTrophyRoadReward(PAINT_REWARD_ID), itemName: 'Car color' });
      }
      disclosureState.paint = paintPanel.hidden;
      paintPanel.hidden = !disclosureState.paint;
      paintToggle.setAttribute('aria-expanded', String(disclosureState.paint));
    });
    leavePreviewButton.addEventListener('click', () => {
      selection.leavePreview();
      renderPaint();
      render();
      raceButton.focus({ preventScroll: true });
    });
    const leavePreviewByKey = (event) => {
      if (event.key === 'Escape' && selection.state().preview && !documentRef.querySelector('dialog[open]')) {
        event.preventDefault();
        leavePreviewButton.click();
      }
    };
    root.addEventListener('keydown', leavePreviewByKey);
    raceButton.addEventListener('click', race);
    backButton.addEventListener('click', () => finish(null));
    shift.dialog.addEventListener('close', () => viewer.resume());
    shift.trigger.addEventListener('click', () => {
      if (shift.dialog.open) viewer.pause();
    });
    windowRef.addEventListener('turn:trophy-road-updated', handleProgress);
    windowRef.addEventListener('turn:shift-profile-change', handleShiftChange);
    windowRef.addEventListener('storage', handleStorage);
    spaciousMedia?.addEventListener?.('change', syncDisclosures);

    // The page keeps room to scroll its last row clear of the dock at any text size.
    const syncDockSpace = () => {
      const height = dock.getBoundingClientRect().height;
      if (height > 0) root.style.setProperty('--garage-dock-height', `${Math.ceil(height)}px`);
      viewer.resize();
    };
    const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(syncDockSpace) : null;
    resizeObserver?.observe(dock);
    resizeObserver?.observe(viewHost);

    const api = Object.freeze({
      root,
      getChoice: () => ({ ...selection.state().choice }),
      getViewedCarId: () => selection.state().viewedCarId,
      viewCar: showCar,
      step,
      leavePreview: () => leavePreviewButton.click(),
      raceButton,
      back: () => finish(null)
    });
    globalThis.__turnGarage = api;

    syncProgress();
    syncDisclosures();
    renderPaint();
    render();
    requestAnimationFrame(() => {
      if (disposed) return;
      syncDockSpace();
      title.focus({ preventScroll: true });
    });
  });
}
