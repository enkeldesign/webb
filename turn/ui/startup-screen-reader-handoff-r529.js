(() => {
  const STATUS_ID = 'turn-screen-reader-status';
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
  let speechTimer = 0;
  let positionAnnouncer = null;
  let pendingPosition = '';
  let homeReadyHandled = false;
  let trainingAnnouncementToken = 0;
  let externalPriorityTimer = 0;
  let externalPriorityUntil = 0;
  let discoveryObserver = null;

  function viewportIsPortrait() {
    const viewport = window.visualViewport;
    const width = viewport?.width || window.innerWidth || document.documentElement.clientWidth;
    const height = viewport?.height || window.innerHeight || document.documentElement.clientHeight;
    return height > width;
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
      speaking = false;
      flushPendingPosition();
      return;
    }

    speaking = true;
    setPositionSpeechEnabled(false);
    const status = ensureStatusRegion();
    status.textContent = '';
    requestAnimationFrame(() => {
      status.textContent = next;
      speechTimer = window.setTimeout(() => {
        status.textContent = '';
        playNextSpeech();
      }, speechDurationMs(next));
    });
  }

  function speak(message) {
    const normalized = String(message || '').trim();
    if (!normalized) return;
    const tail = speechQueue[speechQueue.length - 1];
    if (tail === normalized) return;
    if (speaking && document.getElementById(STATUS_ID)?.textContent === normalized) return;
    speechQueue.push(normalized);
    if (!speaking) playNextSpeech();
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
      toast.removeAttribute('role');
      toast.removeAttribute('aria-live');
      toast.removeAttribute('aria-atomic');
      toast.setAttribute('aria-hidden', 'true');
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
    const value = Math.max(0, Math.min(100, Math.round(Number(slider?.value) || 0)));
    if (value < 45) return `${100 - value}% other sounds`;
    if (value > 55) return `${value}% Drive By Ear`;
    return 'Balanced';
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

  function announceTrainingWhenRunning(trackId) {
    const token = ++trainingAnnouncementToken;
    let attempts = 0;
    const check = () => {
      if (token !== trainingAnnouncementToken) return;
      const runtime = globalThis.__turnRuntime;
      const activeTrack = String(runtime?.state?.trackId || runtime?.trackId || '');
      if (runtime?.state?.running === true && activeTrack === trackId) {
        speak(trainingMessage(trackId));
        return;
      }
      attempts += 1;
      if (attempts < 60) window.setTimeout(check, 100);
    };
    window.setTimeout(check, 100);
  }

  function currentTrainingTrackId() {
    const state = globalThis.__turnDriveByEarTraining?.getState?.();
    const stageId = state?.stageId;
    if (stageId) return stageId;
    const runtimeId = String(globalThis.__turnRuntime?.state?.trackId || '');
    return TRAINING_START_MESSAGES[runtimeId] ? runtimeId : '';
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
    discoveryObserver?.disconnect();
    discoveryObserver = null;

    const loadingCopy = document.querySelector('#installGate .install-copy');
    if (loadingCopy) {
      loadingCopy.setAttribute('aria-live', 'off');
      loadingCopy.removeAttribute('role');
      if (/^TURN is ready\.?$/i.test(String(loadingCopy.textContent || '').trim())) {
        loadingCopy.textContent = '';
      }
    }

    speak(viewportIsPortrait()
      ? 'TURN is ready. Rotate your device to landscape.'
      : 'TURN is ready.');
    speak('To race, choose a track on Home, then choose a car. For an introduction to Drive By Ear and non-visual gameplay, choose Drive By Ear 101 on Home.');
  }, { once: true });

  window.addEventListener('turn:track-changed', (event) => {
    scanAccessibilityTargets(document);
    const trackId = String(event.detail?.trackId || '');
    if (event.detail?.training === true && TRAINING_START_MESSAGES[trackId]) {
      announceTrainingWhenRunning(trackId);
    }
  });

  for (const eventName of ['turn:ui-state-change', 'turn:achievements-updated', 'turn:trophy-road-updated']) {
    window.addEventListener(eventName, () => scanAccessibilityTargets(document));
  }

  document.addEventListener('click', (event) => {
    const restart = event.target?.closest?.('#resetButton, [data-training-race-restart]');
    if (!restart || !document.body.classList.contains('turn-dbe-training-active')) return;
    const trackId = currentTrainingTrackId();
    if (trackId) window.setTimeout(() => speak(trainingMessage(trackId)), 180);
  }, true);
})();
