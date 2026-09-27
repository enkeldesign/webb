// TURN toast region: achievement, Trophy Road reward and Home support toasts share
// one top-centre region and stack instead of overlapping. The modules that own each
// toast keep creating and toggling it exactly as before; this only moves each one
// into the region when it appears. Race cue pills keep their own lane.

const INSTALL_KEY = '__turnToastRegion';
const TOAST_SELECTOR = '.turn-achievement-toast, .turn-support-home-toast';

export function installToastRegion({ documentRef = document } = {}) {
  if (globalThis[INSTALL_KEY]) return globalThis[INSTALL_KEY];
  const region = documentRef.createElement('div');
  region.className = 'turn-toast-region';
  documentRef.body.appendChild(region);

  const adopt = () => {
    for (const toast of documentRef.body.querySelectorAll(`:scope > :is(${TOAST_SELECTOR})`)) {
      region.appendChild(toast);
    }
  };
  new MutationObserver(adopt).observe(documentRef.body, { childList: true });
  adopt();

  // On Home the region sits just below the app bar, wherever the page has put it
  // (the portrait notice can push it down); elsewhere the stylesheet's top applies.
  const place = () => {
    const home = documentRef.querySelector('.m8-home.turn-app-bar-layout');
    const bar = home && !home.hidden ? home.querySelector('.m8-home-head') : null;
    const bottom = bar?.getBoundingClientRect().bottom || 0;
    region.style.top = bottom > 0 ? `${Math.round(bottom + 12)}px` : '';
  };
  new MutationObserver(place).observe(region, { subtree: true, attributes: true, attributeFilter: ['class', 'hidden'], childList: true });

  globalThis[INSTALL_KEY] = region;
  return region;
}
