(() => {
  const nativeFetch = window.fetch.bind(window);

  // The legacy TURN patch stack only activates for /turn/game.js. Keep that exact virtual
  // request identity inside LAB, but resolve the actual network request to LAB's own snapshot.
  // This preserves byte-identical patch files without creating a runtime dependency on /turn.
  window.fetch = (input, init) => {
    const rawUrl = typeof input === 'string' ? input : input?.url;

    try {
      const url = new URL(rawUrl, location.href);
      if (url.pathname.endsWith('/turn/game.js')) {
        const localUrl = new URL('/turn-lab/game.js', location.origin);
        localUrl.search = url.search;
        return nativeFetch(localUrl.href, init);
      }
    } catch (_) {}

    return nativeFetch(input, init);
  };

  console.info('TURN LAB: local game-source alias enabled.');
})();