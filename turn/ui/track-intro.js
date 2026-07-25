import { getTrackDefinition } from '../tracks/catalog.js?build=20260722-r50';

export const TRACK_INTRO_HOLD_MS = 2100;
export const TRACK_INTRO_FADE_MS = 240;

let presentationId = 0;

export async function showTrackIntro(trackId) {
  const intro = ensureTrackIntro();
  const track = getTrackDefinition(trackId);
  const currentPresentation = ++presentationId;
  const meta = [track.eyebrow, track.difficulty].filter(Boolean).join(' · ');

  intro.querySelector('.track-intro-meta').textContent = meta;
  intro.querySelector('.track-intro-name').textContent = track.name;
  intro.hidden = false;
  intro.setAttribute('aria-hidden', 'false');
  intro.classList.remove('is-visible');
  document.body.classList.add('turn-track-intro');

  await nextPaint();
  if (currentPresentation !== presentationId) return;

  intro.classList.add('is-visible');
  await wait(TRACK_INTRO_HOLD_MS);
  if (currentPresentation !== presentationId) return;

  intro.classList.remove('is-visible');
  await wait(TRACK_INTRO_FADE_MS);
  if (currentPresentation !== presentationId) return;

  intro.hidden = true;
  intro.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('turn-track-intro');
}

function ensureTrackIntro() {
  const existing = document.querySelector('#trackIntro');
  if (existing) return existing;

  const intro = document.createElement('section');
  intro.id = 'trackIntro';
  intro.className = 'track-intro';
  intro.setAttribute('role', 'status');
  intro.setAttribute('aria-live', 'polite');
  intro.setAttribute('aria-atomic', 'true');
  intro.setAttribute('aria-hidden', 'true');
  intro.hidden = true;
  intro.innerHTML = `
    <div class="track-intro-card">
      <span class="track-intro-meta"></span>
      <h2 class="track-intro-name"></h2>
    </div>
  `;
  document.body.appendChild(intro);
  return intro;
}

function nextPaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

function wait(duration) {
  return new Promise((resolve) => window.setTimeout(resolve, duration));
}
