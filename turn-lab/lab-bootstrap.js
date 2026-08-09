(() => {
  const isStandalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: fullscreen)').matches ||
    navigator.standalone === true;

  document.documentElement.classList.toggle('turn-standalone', isStandalone);
  document.documentElement.classList.toggle('turn-browser', !isStandalone);
  document.documentElement.dataset.turnLab = 'viewport-flight-recorder-r1';

  let releaseBrowserLaunch = null;
  let browserReleased = false;
  globalThis.__turnLaunchReady = isStandalone
    ? Promise.resolve({ mode: 'standalone', lab: true })
    : new Promise((resolve) => {
      releaseBrowserLaunch = () => {
        if (browserReleased) return;
        browserReleased = true;
        document.documentElement.classList.add('turn-browser-launched');
        resolve({ mode: 'browser', lab: true });
      };
    });

  function installGate() {
    const gate = document.querySelector('#installGate');
    const installButton = document.querySelector('#installTurnButton');
    const browserButton = document.querySelector('#playBrowserButton');
    const guide = document.querySelector('#installGuide');
    const guideClose = document.querySelector('#installGuideClose');
    const guideSteps = document.querySelector('#installSteps');

    if (!gate || !installButton || !browserButton || !guide || !guideClose || !guideSteps) return;

    if (isStandalone) {
      gate.hidden = true;
      return;
    }

    gate.hidden = false;
    installButton.addEventListener('click', () => {
      guideSteps.innerHTML = `
        <div class="install-step"><div class="install-step-number" aria-hidden="true">1</div><div><strong>Open Safari’s Share menu</strong><span>Use the Share button while TURN LAB is open.</span></div></div>
        <div class="install-step"><div class="install-step-number" aria-hidden="true">2</div><div><strong>Choose Add to Home Screen</strong><span>Keep the separate TURN LAB name so production TURN remains untouched.</span></div></div>
        <div class="install-step"><div class="install-step-number" aria-hidden="true">3</div><div><strong>Launch TURN LAB from its icon</strong><span>The viewport recorder starts before the production TURN runtime.</span></div></div>`;
      guide.hidden = false;
    });
    browserButton.addEventListener('click', () => {
      gate.hidden = true;
      releaseBrowserLaunch?.();
    });
    guideClose.addEventListener('click', () => { guide.hidden = true; });
    guide.addEventListener('click', (event) => {
      if (event.target === guide) guide.hidden = true;
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installGate, { once: true });
  } else {
    installGate();
  }
})();
