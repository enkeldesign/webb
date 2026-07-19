(() => {
  const upstreamFetch = window.fetch.bind(window);
  const buildKey = globalThis.__TURN_BUILD__?.cacheKey || '';

  function moduleUrl(path) {
    const url = new URL(path, location.origin);
    if (buildKey) url.searchParams.set('build', buildKey);
    return url.href;
  }

  const cameraModuleUrl = moduleUrl('/turn-lab/render/camera.js');
  const hudModuleUrl = moduleUrl('/turn-lab/ui/hud.js');

  function replaceRequired(source, search, replacement, label) {
    const next = source.replace(search, replacement);
    if (next === source) console.warn(`TURN render core bridge not applied: ${label}`);
    return next;
  }

  function patchGameSource(input) {
    let source = input;
    const threeImport = "import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.184.0/build/three.module.js';";

    source = replaceRequired(
      source,
      threeImport,
      `${threeImport}\nimport { updateRaceCameraState } from '${cameraModuleUrl}';\nimport { updateHudState } from '${hudModuleUrl}';`,
      'render module imports'
    );

    source = replaceRequired(
      source,
      /function updateScene\(dt\) \{[\s\S]*?\n\}\n\nfunction updateSkids\(\) \{/,
      `function updateScene(dt) {
  if (globalThis.__turnRuntime?.runSceneOverride?.(dt)) return;

  placePlayerCar(dt);
  placeCompetitorCars(dt);
  updateDriveEffects(dt);
  updateRaceCameraState({
    state,
    camera,
    cameraPosition,
    cameraTarget,
    getForward,
    getRight,
    maxSpeed: MAX_SPEED,
    dt
  });
  updateSkids();
}

function updateSkids() {`,
      'module-backed race camera'
    );

    source = replaceRequired(
      source,
      /function updateHud\(\) \{[\s\S]*?\n\}\n\nfunction showMessage/,
      `function updateHud() {
  updateHudState({
    state,
    speedEl,
    lapEl,
    lapTimeEl,
    bestTimeEl,
    tiltNeedle,
    tiltValue,
    mapCanvas,
    mapCtx,
    samples,
    trackSampleCount: TRACK_SAMPLES,
    replayFrameAt: lapFrameAt,
    findNearestTrack,
    setRacePosition: globalThis.__turnSetRacePosition
  });
}

function showMessage`,
      'module-backed HUD and minimap'
    );

    source = replaceRequired(
      source,
      `const turnRuntime = {
  state,
  samples,
  camera,`,
      `const turnRuntime = {
  state,
  samples,
  scene,
  world,
  renderer,
  sun,
  hemi,
  trackWidth: TRACK_WIDTH,
  maxSpeed: MAX_SPEED,
  trackSampleCount: TRACK_SAMPLES,
  findNearestTrack,
  getForward,
  getRight,
  camera,`,
      'render and world runtime references'
    );

    return source;
  }

  window.fetch = async (input, init) => {
    const response = await upstreamFetch(input, init);
    try {
      const rawUrl = typeof input === 'string' ? input : input?.url;
      const url = new URL(rawUrl, location.href);
      if (!url.pathname.endsWith('/turn/game.js')) return response;

      const source = await response.text();
      const patched = patchGameSource(source);
      return new Response(patched, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      });
    } catch (error) {
      console.warn('TURN render core bridge failed, using upstream game source.', error);
      return response;
    }
  };
})();
