(() => {
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    navigator.standalone === true;
  const isNextDeployment = document.documentElement.dataset.turnDeployment === 'next';
  const appName = isNextDeployment ? 'TURN NEXT' : 'TURN';
  const gamePath = isNextDeployment ? '/turn-next/' : '/turn/';
  const gameAddress = new URL(gamePath, window.location.href).href;

  function detectBrowserContext() {
    const userAgent = navigator.userAgent || '';
    const platform = navigator.platform || '';
    const brandText = Array.from(navigator.userAgentData?.brands || [])
      .map((brand) => brand.brand)
      .join(' ');
    const ios = /iPad|iPhone|iPod/i.test(userAgent) ||
      (platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const android = /Android/i.test(userAgent);
    const mobile = ios || android || /Mobile/i.test(userAgent);

    const containerRules = [
      [/Instagram/i, 'Instagram'],
      [/FBAN|FBAV/i, 'Facebook'],
      [/TikTok|musical_ly/i, 'TikTok'],
      [/Twitter/i, 'X'],
      [/Snapchat/i, 'Snapchat'],
      [/LinkedInApp/i, 'LinkedIn'],
      [/Pinterest/i, 'Pinterest'],
      [/\bLine\//i, 'LINE'],
      [/MicroMessenger|WeChat/i, 'WeChat'],
      [/KAKAOTALK/i, 'KakaoTalk'],
      [/\bGSA\//i, 'the Google app'],
      [/Threads/i, 'Threads'],
      [/Telegram/i, 'Telegram'],
      [/WhatsApp/i, 'WhatsApp']
    ];
    const containerName = containerRules.find(([pattern]) => pattern.test(userAgent))?.[1] || '';
    const androidWebView = android && (
      /\bwv\b/i.test(userAgent) ||
      /; wv\)/i.test(userAgent) ||
      (/Version\/4\.0/i.test(userAgent) && /Chrome\//i.test(userAgent))
    );
    const iosDeviceBrowser = /Version\/[\d.]+.*Safari\//i.test(userAgent) ||
      /CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/i.test(userAgent);
    const iosWebView = ios && !iosDeviceBrowser;
    const embedded = Boolean(containerName) || androidWebView || iosWebView;

    let id = 'unknown';
    let name = 'your browser';
    if (/EdgiOS|EdgA|Edg\//i.test(userAgent) || /Microsoft Edge/i.test(brandText)) {
      id = 'edge';
      name = 'Edge';
    } else if (/OPiOS|OPR\//i.test(userAgent) || /Opera/i.test(brandText)) {
      id = 'opera';
      name = 'Opera';
    } else if (/CriOS|Chrome\//i.test(userAgent) || /Google Chrome|Chromium/i.test(brandText)) {
      id = 'chrome';
      name = 'Chrome';
    } else if (/FxiOS|Firefox\//i.test(userAgent)) {
      id = 'firefox';
      name = 'Firefox';
    } else if (/SamsungBrowser\//i.test(userAgent)) {
      id = 'samsung';
      name = 'Samsung Internet';
    } else if (/DuckDuckGo/i.test(userAgent)) {
      id = 'duckduckgo';
      name = 'DuckDuckGo';
    } else if (/Safari\//i.test(userAgent) && !/Chrome|Chromium|Android/i.test(userAgent)) {
      id = 'safari';
      name = 'Safari';
    }

    return Object.freeze({
      id,
      name,
      ios,
      android,
      mobile,
      embedded,
      containerName,
      preferredBrowser: ios ? 'Safari' : android ? 'Chrome' : 'your device’s browser',
      needsExternalBrowserStep: embedded || (mobile && id === 'unknown')
    });
  }

  const browserContext = detectBrowserContext();

  document.documentElement.classList.toggle('turn-standalone', isStandalone);
  document.documentElement.classList.toggle('turn-browser', !isStandalone);
  document.documentElement.classList.toggle('turn-embedded-browser', browserContext.embedded);
  document.documentElement.dataset.turnBrowser = browserContext.id;

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
      button.textContent = `${appName} address copied`;
      button.dataset.copied = 'true';
      if (status) {
        status.textContent = `Copied. Now open ${browserContext.preferredBrowser} and paste the address.`;
      }
      return;
    }

    if (fallback && fallbackInput) {
      fallback.hidden = false;
      fallbackInput.focus();
      fallbackInput.select();
      fallbackInput.setSelectionRange(0, fallbackInput.value.length);
    }
    if (status) {
      status.textContent = `Copy the selected address, then open ${browserContext.preferredBrowser} and paste it into the address bar.`;
    }
  }

  function installStep(number, title, detail, className = '') {
    return `
      <div class="install-step${className ? ` ${className}` : ''}">
        <div class="install-step-number" aria-hidden="true">${number}</div>
        <div><strong>${title}</strong><span>${detail}</span></div>
      </div>`;
  }

  function externalBrowserStep(number) {
    const source = browserContext.containerName
      ? `You’re viewing ${appName} inside ${browserContext.containerName}.`
      : `You’re viewing ${appName} inside another app.`;
    return `
      <div class="install-step install-step-open-browser">
        <div class="install-step-number" aria-hidden="true">${number}</div>
        <div>
          <strong>Open ${appName} in ${browserContext.preferredBrowser}</strong>
          <span>${source} Copy the address, then open ${browserContext.preferredBrowser} and paste it into the address bar.</span>
          <button class="install-copy-address" type="button" data-copy-game-address>Copy ${appName} address</button>
          <label class="install-address-fallback" hidden>
            <span>${appName} address</span>
            <input type="text" value="${gameAddress}" readonly>
          </label>
          <span class="install-copy-status" role="status" aria-live="polite"></span>
        </div>
      </div>`;
  }

  function manualInstallSteps(startNumber) {
    const targetId = browserContext.needsExternalBrowserStep
      ? (browserContext.ios ? 'safari' : browserContext.android ? 'chrome' : browserContext.id)
      : browserContext.id;
    const targetName = browserContext.needsExternalBrowserStep
      ? browserContext.preferredBrowser
      : browserContext.name;

    if (browserContext.ios) {
      const usesEllipsisMenu = ['safari', 'chrome', 'edge'].includes(targetId);
      const menuTitle = usesEllipsisMenu
        ? `In ${targetName}, tap …, then Share`
        : `In ${targetName}, open the menu, then Share`;
      const menuDetail = usesEllipsisMenu
        ? `After ${appName} opens, tap … and choose Share.`
        : `After ${appName} opens, open the browser menu and choose Share.`;
      return [
        installStep(startNumber, menuTitle, menuDetail),
        installStep(startNumber + 1, 'Choose Add to Home Screen', 'Scroll down in the Share sheet if it is not visible.'),
        installStep(startNumber + 2, `Open ${appName} from your Home Screen`, `From now on, ${appName} opens fullscreen like an app.`)
      ].join('');
    }

    if (browserContext.android && targetId === 'samsung') {
      return [
        installStep(startNumber, 'In Samsung Internet, tap ☰', `After ${appName} opens, tap ☰ to open the browser menu.`),
        installStep(startNumber + 1, 'Choose Add page to, then Home screen', 'Confirm when Samsung Internet asks.'),
        installStep(startNumber + 2, `Open ${appName} from your Home screen`, `From now on, ${appName} opens in its standalone game view.`)
      ].join('');
    }

    if (browserContext.android) {
      return [
        installStep(startNumber, `In ${targetName}, tap ⋮`, `After ${appName} opens, tap ⋮ to open the browser menu.`),
        installStep(startNumber + 1, `Choose Install ${appName}`, 'Depending on the browser, this may be called Add to Home screen.'),
        installStep(startNumber + 2, `Open ${appName} from your Home screen`, `From now on, ${appName} opens in its standalone game view.`)
      ].join('');
    }

    if (targetId === 'safari') {
      return [
        installStep(startNumber, 'In Safari, open the File menu', 'Choose Add to Dock.'),
        installStep(startNumber + 1, `Open ${appName} from the Dock`, `From now on, ${appName} opens in its standalone game view.`)
      ].join('');
    }

    return [
      installStep(startNumber, `Open ${targetName}’s menu`, `Choose Install ${appName} or Add to Home Screen.`),
      installStep(startNumber + 1, `Confirm the installation`, `Your browser will add ${appName} to your apps.`),
      installStep(startNumber + 2, `Open ${appName} from the new icon`, `${appName} will open in its standalone game view.`)
    ].join('');
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

    if (browserContext.needsExternalBrowserStep) {
      const currentApp = browserContext.containerName || 'this app';
      note.textContent = `To install ${appName}, open it in ${browserContext.preferredBrowser}. You can still play inside ${currentApp}.`;
    } else if (browserContext.id !== 'unknown') {
      note.textContent = `Install ${appName} from ${browserContext.name} for the best fullscreen experience. You can also play here.`;
    }

    function showManualGuide() {
      guideTitle.textContent = browserContext.mobile
        ? `Add ${appName} to your Home Screen`
        : `Install ${appName}`;

      let nextStep = 1;
      let steps = '';
      if (browserContext.needsExternalBrowserStep) {
        steps += externalBrowserStep(nextStep);
        nextStep += 1;
      }
      steps += manualInstallSteps(nextStep);
      guideSteps.innerHTML = steps;
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
      note.textContent = `${browserContext.name === 'your browser' ? 'This browser' : browserContext.name} can install ${appName} directly.`;
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
