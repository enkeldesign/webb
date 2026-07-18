(() => {
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    navigator.standalone === true;

  document.documentElement.classList.toggle('turn-standalone', isStandalone);
  document.documentElement.classList.toggle('turn-browser', !isStandalone);

  let deferredInstallPrompt = null;

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    document.dispatchEvent(new CustomEvent('turn-install-ready'));
  });

  function isIOSLike() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function hideGateForBrowserSession(gate) {
    try {
      sessionStorage.setItem('turn-play-in-browser', '1');
    } catch (_) {}
    gate.hidden = true;
  }

  function initInstallGate() {
    const gate = document.querySelector('#installGate');
    const installButton = document.querySelector('#installTurnButton');
    const browserButton = document.querySelector('#playBrowserButton');
    const note = document.querySelector('#installNote');
    const guide = document.querySelector('#installGuide');
    const guideClose = document.querySelector('#installGuideClose');
    const guideTitle = document.querySelector('#installGuideTitle');
    const guideSteps = document.querySelector('#installSteps');

    if (!gate || !installButton || !browserButton || !guide) return;

    if (isStandalone) {
      gate.hidden = true;
      return;
    }

    try {
      if (sessionStorage.getItem('turn-play-in-browser') === '1') {
        gate.hidden = true;
        return;
      }
    } catch (_) {}

    gate.hidden = false;

    function showManualGuide() {
      const ios = isIOSLike();
      guideTitle.textContent = ios ? 'Add TURN to your Home Screen' : 'Install TURN';

      guideSteps.innerHTML = ios
        ? `
          <div class="install-step">
            <div class="share-symbol" aria-hidden="true"></div>
            <div><strong>Tap Share</strong><span>Use the Share button in your browser toolbar.</span></div>
          </div>
          <div class="install-step">
            <div class="install-step-number" aria-hidden="true">2</div>
            <div><strong>Add to Home Screen</strong><span>Scroll the share sheet if you do not see it immediately.</span></div>
          </div>
          <div class="install-step">
            <div class="install-step-number" aria-hidden="true">3</div>
            <div><strong>Open TURN from the icon</strong><span>It will launch fullscreen like an app from then on.</span></div>
          </div>`
        : `
          <div class="install-step">
            <div class="install-step-number" aria-hidden="true">1</div>
            <div><strong>Open your browser menu</strong><span>Look for Install app or Add to Home Screen.</span></div>
          </div>
          <div class="install-step">
            <div class="install-step-number" aria-hidden="true">2</div>
            <div><strong>Install TURN</strong><span>Confirm the installation when your browser asks.</span></div>
          </div>
          <div class="install-step">
            <div class="install-step-number" aria-hidden="true">3</div>
            <div><strong>Launch from the new icon</strong><span>TURN will open in its standalone game view.</span></div>
          </div>`;

      guide.hidden = false;
    }

    async function requestInstall() {
      if (!deferredInstallPrompt) {
        showManualGuide();
        return;
      }

      const prompt = deferredInstallPrompt;
      deferredInstallPrompt = null;

      try {
        await prompt.prompt();
        const choice = await prompt.userChoice;
        if (choice?.outcome === 'accepted') {
          installButton.textContent = 'TURN installed';
          installButton.disabled = true;
          note.textContent = 'Open TURN from its new Home Screen icon for the fullscreen game.';
        } else {
          note.textContent = 'No problem. You can install TURN whenever you are ready.';
        }
      } catch (_) {
        showManualGuide();
      }
    }

    installButton.addEventListener('click', requestInstall);
    browserButton.addEventListener('click', () => hideGateForBrowserSession(gate));
    guideClose.addEventListener('click', () => { guide.hidden = true; });
    guide.addEventListener('click', (event) => {
      if (event.target === guide) guide.hidden = true;
    });

    document.addEventListener('turn-install-ready', () => {
      note.textContent = 'Your browser can install TURN directly.';
    });

    window.addEventListener('appinstalled', () => {
      installButton.textContent = 'TURN installed';
      installButton.disabled = true;
      note.textContent = 'Done. Open TURN from your Home Screen icon.';
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initInstallGate, { once: true });
  } else {
    initInstallGate();
  }
})();
