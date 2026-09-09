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

  // Reserve actual layout space for the icon rather than absolutely positioning
  // it over the availability panel on narrower landscape viewports.
  headingCopy.style.display = 'grid';
  headingCopy.style.gridTemplateColumns = 'auto auto';
  headingCopy.style.gridTemplateRows = 'auto auto';
  headingCopy.style.columnGap = '14px';
  headingCopy.style.alignItems = 'center';
  headingCopy.style.justifyContent = 'start';
  headingCopy.querySelector('h1')?.style.setProperty('grid-column', '1');
  headingCopy.querySelector('h1')?.style.setProperty('grid-row', '1');
  headingCopy.querySelector('p')?.style.setProperty('grid-column', '1');
  headingCopy.querySelector('p')?.style.setProperty('grid-row', '2');

  const host = document.createElement('span');
  host.dataset.lotTrackIcon = '';
  host.setAttribute('aria-hidden', 'true');
  host.style.gridColumn = '2';
  host.style.gridRow = '1 / span 2';
  host.style.width = 'clamp(42px, 5.2vw, 62px)';
  host.style.height = 'clamp(42px, 5.2vw, 62px)';
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
