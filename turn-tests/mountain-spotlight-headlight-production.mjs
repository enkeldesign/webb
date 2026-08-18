import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [sharedHeadlight, mountainWrapper, world, midnight, registry] = await Promise.all([
  fs.readFile(new URL('../turn/tracks/night-player-spotlight-r560.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/mountain-player-headlight-r8.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/mountain-world-r3.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/midnight-city-world-r11.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/registry.js', import.meta.url), 'utf8')
]);

assert.match(sharedHeadlight, /new THREE\.SpotLight\(/,
  'Night-track headlights must use a real SpotLight');
assert.equal((sharedHeadlight.match(/new THREE\.SpotLight\(/g) || []).length, 1,
  'MOUNTAIN and MIDNIGHT CITY must share one central spotlight implementation rather than duplicate light constructors');
assert.match(sharedHeadlight, /intensity: 2600/,
  'The shared spotlight should retain the approved racing-speed intensity');
assert.match(sharedHeadlight, /distance: 220/,
  'The shared spotlight should retain the approved 220 m racing-speed range');
assert.match(sharedHeadlight, /new Set\(\['midnight-city', 'mountain'\]\)/,
  'Exactly the two night tracks should share the same spotlight configuration');
assert.match(sharedHeadlight, /light\.castShadow = false/,
  'The shared headlight must never allocate a dynamic shadow map');
assert.match(sharedHeadlight, /lightLocal: Object\.freeze\(\{ x: 0, y: 0\.82, z: -0\.85 \}\)/,
  'The emitter should sit close to the front of the car');
assert.match(sharedHeadlight, /targetLocal: Object\.freeze\(\{ x: 0, y: -1\.5, z: -54 \}\)/,
  'The shared spotlight should retain the lower aim used on flat and downhill roads');
assert.match(sharedHeadlight, /applyNightSpotlightConfig\(rig, light, target\);/,
  'Every install must reconcile an existing named rig instead of trusting whatever module revision created it first');
assert.match(sharedHeadlight, /light\.intensity = NIGHT_SPOTLIGHT_CONFIG\.intensity/,
  'Reconciliation must reapply the canonical intensity to an existing light');
assert.match(sharedHeadlight, /light\.distance = NIGHT_SPOTLIGHT_CONFIG\.distance/,
  'Reconciliation must reapply the canonical range to an existing light');
assert.match(sharedHeadlight, /light\.position\.set\(/,
  'Reconciliation must reapply the canonical emitter position');
assert.match(sharedHeadlight, /target\.position\.set\(/,
  'Reconciliation must reapply the canonical target position');
assert.match(sharedHeadlight, /LEGACY_MIDNIGHT_PROJECTION_NAME = 'Midnight City projected headlights'/,
  'The old MIDNIGHT CITY projected wedge must be explicitly removable even if its old rig hierarchy is stale');
assert.match(sharedHeadlight, /revision: HEADLIGHT_REVISION/,
  'The live shared rig should expose the reconciled revision for diagnostics');
assert.doesNotMatch(sharedHeadlight, /PlaneGeometry|BufferGeometry|CircleGeometry|requestAnimationFrame|setAnimationLoop/,
  'The spotlight solution must not reintroduce projected beam geometry or its own animation loop');

assert.match(mountainWrapper, /night-player-spotlight-r560\.js\?revision=r175-reconcile/,
  'MOUNTAIN must cache-bust to the reconciled shared spotlight module');
assert.match(mountainWrapper, /installNightPlayerSpotlight\(playerCar, runtime\)/,
  'MOUNTAIN must delegate to the shared night-track spotlight implementation');
assert.match(world, /mountain-player-headlight-r8\.js\?revision=r175-reconcile/,
  'MOUNTAIN must also cache-bust the wrapper that imports the shared spotlight');
assert.match(world, /installMountainSpotlightHeadlight\(runtime\?\.playerCar, runtime\)/,
  'The MOUNTAIN world must attach the shared spotlight to the production player car');
assert.match(midnight, /night-player-spotlight-r560\.js\?revision=r175-reconcile/,
  'MIDNIGHT CITY must import the exact same reconciled shared spotlight module');
assert.match(midnight, /installNightPlayerSpotlight\(options\.runtime\?\.playerCar, options\.runtime\)/,
  'MIDNIGHT CITY must install the exact same shared spotlight rig');
assert.match(midnight, /shared-warm-shadowless-spotlight-identical-to-mountain/);
assert.match(registry, /mountain-world-r3\.js\?revision=r175-reconcile-night-headlight/,
  'Production must cache-bust MOUNTAIN to the reconciled headlight revision');
assert.match(registry, /midnight-city-world-r11\.js\?build=20260818-r175-reconcile-night-headlight/,
  'Production must cache-bust MIDNIGHT CITY to the reconciled headlight revision');

console.log('TURN shared MOUNTAIN + MIDNIGHT CITY reconciled 220 m shadowless spotlight contract passed.');
