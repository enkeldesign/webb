(() => {
  const upstreamFetch = window.fetch.bind(window);

  function replaceRequired(source, search, replacement, label) {
    const next = source.replace(search, replacement);
    if (next === source) console.warn(`TURN stability polish not applied: ${label}`);
    return next;
  }

  function patchGameSource(input) {
    let source = input;

    // Old records deliberately use null when their original timestamp is unknown.
    // Number(null) is 0, which otherwise turns them into January 1, 1970 labels.
    source = replaceRequired(
      source,
      `function spectateDateLabel(lap) {
  const hitAt = Number(lap?.hitAt);
  if (!Number.isFinite(hitAt)) return 'Previous record';`,
      `function spectateDateLabel(lap) {
  const rawHitAt = lap?.hitAt;
  const hitAt = rawHitAt == null ? NaN : Number(rawHitAt);
  if (!Number.isFinite(hitAt)) return 'Previous record';`,
      'null-safe spectator timestamp'
    );

    source = source.replaceAll(
      `    const otherHitAt = Number(other?.hitAt);
    return Number.isFinite(otherHitAt) && sameSpectateDate(new Date(otherHitAt), date);`,
      `    const rawOtherHitAt = other?.hitAt;
    const otherHitAt = rawOtherHitAt == null ? NaN : Number(rawOtherHitAt);
    return Number.isFinite(otherHitAt) && sameSpectateDate(new Date(otherHitAt), date);`
    );

    // Preserve the exact high-frame-rate handling that already feels good. Only split slower
    // frames into smaller physics steps so a 50 ms frame simulates roughly 50 ms of movement
    // instead of being truncated to the old 35 ms cap.
    source = replaceRequired(
      source,
      `renderer.setAnimationLoop((now) => {
  const dt = Math.min(0.035, Math.max(0.001, (now - state.lastFrame) / 1000));
  state.lastFrame = now;

  if (state.running) {
    updatePhysics(dt, now);
    updateScene(dt);
    updateHud();
  } else {
    const preview = samples[Math.floor((now * 0.012) % TRACK_SAMPLES)];
    playerCar.position.copy(preview.point);
    playerCar.position.y = 0.18;
    playerCar.rotation.y = Math.atan2(preview.tangent.x, preview.tangent.z) + Math.PI;
    animateWheels(playerCar, Math.sin(now * 0.001) * 0.3, 28, dt);
    camera.position.set(0, 110, 215);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0);
  }

  renderer.render(scene, camera);
});`,
      `const MAX_PHYSICS_STEP = 1 / 60;
const MAX_FRAME_CATCHUP = 0.12;

renderer.setAnimationLoop((now) => {
  const frameDt = Math.min(MAX_FRAME_CATCHUP, Math.max(0.001, (now - state.lastFrame) / 1000));
  const frameStart = now - frameDt * 1000;
  state.lastFrame = now;

  if (state.running) {
    const physicsSteps = Math.max(1, Math.ceil(frameDt / MAX_PHYSICS_STEP));
    const physicsDt = frameDt / physicsSteps;

    for (let step = 1; step <= physicsSteps; step += 1) {
      updatePhysics(physicsDt, frameStart + physicsDt * step * 1000);
    }

    updateScene(frameDt);
    updateHud();
  } else {
    const preview = samples[Math.floor((now * 0.012) % TRACK_SAMPLES)];
    playerCar.position.copy(preview.point);
    playerCar.position.y = 0.18;
    playerCar.rotation.y = Math.atan2(preview.tangent.x, preview.tangent.z) + Math.PI;
    animateWheels(playerCar, Math.sin(now * 0.001) * 0.3, 28, frameDt);
    camera.position.set(0, 110, 215);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0);
  }

  renderer.render(scene, camera);
});`,
      'frame-rate independent physics substeps'
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
      console.warn('TURN stability polish failed, using upstream game source.', error);
      return response;
    }
  };
})();