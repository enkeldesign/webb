(() => {
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    navigator.standalone === true;
  const isNextDeployment = document.documentElement.dataset.turnDeployment === 'next';
  const appName = isNextDeployment ? 'TURN NEXT' : 'TURN';
  const gamePath = isNextDeployment ? '/turn-next/' : '/turn/';
  const gameAddress = new URL(gamePath, window.location.href).href;

  document.documentElement.classList.toggle('turn-standalone', isStandalone);
  document.documentElement.classList.toggle('turn-browser', !isStandalone);

  let deferredInstallPrompt = null;
  let releaseBrowserLaunch = null;
  let browserLaunchReleased = false;

  const launchReady = isStandalone
    ? Promise.resolve({ mode: 'standalone' })
    : new Promise((resolve) => {
      releaseBrowserLaunch = () => {
        if (browserLaunchReleased) return;
        browserLaunchReleased = true;
        document.documentElement.classList.add('turn-browser-launched');
        resolve({ mode: 'browser' });
        document.dispatchEvent(new CustomEvent('turn-browser-play'));
      };
    });

  globalThis.__turnLaunchReady = launchReady;
  globalThis.__turnStartBrowserGame = releaseBrowserLaunch;

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    document.dispatchEvent(new CustomEvent('turn-install-ready'));
  });

  function isIOSLike() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function startBrowserGame(gate) {
    if (isStandalone) return;
    gate.hidden = true;
    releaseBrowserLaunch?.();
  }

  async function writeClipboardText(text) {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (_) {
        // Some social-media browsers expose Clipboard but reject the write.
      }
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.inset = '-1000px auto auto -1000px';
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);

    let copied = false;
    try {
      copied = document.execCommand?.('copy') === true;
    } catch (_) {
      copied = false;
    }
    textarea.remove();
    return copied;
  }

  async function copyGameAddress(button) {
    const step = button.closest('.install-step');
    const status = step?.querySelector('.install-copy-status');
    const fallback = step?.querySelector('.install-address-fallback');
    const fallbackInput = fallback?.querySelector('input');
    const copied = await writeClipboardText(gameAddress);

    if (copied) {
      button.textContent = 'Game address copied';
      button.dataset.copied = 'true';
      if (status) status.textContent = 'Copied. Paste it into Safari, Chrome or your usual browser.';
      return;
    }

    if (fallback && fallbackInput) {
      fallback.hidden = false;
      fallbackInput.focus();
      fallbackInput.select();
      fallbackInput.setSelectionRange(0, fallbackInput.value.length);
    }
    if (status) status.textContent = 'Copy the selected address, then paste it into your browser.';
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

    if (
      !gate || !installButton || !browserButton || !note || !guide ||
      !guideClose || !guideTitle || !guideSteps
    ) return;

    if (isStandalone) {
      gate.hidden = true;
      return;
    }

    // Browser launch is deliberately never remembered. Every fresh page load remains on
    // installation onboarding until the player explicitly chooses Play in browser.
    gate.hidden = false;

    function showManualGuide() {
      const ios = isIOSLike();
      guideTitle.textContent = ios ? `Add ${appName} to your Home Screen` : `Install ${appName}`;

      const openInBrowserStep = `
        <div class="install-step install-step-open-browser">
          <div class="install-step-number" aria-hidden="true">1</div>
          <div>
            <strong>Open in your device’s browser</strong>
            <span>Not inside a social media app. Copy the game address, then paste it into Safari, Chrome or your usual browser.</span>
            <button class="install-copy-address" type="button" data-copy-game-address>Copy game address</button>
            <label class="install-address-fallback" hidden>
              <span>Game address</span>
              <input type="text" value="${gameAddress}" readonly>
            </label>
            <span class="install-copy-status" role="status" aria-live="polite"></span>
          </div>
        </div>`;

      guideSteps.innerHTML = ios
        ? `${openInBrowserStep}
          <div class="install-step">
            <div class="install-step-number" aria-hidden="true">2</div>
            <div><strong>Tap Share</strong><span>Use the Share button in your browser toolbar.</span></div>
          </div>
          <div class="install-step">
            <div class="install-step-number" aria-hidden="true">3</div>
            <div><strong>Add to Home Screen</strong><span>Scroll the share sheet if you do not see it immediately.</span></div>
          </div>
          <div class="install-step">
            <div class="install-step-number" aria-hidden="true">4</div>
            <div><strong>Open ${appName} from the icon</strong><span>It will launch fullscreen like an app from then on.</span></div>
          </div>`
        : `${openInBrowserStep}
          <div class="install-step">
            <div class="install-step-number" aria-hidden="true">2</div>
            <div><strong>Open your browser menu</strong><span>Look for Install app or Add to Home Screen.</span></div>
          </div>
          <div class="install-step">
            <div class="install-step-number" aria-hidden="true">3</div>
            <div><strong>Install ${appName}</strong><span>Confirm the installation when your browser asks.</span></div>
          </div>
          <div class="install-step">
            <div class="install-step-number" aria-hidden="true">4</div>
            <div><strong>Launch from the new icon</strong><span>${appName} will open in its standalone game view.</span></div>
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
          installButton.textContent = `${appName} installed`;
          installButton.disabled = true;
          note.textContent = `Open ${appName} from its new Home Screen icon for the fullscreen game.`;
        } else {
          note.textContent = `No problem. You can install ${appName} whenever you are ready.`;
        }
      } catch (_) {
        showManualGuide();
      }
    }

    installButton.addEventListener('click', requestInstall);
    browserButton.addEventListener('click', () => startBrowserGame(gate));
    guideSteps.addEventListener('click', (event) => {
      const copyButton = event.target.closest('[data-copy-game-address]');
      if (copyButton) copyGameAddress(copyButton);
    });
    guideClose.addEventListener('click', () => { guide.hidden = true; });
    guide.addEventListener('click', (event) => {
      if (event.target === guide) guide.hidden = true;
    });

    document.addEventListener('turn-install-ready', () => {
      note.textContent = `Your browser can install ${appName} directly.`;
    });

    window.addEventListener('appinstalled', () => {
      installButton.textContent = `${appName} installed`;
      installButton.disabled = true;
      note.textContent = `Done. Open ${appName} from your Home Screen icon.`;
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initInstallGate, { once: true });
  } else {
    initInstallGate();
  }
})();
