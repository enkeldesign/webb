const buildKey = globalThis.__TURN_BUILD__?.cacheKey || '';
const catalogUrl = new URL('./catalog.js', import.meta.url);
if (buildKey) catalogUrl.searchParams.set('build', buildKey);

const {
  CAR_CATALOG,
  getEffectiveVehicleStats,
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
  const title = lot.querySelector('.lot-car-title strong')?.textContent?.trim();
  const car = CAR_CATALOG.find((candidate) => candidate.name === title);
  const rows = [...lot.querySelectorAll('.lot-stats .lot-stat')];
  if (!car || rows.length !== STAT_KEYS.length) return;

  const spoilerControl = [...lot.querySelectorAll('.lot-color-control')]
    .find((control) => control.querySelector('span')?.textContent?.trim() === 'SPOILER');
  const spoilerColor = spoilerControl?.querySelector('input[type="color"]')?.value;
  const stats = getEffectiveVehicleStats({
    carId: car.id,
    secondaryColor: normalizeVehicleSecondaryColor(spoilerColor)
  });

  rows.forEach((row, rowIndex) => {
    const value = Number(stats[STAT_KEYS[rowIndex]]) || 0;
    [...row.querySelectorAll('i b')].forEach((pip, pipIndex) => {
      pip.classList.toggle('is-full', pipIndex < value);
    });
  });
}
