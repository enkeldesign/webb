(() => {
  const isStandalone =
    document.documentElement.classList.contains('turn-standalone') ||
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: fullscreen)').matches ||
    navigator.standalone === true;

  if (!isStandalone) return;

  const ROOT_CLASS = 'turn-pwa-usable-viewport-r181';
  const STYLE_ID = 'turn-pwa-usable-viewport-r181-style';
  const SETTLE_DELAYS_MS = Object.freeze([0, 80, 240, 650, 1200]);
  const root = document.documentElement;
  root.classList.add(ROOT_CLASS);

  if (!document.querySelector(`#${STYLE_ID}`)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      html.${ROOT_CLASS} {
        --app-width: 100vw !important;
        --app-height: 100vh !important;
      }
      @supports (width: 100dvw) and (height: 100dvh) {
        html.${ROOT_CLASS} {
          --app-width: 100dvw !important;
          --app-height: 100dvh !important;
        }
      }
      html.${ROOT_CLASS},
      html.${ROOT_CLASS} body {
        min-width: 0 !important;
        min-height: 0 !important;
        overflow: hidden !important;
        background: #38d9ff !important;
      }
      html.${ROOT_CLASS} body {
        width: var(--app-width) !important;
        height: var(--app-height) !important;
      }
    `;
    document.head.appendChild(style);
  }

  function usableViewportSize() {
    const game = document.querySelector('#game');
    const gameRect = game?.getBoundingClientRect();
    const width = Number(gameRect?.width)
      || Number(root.clientWidth)
      || Number(window.innerWidth)
      || 1;
    const height = Number(gameRect?.height)
      || Number(root.clientHeight)
      || Number(window.innerHeight)
      || 1;
    return {
      width: Math.max(1, Math.round(width)),
      height: Math.max(1, Math.round(height))
    };
  }

  function publishDiagnostics(width, height) {
    const viewport = window.visualViewport;
    const snapshot = Object.freeze({
      strategy: 'usable-web-layer',
      width,
      height,
      innerWidth: Number(window.innerWidth) || 0,
      innerHeight: Number(window.innerHeight) || 0,
      clientWidth: Number(root.clientWidth) || 0,
      clientHeight: Number(root.clientHeight) || 0,
      visualWidth: Number(viewport?.width) || 0,
      visualHeight: Number(viewport?.height) || 0,
      screenWidth: Number(screen.width) || 0,
      screenHeight: Number(screen.height) || 0
    });
    globalThis.__turnPwaViewportDiagnostics = snapshot;
    root.dataset.turnPwaViewport = `${width}x${height}`;
    root.dataset.turnPwaViewportStrategy = snapshot.strategy;
  }

  function installRuntimeBoundary(runtime) {
    if (!runtime?.renderer || !runtime?.camera || runtime.__turnUsableViewportR181Installed) return false;
    runtime.__turnUsableViewportR181Installed = true;

    const renderer = runtime.renderer;
    const camera = runtime.camera;
    const canvas = renderer.domElement;
    const nativeSetSize = renderer.setSize.bind(renderer);
    let applying = false;
    let animationFrame = 0;
    let settleTimers = [];

    function syncNow() {
      animationFrame = 0;
      const { width, height } = usableViewportSize();
      camera.aspect = width / height;
      camera.updateProjectionMatrix();

      applying = true;
      nativeSetSize(width, height, false);
      applying = false;

      canvas.style.setProperty('width', '100%', 'important');
      canvas.style.setProperty('height', '100%', 'important');
      publishDiagnostics(width, height);
    }

    function queueSync() {
      if (animationFrame) cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(() => {
        animationFrame = requestAnimationFrame(syncNow);
      });
    }

    function settle() {
      for (const timer of settleTimers) window.clearTimeout(timer);
      settleTimers = SETTLE_DELAYS_MS.map((delay) => window.setTimeout(queueSync, delay));
    }

    renderer.setSize = function useUsableViewportInsteadOfPhysicalScreen() {
      if (applying) return nativeSetSize(...arguments);
      queueSync();
      return renderer;
    };

    for (const eventName of ['resize', 'orientationchange', 'pageshow', 'focus']) {
      window.addEventListener(eventName, settle, { passive: true });
    }
    window.visualViewport?.addEventListener('resize', settle, { passive: true });
    screen.orientation?.addEventListener?.('change', settle, { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) settle();
    }, { passive: true });

    settle();
    return true;
  }

  if (!installRuntimeBoundary(globalThis.__turnRuntime)) {
    window.addEventListener('turn:runtime-ready', (event) => {
      installRuntimeBoundary(event.detail || globalThis.__turnRuntime);
    }, { once: true });
  }
})();
