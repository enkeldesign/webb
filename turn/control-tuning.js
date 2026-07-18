(() => {
  const upstreamFetch = window.fetch.bind(window);

  window.fetch = async (input, init) => {
    const response = await upstreamFetch(input, init);

    try {
      const rawUrl = typeof input === 'string' ? input : input?.url;
      const url = new URL(rawUrl, location.href);
      if (!url.pathname.endsWith('/turn/game.js')) return response;

      const source = await response.text();
      const search = `  const steeringRoll = normalizeAngle(state.roll - state.neutralRoll);
  const steeringDeadzone = THREE.MathUtils.degToRad(1.4);
  const steeringMagnitude = Math.abs(steeringRoll);
  let desiredSteering = 0;

  if (steeringMagnitude > steeringDeadzone) {
    const availableRoll = Math.max(0.001, MAX_STEER_ROLL - steeringDeadzone);
    const linearSteer = THREE.MathUtils.clamp(
      (steeringMagnitude - steeringDeadzone) / availableRoll,
      0,
      1
    );
    desiredSteering = -Math.sign(steeringRoll) * Math.pow(linearSteer, 0.78);
  }

  const steeringResponse = 1 - Math.exp(-dt * 7.5);
  state.steering = THREE.MathUtils.lerp(state.steering, desiredSteering, steeringResponse);`;

      const replacement = `  const steeringRoll = normalizeAngle(state.roll - state.neutralRoll);
  const steeringMagnitude = Math.abs(steeringRoll);
  const steeringEnterThreshold = THREE.MathUtils.degToRad(2.2);
  const steeringExitThreshold = THREE.MathUtils.degToRad(0.9);

  state.steeringEngaged ??= false;

  if (state.steeringEngaged) {
    if (steeringMagnitude < steeringExitThreshold) state.steeringEngaged = false;
  } else if (steeringMagnitude > steeringEnterThreshold) {
    state.steeringEngaged = true;
  }

  let desiredSteering = 0;
  if (state.steeringEngaged) {
    const availableRoll = Math.max(0.001, MAX_STEER_ROLL - steeringExitThreshold);
    const linearSteer = THREE.MathUtils.clamp(
      (steeringMagnitude - steeringExitThreshold) / availableRoll,
      0,
      1
    );
    const easedSteer = linearSteer * linearSteer * (3 - 2 * linearSteer);
    desiredSteering = -Math.sign(steeringRoll) * easedSteer;
  }

  const steeringResponseRate = state.steeringEngaged ? 8.5 : 12;
  const steeringResponse = 1 - Math.exp(-dt * steeringResponseRate);
  state.steering = THREE.MathUtils.lerp(state.steering, desiredSteering, steeringResponse);`;

      const tuned = source.replace(search, replacement);
      if (tuned === source) {
        console.warn('TURN control tuning: steering patch not applied.');
        return new Response(source, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers
        });
      }

      return new Response(tuned, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      });
    } catch (error) {
      console.warn('TURN control tuning failed, using upstream game source.', error);
      return response;
    }
  };
})();
