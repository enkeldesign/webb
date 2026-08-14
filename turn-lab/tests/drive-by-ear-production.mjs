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
  runtimeLoader,
  organic,
  recovery,
  offroadDirection,
  paceAudio,
  screenBlanking,
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
  fs.readFile(new URL('../../turn/audio/drive-by-ear-runtime.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/audio/organic-ribbon.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/audio/recovery-guidance.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/audio/offroad-ear-direction.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/audio/pace-notes.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/screen-blanking.js', import.meta.url), 'utf8'),
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
assert.match(app, /prepareDriveByEarRuntime/);
assert.match(app, /ensureDriveByEarRuntime/);
assert.ok(app.indexOf('./ui/drive-by-ear-setting.js') < app.indexOf('./audio/drive-by-ear-runtime.js'));
assert.ok(app.indexOf('await prepareDriveByEarRuntime()') < app.indexOf('./audio/audio-preferences.js'),
  'Drive By Ear graph capture must be prepared before preference interception and graph creation');
assert.match(app, /globalThis\.__turnDriveByEarEnabled = true/,
  'The central guidance graph must be constructed even when the stored preference is off');
assert.ok(app.indexOf('globalThis.__turnDriveByEarEnabled = true') < app.indexOf('./audio/audio-system.js'));
assert.ok(app.indexOf('./audio/audio-preferences.js') < app.indexOf('./audio/audio-system.js'),
  'Preferences must be installed before the core graph is created');
assert.match(app, /installAudioPreferences\(\{ driveByEarGraphAvailable: driveByEarEnabled \}\)/);
assert.match(app, /installTurnAudio\(\);\s*audioPreferences\.setDriveByEarEnabled\(driveByEarEnabled\);/,
  'The stored preference must be restored immediately after the always-ready graph is built');
assert.match(app, /globalThis\.__turnEnsureDriveByEarRuntime = ensureDriveByEarRuntime/);
assert.match(app, /if \(driveByEarEnabled\) await ensureDriveByEarRuntime\(\)/,
  'The optional Drive By Ear wrappers should still install eagerly only for players who selected them');
assert.ok(app.indexOf('if (driveByEarEnabled) await ensureDriveByEarRuntime()') < app.indexOf('./audio/audio-preference-runtime.js'),
  'The preference guard must wrap the complete eager Drive By Ear runtime');
assert.match(app, /installAudioPreferenceRuntime\(\)/);

assert.match(runtimeLoader, /export function prepareDriveByEarRuntime\(\)/);
assert.match(runtimeLoader, /prepareOrganicRibbonCapture\(\)/);
assert.match(runtimeLoader, /prepareRecoveryGuidanceCapture\(\)/);
assert.match(runtimeLoader, /preparePaceNotePriorityCapture\(\)/);
assert.match(runtimeLoader, /export async function ensureDriveByEarRuntime\(\)/);
assert.match(runtimeLoader, /installOrganicRibbon\(\);[\s\S]*installPaceNotePriority\(\);[\s\S]*installUniversalDrivingSoundscape\(\);[\s\S]*installPaceNotes\(\);[\s\S]*installOffroadEarDirection\(\);[\s\S]*installRecoveryGuidance\(\);/,
  'Lazy activation must install the complete Drive By Ear stack in the established wrapper order');
assert.match(runtimeLoader, /globalThis\.__turnDriveByEarRuntimeReady = true/);
assert.match(runtimeLoader, /console\.error\('TURN: Drive By Ear could not be started\.'/);

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
  'The normal settings path may still reload after a stored off startup, while audio-only mode uses the prepared runtime directly');
assert.match(menu, /if \(value > 55\)/,
  '55% toward Drive By Ear remains inside the user-facing Balanced range');

assert.match(preferences, /turn-audio-enabled-v1/);
assert.match(preferences, /turn-audio-balance-v1/);
assert.match(preferences, /const BALANCE_CENTER = 0\.5/);
assert.match(preferences, /const DEFAULT_BALANCE = 0\.55/);
assert.match(preferences, /if \(stored == null \|\| stored === ''\) return DEFAULT_BALANCE/,
  'An unset balance should start at the high edge of Balanced, slightly favouring Drive By Ear');
assert.match(preferences, /const GRAPH_GAIN_ROLES/);
assert.match(preferences, /'dynamics',[\s\S]*'guidance',[\s\S]*'route',[\s\S]*'world',[\s\S]*'safety'/);
assert.match(preferences, /role === 'dynamics' \|\| role === 'world'/,
  'Engine, drift, boost and world cues must share the other-sounds side of the balance');
assert.match(preferences, /role === 'guidance' \|\| role === 'route' \|\| role === 'safety'/,
  'Slider, pace notes and safety cues must share the Drive By Ear side of the balance');
assert.match(preferences, /setGain\(state\.masterPreference, audioEnabled \? 1 : 0/);
assert.match(preferences, /setGain\(state\.dbePreference, dbeEnabled \? dbeFactor : 0/);
assert.match(preferences, /const dbeFactor = balance < BALANCE_CENTER/);
assert.match(preferences, /const otherFactor = balance > BALANCE_CENTER/);
assert.match(preferences, /replacePrototypeMethod/,
  'Audio graph interception must fail safely on restrictive browser prototypes');
assert.match(preferences, /routingAvailable = connectPatched && gainFactoryPatched/);
assert.match(preferences, /globalThis\.__turnAudioPreferences = api/);
assert.doesNotMatch(preferences, /new AudioContext|new webkitAudioContext/,
  'Preferences must route the existing graph rather than creating a second audio engine');

assert.match(runtimeGuard, /const DBE_DISABLED_FRAME/);
assert.match(runtimeGuard, /nearestRivalDistance: Infinity/,
  'Live Drive By Ear off must also suppress the internally generated rival warning');
assert.match(runtimeGuard, /settings\?\.dbeEnabled === false/);
assert.match(runtimeGuard, /\{ \.\.\.frame, \.\.\.DBE_DISABLED_FRAME \}/);
assert.doesNotMatch(runtimeGuard, /AudioContext|webkitAudioContext|new Audio\(/);

assert.match(audio, /DRIVE_BY_EAR_ENABLED = globalThis\.__turnDriveByEarEnabled !== false/);
assert.match(audio, /if \(DRIVE_BY_EAR_ENABLED\) \{[\s\S]*window\.addEventListener\('turn:pace-note'/);
assert.match(audio, /if \(DRIVE_BY_EAR_ENABLED\) installDbeGraphs\(\)/);
assert.match(audio, /if \(DRIVE_BY_EAR_ENABLED\) \{\s*const recoveryRibbon/);
assert.match(audio, /if \(DRIVE_BY_EAR_ENABLED\) updateDrivingSafety/);
assert.match(organic, /export function prepareOrganicRibbonCapture\(\)/);
assert.match(organic, /captureAudioFactories\(\)/);
assert.doesNotMatch(organic, /new AudioContext|new webkitAudioContext|HTMLAudioElement|new Audio\(|fetch\(/,
  'The organic layer must not create a dormant second engine or asset request');
assert.match(organic, /baseAudio\.silence\(\.\.\.args\)/);
assert.match(recovery, /export function prepareRecoveryGuidanceCapture\(\)/);
assert.match(recovery, /settings\?\.dbeEnabled !== false/,
  'Live Drive By Ear off must silence the continuous wrong-way layer');
assert.match(recovery, /globalThis\.__turnDriveByEarEnabled !== false/);
assert.doesNotMatch(recovery, /new AudioContext|new webkitAudioContext|HTMLAudioElement|new Audio\(|fetch\(/,
  'Recovery guidance must reuse the central audio graph without assets');
assert.match(recovery, /updateWrongWayTone\(\{ active: false \}/,
  'Runtime Drive By Ear shutdown must explicitly fade the sustained wrong-way tone');
assert.match(offroadDirection, /settings\?\.dbeEnabled !== false/,
  'Live Drive By Ear off must bypass the physical-road correction layer');
assert.match(offroadDirection, /globalThis\.__turnDriveByEarEnabled !== false/);
assert.doesNotMatch(offroadDirection, /AudioContext|webkitAudioContext|HTMLAudioElement|new Audio\(|fetch\(/,
  'Ear correction must reuse the existing ribbon without another graph or asset');
assert.doesNotMatch(audio, /driftPanner|smoothPan\(drift/);
assert.match(audio, /if \(sliderGain\) hardMute\(sliderGain\.gain, now\)/);
assert.match(audio, /if \(surfaceGain\) hardMute\(surfaceGain\.gain, now\)/);
assert.doesNotMatch(audio, /recoveryGain|recoveryFilter|recoveryPanner|playRecoveryCue/);
assert.doesNotMatch(paceAudio, /AudioContext|webkitAudioContext/);

assert.match(screenBlanking, /driveByEarEnabled/);
assert.match(screenBlanking, /globalThis\.__turnEnsureDriveByEarRuntime/);
assert.match(screenBlanking, /preferences\.setDriveByEarEnabled\(true\)/,
  'Entering audio-only mode must temporarily activate Drive By Ear');
assert.match(screenBlanking, /setDriveByEarEnabled\?\.\(chosenSetting\)/,
  'Showing the screen must restore the stored Drive By Ear choice');
assert.match(screenBlanking, /Drive By Ear will turn on temporarily/);
assert.match(screenBlanking, /Drive By Ear is on for audio-only driving/);
assert.match(screenBlanking, /Drive By Ear returned to your chosen setting/);
assert.match(screenBlanking, /getBoundingClientRect\(\)/);
assert.match(screenBlanking, /--turn-screen-blank-left/);
assert.match(screenBlanking, /--turn-screen-blank-top/);
assert.match(screenBlanking, /background: #ff7b54/,
  'The active show-screen control should use the back-navigation orange');
assert.match(screenBlanking, /className = 'turn-screen-blank-toast'/);
assert.match(screenBlanking, /role', 'status'/);

assert.match(polishStyle, /\.audio-settings-dialog/);
assert.match(polishStyle, /\.audio-balance-card/);

console.log(`TURN ${release.id} temporary audio-only Drive By Ear integration passed.`);
