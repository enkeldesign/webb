const patchedFetch = window.fetch.bind(window);
const lapSystemUrl = new URL('/turn-lab/race/lap-system.js', location.origin).href;

// motion-adapter fetches ./game.js. Route only that bootstrap request through the legacy
// virtual /turn/game.js identity so every copied production patch runs, while lab-game-alias.js
// resolves the actual bytes from /turn-lab/game.js.
//
// The generated game is later evaluated from a blob: URL. Safari cannot reliably resolve the
// root-relative lap-system import from that blob module, so convert it to a fully qualified URL
// before motion-adapter creates the blob.
window.fetch = async (input, init) => {
  const rawUrl = typeof input === 'string' ? input : input?.url;

  try {
    const url = new URL(rawUrl, document.baseURI);
    if (rawUrl === './game.js' || rawUrl === 'game.js' || url.pathname.endsWith('/turn-lab/game.js')) {
      const response = await patchedFetch('/turn/game.js', init);
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
  await import('./motion-adapter.js');
  console.info('TURN LAB: independent production snapshot loaded through the local patch chain.');
} finally {
  window.fetch = patchedFetch;
}
