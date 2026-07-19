(() => {
  const upstreamFetch = window.fetch.bind(window);

  function replaceRequired(source, search, replacement, label) {
    const next = source.replace(search, replacement);
    if (next === source) console.warn(`TURN lap stability patch not applied: ${label}`);
    return next;
  }

  function patchGameSource(input) {
    let source = input;

    // Ghost identity now lives in the spectator HUD. Keep all 3D label creation out of the
    // render/race path so completing a lap cannot allocate canvas textures or sprites.
    source = replaceRequired(
      source,
      /function refreshCompetitorLabels\(\) \{[\s\S]*?\n\}\n\nfunction ensureCompetitorCars\(\) \{/,
      `function refreshCompetitorLabels() {
  // Intentionally empty. Ghost labels are shown only in the spectator HUD.
}

function ensureCompetitorCars() {`,
      'disable 3D ghost labels'
    );

    // Replace the fully patched lap-completion function after race-polish has run. Any failure
    // while preparing or saving a new rival is contained here so the animation loop can always
    // continue into the next lap.
    source = replaceRequired(
      source,
      /function completeLap\(now\) \{[\s\S]*?\n\}\n\nfunction saveGhost\(\) \{/,
      `function completeLap(now) {
  const finishedTime = (now - state.lapStartedAt) / 1000;
  const validLap = finishedTime > 5 && state.recording.length > 20;

  if (validLap) {
    const previousBest = state.bestTime;
    let message = 'LAP ' + formatTime(finishedTime);

    try {
      const candidateFrames = state.recording.map((frame) => ({ ...frame }));
      if (candidateFrames.length) {
        const start = samples[0];
        candidateFrames[0] = {
          ...candidateFrames[0],
          t: 0,
          x: start.point.x,
          z: start.point.z,
          h: Math.atan2(start.tangent.x, start.tangent.z),
          p: 0
        };
      }

      const candidate = {
        time: finishedTime,
        hitAt: Date.now(),
        frames: candidateFrames
      };

      const nextLaps = [...state.competitorLaps, candidate]
        .filter((lap) => Number.isFinite(lap?.time) && Array.isArray(lap?.frames) && lap.frames.length > 20)
        .sort((a, b) => a.time - b.time)
        .slice(0, COMPETITOR_LIMIT);

      const rank = nextLaps.indexOf(candidate);
      state.competitorLaps = nextLaps;
      state.bestTime = state.competitorLaps[0]?.time ?? Infinity;
      state.ghostFrames = state.competitorLaps[0]?.frames ?? [];
      state.ghostVisible = state.competitorLaps.length > 0;
      saveGhost();

      if (finishedTime < previousBest) {
        message = 'NEW BEST ' + formatTime(finishedTime);
      } else if (rank >= 0) {
        message = 'TOP ' + (rank + 1) + ' LAP ' + formatTime(finishedTime);
      }
    } catch (error) {
      console.error('TURN: completed lap could not be added to rivals, continuing race.', error);
      globalThis.__turnLastLapError = error;
    }

    showMessage(message);
  }

  state.lapCheckpointIndex = 0;
  state.lapActive = true;
  state.lap += 1;
  state.lapStartedAt = now;
  state.lapElapsed = 0;
  state.recording = [];
}

function saveGhost() {`,
      'crash-safe lap completion'
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
      console.warn('TURN lap stability layer failed, using upstream game source.', error);
      return response;
    }
  };
})();