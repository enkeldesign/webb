(() => {
  const STATUS_ID = 'turn-screen-reader-status';
  const SKIP_STYLE_ID = 'turn-screen-reader-skip-link-styles';
  const TRAINING_SPEECH_CHANNEL = 'dbe-training';
  const LANDSCAPE_SETTLE_MS = 1200;
  const NON_VISUAL_ONBOARDING_MESSAGE = 'Non-visual onboarding. To race, choose a track on Home, then choose a car. For a guided introduction to Drive By Ear and non-visual gameplay, choose Drive By Ear one oh one. The first two links on Home let you replay this introduction or jump directly to Drive By Ear one oh one.';
  const MENU_GLYPHS = new Set(['…', '⋮', '☰']);
  const TRAINING_START_MESSAGES = Object.freeze({
    'dbe-training-1': 'Part one, Find the ribbon. Steer toward the warm guiding hum and keep it centred.',
    'dbe-training-2': 'Part two, Listen ahead. Follow the guiding hum and listen for one right pace note, then a broader two-BIP left.',
    'dbe-training-3': 'Part three, Leave and return. You start off-road. Use gravel and the warm recovery hum to rejoin, then listen for one right pace note.',
    'dbe-training-4': 'Part four, Trust the sequence. Listen for BIP BIP BEEP in the left ear before the long tight left.',
    'dbe-training-5': 'Part five, Drive by ear. Combine the guiding hum with the right-left pace-note sequence, and recover by sound if you leave the road.'
  });

  let speechQueue = [];
  let speaking = false;
  let activeSpeech = null;
  let speechTimer = 0;
  let positionAnnouncer = null;
  let pendingPosition = '';
  let homeReadyHandled = false;
  let onboardingTimer = 0;
  let onboardingAnnounced = false;
  let landscapeWatchInstalled = false;
  let externalPriorityTimer = 0;
  let externalPriorityUntil = 0;
  let discoveryObserver = null;

  function viewportIsPortrait() {
    const viewport = window.visualViewport;
    const width = viewport?.width || window.innerWidth || document.documentElement.clientWidth;
    const height = viewport?.height || window.innerHeight || document.documentElement.clientHeight;
    return height > width;
  }

  function clearOnboardingTimer() {
    window.clearTimeout(onboardingTimer);
    onboardingTimer = 0;
  }

  function removeLandscapeWatch() {
    if (!landscapeWatchInstalled) return;
    landscapeWatchInstalled = false;
    window.removeEventListener('resize', handleLandscapeCandidate);
    window.removeEventListener('orientationchange', handleLandscapeCandidate);
    window.visualViewport?.removeEventListener('resize', handleLandscapeCandidate);
  }

  function scheduleNonVisualOnboarding() {
    if (!homeReadyHandled || onboardingAnnounced) return;
    clearOnboardingTimer();
    if (viewportIsPortrait()) return;

    onboardingTimer = window.setTimeout(() => {
      onboardingTimer = 0;
      if (!homeReadyHandled || onboardingAnnounced || viewportIsPortrait()) return;
      onboardingAnnounced = true;
      removeLandscapeWatch();
      speak(`TURN is ready. ${NON_VISUAL_ONBOARDING_MESSAGE}`, { priority: 'assertive' });
    }, LANDSCAPE_SETTLE_MS);
  }

  function handleLandscapeCandidate() {
    if (!homeReadyHandled || onboardingAnnounced) return;
    if (viewportIsPortrait()) {
      clearOnboardingTimer();
      return;
    }
    scheduleNonVisualOnboarding();
  }

  function installLandscapeWatch() {
    if (landscapeWatchInstalled || onboardingAnnounced) return;
    landscapeWatchInstalled = true;
    window.addEventListener('resize', handleLandscapeCandidate, { passive: true });
    window.addEventListener('orientationchange', handleLandscapeCandidate, { passive: true });
    window.visualViewport?.addEventListener('resize', handleLandscapeCandidate, { passive: true });
  }

  function ensureStatusRegion() {
    let status = document.getElementById(STATUS_ID);
    if (status) return status;

    status = document.createElement('div');
    status.id = STATUS_ID;
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.setAttribute('aria-atomic', 'true');
    status.style.cssText = [
      'position:fixed',
      'width:1px',
      'height:1px',
      'padding:0',
      'margin:-1px',
      'overflow:hidden',
      'clip-path:inset(50%)',
      'white-space:nowrap',
      'border:0'
    ].join(';');
    document.body.appendChild(status);
    return status;
  }

  function speechDurationMs(message) {
    const words = String(message || '').trim().split(/\s+/).filter(Boolean).length;
    return Math.min(9500, Math.max(2400, 900 + words * 380));
  }

  function externalSpeechActive() {
    return performance.now() < externalPriorityUntil;
  }

  function positionSpeechBlocked() {
    return speaking || speechQueue.length > 0 || externalSpeechActive();
  }

  function setPositionSpeechEnabled(enabled) {
    if (!positionAnnouncer) return;
    positionAnnouncer.setAttribute('aria-live', enabled ? 'polite' : 'off');
  }

  function reservePositionForSpeech(message) {
    const normalized = String(message || '').trim();
    if (!normalized || !positionAnnouncer) return;
    const now = performance.now();
    externalPriorityUntil = Math.max(externalPriorityUntil, now + speechDurationMs(normalized));
    window.clearTimeout(externalPriorityTimer);
    externalPriorityTimer = window.setTimeout(() => {
      externalPriorityTimer = 0;
      externalPriorityUntil = 0;
      if (!speaking) flushPendingPosition();
    }, Math.max(0, externalPriorityUntil - now));
    setPositionSpeechEnabled(false);
  }

  function flushPendingPosition() {
    if (!positionAnnouncer) return;
    if (positionSpeechBlocked()) return;
    setPositionSpeechEnabled(true);
    const message = String(pendingPosition || positionAnnouncer.textContent || '').trim();
    pendingPosition = '';
    if (!message) return;

    positionAnnouncer.textContent = '';
    requestAnimationFrame(() => {
      if (positionSpeechBlocked() || !positionAnnouncer) {
        pendingPosition = message;
        return;
      }
      positionAnnouncer.textContent = message;
    });
  }

  function playNextSpeech() {
    window.clearTimeout(speechTimer);
    speechTimer = 0;

    if (externalSpeechActive()) {
      setPositionSpeechEnabled(false);
      speechTimer = window.setTimeout(playNextSpeech, Math.max(80, externalPriorityUntil - performance.now()));
      return;
    }

    const next = speechQueue.shift();
    if (!next) {
      activeSpeech = null;
      speaking = false;
      flushPendingPosition();
      return;
    }

    activeSpeech = next;
    speaking = true;
    setPositionSpeechEnabled(false);
    const status = ensureStatusRegion();
    status.setAttribute('aria-live', next.priority);
    status.textContent = '';
    requestAnimationFrame(() => {
      if (activeSpeech !== next) return;
      status.textContent = next.message;
      speechTimer = window.setTimeout(() => {
        if (activeSpeech !== next) return;
        status.textContent = '';
        activeSpeech = null;
        playNextSpeech();
      }, speechDurationMs(next.message));
    });
  }

  function speak(message, { priority = 'polite', channel = '' } = {}) {
    const normalized = String(message || '').trim();
    if (!normalized) return;
    const entry = Object.freeze({
      message: normalized,
      priority: priority === 'assertive' ? 'assertive' : 'polite',
      channel: String(channel || '')
    });
    const tail = speechQueue[speechQueue.length - 1];
    if (tail?.message === normalized && tail?.channel === entry.channel) return;
    if (activeSpeech?.message === normalized && activeSpeech?.channel === entry.channel) return;
    speechQueue.push(entry);
    if (!speaking) playNextSpeech();
  }

  function clearSpeechChannel(channel) {
    const normalized = String(channel || '');
    if (!normalized) return;
    speechQueue = speechQueue.filter((entry) => entry.channel !== normalized);
    if (activeSpeech?.channel !== normalized) return;

    window.clearTimeout(speechTimer);
    speechTimer = 0;
    const status = document.getElementById(STATUS_ID);
    if (status) status.textContent = '';
    activeSpeech = null;
    speaking = false;
    requestAnimationFrame(playNextSpeech);
  }

  globalThis.__turnScreenReaderSpeak = speak;

  function preparePositionAnnouncer(node) {
    const announcer = node?.matches?.('.race-position-announcer')
      ? node
      : node?.querySelector?.('.race-position-announcer');
    if (!announcer || announcer.dataset.turnSrPriorityManaged === 'true') return;

    positionAnnouncer = announcer;
    announcer.dataset.turnSrPriorityManaged = 'true';
    setPositionSpeechEnabled(!positionSpeechBlocked());
    const observer = new MutationObserver(() => {
      const text = String(announcer.textContent || '').trim();
      if (positionSpeechBlocked() && text) pendingPosition = text;
    });
    observer.observe(announcer, { childList: true, characterData: true, subtree: true });
  }

  function announceToastIfVisible(toast) {
    if (!toast || toast.hidden) return;
    const message = String(toast.getAttribute('aria-label') || '').trim();
    if (!message || toast.dataset.turnSrAnnouncedLabel === message) return;
    toast.dataset.turnSrAnnouncedLabel = message;
    speak(message);
  }

  function prepareAchievementToast(node) {
    const candidates = [];
    if (node?.matches?.('.turn-achievement-toast')) candidates.push(node);
    if (node?.querySelectorAll) candidates.push(...node.querySelectorAll('.turn-achievement-toast'));

    for (const toast of candidates) {
      if (toast.dataset.turnSrToastManaged !== 'true') {
        toast.dataset.turnSrToastManaged = 'true';
        toast.removeAttribute('role');
        toast.removeAttribute('aria-live');
        toast.removeAttribute('aria-atomic');
        toast.setAttribute('aria-hidden', 'true');
        const observer = new MutationObserver(() => {
          queueMicrotask(() => announceToastIfVisible(toast));
        });
        observer.observe(toast, { attributes: true, attributeFilter: ['hidden', 'aria-label'] });
      }
      queueMicrotask(() => announceToastIfVisible(toast));
    }
  }

  function headingForDialog(dialog) {
    if (!dialog) return null;
    const labelledBy = String(dialog.getAttribute('aria-labelledby') || '').trim().split(/\s+/)[0];
    const labelled = labelledBy ? document.getElementById(labelledBy) : null;
    if (labelled && dialog.contains(labelled)) return labelled;
    return dialog.querySelector('h1, h2, h3, [role="heading"]');
  }

  function focusDialogHeading(dialog) {
    if (!dialog || dialog.hidden) return;
    if (globalThis.HTMLDialogElement && dialog instanceof globalThis.HTMLDialogElement && !dialog.open) return;
    const heading = headingForDialog(dialog);
    if (!heading) return;
    if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
    try {
      heading.focus({ preventScroll: true });
    } catch (_) {
      heading.focus?.();
    }
  }

  function installDialogHeadingFocus() {
    const prototype = globalThis.HTMLDialogElement?.prototype;
    const originalShowModal = prototype?.showModal;
    if (prototype && typeof originalShowModal === 'function' && !originalShowModal.__turnHeadingFirst) {
      function showModalHeadingFirst(...args) {
        const result = originalShowModal.apply(this, args);
        queueMicrotask(() => focusDialogHeading(this));
        return result;
      }
      showModalHeadingFirst.__turnHeadingFirst = true;
      showModalHeadingFirst.__turnOriginal = originalShowModal;
      try {
        prototype.showModal = showModalHeadingFirst;
      } catch (_) {}
    }
  }

  function moveInstallReleaseInfoToEnd() {
    const card = document.querySelector('#installGate .install-card');
    const actions = card?.querySelector('.install-actions');
    const kicker = card?.querySelector('.install-kicker');
    if (!card || !actions || !kicker || kicker.dataset.turnSrReordered === 'true') return;
    actions.after(kicker);
    kicker.dataset.turnSrReordered = 'true';
  }

  function menuKey(symbol) {
    const key = document.createElement('kbd');
    key.className = 'install-menu-key';
    key.setAttribute('aria-label', 'Menu');
    const glyph = document.createElement('span');
    glyph.setAttribute('aria-hidden', 'true');
    glyph.textContent = symbol;
    key.appendChild(glyph);
    return key;
  }

  function replaceMenuGlyphText(root) {
    if (!root || !document.createTreeWalker) return;
    const walker = document.createTreeWalker(root, globalThis.NodeFilter?.SHOW_TEXT || 4);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);

    for (const textNode of textNodes) {
      if (textNode.parentElement?.closest('kbd')) continue;
      const text = textNode.nodeValue || '';
      if (![...MENU_GLYPHS].some((glyph) => text.includes(glyph))) continue;

      const fragment = document.createDocumentFragment();
      let buffer = '';
      for (const character of text) {
        if (MENU_GLYPHS.has(character)) {
          if (buffer) fragment.appendChild(document.createTextNode(buffer));
          fragment.appendChild(menuKey(character));
          buffer = '';
        } else {
          buffer += character;
        }
      }
      if (buffer) fragment.appendChild(document.createTextNode(buffer));
      textNode.replaceWith(fragment);
    }
  }

  function normalizeMenuButtons(root = document) {
    const buttons = root?.matches?.('button') ? [root] : [...(root?.querySelectorAll?.('button') || [])];
    for (const button of buttons) {
      const label = String(button.textContent || '').trim();
      if (MENU_GLYPHS.has(label)) button.setAttribute('aria-label', 'Menu');
    }
  }

  function prepareInstallInstructions() {
    const steps = document.querySelector('#installSteps');
    if (!steps || steps.dataset.turnSrMenuKeys === 'true') return;
    steps.dataset.turnSrMenuKeys = 'true';
    replaceMenuGlyphText(steps);
    normalizeMenuButtons(steps);
    const observer = new MutationObserver(() => {
      replaceMenuGlyphText(steps);
      normalizeMenuButtons(steps);
    });
    observer.observe(steps, { childList: true, subtree: true });
  }

  function balanceValueText(slider) {
    const dbe = Math.max(0, Math.min(100, Math.round(Number(slider?.value) || 0)));
    const other = 100 - dbe;
    const balance = dbe === 50 ? ', balanced' : '';
    return `${dbe}% Drive By Ear, ${other}% other sounds${balance}`;
  }

  function prepareBalanceSlider(node = document) {
    const slider = node?.matches?.('#m8AudioBalance')
      ? node
      : node?.querySelector?.('#m8AudioBalance');
    if (!slider || slider.dataset.turnSrAccessibleBalance === 'true') return;

    slider.dataset.turnSrAccessibleBalance = 'true';
    slider.removeAttribute('aria-describedby');
    if (!slider.hasAttribute('aria-label')) slider.setAttribute('aria-label', 'Sound balance');
    const output = document.querySelector('#m8AudioBalanceValue');
    output?.setAttribute('aria-hidden', 'true');

    const sync = () => slider.setAttribute('aria-valuetext', balanceValueText(slider));
    sync();
    slider.addEventListener('input', () => queueMicrotask(sync));
    slider.addEventListener('change', () => {
      sync();
      const status = slider.closest('.m8-settings-dialog')?.querySelector('.m8-settings-status');
      queueMicrotask(() => {
        if (status?.textContent?.startsWith('Sound balance:')) status.textContent = '';
      });
    });
  }

  function spokenCardText(rawText) {
    return String(rawText || '')
      .trim()
      .toLocaleLowerCase('en')
      .replace(/(^|\s)\p{L}/gu, (character) => character.toLocaleUpperCase('en'));
  }

  function prepareHomeTrackCards(node = document) {
    const cards = [];
    if (node?.matches?.('.m8-track-rail .track-card')) cards.push(node);
    if (node?.querySelectorAll) cards.push(...node.querySelectorAll('.m8-track-rail .track-card'));

    for (const card of cards) {
      const summary = card.querySelector('.track-card-summary');
      if (!summary) continue;

      if (!card.disabled) {
        const name = spokenCardText(card.querySelector('.track-card-name')?.textContent);
        const difficulty = String(card.querySelector('.track-card-difficulty')?.textContent || '').trim().toLocaleLowerCase('en');
        const time = String(card.querySelector('.track-card-best-time')?.textContent || '').trim();
        const car = spokenCardText(card.querySelector('.track-card-best-car:not([hidden])')?.textContent);
        const label = [`${name}, ${difficulty} track`];
        if (time && !/^(?:--:--\.---|NO TIME YET)$/i.test(time)) {
          label.push(`Best ${time}${car ? ` with ${car}` : ''}`);
        } else {
          label.push('No time yet');
        }
        card.setAttribute('aria-label', `${label.join('. ')}.`);
      }

      summary.setAttribute('aria-hidden', 'true');
      card.dataset.turnSrSingleObject = 'true';
    }
  }

  function installSkipLinkStyles() {
    if (document.getElementById(SKIP_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = SKIP_STYLE_ID;
    style.textContent = `
      .turn-sr-skip-links {
        position: fixed;
        z-index: 100000;
        top: 0;
        left: max(8px, env(safe-area-inset-left));
        display: flex;
        gap: 8px;
        padding: 8px;
        transform: translateY(-140%);
        transition: transform 80ms linear;
      }
      .turn-sr-skip-links:focus-within { transform: translateY(0); }
      .turn-sr-skip-links a {
        display: inline-block;
        padding: 10px 12px;
        border: 3px solid #08090a;
        border-radius: 8px;
        background: #fff8e8;
        color: #08090a;
        font: 900 14px/1.1 system-ui, sans-serif;
        text-decoration: underline;
      }
      .turn-sr-onboarding-target {
        position: fixed;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
        border: 0;
      }
    `;
    document.head.appendChild(style);
  }

  function installHomeSkipLinks() {
    const home = document.querySelector('.m8-home');
    const trainingButton = document.querySelector('.turn-dbe-training-home');
    if (!home || !trainingButton || home.querySelector('.turn-sr-skip-links')) return;

    installSkipLinkStyles();
    trainingButton.id = trainingButton.id || 'turnDbeTrainingHome';

    const navigation = document.createElement('nav');
    navigation.className = 'turn-sr-skip-links';
    navigation.setAttribute('aria-label', 'Accessibility shortcuts');
    navigation.innerHTML = `
      <a href="#turnNonVisualOnboarding">Non-visual onboarding</a>
      <a href="#${trainingButton.id}">Drive By Ear 101</a>
    `;

    const onboardingTarget = document.createElement('div');
    onboardingTarget.id = 'turnNonVisualOnboarding';
    onboardingTarget.className = 'turn-sr-onboarding-target';
    onboardingTarget.tabIndex = -1;
    onboardingTarget.setAttribute('role', 'note');
    onboardingTarget.setAttribute('aria-label', NON_VISUAL_ONBOARDING_MESSAGE);

    const [onboardingLink, trainingLink] = navigation.querySelectorAll('a');
    onboardingLink.addEventListener('click', (event) => {
      event.preventDefault();
      try {
        onboardingTarget.focus({ preventScroll: true });
      } catch (_) {
        onboardingTarget.focus?.();
      }
    });
    trainingLink.addEventListener('click', (event) => {
      event.preventDefault();
      try {
        trainingButton.focus({ preventScroll: true });
      } catch (_) {
        trainingButton.focus?.();
      }
    });

    home.prepend(onboardingTarget);
    home.prepend(navigation);
  }

  function suppressDuplicateStartupReady() {
    const copy = document.querySelector('#installGate .install-copy');
    if (!copy || copy.dataset.turnSrReadyGuard === 'true') return;
    copy.dataset.turnSrReadyGuard = 'true';

    const suppress = () => {
      if (!/^TURN is ready\.?$/i.test(String(copy.textContent || '').trim())) return;
      copy.setAttribute('aria-live', 'off');
      copy.removeAttribute('role');
      copy.textContent = '';
    };
    const observer = new MutationObserver(suppress);
    observer.observe(copy, { childList: true, characterData: true, subtree: true });
  }

  function trainingMessage(trackId) {
    const base = TRAINING_START_MESSAGES[trackId];
    if (!base) return '';
    if (trackId !== 'dbe-training-1') return base;

    const steeringMode = globalThis.__turnHome?.getSteeringMode?.();
    const steering = steeringMode === 'manual'
      ? 'Use the on-screen steering control to steer.'
      : 'Turn the device like a steering wheel to steer.';
    return `${base} ${steering} Hold Gas to move. Brake is separate; Drift and Boost are in the drive area.`;
  }

  function externalLiveRegionReadable(live) {
    if (!live || live.id === STATUS_ID || live === positionAnnouncer) return false;
    if (live.getAttribute('aria-live') === 'off') return false;
    if (live.closest('[hidden], [aria-hidden="true"]')) return false;
    const closedDialog = live.closest('dialog');
    if (closedDialog && !closedDialog.open) return false;
    return true;
  }

  function prepareExternalLiveRegions(node = document) {
    const selector = '[aria-live], [role="status"], [role="alert"]';
    const candidates = [];
    if (node?.matches?.(selector)) candidates.push(node);
    if (node?.querySelectorAll) candidates.push(...node.querySelectorAll(selector));

    for (const live of candidates) {
      if (!live || live.id === STATUS_ID || live === positionAnnouncer) continue;
      if (live.dataset.turnSrExternalPriority === 'true') continue;
      live.dataset.turnSrExternalPriority = 'true';
      const observer = new MutationObserver(() => {
        if (!externalLiveRegionReadable(live)) return;
        const message = String(live.textContent || '').trim();
        if (message) reservePositionForSpeech(message);
      });
      observer.observe(live, { childList: true, characterData: true, subtree: true });
    }
  }

  function prepareDialogOpenTracking(node = document) {
    const dialogs = [];
    if (node?.matches?.('dialog, [role="dialog"]')) dialogs.push(node);
    if (node?.querySelectorAll) dialogs.push(...node.querySelectorAll('dialog, [role="dialog"]'));

    for (const dialog of dialogs) {
      if (dialog.dataset.turnSrHeadingTracked === 'true') continue;
      dialog.dataset.turnSrHeadingTracked = 'true';
      const observer = new MutationObserver(() => {
        const nativeOpen = globalThis.HTMLDialogElement
          && dialog instanceof globalThis.HTMLDialogElement
          && dialog.open;
        const roleDialogOpen = dialog.getAttribute('role') === 'dialog' && !dialog.hidden;
        if (nativeOpen || roleDialogOpen) queueMicrotask(() => focusDialogHeading(dialog));
      });
      observer.observe(dialog, { attributes: true, attributeFilter: ['open', 'hidden'] });
    }
  }

  function scanAccessibilityTargets(node = document) {
    preparePositionAnnouncer(node);
    prepareAchievementToast(node);
    prepareBalanceSlider(node);
    prepareHomeTrackCards(node);
    normalizeMenuButtons(node);
    prepareDialogOpenTracking(node);
    prepareExternalLiveRegions(node);
  }

  function installDiscoveryObserver() {
    if (typeof MutationObserver !== 'function' || !document.body) return;
    discoveryObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes || []) {
          if (!(node instanceof Element)) continue;
          scanAccessibilityTargets(node);
        }
      }
    });
    discoveryObserver.observe(document.body, { childList: true, subtree: true });
  }

  installDialogHeadingFocus();
  moveInstallReleaseInfoToEnd();
  prepareInstallInstructions();
  normalizeMenuButtons();
  suppressDuplicateStartupReady();
  scanAccessibilityTargets(document);
  installDiscoveryObserver();

  document.addEventListener('turn:home-ready', () => {
    if (homeReadyHandled) return;
    homeReadyHandled = true;
    scanAccessibilityTargets(document);
    installHomeSkipLinks();
    discoveryObserver?.disconnect();
    discoveryObserver = null;
    window.clearTimeout(externalPriorityTimer);
    externalPriorityTimer = 0;
    externalPriorityUntil = 0;

    const loadingCopy = document.querySelector('#installGate .install-copy');
    if (loadingCopy) {
      loadingCopy.setAttribute('aria-live', 'off');
      loadingCopy.removeAttribute('role');
      if (/^TURN is ready\.?$/i.test(String(loadingCopy.textContent || '').trim())) {
        loadingCopy.textContent = '';
      }
    }

    installLandscapeWatch();
    if (viewportIsPortrait()) {
      speak('TURN is ready. Rotate your device to landscape.', { priority: 'assertive' });
    } else {
      scheduleNonVisualOnboarding();
    }
  }, { once: true });

  window.addEventListener('turn:track-changed', () => {
    scanAccessibilityTargets(document);
  });

  window.addEventListener('turn:dbe-training-stage-started', (event) => {
    const trackId = String(event.detail?.stageId || '');
    if (!TRAINING_START_MESSAGES[trackId]) return;
    clearSpeechChannel(TRAINING_SPEECH_CHANNEL);
    const instructions = trainingMessage(trackId);
    speak(`${instructions} Go!`, {
      priority: 'assertive',
      channel: TRAINING_SPEECH_CHANNEL
    });
  });

  for (const eventName of ['turn:ui-state-change', 'turn:achievements-updated', 'turn:trophy-road-updated']) {
    window.addEventListener(eventName, () => scanAccessibilityTargets(document));
  }
})();