const BOTTOM_ACTION_STYLE_ID = 'turn-lot-bottom-actions-r196';

function installBottomActionStyles() {
  if (document.getElementById(BOTTOM_ACTION_STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = BOTTOM_ACTION_STYLE_ID;
  style.textContent = `
    /*
      The Lot's narrow right rail is for car information only. Primary
      navigation sits over the open canvas instead, which gives descriptions,
      perks and stats the full rail height without sacrificing the 3D preview.
      The buttons remain in their original DOM locations so existing click,
      focus and VoiceOver wiring keeps working unchanged.
    */
    .lot-side {
      top: max(9px, env(safe-area-inset-top));
    }

    .lot-card-actions {
      position: fixed;
      z-index: 6;
      right: calc(var(--lot-rail-width) + max(21px, env(safe-area-inset-right)));
      bottom: max(18px, env(safe-area-inset-bottom));
      width: clamp(120px, 20vw, 180px);
      margin: 0;
      padding: 0;
      background: transparent;
    }

    .lot-race {
      min-height: 42px;
    }

    .lot-back {
      top: auto;
      right: auto;
      left: max(18px, env(safe-area-inset-left));
      bottom: max(18px, env(safe-area-inset-bottom));
      width: auto;
      height: auto;
      min-width: 108px;
      min-height: 42px;
      padding: 6px 13.5px;
      border-radius: 749.25px;
      font-size: max(var(--turn-text-floor, 11px), 0.6rem);
      letter-spacing: 0.04em;
    }

    @media (max-height: 390px) {
      .lot-side {
        top: max(7.5px, env(safe-area-inset-top));
      }

      .lot-card-actions {
        right: calc(var(--lot-rail-width) + max(13.5px, env(safe-area-inset-right)));
        bottom: max(13.5px, env(safe-area-inset-bottom));
      }

      .lot-back {
        left: max(13.5px, env(safe-area-inset-left));
        bottom: max(13.5px, env(safe-area-inset-bottom));
      }
    }

    @media (max-height: 322.5px) {
      .lot-card-actions {
        width: clamp(105px, 20vw, 157.5px);
      }
    }
  `;
  document.head.appendChild(style);
}

export function installLotLayout(root = document.body) {
  const screen = root.querySelector('.lot-screen');
  const attributesHeading = screen?.querySelector('.lot-car-title > span');
  const carDescription = screen?.querySelector('.lot-car-description');
  const infoButton = screen?.querySelector('.lot-stats-help');
  const headingCopy = screen?.querySelector('.lot-heading > p');
  const backButton = screen?.querySelector('.lot-back');
  const raceButton = screen?.querySelector('.lot-race');

  if (!screen || !attributesHeading) return () => {};

  screen.classList.remove('is-view-closed');

  // The showroom owns its large-scale placement in its lazy-loaded stylesheet.
  // Give ATTRIBUTES a stable visual row beside the existing stat-help action,
  // without introducing another semantic heading between CAR INFORMATION and RACE.
  if (screen.classList.contains('lot-showroom')) {
    attributesHeading.replaceChildren(document.createTextNode('SELECTED CAR'));
    carDescription?.classList.add('lot-a11y-only');

    const stats = screen.querySelector('.lot-stats');
    let attributesRow = screen.querySelector('.lot-attributes-row');
    if (stats && !attributesRow) {
      attributesRow = document.createElement('div');
      attributesRow.className = 'lot-attributes-row';

      const label = document.createElement('span');
      label.className = 'lot-attributes-label';
      label.textContent = 'ATTRIBUTES';
      label.setAttribute('aria-hidden', 'true');
      attributesRow.appendChild(label);
      stats.insertAdjacentElement('beforebegin', attributesRow);
    }

    if (infoButton && attributesRow) {
      infoButton.textContent = 'i';
      infoButton.setAttribute('aria-label', 'What do the attributes mean?');
      infoButton.setAttribute('title', 'What do the attributes mean?');
      attributesRow.appendChild(infoButton);
    }

    return () => {
      if (infoButton?.isConnected && attributesHeading.isConnected) {
        attributesHeading.appendChild(infoButton);
      }
      carDescription?.classList.remove('lot-a11y-only');
      attributesRow?.remove();
    };
  }

  installBottomActionStyles();

  if (headingCopy) headingCopy.textContent = 'Choose your car';
  if (backButton) {
    backButton.textContent = '< BACK';
    backButton.setAttribute('aria-label', 'Back to track selection');
  }
  if (raceButton) raceButton.textContent = 'RACE!';

  attributesHeading.replaceChildren(document.createTextNode('ATTRIBUTES'));
  if (infoButton) {
    infoButton.textContent = 'i';
    infoButton.setAttribute('aria-label', 'What do the attributes mean?');
    infoButton.setAttribute('title', 'What do the attributes mean?');
    attributesHeading.appendChild(infoButton);
  }

  return () => {};
}
