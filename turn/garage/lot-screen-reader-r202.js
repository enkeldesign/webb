import { getCarDefinition } from '../vehicle/catalog.js?build=20260720-r20&revision=r588-canonical-attributes';
import { TRACK_CATALOG } from '../tracks/catalog.js?build=20260818-r175';
import { describeColorCue } from '../accessibility/color-cues.js?revision=r163';

const STYLE_ID = 'turn-lot-screen-reader-r202-style';
const activePasses = new WeakMap();

function findLotScreen(root) {
  if (root?.matches?.('.lot-screen')) return root;
  return root?.querySelector?.('.lot-screen') || null;
}

function installStructureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    /* The real colour controls live after CAR INFORMATION in DOM order, while
       remaining visually anchored over the lower-left of the 3D showroom. */
    .lot-showroom.lot-screen-reader-structured .lot-colors,
    .lot-showroom.lot-screen-reader-structured .lot-colors.is-paint-locked {
      position: fixed;
      z-index: 7;
      right: auto;
      bottom: calc(var(--lot-picker-height, 122px) + 12px);
      left: max(26px, calc(env(safe-area-inset-left) + 26px));
    }

    @media (max-height: 520px) {
      .lot-showroom.lot-screen-reader-structured .lot-colors,
      .lot-showroom.lot-screen-reader-structured .lot-colors.is-paint-locked {
        bottom: calc(var(--lot-picker-height, 102px) + 8px);
        left: max(22px, calc(env(safe-area-inset-left) + 22px));
      }
    }
  `;
  document.head.appendChild(style);
}

function makeHeading(level, id, text) {
  const heading = document.createElement(`h${level}`);
  heading.id = id;
  heading.className = 'lot-a11y-only';
  heading.textContent = text;
  return heading;
}

function selectedCarButton(carPicker) {
  return carPicker.querySelector('.lot-car-option[aria-checked="true"]')
    || carPicker.querySelector('.lot-car-option[tabindex="0"]')
    || carPicker.querySelector('.lot-car-option');
}

function selectedTrackName() {
  const homeTrackId = globalThis.__turnNextHome?.getSelectedTrackId?.();
  const runtimeTrackId = globalThis.__turnRuntime?.state?.trackId;
  const trackId = homeTrackId || runtimeTrackId || '';
  const track = TRACK_CATALOG.find((entry) => entry.id === trackId);
  if (track?.name) return track.name;
  if (!trackId) return 'selected track';
  return String(trackId).replace(/[-_]+/g, ' ');
}

function conciseCarLabel(button) {
  const car = getCarDefinition(button.dataset.carId);
  const base = button.dataset.lotBaseLabel || car?.name || button.textContent.trim() || 'Car';
  if (!button.classList.contains('is-trophy-locked')) return base;
  const threshold = button.dataset.trophyLockLabel;
  return threshold
    ? `${base} Locked. Unlocks at ${threshold.toLowerCase()} on Trophy Road.`
    : `${base} Locked on Trophy Road.`;
}

function focusWithoutScroll(element) {
  if (!element) return;
  try {
    element.focus({ preventScroll: true });
  } catch (_) {
    element.focus();
  }
}

export function installLotScreenReaderPass(root = document.body) {
  const screen = findLotScreen(root);
  if (!screen?.classList.contains('lot-showroom')) return () => {};

  const current = activePasses.get(screen);
  if (current) return current.release;

  const lotTitle = screen.querySelector('#lot-title');
  const headingPitch = screen.querySelector('.lot-heading-copy > p');
  const progressSummary = screen.querySelector('.lot-progress-summary');
  const pickerShell = screen.querySelector('.lot-car-picker-shell');
  const carPicker = screen.querySelector('.lot-car-picker');
  const side = screen.querySelector('.lot-side');
  const card = screen.querySelector('.lot-card');
  const carTitle = card?.querySelector('.lot-car-title');
  const carDescription = card?.querySelector('.lot-car-description');
  const stats = card?.querySelector('.lot-stats');
  const colors = screen.querySelector('.lot-colors');
  const raceActions = card?.querySelector('.lot-card-actions');
  const raceButton = raceActions?.querySelector('.lot-race');

  if (!lotTitle || !pickerShell || !carPicker || !side || !card || !carTitle
      || !carDescription || !stats || !colors || !raceActions || !raceButton) {
    return () => {};
  }

  installStructureStyle();
  screen.classList.add('lot-screen-reader-structured');

  // A named <section> plus its H1 caused an unnecessary extra "region" reading.
  // The full-screen route is already unambiguously introduced by THE LOT.
  screen.removeAttribute('aria-labelledby');
  headingPitch?.setAttribute('aria-hidden', 'true');
  progressSummary?.removeAttribute('aria-live');

  // Remove the older injected semantic duplicates before constructing the simpler
  // showroom outline. Its observers may keep their detached nodes updated, but no
  // duplicate labels or headings remain in the accessibility tree.
  screen.querySelector('#lot-choose-car-heading')?.remove();
  screen.querySelector('#lot-paint-heading')?.remove();
  screen.querySelector('#lot-car-info-heading')?.remove();
  screen.querySelector('[data-lot-a11y="car-descriptions"]')?.remove();
  screen.querySelector('[data-lot-a11y="selected-car-summary"]')?.remove();

  carDescription.removeAttribute('aria-hidden');
  stats.removeAttribute('aria-hidden');

  // Absolute positioning makes this DOM reorder visually neutral. It gives heading
  // navigation the intended H1 THE LOT -> H2 CHOOSE CAR -> H3 CAR INFORMATION -> H2 RACE outline.
  side.insertAdjacentElement('beforebegin', pickerShell);

  const chooseCarHeading = makeHeading(2, 'lot-sr-choose-car', 'Choose car');
  const chooseCarInstructions = document.createElement('p');
  chooseCarInstructions.id = 'lot-sr-choose-car-instructions';
  chooseCarInstructions.className = 'lot-a11y-only';
  chooseCarInstructions.textContent = 'Swipe through the cars, or use the left and right arrow keys for the previous or next car. Selecting a car moves to Car information.';
  pickerShell.prepend(chooseCarHeading, chooseCarInstructions);
  carPicker.setAttribute('aria-labelledby', chooseCarHeading.id);
  carPicker.setAttribute('aria-describedby', chooseCarInstructions.id);
  carPicker.setAttribute('aria-orientation', 'horizontal');
  carPicker.removeAttribute('aria-label');

  const infoHeading = makeHeading(3, 'lot-sr-car-information', 'Car information');
  infoHeading.tabIndex = -1;
  card.prepend(infoHeading);
  card.setAttribute('role', 'none');
  card.removeAttribute('aria-labelledby');
  carTitle.querySelector(':scope > span')?.setAttribute('aria-hidden', 'true');

  const raceHeading = makeHeading(2, 'lot-sr-race', 'Race');
  const raceSummary = document.createElement('p');
  raceSummary.id = 'lot-sr-race-summary';
  raceSummary.className = 'lot-a11y-only';
  const raceLockDescription = document.createElement('p');
  raceLockDescription.id = 'lot-sr-race-lock-description';
  raceLockDescription.className = 'lot-a11y-only';
  raceActions.before(raceHeading, raceSummary, raceLockDescription);

  // CHOOSE COLOR is deliberately a named group rather than another heading. This
  // keeps heading navigation from CAR INFORMATION going directly to RACE.
  card.insertBefore(colors, raceHeading);
  colors.setAttribute('role', 'group');
  colors.setAttribute('aria-label', 'Choose color');
  colors.removeAttribute('aria-labelledby');

  // The arrow buttons are redundant for non-visual users: the radio group already
  // exposes the same previous/next operation with arrow keys. Keep them as pointer
  // controls without adding two extra stops before CAR INFORMATION.
  for (const cycle of screen.querySelectorAll('.lot-cycle')) {
    cycle.tabIndex = -1;
    cycle.setAttribute('aria-hidden', 'true');
  }

  const buttons = [...carPicker.querySelectorAll('.lot-car-option')];
  const visibleOrder = buttons.map((button) => button.dataset.carId).filter(Boolean);

  function syncCarRadios() {
    for (const button of buttons) {
      const index = visibleOrder.indexOf(button.dataset.carId);
      button.removeAttribute('aria-labelledby');
      button.setAttribute('aria-label', conciseCarLabel(button));
      if (index >= 0) {
        button.setAttribute('aria-posinset', String(index + 1));
        button.setAttribute('aria-setsize', String(visibleOrder.length));
      }
    }

    const selected = selectedCarButton(carPicker);
    for (const button of buttons) button.tabIndex = button === selected ? 0 : -1;
  }

  function syncColorControls() {
    colors.removeAttribute('aria-labelledby');
    if (colors.getAttribute('aria-hidden') !== 'true') colors.setAttribute('aria-label', 'Choose color');

    for (const control of colors.querySelectorAll('.lot-color-control')) {
      const input = control.querySelector('input[type="color"]');
      if (!input) continue;
      control.querySelector('.lot-color-name')?.setAttribute('aria-hidden', 'true');
      const label = control.dataset.paintLabel || 'Car';
      const cue = describeColorCue(input.value);
      input.setAttribute('aria-label', `${label} color. ${cue}.`);
    }
  }

  function syncRaceContext() {
    const selected = selectedCarButton(carPicker);
    const car = getCarDefinition(selected?.dataset.carId);
    const carName = car?.name || selected?.textContent.trim() || 'Selected car';
    const trackName = selectedTrackName();
    raceSummary.textContent = `${carName} on ${trackName}`;

    const locked = raceButton.dataset.trophyLocked === 'true'
      || selected?.classList.contains('is-trophy-locked');
    const descriptions = [raceSummary.id];
    if (locked) {
      const threshold = selected?.dataset.trophyLockLabel;
      raceLockDescription.textContent = threshold
        ? `${carName} is locked. Unlocks at ${threshold.toLowerCase()} on Trophy Road.`
        : `${carName} is locked on Trophy Road.`;
      descriptions.push(raceLockDescription.id);
    } else {
      raceLockDescription.textContent = '';
    }

    // The visible label is the accessible name. Car/track context and lock status
    // are descriptions, avoiding "Race the X / Race this car" duplicate naming.
    raceButton.removeAttribute('aria-label');
    raceButton.setAttribute('aria-describedby', descriptions.join(' '));
  }

  function syncAll() {
    syncCarRadios();
    syncColorControls();
    syncRaceContext();
  }

  syncAll();

  let focusFrame = 0;
  function queueInformationFocus() {
    if (focusFrame) cancelAnimationFrame(focusFrame);
    focusFrame = requestAnimationFrame(() => {
      focusFrame = 0;
      focusWithoutScroll(infoHeading);
    });
  }

  function handlePickerClick(event) {
    const button = event.target?.closest?.('.lot-car-option');
    if (!button || !carPicker.contains(button)) return;
    // VoiceOver/keyboard activation dispatches a synthetic click with detail 0.
    // Pointer users keep their direct manipulation focus where they touched.
    if (event.detail === 0) queueInformationFocus();
  }

  function handlePickerKeydown(event) {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
      queueInformationFocus();
    }
  }

  function handleColorInput(event) {
    if (event.target?.matches?.('input[type="color"]')) syncColorControls();
  }

  carPicker.addEventListener('click', handlePickerClick);
  carPicker.addEventListener('keydown', handlePickerKeydown);
  colors.addEventListener('input', handleColorInput);

  const selectionObserver = new MutationObserver(syncAll);
  selectionObserver.observe(carPicker, {
    subtree: true,
    attributes: true,
    attributeFilter: ['aria-checked', 'class', 'data-trophy-lock-label']
  });

  // Child replacement is enough to catch car changes and paint lock/unlock changes.
  // Do not observe descendant aria-hidden attributes: syncColorControls sets those
  // itself, which would otherwise create a recursive MutationObserver loop.
  const colorObserver = new MutationObserver(syncColorControls);
  colorObserver.observe(colors, {
    childList: true,
    subtree: true
  });

  const raceObserver = new MutationObserver(syncRaceContext);
  raceObserver.observe(raceButton, {
    attributes: true,
    attributeFilter: ['disabled', 'data-trophy-locked']
  });

  const handleTrophyUpdate = syncAll;
  window.addEventListener('turn:trophy-road-updated', handleTrophyUpdate);

  if (!screen.contains(document.activeElement)) {
    lotTitle.tabIndex = -1;
    focusWithoutScroll(lotTitle);
  }

  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    if (focusFrame) cancelAnimationFrame(focusFrame);
    selectionObserver.disconnect();
    colorObserver.disconnect();
    raceObserver.disconnect();
    carPicker.removeEventListener('click', handlePickerClick);
    carPicker.removeEventListener('keydown', handlePickerKeydown);
    colors.removeEventListener('input', handleColorInput);
    window.removeEventListener('turn:trophy-road-updated', handleTrophyUpdate);
    screen.classList.remove('lot-screen-reader-structured');
    activePasses.delete(screen);
  };

  activePasses.set(screen, { release });
  return release;
}
