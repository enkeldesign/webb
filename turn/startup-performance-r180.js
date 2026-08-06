const SLOW_LOADING_MESSAGE_DELAY_MS = 1400;
const buildKey = globalThis.__TURN_BUILD__?.cacheKey || '';
const moduleBase = new URL('/turn/', globalThis.location?.href || 'https://enkel.design/turn/');

function withBuild(path) {
  const url = new URL(path, moduleBase);
  if (buildKey) url.searchParams.set('build', buildKey);
  return url.href;
}

function preloadModule(path, { crossOrigin = false } = {}) {
  const href = path.startsWith('https://') ? path : withBuild(path);
  if (document.querySelector(`link[rel="modulepreload"][href="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'modulepreload';
  link.href = href;
  if (crossOrigin) link.crossOrigin = 'anonymous';
  document.head.appendChild(link);
}

function preloadCriticalStartupGraph() {
  // Preload bytes only. app.js retains complete control over execution order.
  for (const path of [
    './platform/web-platform.js',
    './platform/platform-context.js',
    './motion-lifecycle-bridge.js',
    './display-lifecycle-bridge.js',
    './main.js',
    './render/world.js?revision=r175-bella-broad-rear-zone',
    './m8-home.js?revision=r131-motion-permission-retry&trophy-road=r159',
    './m8-home-fixed-layout.js?revision=m8.9-track-title-alignment&trophy-road=r159&achievements=r166-bella-records&bella-rescue=r174-siren-zone'
  ]) preloadModule(path);

  preloadModule(
    'https://cdn.jsdelivr.net/npm/three@0.184.0/build/three.module.js',
    { crossOrigin: true }
  );
}

function installSlowLoadingMessage() {
  const gate = document.querySelector('#installGate');
  const copy = gate?.querySelector('.install-copy');
  if (!gate || !copy) return;

  const style = document.createElement('style');
  style.id = 'turn-startup-performance-r180-style';
  style.textContent = `
    .turn-startup-expectation {
      margin: -8px 0 18px;
      max-width: 34rem;
      font-size: .92rem;
      font-weight: 750;
      line-height: 1.35;
      letter-spacing: 0;
      text-transform: none;
      opacity: .74;
    }
  `;
  document.head.appendChild(style);

  const note = document.createElement('p');
  note.className = 'turn-startup-expectation';
  note.textContent = 'This might take a minute.';
  note.hidden = true;
  note.setAttribute('aria-live', 'polite');
  copy.insertAdjacentElement('afterend', note);

  const launchStartedAt = performance.now();
  let timer = 0;
  let finished = false;

  const loadingCoverIsActive = () => (
    gate.classList.contains('turn-startup-loading')
    || document.documentElement.classList.contains('turn-startup-pending')
  );

  function stop() {
    finished = true;
    window.clearTimeout(timer);
    note.hidden = true;
  }

  function poll() {
    if (finished) return;
    const elapsed = performance.now() - launchStartedAt;
    if (elapsed >= SLOW_LOADING_MESSAGE_DELAY_MS && loadingCoverIsActive()) {
      note.hidden = false;
    }
    timer = window.setTimeout(poll, 100);
  }

  document.addEventListener('turn:home-ready', stop, { once: true });
  poll();
}

preloadCriticalStartupGraph();
installSlowLoadingMessage();
