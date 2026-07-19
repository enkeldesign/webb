const ownUrl = new URL(import.meta.url);
const buildId = ownUrl.searchParams.get('build') || globalThis.__TURN_BUILD__?.cacheKey || '';
const motionAdapterUrl = new URL('./motion-adapter.js', import.meta.url);

if (buildId) motionAdapterUrl.searchParams.set('build', buildId);

try {
  await import(motionAdapterUrl.href);
  console.info(`TURN LAB: ${globalThis.__TURN_BUILD__?.id || 'development'} loaded through the single legacy bootstrap pipeline.`);
} finally {
  globalThis.__turnRestoreNativeFetch?.();
}