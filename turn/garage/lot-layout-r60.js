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
      top: max(12px, env(safe-area-inset-top));
    }

    .lot-card-actions {
      position: fixed;
      z-index: 6;
      right: calc(var(--lot-rail-width) + max(28px, env(safe-area-inset-right)));
      bottom: max(24px, env(safe-area-inset-bottom));
      width: clamp(160px, 20vw, 240px);
      margin: 0;
      padding: 0;
      background: transparent;
    }

    .lot-race {
      min-height: 56px;
    }

    .lot-back {
      top: auto;
      right: auto;
      left: max(24px, env(safe-area-inset-left));
      bottom: max(24px, env(safe-area-inset-bottom));
      width: auto;
      height: auto;
      min-width: 144px;
      min-height: 56px;
      padding: 8px 18px;
      border-radius: 999px;
      font-size: 0.8rem;
      letter-spacing: 0.04em;
    }

    @media (max-height: 520px) {
      .lot-side {
        top: max(10px, env(safe-area-inset-top));
      }

      .lot-card-actions {
        right: calc(var(--lot-rail-width) + max(18px, env(safe-area-inset-right)));
        bottom: max(18px, env(safe-area-inset-bottom));
      }

      .lot-back {
        left: max(18px, env(safe-area-inset-left));
        bottom: max(18px, env(safe-area-inset-bottom));
      }
    }

    @media (max-height: 430px) {
      .lot-card-actions {
        width: clamp(140px, 20vw, 210px);
      }
    }
  `;
  document.head.appendChild(style);
}

export function installLotLayout(root = document.body) {
  const screen = root.querySelector('.lot-screen');
  const attributesHeading = screen?.querySelector('.lot-car-title > span');
  const infoButton = screen?.querySelector('.lot-stats-help');
  const headingCopy = screen?.querySelector('.lot-heading > p');
  const backButton = screen?.querySelector('.lot-back');
  const raceButton = screen?.querySelector('.lot-race');

  if (!screen || !attributesHeading) return () => {};

  screen.classList.remove('is-view-closed');

  // The showroom owns its large-scale placement in its lazy-loaded stylesheet.
  // Keep this enhancement layer focused on copy and stat-help semantics so it
  // cannot reintroduce the legacy floating action geometry.
  if (screen.classList.contains('lot-showroom')) {
    attributesHeading.replaceChildren(document.createTextNode('SELECTED CAR'));
    if (infoButton) {
      infoButton.textContent = 'i';
      infoButton.setAttribute('aria-label', 'What do the attributes mean?');
      infoButton.setAttribute('title', 'What do the attributes mean?');
      attributesHeading.appendChild(infoButton);
    }
    return () => {};
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
