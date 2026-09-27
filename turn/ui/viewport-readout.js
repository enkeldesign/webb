// Tester-only viewport readout in the ☰ sheet footer. iOS standalone can lay the app
// out shorter than the screen (a strip of page background along the bottom), and
// the numbers that tell the cases apart only exist on the device. Shown only on a
// developer device (tester unlock), refreshed each time the sheet opens.

const INSTALL_KEY = '__turnViewportReadout';

function measure(documentRef, height) {
  const probe = documentRef.createElement('i');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText = `position:fixed;left:-10000px;top:0;width:1px;height:${height};visibility:hidden;pointer-events:none;`;
  documentRef.body.appendChild(probe);
  const value = Math.round(probe.getBoundingClientRect().height);
  probe.remove();
  return value;
}

export function viewportSnapshot({ documentRef = document, windowRef = window } = {}) {
  const root = documentRef.documentElement;
  const visual = windowRef.visualViewport;
  const screenRef = windowRef.screen;
  return {
    screen: `${screenRef?.width || 0}×${screenRef?.height || 0}`,
    inner: `${windowRef.innerWidth}×${windowRef.innerHeight}`,
    client: `${root.clientWidth}×${root.clientHeight}`,
    visual: visual ? `${Math.round(visual.width)}×${Math.round(visual.height)}+${Math.round(visual.offsetTop)}` : '–',
    svh: measure(documentRef, '100svh'),
    dvh: measure(documentRef, '100dvh'),
    lvh: measure(documentRef, '100lvh'),
    safeTop: measure(documentRef, 'env(safe-area-inset-top, 0px)'),
    safeBottom: measure(documentRef, 'env(safe-area-inset-bottom, 0px)'),
    repair: root.dataset.turnViewportRepair || 'none',
    gap: root.dataset.turnViewportGap || 'none'
  };
}

export function formatViewportSnapshot(s) {
  return `VIEWPORT · screen ${s.screen} · inner ${s.inner} · client ${s.client} · visual ${s.visual} · svh/dvh/lvh ${s.svh}/${s.dvh}/${s.lvh} · safe ${s.safeTop}/${s.safeBottom} · repair ${s.repair} · gap ${s.gap}`;
}

export const STRIP_PROBE_KEY = 'turn-strip-probe-v1';
const STRIP_PROBE_COLOR = '#ff00ff';

export function applyStripProbe(kind, { documentRef = document, windowRef = window } = {}) {
  const root = documentRef.documentElement;
  const theme = documentRef.querySelector('meta[name="theme-color"]');
  if (kind === 'html') root.style.setProperty('background', STRIP_PROBE_COLOR, 'important');
  if (kind === 'body') documentRef.body.style.setProperty('background', STRIP_PROBE_COLOR, 'important');
  if (kind === 'theme' && theme) theme.setAttribute('content', STRIP_PROBE_COLOR);
  if (kind === 'launch' || kind === 'clear') {
    try {
      if (kind === 'launch') windowRef.localStorage.setItem(STRIP_PROBE_KEY, '1');
      else windowRef.localStorage.removeItem(STRIP_PROBE_KEY);
    } catch (_) {}
    windowRef.location.reload();
  }
}

export function installViewportReadout({ documentRef = document, windowRef = window } = {}) {
  if (globalThis[INSTALL_KEY]) return globalThis[INSTALL_KEY];
  const sheet = documentRef.querySelector('.turn-home-sheet');
  const footer = sheet?.querySelector('.turn-home-sheet-footer');
  if (!sheet || !footer) return null;

  const line = documentRef.createElement('p');
  line.className = 'turn-viewport-readout';
  line.hidden = true;

  // Strip probe: which surface does iOS paint into the gap below the app? Each
  // button turns one candidate magenta; the one that colours the strip names it.
  const probe = documentRef.createElement('div');
  probe.className = 'turn-strip-probe';
  probe.hidden = true;
  probe.innerHTML = '<span>STRIP TEST</span>' +
    '<button type="button" data-strip-probe="html">HTML</button>' +
    '<button type="button" data-strip-probe="body">BODY</button>' +
    '<button type="button" data-strip-probe="theme">THEME</button>' +
    '<button type="button" data-strip-probe="launch">AT LAUNCH</button>' +
    '<button type="button" data-strip-probe="clear">CLEAR</button>';
  probe.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest('[data-strip-probe]') : null;
    if (target) applyStripProbe(target.dataset.stripProbe, { documentRef, windowRef });
  });

  function refresh() {
    if (!globalThis.__turnTelemetry?.isDeveloperDevice?.()) {
      line.hidden = true;
      probe.hidden = true;
      return;
    }
    line.textContent = formatViewportSnapshot(viewportSnapshot({ documentRef, windowRef }));
    line.hidden = false;
    probe.hidden = false;
    if (line.parentElement !== footer) footer.appendChild(line);
    if (probe.parentElement !== footer) footer.appendChild(probe);
  }

  // The sheet is a native <dialog>; its open attribute flips when it shows.
  new MutationObserver(() => { if (sheet.open) refresh(); })
    .observe(sheet, { attributes: true, attributeFilter: ['open'] });
  windowRef.addEventListener('resize', () => { if (sheet.open) refresh(); }, { passive: true });

  const api = Object.freeze({ refresh });
  globalThis[INSTALL_KEY] = api;
  return api;
}
