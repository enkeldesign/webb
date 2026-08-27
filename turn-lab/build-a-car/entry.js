import { BUILD_A_CAR_EXPERIMENT_ID, getPart } from './parts-manifest.js';
import { openBuildACar } from './builder-modal.js';
import { loadCustomCar, saveCustomCar } from './storage.js';

const STYLE_ID = 'turn-lab-build-a-car-style';
const installedScreens = new WeakSet();

installStylesheet();
installBuildACarExperiment();

globalThis.__TURN_LAB_FEATURES__ = Object.freeze({
  ...(globalThis.__TURN_LAB_FEATURES__ || {}),
  buildACar: BUILD_A_CAR_EXPERIMENT_ID
});

export function installBuildACarExperiment(root = document.body) {
  const sync = () => {
    const screen = root.querySelector?.('.lot-screen');
    if (!screen || installedScreens.has(screen)) return;
    if (decorateLot(screen)) installedScreens.add(screen);
  };
  const observer = new MutationObserver((mutations) => {
    if (!mutations.some((mutation) => mutation.addedNodes.length || mutation.removedNodes.length)) return;
    sync();
  });
  observer.observe(root, { childList: true, subtree: true });
  sync();

  const api = Object.freeze({
    experimentId: BUILD_A_CAR_EXPERIMENT_ID,
    open() {
      openBuilder(null, null);
    },
    load: loadCustomCar
  });
  globalThis.__turnLabBuildACar = api;
  return () => observer.disconnect();
}

function decorateLot(screen) {
  if (screen.querySelector('.build-a-car-lot-entry')) return true;
  const actions = screen.querySelector('.lot-card-actions') || screen.querySelector('.lot-card');
  const raceButton = screen.querySelector('.lot-race');
  if (!actions || !raceButton) return false;

  const wrapper = document.createElement('section');
  wrapper.className = 'build-a-car-lot-entry';
  wrapper.setAttribute('aria-label', 'BUILD-A-CAR prototype');
  wrapper.innerHTML = `
    <span>LAB PROTOTYPE</span>
    <button type="button">BUILD-A-CAR</button>
    <p></p>
  `;
  actions.insertBefore(wrapper, raceButton);

  const button = wrapper.querySelector('button');
  const summary = wrapper.querySelector('p');
  syncSavedState();
  button.addEventListener('click', () => openBuilder(button, syncSavedState));

  function syncSavedState() {
    const saved = loadCustomCar();
    button.textContent = saved ? 'EDIT MY CAR' : 'BUILD-A-CAR';
    if (!saved) {
      summary.textContent = 'Assemble one experimental custom-car slot.';
      return;
    }
    const body = getPart('body', saved.parts.body)?.label || 'CUSTOM';
    const cabin = getPart('cabin', saved.parts.cabin)?.label || 'CAR';
    summary.textContent = `${saved.name} · ${body} + ${cabin} · saved in TURN LAB`;
  }

  return true;
}

function openBuilder(trigger, afterSave) {
  openBuildACar({
    initialBuild: loadCustomCar(),
    onSave(build) {
      const saved = saveCustomCar(build);
      afterSave?.(saved);
      trigger?.dispatchEvent?.(new CustomEvent('turn-lab:custom-car-saved', {
        bubbles: true,
        detail: { buildHash: saved.buildHash }
      }));
    }
  });
}

function installStylesheet() {
  if (document.getElementById(STYLE_ID)) return;
  const url = new URL('/turn-lab/build-a-car/builder.css', globalThis.location?.href || 'https://enkel.design/turn-lab/');
  const buildKey = globalThis.__TURN_BUILD__?.cacheKey;
  if (buildKey) url.searchParams.set('build', buildKey);
  const link = document.createElement('link');
  link.id = STYLE_ID;
  link.rel = 'stylesheet';
  link.href = url.href;
  document.head.appendChild(link);
}
