// Generated from the canonical TURN v1.8.5 runtime. Do not edit by hand.
await import('/turn-next/challenge-mode.js?revision=r182-race-my-ghost');
const buildKey = globalThis.__TURN_BUILD__?.cacheKey || '';
const url = new URL('/turn/app.js', globalThis.location?.href || 'https://enkel.design/turn-next/');
if (buildKey) url.searchParams.set('build', `${buildKey}-browser-consent-r166-bella-records`);
await import(url.href);
console.info(`TURN NEXT: ${globalThis.__TURN_BUILD__?.id || 'development'} loaded through the canonical TURN runtime.`);
