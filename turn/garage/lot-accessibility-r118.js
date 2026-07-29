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
  const colors = screen?.querySelector('.lot-colors');
  const card = screen?.querySelector('.lot-card');
  const carDescription = screen?.querySelector('.lot-car-description');
  const stats = screen?.querySelector('.lot-stats');

  if (!screen || !carPicker || !colors || !card || !carDescription || !stats) {
    return () => {};
  }

  const chooseCarHeading = makeHiddenHeading('lot-choose-car-heading', 'Choose car');
  carPicker.insertAdjacentElement('beforebegin', chooseCarHeading);
  carPicker.setAttribute('aria-labelledby', chooseCarHeading.id);
  carPicker.removeAttribute('aria-label');

  const descriptions = document.createElement('div');
  descriptions.className = 'lot-a11y-only';
  descriptions.dataset.lotA11y = 'car-descriptions';

  const completeTextByCarId = new Map();
  const buttonsByCarId = new Map();

  CAR_CATALOG.forEach((car, index) => {
    const button = [...carPicker.querySelectorAll('.lot-car-option')]
      .find((option) => option.dataset.carId === car.id);
    if (!button) return;

    button.id ||= `lot-car-option-${car.id}`;
    button.setAttribute('aria-posinset', String(index + 1));
    button.setAttribute('aria-setsize', String(CAR_CATALOG.length));

    const description = document.createElement('span');
    description.id = `lot-${car.id}-complete-label`;
    const existingLabel = button.getAttribute('aria-label') || car.name;
    const completeText = `${existingLabel} ${describeVehicleStats(car.stats)}`;
    description.textContent = completeText;
    descriptions.appendChild(description);

    completeTextByCarId.set(car.id, completeText);
    buttonsByCarId.set(car.id, button);

    // The radio itself uses real hidden text as its accessible name. This avoids
    // depending on a generated aria-label that The Lot refreshes after selection.
    button.setAttribute('aria-labelledby', description.id);
  });

  carPicker.insertAdjacentElement('afterend', descriptions);

  const paintHeading = makeHiddenHeading('lot-paint-heading', 'Choose car colour');
  colors.insertAdjacentElement('beforebegin', paintHeading);
  colors.setAttribute('role', 'group');
  colors.setAttribute('aria-labelledby', paintHeading.id);
  colors.removeAttribute('aria-label');

  const infoHeading = makeHiddenHeading('lot-car-info-heading', 'Car information');
  const selectedSummary = document.createElement('p');
  selectedSummary.id = 'lot-selected-car-summary';
  selectedSummary.className = 'lot-a11y-only';
  selectedSummary.dataset.lotA11y = 'selected-car-summary';

  card.prepend(infoHeading);
  infoHeading.insertAdjacentElement('afterend', selectedSummary);
  card.setAttribute('role', 'region');
  card.setAttribute('aria-labelledby', infoHeading.id);

  // The visible paragraph and bars remain exactly as designed. Assistive
  // technology receives one equivalent, complete text paragraph instead of an
  // unreliable label on a generic paragraph followed by duplicated bar content.
  carDescription.setAttribute('aria-hidden', 'true');
  stats.setAttribute('aria-hidden', 'true');

  let orderedFromCarId = '';

  const syncSelectedCarSemantics = () => {
    const buttons = [...buttonsByCarId.values()];
    const selectedButton = buttons.find((button) => button.getAttribute('aria-checked') === 'true')
      || buttons.find((button) => button.tabIndex === 0)
      || buttons[0];
    if (!selectedButton) return;

    for (const button of buttons) button.tabIndex = button === selectedButton ? 0 : -1;

    const selectedCarId = selectedButton.dataset.carId;
    selectedSummary.textContent = completeTextByCarId.get(selectedCarId) || selectedButton.textContent;

    // VoiceOver heading navigation resumes at the first radio in DOM order, not
    // at aria-activedescendant on a non-focusable radiogroup. Rotate the hidden
    // radio DOM order so the checked car is first, followed by the remaining cars
    // in catalogue order. The visible 3D parking lot is unaffected.
    if (selectedCarId && orderedFromCarId !== selectedCarId) {
      const selectedIndex = CAR_CATALOG.findIndex((car) => car.id === selectedCarId);
      const orderedCars = selectedIndex >= 0
        ? [...CAR_CATALOG.slice(selectedIndex), ...CAR_CATALOG.slice(0, selectedIndex)]
        : CAR_CATALOG;
      const fragment = document.createDocumentFragment();
      for (const car of orderedCars) {
        const button = buttonsByCarId.get(car.id);
        if (button) fragment.appendChild(button);
      }
      carPicker.appendChild(fragment);
      orderedFromCarId = selectedCarId;
    }
  };

  syncSelectedCarSemantics();

  const selectionObserver = new MutationObserver(syncSelectedCarSemantics);
  selectionObserver.observe(carPicker, {
    subtree: true,
    attributes: true,
    attributeFilter: ['aria-checked']
  });

  return () => {
    selectionObserver.disconnect();
    carDescription.removeAttribute('aria-hidden');
    stats.removeAttribute('aria-hidden');
    chooseCarHeading.remove();
    descriptions.remove();
    paintHeading.remove();
    selectedSummary.remove();
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
