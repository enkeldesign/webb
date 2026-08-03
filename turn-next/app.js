// Generated from the canonical TURN v1.4.0 runtime. Do not edit by hand.
const buildKey = globalThis.__TURN_BUILD__?.cacheKey || '';
const url = new URL('/turn/app.js', globalThis.location?.href || 'https://enkel.design/turn-next/');
if (buildKey) url.searchParams.set('build', `${buildKey}-browser-consent`);
await import(url.href);
console.info(`TURN NEXT: ${globalThis.__TURN_BUILD__?.id || 'development'} loaded through the canonical TURN runtime.`);
