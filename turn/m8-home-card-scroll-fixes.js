const STYLE_ATTRIBUTE = 'data-turn-m8-card-scroll-fixes';
const TRACK_RECORDS_EXPANDED_KEY = 'turn-track-records-expanded-v1';
// Historical regression markers for the native-scroll/title-alignment bundles:
// const FIX_ID = 'native-scroll-full-track-names-v4';
// m8-home-card-scroll-fixes.css?build=${buildKey}-m8.9-track-title-alignment
// const FIX_ID = 'native-scroll-full-track-names-v5';
// m8-home-card-scroll-fixes.css?build=${buildKey}-m8.10-card-gap-rim
const FIX_ID = 'shared-track-bests-v6';

function installStylesheet() {
  if (document.querySelector(`link[${STYLE_ATTRIBUTE}]`)) return;
  const buildKey = globalThis.__TURN_BUILD__?.cacheKey || '';
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = `/turn/m8-home-card-scroll-fixes.css?build=${buildKey}-r206-shared-track-bests`;
  stylesheet.setAttribute(STYLE_ATTRIBUTE, '');
  document.head.appendChild(stylesheet);
}

function waitForFixedHome() {
  const existing = document.querySelector('.m8-home-fixed-layout .m8-track-rail');
  if (existing) return Promise.resolve(existing);

  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      const rail = document.querySelector('.m8-home-fixed-layout .m8-track-rail');
      if (!rail) return;
      observer.disconnect();
      resolve(rail);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });
}

function loadTrackRecordsExpandedPreference() {
  try {
    const stored = globalThis.localStorage?.getItem(TRACK_RECORDS_EXPANDED_KEY);
    if (stored === 'true') return true;
    if (stored === 'false') return false;
  } catch (_) {}
  return null;
}

function saveTrackRecordsExpandedPreference(expanded) {
  try {
    globalThis.localStorage?.setItem(TRACK_RECORDS_EXPANDED_KEY, expanded ? 'true' : 'false');
  } catch (_) {}
}

function px(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function setPixelVariable(element, name, value) {
  const rounded = Math.round(Math.max(0, value) * 100) / 100;
  element.style.setProperty(name, `${rounded}px`);
}

function captureCompactTrackCardGeometry(home) {
  if (home.classList.contains('is-showing-track-bests')) return;
  const rail = home.querySelector('.m8-track-rail');
  if (!rail) return;

  const railRowGap = px(getComputedStyle(rail).rowGap);
  for (const card of rail.querySelectorAll('.track-card')) {
    const choice = card.querySelector('.track-card-choice');
    const difficulty = card.querySelector('.track-card-difficulty');
    const preview = card.querySelector('.track-card-preview');
    if (!choice || !difficulty || !preview) continue;

    const cardRect = card.getBoundingClientRect();
    if (!(cardRect.width > 0 && cardRect.height > 0)) continue;
    const choiceRect = choice.getBoundingClientRect();
    const difficultyRect = difficulty.getBoundingClientRect();
    const previewRect = preview.getBoundingClientRect();
    const cardStyle = getComputedStyle(card);
    const borderTop = px(cardStyle.borderTopWidth);
    const cardRowGap = px(cardStyle.rowGap);

    const compactContentTop = Math.min(choiceRect.top, previewRect.top);
    const compactContentBottom = Math.max(
      choiceRect.bottom,
      difficultyRect.bottom,
      previewRect.bottom
    );
    const compactTopPadding = compactContentTop - cardRect.top - borderTop;
    const compactContentBottomFromTop = compactContentBottom - cardRect.top;
    const expandedRecordsMargin = cardRect.height
      + railRowGap
      - compactContentBottomFromTop
      - cardRowGap;

    setPixelVariable(card, '--m8-track-compact-top-padding', compactTopPadding);
    setPixelVariable(card, '--m8-track-expanded-records-margin', expandedRecordsMargin);
  }
}

function nextAnimationFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

async function installTrackRecordsExpandedPreference(home) {
  const toggle = home.querySelector('.m8-track-bests-toggle');
  if (!toggle) return null;

  const captureBeforeExpansion = () => {
    if (!home.classList.contains('is-showing-track-bests')) {
      captureCompactTrackCardGeometry(home);
    }
  };
  toggle.addEventListener('click', captureBeforeExpansion, { capture: true });

  const persistCurrentState = () => {
    queueMicrotask(() => {
      const expanded = home.classList.contains('is-showing-track-bests');
      saveTrackRecordsExpandedPreference(expanded);
      if (!expanded) requestAnimationFrame(() => captureCompactTrackCardGeometry(home));
    });
  };
  toggle.addEventListener('click', persistCurrentState);

  let resizeFrame = 0;
  window.addEventListener('resize', () => {
    if (home.classList.contains('is-showing-track-bests') || resizeFrame) return;
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0;
      captureCompactTrackCardGeometry(home);
    });
  }, { passive: true });

  // Let the fixed-layout and card-scroll styles settle before taking the geometry
  // snapshot used by a persisted expanded state. The DOM always starts compact.
  await nextAnimationFrame();
  captureCompactTrackCardGeometry(home);

  const stored = loadTrackRecordsExpandedPreference();
  const expanded = home.classList.contains('is-showing-track-bests');
  if (stored !== null && stored !== expanded) toggle.click();

  return Object.freeze({
    key: TRACK_RECORDS_EXPANDED_KEY,
    toggle,
    get expanded() { return home.classList.contains('is-showing-track-bests'); }
  });
}

function installScrollIndicator(rail) {
  const existingViewport = rail.closest('.m8-track-scroll-viewport');
  if (existingViewport) {
    return {
      viewport: existingViewport,
      indicator: existingViewport.querySelector('.m8-track-scroll-indicator'),
      thumb: existingViewport.querySelector('.m8-track-scroll-thumb')
    };
  }

  const viewport = document.createElement('div');
  viewport.className = 'm8-track-scroll-viewport';
  rail.replaceWith(viewport);
  viewport.appendChild(rail);

  const indicator = document.createElement('div');
  indicator.className = 'm8-track-scroll-indicator';
  indicator.setAttribute('aria-hidden', 'true');
  indicator.innerHTML = '<span class="m8-track-scroll-thumb"></span>';
  viewport.appendChild(indicator);

  return {
    viewport,
    indicator,
    thumb: indicator.querySelector('.m8-track-scroll-thumb')
  };
}

function installIndicatorSync(rail, viewport, indicator, thumb) {
  let animationFrame = 0;

  const sync = () => {
    animationFrame = 0;
    const maximum = Math.max(0, rail.scrollHeight - rail.clientHeight);
    const hasOverflow = maximum > 2;
    viewport.classList.toggle('has-track-overflow', hasOverflow);
    rail.dataset.scrollMode = hasOverflow ? 'native' : 'static';
    indicator.hidden = !hasOverflow;
    if (!hasOverflow) {
      if (rail.scrollTop !== 0) rail.scrollTop = 0;
      viewport.classList.remove('has-scroll-above', 'has-scroll-below');
      indicator.classList.add('is-at-start', 'is-at-end');
      return;
    }

    const visibleRatio = Math.min(1, rail.clientHeight / Math.max(rail.clientHeight, rail.scrollHeight));
    const thumbPercent = Math.max(18, visibleRatio * 100);
    const progress = Math.min(1, Math.max(0, rail.scrollTop / maximum));
    thumb.style.height = `${thumbPercent}%`;
    thumb.style.top = `${progress * (100 - thumbPercent)}%`;
    indicator.classList.toggle('is-at-start', progress <= 0.01);
    indicator.classList.toggle('is-at-end', progress >= 0.99);
    viewport.classList.toggle('has-scroll-above', rail.scrollTop > 2);
    viewport.classList.toggle('has-scroll-below', rail.scrollTop < maximum - 2);
  };

  const requestSync = () => {
    if (animationFrame) return;
    animationFrame = requestAnimationFrame(sync);
  };

  rail.addEventListener('scroll', requestSync, { passive: true });
  window.addEventListener('resize', requestSync, { passive: true });
  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(requestSync) : null;
  resizeObserver?.observe(rail);
  for (const card of rail.querySelectorAll('.track-card')) resizeObserver?.observe(card);
  requestSync();

  return { sync: requestSync, disconnect: () => resizeObserver?.disconnect() };
}

export async function installM8HomeCardScrollFixes() {
  installStylesheet();
  const rail = await waitForFixedHome();
  const home = rail.closest('.m8-home');
  if (!home) throw new Error('TURN M8 card and scroll fixes could not find Home.');
  if (home.dataset.m8CardScrollFixes === FIX_ID) return globalThis.__turnHomeCardScrollFixes;

  rail.style.scrollSnapType = 'none';
  rail.style.scrollSnapStop = 'normal';
  rail.dataset.scrollMode = 'native';

  const { viewport, indicator, thumb } = installScrollIndicator(rail);
  if (!indicator || !thumb) throw new Error('TURN M8 could not create the track scroll indicator.');
  const indicatorSync = installIndicatorSync(rail, viewport, indicator, thumb);

  home.classList.add('m8-home-card-scroll-fixes');
  home.dataset.m8CardScrollFixes = FIX_ID;
  document.documentElement.dataset.turnHomeCardScrollFixes = FIX_ID;
  const trackRecordsPreference = await installTrackRecordsExpandedPreference(home);
  indicatorSync.sync();

  globalThis.__turnHomeCardScrollFixes = Object.freeze({
    id: FIX_ID,
    home,
    rail,
    viewport,
    indicator,
    trackRecordsPreference,
    syncIndicator: indicatorSync.sync
  });
  return globalThis.__turnHomeCardScrollFixes;
}
