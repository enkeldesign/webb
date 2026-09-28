// ALL CARS: every car as a card, in Trophy Road order. One list, owned here, that
// GARAGE shows in the ALL CARS sheet or, where the screen has room, beside the
// featured car. Each card shows the car's still from its real 3D model at the
// showroom's 20° view (scripts/render-car-stills.mjs); a locked car shows the same
// car as an Ink line drawing, with its lock and trophy threshold.
//
// A car the player has repainted and saved wears those colours on its card too,
// rendered by car-still.js once the list is on screen.
//
// Choosing a card goes through GARAGE's selection model: a playable car becomes the
// choice, a locked car is only previewed.

import { LOCK_ICON, TROPHY_ICON } from '../progression/trophy-road.js';
import { CAR_VIEW } from './car-view.js';
import { paintedStillUrl, stillUrl } from './car-still.js';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

export function carStillUrl(carId, { outline = false } = {}) {
  return stillUrl(`${carId}${outline ? '-outline' : ''}.webp`);
}

export function createGarageCatalog({
  documentRef = document,
  order,
  carName,
  carLock,
  savedPaint = () => null,
  onChoose
}) {
  // Repainted cards render only once the list is on screen.
  let active = false;
  let lastState = null;
  const list = documentRef.createElement('ul');
  list.className = 'garage-catalog';
  list.setAttribute('aria-label', 'All cars');
  list.innerHTML = order.map((carId, index) => `
    <li class="garage-catalog-item">
      <button class="garage-car-card" type="button" data-car-id="${escapeHtml(carId)}" aria-pressed="false">
        <span class="garage-car-art" aria-hidden="true">
          <img class="garage-car-still" alt="" width="${CAR_VIEW.still.width}" height="${CAR_VIEW.still.height}" loading="lazy" decoding="async" draggable="false">
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

  function setSource(still, source) {
    if (still.getAttribute('src') !== source) still.setAttribute('src', source);
  }

  // The factory still, the locked line drawing, or the car in its saved colours.
  function showArt(card, carId, lock) {
    const still = card.querySelector('.garage-car-still');
    const paint = lock ? null : savedPaint(carId);
    if (!paint) {
      delete card.dataset.paint;
      card.classList.remove('is-painting');
      setSource(still, carStillUrl(carId, { outline: Boolean(lock) }));
      return;
    }
    const key = `${paint.color}|${paint.secondaryColor}`.toLowerCase();
    if (card.dataset.paint === key) return;
    // Never show factory or older colours for a repainted car: it waits for the render.
    still.removeAttribute('src');
    delete card.dataset.paint;
    if (!active) return;
    card.dataset.paint = key;
    card.classList.add('is-painting');
    paintedStillUrl({ carId, color: paint.color, secondaryColor: paint.secondaryColor }).then((url) => {
      if (card.dataset.paint === key) setSource(still, url);
    }, (error) => {
      console.warn('TURN: a repainted car card could not render; showing factory colours.', error);
      if (card.dataset.paint === key) setSource(still, carStillUrl(carId));
    }).finally(() => {
      if (card.dataset.paint === key) card.classList.remove('is-painting');
    });
  }

  // choiceId: the playable car RACE starts. previewId: a locked car being looked at.
  function sync({ choiceId, previewId } = lastState || {}) {
    lastState = { choiceId, previewId };
    order.forEach((carId, index) => {
      const card = cards[index];
      const lock = carLock(carId);
      const chosen = carId === choiceId;
      const previewed = carId === previewId;
      card.classList.toggle('is-selected', chosen);
      card.classList.toggle('is-locked', Boolean(lock));
      card.classList.toggle('is-previewed', previewed);
      card.setAttribute('aria-pressed', String(chosen));
      showArt(card, carId, lock);
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

  // The list is on screen (the sheet opened, or it sits on the page).
  function setActive(next) {
    if (active === Boolean(next)) return;
    active = Boolean(next);
    if (active && lastState) sync(lastState);
  }

  return Object.freeze({ list, sync, cardFor, setActive });
}
