// ALL CARS: every car as a card, in Trophy Road order. One list, owned here, that
// GARAGE shows in the ALL CARS sheet or, where the screen has room, beside the
// featured car. Each card shows the car's still from its real 3D model at the
// showroom's 20° view (scripts/render-car-stills.mjs); a locked car shows the same
// car as an Ink line drawing, with its lock and trophy threshold.
//
// Choosing a card goes through GARAGE's selection model: a playable car becomes the
// choice, a locked car is only previewed.

import { LOCK_ICON, TROPHY_ICON } from '../progression/trophy-road.js';

const STILL_WIDTH = 480;
const STILL_HEIGHT = 288;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

export function carStillUrl(carId, { outline = false } = {}) {
  const url = new URL(`../assets/cars/stills/${carId}${outline ? '-outline' : ''}.webp`, import.meta.url);
  const buildKey = globalThis.__TURN_BUILD__?.cacheKey;
  if (buildKey) url.searchParams.set('build', buildKey);
  return url.href;
}

export function createGarageCatalog({
  documentRef = document,
  order,
  carName,
  carLock,
  onChoose
}) {
  const list = documentRef.createElement('ul');
  list.className = 'garage-catalog';
  list.setAttribute('aria-label', 'All cars');
  list.innerHTML = order.map((carId, index) => `
    <li class="garage-catalog-item">
      <button class="garage-car-card" type="button" data-car-id="${escapeHtml(carId)}" aria-pressed="false">
        <span class="garage-car-art" aria-hidden="true">
          <img class="garage-car-still" alt="" width="${STILL_WIDTH}" height="${STILL_HEIGHT}" loading="lazy" decoding="async" draggable="false">
        </span>
        <span class="garage-car-body">
          <span class="garage-car-name">${escapeHtml(carName(carId))}</span>
          <span class="garage-car-meta" aria-hidden="true">
            <span class="garage-car-ordinal">${String(index + 1).padStart(2, '0')}</span>
            <span class="garage-car-state"></span>
          </span>
        </span>
      </button>
    </li>`).join('');
  const cards = [...list.querySelectorAll('.garage-car-card')];

  for (const card of cards) {
    const still = card.querySelector('.garage-car-still');
    // A car without a still keeps its card, name and state.
    still.addEventListener('error', () => card.classList.add('has-no-still'));
    still.addEventListener('load', () => card.classList.remove('has-no-still'));
    // detail is 0 for a keyboard or assistive-technology activation.
    card.addEventListener('click', (event) => onChoose(card.dataset.carId, { card, pointer: event.detail > 0 }));
  }

  // choiceId: the playable car RACE starts. previewId: a locked car being looked at.
  function sync({ choiceId, previewId }) {
    order.forEach((carId, index) => {
      const card = cards[index];
      const lock = carLock(carId);
      const chosen = carId === choiceId;
      const previewed = carId === previewId;
      card.classList.toggle('is-selected', chosen);
      card.classList.toggle('is-locked', Boolean(lock));
      card.classList.toggle('is-previewed', previewed);
      card.setAttribute('aria-pressed', String(chosen));
      const still = card.querySelector('.garage-car-still');
      const source = carStillUrl(carId, { outline: Boolean(lock) });
      if (still.getAttribute('src') !== source) still.setAttribute('src', source);
      const state = card.querySelector('.garage-car-state');
      if (lock) {
        state.innerHTML = previewed
          ? '<span>Previewing</span>'
          : `<span class="turn-pr-lock-icon">${LOCK_ICON}</span><span class="garage-car-threshold">${lock.threshold}</span><span class="turn-pr-lock-icon">${TROPHY_ICON}</span>`;
      } else if (chosen) {
        state.innerHTML = '<span class="turn-pr-check">✓</span><span>Selected</span>';
      } else {
        state.textContent = '';
      }
      const position = `${index + 1} of ${order.length}`;
      card.setAttribute('aria-label', lock
        ? `${carName(carId)}, ${position}. Locked until ${lock.threshold} trophies${previewed ? '. Previewing' : '. Preview'}.`
        : `${carName(carId)}, ${position}.`);
    });
  }

  function cardFor(carId) {
    return cards.find((card) => card.dataset.carId === carId) || null;
  }

  return Object.freeze({ list, sync, cardFor });
}
