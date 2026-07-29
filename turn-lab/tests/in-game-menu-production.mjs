import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { GAME_MODE } from '../../turn/race/game-state.js';
import {
  IN_GAME_MENU_STATE,
  inGameMenuStateFor,
  inGameMenuVisibilityFor
} from '../../turn/ui/in-game-menu-state.js';

assert.equal(inGameMenuStateFor(GAME_MODE.STAGED), IN_GAME_MENU_STATE.STAGED);
assert.equal(inGameMenuStateFor(GAME_MODE.RACING), IN_GAME_MENU_STATE.RACING);
assert.equal(inGameMenuStateFor(GAME_MODE.SPECTATING), IN_GAME_MENU_STATE.HIDDEN);

assert.deepEqual(inGameMenuVisibilityFor(GAME_MODE.STAGED), { menuState: IN_GAME_MENU_STATE.STAGED, backToStart: false, startActions: true });
assert.deepEqual(inGameMenuVisibilityFor(GAME_MODE.RACING), { menuState: IN_GAME_MENU_STATE.RACING, backToStart: true, startActions: false });
assert.deepEqual(inGameMenuVisibilityFor(GAME_MODE.SPECTATING), { menuState: IN_GAME_MENU_STATE.HIDDEN, backToStart: false, startActions: false });

const [index, releaseSource, app, menu, controls, backToLot, main, menuCss, polishCss, spectate, trackSelect] = await Promise.all([
  fs.readFile(new URL('../../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/in-game-menu.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/gameplay-controls.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/back-to-lot.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/main.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/in-game-menu.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/r104-polish.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/spectate.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/track-select.js', import.meta.url), 'utf8')
]);

const release = JSON.parse(releaseSource);
assert.match(index, new RegExp(`TURN v${release.version.replaceAll('.', '\\.')} · Build ${release.id.replaceAll('.', '\\.')}`));
assert.match(index, new RegExp(`in-game-menu\\.css\\?build=${release.cacheKey}`));
assert.match(index, /id="calibrateButton"[^>]*>Recalibrate<\/button>/);
assert.match(index, /id="resetButton"[^>]*>Restart Lap<\/button>/);
assert.match(app, /installStylesheet\('\.\/r104-polish\.css', 'data-turn-r104-polish'\)/);
assert.match(app, /await import\(withBuild\('\.\/ui\/in-game-menu\.js'\)\)/);

assert.match(menu, /backToStartButton\.textContent = 'Restart Lap'/);
assert.match(menu, /Restart the current lap from the start line/);
assert.match(menu, /backToLotButton\.textContent = 'Leave Race'/);
assert.match(menu, /Leave the race and choose another track/);
assert.match(menu, /inGameMenuVisibilityFor\(runtime\.state\.mode\)/);
assert.doesNotMatch(menu, /state\.speed/);
assert.match(menu, /backToStartButton\.hidden = !visibility\.backToStart/);
assert.match(menu, /backToLotButton\.hidden = !visibility\.startActions/);
assert.match(menu, /recalibrateButton\.hidden = !visibility\.startActions/);
assert.match(menu, /audioButton\.hidden = !visibility\.startActions/);
assert.match(menu, /resetRivalsButton\.hidden = !visibility\.startActions/);
assert.match(menu, /const buttonOrder = \[\s*backToLotButton,\s*recalibrateButton,\s*audioButton,\s*resetRivalsButton,\s*spectateButton,\s*backToStartButton\s*\]/);

assert.match(menu, /button\.textContent = 'Audio'/);
assert.match(menu, /<h2 id="audioSettingsTitle">AUDIO<\/h2>/);
assert.match(menu, /id="turnAudioEnabled"/);
assert.match(menu, /id="turnDbeEnabled"/);
assert.match(menu, /id="turnAudioBalance" type="range"/);
assert.match(menu, /Other sounds/);
assert.match(menu, /<summary>How Drive By Ear works<\/summary>/);
assert.match(menu, /class="audio-guide-intro"/);
assert.match(menu, /class="audio-guide-basics"/);
assert.match(menu, /Steer <strong>toward<\/strong> the warm guiding hum/);
assert.doesNotMatch(menu, /steer away|Steer away/i, 'The current ribbon points toward the correction and must never inherit the retired Slider instruction');
for (const heading of [
  'Start here',
  'The guiding ribbon',
  'Pace notes',
  'Off-road recovery',
  'Drift and grip',
  'Nearby rivals',
  'Wrong way',
  'Sound balance and priority'
]) {
  assert.match(menu, new RegExp(`>${heading.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}<`), `The DBE guide must include ${heading}`);
}
assert.match(menu, /one to three short beeps/);
assert.match(menu, /delayed extra beep on the same side marks a long corner/);
assert.match(menu, /centred gravel texture/);
assert.match(menu, /Tyre noise stays centred/);
assert.match(menu, /heads-up rather than a continuous tracker/);
assert.match(menu, /repeating double falling tone/);
assert.match(menu, /Pace notes are deliberately prominent/);
assert.match(menu, /saveDriveByEarEnabled\(enabled\)/);
assert.match(menu, /setAudioEnabled/);
assert.match(menu, /setDriveByEarEnabled/);
assert.match(menu, /setBalance/);
assert.match(menu, /driveByEarGraphAvailable === false/);
assert.match(menu, /location\?\.reload/);
assert.match(menu, /dialog\.showModal/);
assert.match(menu, /aria-labelledby', 'audioSettingsTitle'/);

assert.match(menu, /document\.querySelector\('\.nuke-dialog-icon'\)\?\.remove\(\)/);
assert.match(menu, /document\.querySelector\('\.nuke-effect'\)\?\.remove\(\)/);
assert.match(menu, /event\.stopImmediatePropagation\(\)/);
assert.match(menu, /globalThis\.__turnResetRivals\?\.\(\)/);
assert.match(controls, /Reset Rivals/);
assert.match(controls, /globalThis\.__turnResetRivals/);
assert.match(backToLot, /Back to Lot/);
assert.match(main, /globalThis\.__turnResetRivals = resetRivals/);

assert.match(menu, /closest\('\.chip'\)/);
assert.match(menu, /classList\.contains\('is-invalid-lap'\)/);
assert.match(menu, /new MutationObserver\(\(\) => syncLapValidity\(\)\)/);
assert.match(menu, /classList\.toggle\('is-lap-invalid', invalid\)/);
assert.match(menu, /classList\.add\('is-lap-invalid-pulse'\)/);
assert.match(menu, /boostHud\?\.classList\.toggle\('is-racing', racing\)/);
assert.match(menu, /event\.detail\?\.running === true/);
assert.match(menu, /event\.detail\?\.reason === 'race-reset'/);
assert.doesNotMatch(menu, /setInterval|setAnimationLoop/);

assert.match(spectate, /rank: lap \? spectate\.index \+ 1 : null/);
assert.match(spectate, /class="spectate-rank"/);
assert.match(spectate, /rankEl\.textContent = current\.rank \? `\$\{current\.rank\}\.` : ''/);
assert.match(spectate, /spectateButton\.hidden = !current\.available/);

assert.match(trackSelect, /--selected-track-accent/);
assert.match(trackSelect, /track\?\.accent \|\| '#8ce99a'/);
assert.match(menuCss, /\.utility-group\[data-menu-state="staged"\]/);
assert.match(menuCss, /\.utility-group\[data-menu-state="racing"\] \.back-to-start-button/);
assert.match(menuCss, /\.back-to-start-button\.is-lap-invalid \{\s*background: #ff6b6b;/s);
assert.match(menuCss, /@keyframes turn-restart-invalid-pulse/);
assert.match(menuCss, /prefers-reduced-motion: reduce/);
assert.match(menuCss, /\.utility-group\[data-menu-state="hidden"\]/);
assert.match(polishCss, /\.nuke-dialog-icon,\s*\.nuke-effect \{\s*display: none !important;/s);
assert.match(polishCss, /\.audio-settings-dialog::backdrop/);
assert.match(polishCss, /\.audio-guide-content/);
assert.match(polishCss, /\.audio-guide-basics/);
assert.match(polishCss, /\.audio-guide-section/);
assert.match(polishCss, /\.audio-guide-card\[open\] \{\s*grid-column: 1 \/ -1;/s, 'The expanded guide must use the full compact landscape dialog width');
assert.match(polishCss, /\.track-select-continue \{\s*background: var\(--selected-track-accent/s);
assert.match(polishCss, /\.boost-hud\.is-racing > span \{\s*display: none;/s);
assert.match(polishCss, /\.spectate-rank/);

console.log(`TURN ${release.id} menu and expanded Drive By Ear guide regressions passed.`);
