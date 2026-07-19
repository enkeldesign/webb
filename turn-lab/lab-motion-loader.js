const patchedFetch = window.fetch.bind(window);
const ownUrl = new URL(import.meta.url);
const buildId = ownUrl.searchParams.get('build') || globalThis.__TURN_BUILD__?.cacheKey || '';

function withBuild(path) {
  const url = new URL(path, location.origin);
  if (buildId) url.searchParams.set('build', buildId);
  return url.href;
}

const lapSystemUrl = withBuild('/turn-lab/race/lap-system.js');

// motion-adapter fetches ./game.js. Route only that bootstrap request through the legacy
// virtual /turn/game.js identity so every remaining copied production patch runs, while
// lab-game-alias.js resolves the actual bytes from /turn-lab/game.js.
window.fetch = async (input, init) => {
  const rawUrl = typeof input === 'string' ? input : input?.url;

  try {
    const url = new URL(rawUrl, document.baseURI);
    if (rawUrl === './game.js' || rawUrl === 'game.js' || url.pathname.endsWith('/turn-lab/game.js')) {
      const response = await patchedFetch(withBuild('/turn/game.js'), init);
      const source = await response.text();
      const normalizedSource = source.replace(
        "from '/turn-lab/race/lap-system.js';",
        `from '${lapSystemUrl}';`
      );

      return new Response(normalizedSource, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      });
    }
  } catch (error) {
    console.warn('TURN LAB: game bootstrap routing failed.', error);
  }

  return patchedFetch(input, init);
};

try {
  await import(withBuild('/turn-lab/motion-adapter.js'));
  console.info(`TURN LAB: ${globalThis.__TURN_BUILD__?.id || 'development'} loaded through the local patch chain.`);
} finally {
  window.fetch = patchedFetch;
}
