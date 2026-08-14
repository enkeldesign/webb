const STYLE_ID = 'turn-home-track-scroll-polish-r199';
const POLISH_ID = 'track-gap-scroll-rim-r199';

function installStyle(documentRef = document) {
  if (documentRef.getElementById(STYLE_ID)) return;

  const style = documentRef.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .m8-home-card-scroll-fixes .m8-track-rail {
      /* The cards cast a 10px hard shadow. Give that shadow a few pixels of
         blue breathing room so the visible gap is equally clear in both axes. */
      gap: clamp(14px, 1.4vw, 16px);
    }

    .m8-home-card-scroll-fixes .m8-track-scroll-viewport::before,
    .m8-home-card-scroll-fixes .m8-track-scroll-viewport::after {
      position: absolute;
      left: 3px;
      right: 25px;
      z-index: 3;
      height: 10px;
      content: '';
      pointer-events: none;
      opacity: 0;
      transition: opacity 100ms ease;
    }

    .m8-home-card-scroll-fixes .m8-track-scroll-viewport::before {
      top: 0;
      background: linear-gradient(to bottom, rgb(8 9 10 / 0.20), rgb(8 9 10 / 0));
    }

    .m8-home-card-scroll-fixes .m8-track-scroll-viewport::after {
      bottom: 0;
      background: linear-gradient(to top, rgb(8 9 10 / 0.16), rgb(8 9 10 / 0));
    }

    .m8-home-card-scroll-fixes .m8-track-scroll-viewport.has-scroll-above::before,
    .m8-home-card-scroll-fixes .m8-track-scroll-viewport.has-scroll-below::after {
      opacity: 1;
    }

    .m8-home-card-scroll-fixes .m8-track-scroll-indicator {
      z-index: 4;
    }

    @media (prefers-reduced-motion: reduce) {
      .m8-home-card-scroll-fixes .m8-track-scroll-viewport::before,
      .m8-home-card-scroll-fixes .m8-track-scroll-viewport::after {
        transition: none;
      }
    }
  `;
  documentRef.head.appendChild(style);
}

function findViewport(documentRef = document) {
  return documentRef.querySelector('.m8-home-card-scroll-fixes .m8-track-scroll-viewport');
}

function waitForViewport(documentRef = document) {
  const existing = findViewport(documentRef);
  if (existing) return Promise.resolve(existing);

  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      const viewport = findViewport(documentRef);
      if (!viewport) return;
      observer.disconnect();
      resolve(viewport);
    });
    observer.observe(documentRef.body, { childList: true, subtree: true });
  });
}

function installRimSync(viewport, environment = globalThis) {
  const rail = viewport.querySelector('.m8-track-rail');
  if (!rail) throw new Error('TURN Home track-scroll polish could not find the track rail.');

  let frame = 0;
  const sync = () => {
    frame = 0;
    const maximum = Math.max(0, rail.scrollHeight - rail.clientHeight);
    const scrollTop = Math.min(maximum, Math.max(0, rail.scrollTop));
    viewport.classList.toggle('has-scroll-above', maximum > 2 && scrollTop > 2);
    viewport.classList.toggle('has-scroll-below', maximum > 2 && scrollTop < maximum - 2);
  };
  const requestSync = () => {
    if (frame) return;
    frame = environment.requestAnimationFrame(sync);
  };

  rail.addEventListener('scroll', requestSync, { passive: true });
  environment.addEventListener?.('resize', requestSync, { passive: true });
  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(requestSync) : null;
  resizeObserver?.observe(rail);
  requestSync();

  return Object.freeze({ rail, sync: requestSync, disconnect: () => resizeObserver?.disconnect() });
}

export async function installHomeTrackScrollPolish({
  documentRef = document,
  environment = globalThis
} = {}) {
  installStyle(documentRef);
  const viewport = await waitForViewport(documentRef);
  if (viewport.dataset.turnTrackScrollPolish === POLISH_ID) return globalThis.__turnHomeTrackScrollPolish;

  const rim = installRimSync(viewport, environment);
  viewport.dataset.turnTrackScrollPolish = POLISH_ID;
  documentRef.documentElement.dataset.turnTrackScrollPolish = POLISH_ID;

  const api = Object.freeze({ id: POLISH_ID, viewport, rail: rim.rail, sync: rim.sync });
  globalThis.__turnHomeTrackScrollPolish = api;
  return api;
}

void installHomeTrackScrollPolish();
