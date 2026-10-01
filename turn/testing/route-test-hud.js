// Admin route test HUD (#909 step 1): the SWOOSH segments computed from the track's
// centreline, live while racing, so the geometry can be checked against the road before
// any sound changes. Admin-unlocked profiles only, switched in SETTINGS; it stays visible
// above blank screen mode and is hidden from assistive technology (no per-frame
// announcements). It reads the race state and never changes it.
import { computeRouteGeometry, upcomingRouteSegments } from '../audio/route-geometry.js';

const ADMIN_UNLOCK_MARKER = 'turn-admin-unlock-v1';
const HUD_SETTING_KEY = 'turn-route-test-hud-v1';
const UPDATE_INTERVAL_MS = 100;
const ROWS = 4;

function storage() {
  try {
    return globalThis.localStorage || null;
  } catch (_) {
    return null;
  }
}

function isAdminProfile() {
  try {
    return Boolean(storage()?.getItem(ADMIN_UNLOCK_MARKER));
  } catch (_) {
    return false;
  }
}

function loadEnabled() {
  try {
    return storage()?.getItem(HUD_SETTING_KEY) === '1';
  } catch (_) {
    return false;
  }
}

function saveEnabled(enabled) {
  try {
    if (enabled) storage()?.setItem(HUD_SETTING_KEY, '1');
    else storage()?.removeItem(HUD_SETTING_KEY);
    return true;
  } catch (_) {
    return false;
  }
}

function installStyles() {
  if (document.querySelector('#turnRouteTestHudStyles')) return;
  const style = document.createElement('style');
  style.id = 'turnRouteTestHudStyles';
  style.textContent = `
    .turn-route-test-hud {
      position: fixed;
      left: max(12px, env(safe-area-inset-left));
      top: 50%;
      z-index: 2147483003;
      width: max-content;
      max-width: calc(100vw - 24px);
      overflow: hidden;
      padding: 8px 10px;
      border-radius: 10px;
      background: rgba(8, 9, 10, 0.82);
      color: #fffdf6;
      font: 600 11px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace;
      white-space: pre;
      pointer-events: none;
      transform: translateY(-50%);
    }
    .turn-route-test-hud[hidden] { display: none; }
    .turn-route-test-hud .is-right { color: #8ce99a; }
    .turn-route-test-hud .is-left { color: #ffd43b; }
    .turn-route-test-hud .is-dim { color: #a6a7ab; }`;
  document.head.append(style);
}

function routeFor(runtime) {
  const samples = runtime?.samples;
  if (!Array.isArray(samples) || samples.length < 8) return null;
  const trackId = String(runtime.trackId || runtime.state?.trackId || globalThis.__turnGetTrackId?.() || '');
  const cache = routeFor.cache;
  if (cache && cache.samples === samples && cache.trackId === trackId) return cache.route;
  routeFor.cache = { samples, trackId, route: computeRouteGeometry(samples) };
  return routeFor.cache.route;
}

const metres = (value) => `${Math.round(value)} m`;
const radius = (value) => (Number.isFinite(value) && value < 10000 ? `r${Math.round(value)}` : 'r∞');

function render(hud, runtime) {
  const state = runtime?.state;
  const route = routeFor(runtime);
  if (!state || !route) {
    hud.textContent = 'ROUTE · waiting for the track';
    return;
  }
  const index = Math.max(0, Math.round(Number(state.nearestTrackIndex) || 0));
  const distance = index * route.sampleSpacing;
  const speed = Math.max(0, Number(state.speed) || 0);
  const tuning = route.tuning;
  const header = document.createElement('span');
  header.textContent = `ROUTE ${route.bends.length} bends · ${route.segments.length} swooshes · ${metres(route.trackLength)}\n`;
  const rows = upcomingRouteSegments(route, distance, ROWS).map(({ segment, ahead }) => {
    const row = document.createElement('span');
    row.className = segment.direction > 0 ? 'is-right' : 'is-left';
    const seconds = speed > 1 ? `${(ahead / speed).toFixed(1)} s` : '–';
    const part = segment.parts > 1 ? ` ${segment.part}/${segment.parts}·${Math.round(segment.bendAngleDegrees)}°` : '';
    row.textContent = `${segment.side === 'right' ? 'R' : 'L'} ${String(Math.round(segment.angleDegrees)).padStart(2)}°${part.padEnd(9)}`
      + ` ${radius(segment.peakRadius).padStart(5)} peak ${radius(segment.averageRadius).padStart(5)} avg ${metres(segment.length).padStart(5)}`
      + `  in ${metres(ahead).padStart(6)} ${seconds.padStart(6)}\n`;
    return row;
  });
  const footer = document.createElement('span');
  footer.className = 'is-dim';
  footer.textContent = `turns below r${Math.round(1 / tuning.turningCurvature)} · ignores <${tuning.noiseAngleDegrees}°`
    + ` · relief ${tuning.reliefRatio} · ≤${tuning.maxSegmentDegrees}°`;
  hud.replaceChildren(header, ...rows, footer);
}

function installHud() {
  installStyles();
  const hud = document.createElement('div');
  hud.className = 'turn-route-test-hud';
  hud.setAttribute('aria-hidden', 'true');
  hud.hidden = true;
  document.body.append(hud);

  let timer = null;
  const sync = () => {
    const runtime = globalThis.__turnRuntime;
    const racing = runtime?.state?.running === true && document.documentElement.classList.contains('turn-home-open') === false;
    const show = loadEnabled() && racing;
    hud.hidden = !show;
    if (show) render(hud, runtime);
  };
  const start = () => {
    if (timer || !loadEnabled()) return;
    timer = setInterval(sync, UPDATE_INTERVAL_MS);
    sync();
  };
  const stop = () => {
    if (timer) clearInterval(timer);
    timer = null;
    hud.hidden = true;
  };
  return { start, stop, sync };
}

function installSetting(hud) {
  const dialog = document.querySelector('.m8-settings-dialog');
  const list = dialog?.querySelector('.m8-settings-list');
  if (!dialog || !list) return false;
  if (dialog.querySelector('[data-turn-route-test-hud-setting]')) return true;

  const section = document.createElement('section');
  section.className = 'm8-setting-card m8-route-test-hud-setting';
  section.dataset.turnRouteTestHudSetting = '';
  section.setAttribute('aria-labelledby', 'm8RouteTestHudTitle');
  section.innerHTML = `
    <h3 id="m8RouteTestHudTitle">Admin</h3>
    <label class="m8-toggle-row">
      <input id="m8RouteTestHud" type="checkbox" aria-describedby="m8RouteTestHudDescription">
      <span>
        <strong>ROUTE TEST HUD</strong>
        <small id="m8RouteTestHudDescription">Shows the upcoming SWOOSH bends while racing, also with a blank screen</small>
      </span>
    </label>`;
  list.append(section);

  const toggle = section.querySelector('#m8RouteTestHud');
  toggle.checked = loadEnabled();
  toggle.addEventListener('change', () => {
    if (!saveEnabled(toggle.checked)) {
      toggle.checked = !toggle.checked;
      return;
    }
    if (toggle.checked) hud.start();
    else hud.stop();
  });
  dialog.addEventListener('toggle', () => {
    toggle.checked = loadEnabled();
  });
  return true;
}

function install() {
  if (!isAdminProfile() || !document.body) return;
  const hud = installHud();
  hud.start();
  if (installSetting(hud)) return;
  const observer = new MutationObserver(() => {
    if (installSetting(hud)) observer.disconnect();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
else install();
