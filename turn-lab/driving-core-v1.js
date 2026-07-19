(() => {
  const upstreamFetch = window.fetch.bind(window);
  const motionModuleUrl = new URL('/turn-lab/input/motion.js', location.origin).href;
  const physicsModuleUrl = new URL('/turn-lab/vehicle/physics.js', location.origin).href;

  function replaceRequired(source, search, replacement, label) {
    const next = source.replace(search, replacement);
    if (next === source) console.warn(`TURN driving core bridge not applied: ${label}`);
    return next;
  }

  function patchGameSource(input) {
    let source = input;

    const threeImport = "import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.184.0/build/three.module.js';";
    source = replaceRequired(
      source,
      threeImport,
      `${threeImport}\nimport { motionPoseFromGravity as motionPoseFromGravityState, updateMotionInputState } from '${motionModuleUrl}';\nimport { updateVehiclePhysicsState } from '${physicsModuleUrl}';`,
      'driving module imports'
    );

    source = replaceRequired(
      source,
      /function motionPoseFromGravity\(event\) \{[\s\S]*?\n\}\n\nfunction handleMotion/,
      `function motionPoseFromGravity(event) {
  return motionPoseFromGravityState(event);
}

function handleMotion`,
      'module-backed gravity pose'
    );

    source = replaceRequired(
      source,
      /function updateMotionInput\(dt\) \{[\s\S]*?\n\}\n\nfunction beginTimedLap/,
      `function updateMotionInput(dt) {
  updateMotionInputState({
    state,
    dt,
    maxSteerRoll: MAX_STEER_ROLL
  });
}

function beginTimedLap`,
      'module-backed motion steering'
    );

    source = replaceRequired(
      source,
      /function updatePhysics\(dt, now\) \{[\s\S]*?\n\}\n\nfunction recordGhostFrame/,
      `function updatePhysics(dt, now) {
  const nearestAfter = updateVehiclePhysicsState({
    state,
    dt,
    updateMotionInput,
    findNearestTrack,
    getForward,
    getRight,
    trackWidth: TRACK_WIDTH,
    trackSampleCount: TRACK_SAMPLES,
    maxSpeed: MAX_SPEED,
    analogGas: globalThis.__turnAnalogGas || 0,
    boostActive: Boolean(globalThis.__turnBoostActive),
    driftHeld: Boolean(globalThis.__turnDriftHeld)
  });

  updateLapProgressState({
    state,
    nearestAfter,
    samples,
    trackWidth: TRACK_WIDTH,
    now,
    beginTimedLap,
    completeLap,
    recordGhostFrame
  });
}

function recordGhostFrame`,
      'module-backed vehicle physics'
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
      console.warn('TURN driving core bridge failed, using upstream game source.', error);
      return response;
    }
  };
})();
