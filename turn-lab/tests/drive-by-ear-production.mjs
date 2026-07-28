import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  DRIVE_BY_EAR_STORAGE_KEY,
  driveByEarEnabled,
  saveDriveByEarEnabled
} from '../../turn/ui/drive-by-ear-setting.js';

const [
  releaseSource,
  app,
  setting,
  style,
  menu,
  audio,
  preferences,
  runtimeGuard,
  organic,
  recovery,
  offroadDirection,
  paceAudio,
  polishStyle
] = await Promise.all([
  fs.readFile(new URL('../../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/drive-by-ear-setting.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/drive-by-ear-setting.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/in-game-menu.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/audio/audio-system.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/audio/audio-preferences.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/audio/audio-preference-runtime.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/audio/organic-ribbon.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/audio/recovery-guidance.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/audio/offroad-ear-direction.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/audio/pace-notes.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/r104-polish.css', import.meta.url), 'utf8')
]);
const release = JSON.parse(releaseSource);

const values = new Map();
const storage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value)
};

assert.equal(DRIVE_BY_EAR_STORAGE_KEY, 'turn-drive-by-ear-v1');
assert.equal(driveByEarEnabled(storage), true, 'Drive By Ear must be enabled when no preference has been saved');
assert.equal(saveDriveByEarEnabled(false, storage), true);
assert.equal(driveByEarEnabled(storage), false);
assert.equal(saveDriveByEarEnabled(true, storage), true);
assert.equal(driveByEarEnabled(storage), true);
assert.equal(driveByEarEnabled({ getItem: () => { throw new Error('blocked'); } }), true);
assert.equal(saveDriveByEarEnabled(false, null), false);
assert.equal(saveDriveByEarEnabled(false, { setItem: () => { throw new Error('blocked'); } }), false);

assert.match(app, /installDriveByEarSetting/);
assert.ok(app.indexOf('./ui/drive-by-ear-setting.js') < app.indexOf('./audio/organic-ribbon.js'));
assert.match(app, /let organicRibbon = null/);
assert.match(app, /let recoveryGuidance = null/);
assert.match(
  app,
  /if \(driveByEarEnabled\) \{\s*organicRibbon = await import\(withBuild\('\.\/audio\/organic-ribbon\.js'\)\);\s*organicRibbon\.prepareOrganicRibbonCapture\(\);\s*recoveryGuidance = await import\(withBuild\('\.\/audio\/recovery-guidance\.js'\)\);\s*recoveryGuidance\.prepareRecoveryGuidanceCapture\(\);\s*\}/,
  'Optional DBE graph decorators must prepare capture only when DBE is enabled'
);
assert.ok(app.indexOf('prepareOrganicRibbonCapture()') < app.indexOf('./audio/audio-preferences.js'),
  'Preference graph interception must preserve the organic capture ordering');
assert.ok(app.indexOf('prepareRecoveryGuidanceCapture()') < app.indexOf('./audio/audio-preferences.js'),
  'Wrong-way recovery capture must remain inside the true-off boundary and precede graph creation');
assert.ok(app.indexOf('./audio/audio-preferences.js') < app.indexOf('./audio/audio-system.js'),
  'Preferences must be installed before the core graph is created');
assert.match(app, /installAudioPreferences\(\{ driveByEarGraphAvailable: driveByEarEnabled \}\)/);
assert.ok(app.indexOf('installTurnAudio()') < app.indexOf('installOrganicRibbon()'),
  'The organic wrapper must install only after the core API exists');
assert.match(app, /if \(driveByEarEnabled\) \{\s*organicRibbon\.installOrganicRibbon\(\);[\s\S]*\.\/audio\/driving-soundscape\.js/,
  'The organic wrapper and soundscape must remain inside the DBE-enabled branch');
assert.match(
  app,
  /installPaceNotes\(\);[\s\S]*installOffroadEarDirection\(\);[\s\S]*recoveryGuidance\.installRecoveryGuidance\(\);/,
  'Physical road-side correction must sit between route guidance and the outer recovery wrapper'
);
assert.ok(app.indexOf('./audio/driving-soundscape.js') < app.indexOf('./audio/audio-preference-runtime.js'),
  'The live preference guard must wrap the complete DBE soundscape');
assert.ok(app.indexOf('installOffroadEarDirection()') < app.indexOf('./audio/audio-preference-runtime.js'),
  'The live preference guard must also wrap off-road ear correction');
assert.ok(app.indexOf('installRecoveryGuidance()') < app.indexOf('./audio/audio-preference-runtime.js'),
  'The live preference guard must also wrap continuous recovery guidance');
assert.match(app, /installAudioPreferenceRuntime\(\)/);

assert.match(setting, /DRIVE BY EAR<sup>™<\/sup>/);
assert.match(setting, /On by default for every player/);
assert.match(setting, /may improve performance on older devices/);
assert.match(setting, /blocked local storage/);
assert.match(setting, /requestAnimationFrame\(reload\)/);
assert.match(style, /\.drive-by-ear-card/);
assert.match(style, /orientation: landscape/);
assert.match(style, /max-height: 500px/);

assert.match(menu, /button\.textContent = 'Audio'/);
assert.match(menu, /id="turnAudioEnabled"/);
assert.match(menu, /id="turnDbeEnabled"/);
assert.match(menu, /id="turnAudioBalance"/);
assert.match(menu, /saveDriveByEarEnabled\(enabled\)/);
assert.match(menu, /setDriveByEarEnabled/);
assert.match(menu, /driveByEarGraphAvailable === false/,
  'Enabling DBE after a true-off startup must rebuild the intentionally absent graph');

assert.match(preferences, /turn-audio-enabled-v1/);
assert.match(preferences, /turn-audio-balance-v1/);
assert.match(preferences, /const DEFAULT_BALANCE = 0\.5/);
assert.match(preferences, /if \(stored == null \|\| stored === ''\) return DEFAULT_BALANCE/,
  'An unset balance must retain the intended centre mix');
assert.match(preferences, /const GRAPH_GAIN_ROLES/);
assert.match(preferences, /'dynamics',[\s\S]*'guidance',[\s\S]*'route',[\s\S]*'world',[\s\S]*'safety'/);
assert.match(preferences, /role === 'dynamics' \|\| role === 'world'/,
  'Engine, drift, boost and world cues must share the other-sounds side of the balance');
assert.match(preferences, /role === 'guidance' \|\| role === 'route' \|\| role === 'safety'/,
  'Slider, pace notes and safety cues must share the DBE side of the balance');
assert.match(preferences, /setGain\(state\.masterPreference, audioEnabled \? 1 : 0/);
assert.match(preferences, /setGain\(state\.dbePreference, dbeEnabled \? dbeFactor : 0/);
assert.match(preferences, /const dbeFactor = balance < DEFAULT_BALANCE/);
assert.match(preferences, /const otherFactor = balance > DEFAULT_BALANCE/);
assert.match(preferences, /replacePrototypeMethod/,
  'Audio graph interception must fail safely on restrictive browser prototypes');
assert.match(preferences, /routingAvailable = connectPatched && gainFactoryPatched/);
assert.match(preferences, /globalThis\.__turnAudioPreferences = api/);
assert.doesNotMatch(preferences, /new AudioContext|new webkitAudioContext/,
  'Preferences must route the existing graph rather than creating a second audio engine');

assert.match(runtimeGuard, /const DBE_DISABLED_FRAME/);
assert.match(runtimeGuard, /nearestRivalDistance: Infinity/,
  'Live DBE off must also suppress the internally generated rival warning');
assert.match(runtimeGuard, /settings\?\.dbeEnabled === false/);
assert.match(runtimeGuard, /\{ \.\.\.frame, \.\.\.DBE_DISABLED_FRAME \}/);
assert.doesNotMatch(runtimeGuard, /AudioContext|webkitAudioContext|new Audio\(/);

assert.match(audio, /DRIVE_BY_EAR_ENABLED = globalThis\.__turnDriveByEarEnabled !== false/);
assert.match(audio, /if \(DRIVE_BY_EAR_ENABLED\) \{[\s\S]*window\.addEventListener\('turn:pace-note'/);
assert.match(audio, /if \(DRIVE_BY_EAR_ENABLED\) installDbeGraphs\(\)/,
  'DBE off must not create Slider or surface graphs');
assert.match(audio, /if \(DRIVE_BY_EAR_ENABLED\) \{\s*const recoveryRibbon/,
  'DBE off must skip Slider and surface processing');
assert.match(audio, /if \(DRIVE_BY_EAR_ENABLED\) updateDrivingSafety/,
  'DBE off must skip Wrong Way processing');
assert.match(organic, /export function prepareOrganicRibbonCapture\(\)/);
assert.match(organic, /captureAudioFactories\(\)/);
assert.doesNotMatch(organic, /new AudioContext|new webkitAudioContext|HTMLAudioElement|new Audio\(|fetch\(/,
  'Even when enabled, the organic layer must not create a dormant second engine or asset request');
assert.match(organic, /baseAudio\.silence\(\.\.\.args\)/);
assert.match(recovery, /export function prepareRecoveryGuidanceCapture\(\)/);
assert.match(recovery, /settings\?\.dbeEnabled !== false/,
  'Live DBE off must silence the continuous wrong-way layer');
assert.match(recovery, /globalThis\.__turnDriveByEarEnabled !== false/,
  'True-off startup must keep recovery unavailable');
assert.doesNotMatch(recovery, /new AudioContext|new webkitAudioContext|HTMLAudioElement|new Audio\(|fetch\(/,
  'Recovery guidance must reuse the central audio graph without assets');
assert.match(recovery, /updateWrongWayTone\(\{ active: false \}/,
  'Runtime DBE shutdown must explicitly fade the sustained wrong-way tone');
assert.match(offroadDirection, /settings\?\.dbeEnabled !== false/,
  'Live DBE off must bypass the physical-road correction layer');
assert.match(offroadDirection, /globalThis\.__turnDriveByEarEnabled !== false/,
  'True-off startup must leave physical-road correction unavailable');
assert.doesNotMatch(offroadDirection, /AudioContext|webkitAudioContext|HTMLAudioElement|new Audio\(|fetch\(/,
  'Ear correction must reuse the existing ribbon without another graph or asset');
assert.doesNotMatch(audio, /driftPanner|smoothPan\(drift/);
assert.match(audio, /if \(sliderGain\) hardMute\(sliderGain\.gain, now\)/);
assert.match(audio, /if \(surfaceGain\) hardMute\(surfaceGain\.gain, now\)/);
assert.doesNotMatch(audio, /recoveryGain|recoveryFilter|recoveryPanner|playRecoveryCue/);
assert.doesNotMatch(paceAudio, /AudioContext|webkitAudioContext/);
assert.match(polishStyle, /\.audio-settings-dialog/);
assert.match(polishStyle, /\.audio-balance-card/);

console.log(`TURN ${release.id} live audio preferences and Drive By Ear true-off path passed.`);