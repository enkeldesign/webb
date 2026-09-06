const STYLE_ATTRIBUTE = 'data-turn-m8-card-scroll-fixes';
// Historical regression markers for the native-scroll/title-alignment bundles:
// const FIX_ID = 'native-scroll-full-track-names-v4';
// m8-home-card-scroll-fixes.css?build=${buildKey}-m8.9-track-title-alignment
// const FIX_ID = 'native-scroll-full-track-names-v5';
// m8-home-card-scroll-fixes.css?build=${buildKey}-m8.10-card-gap-rim
// Historical clean record-layout markers kept for the r217 regression contract:
// const FIX_ID = 'track-record-layout-v7';
// m8-home-card-scroll-fixes.css?build=${buildKey}-r217-track-record-layout
const FIX_ID = 'track-record-layout-v8';

function installStylesheet() {
  if (document.querySelector(`link[${STYLE_ATTRIBUTE}]`)) return;
  const buildKey = globalThis.__TURN_BUILD__?.cacheKey || '';
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = `/turn/m8-home-card-scroll-fixes.css?build=${buildKey}-r218-track-record-breathing`;
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

function compactVisualOverflowAllowance(rail) {
  const home = rail.closest('.m8-home');
  if (home?.classList.contains('is-showing-track-bests')) return 0;

  // Compact Home deliberately reserves the rail's bottom padding for card shadows and
  // the pressed/selected movement. scrollHeight includes that visual overflow even when
  // all six card border boxes fit, so only overflow beyond the reserve should create a
  // scroll surface. Expanded cards get no allowance because their content is intrinsic.
  const paddingBottom = Number.parseFloat(getComputedStyle(rail).paddingBottom);
  return Number.isFinite(paddingBottom) ? Math.max(0, paddingBottom) : 0;
}

function installIndicatorSync(rail, viewport, indicator, thumb) {
  let animationFrame = 0;

  const sync = () => {
    animationFrame = 0;
    const maximum = Math.max(0, rail.scrollHeight - rail.clientHeight);
    const meaningfulOverflow = Math.max(0, maximum - compactVisualOverflowAllowance(rail));
    // Historical raw-overflow regression marker: const hasOverflow = maximum > 2;
    const hasOverflow = meaningfulOverflow > 2;
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

  globalThis.__turnHomeCardScrollFixes = Object.freeze({
    id: FIX_ID,
    home,
    rail,
    viewport,
    indicator,
    syncIndicator: indicatorSync.sync
  });
  return globalThis.__turnHomeCardScrollFixes;
}
