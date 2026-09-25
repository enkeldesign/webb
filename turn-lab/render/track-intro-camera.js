const INTRO_CAMERA_PRESETS = Object.freeze({
  'midnight-city': Object.freeze({
    position: Object.freeze([20, 150, 300]),
    target: Object.freeze([275, 3, 40]),
    fov: 52
  }),
  mountain: Object.freeze({
    // DEAD CANYON: restored wide route-and-wall composition.
    position: Object.freeze([10, 205, -770]),
    target: Object.freeze([430, 48, -10]),
    fov: 66
  }),
  cliffside: Object.freeze({
    // BEACHFRONT: island postcard with the course, hotel core and surrounding ocean.
    position: Object.freeze([15, 330, -610]),
    target: Object.freeze([20, 0, -5]),
    fov: 58
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
    route: 'lab-dual-track-postcards',
    presets: Object.freeze(Object.keys(INTRO_CAMERA_PRESETS))
  });
  return true;
}
