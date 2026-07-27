import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  DRIVE_BY_EAR_STORAGE_KEY,
  driveByEarEnabled,
  saveDriveByEarEnabled
} from '../../turn/ui/drive-by-ear-setting.js';

const [releaseSource, app, setting, style, menu, audio, paceAudio] = await Promise.all([
  fs.readFile(new URL('../../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/drive-by-ear-setting.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/drive-by-ear-setting.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/in-game-menu.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/audio/audio-system.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/audio/pace-notes.js', import.meta.url), 'utf8')
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
assert.ok(app.indexOf('./ui/drive-by-ear-setting.js') < app.indexOf('./audio/audio-system.js'));
assert.match(app, /if \(driveByEarEnabled\) \{/);
assert.ok(app.indexOf('if (driveByEarEnabled)') < app.indexOf('./audio/driving-soundscape.js'));
assert.match(setting, /DRIVE BY EAR<sup>™<\/sup>/);
assert.match(setting, /On by default for every player/);
assert.match(setting, /may improve performance on older devices/);
assert.match(setting, /blocked local storage/);
assert.match(setting, /requestAnimationFrame\(reload\)/);
assert.match(style, /\.drive-by-ear-card/);
assert.match(style, /orientation: landscape/);
assert.match(style, /max-height: 500px/);
assert.match(menu, /globalThis\.__turnDriveByEarEnabled === false/);
assert.match(menu, /if \(soundGuideButton\) soundGuideButton\.hidden/);
assert.match(audio, /DRIVE_BY_EAR_ENABLED = globalThis\.__turnDriveByEarEnabled !== false/);
assert.match(audio, /if \(DRIVE_BY_EAR_ENABLED\) \{[\s\S]*window\.addEventListener\('turn:pace-note'/);
assert.match(audio, /if \(DRIVE_BY_EAR_ENABLED\) installDbeGraphs\(\)/,
  'DBE off must not create tonal Slider or surface graphs');
assert.match(audio, /if \(DRIVE_BY_EAR_ENABLED\) \{\s*const recoveryRibbon/,
  'DBE off must skip tonal Slider and surface processing');
assert.match(audio, /if \(DRIVE_BY_EAR_ENABLED\) updateDrivingSafety/,
  'DBE off must skip Wrong Way processing');
assert.doesNotMatch(audio, /driftPanner|smoothPan\(drift/);
assert.match(audio, /if \(sliderGain\) hardMute\(sliderGain\.gain, now\)/);
assert.match(audio, /if \(surfaceGain\) hardMute\(surfaceGain\.gain, now\)/);
assert.doesNotMatch(audio, /recoveryGain|recoveryFilter|recoveryPanner|playRecoveryCue/,
  'The obsolete second recovery graph must remain deleted');
assert.doesNotMatch(paceAudio, /AudioContext|webkitAudioContext/);

console.log(`TURN ${release.id} Drive By Ear universal-default and tonal recovery true-off path passed.`);
