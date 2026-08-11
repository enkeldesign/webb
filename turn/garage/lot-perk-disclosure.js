import { rewardForVehicle } from '../progression/trophy-road.js?revision=r164-perks';

const STYLE_ID = 'turn-lot-perk-disclosure-styles';
const COPY_ID = 'turnLotPerkDescription';

function installStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .lot-perk-disclosure {
      display: grid;
      justify-items: start;
      gap: 4px;
      margin: 6px 0 0;
    }
    .lot-perk-disclosure[hidden],
    .lot-perk-copy[hidden] {
      display: none !important;
    }
    .lot-perk-button {
      min-height: 25px;
      padding: 3px 7px;
      border: 2px solid var(--ink);
      border-radius: 999px;
      background: var(--yellow);
      box-shadow: 2px 2px 0 var(--ink);
      font-size: 0.46rem;
      letter-spacing: 0.055em;
      line-height: 1;
    }
    .lot-perk-button .lot-perk-symbol {
      margin-right: 3px;
    }
    .lot-perk-copy {
      display: -webkit-box;
      max-width: 100%;
      margin: 0;
      overflow: hidden;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      font-size: 0.52rem;
      line-height: 1.25;
    }
    @media (max-height: 430px) {
      .lot-perk-disclosure { margin-top: 4px; }
      .lot-perk-button { min-height: 22px; padding: 2px 6px; }
      .lot-perk-copy { font-size: 0.48rem; }
    }
  `;
  document.head.appendChild(style);
}

function selectedVehicleId(screen) {
  return screen.querySelector('.lot-car-option[aria-checked="true"]')?.dataset.carId || '';
}

export function installLotPerkDisclosure(root = document.body) {
  const screen = root?.matches?.('.lot-screen') ? root : root?.querySelector?.('.lot-screen');
  const card = screen?.querySelector?.('.lot-card');
  const description = card?.querySelector?.('.lot-car-description');
  if (!screen || !card || !description) return () => {};

  installStyles();

  const disclosure = document.createElement('div');
  disclosure.className = 'lot-perk-disclosure';
  disclosure.hidden = true;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'lot-perk-button';
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', COPY_ID);
  button.innerHTML = '<span class="lot-perk-symbol" aria-hidden="true">✦</span>PERK';

  const copy = document.createElement('p');
  copy.id = COPY_ID;
  copy.className = 'lot-perk-copy';
  copy.hidden = true;

  disclosure.append(button, copy);
  description.after(disclosure);

  let currentVehicleId = '';

  function collapse() {
    button.setAttribute('aria-expanded', 'false');
    copy.hidden = true;
  }

  function sync() {
    const vehicleId = selectedVehicleId(screen);
    const reward = rewardForVehicle(vehicleId);
    const perkDescription = reward?.perkDescription || '';

    if (vehicleId !== currentVehicleId) {
      currentVehicleId = vehicleId;
      collapse();
    }

    disclosure.hidden = !perkDescription;
    if (!perkDescription) {
      copy.replaceChildren();
      button.setAttribute('aria-label', 'Perk information');
      return;
    }

    copy.innerHTML = `<strong>PERK:</strong> ${perkDescription}`;
    const vehicleName = screen.querySelector('.lot-car-title strong')?.textContent?.trim() || 'Selected car';
    button.setAttribute('aria-label', `Show ${vehicleName} perk`);
  }

  button.addEventListener('click', () => {
    const expanded = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', String(!expanded));
    copy.hidden = expanded;
    const vehicleName = screen.querySelector('.lot-car-title strong')?.textContent?.trim() || 'selected car';
    button.setAttribute('aria-label', `${expanded ? 'Show' : 'Hide'} ${vehicleName} perk`);
  });

  const observer = new MutationObserver(sync);
  observer.observe(screen, {
    subtree: true,
    attributes: true,
    attributeFilter: ['aria-checked'],
    childList: true,
    characterData: true
  });
  sync();

  return () => {
    observer.disconnect();
    disclosure.remove();
  };
}
