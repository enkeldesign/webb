const INTRO_CAMERA_PRESETS = Object.freeze({
  'midnight-city': Object.freeze({
    // Frame TURN Commons in the foreground and look diagonally into Downtown.
    // This avoids the empty centre produced by the generic small-track overview.
    position: Object.freeze([20, 150, 300]),
    target: Object.freeze([275, 3, 40]),
    fov: 52
  })
});

export function installTrackIntroCamera({ environment = globalThis } = {}) {
  const runtime = environment.__turnRuntime;
  const scene = runtime?.scene;
  const camera = runtime?.camera;
  const body = environment.document?.body;
  if (!scene || !camera || !body || runtime.__trackIntroCameraInstalled) return false;

  runtime.__trackIntroCameraInstalled = true;
  const previousOnBeforeRender = scene.onBeforeRender;
  let presetApplied = false;
  let previousFov = camera.fov;

  scene.onBeforeRender = function trackIntroCameraBeforeRender(...args) {
    previousOnBeforeRender?.apply(this, args);

    const trackId = environment.__turnGetTrackId?.()
      || runtime.activeTrack?.id
      || runtime.trackId;
    const preset = INTRO_CAMERA_PRESETS[trackId];
    const introVisible = body.classList.contains('turn-track-intro');

    if (!introVisible || !preset) {
      if (presetApplied) {
        camera.fov = previousFov;
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld(true);
        presetApplied = false;
      }
      return;
    }

    if (!presetApplied) {
      previousFov = camera.fov;
      presetApplied = true;
    }

    camera.position.set(...preset.position);
    camera.up.set(0, 1, 0);
    camera.lookAt(...preset.target);
    camera.fov = preset.fov;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
  };

  runtime.trackIntroCamera = Object.freeze({
    route: 'track-intro-camera-v1',
    presets: Object.freeze(Object.keys(INTRO_CAMERA_PRESETS))
  });
  return true;
}
