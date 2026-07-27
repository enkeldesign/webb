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

const [index, releaseSource, app, menu, controls, backToLot, main, css, spectate] = await Promise.all([
  fs.readFile(new URL('../../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/in-game-menu.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/gameplay-controls.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/back-to-lot.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/main.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/in-game-menu.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/spectate.js', import.meta.url), 'utf8')
]);

const release = JSON.parse(releaseSource);
assert.match(index, new RegExp(`TURN v${release.version.replaceAll('.', '\\.')} · Build ${release.id.replaceAll('.', '\\.')}`));
assert.match(index, new RegExp(`in-game-menu\\.css\\?build=${release.cacheKey}`));
assert.match(index, /id="calibrateButton"[^>]*>Recalibrate<\/button>/);
assert.match(index, /id="resetButton"[^>]*>Restart Lap<\/button>/);
assert.match(app, /await import\(withBuild\('\.\/ui\/in-game-menu\.js'\)\)/);
assert.match(menu, /backToStartButton\.textContent = 'Restart Lap'/);
assert.match(menu, /Restart the current lap from the start line/);
assert.match(menu, /inGameMenuVisibilityFor\(runtime\.state\.mode\)/);
assert.doesNotMatch(menu, /state\.speed/);
assert.match(menu, /backToStartButton\.hidden = !visibility\.backToStart/);
assert.match(menu, /backToLotButton\.hidden = !visibility\.startActions/);
assert.match(menu, /recalibrateButton\.hidden = !visibility\.startActions/);
assert.match(menu, /soundGuideButton\.hidden = !visibility\.startActions/);
assert.match(menu, /resetRivalsButton\.hidden = !visibility\.startActions/);
assert.match(menu, /const buttonOrder = \[\s*backToLotButton,\s*recalibrateButton,\s*soundGuideButton,\s*resetRivalsButton,\s*spectateButton,\s*backToStartButton\s*\]/);
assert.match(menu, /button\.textContent = 'Sound Guide'/);
assert.match(menu, /<h2 id="soundGuideTitle">DRIVE BY SOUND<\/h2>/);
assert.match(menu, /<h3 id="soundGuideHow">HOW TO DRIVE<\/h3>/);
assert.match(menu, /<h3 id="soundGuideLegend">SOUND GUIDE<\/h3>/);
for (const heading of [
  'PACE NOTES',
  'TRAJECTORY SLIDER',
  'DRIFT',
  'OFF ROAD',
  'SOUND LAYERS',
  'RIVAL NEAR',
  'WRONG WAY'
]) {
  assert.match(menu, new RegExp(`<h4>${heading}<\\/h4>`), `Sound Guide must explain ${heading}`);
}
assert.match(menu, /one to three dry beeps/);
assert.match(menu, /A delayed echo marks a long corner/);
assert.match(menu, /Two groups describe linked corners in order/);
assert.match(menu, /A soft tonal Slider guides your steering/,
  'The guide must describe the quieter sustained timbre');
assert.match(menu, /Steer toward it/,
  'The one steering grammar must remain explicit');
assert.match(menu, /centred gravel sound marks the surface/,
  'Surface state must be explained as non-directional');
assert.match(menu, /aims toward a point ahead on the racing line/,
  'The guide must explain recovery as road plus heading alignment');
assert.match(menu, /Follow it until the gravel fades/,
  'Returning to asphalt must have an audible completion condition');
assert.match(menu, /The Slider is directional\. Surface and drift stay centred/,
  'The guide must distinguish steering from vehicle and surface information');
assert.match(menu, /Off road, the Slider handles both route recovery and direction instead/,
  'Wrong Way must not compete with off-road recovery');
assert.doesNotMatch(menu, /RECOVERY BEACON|Steer away|continuous textured sound|TURN RIBBON|TURN PULSE|ROAD EDGE|CORNER FLOW|AIRPORT/);
assert.match(menu, /dialog\.showModal/);
assert.match(menu, /aria-labelledby', 'soundGuideTitle'/);
assert.match(menu, /closest\('\.chip'\)/);
assert.match(menu, /classList\.contains\('is-invalid-lap'\)/);
assert.match(menu, /new MutationObserver\(\(\) => syncLapValidity\(\)\)/);
assert.match(menu, /classList\.toggle\('is-lap-invalid', invalid\)/);
assert.match(menu, /classList\.add\('is-lap-invalid-pulse'\)/);
assert.doesNotMatch(menu, /setInterval|setAnimationLoop/);
assert.match(controls, /Reset Rivals/);
assert.match(controls, /globalThis\.__turnResetRivals/);
assert.match(backToLot, /Back to Lot/);
assert.match(main, /globalThis\.__turnResetRivals = resetRivals/);
assert.match(spectate, /spectateButton\.hidden = !current\.available/);
assert.match(css, /\.utility-group\[data-menu-state="staged"\]/);
assert.match(css, /\.utility-group\[data-menu-state="racing"\] \.back-to-start-button/);
assert.match(css, /\.sound-guide-dialog::backdrop/);
assert.match(css, /\.sound-guide-list \{/);
assert.match(css, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
assert.match(css, /\.back-to-start-button\.is-lap-invalid \{\s*background: #ff6b6b;/s);
assert.match(css, /@keyframes turn-restart-invalid-pulse/);
assert.match(css, /prefers-reduced-motion: reduce/);
assert.match(css, /\.utility-group\[data-menu-state="hidden"\]/);

console.log(`TURN ${release.id} state-aware menu and recovery UX Sound Guide passed.`);
