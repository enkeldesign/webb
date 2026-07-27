import {
  TRACK_CATALOG,
  TRACK_SELECTION_CATALOG,
  getTrackPreviewPoints,
  loadTrackSelection,
  normalizeTrackId
} from '../tracks/catalog.js?build=20260722-r50';
import { getStoredBestLap } from '../race/rival-storage.js?build=20260722-r50';
import { getCarDefinition } from '../vehicle/catalog.js?build=20260724-r59';
import { renderBestCarThumbnail } from './track-best-car.js?build=20260724-r61';

let activeRequest = null;
let bestPreviewGeneration = 0;

export function showTrackSelect({ initialTrackId = loadTrackSelection() } = {}) {
  if (activeRequest) return activeRequest;

  activeRequest = new Promise((resolve) => {
    const overlay = ensureOverlay();
    const cards = [...overlay.querySelectorAll('.track-card:not([disabled])')];
    const continueButton = overlay.querySelector('.track-select-continue');
    const closeButton = overlay.querySelector('.track-select-close');
    let selectedTrackId = normalizeTrackId(initialTrackId);

    function syncSelection() {
      for (const card of cards) {
        const selected = card.dataset.trackId === selectedTrackId;
        card.classList.toggle('is-selected', selected);
        card.setAttribute('aria-pressed', String(selected));
      }
      const track = TRACK_CATALOG.find((entry) => entry.id === selectedTrackId);
      continueButton.textContent = `CONTINUE TO ${track?.name.toUpperCase() || 'THE TRACK'}`;
      continueButton.style.setProperty('--selected-track-accent', track?.accent || '#8ce99a');
    }

    function finish(result) {
      overlay.classList.remove('is-visible');
      document.body.classList.remove('turn-track-select-open');
      window.setTimeout(() => {
        overlay.hidden = true;
      }, 180);
      for (const card of cards) card.removeEventListener('click', selectCard);
      continueButton.removeEventListener('click', continueSelection);
      closeButton.removeEventListener('click', cancelSelection);
      activeRequest = null;
      resolve(result);
    }

    function selectCard(event) {
      selectedTrackId = normalizeTrackId(event.currentTarget.dataset.trackId);
      syncSelection();
    }

    function continueSelection() {
      finish(selectedTrackId);
    }

    function cancelSelection() {
      finish(null);
    }

    for (const card of cards) card.addEventListener('click', selectCard);
    continueButton.addEventListener('click', continueSelection);
    closeButton.addEventListener('click', cancelSelection);

    syncSelection();
    overlay.hidden = false;
    document.body.classList.add('turn-track-select-open');
    requestAnimationFrame(() => {
      overlay.classList.add('is-visible');
      overlay.querySelector(`.track-card[data-track-id="${selectedTrackId}"]`)?.focus({ preventScroll: true });
    });
  });

  return activeRequest;
}

function ensureOverlay() {
  const existing = document.querySelector('.track-select');
  if (existing) {
    refreshBestTimes(existing);
    return existing;
  }

  const overlay = document.createElement('section');
  overlay.className = 'track-select';
  overlay.hidden = true;
  overlay.setAttribute('aria-labelledby', 'trackSelectTitle');
  overlay.innerHTML = `
    <div class="track-select-shell">
      <header class="track-select-head">
        <h2 id="trackSelectTitle">CHOOSE YOUR TRACK</h2>
        <button class="track-select-close" type="button" aria-label="Close track selection">×</button>
      </header>
      <div class="track-select-grid">
        ${TRACK_SELECTION_CATALOG.map(renderTrackCard).join('')}
      </div>
      <footer class="track-select-footer">
        <button class="track-select-continue" type="button">CONTINUE</button>
      </footer>
    </div>
  `;
  document.body.appendChild(overlay);
  refreshBestTimes(overlay);
  return overlay;
}

function renderTrackCard(track) {
  if (track.locked) return renderLockedTrackCard(track);

  const preview = makePreviewSvg(track.id, track.accent);
  return `
    <button
      class="track-card track-card-${track.id}"
      type="button"
      data-track-id="${track.id}"
      aria-label="${track.name}, ${track.difficulty} track"
      aria-pressed="false"
      style="--track-accent:${track.accent};--track-accent-soft:${track.accentSoft}"
    >
      <span class="track-card-summary">
        <span class="track-card-choice">
          <span class="track-card-choice-marker" aria-hidden="true"></span>
          <strong class="track-card-name">${track.name.toUpperCase()}</strong>
        </span>
        <span class="track-card-best" data-track-best="${track.id}">
          <span class="track-card-best-copy">
            <span>BEST:</span>
            <strong class="track-card-best-time">--:--.---</strong>
            <small class="track-card-best-car" hidden></small>
          </span>
          <img class="track-card-best-model" alt="" aria-hidden="true" draggable="false" hidden>
        </span>
        <strong class="track-card-difficulty">${track.difficulty}</strong>
      </span>
      <span class="track-card-preview" aria-hidden="true">${preview}</span>
    </button>
  `;
}

function renderLockedTrackCard(track) {
  return `
    <button
      class="track-card track-card-locked is-locked"
      type="button"
      data-track-id="${track.id}"
      aria-label="${track.eyebrow}, ${track.name}, locked"
      aria-disabled="true"
      disabled
      style="--track-accent:${track.accent};--track-accent-soft:${track.accentSoft}"
    >
      <span class="track-card-summary">
        <span class="track-card-choice">
          <span class="track-card-choice-marker" aria-hidden="true"></span>
          <strong class="track-card-name">${track.name}</strong>
        </span>
        <span class="track-card-best track-card-coming-soon">
          <span class="track-card-best-copy">
            <span>BEST:</span>
            <strong>COMING SOON</strong>
          </span>
        </span>
        <strong class="track-card-difficulty">LOCKED</strong>
      </span>
      <span class="track-card-preview" aria-hidden="true">${makeLockedPreviewSvg()}</span>
    </button>
  `;
}

function makePreviewSvg(trackId, accent) {
  const points = getTrackPreviewPoints(trackId, 110);
  const xs = points.map((point) => point.x);
  const zs = points.map((point) => point.z);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxZ - minZ);
  const scale = Math.min(270 / width, 135 / height);
  const offsetX = (320 - width * scale) / 2;
  const offsetY = (185 - height * scale) / 2;
  const path = points.map((point, index) => {
    const x = offsetX + (point.x - minX) * scale;
    const y = offsetY + (point.z - minZ) * scale;
    return `${index ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');

  return `
    <svg viewBox="0 0 320 185" focusable="false">
      <path class="track-preview-shadow" d="${path} Z"></path>
      <path class="track-preview-road" d="${path} Z"></path>
      <path class="track-preview-line" d="${path} Z" style="stroke:${accent}"></path>
      <circle class="track-preview-start" cx="${(offsetX + (points[0].x - minX) * scale).toFixed(1)}" cy="${(offsetY + (points[0].z - minZ) * scale).toFixed(1)}" r="7"></circle>
    </svg>
  `;
}

function makeLockedPreviewSvg() {
  return `
    <svg viewBox="0 0 320 185" focusable="false">
      <path class="track-preview-shadow" d="M48 136 L48 62 Q50 28 84 40 L126 82 L174 42 Q194 28 216 44 L270 74 L270 142 L214 142 L177 116 L137 150 L76 150 Z"></path>
      <path class="track-preview-road" d="M48 136 L48 62 Q50 28 84 40 L126 82 L174 42 Q194 28 216 44 L270 74 L270 142 L214 142 L177 116 L137 150 L76 150 Z"></path>
    </svg>
  `;
}

function refreshBestTimes(overlay) {
  const generation = ++bestPreviewGeneration;

  for (const track of TRACK_CATALOG) {
    const bestLap = getStoredBestLap(track.id);
    const bestBox = overlay.querySelector(`[data-track-best="${track.id}"]`);
    const time = bestBox?.querySelector('.track-card-best-time');
    const car = bestBox?.querySelector('.track-card-best-car');
    const model = bestBox?.querySelector('.track-card-best-model');

    if (time) time.textContent = formatTime(bestLap?.time ?? Infinity);
    if (car) {
      car.textContent = bestLap ? getCarDefinition(bestLap.carId).name.toUpperCase() : '';
      car.hidden = !bestLap;
    }
    if (model) {
      model.hidden = true;
      model.removeAttribute('src');
      delete model.dataset.previewKey;
    }

    if (!bestLap || !model) continue;

    const previewKey = [
      track.id,
      bestLap.carId,
      bestLap.carColor,
      bestLap.carSecondaryColor
    ].join(':');
    model.dataset.previewKey = previewKey;

    renderBestCarThumbnail(bestLap).then((source) => {
      if (generation !== bestPreviewGeneration || model.dataset.previewKey !== previewKey) return;
      model.src = source;
      model.hidden = false;
    }).catch((error) => {
      console.warn(`TURN: could not render the ${track.name} record car.`, error);
    });
  }
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return 'NO TIME YET';
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  const ms = Math.floor((seconds % 1) * 1000).toString().padStart(3, '0');
  return `${minutes}:${secs}.${ms}`;
}
