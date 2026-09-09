// Presentation wrapper for the production showroom. The selected track already
// belongs to Home/race state; this only mirrors that choice as a decorative icon
// beside THE LOT heading without creating another source of track truth.

import { showTheLot as showBaseLot } from './lot-showroom-experiment.js?revision=r252-supercar-outward-rims-base';
import { trackIconMarkup } from '../ui/track-icons.js?revision=r1-track-reward-icons';

export * from './lot-showroom-experiment.js?revision=r252-supercar-outward-rims-base';

function currentTrackId() {
  return globalThis.__turnNextHome?.getSelectedTrackId?.()
    || globalThis.__turnRuntime?.state?.trackId
    || globalThis.__turnGetTrackId?.()
    || '';
}

function installChosenTrackIcon() {
  const screen = document.querySelector('.lot-screen.lot-showroom');
  const headingCopy = screen?.querySelector('.lot-heading-copy');
  if (!headingCopy || headingCopy.querySelector('[data-lot-track-icon]')) return;

  const markup = trackIconMarkup(currentTrackId());
  if (!markup) return;

  headingCopy.style.position = 'relative';

  const host = document.createElement('span');
  host.dataset.lotTrackIcon = '';
  host.setAttribute('aria-hidden', 'true');
  host.style.position = 'absolute';
  host.style.top = '50%';
  host.style.left = 'calc(100% + 14px)';
  host.style.width = 'clamp(46px, 5.8vw, 64px)';
  host.style.height = 'clamp(46px, 5.8vw, 64px)';
  host.style.transform = 'translateY(-50%)';
  host.style.color = 'var(--ink, #08090a)';
  host.style.pointerEvents = 'none';
  host.innerHTML = markup;
  headingCopy.appendChild(host);
}

export function showTheLot(options = {}) {
  const result = showBaseLot(options);
  installChosenTrackIcon();
  return result;
}
