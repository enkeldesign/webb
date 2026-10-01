// Admin route test HUD (#909 step 1): the SWOOSH segments computed from the track's
// centreline, live while racing, so the geometry can be checked against the road before
// any sound changes. Admin-unlocked profiles only, switched in SETTINGS; it stays visible
// above blank screen mode and is hidden from assistive technology (no per-frame
// announcements). It reads the race state and never changes it.
import { computeRouteGeometry, upcomingRouteSegments } from '../audio/route-geometry.js';

const ADMIN_UNLOCK_MARKER = 'turn-admin-unlock-v1';
const HUD_SETTING_KEY = 'turn-route-test-hud-v1';
const UPDATE_INTERVAL_MS = 100;

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
      left: 50%;
      top: var(--turn-route-hud-top, max(96px, env(safe-area-inset-top)));
      z-index: 2147483003;
      width: max-content;
      max-width: calc(100vw - 24px);
      padding: 8px 12px;
      border-radius: 12px;
      background: rgba(8, 9, 10, 0.82);
      color: #fffdf6;
      font: 700 12px/1.35 ui-monospace, SFMono-Regular, Menlo, monospace;
      text-align: center;
      pointer-events: none;
      transform: translateX(-50%);
    }
    .turn-route-test-hud .turn-route-hud-main { display: block; font-size: clamp(14px, 4.6vw, 20px); line-height: 1.2; white-space: nowrap; }
    .turn-route-test-hud .turn-route-hud-then { display: block; margin-top: 3px; white-space: nowrap; }
    .turn-route-test-hud .turn-route-hud-tuning { display: block; margin-top: 3px; font-size: 10px; white-space: normal; }
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

// Tightness words for reading the HUD at speed, from the tightest sustained radius.
// Display only: how tightness sounds is what the listening test decides.
const TIGHT_RADIUS = 40;
const MEDIUM_RADIUS = 120;
const tightnessWord = (segment) => (segment.peakRadius < TIGHT_RADIUS ? 'tight' : segment.peakRadius < MEDIUM_RADIUS ? 'medium' : 'gentle');
const sideWord = (segment) => (segment.direction > 0 ? 'RIGHT' : 'LEFT');
const arrow = (segment) => (segment.direction > 0 ? '→' : '←');
const part = (segment) => (segment.parts > 1 ? ` ${segment.part}/${segment.parts}` : '');

function span(className, text, tone = '') {
  const element = document.createElement('span');
  element.className = [className, tone].filter(Boolean).join(' ');
  element.textContent = text;
  return element;
}

function currentSegment(route, distance) {
  const length = route.trackLength;
  return route.segments.find((segment) => (((distance - segment.startDistance) % length) + length) % length < segment.length) || null;
}

// NOW while the car is inside a swoosh's road, NEXT before it, then the two after.
function render(hud, runtime) {
  const state = runtime?.state;
  const route = routeFor(runtime);
  if (!state || !route) {
    hud.replaceChildren(span('turn-route-hud-main', 'ROUTE · waiting for the track'));
    return;
  }
  const index = Math.max(0, Math.round(Number(state.nearestTrackIndex) || 0));
  const distance = index * route.sampleSpacing;
  const speed = Math.max(0, Number(state.speed) || 0);
  const now = currentSegment(route, distance);
  const ahead = upcomingRouteSegments(route, distance, 3).filter(({ segment }) => segment !== now);
  const tone = (segment) => (segment.direction > 0 ? 'is-right' : 'is-left');
  const main = now
    ? span('turn-route-hud-main', `NOW ${arrow(now)} ${sideWord(now)} ${Math.round(now.angleDegrees)}°${part(now)} · ${tightnessWord(now)}`, tone(now))
    : ahead[0]
      ? span('turn-route-hud-main', `NEXT ${arrow(ahead[0].segment)} ${sideWord(ahead[0].segment)} ${Math.round(ahead[0].segment.angleDegrees)}°${part(ahead[0].segment)} · ${tightnessWord(ahead[0].segment)} · ${speed > 1 ? `${(ahead[0].ahead / speed).toFixed(1)} s` : `${Math.round(ahead[0].ahead)} m`}`, tone(ahead[0].segment))
      : span('turn-route-hud-main', 'NO BENDS');
  const later = (now ? ahead : ahead.slice(1)).slice(0, 2)
    .map(({ segment }) => `${segment.direction > 0 ? 'R' : 'L'} ${Math.round(segment.angleDegrees)}°${part(segment)} ${tightnessWord(segment)}`);
  const tuning = route.tuning;
  hud.replaceChildren(
    main,
    span('turn-route-hud-then', later.length ? `then ${later.join(' · ')}` : ' ', 'is-dim'),
    span('turn-route-hud-tuning', `${route.segments.length} swooshes · tight <r${TIGHT_RADIUS} · medium <r${MEDIUM_RADIUS}`
      + ` · turns below r${Math.round(1 / tuning.turningCurvature)} · ignores <${tuning.noiseAngleDegrees}°`, 'is-dim')
  );
}

// Just below the race HUD's top bar, wherever the layout has put it.
function place(hud) {
  const bar = document.querySelector('#hud .topbar');
  const bottom = bar?.getBoundingClientRect().bottom || 0;
  hud.style.setProperty('--turn-route-hud-top', bottom > 0 ? `${Math.round(bottom + 8)}px` : '');
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
    if (show) {
      place(hud);
      render(hud, runtime);
    }
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
