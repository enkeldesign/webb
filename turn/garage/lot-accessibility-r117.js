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
  const carDescription = screen?.querySelector('.lot-car-description');
  const stats = screen?.querySelector('.lot-stats');

  if (!screen || !carPicker || !paintPanel || !colors || !card || !carDescription || !stats) {
    return () => {};
  }

  const chooseCarHeading = makeHiddenHeading('lot-choose-car-heading', 'Choose car');
  carPicker.insertAdjacentElement('beforebegin', chooseCarHeading);
  carPicker.setAttribute('aria-labelledby', chooseCarHeading.id);
  carPicker.removeAttribute('aria-label');

  const descriptions = document.createElement('div');
  descriptions.className = 'lot-a11y-only';
  descriptions.dataset.lotA11y = 'car-descriptions';
  const completeLabelIds = new Map();

  for (const car of CAR_CATALOG) {
    const button = [...carPicker.querySelectorAll('.lot-car-option')]
      .find((option) => option.dataset.carId === car.id);
    if (!button) continue;

    button.id ||= `lot-car-option-${car.id}`;

    const description = document.createElement('span');
    description.id = `lot-${car.id}-complete-label`;
    const existingLabel = button.getAttribute('aria-label') || car.name;
    description.textContent = `${existingLabel} ${describeVehicleStats(car.stats)}`;
    descriptions.appendChild(description);
    completeLabelIds.set(car.id, description.id);

    // aria-labelledby takes precedence over aria-label. That keeps the complete
    // name, appearance and attributes stable even when The Lot refreshes aria-label.
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

  const syncSelectedCarSemantics = () => {
    const buttons = [...carPicker.querySelectorAll('.lot-car-option')];
    const selectedButton = buttons.find((button) => button.getAttribute('aria-checked') === 'true')
      || buttons.find((button) => button.tabIndex === 0)
      || buttons[0];
    if (!selectedButton) return;

    for (const button of buttons) button.tabIndex = button === selectedButton ? 0 : -1;

    const completeLabelId = completeLabelIds.get(selectedButton.dataset.carId);
    if (completeLabelId) carDescription.setAttribute('aria-labelledby', completeLabelId);

    // Explicitly identify the checked radio as the group's active item. This
    // helps assistive technology return to the current car instead of treating
    // the first radio in DOM order as the active choice.
    carPicker.setAttribute('aria-activedescendant', selectedButton.id);
  };

  applyStatSemantics();
  syncSelectedCarSemantics();

  const statsObserver = new MutationObserver(applyStatSemantics);
  statsObserver.observe(stats, { childList: true });

  const selectionObserver = new MutationObserver(syncSelectedCarSemantics);
  selectionObserver.observe(carPicker, {
    subtree: true,
    attributes: true,
    attributeFilter: ['aria-checked']
  });

  return () => {
    statsObserver.disconnect();
    selectionObserver.disconnect();
    carPicker.removeAttribute('aria-activedescendant');
    carDescription.removeAttribute('aria-labelledby');
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
