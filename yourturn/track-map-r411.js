import { getTrackDefinition, getTrackPreviewPoints } from '/turn/tracks/catalog.js?source=20260729-r118-m8';

const MAP_VIEWS = new Set(['invitation', 'paused']);
const VIEWBOX_WIDTH = 320;
const VIEWBOX_HEIGHT = 185;
const MAP_WIDTH = 270;
const MAP_HEIGHT = 135;

export function makeChallengeTrackMapSvg(trackId) {
  const track = getTrackDefinition(trackId);
  const points = getTrackPreviewPoints(track.id, 110);
  const xs = points.map((point) => point.x);
  const zs = points.map((point) => point.z);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxZ - minZ);
  const scale = Math.min(MAP_WIDTH / width, MAP_HEIGHT / height);
  const offsetX = (VIEWBOX_WIDTH - width * scale) / 2;
  const offsetY = (VIEWBOX_HEIGHT - height * scale) / 2;
  const path = points.map((point, index) => {
    const x = offsetX + (point.x - minX) * scale;
    const y = offsetY + (point.z - minZ) * scale;
    return `${index ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
  const startX = offsetX + (points[0].x - minX) * scale;
  const startY = offsetY + (points[0].z - minZ) * scale;

  return `
    <svg viewBox="0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}" focusable="false" aria-hidden="true">
      <path class="yourturn-track-map-shadow" d="${path} Z"></path>
      <path class="yourturn-track-map-road" d="${path} Z"></path>
      <path class="yourturn-track-map-line" d="${path} Z" style="stroke:${track.accent}"></path>
      <circle class="yourturn-track-map-start" cx="${startX.toFixed(1)}" cy="${startY.toFixed(1)}" r="7"></circle>
    </svg>`;
}

function mapMarkup(challenge) {
  if (!challenge?.trackId) return '';
  return `<div class="yourturn-track-map" data-yourturn-track-map="${challenge.trackId}" aria-hidden="true">${makeChallengeTrackMapSvg(challenge.trackId)}</div>`;
}

function install() {
  const session = globalThis.__yourTurnSession;
  const dialog = document.querySelector('#yourTurnDialog');
  const card = dialog?.querySelector('.yourturn-card');
  const extra = dialog?.querySelector('.yourturn-extra');
  if (!session || !dialog || !card || !extra) return false;
  if (dialog.dataset.r411TrackMap === 'true') return true;
  dialog.dataset.r411TrackMap = 'true';

  function sync() {
    const challenge = session.getState?.().challenge;
    const view = card.dataset.view || '';
    const existing = extra.querySelector('[data-yourturn-track-map]');
    if (!dialog.open || !challenge || !MAP_VIEWS.has(view)) {
      existing?.remove();
      return;
    }

    if (existing?.dataset.yourturnTrackMap === challenge.trackId) return;
    existing?.remove();
    extra.insertAdjacentHTML('afterbegin', mapMarkup(challenge));
  }

  const observer = typeof MutationObserver === 'function'
    ? new MutationObserver(sync)
    : null;
  observer?.observe(dialog, {
    attributes: true,
    attributeFilter: ['open'],
    childList: true,
    subtree: true
  });
  observer?.observe(card, { attributes: true, attributeFilter: ['data-view'] });
  dialog.addEventListener('close', sync);
  sync();
  return true;
}

function bootstrap(attempt = 0) {
  if (install()) return;
  if (attempt < 240) requestAnimationFrame(() => bootstrap(attempt + 1));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => bootstrap(), { once: true });
} else {
  bootstrap();
}
