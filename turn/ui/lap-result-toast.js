import {
  lapResultAnnouncement,
  lapVoidAnnouncement,
  setLiveAnnouncement,
  spokenLapTime,
  spokenPosition
} from './race-announcements.js';

const TOAST_VISIBLE_MS = 4000;
const TOAST_EXIT_MS = 220;

export function installLapResultToast() {
  if (globalThis.__turnLapResultToastInstalled) return;
  globalThis.__turnLapResultToastInstalled = true;

  const hud = document.querySelector('#hud');
  if (!hud) return;

  const toast = document.createElement('div');
  toast.className = 'lap-result-toast';
  toast.hidden = true;
  toast.setAttribute('aria-label', 'Lap result');
  toast.innerHTML = `
    <span>LAP</span>
    <strong>
      <b class="lap-result-position">1/1</b>
      <i aria-hidden="true">•</i>
      <b class="lap-result-time">0:00.000</b>
    </strong>
  `;

  const announcer = document.createElement('div');
  announcer.className = 'turn-sr-only lap-result-announcer';
  announcer.setAttribute('aria-live', 'polite');
  announcer.setAttribute('aria-atomic', 'true');
  hud.append(toast, announcer);

  const label = toast.querySelector('span');
  const position = toast.querySelector('.lap-result-position');
  const separator = toast.querySelector('i');
  const time = toast.querySelector('.lap-result-time');
  let hideTimer = 0;
  let exitTimer = 0;

  function clearTimers() {
    window.clearTimeout(hideTimer);
    window.clearTimeout(exitTimer);
    hideTimer = 0;
    exitTimer = 0;
  }

  function hide({ immediate = false } = {}) {
    clearTimers();
    if (toast.hidden) return;

    if (immediate) {
      toast.hidden = true;
      toast.classList.remove('is-visible', 'is-leaving', 'is-invalid');
      return;
    }

    toast.classList.remove('is-visible');
    toast.classList.add('is-leaving');
    exitTimer = window.setTimeout(() => {
      toast.hidden = true;
      toast.classList.remove('is-leaving', 'is-invalid');
      exitTimer = 0;
    }, TOAST_EXIT_MS);
  }

  function reveal() {
    clearTimers();
    toast.hidden = false;
    toast.classList.remove('is-visible', 'is-leaving');
    void toast.offsetWidth;
    toast.classList.add('is-visible');
    hideTimer = window.setTimeout(() => hide(), TOAST_VISIBLE_MS);
  }

  function showResult(result) {
    const place = Number(result?.position);
    const total = Number(result?.total);
    const seconds = Number(result?.time);
    if (!Number.isFinite(place) || !Number.isFinite(total) || !Number.isFinite(seconds)) return;

    const normalizedPlace = Math.max(1, Math.round(place));
    const normalizedTotal = Math.max(1, Math.round(total));
    label.textContent = 'LAP';
    position.textContent = `${normalizedPlace}/${normalizedTotal}`;
    position.setAttribute('aria-label', `Position, ${spokenPosition(normalizedPlace, normalizedTotal)}`);
    separator.hidden = false;
    time.hidden = false;
    time.textContent = formatLapTime(seconds);
    time.setAttribute('aria-label', `Lap time, ${spokenLapTime(seconds)}`);
    toast.classList.remove('is-invalid');
    reveal();
    setLiveAnnouncement(announcer, lapResultAnnouncement({ position: normalizedPlace, time: seconds }));
  }

  function showInvalid(result) {
    const guidance = result?.reason === 'missed-checkpoint'
      ? 'STAY ON THE TRACK!'
      : 'TRY AGAIN';
    label.textContent = 'LAP VOID';
    position.textContent = guidance;
    position.setAttribute('aria-label', guidance);
    separator.hidden = true;
    time.hidden = true;
    time.removeAttribute('aria-label');
    toast.classList.add('is-invalid');
    reveal();
    setLiveAnnouncement(announcer, lapVoidAnnouncement(result?.reason));
  }

  window.addEventListener('turn:lap-result', (event) => showResult(event.detail));
  window.addEventListener('turn:lap-invalid', (event) => showInvalid(event.detail));
  window.addEventListener('turn:ui-state-change', (event) => {
    if (!event.detail?.running || event.detail?.reason === 'race-reset') {
      hide({ immediate: true });
      setLiveAnnouncement(announcer, '');
    }
  });
}

function formatLapTime(seconds) {
  if (!Number.isFinite(seconds)) return '--:--.---';
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  const ms = Math.floor((seconds % 1) * 1000).toString().padStart(3, '0');
  return `${minutes}:${secs}.${ms}`;
}
