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
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.setAttribute('aria-atomic', 'true');
  toast.innerHTML = `
    <span>LAST LAP</span>
    <strong>
      <b class="lap-result-position">1/1</b>
      <i aria-hidden="true">•</i>
      <b class="lap-result-time">0:00.000</b>
    </strong>
  `;
  hud.appendChild(toast);

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

    label.textContent = 'LAST LAP';
    position.textContent = `${Math.max(1, Math.round(place))}/${Math.max(1, Math.round(total))}`;
    separator.hidden = false;
    time.hidden = false;
    time.textContent = formatLapTime(seconds);
    toast.classList.remove('is-invalid');
    reveal();
  }

  function showInvalid(result) {
    label.textContent = 'LAP INVALID';
    position.textContent = result?.reason === 'missed-checkpoint'
      ? 'MISSED CHECKPOINT'
      : 'TRY AGAIN';
    separator.hidden = true;
    time.hidden = true;
    toast.classList.add('is-invalid');
    reveal();
  }

  window.addEventListener('turn:lap-result', (event) => showResult(event.detail));
  window.addEventListener('turn:lap-invalid', (event) => showInvalid(event.detail));
  window.addEventListener('turn:ui-state-change', (event) => {
    if (!event.detail?.running) hide({ immediate: true });
  });
}

function formatLapTime(seconds) {
  if (!Number.isFinite(seconds)) return '--:--.---';
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  const ms = Math.floor((seconds % 1) * 1000).toString().padStart(3, '0');
  return `${minutes}:${secs}.${ms}`;
}
