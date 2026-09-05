import * as THREE from 'three';
import {
  getVehicleDefaultColor,
  getVehicleDefaultSecondaryColor
} from '../vehicle/catalog.js?revision=r243-mountain-1300';
import { createCarVisual } from '../vehicle/emergency-livery-models.js?build=20260823-r179';
import { configureRendererWideGamut } from '../vehicle/wide-gamut.js?revision=r157-display-p3';

const SHOWCASE_FRAME_INTERVAL_MS = 1000 / 30;
const REWARD_CARS = Object.freeze({
  'race-car': Object.freeze([
    Object.freeze({ carId: 'race', x: 0, targetLength: 6.2, yaw: Math.PI - 0.55 })
  ]),
  'future-racer': Object.freeze([
    Object.freeze({ carId: 'race-future', x: 0, targetLength: 6.4, yaw: Math.PI - 0.55 })
  ]),
  'emergency-pack': Object.freeze([
    Object.freeze({ carId: 'firetruck', x: -3.45, targetLength: 3.65, yaw: Math.PI - 0.38 }),
    Object.freeze({ carId: 'ambulance', x: 0, targetLength: 3.65, yaw: Math.PI - 0.55 }),
    Object.freeze({ carId: 'police', x: 3.45, targetLength: 3.65, yaw: Math.PI - 0.72 })
  ]),
  monster: Object.freeze([
    Object.freeze({ carId: 'monster-truck', x: 0, targetLength: 6.0, yaw: Math.PI - 0.55 })
  ]),
  'vintage-racer': Object.freeze([
    Object.freeze({ carId: 'vintage-racer', x: 0, targetLength: 6.0, yaw: Math.PI - 0.55 })
  ]),
  'rally-racer': Object.freeze([
    Object.freeze({ carId: 'toy-racer', x: 0, targetLength: 5.8, yaw: Math.PI - 0.55 })
  ])
});

function hasRewardModels(reward) {
  return Boolean(REWARD_CARS[reward?.id]);
}

export function createTrophyRoadShowcase() {
  let renderer = null;
  let scene = null;
  let camera = null;
  let stage = null;
  let activeHost = null;
  let activeGroup = null;
  let activeRewardId = '';
  let generation = 0;
  let running = false;
  let disposed = false;
  let resizeObserver = null;
  let lastRenderAt = -Infinity;
  const groups = new Map();
  const groupPromises = new Map();
  const clock = new THREE.Clock();

  function ensureRenderer() {
    if (renderer) return;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(34, 1, 0.1, 80);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x4c5963, 3.2));
    const key = new THREE.DirectionalLight(0xfff2c9, 4.1);
    key.position.set(-7, 10, 8);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x8ed8ff, 1.8);
    fill.position.set(8, 4, -5);
    scene.add(fill);
    stage = new THREE.Group();
    scene.add(stage);

    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    configureRendererWideGamut(renderer);
    const profileCap = Number(globalThis.__turnPerformanceProfile?.dprCap);
    const dprCap = Number.isFinite(profileCap) ? Math.min(1.35, profileCap) : 1.35;
    renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, dprCap));
    renderer.setClearColor(0x000000, 0);
    resizeObserver = new ResizeObserver(resize);
  }

  function attachRenderer(host) {
    ensureRenderer();
    if (activeHost === host && renderer.domElement.parentElement === host) return;
    resizeObserver?.disconnect();
    activeHost = host;
    activeHost.replaceChildren(renderer.domElement);
    resizeObserver?.observe(activeHost);
    resize();
  }

  function configureCamera(rewardId) {
    if (!camera) return;
    if (rewardId === 'emergency-pack') {
      camera.position.set(8.8, 5.2, 12.2);
      camera.lookAt(0, 1.05, 0);
    } else if (rewardId === 'monster') {
      camera.position.set(8.7, 5.8, 10.5);
      camera.lookAt(0, 1.55, 0);
    } else {
      camera.position.set(7.6, 4.7, 8.8);
      camera.lookAt(0, 1.05, 0);
    }
  }

  async function buildRewardGroup(rewardId) {
    if (groups.has(rewardId)) return groups.get(rewardId);
    if (groupPromises.has(rewardId)) return groupPromises.get(rewardId);
    const definitions = REWARD_CARS[rewardId];
    if (!definitions) return null;

    const request = (async () => {
      const group = new THREE.Group();
      const visuals = await Promise.all(definitions.map(async (definition, index) => {
        const visual = await createCarVisual({
          carId: definition.carId,
          color: getVehicleDefaultColor(definition.carId),
          secondaryColor: getVehicleDefaultSecondaryColor(definition.carId),
          targetLength: definition.targetLength,
          // Trophy Road cards are small, continuously rotating previews. The
          // contour shell would render every car mesh twice for little visual
          // benefit here, so keep the actual model only.
          outline: false
        });
        visual.position.set(definition.x, 0, 0);
        visual.rotation.y = definition.yaw;
        visual.userData.turnRewardBaseX = definition.x;
        visual.userData.turnRewardBaseYaw = definition.yaw;
        visual.userData.turnRewardPhase = index * 1.7;
        group.add(visual);
        return visual;
      }));
      group.userData.turnRewardVisuals = visuals;
      groups.set(rewardId, group);
      return group;
    })();

    groupPromises.set(rewardId, request);
    try {
      return await request;
    } finally {
      groupPromises.delete(rewardId);
    }
  }

  async function show(reward, host) {
    if (disposed || !host || !hasRewardModels(reward)) {
      clear();
      return false;
    }

    const request = ++generation;
    ensureRenderer();
    activeRewardId = reward.id;
    configureCamera(reward.id);
    host.dataset.trophyRewardModel = reward.id;
    host.setAttribute('aria-hidden', 'true');
    host.classList.add('is-loading');

    try {
      const group = await buildRewardGroup(reward.id);
      if (disposed || request !== generation || !group) return false;

      if (activeGroup && activeGroup.parent === stage) stage.remove(activeGroup);
      activeGroup = group;
      stage.add(group);
      attachRenderer(host);
      host.classList.remove('is-loading');
      resize();
      resume();
      return true;
    } catch (error) {
      if (request === generation) host.classList.remove('is-loading');
      console.warn(`TURN: could not load the ${reward.shortTitle} Trophy Road preview.`, error);
      return false;
    }
  }

  function resize() {
    if (!renderer || !camera || !activeHost?.isConnected) return;
    const rect = activeHost.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
    renderer.setSize(Math.round(rect.width), Math.round(rect.height), false);
  }

  function render(now) {
    if (!running || disposed || !renderer || !scene || !camera) return;
    if (now - lastRenderAt < SHOWCASE_FRAME_INTERVAL_MS) return;
    lastRenderAt = now;
    const elapsed = clock.getElapsedTime();
    const visuals = activeGroup?.userData?.turnRewardVisuals || [];
    for (const visual of visuals) {
      const phase = visual.userData.turnRewardPhase || 0;
      visual.rotation.y = (visual.userData.turnRewardBaseYaw || 0) + elapsed * 0.34;
      visual.position.x = visual.userData.turnRewardBaseX || 0;
      visual.position.y = Math.sin(elapsed * 1.8 + phase) * 0.055;
    }
    renderer.render(scene, camera);
  }

  function resume() {
    if (running || disposed || !renderer || !activeGroup) return;
    lastRenderAt = -Infinity;
    running = true;
    renderer.setAnimationLoop(render);
  }

  function pause() {
    running = false;
    renderer?.setAnimationLoop(null);
  }

  function clear() {
    generation += 1;
    pause();
    activeRewardId = '';
    if (activeGroup && activeGroup.parent === stage) stage.remove(activeGroup);
    activeGroup = null;
    resizeObserver?.disconnect();
    if (activeHost) {
      delete activeHost.dataset.trophyRewardModel;
      activeHost.classList.remove('is-loading');
    }
    renderer?.domElement?.remove();
    activeHost = null;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    clear();
    resizeObserver?.disconnect();
    renderer?.dispose();
    renderer?.forceContextLoss?.();
    renderer?.domElement?.remove();
    renderer = null;
    activeHost = null;
    groups.clear();
    groupPromises.clear();
  }

  return Object.freeze({
    show,
    clear,
    pause,
    resume,
    resize,
    dispose,
    get activeRewardId() {
      return activeRewardId;
    }
  });
}
