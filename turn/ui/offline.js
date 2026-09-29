// Offline play (#1030): registers TURN's service worker (sw.js) once the app has
// started and asks the browser to keep TURN's storage. In the installed app, the first
// download shows how far it has come and then "Ready to play offline". A later release
// downloads quietly and says when it has taken over: "New TURN version ready — RESTART".
// Neither shows in the middle of a race.
//
// Automated browsers and local servers skip the worker unless a test opts in, so the
// browser smokes and local development keep talking to their servers directly.

const INSTALL_KEY = '__turnOffline';
const TEST_OPT_IN = 'turn-offline-under-test';
const REGISTER_DELAY_MS = 1500;
const READY_TEXT = 'Ready to play offline';
const READY_VISIBLE_MS = 4000;
const FAILED_TEXT = 'Offline copy incomplete. TURN will try again.';
const FAILED_VISIBLE_MS = 6000;

function scopeFor(pathname) {
  if (pathname.startsWith('/turn-next/')) return '/turn-next/';
  if (pathname.startsWith('/turn/')) return '/turn/';
  return null;
}

export function installOffline({ windowRef = globalThis, documentRef = globalThis.document } = {}) {
  if (windowRef[INSTALL_KEY]) return windowRef[INSTALL_KEY];
  const nav = windowRef.navigator;
  const scope = scopeFor(windowRef.location?.pathname || '');
  const local = /^(?:localhost|127\.0\.0\.1|\[::1\])$/.test(windowRef.location?.hostname || '');
  let optedIn = !nav?.webdriver && !local;
  try {
    optedIn = optedIn || windowRef.localStorage.getItem(TEST_OPT_IN) === '1';
  } catch {
    // No storage: no opt-in.
  }
  if (!scope || !nav?.serviceWorker || !windowRef.isSecureContext || !optedIn) return null;

  // The first worker taking over a page is not an update; any later one is.
  let controlled = Boolean(nav.serviceWorker.controller);
  let registration = null;
  let toast = null;

  function showUpdate() {
    if (toast?.isConnected) return;
    // Never over a race: wait until it ends.
    if (documentRef.body.classList.contains('turn-race-active')) {
      const observer = new MutationObserver(() => {
        if (documentRef.body.classList.contains('turn-race-active')) return;
        observer.disconnect();
        showUpdate();
      });
      observer.observe(documentRef.body, { attributes: true, attributeFilter: ['class'] });
      return;
    }
    toast = documentRef.createElement('div');
    toast.className = 'turn-update-toast';
    toast.setAttribute('role', 'status');
    toast.innerHTML = `
      <p class="turn-update-toast-text">New TURN version ready</p>
      <button class="turn-update-toast-restart" type="button">RESTART</button>
      <button class="turn-update-toast-later" type="button" aria-label="Later">×</button>`;
    toast.querySelector('.turn-update-toast-restart').addEventListener('click', () => windowRef.location.reload());
    toast.querySelector('.turn-update-toast-later').addEventListener('click', () => toast.remove());
    const region = documentRef.querySelector('.turn-toast-region') || documentRef.body;
    region.appendChild(toast);
  }

  // The first download, in the installed app: a bar with how many of the release's
  // files are stored. The tab of a browser has storage of its own (iOS), so it stays quiet.
  let progress = null;
  function showProgress({ stored, total, failed }) {
    if (!documentRef.documentElement.classList.contains('turn-standalone')) return;
    if (!progress?.isConnected) {
      if (failed) return;
      progress = documentRef.createElement('div');
      progress.className = 'turn-offline-progress';
      progress.innerHTML = `
        <p class="turn-offline-progress-text" aria-live="polite">Saving TURN for offline play</p>
        <span class="turn-offline-progress-value" aria-hidden="true">0%</span>
        <div class="turn-offline-progress-bar" role="progressbar" aria-label="Saving TURN for offline play"
          aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span></span></div>`;
      (documentRef.querySelector('.turn-toast-region') || documentRef.body).appendChild(progress);
    }
    const percent = Math.floor((100 * stored) / Math.max(1, total));
    progress.style.setProperty('--turn-offline-progress', `${percent}%`);
    progress.querySelector('.turn-offline-progress-value').textContent = `${percent}%`;
    progress.querySelector('[role="progressbar"]').setAttribute('aria-valuenow', String(percent));
    if (failed) finishProgress('is-failed', FAILED_TEXT, FAILED_VISIBLE_MS);
  }

  function finishProgress(state, message, visibleMs) {
    if (!progress?.isConnected) return;
    const finished = progress;
    finished.classList.add(state);
    finished.querySelector('.turn-offline-progress-text').textContent = message;
    windowRef.setTimeout(() => finished.remove(), visibleMs);
  }

  nav.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'turn-offline-progress') showProgress(event.data);
  });
  nav.serviceWorker.startMessages?.();

  // A new release's worker takes over once its files are stored; the page that is
  // running keeps its own build until the player restarts. The first worker taking
  // over means the first download is done.
  nav.serviceWorker.addEventListener('controllerchange', () => {
    if (controlled) showUpdate();
    else if (progress?.isConnected) {
      showProgress({ stored: 1, total: 1 });
      progress.querySelector('.turn-offline-progress-value').textContent = '✓';
      finishProgress('is-ready', READY_TEXT, READY_VISIBLE_MS);
    }
    controlled = true;
  });

  function register() {
    nav.serviceWorker.register(`${scope}sw.js`, { scope })
      .then((value) => {
        registration = value;
      })
      .catch(() => {});
    nav.storage?.persist?.().catch?.(() => {});
  }

  // Look for a new release whenever TURN comes back to the foreground.
  documentRef.addEventListener('visibilitychange', () => {
    if (!documentRef.hidden) registration?.update().catch(() => {});
  });

  // After the app has started, so storing the release never competes with first paint.
  if (documentRef.readyState === 'complete') windowRef.setTimeout(register, REGISTER_DELAY_MS);
  else windowRef.addEventListener('load', () => windowRef.setTimeout(register, REGISTER_DELAY_MS), { once: true });

  // How ready offline play is: { release, files, failed } once stored, else null.
  async function status() {
    const ready = await nav.serviceWorker.ready;
    const worker = ready.active;
    if (!worker) return null;
    return new Promise((resolve) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = (event) => resolve(event.data);
      worker.postMessage({ type: 'turn-offline-status' }, [channel.port2]);
      windowRef.setTimeout(() => resolve(null), 3000);
    });
  }

  const api = Object.freeze({ scope, status, showUpdate });
  windowRef[INSTALL_KEY] = api;
  return api;
}
