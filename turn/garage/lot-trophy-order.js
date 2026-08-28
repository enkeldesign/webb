export const LOT_TROPHY_ORDER = Object.freeze([
  'classic',
  'truck',
  'sedan',
  'van',
  'suv',
  'convertible',
  'sedan-sports',
  'vintage-racer',
  'race',
  'firetruck',
  'ambulance',
  'police',
  'monster-truck',
  'race-future',
  'toy-racer'
]);

function findLotScreen(root) {
  if (root?.matches?.('.lot-screen')) return root;
  return root?.querySelector?.('.lot-screen') || null;
}

function orderedButtons(picker) {
  const byId = new Map(
    [...picker.querySelectorAll('.lot-car-option')]
      .map((button) => [button.dataset.carId, button])
      .filter(([id]) => Boolean(id))
  );
  return LOT_TROPHY_ORDER.map((id) => byId.get(id)).filter(Boolean);
}

function selectedIndex(buttons) {
  const index = buttons.findIndex((button) => button.getAttribute('aria-checked') === 'true');
  return index >= 0 ? index : 0;
}

export function installLotTrophyOrder(root = document.body) {
  const screen = findLotScreen(root);
  const picker = screen?.querySelector('.lot-car-picker');
  if (!screen || !picker) return () => {};

  const originalOrder = [...picker.children];
  const buttons = orderedButtons(picker);
  if (!buttons.length) return () => {};

  for (const button of buttons) picker.appendChild(button);

  const previousButton = screen.querySelector('.lot-cycle-prev');
  const nextButton = screen.querySelector('.lot-cycle-next');

  const activateAt = (index, { focus = false } = {}) => {
    const button = buttons[(index + buttons.length) % buttons.length];
    if (!button) return;
    button.click();
    if (focus) button.focus();
  };

  const cycle = (direction, options) => {
    activateAt(selectedIndex(buttons) + direction, options);
  };

  const handlePrevious = (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    cycle(-1);
  };
  const handleNext = (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    cycle(1);
  };
  const handleKeydown = (event) => {
    let targetIndex = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      targetIndex = selectedIndex(buttons) + 1;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      targetIndex = selectedIndex(buttons) - 1;
    } else if (event.key === 'Home') {
      targetIndex = 0;
    } else if (event.key === 'End') {
      targetIndex = buttons.length - 1;
    }
    if (targetIndex == null) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    activateAt(targetIndex, { focus: true });
  };

  previousButton?.addEventListener('click', handlePrevious, true);
  nextButton?.addEventListener('click', handleNext, true);
  picker.addEventListener('keydown', handleKeydown, true);
  screen.dataset.lotTrophyOrder = 'vehicle-unlocks';

  return () => {
    previousButton?.removeEventListener('click', handlePrevious, true);
    nextButton?.removeEventListener('click', handleNext, true);
    picker.removeEventListener('keydown', handleKeydown, true);
    for (const node of originalOrder) picker.appendChild(node);
    delete screen.dataset.lotTrophyOrder;
  };
}
