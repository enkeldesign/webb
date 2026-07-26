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
assert.equal(driveByEarEnabled({ getItem: () => { throw new Error('blocked'); } }), true, 'Storage failures must preserve the universal default');
assert.equal(saveDriveByEarEnabled(false, null), false, 'A missing storage backend must not pretend to save the preference');
assert.equal(saveDriveByEarEnabled(false, { setItem: () => { throw new Error('blocked'); } }), false, 'A blocked storage write must be reported to the interface');

assert.match(app, /installDriveByEarSetting/);
assert.ok(app.indexOf('./ui/drive-by-ear-setting.js') < app.indexOf('./audio/audio-system.js'), 'The saved preference must be known before audio modules install');
assert.match(app, /if \(driveByEarEnabled\) \{/);
assert.ok(app.indexOf('if (driveByEarEnabled)') < app.indexOf('./audio/driving-soundscape.js'));
assert.match(setting, /DRIVE BY EAR<sup>™<\/sup>/);
assert.match(setting, /On by default for every player/);
assert.match(setting, /may improve performance on older devices/);
assert.match(setting, /blocked local storage/, 'The interface must explain why an unsaved preference cannot be applied');
assert.match(setting, /requestAnimationFrame\(reload\)/, 'Changing the preference must reload into a clean module graph');
assert.match(style, /\.drive-by-ear-card/);
assert.match(style, /orientation: landscape/);
assert.match(style, /max-height: 500px/, 'The new card must retain a compact phone-landscape layout');
assert.match(menu, /globalThis\.__turnDriveByEarEnabled === false/);
assert.match(menu, /if \(soundGuideButton\) soundGuideButton\.hidden/, 'The Sound Guide must not advertise disabled processing');
assert.match(audio, /DRIVE_BY_EAR_ENABLED = globalThis\.__turnDriveByEarEnabled !== false/);
assert.match(audio, /if \(DRIVE_BY_EAR_ENABLED\) installRoadGuidanceGraph\(\)/, 'DBE off must not create the continuous road-noise graph');
assert.match(audio, /if \(DRIVE_BY_EAR_ENABLED\) \{[\s\S]*updateDrivingGuidance/, 'DBE off must skip continuous guidance processing');
assert.match(audio, /DRIVE_BY_EAR_ENABLED \? createPannerNode\(\) : context\.createGain\(\)/, 'DBE off must avoid the spatial drift panner');
assert.doesNotMatch(paceAudio, /AudioContext|webkitAudioContext/, 'The optional module must carry no dormant audio engine');

console.log(`TURN ${release.id} Drive By Ear universal-default and true-off path passed.`);
