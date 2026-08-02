const buildKey = globalThis.__TURN_BUILD__?.cacheKey || '';
const catalogUrl = new URL('./catalog.js', import.meta.url);
if (buildKey) catalogUrl.searchParams.set('build', buildKey);

const {
  CAR_CATALOG,
  getEffectiveVehicleStats,
  isSportsSedanEasterEgg,
  normalizeVehicleSecondaryColor
} = await import(catalogUrl.href);

const STAT_KEYS = Object.freeze([
  'speed',
  'acceleration',
  'control',
  'drift',
  'boostPower',
  'boostDuration'
]);

export function installSportsSedanEasterEggUi() {
  if (globalThis.__turnSportsSedanEasterEggUiInstalled) return;
  globalThis.__turnSportsSedanEasterEggUiInstalled = true;

  const connectLot = () => {
    const lot = document.querySelector('.lot-screen');
    if (!lot || lot.dataset.turnEasterEggUi === 'installed') return;
    lot.dataset.turnEasterEggUi = 'installed';

    let syncQueued = false;
    const sync = () => {
      syncQueued = false;
      syncLotStats(lot);
    };
    const scheduleSync = () => {
      if (syncQueued) return;
      syncQueued = true;
      queueMicrotask(sync);
    };

    lot.addEventListener('input', scheduleSync);
    lot.addEventListener('change', scheduleSync);

    const card = lot.querySelector('.lot-card');
    if (card && typeof MutationObserver === 'function') {
      const cardObserver = new MutationObserver(scheduleSync);
      cardObserver.observe(card, { childList: true, subtree: true, characterData: true });
    }

    sync();
  };

  connectLot();
  if (typeof MutationObserver === 'function') {
    const bodyObserver = new MutationObserver(connectLot);
    bodyObserver.observe(document.body, { childList: true });
  }
}

function syncLotStats(lot) {
  const selectedCarId = lot.querySelector('.lot-car-option[aria-checked="true"]')?.dataset.carId;
  const car = CAR_CATALOG.find((candidate) => candidate.id === selectedCarId);
  const rows = [...lot.querySelectorAll('.lot-stats .lot-stat')];
  if (!car || rows.length !== STAT_KEYS.length) return;

  const spoilerControl = [...lot.querySelectorAll('.lot-color-control')]
    .find((control) => control.querySelector('span')?.textContent?.trim() === 'SPOILER');
  const spoilerColor = spoilerControl?.querySelector('input[type="color"]')?.value;
  const selection = {
    carId: car.id,
    secondaryColor: normalizeVehicleSecondaryColor(spoilerColor)
  };
  const stats = getEffectiveVehicleStats(selection);
  const superSedanUnlocked = isSportsSedanEasterEgg(selection);

  rows.forEach((row, rowIndex) => {
    const value = Number(stats[STAT_KEYS[rowIndex]]) || 0;
    [...row.querySelectorAll('i b')].forEach((pip, pipIndex) => {
      pip.classList.toggle('is-full', pipIndex < value);
    });
  });

  syncUnlockPresentation(lot, car, superSedanUnlocked);
}

function syncUnlockPresentation(lot, car, unlocked) {
  const title = lot.querySelector('.lot-car-title strong');
  const raceButton = lot.querySelector('.lot-race');
  const notice = ensureUnlockNotice(lot);

  const displayedName = unlocked ? 'Super Sedan' : car.name;
  if (title && title.textContent !== displayedName) title.textContent = displayedName;
  raceButton?.setAttribute('aria-label', `Race the ${displayedName}`);

  notice.hidden = !unlocked;
  lot.classList.toggle('is-super-sedan-unlocked', unlocked);
}

function ensureUnlockNotice(lot) {
  const existing = lot.querySelector('.lot-secret-notice');
  if (existing) return existing;

  const notice = document.createElement('section');
  notice.className = 'lot-secret-notice';
  notice.hidden = true;
  notice.setAttribute('role', 'status');
  notice.setAttribute('aria-live', 'polite');
  notice.setAttribute('aria-atomic', 'true');
  notice.innerHTML = `
    <span class="lot-secret-notice-chip">SECRET UNLOCKED</span>
    <p>Spoiler <strong>color code #666</strong> maxes every attribute. Lap results with this secret car are not saved.</p>
  `;

  const card = lot.querySelector('.lot-card');
  const actions = card?.querySelector('.lot-card-actions');
  if (card) card.insertBefore(notice, actions || null);
  return notice;
}
