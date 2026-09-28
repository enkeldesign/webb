// ROADBOOK: choose your track. One owner for the track list, its selection and lock
// state, the pre-race dock (chosen track, Track sheet, CHOOSE CAR), the Track sheet
// dialog and, where the screen is large enough, the inline track overview.
//
// Home (m8-home.js) owns the flow around it: it tells ROADBOOK which track is chosen,
// and ROADBOOK calls back when the player picks another track or continues to GARAGE.
// Styles: pre-race.css (the shared primitives GARAGE reuses) and roadbook.css.

import { TRACK_CATALOG, TRACK_PLACEHOLDERS, getTrackPreviewPoints } from '/turn/tracks/catalog.js?source=20260729-r118-m8';
import { trackIconMarkup } from '/turn/ui/track-icons.js';
import {
  LOCK_ICON,
  TROPHY_ICON,
  isFeatureUnlocked,
  isTrackUnlocked,
  rewardForFeature,
  rewardForTrack,
  showTrophyUnlockNotice
} from '/turn/progression/trophy-road.js';
import { getStoredBestLap } from '/turn/race/rival-storage.js?source=20260729-r118-m8';
import { getCarDefinition } from '/turn/vehicle/catalog.js?source=20260729-r118-m8';
import { renderBestCarThumbnail } from '/turn/ui/track-best-car.js?revision=r253-supercar-release';
import { getBestDriftRecord } from '/turn/scoring/drift-records.js?revision=r206-home-track-records';
import { getBestFlowRecord } from '/turn/scoring/flow-records.js?revision=r206-home-track-records';

const SCORE_FORMATTER = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const SHEET_ID = 'turnTrackSheet';
const DIFFICULTY_TOKENS = Object.freeze({
  EASY: 'easy',
  MEDIUM: 'medium',
  ADVANCED: 'advanced',
  EXPERT: 'expert'
});
// DRIFT and FLOW records exist only once their scoring modes are unlocked.
const RECORD_KINDS = Object.freeze([
  Object.freeze({ kind: 'time', label: 'TIME', featureId: null, read: getStoredBestLap }),
  Object.freeze({ kind: 'drift', label: 'DRIFT', featureId: 'drift-attack', read: getBestDriftRecord }),
  Object.freeze({ kind: 'flow', label: 'FLOW', featureId: 'flow', read: getBestFlowRecord })
]);
// The inline overview replaces the Track sheet once the screen has room for it: beside
// the grid on large landscape screens, below it on tall portrait ones.
const OVERVIEW_QUERY = '(min-width: 1000px) and (min-height: 640px), (min-width: 700px) and (min-height: 1000px)';

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

export function formatRecordTime(seconds) {
  if (!Number.isFinite(seconds)) return '';
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  const ms = Math.floor((seconds % 1) * 1000).toString().padStart(3, '0');
  return `${minutes}:${secs}.${ms}`;
}

function formatRecordScore(score) {
  const rounded = Math.round(Number(score));
  return Number.isFinite(rounded) && rounded > 0 ? SCORE_FORMATTER.format(rounded) : '';
}

// The track's real route, fitted to a square. The stroke widths stay constant at any
// rendered size; the colours come from CSS (Ink outline, the track's accent inside).
const routeCache = new Map();
function routeMarkup(trackId) {
  if (!routeCache.has(trackId)) {
    const points = getTrackPreviewPoints(trackId, 110);
    const xs = points.map((point) => point.x);
    const zs = points.map((point) => point.z);
    const minX = Math.min(...xs);
    const minZ = Math.min(...zs);
    const width = Math.max(1, Math.max(...xs) - minX);
    const height = Math.max(1, Math.max(...zs) - minZ);
    const scale = 84 / Math.max(width, height);
    const offsetX = (100 - width * scale) / 2;
    const offsetY = (100 - height * scale) / 2;
    const path = points.map((point, index) => {
      const x = offsetX + (point.x - minX) * scale;
      const y = offsetY + (point.z - minZ) * scale;
      return `${index ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');
    routeCache.set(trackId, `
      <svg class="turn-pr-route" viewBox="0 0 100 100" focusable="false" aria-hidden="true">
        <path class="turn-pr-route-outline" d="${path} Z"></path>
        <path class="turn-pr-route-line" d="${path} Z"></path>
      </svg>`);
  }
  return routeCache.get(trackId);
}

function lockFor(trackId) {
  const reward = rewardForTrack(trackId);
  if (!reward || isTrackUnlocked(trackId)) return null;
  return reward;
}

function difficultyChip(track) {
  const token = DIFFICULTY_TOKENS[track.difficulty] || 'easy';
  return `<span class="turn-pr-chip is-${token}">${escapeHtml(track.difficulty)}</span>`;
}

function renderCard(track, index) {
  return `
    <li class="roadbook-item">
      <button
        class="turn-pr-card roadbook-card"
        type="button"
        data-track-id="${escapeHtml(track.id)}"
        aria-pressed="false"
        style="--turn-pr-accent:${escapeHtml(track.accent)}"
      >
        <span class="turn-pr-card-tab" aria-hidden="true">
          <span class="turn-pr-card-ordinal">${ordinal(index)}</span>
          <span class="turn-pr-icon">${trackIconMarkup(track.id)}</span>
        </span>
        <span class="turn-pr-card-body">
          <span class="turn-pr-card-meta">
            ${difficultyChip(track)}
            <span class="turn-pr-card-state" aria-hidden="true"></span>
          </span>
          <span class="turn-pr-card-name">${escapeHtml(track.name)}</span>
        </span>
        <span class="turn-pr-card-art" aria-hidden="true">${routeMarkup(track.id)}</span>
      </button>
    </li>`;
}

function renderPlaceholder(track, index) {
  return `
    <li class="roadbook-item">
      <div class="turn-pr-card roadbook-card is-coming-soon" role="group" aria-label="${escapeHtml(track.name || 'New track')}, coming soon">
        <span class="turn-pr-card-tab" aria-hidden="true"><span class="turn-pr-card-ordinal">${ordinal(index)}</span></span>
        <span class="turn-pr-card-body">
          <span class="turn-pr-card-meta"><span class="turn-pr-chip">SOON</span></span>
          <span class="turn-pr-card-name">${escapeHtml(track.name || 'Coming soon')}</span>
        </span>
      </div>
    </li>`;
}

// Track sheet and overview share one detail renderer.
function renderDetail(track, { idPrefix }) {
  const lock = lockFor(track.id);
  const records = RECORD_KINDS.map(({ kind, label }) => `
    <li class="turn-pr-record is-${kind}" data-record-kind="${kind}">
      <span class="turn-pr-record-copy">
        <span class="turn-pr-record-label">${label}</span>
        <strong class="turn-pr-record-value"></strong>
      </span>
      <span class="turn-pr-record-car">
        <span class="turn-pr-record-car-name"></span>
        <img class="turn-pr-record-model" alt="" draggable="false" hidden>
      </span>
    </li>`).join('');
  return `
    <div class="turn-pr-detail-route" style="--turn-pr-accent:${escapeHtml(track.accent)}">
      ${difficultyChip(track)}
      <span class="turn-pr-icon is-large" aria-hidden="true">${trackIconMarkup(track.id)}</span>
      ${routeMarkup(track.id)}
    </div>
    <p class="turn-pr-detail-description">${escapeHtml(track.description)}</p>
    ${lock ? `
      <p class="turn-pr-lock-note">
        <span class="turn-pr-lock-icon" aria-hidden="true">${LOCK_ICON}</span>
        <span>Locked. ${escapeHtml(track.name)} unlocks at <strong>${lock.threshold}</strong> trophies on Trophy Road.</span>
      </p>` : ''}
    <section class="turn-pr-records" aria-labelledby="${idPrefix}RecordsTitle">
      <h3 class="turn-pr-section-title" id="${idPrefix}RecordsTitle">Personal bests</h3>
      <ul class="turn-pr-record-list">${records}</ul>
      <div class="turn-pr-detail-actions"></div>
    </section>`;
}

let thumbnailGeneration = 0;

// Fill the record rows of a rendered detail. Car artwork comes from the same
// renderer the rest of TURN uses, one thumbnail at a time, after the text is in.
function fillRecords(container, track) {
  const generation = ++thumbnailGeneration;
  const requests = [];
  for (const { kind, featureId, read } of RECORD_KINDS) {
    const row = container.querySelector(`[data-record-kind="${kind}"]`);
    if (!row) continue;
    const value = row.querySelector('.turn-pr-record-value');
    const carName = row.querySelector('.turn-pr-record-car-name');
    const model = row.querySelector('.turn-pr-record-model');
    const locked = featureId && !isFeatureUnlocked(featureId);
    const reward = locked ? rewardForFeature(featureId) : null;
    const record = locked ? null : read(track.id);
    const shown = record
      ? (kind === 'time' ? formatRecordTime(record.time) : formatRecordScore(record.score))
      : '';
    row.classList.toggle('is-locked', Boolean(locked));
    row.classList.toggle('is-empty', !locked && !shown);
    if (locked) {
      value.innerHTML = `<span class="turn-pr-lock-icon" aria-hidden="true">${LOCK_ICON}</span>Unlocks at ${reward?.threshold ?? ''} trophies`;
    } else {
      value.textContent = shown || (kind === 'time' ? 'No time yet' : 'No score yet');
    }
    const car = shown && record?.carId ? getCarDefinition(record.carId) : null;
    carName.textContent = car?.name || '';
    model.hidden = true;
    model.removeAttribute('src');
    if (car) requests.push({ model, record });
  }
  void (async () => {
    for (const { model, record } of requests) {
      try {
        const source = await renderBestCarThumbnail(record);
        if (generation !== thumbnailGeneration || !model.isConnected) return;
        model.src = source;
        model.hidden = false;
      } catch (error) {
        console.warn('TURN: could not render a record car.', error);
      }
    }
  })();
}

export function installRoadbook({
  home,
  getSelectedTrackId,
  onSelectTrack,
  onChooseCar,
  documentRef = document,
  windowRef = window
}) {
  const tracks = TRACK_CATALOG;
  const placeholders = Array.isArray(TRACK_PLACEHOLDERS) ? TRACK_PLACEHOLDERS : [];

  const root = documentRef.createElement('main');
  root.className = 'roadbook';
  root.innerHTML = `
    <div class="roadbook-layout">
      <div class="roadbook-tracks">
        <header class="turn-pr-page-head">
          <h1 class="turn-pr-display" id="m8HomeTitle" tabindex="-1">ROADBOOK</h1>
          <p class="turn-pr-lead">Choose your track</p>
        </header>
        <ol class="roadbook-list" aria-labelledby="m8HomeTitle">
          ${tracks.map(renderCard).join('')}
          ${placeholders.map((track, index) => renderPlaceholder(track, tracks.length + index)).join('')}
        </ol>
      </div>
      <aside class="roadbook-overview turn-pr-panel" aria-labelledby="roadbookOverviewTitle" hidden>
        <header class="turn-pr-panel-head">
          <h2 class="turn-pr-panel-title" id="roadbookOverviewTitle" tabindex="-1"></h2>
        </header>
        <div class="turn-pr-panel-body"></div>
      </aside>
    </div>
    <div class="turn-pr-dock roadbook-dock">
      <div class="turn-pr-dock-inner">
        <p class="turn-pr-dock-context" id="roadbookDockContext">
          <span class="turn-pr-icon" aria-hidden="true"></span>
          <span class="turn-pr-dock-name"></span>
          <span class="turn-pr-dock-detail"></span>
        </p>
        <div class="turn-pr-dock-actions">
          <button class="turn-pr-button is-secondary is-sheet roadbook-sheet-button" type="button" aria-haspopup="dialog" aria-controls="${SHEET_ID}">Track sheet</button>
          <button class="turn-pr-button is-primary m8-track-continue" type="button" aria-describedby="roadbookDockContext">
            <span class="turn-pr-button-label">CHOOSE CAR</span><span class="turn-pr-button-arrow" aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </div>`;

  const sheet = documentRef.createElement('dialog');
  sheet.id = SHEET_ID;
  sheet.className = 'turn-pr-sheet roadbook-sheet';
  sheet.setAttribute('aria-labelledby', 'turnTrackSheetTitle');
  sheet.innerHTML = `
    <div class="turn-pr-sheet-card">
      <header class="turn-pr-sheet-head">
        <h2 class="turn-pr-sheet-title" id="turnTrackSheetTitle"></h2>
        <button class="turn-pr-close" type="button" aria-label="Close Track sheet"><span aria-hidden="true">×</span></button>
      </header>
      <div class="turn-pr-sheet-body"></div>
    </div>`;
  documentRef.body.appendChild(sheet);

  const list = root.querySelector('.roadbook-list');
  const cards = [...list.querySelectorAll('.roadbook-card[data-track-id]')];
  const overview = root.querySelector('.roadbook-overview');
  const overviewTitle = overview.querySelector('.turn-pr-panel-title');
  const overviewBody = overview.querySelector('.turn-pr-panel-body');
  const dockIcon = root.querySelector('.turn-pr-dock-context .turn-pr-icon');
  const dockName = root.querySelector('.turn-pr-dock-name');
  const dockDetail = root.querySelector('.turn-pr-dock-detail');
  const sheetButton = root.querySelector('.roadbook-sheet-button');
  const chooseButton = root.querySelector('.m8-track-continue');
  const chooseLabel = chooseButton.querySelector('.turn-pr-button-label');
  const sheetTitle = sheet.querySelector('.turn-pr-sheet-title');
  const sheetBody = sheet.querySelector('.turn-pr-sheet-body');
  const sheetClose = sheet.querySelector('.turn-pr-close');
  const overviewMedia = windowRef.matchMedia?.(OVERVIEW_QUERY) || null;
  let busyLabel = '';
  let overviewTrackId = '';

  function selectedTrack() {
    const id = getSelectedTrackId();
    return tracks.find((track) => track.id === id) || tracks[0];
  }

  function overviewShown() {
    return Boolean(overviewMedia?.matches);
  }

  function shareSlot(container, track) {
    const actions = container.querySelector('.turn-pr-detail-actions');
    if (!actions) return;
    actions.replaceChildren();
    const share = globalThis.__turnYourTurnShare;
    if (!share?.canShare?.(track.id) || lockFor(track.id)) return;
    const button = documentRef.createElement('button');
    button.type = 'button';
    button.className = 'turn-pr-button is-secondary is-compact roadbook-share';
    button.textContent = 'Share your best lap';
    button.setAttribute('aria-label', `Share your best lap on ${titleCase(track.name)} as a YOUR TURN challenge`);
    button.addEventListener('click', () => share.openForTrack(track.id, button));
    actions.appendChild(button);
  }

  function renderDetailInto(container, track, idPrefix) {
    container.innerHTML = renderDetail(track, { idPrefix });
    fillRecords(container, track);
    shareSlot(container, track);
  }

  function syncCards() {
    const selectedId = selectedTrack().id;
    for (const card of cards) {
      const track = tracks.find((entry) => entry.id === card.dataset.trackId);
      const lock = lockFor(track.id);
      const selected = track.id === selectedId;
      card.classList.toggle('is-selected', selected);
      card.classList.toggle('is-locked', Boolean(lock));
      card.setAttribute('aria-pressed', String(selected));
      const state = card.querySelector('.turn-pr-card-state');
      if (lock) {
        state.innerHTML = `<span class="turn-pr-lock-icon">${LOCK_ICON}</span><span class="turn-pr-threshold">${lock.threshold}</span><span class="turn-pr-lock-icon">${TROPHY_ICON}</span>`;
      } else if (selected) {
        state.innerHTML = '<span class="turn-pr-check">✓</span><span>Selected</span>';
      } else {
        state.textContent = '';
      }
      const label = `${titleCase(track.name)}, ${track.difficulty.toLocaleLowerCase('en')} difficulty track`;
      card.setAttribute('aria-label', lock ? `${label}, locked. Unlocks at ${lock.threshold} trophies.` : `${label}.`);
    }
  }

  function syncDock() {
    const track = selectedTrack();
    const lock = lockFor(track.id);
    dockIcon.innerHTML = trackIconMarkup(track.id);
    dockName.textContent = track.name;
    dockDetail.textContent = lock ? `${track.difficulty} · LOCKED` : track.difficulty;
    sheetButton.hidden = overviewShown();
    chooseButton.classList.toggle('is-locked', Boolean(lock));
    if (busyLabel) {
      chooseLabel.textContent = busyLabel;
      chooseButton.removeAttribute('aria-disabled');
      chooseButton.removeAttribute('aria-label');
      return;
    }
    if (lock) {
      chooseLabel.textContent = `UNLOCKS AT ${lock.threshold}`;
      chooseButton.setAttribute('aria-disabled', 'true');
      chooseButton.setAttribute('aria-label', `Choose car. ${titleCase(track.name)} is locked until ${lock.threshold} trophies.`);
    } else {
      chooseLabel.textContent = 'CHOOSE CAR';
      chooseButton.removeAttribute('aria-disabled');
      chooseButton.removeAttribute('aria-label');
    }
  }

  function syncOverview({ force = false } = {}) {
    const shown = overviewShown();
    overview.hidden = !shown;
    root.classList.toggle('has-overview', shown);
    if (!shown) {
      overviewTrackId = '';
      return;
    }
    const track = selectedTrack();
    if (!force && overviewTrackId === track.id) return;
    overviewTrackId = track.id;
    overviewTitle.textContent = track.name;
    renderDetailInto(overviewBody, track, 'roadbookOverview');
  }

  function sync() {
    syncCards();
    syncDock();
    syncOverview();
  }

  function refreshRecords() {
    syncOverview({ force: true });
    if (sheet.open) renderSheet();
  }

  function renderSheet() {
    const track = selectedTrack();
    sheetTitle.textContent = track.name;
    renderDetailInto(sheetBody, track, 'turnTrackSheet');
  }

  function openSheet() {
    renderSheet();
    if (!sheet.open) sheet.showModal();
    sheetClose.focus();
  }

  function closeSheet() {
    if (sheet.open) sheet.close();
  }

  function setBusy(label) {
    busyLabel = label || '';
    chooseButton.disabled = Boolean(label);
    if (label) chooseButton.setAttribute('aria-busy', 'true');
    else chooseButton.removeAttribute('aria-busy');
    syncDock();
  }

  for (const card of cards) {
    card.addEventListener('click', () => {
      if (busyLabel) return;
      onSelectTrack(card.dataset.trackId);
      sync();
      const lock = lockFor(card.dataset.trackId);
      if (lock) {
        const track = tracks.find((entry) => entry.id === card.dataset.trackId);
        showTrophyUnlockNotice({ reward: lock, itemName: titleCase(track?.name) });
      }
    });
  }

  chooseButton.addEventListener('click', (event) => {
    const track = selectedTrack();
    const lock = lockFor(track.id);
    if (lock) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showTrophyUnlockNotice({ reward: lock, itemName: titleCase(track.name) });
      return;
    }
    onChooseCar();
  });
  sheetButton.addEventListener('click', openSheet);
  sheetClose.addEventListener('click', closeSheet);
  sheet.addEventListener('click', (event) => {
    if (event.target === sheet) closeSheet();
  });
  // Focus returns to the Track sheet button, or, when the screen has just grown into
  // the overview (which replaces that button), to the overview's heading.
  sheet.addEventListener('close', () => {
    if (documentRef.querySelector('dialog[open]')) return;
    if (!sheetButton.hidden) sheetButton.focus({ preventScroll: true });
    else if (!overview.hidden) overviewTitle.focus({ preventScroll: true });
  });

  overviewMedia?.addEventListener?.('change', () => {
    // Focus inside the overview must survive the overview disappearing.
    const focusInOverview = overview.contains(documentRef.activeElement);
    // Show the overview and hide its button first, so a closing sheet never returns
    // focus to a control that is about to disappear.
    sync();
    if (overviewShown()) closeSheet();
    else if (focusInOverview) sheetButton.focus({ preventScroll: true });
  });
  windowRef.addEventListener('turn:trophy-road-updated', sync);
  windowRef.addEventListener('storage', (event) => {
    if (event.key === 'turn-achievements-v1') sync();
  });
  windowRef.addEventListener('turn:rivals-reset', refreshRecords);
  documentRef.addEventListener('turn:your-turn-share-changed', refreshRecords);

  home.querySelector('.m8-home-shell').appendChild(root);
  // The page keeps room to scroll its last card clear of the dock, whatever height
  // the dock takes at the current text size.
  const dock = root.querySelector('.roadbook-dock');
  const syncDockSpace = () => {
    const height = dock.getBoundingClientRect().height;
    if (height > 0) home.style.setProperty('--roadbook-dock-height', `${Math.ceil(height)}px`);
  };
  if (typeof ResizeObserver === 'function') new ResizeObserver(syncDockSpace).observe(dock);
  sync();
  syncDockSpace();

  return Object.freeze({
    root,
    sheet,
    chooseButton,
    sheetButton,
    cards: Object.freeze(cards),
    sync,
    refreshRecords,
    setBusy,
    openSheet,
    closeSheet,
    focusSelected() {
      cards.find((card) => card.classList.contains('is-selected'))?.focus({ preventScroll: false });
    }
  });
}
