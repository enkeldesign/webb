// Startup owns required offline preparation and updates, before the game graph loads.
// Open games keep their release; a later launch adopts the complete newer one.
const SCOPE = '/turn/';
const STATUS = `${SCOPE}__offline-status`;
const never = () => new Promise(() => {});
const failure = (code) => Object.assign(new Error(`TURN startup: ${code}`), { code });
const revision = (release) => Number(release?.split('-r')[1]) || 0;

async function bounded(promise, ms, code = 'preparation') {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(failure(code)), ms);
    })]);
  } finally { clearTimeout(timer); }
}

export function installOffline({ windowRef = globalThis, documentRef = globalThis.document, startup } = {}) {
  if (windowRef.__turnOffline) return windowRef.__turnOffline;
  const nav = windowRef.navigator;
  const local = /^(?:localhost|127\.0\.0\.1|\[::1\])$/.test(windowRef.location?.hostname || '');
  let optedIn = !nav?.webdriver && !local;
  try { optedIn ||= windowRef.localStorage.getItem('turn-offline-under-test') === '1'; } catch { /* Storage blocked. */ }
  if (!nav?.serviceWorker || !windowRef.isSecureContext || !optedIn) return null;
  const release = windowRef.__TURN_BUILD__?.cacheKey;
  const startupFailure = windowRef.__turnStartFailed;
  let registration;
  let preparing = true;
  let recovering = false;
  let preparingFirst = false;
  let progressNode;
  let preparationFailure;
  let startupFailuresSuspended = false;
  let startupRuntimeFailure;

  // Registration/update failures are handled explicitly by prepare() and may be expected
  // while a complete stored release is still perfectly playable (for example when the
  // origin answers with 5xx). Do not let those browser-level failures look like a broken
  // game module graph and start a recovery reload.
  function suspendStartupFailures() {
    if (!startupFailure || startupFailuresSuspended) return;
    windowRef.removeEventListener('error', startupFailure);
    windowRef.removeEventListener('unhandledrejection', startupFailure);
    startupFailuresSuspended = true;
  }

  function resumeStartupFailures() {
    if (!startupFailure || !startupFailuresSuspended) return;
    // Browsers may surface failed automatic service-worker update checks as generic
    // resource errors after prepare() has already selected a complete stored release.
    // Those are not game bootstrap failures. Startup module tags have their own explicit
    // error hooks; this window listener is only for actual JavaScript runtime errors.
    startupRuntimeFailure = (event) => {
      if (event?.type === 'error') {
        const runtimeError = typeof windowRef.ErrorEvent === 'function' && event instanceof windowRef.ErrorEvent;
        if (!runtimeError) return;
      }
      startupFailure(event);
    };
    windowRef.addEventListener('error', startupRuntimeFailure);
    windowRef.addEventListener('unhandledrejection', startupFailure);
    documentRef.addEventListener('turn:home-ready', () => {
      if (startupRuntimeFailure) windowRef.removeEventListener('error', startupRuntimeFailure);
      startupRuntimeFailure = null;
    }, { once: true });
    startupFailuresSuspended = false;
  }

  async function completeReleases() {
    const releases = [];
    for (const key of await windowRef.caches.keys()) {
      if (!/^turn-precache-\d{8}-r\d+$/.test(key)) continue;
      const cache = await windowRef.caches.open(key);
      const response = await cache.match(STATUS);
      if (!response) continue;
      const value = await response.json();
      const entry = await cache.match(`${SCOPE}index.html`);
      // A completion marker alone is not enough after partial storage eviction.
      if (value.failed || !entry || (await cache.keys()).length < value.files + 1) {
        await cache.delete(STATUS); // Withdraw a false completion claim, retain every usable file.
        continue;
      }
      if (!(await entry.text()).includes(`cacheKey: '${value.release}'`)) continue;
      releases.push(value);
    }
    return releases.sort((a, b) => revision(b.release) - revision(a.release));
  }

  async function status(worker = nav.serviceWorker.controller || registration?.active) {
    if (!worker) return null;
    const channel = new MessageChannel();
    try {
      return await bounded(new Promise((resolve) => {
        channel.port1.onmessage = (event) => resolve(event.data);
        worker.postMessage({ type: 'turn-offline-status' }, [channel.port2]);
      }), 3000);
    } catch { return null; }
    finally { channel.port1.close(); channel.port2.close(); }
  }

  function progress(data) {
    if (!preparing) return;
    if (data.failed) { preparationFailure = data.reason; return; }
    startup.setState(recovering ? 'recover' : preparingFirst ? 'install' : 'update');
    if (!progressNode) {
      progressNode = documentRef.createElement('progress');
      progressNode.className = 'turn-startup-progress';
      progressNode.setAttribute('aria-label', 'Getting TURN ready');
      progressNode.style.cssText = 'display:block;width:100%;accent-color:var(--turn-action-information)';
      documentRef.querySelector('#installGate .install-card')?.append(progressNode);
    }
    progressNode.max = data.total;
    progressNode.value = data.stored;
    progressNode.setAttribute('aria-valuetext', `${data.stored} of ${data.total} files ready`);
  }
  nav.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'turn-release-query') event.ports?.[0]?.postMessage({ release });
    if (event.data?.type === 'turn-offline-progress') progress(event.data);
  });
  nav.serviceWorker.startMessages?.();

  async function install() {
    // Registration/update requests bypass the controlling worker. No unregister or
    // cache purge: an interrupted update must leave the last complete release intact.
    registration = await bounded(nav.serviceWorker.register(`${SCOPE}sw.js`, {
      scope: SCOPE, updateViaCache: 'none'
    }), 10000);
    if (!registration.installing && !registration.waiting) await bounded(registration.update(), 4000);
    const worker = registration.installing || registration.waiting;
    if (worker) {
      startup.setState(recovering ? 'recover' : preparingFirst ? 'install' : 'update');
      startup.arm(150000);
      await bounded(new Promise((resolve, reject) => {
        const changed = () => {
          if (worker.state === 'installed') worker.postMessage({ type: 'turn-activate-complete' });
          if (worker.state === 'activated' || worker.state === 'redundant') {
            worker.removeEventListener('statechange', changed);
            if (worker.state === 'activated') resolve();
            else reject(failure(preparationFailure || (nav.onLine === false ? 'offline' : 'preparation')));
          }
        };
        worker.addEventListener('statechange', changed);
        changed();
      }), 120000);
    }
    if (nav.serviceWorker.controller !== registration.active) {
      await bounded(new Promise((resolve) => {
        const changed = () => {
          if (nav.serviceWorker.controller === registration.active) {
            nav.serviceWorker.removeEventListener('controllerchange', changed);
            resolve();
          }
        };
        nav.serviceWorker.addEventListener('controllerchange', changed);
        changed();
      }), 4000);
    }
  }

  async function repairIncomplete() {
    const active = await status();
    if (!active?.coherent || !active.failed) return;
    const wasRecovering = recovering;
    recovering = true;
    startup.setState('recover');
    startup.arm(150000);
    const channel = new MessageChannel();
    try {
      await bounded(new Promise((resolve) => {
        channel.port1.onmessage = () => resolve();
        nav.serviceWorker.controller.postMessage({ type: 'turn-repair-release' }, [channel.port2]);
      }), 120000);
    } finally { recovering = wasRecovering; channel.port1.close(); channel.port2.close(); }
  }

  async function switchRelease(target) {
    const current = await status();
    // Old workers do not understand release-pinned navigation. Never loop through
    // their network-first document cache expecting a different outcome.
    if (!current?.coherent) throw failure('preparation');
    const url = new URL(windowRef.location.href);
    if (url.searchParams.get('turn-release') === target && target !== release) throw failure('bootstrap');
    startup.setState('update');
    url.searchParams.set('turn-release', target);
    windowRef.location.replace(url);
    return never();
  }

  async function prepare() {
    suspendStartupFailures();
    try {
      let complete;
      try { complete = await completeReleases(); }
      catch { throw failure('storage'); }
      preparingFirst = complete.length === 0 && !nav.serviceWorker.controller;
      startup.setState(preparingFirst ? 'install' : 'normal');
      const url = new URL(windowRef.location.href);
      const recoveryTarget = url.searchParams.get('turn-recovery') && url.searchParams.get('turn-release');
      if (recoveryTarget === release && complete.some((value) => value.release === release)) {
        preparing = false;
        startup.arm();
        return;
      }
      let problem;
      if (nav.onLine !== false) {
        for (let attempt = 0; attempt < 2; attempt += 1) {
          try { await install(); problem = null; break; }
          catch (error) { problem = error; }
        }
        await repairIncomplete().catch(() => {});
        complete = await completeReleases();
      }
      if (!complete.length) throw problem || failure(nav.onLine === false ? 'offline' : 'preparation');
      if (complete[0].release !== release) return switchRelease(complete[0].release);
      preparing = false;
      progressNode?.remove();
      startup.setState('normal');
      startup.arm();
      nav.serviceWorker.controller?.postMessage({ type: 'turn-page-release', release });
      nav.storage?.persist?.().catch?.(() => {});
    } finally {
      resumeStartupFailures();
    }
  }

  async function recover(attempts) {
    preparing = true;
    recovering = true;
    // A failed module is sticky in the document's module map. Repair the worker,
    // then create a fresh document pinned to a complete release, with bounded tries.
    try { if (nav.onLine !== false) await install(); } catch { /* Use a kept release. */ }
    await completeReleases(); // Invalidate incomplete markers before requesting repair.
    await repairIncomplete().catch(() => {});
    const complete = await completeReleases();
    if (!complete.length) throw failure(nav.onLine === false ? 'offline' : 'preparation');
    const target = attempts ? complete.find((value) => value.release !== release) : complete[0];
    if (!target) throw failure('bootstrap');
    preparing = false;
    if (!(await status())?.coherent) throw failure('preparation');
    return target.release;
  }

  const api = Object.freeze({ scope: SCOPE, status, prepare, recover });
  windowRef.__turnOffline = api;
  return api;
}
