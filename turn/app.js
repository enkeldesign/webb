const buildKey = globalThis.__TURN_BUILD__?.cacheKey || '';

function withBuild(path) {
  const url = new URL(path, import.meta.url);
  if (buildKey) url.searchParams.set('build', buildKey);
  return url.href;
}

await import(withBuild('./input/analog-gas.js'));
await import(withBuild('./ui/gameplay-controls.js'));
await import(withBuild('./main.js'));

await Promise.all([
  import(withBuild('./render/world.js')),
  import(withBuild('./ui/spectate.js'))
]);

console.info(`TURN: ${globalThis.__TURN_BUILD__?.id || 'development'} loaded from the static module graph.`);
