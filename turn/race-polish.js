(() => {
  const upstreamFetch = window.fetch.bind(window);

  window.fetch = async (input, init) => {
    const response = await upstreamFetch(input, init);

    try {
      const rawUrl = typeof input === 'string' ? input : input?.url;
      const url = new URL(rawUrl, location.href);
      if (!url.pathname.endsWith('/turn/game.js')) return response;

      let source = await response.text();

      source = source.replace(
        `  const hitAt = Number(lap?.hitAt);
  if (!Number.isFinite(hitAt)) return 'Previous record';`,
        `  const rawHitAt = lap?.hitAt;
  const hitAt = rawHitAt == null ? NaN : Number(rawHitAt);
  if (!Number.isFinite(hitAt)) return 'Previous record ' + (allLaps.indexOf(lap) + 1);`
      );

      source = source.replace(
        `          hitAt: Number.isFinite(Number(lap.hitAt)) ? Number(lap.hitAt) : migrationBase - index * 60000,`,
        `          hitAt: lap.hitAt != null && Number.isFinite(Number(lap.hitAt)) ? Number(lap.hitAt) : null,`
      );

      source = source.replace(
        `    const candidate = {
      time: finishedTime,
      hitAt: Date.now(),
      frames: state.recording.slice()
    };`,
        `    const candidateFrames = state.recording.map((frame) => ({ ...frame }));
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
    };`
      );

      return new Response(source, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      });
    } catch (error) {
      console.warn('TURN race polish failed, using upstream game source.', error);
      return response;
    }
  };
})();