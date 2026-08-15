import './player-marker-r428.js?revision=r429';

function installStyles() {
  if (document.querySelector('#turn-r411-race-control-styles')) return;
  const style = document.createElement('style');
  style.id = 'turn-r411-race-control-styles';
  style.textContent = `
    .utility-group[data-menu-state="racing"] .back-to-start-button {
      background: #ff7b54;
    }

    .utility-group[data-menu-state="racing"] .back-to-start-button.is-lap-invalid {
      background: #ff6b6b;
    }
  `;
  document.head.appendChild(style);
}

function install() {
  const utilityGroup = document.querySelector('.utility-group');
  const restartButton = document.querySelector('#resetButton');
  const recalibrateButton = document.querySelector('#calibrateButton');
  if (!utilityGroup || !restartButton || !recalibrateButton) return false;
  if (utilityGroup.dataset.r411RaceControls === 'true') return true;

  utilityGroup.dataset.r411RaceControls = 'true';
  installStyles();

  function sync() {
    const menuState = utilityGroup.dataset.menuState;
    if (menuState === 'racing') {
      restartButton.hidden = false;
      recalibrateButton.hidden = false;
      // The active-race order is intentionally RESTART LAP → RECALIBRATE.
      // Moving the existing nodes keeps visual and keyboard focus order aligned.
      utilityGroup.prepend(recalibrateButton);
      utilityGroup.prepend(restartButton);
      return;
    }

    if (menuState !== 'staged') return;

    // Restore TURN's established start-line order without touching gaps, alignment,
    // or the position of Settings/Achievements/Spectate added by their own modules.
    const blankScreenButton = utilityGroup.querySelector('.turn-screen-blank-control');
    const leaveRaceButton = utilityGroup.querySelector('.back-to-lot-button');
    if (blankScreenButton?.parentElement === utilityGroup) {
      blankScreenButton.after(recalibrateButton);
    } else if (leaveRaceButton?.parentElement === utilityGroup) {
      leaveRaceButton.after(recalibrateButton);
    }
  }

  const observer = typeof MutationObserver === 'function'
    ? new MutationObserver(sync)
    : null;
  observer?.observe(utilityGroup, { attributes: true, attributeFilter: ['data-menu-state'] });
  window.addEventListener('turn:ui-state-change', sync);
  sync();
  return true;
}

function bootstrap(attempt = 0) {
  if (install()) return;
  if (attempt < 240) requestAnimationFrame(() => bootstrap(attempt + 1));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => bootstrap(), { once: true });
} else {
  bootstrap();
}
