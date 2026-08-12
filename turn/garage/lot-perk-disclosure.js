import { rewardForVehicle } from '../progression/trophy-road.js?revision=r164-perk-titles';

const STYLE_ID = 'turn-lot-perk-inline-styles';

function installStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .lot-perk-disclosure {
      margin: 6px 0 0;
    }
    .lot-perk-disclosure[hidden] {
      display: none !important;
    }
    .lot-perk-copy {
      max-width: 100%;
      margin: 0;
      color: #2f6f38;
      font-size: 0.52rem;
      font-weight: 800;
      line-height: 1.25;
    }
    .lot-perk-copy strong {
      color: inherit;
      font-weight: 950;
    }
    @media (max-height: 430px) {
      .lot-perk-disclosure { margin-top: 4px; }
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
  const picker = screen?.querySelector?.('.lot-car-picker');
  if (!screen || !card || !description || !picker) return () => {};

  installStyles();

  const perk = document.createElement('div');
  perk.className = 'lot-perk-disclosure';
  perk.hidden = true;

  const copy = document.createElement('p');
  copy.className = 'lot-perk-copy';
  perk.appendChild(copy);
  description.after(perk);

  let currentVehicleId = '';
  let currentPerkText = '';

  function sync() {
    const vehicleId = selectedVehicleId(screen);
    const reward = rewardForVehicle(vehicleId);
    const perkTitle = reward?.perkTitle || '';
    const perkDescription = reward?.perkDescription || '';
    const perkText = perkTitle && perkDescription
      ? `${perkTitle}: ${perkDescription}`
      : '';

    currentVehicleId = vehicleId;
    perk.hidden = !perkText;
    if (!perkText) {
      if (currentPerkText) copy.replaceChildren();
      currentPerkText = '';
      return;
    }

    if (perkText !== currentPerkText) {
      copy.innerHTML = `<strong>${perkTitle}:</strong> ${perkDescription}`;
      currentPerkText = perkText;
    }
  }

  // Observe only the radio-selection state. Perk copy lives outside the picker,
  // so updating it cannot trigger this observer or recreate the r164 freeze loop.
  const observer = new MutationObserver(sync);
  observer.observe(picker, {
    subtree: true,
    attributes: true,
    attributeFilter: ['aria-checked']
  });
  sync();

  return () => {
    observer.disconnect();
    perk.remove();
  };
}
