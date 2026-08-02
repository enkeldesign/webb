const STYLE_ATTRIBUTE = 'data-turn-m8-card-scroll-fixes';
const FIX_ID = 'native-scroll-full-track-names-v4';

function installStylesheet() {
  if (document.querySelector(`link[${STYLE_ATTRIBUTE}]`)) return;
  const buildKey = globalThis.__TURN_BUILD__?.cacheKey || '';
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = `/turn/m8-home-card-scroll-fixes.css?build=${buildKey}-m8.9-track-title-alignment`;
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

function installIndicatorSync(rail, indicator, thumb) {
  let animationFrame = 0;

  const sync = () => {
    animationFrame = 0;
    const maximum = Math.max(0, rail.scrollHeight - rail.clientHeight);
    const hasOverflow = maximum > 2;
    indicator.hidden = !hasOverflow;
    if (!hasOverflow) return;

    const visibleRatio = Math.min(1, rail.clientHeight / Math.max(rail.clientHeight, rail.scrollHeight));
    const thumbPercent = Math.max(18, visibleRatio * 100);
    const progress = Math.min(1, Math.max(0, rail.scrollTop / maximum));
    thumb.style.height = `${thumbPercent}%`;
    thumb.style.top = `${progress * (100 - thumbPercent)}%`;
    indicator.classList.toggle('is-at-start', progress <= 0.01);
    indicator.classList.toggle('is-at-end', progress >= 0.99);
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
  const indicatorSync = installIndicatorSync(rail, indicator, thumb);

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