(() => {
  const pipeline = globalThis.__turnLegacyPipeline;
  if (!pipeline) throw new Error('TURN LAB: legacy patch pipeline was not initialized.');

  const { nativeFetch, patches } = pipeline;
  const EXPECTED_PATCHES = [
    'game-prepatch',
    'gameplay-features',
    'core-state',
    'driving-core',
    'render-core'
  ];

  const actualNames = patches.map((patch) => patch.name);
  if (actualNames.join('|') !== EXPECTED_PATCHES.join('|')) {
    console.warn('TURN LAB: unexpected legacy patch order.', actualNames);
  }

  async function applyLegacyPipeline(response, init) {
    let current = response;

    for (const patch of patches) {
      pipeline.setStagedResponse(current);
      try {
        current = await patch.run.call(window, '/turn/game.js', init);
      } catch (error) {
        console.error(`TURN LAB: legacy patch ${patch.name} failed.`, error);
        throw error;
      } finally {
        pipeline.clearStagedResponse();
      }
    }

    return current;
  }

  window.fetch = async (input, init) => {
    const rawUrl = typeof input === 'string' ? input : input?.url;

    try {
      const url = new URL(rawUrl, document.baseURI);
      const isGameBootstrap = rawUrl === './game.js'
        || rawUrl === 'game.js'
        || url.pathname.endsWith('/turn/game.js')
        || url.pathname.endsWith('/turn-lab/game.js');

      if (isGameBootstrap) {
        const localUrl = new URL('/turn-lab/game.js', location.origin);
        localUrl.search = url.search;
        const response = await nativeFetch(localUrl.href, init);
        if (!response.ok) return response;
        return applyLegacyPipeline(response, init);
      }
    } catch (error) {
      console.warn('TURN LAB: legacy bootstrap routing failed.', error);
    }

    return nativeFetch(input, init);
  };

  globalThis.__turnRestoreNativeFetch = () => {
    window.fetch = nativeFetch;
  };

  console.info(`TURN LAB: single legacy bootstrap pipeline ready (${patches.length} transforms).`);
})();