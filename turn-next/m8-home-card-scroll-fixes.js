const STYLE_ATTRIBUTE = 'data-turn-m8-card-scroll-fixes';
const FIX_ID = 'card-scroll-v1';
const DRAG_THRESHOLD_PX = 7;
const CLICK_SUPPRESSION_MS = 360;

function installStylesheet() {
  if (document.querySelector(`link[${STYLE_ATTRIBUTE}]`)) return;
  const buildKey = globalThis.__TURN_BUILD__?.cacheKey || '';
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = `/turn-next/m8-home-card-scroll-fixes.css?source=${buildKey}-m8.2`;
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

function installDragScrolling(rail) {
  let pointerId = null;
  let startY = 0;
  let startScrollTop = 0;
  let lastY = 0;
  let lastTime = 0;
  let velocity = 0;
  let dragged = false;
  let suppressClicksUntil = 0;
  let inertiaFrame = 0;

  const stopInertia = () => {
    if (!inertiaFrame) return;
    cancelAnimationFrame(inertiaFrame);
    inertiaFrame = 0;
  };

  const startInertia = () => {
    if (Math.abs(velocity) < 0.04) return;
    let previousTime = performance.now();

    const step = (time) => {
      const elapsed = Math.min(32, time - previousTime);
      previousTime = time;
      const before = rail.scrollTop;
      rail.scrollTop += velocity * elapsed;
      const hitBoundary = rail.scrollTop === before && Math.abs(velocity) > 0.05;
      velocity *= Math.pow(0.91, elapsed / 16.67);

      if (hitBoundary || Math.abs(velocity) < 0.025) {
        inertiaFrame = 0;
        return;
      }
      inertiaFrame = requestAnimationFrame(step);
    };

    inertiaFrame = requestAnimationFrame(step);
  };

  rail.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    stopInertia();
    pointerId = event.pointerId;
    startY = event.clientY;
    startScrollTop = rail.scrollTop;
    lastY = event.clientY;
    lastTime = event.timeStamp;
    velocity = 0;
    dragged = false;
  });

  rail.addEventListener('pointermove', (event) => {
    if (event.pointerId !== pointerId) return;
    const distance = event.clientY - startY;
    if (!dragged && Math.abs(distance) < DRAG_THRESHOLD_PX) return;

    if (!dragged) {
      dragged = true;
      rail.classList.add('is-drag-scrolling');
      rail.setPointerCapture?.(pointerId);
    }

    event.preventDefault();
    rail.scrollTop = startScrollTop - distance;

    const elapsed = Math.max(1, event.timeStamp - lastTime);
    velocity = (lastY - event.clientY) / elapsed;
    lastY = event.clientY;
    lastTime = event.timeStamp;
  }, { passive: false });

  const finish = (event) => {
    if (event.pointerId !== pointerId) return;
    if (dragged) {
      event.preventDefault();
      suppressClicksUntil = performance.now() + CLICK_SUPPRESSION_MS;
      startInertia();
    }
    rail.classList.remove('is-drag-scrolling');
    if (rail.hasPointerCapture?.(pointerId)) rail.releasePointerCapture(pointerId);
    pointerId = null;
    dragged = false;
  };

  rail.addEventListener('pointerup', finish, { passive: false });
  rail.addEventListener('pointercancel', finish, { passive: false });
  rail.addEventListener('lostpointercapture', () => {
    rail.classList.remove('is-drag-scrolling');
    pointerId = null;
    dragged = false;
  });

  rail.addEventListener('click', (event) => {
    if (performance.now() > suppressClicksUntil) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  return { stopInertia };
}

export async function installM8HomeCardScrollFixes() {
  installStylesheet();
  const rail = await waitForFixedHome();
  const home = rail.closest('.m8-home');
  if (!home) throw new Error('TURN M8 card and scroll fixes could not find Home.');
  if (home.dataset.m8CardScrollFixes === FIX_ID) return globalThis.__turnNextHomeCardScrollFixes;

  const { viewport, indicator, thumb } = installScrollIndicator(rail);
  if (!indicator || !thumb) throw new Error('TURN M8 could not create the track scroll indicator.');
  const indicatorSync = installIndicatorSync(rail, indicator, thumb);
  const dragScrolling = installDragScrolling(rail);

  home.classList.add('m8-home-card-scroll-fixes');
  home.dataset.m8CardScrollFixes = FIX_ID;
  document.documentElement.dataset.turnHomeCardScrollFixes = FIX_ID;

  globalThis.__turnNextHomeCardScrollFixes = Object.freeze({
    id: FIX_ID,
    home,
    rail,
    viewport,
    indicator,
    syncIndicator: indicatorSync.sync,
    stopInertia: dragScrolling.stopInertia
  });
  return globalThis.__turnNextHomeCardScrollFixes;
}
