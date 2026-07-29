import { CAR_CATALOG } from '../vehicle/catalog.js?build=20260720-r20';

const STAT_FIELDS = Object.freeze([
  Object.freeze({ key: 'speed', label: 'Top speed' }),
  Object.freeze({ key: 'acceleration', label: 'Acceleration' }),
  Object.freeze({ key: 'control', label: 'Control' }),
  Object.freeze({ key: 'drift', label: 'Drift' }),
  Object.freeze({ key: 'boostPower', label: 'Boost power' }),
  Object.freeze({ key: 'boostDuration', label: 'Boost tank' })
]);

export function installLotAccessibility(root = document.body) {
  const screen = root.querySelector('.lot-screen');
  const carPicker = screen?.querySelector('.lot-car-picker');
  const paintPanel = screen?.querySelector('.lot-viewbox');
  const colors = screen?.querySelector('.lot-colors');
  const card = screen?.querySelector('.lot-card');
  const stats = screen?.querySelector('.lot-stats');

  if (!screen || !carPicker || !paintPanel || !colors || !card || !stats) return () => {};

  const chooseCarHeading = makeHiddenHeading('lot-choose-car-heading', 'Choose car');
  carPicker.insertAdjacentElement('beforebegin', chooseCarHeading);
  carPicker.setAttribute('aria-labelledby', chooseCarHeading.id);
  carPicker.removeAttribute('aria-label');

  const descriptions = document.createElement('div');
  descriptions.className = 'lot-a11y-only';
  descriptions.dataset.lotA11y = 'car-descriptions';

  for (const car of CAR_CATALOG) {
    const button = [...carPicker.querySelectorAll('.lot-car-option')]
      .find((option) => option.dataset.carId === car.id);
    if (!button) continue;

    const description = document.createElement('span');
    description.id = `lot-${car.id}-complete-label`;
    const existingLabel = button.getAttribute('aria-label') || car.name;
    description.textContent = `${existingLabel} ${describeVehicleStats(car.stats)}`;
    descriptions.appendChild(description);

    // aria-labelledby takes precedence over aria-label. That keeps the complete
    // name, appearance and attributes stable even when the Lot refreshes aria-label.
    button.setAttribute('aria-labelledby', description.id);
  }

  carPicker.insertAdjacentElement('afterend', descriptions);

  const paintHeading = makeHiddenHeading('lot-paint-heading', 'Choose car colour');
  colors.insertAdjacentElement('beforebegin', paintHeading);
  colors.setAttribute('role', 'group');
  colors.setAttribute('aria-labelledby', paintHeading.id);
  colors.removeAttribute('aria-label');

  const infoHeading = makeHiddenHeading('lot-car-info-heading', 'Car information');
  card.prepend(infoHeading);
  card.setAttribute('role', 'region');
  card.setAttribute('aria-labelledby', infoHeading.id);

  stats.setAttribute('role', 'list');
  stats.setAttribute('aria-label', 'Attributes');

  const applyStatSemantics = () => {
    stats.querySelectorAll('.lot-stat').forEach((row) => row.setAttribute('role', 'listitem'));
  };
  applyStatSemantics();

  const statsObserver = new MutationObserver(applyStatSemantics);
  statsObserver.observe(stats, { childList: true });

  return () => {
    statsObserver.disconnect();
    chooseCarHeading.remove();
    descriptions.remove();
    paintHeading.remove();
    infoHeading.remove();
  };
}

function makeHiddenHeading(id, text) {
  const heading = document.createElement('h2');
  heading.id = id;
  heading.className = 'lot-a11y-only';
  heading.textContent = text;
  return heading;
}

function describeVehicleStats(stats) {
  return STAT_FIELDS
    .map(({ key, label }) => `${label}. ${Number(stats?.[key]) || 0} out of 5.`)
    .join(' ');
}
