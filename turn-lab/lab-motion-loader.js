const patchedFetch = window.fetch.bind(window);

// motion-adapter fetches ./game.js. Route only that bootstrap request through the legacy
// virtual /turn/game.js identity so every copied production patch runs, while lab-game-alias.js
// resolves the actual bytes from /turn-lab/game.js.
window.fetch = (input, init) => {
  const rawUrl = typeof input === 'string' ? input : input?.url;

  try {
    const url = new URL(rawUrl, document.baseURI);
    if (rawUrl === './game.js' || rawUrl === 'game.js' || url.pathname.endsWith('/turn-lab/game.js')) {
      return patchedFetch('/turn/game.js', init);
    }
  } catch (_) {}

  return patchedFetch(input, init);
};

try {
  await import('./motion-adapter.js');
  console.info('TURN LAB: independent production snapshot loaded through the local patch chain.');
} finally {
  window.fetch = patchedFetch;
}