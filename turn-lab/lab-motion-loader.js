const productionFetch = window.fetch.bind(window);

// TURN's current prototype is assembled by a stack of fetch-based source patches that
// intentionally target /turn/game.js. In the LAB page, a relative fetch('./game.js') would
// otherwise resolve in the /turn-lab context and bypass those production patches.
window.fetch = (input, init) => {
  const rawUrl = typeof input === 'string' ? input : input?.url;

  try {
    const url = new URL(rawUrl, document.baseURI);
    if (rawUrl === './game.js' || rawUrl === 'game.js' || url.pathname.endsWith('/turn-lab/game.js')) {
      return productionFetch('/turn/game.js', init);
    }
  } catch (_) {}

  return productionFetch(input, init);
};

try {
  await import('/turn/motion-adapter.js');
  console.info('TURN LAB: production game source routed through the full TURN patch chain.');
} finally {
  // The one special route is only needed while motion-adapter builds and imports the game.
  // Restore the normal patched fetch stack afterwards so unrelated requests behave exactly
  // as they do in production TURN.
  window.fetch = productionFetch;
}
