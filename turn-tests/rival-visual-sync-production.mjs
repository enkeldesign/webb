import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [releaseSource, index, main, trackManager] = await Promise.all([
  fs.readFile(new URL('../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/main.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/track-manager.js', import.meta.url), 'utf8')
]);

const release = JSON.parse(releaseSource);
assert.match(index, new RegExp(`TURN v${release.version.replaceAll('.', '\\.')} · Build ${release.id.replaceAll('.', '\\.')}`));

const ensureSection = section(main, 'function ensureCompetitorCars()', '\nfunction syncCompetitorVisuals()');
assert.match(ensureSection, /while \(competitorCars\.length < COMPETITOR_LIMIT\)/, 'The fixed rival visual pool must still be created on demand');
assert.doesNotMatch(ensureSection, /syncCompetitorVisual|installCarVisual|createCarVisual/, 'Pool creation must not trigger model identity work');

const syncSection = section(main, 'function syncCompetitorVisuals()', '\nasync function syncCompetitorVisual');
assert.match(syncSection, /ensureCompetitorCars\(\)/, 'Identity sync must ensure the fixed visual pool exists');
assert.match(syncSection, /state\.competitorLaps\[i\]/, 'Identity sync must follow the current saved rival set');
assert.match(syncSection, /void syncCompetitorVisual\(car, lap\)/, 'Only the explicit identity sync path may request model changes');
assert.doesNotMatch(syncSection, /requestAnimationFrame|setAnimationLoop|setInterval/, 'Rival identity sync must create no recurring scheduler');

const placementSection = section(main, 'function placeCompetitorCars(dt)', '\nfunction updateScene');
assert.match(placementSection, /lapFrameAt\(lap, state\.lapElapsed\)/, 'The frame loop must continue sampling rival replay transforms');
assert.match(placementSection, /car\.position\.set\(frame\.x, 0\.18, frame\.z\)/, 'Rival position must remain frame-driven');
assert.match(placementSection, /car\.rotation\.y = frame\.h \+ Math\.PI/, 'Rival heading must remain frame-driven');
assert.match(placementSection, /if \(car === ghostCar\) animateWheels\(car, frame\.s, 45, dt\)/, 'The primary ghost wheel animation must remain visual-frame work');
assert.doesNotMatch(placementSection, /ensureCompetitorCars|syncCompetitorVisual|installCarVisual|createCarVisual/, 'The frame loop must perform no rival pool or model identity synchronisation');

const lapSection = section(main, 'function completeLap(now)', '\nfunction saveGhost');
assert.match(lapSection, /completeLapState\(/, 'Lap completion must retain the production race-state boundary');
assert.match(lapSection, /syncCompetitorVisuals\(\)/, 'A newly saved top-four lap must refresh rival model identity immediately');
assert.ok(
  lapSection.indexOf('completeLapState(') < lapSection.indexOf('syncCompetitorVisuals()'),
  'Rival identity must sync after the saved lap set has been updated'
);

const loadSection = section(main, 'function loadGhost()', '\nglobalThis.__turnHasGhosts');
assert.match(loadSection, /loadRivalsState\(/, 'Initial rival storage must still load through the shared race module');
assert.match(loadSection, /syncCompetitorVisuals\(\)/, 'Initial rival loading must install the stored models once');
assert.ok(
  loadSection.indexOf('loadRivalsState(') < loadSection.indexOf('syncCompetitorVisuals()'),
  'Stored rival identity must sync only after storage has populated the state'
);

assert.match(main, /competitorCars,\s*ensureCompetitorCars,\s*syncCompetitorVisuals,/, 'The runtime must expose separate pool and identity operations');
assert.match(main, /if \(root\.userData\.turnVisualKey === key \|\| root\.userData\.turnVisualPendingKey === key\) return;/, 'Model installation must retain its duplicate-key fast path');

const activationSection = section(trackManager, 'export async function activateTrack', '\nfunction installRuntime');
assert.match(activationSection, /loadRivalsState\(/, 'Track activation must load the selected track rival namespace');
assert.match(activationSection, /currentRuntime\.syncCompetitorVisuals\?\.\(\)/, 'Track changes must refresh model identity once after rival loading');
assert.doesNotMatch(activationSection, /currentRuntime\.ensureCompetitorCars\?\.\(\)/, 'Track activation must not stop at pool creation without refreshing models');

const infrastructureSection = section(trackManager, 'function ensureTrackInfrastructure', '\nfunction isRaceParticle');
assert.match(infrastructureSection, /currentRuntime\.ensureCompetitorCars\?\.\(\)/, 'Dynamic-world setup must still create the full fixed rival pool before reparenting');
assert.doesNotMatch(infrastructureSection, /syncCompetitorVisuals/, 'World-layer setup must not perform unrelated model identity work');

console.log(`TURN ${release.id} event-driven rival model synchronisation passed.`);

function section(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `Missing source marker: ${startMarker}`);
  assert.notEqual(end, -1, `Missing source marker: ${endMarker}`);
  return source.slice(start, end);
}
