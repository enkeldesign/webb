import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { HOW_TO_PLAY_DISCLOSURE_IDS } from '../turn/achievements/learning-progress.js';

const [app, guide, css, components, homeReset, roadbook, resetCss, rivalStorage, trackManager, scorekeeper] = await Promise.all([
  fs.readFile(new URL('../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/ui/how-to-play-guide.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/m8-how-to-play-r126.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/settings-components-r141.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/ui/home-rival-reset.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/roadbook/roadbook.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/rival-reset-context-r127.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/race/rival-storage.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/track-manager.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/scoring/scorekeeper-records.js', import.meta.url), 'utf8')
]);

assert.match(app, /m8-how-to-play-r126\.css\?revision=r220-overcharge-disclosure/);
assert.match(app, /settings-components-r141\.css\?revision=r220-overcharge-disclosure/);
assert.match(app, /data-turn-m8-how-to-play/);
assert.match(app, /data-turn-settings-components/);
assert.match(app, /installStylesheet\('\.\/rival-reset-context-r127\.css', 'data-turn-rival-reset-context'\)/);
assert.match(app, /how-to-play-guide\.js\?revision=r241-learning-achievements/);
assert.match(app, /installHowToPlayGuide\(\)/);
assert.match(app, /home-rival-reset\.js\?revision=r127-contextual/);
assert.match(app, /installHomeRivalReset\(\)/);
assert.ok(
  app.indexOf('await installM8HomeNavigation()') < app.indexOf('installHowToPlayGuide()'),
  'The guide enhancer must run only after the How to Play dialog exists'
);
assert.ok(
  app.indexOf('await installM8HomeNavigation()') < app.indexOf('installHomeRivalReset()'),
  'The contextual reset enhancer must run only after the shared Settings dialog exists'
);

// HOW TO PLAY (#748, #1130): after the tutorials, a QUICK REFERENCE of what every player
// has, then what the Trophy Road unlocks: taught once it is the player's, and before then
// named with where it unlocks. Only TURN-specific teaching, each card with a real control.
assert.match(guide, /GUIDE_VERSION = 'r442-how-to-play-remake'/);
const layout = [
  "sectionTitle(documentRef, 'm8QuickReferenceTitle', 'QUICK REFERENCE')",
  "variantCard(documentRef, STEER_CARD, 'data-steer-guide')",
  'QUICK_REFERENCE.map((card) => guideCard(documentRef, card))',
  "variantCard(documentRef, BOOST_CARD, 'data-boost-guide')",
  'guideCard(documentRef, RIVALS_CARD)',
  'driveByEarCard(documentRef)',
  "sectionTitle(documentRef, 'm8TrophyRoadTitle', 'ON THE TROPHY ROAD')",
  'TROPHY_ROAD_CARDS.flatMap((card) => [guideCard(documentRef, card), lockedCard(documentRef, card)])'
].map((part) => guide.indexOf(part));
assert.ok(layout.every((at, index) => at > 0 && (index === 0 || at > layout[index - 1])),
  'QUICK REFERENCE (STEER, DRIVE PAD, BOOST, RIVALS, Drive By Ear), then ON THE TROPHY ROAD');

// STEER teaches the steering chosen in SETTINGS (#748, SOL): device rotation or on-screen.
assert.match(guide, /title: 'STEER'/);
assert.match(guide, /demo: Object\.freeze\(\{ motion: createSteerDemo, manual: createManualSteerDemo \}\)/);
assert.match(guide, /<strong>RECALIBRATE<\/strong> sets it again at any time/);
assert.match(guide, /Rather not tilt\? Choose <strong>On-screen steering<\/strong> in SETTINGS/);
assert.match(guide, /Drag the <strong>steering control<\/strong> left and right with one thumb while the other drives/);
assert.match(guide, /the arrow keys or A and D steer/);
assert.match(guide, /Rather turn the device\? Choose <strong>Device rotation<\/strong> in SETTINGS/);
assert.match(guide, /getItem\('turn-steering-mode-v1'\) === 'manual'\) return 'manual'/);
assert.match(guide, /typeof globalThis\.DeviceMotionEvent === 'undefined' \? 'manual' : 'motion'/,
  'The same choice m8-home.js makes: on-screen when chosen or without motion sensors');
assert.match(guide, /showVariant\(dialog\.querySelector\(`\[data-guide-topic="\$\{STEER_CARD\.id\}"\]`\), 'data-steer-guide', steeringMode\(\)\)/);

assert.match(guide, /title: 'DRIVE PAD'/);
assert.match(guide, /slide between <strong>GAS<\/strong>, <strong>DRIFT<\/strong>, <strong>BOOST<\/strong> and <strong>BRAKE<\/strong>/);
assert.match(guide, /While using DRIFT, slide outward past it into <strong>LOCK<\/strong> for a stronger slide/);
assert.match(guide, /BRAKE stops at zero without reversing; to back up, hold BRAKE and slide outward into <strong>REVERSE<\/strong>/);
assert.match(guide, /Staying on the track is <strong>clean driving<\/strong>, which some perks and achievements reward/);

// BOOST: OVERCHARGE is taught only once it is the player's (#1150, #1130, SOL).
assert.match(guide, /title: Object\.freeze\(\{ boost: 'BOOST', overcharge: 'BOOST AND OVERCHARGE' \}\)/);
assert.match(guide, /<strong>DRIFT<\/strong> fills <strong>BOOST<\/strong> as you slide\. Slide to BOOST to spend it as a burst of speed/);
assert.match(guide, /<p class="m8-guide-note"><strong>OVERCHARGE unlocks with DRIFT ATTACK<\/strong> on the Trophy Road\.<\/p>/);
for (const step of ['FILL', 'BUILD', 'CATCH', 'SPEND']) {
  assert.match(guide, new RegExp(`<li><strong>${step}</strong><span>`), `OVERCHARGE: ${step}`);
}
assert.match(guide, /At its peak, uncaught OVERCHARGE leaks even while you keep using DRIFT/);
// The OVERCHARGE part of a BOOST, stronger than BOOST alone, is its KICK (Erik, #1232):
// TORQUE's copy names it.
assert.match(guide, /<li><strong>SPEND<\/strong><span>Slide to BOOST\. OVERCHARGE burns first, as a stronger burst called KICK\.<\/span><\/li>/);
assert.match(guide, /const boostKind = overchargeUnlocked\(\) \? 'overcharge' : 'boost'/);
assert.doesNotMatch(guide, /catch-and-use-overcharge/, 'One BOOST card, without a nested OVERCHARGE disclosure');

assert.match(guide, /title: 'RIVALS'/);
assert.match(guide, /You race recordings of your own fastest laps, not computer drivers/);
assert.match(guide, /The <strong>Track sheet<\/strong> keeps your records for every track/);
assert.doesNotMatch(guide, /Choose a track|pick your car/, 'No general racing-game instructions');

// ON THE TROPHY ROAD, in the order it unlocks them.
for (const [id, rewardId, title] of [['drift-points', 'drift-attack', 'DRIFT ATTACK'], ['shift', 'shift', 'SHIFT'], ['flow-points', 'flow', 'FLOW']]) {
  assert.match(guide, new RegExp(`id: '${id}',\\s*rewardId: '${rewardId}',\\s*title: '${title}'`), `${title} unlocks with ${rewardId}`);
}
assert.match(guide, /LOCKED · \$\{threshold\} TROPHIES/);
assert.match(guide, /<p class="turn-sr-only">Unlocks at \$\{threshold\} trophies on the Trophy Road\.<\/p>/);
assert.match(guide, /if \(card\) card\.hidden = !unlocked;\s*if \(locked\) locked\.hidden = unlocked;/,
  'Taught once unlocked; before then, only named');
assert.match(guide, /dialog\.addEventListener\('toggle', sync\);\s*globalThis\.addEventListener\?\.\('turn:trophy-road-updated', sync\);/);
assert.match(guide, /<strong>DRIFT ATTACK<\/strong> scores your slides/);
assert.match(guide, /Exit cleanly to <strong>BANK<\/strong> it; a failed slide loses it, but never what you have banked/);
assert.match(guide, /Link slides to raise <strong>COMBO<\/strong>/);
assert.match(guide, /<strong>LAP<\/strong> is this lap, <strong>LAST<\/strong> your previous lap and <strong>BEST<\/strong> your record on this track/);
assert.match(guide, /<strong>SHIFT<\/strong> switches your car between two setups/);
assert.match(guide, /slide from GAS out into SHIFT to switch, and again to switch back/);
assert.doesNotMatch(guide, /does not add free power/,
  'SHIFT help should explain the mechanic positively rather than defend against an unstated misconception');
assert.match(guide, /<strong>FLOW<\/strong> scores linking different techniques, each at a moment it helps/);
// FLOW techniques and combos (#1149): every technique scoring/flow-runtime.js rewards.
assert.match(guide, /<details class="m8-guide-disclosure m8-overcharge-guide" data-how-to-play-disclosure="flow-combos">/);
for (const technique of ['DRIFT', 'LOCK', 'EXIT', 'BOOST', 'CATCH', 'SHIFT']) {
  assert.match(guide, new RegExp(`<li><strong>${technique}</strong><span>`), `FLOW lists ${technique}`);
}
assert.match(guide, /Each different technique within 5 seconds of the last raises COMBO, up to ×8/);
assert.match(guide, /<strong>DRIFT, EXIT, BOOST<\/strong>/);
assert.ok(!HOW_TO_PLAY_DISCLOSURE_IDS.includes('flow-combos'), 'Not part of the HOW TO PLAY achievement');

// Cards: a decorative icon (#748; the title names the card), the title a level-4 heading
// under its section's h3, and the panel's demo above its text.
assert.match(guide, /<summary><strong class="m8-guide-card-number has-icon" aria-hidden="true">\$\{icon\}<\/strong><span class="m8-guide-card-title" role="heading" aria-level="4">\$\{title\}<\/span><\/summary>/);
assert.match(guide, /<details class="m8-guide-card-disclosure" data-how-to-play-disclosure="\$\{id\}">/);
assert.match(guide, /TROPHY_ROAD_REWARD_ICONS\.(race|shift|drift|flow)/, 'The game\'s own icons where it has them');
assert.match(guide, /<h4>Drive By Ear™<\/h4>/);
assert.match(guide, /<h5 id="m8DbeBasics">Start here<\/h5>/);
assert.match(css, /\.m8-guide-card-number\.has-icon svg \{[\s\S]*stroke: currentColor;/);
assert.match(css, /\.m8-guide-grid \.m8-guide-section-title \{\s*grid-column: 1 \/ -1;/);
assert.match(css, /\.m8-guide-grid \.m8-guide-locked > \.m8-guide-card-number \{\s*--turn-pill: var\(--turn-difficulty-locked\);/);

// #748: every card acts out a real control. Pictures, hidden from assistive technology;
// their own classes, since other modules look for the real controls; the race's colour
// roles and motion; moving only while their card is open, one still frame under Reduced Motion.
const [demos, tokens, drivePad, gameplayCss, messageCss, inGameMenuCss, scoreFeedbackCss] = await Promise.all([
  fs.readFile(new URL('../turn/ui/how-to-play-demos.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/design-tokens.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/drive-pad.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/gameplay-v2.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/styles.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/in-game-menu.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/scoring/score-feedback.css', import.meta.url), 'utf8')
]);
const demoCode = demos.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
for (const demo of [
  /demo: \(documentRef\) => createDrivePadDemo\('drive', documentRef\)/,
  /boost: \(documentRef\) => createDrivePadDemo\('boost', documentRef\)/,
  /overcharge: \(documentRef\) => createDrivePadDemo\('overcharge', documentRef\)/,
  /demo: createRivalsDemo/,
  /demo: \(documentRef\) => createScoreDemo\('drift', documentRef\)/,
  /demo: \(documentRef\) => createDrivePadDemo\('shift', documentRef\)/,
  /demo: \(documentRef\) => createScoreDemo\('flow', documentRef\)/
]) assert.match(guide, demo);
assert.match(guide, /if \(demo\) shell\.querySelector\('\.m8-guide-card-panel'\)\.prepend\(demo\(documentRef\)\);/);
assert.match(demos, /function demoElement\(className, documentRef\) \{[\s\S]*?demo\.setAttribute\('aria-hidden', 'true'\);/);
const factories = [...demos.matchAll(/export function (create\w+)\([^)]*\) \{([\s\S]*?)\n\}/g)];
assert.equal(factories.length, 6);
// #1217: SPECTATE plays the same pad and steering back from a recorded lap. The pad takes
// the race's own state names (drive-pad.css), never animates on its own, follows the
// lap's hand, and under Reduced Motion still shows the lap's steering.
for (const name of ['is-gas-ready', 'is-drift-ready', 'is-drift-locking', 'is-brake-ready', 'is-reversing',
  'is-shift-available', 'is-shift-active']) {
  assert.match(drivePad, new RegExp(`\\.drive-stack[^{]*\\.${name}\\b`), `The race pad has ${name}`);
  assert.match(demoCode, new RegExp(`\\.turn-demo-stack\\[data-demo="replay"\\][^{]*\\.${name}\\b`), `and so does the replay pad`);
}
assert.match(demos, /createDrivePadDemo\(kind, documentRef = globalThis\.document\)/);
assert.match(demos, /export function createTiltDemo\(documentRef = globalThis\.document\)/);
assert.match(demoCode, /\[data-hand="left"\] \.turn-demo \.turn-demo-stack\[data-demo="replay"\] \{ margin-inline: 0 42px; transform: scaleX\(-1\); \}/);
assert.match(demoCode, /\[data-hand="right"\] \.turn-demo \.turn-demo-stack\[data-demo="replay"\] \{ margin-inline: 42px 0; transform: none; \}/);
assert.match(demoCode, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.turn-demo-stack\[data-demo="replay"\] :is\(\.turn-demo-thumb, \.turn-demo-bubble\) \{ transition: none; \}/);
assert.match(demoCode, /\.turn-demo-manual-steer:not\(\.is-replay\) > i \{ left: 24%; \}/, 'The still frame never pins a replay\'s steering');
assert.match(demoCode, /\.turn-demo-manual-steer\.is-replay > i \{\s*transform: translate\(calc\(-50% - var\(--turn-demo-steer, 0\) \* 39px\), -50%\);/);
assert.match(demoCode, /\.turn-demo-tilt \.turn-demo-device \{ transform: rotate\(calc\(var\(--turn-demo-steer, 0\) \* -16deg\)\); \}/);
for (const [, name, body] of factories) assert.match(body, /demoElement\(/, `${name} is a decorative demo`);
assert.doesNotMatch(demoCode, /(?<![\w-])(drive-(stack|pad\b|zone|gas|brake|drift|boost|lock|shift|reverse)|boost-hud|manual-steer\b|score-feedback|race-position-hud)/,
  'The demos never use the race controls\' classes');
assert.doesNotMatch(demoCode, /#[0-9a-f]{3,8}\b/i, 'Colours come from tokens');
assert.match(tokens, /:root\[data-theme="dark"\] \.turn-demo-pad,\n:root\[data-theme="dark"\] \.drive-pad \{/, 'The demo pad is dark like the real one');
const animated = [...demoCode.matchAll(/([^{}]+)\{[^{}]*animation:\s*turn-demo/g)].map(([, selector]) => selector.trim());
assert.ok(animated.length >= 30);
for (const selector of animated) assert.match(selector, /^details\[open\] /, `${selector} moves only in an open card`);
assert.match(demos, /@media \(prefers-reduced-motion: reduce\) \{\s*\.turn-demo,\s*\.turn-demo \*,\s*\.turn-demo \*::after \{ animation: none !important; \}/);
assert.match(demos, /@media \(forced-colors: active\)/);

// The drive pad and the BOOST bar read the race's own look and motion: the custom
// properties drive-pad.css and gameplay-v2.css declare, which the race's controls read
// too, so a change there changes both. Nothing the race declares is copied.
const rootOf = (css, comment) => css.match(new RegExp(`${comment}[\\s\\S]*?\\*/\\n:root \\{([^}]*)\\}`))[1];
const valuesOf = (block) => Object.fromEntries([...block.matchAll(/^\s*(--[\w-]+):\s*([^;]+);/gm)]
  .map(([, name, value]) => [name, value.replace(/\s+/g, ' ').trim()]));
const driveValues = valuesOf(rootOf(drivePad, "The drive pad's look and motion, in one place"));
const barValues = valuesOf(rootOf(gameplayCss, "The BOOST bar's look, in one place"));
assert.deepEqual(Object.keys(driveValues), [
  '--turn-drive-outline', '--turn-drive-divider', '--turn-drive-pad-radius', '--turn-drive-pad-shadow-x',
  '--turn-drive-pad-shadow-y', '--turn-drive-pad-rows', '--turn-drive-zone-pressed', '--turn-drive-bubble-pressed',
  '--turn-drive-bubble-radius', '--turn-drive-bubble-tuck', '--turn-drive-bubble-tuck-scale',
  '--turn-drive-bubble-slide', '--turn-drive-bubble-slide-easing', '--turn-drive-bubble-fade',
  '--turn-drive-bubble-colour-change'
]);
assert.deepEqual(Object.keys(barValues), [
  '--turn-boost-bar-height', '--turn-boost-bar-outline', '--turn-boost-bar-radius',
  '--turn-boost-bar-shadow-offset', '--turn-boost-bar-track-opacity', '--turn-boost-overcharge'
]);
// Their colours are design-tokens.css's roles, never literals of their own.
for (const [name, value] of Object.entries({ ...driveValues, ...barValues })) {
  assert.doesNotMatch(value, /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i, `${name} takes its colours from design-tokens.css`);
}
for (const role of ['--turn-control-pressed', '--turn-control-pressed-bubble', '--turn-control-overcharge-deep', '--turn-control-overcharge-light']) {
  assert.match(tokens, new RegExp(`^\\s*${role}: `, 'm'), `design-tokens.css declares ${role}`);
}
const driveRules = drivePad.replace(/:root \{[^}]*\}/, '');
const barRules = gameplayCss.replace(/:root \{[^}]*\}/, '');
for (const name of Object.keys(driveValues)) {
  assert.ok(driveRules.includes(`var(${name})`), `The race's drive pad reads ${name}`);
}
for (const name of Object.keys(barValues)) {
  assert.ok(barRules.includes(`var(${name})`), `The race's BOOST bar reads ${name}`);
  assert.ok(demoCode.includes(`var(${name})`), `The demo's BOOST bar reads ${name}`);
}
const driveShape = Object.keys(driveValues).filter((name) => !/-(slide|slide-easing|fade|colour-change)$/.test(name));
for (const name of driveShape) assert.ok(demoCode.includes(`var(${name})`), `The demo's drive pad reads ${name}`);
const lockBubble = driveRules.match(/\.drive-lock-bubble \{[\s\S]*?\n\}/)[0];
assert.match(lockBubble, /transform: translateX\(var\(--turn-drive-bubble-tuck\)\) scaleX\(var\(--turn-drive-bubble-tuck-scale\)\);\s*transform-origin: right center;/);
assert.match(lockBubble, /opacity var\(--turn-drive-bubble-fade\) ease-out,\s*transform var\(--turn-drive-bubble-slide\) var\(--turn-drive-bubble-slide-easing\),\s*background-color var\(--turn-drive-bubble-colour-change\) ease;/);
assert.match(demoCode, /--turn-demo-tucked: translateX\(var\(--turn-drive-bubble-tuck\)\) scaleX\(var\(--turn-drive-bubble-tuck-scale\)\);/);
assert.match(demoCode, /\.turn-demo-bubble \{[^}]*transform: var\(--turn-demo-tucked\);\s*transform-origin: right center;/);
assert.match(demoCode, /\.turn-demo-bar > b \{[^}]*background: var\(--turn-boost-overcharge\);/);
assert.doesNotMatch(demoCode, /translateX\(62%\)|scaleX\(0\.38\)|inset 0 0 0 (?:4\.5|3\.75)px|5\.25px 6px|-left-radius: 22\.5px|17\.25px|32% 44% 24%|cubic-bezier\((?:0)?\.2, ?0?\.88/,
  'The demos read the race\'s values instead of copying them');
// LOCK, SHIFT and OVERCHARGE: the race's bubbles and the demos read the same colour roles.
for (const [race, token, colour] of [
  [/\.drive-lock-bubble \{[^}]*background: var\(--turn-control-lock\);/, '--turn-control-lock', '#748ffc'],
  [/\.drive-stack\.is-drift-locking \.drive-lock-bubble \{\s*background: var\(--turn-control-overcharge\);/, '--turn-control-overcharge', '#8b5cf6'],
  [/\.controls \.drive-shift-bubble \{[^}]*background: var\(--turn-control-gas\);/, '--turn-control-gas', null],
  [/\.drive-stack\.is-shift-active \.drive-shift-bubble \{\s*background: var\(--turn-control-shift-on\);/, '--turn-control-shift-on', '#51cf66']
]) {
  assert.match(driveRules, race, `The race's bubble reads ${token}`);
  assert.ok(demoCode.includes(`var(${token})`), `The demo's bubble reads ${token}`);
  if (colour) assert.match(tokens, new RegExp(`${token}: ${colour};`), `${token} keeps its colour`);
}
// What the race keeps for itself (its bubbles' places and its smallest size, which
// short landscape and the race layout change) the demos match exactly.
for (const [race, demo] of [
  [/\.drive-lock-bubble \{[^}]*height: (calc\([^)]*\));/, /\.turn-demo-bubble\.is-lock \{[^}]*height: (calc\([^)]*\));/],
  [/\.controls \.drive-shift-bubble \{[^}]*top: (calc\([^)]*\));/, /\.turn-demo-bubble\.is-shift \{[^}]*top: (calc\([^)]*\));/],
  [/\.controls \.drive-shift-bubble \{[^}]*height: (calc\([^)]*\));/, /\.turn-demo-bubble\.is-shift \{[^}]*height: (calc\([^)]*\));/],
  [/\.controls \.drive-reverse-bubble \{[^}]*height: (calc\([^)]*\));/, /\.turn-demo-bubble\.is-reverse \{[^}]*height: (calc\([^)]*\));/],
  [/\.drive-lock-bubble \{[^}]*right: (calc\([^)]*\));/, /\.turn-demo-bubble \{[^}]*right: (calc\([^)]*\));/],
  [/--drift-lock-bubble-width: clamp\(([\d.]+px),/, /\.turn-demo-bubble\.is-lock \{[^}]*width: ([\d.]+px);/],
  [/--shift-bubble-width: clamp\(([\d.]+px),/, /\.turn-demo-bubble\.is-shift \{[^}]*width: ([\d.]+px);/],
  [/--reverse-bubble-width: clamp\(([\d.]+px),/, /\.turn-demo-bubble\.is-reverse \{[^}]*width: ([\d.]+px);/],
  [/--drive-pad-height: clamp\(([\d.]+px),/, /\.turn-demo-stack \{[^}]*height: ([\d.]+px);/]
]) assert.equal(demoCode.match(demo)[1], drivePad.match(race)[1], `${demo.source} matches the race`);

// A keyframe's place in the loop cannot be a custom property, so each step is laid out to
// last as long as the race's: a slide-out over --turn-drive-bubble-slide on the pad's
// curve with a --turn-drive-bubble-fade fade, never a substitute that reads as a turn in
// depth, and each colour change over --turn-drive-bubble-colour-change.
const msOf = (value) => Number(value.match(/^(\d+)ms$/)[1]);
const slideMs = msOf(driveValues['--turn-drive-bubble-slide']);
const fadeMs = msOf(driveValues['--turn-drive-bubble-fade']);
const colourMs = msOf(driveValues['--turn-drive-bubble-colour-change']);
const stopsOf = (name) => [...demoCode.match(new RegExp(`@keyframes ${name} \\{([\\s\\S]*?)\\n  \\}`))[1]
  .matchAll(/^\s*([\d.%, ]+)\{([^}]*)\}/gm)].map(([, at, body]) => ({ at: at.split(',').map((stop) => parseFloat(stop)), body }));
const loopMs = (name) => Number(demoCode.match(new RegExp(`${name} (\\d+)s`))[1]) * 1000;
const segmentMs = (name, from, to) => Math.round((to.at[0] - from.at.at(-1)) * loopMs(name) / 100);
const slides = [...demoCode.matchAll(/@keyframes (turn-demo-[a-z]+-(?:lock|reverse)-slide) \{/g)].map(([, name]) => name);
assert.deepEqual(slides, ['turn-demo-drive-lock-slide', 'turn-demo-drive-reverse-slide', 'turn-demo-boost-lock-slide', 'turn-demo-overcharge-lock-slide']);
for (const name of slides) {
  const slide = stopsOf(name);
  const fadeName = name.replace(/-slide$/, '-fade');
  const fade = stopsOf(fadeName);
  assert.equal(segmentMs(name, slide[0], slide[1]), slideMs, `${name}: out in ${slideMs} ms`);
  assert.equal(segmentMs(name, slide[1], slide[2]), slideMs, `${name}: back in ${slideMs} ms`);
  for (const stop of slide.slice(0, 2)) {
    assert.match(stop.body, /animation-timing-function: var\(--turn-drive-bubble-slide-easing\);/, `${name} slides on the pad's curve`);
  }
  assert.equal(segmentMs(fadeName, fade[0], fade[1]), fadeMs, `${fadeName}: in over ${fadeMs} ms`);
  assert.equal(segmentMs(fadeName, fade[1], fade[2]), fadeMs, `${fadeName}: out over ${fadeMs} ms`);
}
const colourChanges = ['turn-demo-drive-lock-colour', 'turn-demo-drive-reverse-colour', 'turn-demo-shift-on', 'turn-demo-shift-dot'];
for (const name of colourChanges) {
  const stops = stopsOf(name);
  for (let i = 1; i < stops.length; i += 1) {
    assert.equal(segmentMs(name, stops[i - 1], stops[i]), colourMs, `${name}: changes over ${colourMs} ms`);
  }
}
// DRIFT ATTACK and FLOW (#1189): every score is a held step, never an interpolated
// number, because Safari does not redraw a counter while a registered number animates.
// The DRIFT example builds, BANKS into LAP, links into COMBO ×2, builds faster and banks
// again, each value held long enough to read.
// The DRIFT count is generated, so these read the stylesheet the demos install.
const { createScoreDemo } = await import('../turn/ui/how-to-play-demos.js');
let installedCss = '';
const fakeDocument = {
  head: { appendChild(node) { installedCss = node.textContent; } },
  getElementById: () => null,
  createElement: () => ({ dataset: {}, className: '', setAttribute() {}, append() {}, set innerHTML(html) { this.html = html; } })
};
const driftDemo = createScoreDemo('drift', fakeDocument).html;
const flowDemo = createScoreDemo('flow', fakeDocument).html;
const keyframesOf = (name) => installedCss.match(new RegExp(`@keyframes ${name} \\{([\\s\\S]*?)\\n  \\}`))[1];
const scoreAnimations = [...installedCss.matchAll(/\{[^{}]*animation:\s*(turn-demo-[a-z-]+) (\d+)s ([^;]*?) infinite/g)]
  .filter(([, name]) => keyframesOf(name).includes('--turn-demo-score'));
assert.deepEqual(scoreAnimations.map(([, name]) => name).sort(), ['turn-demo-drift-score', 'turn-demo-flow-score']);
for (const [, name, seconds, timing] of scoreAnimations) {
  assert.equal(timing, 'steps(1, end)', `${name} holds each score instead of interpolating it`);
  const held = [...keyframesOf(name).matchAll(/^\s*([\d.]+)% \{ --turn-demo-score: (\d+); \}/gm)].map(([, at]) => Number(at));
  for (let i = 1; i < held.length; i += 1) {
    assert.ok((held[i] - held[i - 1]) * Number(seconds) * 10 >= 200, `${name}: each score holds at least 200 ms`);
  }
}
const scoreValues = [...keyframesOf('turn-demo-drift-score').matchAll(/--turn-demo-score: (\d+);/g)].map(([, value]) => Number(value));
assert.equal(Math.max(...scoreValues.slice(0, scoreValues.indexOf(0, 1))), 300, 'The first slide banks 300');
assert.equal(Math.max(...scoreValues), 600, 'The linked slide banks 600');
for (const step of ['<i>×1</i><i>×2</i>', '<i>1,240</i><i>1,540</i><i>2,140</i>', '<strong>✓ BANKED</strong><b>+300</b>',
  '<strong>DRIFT ×2</strong>', '<strong>✓ BANKED ×2</strong><b>+600</b>']) {
  assert.ok(driftDemo.includes(step), `The DRIFT example shows ${step}`);
}
// Both show the race's side gauge beside the score, unfolding while scoring.
for (const html of [driftDemo, flowDemo]) assert.match(html, /<div class="turn-demo-paper">[\s\S]*<\/div>\s*<div class="turn-demo-gauge"><i><\/i><\/div>/);
for (const kind of ['drift', 'flow']) {
  assert.match(demoCode, new RegExp(`details\\[open\\] \\.turn-demo-score\\[data-demo="${kind}"\\] \\.turn-demo-gauge \\{ animation:`));
  assert.match(demoCode, new RegExp(`details\\[open\\] \\.turn-demo-score\\[data-demo="${kind}"\\] \\.turn-demo-gauge > i \\{ animation:`));
  assert.match(demoCode, new RegExp(`\\.turn-demo-score\\[data-demo="${kind}"\\] \\.turn-demo-gauge \\{ opacity: [\\d.]+; transform: none; \\}`),
    `Reduced Motion: the ${kind} gauge stays out in the still frame`);
}
// At the race's own size and place: it tucks under the score's edge, inset from its top
// and bottom, with the race's outline, corners and fill inset.
const raceGauge = (name) => scoreFeedbackCss.match(new RegExp(`${name}: ([\\d.]+px)`))[1];
const demoGauge = demoCode.match(/\.turn-demo-gauge \{([^}]*)\}/)[1];
assert.match(demoGauge, new RegExp(`top: ${raceGauge('--score-feedback-gauge-inset-y')};`));
assert.match(demoGauge, new RegExp(`left: calc\\(100% - ${raceGauge('--score-feedback-gauge-overlap')}\\);`));
const raceMeter = scoreFeedbackCss.match(/\.score-feedback-meter,\s*\.score-feedback-gauge \{([^}]*)\}/)[1];
for (const property of ['border', 'border-radius']) {
  assert.equal(demoGauge.match(new RegExp(`\\n\\s*${property}: ([^;]+);`))[1], raceMeter.match(new RegExp(`\\n\\s*${property}: ([^;]+);`))[1]);
}
assert.equal(demoCode.match(/\.turn-demo-gauge > i \{[^}]*inset: ([\d.]+px);/)[1],
  scoreFeedbackCss.match(/\.score-feedback-meter > i,\s*\.score-feedback-gauge > i \{[^}]*inset: ([\d.]+px);/)[1]);

// STEERING CENTRED fades in as the race's message does, and RECALIBRATE blinks twice in 960 ms.
assert.match(messageCss, /\.message \{[\s\S]*?transition: opacity 140ms ease;/);
assert.match(inGameMenuCss, /animation: turn-recalibrate-centred 960ms linear 1;/);
const message = stopsOf('turn-demo-steer-message');
assert.equal(segmentMs('turn-demo-steer-message', message[0], message[1]), 140);
assert.deepEqual(stopsOf('turn-demo-steer-blink').map(({ at }) => at), [[0, 59, 65], [56, 62]],
  'Yellow for 240 ms, twice, 480 ms apart, as in-game-menu.css blinks it');
assert.doesNotMatch(guide, /turn:open-how-to-play|installTargetedOpening|__turnOpenHowToPlaySection|TARGET_SECTION_ID/,
  'Removing the scorekeeper info buttons must also remove their deep-link event wiring');

assert.doesNotMatch(scorekeeper, /score-feedback-info|data-score-feedback-help|turn:open-how-to-play|About .* scoring/,
  'The live scorekeeper must stay visually clean and contain no scoring help controls');
assert.doesNotMatch(scorekeeper, /setInterval|setTimeout|requestAnimationFrame/,
  'The scorekeeper record helper must remain event-driven and add no racing-loop work');

assert.match(guide, /<details class="m8-dbe-guide" data-how-to-play-disclosure="drive-by-ear-sounds">/);
assert.match(
  guide,
  /<summary><span class="m8-disclosure-symbol" aria-hidden="true"><\/span><span>Explore the Drive By Ear sounds<\/span><\/summary>/
);
assert.match(
  guide,
  /<summary><span class="m8-disclosure-symbol" aria-hidden="true"><\/span><span>Explore the Drive By Ear sounds<\/span><\/summary>[\s\S]*<div class="m8-dbe-guide-panel">[\s\S]*<div class="m8-dbe-guide-content">/,
  'Every expanded Drive By Ear help section must remain inside one visual disclosure panel'
);
assert.ok(
  guide.indexOf('m8-disclosure-symbol') < guide.indexOf('Explore the Drive By Ear sounds'),
  'The decorative state symbol must be grouped immediately before the summary label'
);
assert.match(guide, /Guiding ribbon/);
assert.match(guide, /Pace notes/);
assert.match(guide, /Drift and grip/);
assert.match(guide, /Engine and BOOST/);
assert.match(guide, /Off-road recovery/);
assert.match(guide, /Nearby rivals/);
assert.match(guide, /Wrong way/);
assert.match(guide, /With a screen reader/);
assert.match(guide, /Headphones provide the clearest left and right information/);
assert.match(guide, /complete non-visual play/);
assert.match(guide, /Drive By Ear supplies the spatial information needed to steer and stay on course/);
assert.match(guide, /Drive By Ear provides the continuous spatial information/);
assert.match(guide, /root\.querySelector\('#dbeGuideScreenReaders'\)/, 'The in-race guide must replace its abbreviated screen-reader copy before it can be shown');
assert.doesNotMatch(guide, /[;.]\s*DBE\s+(?:supplies|provides)/, 'Player-facing help must always spell out Drive By Ear');

assert.match(guide, /Pace notes are swipes/);
assert.match(guide, /Higher pitch means a tighter bend, a quick swipe a short bend and a slower swipe a long one/);
assert.match(guide, /A bend of more than 120° is told as linked swipes/);
assert.match(guide, /Pace notes need stereo/);
assert.doesNotMatch(guide, /\bbeeps?\b|bip-|lengthMarker/i, 'BIP/BEEP pace notes are retired (#909)');
assert.match(guide, /root\.querySelector\('#dbeGuidePaceNotes'\)/, 'The in-race audio guide must receive the same swipe language too');

assert.match(css, /\.m8-how-dialog[\s\S]*-webkit-text-size-adjust: 100%[\s\S]*text-size-adjust: 100%/, 'Opening details must not trigger iOS text autosizing');
assert.match(css, /\.m8-how-dialog \.m8-dialog-card[\s\S]*overscroll-behavior-y: contain/);
assert.match(css, /scroll-padding-block-end: max\(24px, env\(safe-area-inset-bottom\)\)/);
assert.match(css, /scrollbar-gutter: stable/, 'The dialog width must remain stable when expanded content creates a scrollbar');
assert.match(css, /\.m8-guide-grid section\.m8-guide-card-shell[\s\S]*background: transparent[\s\S]*box-shadow: none/,
  'Ordinary guide sections become neutral grid shells around the disclosure card');
assert.match(css, /\.m8-guide-card-disclosure[\s\S]*border: 4px solid var\(--turn-outline\)[\s\S]*border-radius: 15px[\s\S]*box-shadow: 3\.75px 3\.75px 0 var\(--turn-shadow-color\)/);
assert.match(css, /\.m8-guide-card-disclosure > summary[\s\S]*display: grid[\s\S]*cursor: pointer/);
assert.match(css, /\.m8-guide-card-disclosure\[open\] > summary[\s\S]*border-bottom: 3px solid/);
assert.match(css, /\.m8-guide-card-disclosure > summary::after[\s\S]*content: "\+"/);
assert.match(css, /\.m8-guide-card-disclosure\[open\] > summary::after[\s\S]*content: "−"/);
assert.match(css, /\.m8-guide-card-panel[\s\S]*overflow-anchor: none/);
assert.match(css, /\.m8-dbe-guide[\s\S]*border: 3px solid[\s\S]*border-radius: 12px[\s\S]*overflow: clip/, 'The Drive By Ear summary and expanded content must share one containing card');
assert.match(css, /\.m8-guide-disclosure/,
  'The Overcharge lesson must share the native nested disclosure component without masquerading as Drive By Ear');
assert.match(css, /\.m8-overcharge-steps[\s\S]*display: grid/);
assert.match(css, /\.m8-overcharge-leak[\s\S]*border-top: 2px solid/);
assert.match(css, /\.m8-dbe-guide > summary/);
assert.match(css, /cursor: pointer/);
assert.match(css, /\.m8-dbe-guide\[open\] > summary[\s\S]*border-bottom: 3px solid/, 'The expanded panel must stay visibly attached below the summary');
assert.match(css, /summary:focus-visible/);
assert.match(css, /\.m8-dbe-guide-panel[\s\S]*padding: 14px 14px max\(36px, env\(safe-area-inset-bottom\)\)[\s\S]*overflow-anchor: none/, 'The bottom screen-reader card needs settling room without scroll anchoring');
assert.match(css, /\.m8-dbe-guide-content[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
assert.match(css, /\.m8-dbe-guide-content p,[\s\S]*font-size: max\(var\(--turn-text-floor, 11px\), 0\.75rem\)/, 'Expanded paragraphs keep the same explicit text size');
assert.match(css, /@media \(max-width: 540px\)[\s\S]*grid-template-columns: 1fr/);

assert.match(components, /\.m8-guide-wide[\s\S]*background: var\(--turn-surface-raised\) !important/);
assert.match(components, /\.m8-dbe-guide > summary[\s\S]*background: var\(--turn-disclosure-trigger\)/);
assert.match(components, /\.m8-guide-disclosure > summary[\s\S]*background: var\(--turn-disclosure-trigger\)/);
assert.match(components, /\.m8-disclosure-symbol::before[\s\S]*content: '\+'/);
assert.match(components, /\.m8-dbe-guide\[open\] \.m8-disclosure-symbol::before[\s\S]*content: '−'/);
assert.match(components, /\.m8-guide-disclosure\[open\] \.m8-disclosure-symbol::before[\s\S]*content: '−'/);
assert.match(components, /\.m8-dbe-guide-panel,[\s\S]*background: var\(--turn-disclosure-panel\)/);
assert.doesNotMatch(components, /#eaf9ef/);
assert.doesNotMatch(`${guide}\n${css}\n${components}`, /setInterval|setTimeout|@keyframes|animation:/, 'Help content must add no runtime loop or distracting motion');

assert.deepEqual([...HOW_TO_PLAY_DISCLOSURE_IDS], [
  'turn-device-to-steer', 'drive-with-one-thumb', 'build-and-use-overcharge', 'choose-track-and-car', 'drive-by-ear-sounds'
], 'LEARN TO PLAY counts the five QUICK REFERENCE parts every player can open, under their old ids');
for (const disclosureId of HOW_TO_PLAY_DISCLOSURE_IDS) {
  assert.match(guide, new RegExp(`['"]${disclosureId}['"]`),
    `How to Play must expose the stable ${disclosureId} progress id`);
}
assert.match(guide, /installDisclosureProgress\(dialog\)/);
assert.match(guide, /details\.addEventListener\('toggle'/);
assert.match(guide, /if \(!details\.open\) return/,
  'Closing a disclosure must never count as reading another part');
assert.match(guide, /HOW_TO_PLAY_DISCLOSURE_OPENED_EVENT/);
assert.match(guide, /dialog\.addEventListener\('close'/,
  'The learning achievement must wait until the modal closes before presenting feedback');
assert.match(guide, /LEARNING_FEEDBACK_READY_EVENT/);

assert.match(homeReset, /function homeIsOpen\(\)/);
assert.match(homeReset, /document\.body\.classList\.contains\('turn-home-open'\)/);
assert.match(homeReset, /const allTracks = homeIsOpen\(\)/);
assert.match(homeReset, /Remove every recorded personal rival from every track/);
assert.match(homeReset, /To reset only one track, use Settings at that track’s start line/);
assert.match(homeReset, /RESET ALL RIVALS/);
assert.match(homeReset, /Remove the recorded personal rivals for \$\{track\.name\}/);
assert.match(homeReset, /Rivals on other tracks will be kept/);
assert.match(homeReset, /resetButton\.textContent = 'RESET RIVALS'/);
assert.match(homeReset, /Remove the saved personal rivals and lap records for \$\{track\.name\}/);
assert.match(homeReset, /clearAllRivalsState/);
assert.match(homeReset, /TRACK_CATALOG\.map\(\(entry\) => entry\.id\)/);
assert.match(homeReset, /globalThis\.__turnResetRivals\?\.\(\)/, 'The race Settings path must use the existing active-track reset only');
assert.match(homeReset, /new CustomEvent\('turn:rivals-reset', \{\s*detail: \{ scope: 'all-tracks' \}/,
  'Resetting every track tells Home to reread its records');
assert.match(homeReset, /Personal rivals reset for \$\{track\.name\}/);
assert.match(homeReset, /raceResetButton\.textContent = 'RESET RIVALS'/);
assert.match(homeReset, /Remove the saved personal rivals and lap records for \$\{track\.name\}/);
assert.match(homeReset, /event\.stopImmediatePropagation\(\)/, 'The contextual handler must replace the old fixed-scope handlers rather than also running them');
assert.match(roadbook, /windowRef\.addEventListener\('turn:rivals-reset', refreshRecords\)/,
  'Home records reread after any reset');
assert.match(roadbook, /if \(generation !== thumbnailGeneration \|\| !model\.isConnected\) return;/,
  'Pending record thumbnails must not reappear after any reset');
assert.doesNotMatch(homeReset, /activateTrack/, 'Resetting rivals must never change tracks behind the player');

assert.match(resetCss, /\.m8-reset-rivals\.is-all-tracks/);
assert.match(resetCss, /\.m8-reset-confirm-button\.is-all-tracks \{\s*background: var\(--turn-action-reset\) !important;/,
  'RESET ALL RIVALS uses the reset role, a light warning red');
assert.match(resetCss, /\.m8-settings-dialog \.m8-reset-rivals,[\s\S]*background: var\(--m8-yellow\) !important/, 'The active-track Settings action must retain the standard yellow treatment');
assert.match(resetCss, /\.utility-group \.reset-rivals-button,[\s\S]*#ffd43b/, 'The direct start-line reset action must also remain yellow');

assert.match(rivalStorage, /export function clearAllRivalsState\(state, trackIds = \[\]\)/);
assert.match(rivalStorage, /for \(const key of \[rivalKey\(trackId\), ghostKey\(trackId\)\]\) \{[\s\S]*?localStorage\.removeItem\(key\)/,
  'The shared reset helper must remove both current rival and legacy ghost storage keys');
assert.match(rivalStorage, /state\.trackId = activeTrackId/, 'An all-track reset must preserve the runtime’s active track');
assert.match(rivalStorage, /syncPrimaryRivalState\(state\)/);
assert.match(trackManager, /clearRivalsState\(currentRuntime\.state, \{ trackId: activeTrackId \}\)/, 'The race Settings path must clear only the current track storage key');
assert.match(trackManager, /globalThis\.__turnResetRivals = resetCurrentTrackRivals/);

console.log('TURN collapsible How to Play cards, current player-facing copy, clean scorekeeper and contextual rival reset passed.');
