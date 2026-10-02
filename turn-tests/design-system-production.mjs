import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [design, dialogs, referenceCss, tokens, semantic, releaseSource, index, scale] = await Promise.all([
  fs.readFile(new URL('../turn/design.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/design-dialogs.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/design-reference.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/design-tokens.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/design-semantic.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/design-scale.css', import.meta.url), 'utf8')
]);

const release = JSON.parse(releaseSource);

for (const page of [design, dialogs]) {
  assert.match(page, /^<!doctype html>/i);
  assert.match(page, /<html lang="en">/);
  assert.match(page, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
  assert.doesNotMatch(page, /user-scalable=no/);
  assert.doesNotMatch(page, /<script\b/i, 'Design references must remain static');
  assert.doesNotMatch(page, /https?:\/\//i, 'Design references must remain dependency-free');
  assert.match(page, /href="\.\/design-tokens\.css\?revision=r162-social-sharing"/);
  assert.match(page, /href="\.\/design-semantic\.css\?revision=r162-social-sharing"/);
  assert.match(page, /href="\.\/design-reference\.css\?revision=r204-current-product-language"/);
  assert.match(page, /class="system-toolbar" aria-label="Design reference pages"/);
  assert.match(page, />Design system<\/a>[\s\S]*>Dialogs<\/a>[\s\S]*>Open TURN<\/a>/);
  assert.match(page, /href="\.\/" target="_blank" rel="noopener">Open TURN<\/a>/,
    'Open TURN must use a fresh browsing context');
  assert.match(page, new RegExp(`TURN ${escapeRegex(release.version)}`),
    'Current design references must identify the canonical production release');
  assert.match(page, new RegExp(`Build ${escapeRegex(release.id)}`, 'i'),
    'Current design references must identify the canonical production build');
}

assert.match(design, /href="\.\/design\.html" aria-current="page">Design system<\/a>/);
assert.match(dialogs, /href="\.\/design-dialogs\.html" aria-current="page">Dialogs<\/a>/);
assert.match(design, /Current product language · September 2026/);
assert.match(design, /Built from the game, not beside it\./);
assert.match(design, /what the shipped game actually does today instead of presenting an aspirational concept board/);
assert.doesNotMatch(design, /Normative production system · TURN 1\.7/);
assert.doesNotMatch(design, /TURN V1\.7\.0 · BUILD 2026\.08\.09-R163/);
assert.doesNotMatch(design, /TRACK PREVIEW|3D CAR VIEW|Actual components, not substitute illustrations/,
  'The current reference must use real structural specimens instead of the old placeholder-board vocabulary');

const primitivePalette = new Map([
  ['--turn-ink', '#08090a'],
  ['--turn-paper', '#fff8e8'],
  ['--turn-white', '#fffdf6'],
  ['--turn-road', '#44494f'],
  ['--turn-muted', '#d6d0c2'],
  ['--turn-yellow-600', '#ffbd12'],
  ['--turn-yellow-400', '#ffd43b'],
  ['--turn-yellow-200', '#ffe087'],
  ['--turn-yellow-100', '#fff0a8'],
  ['--turn-blue-600', '#35b8e7'],
  ['--turn-blue-500', '#38d9ff'],
  ['--turn-blue-300', '#68c8f2'],
  ['--turn-blue-200', '#8ed8ff'],
  ['--turn-blue-100', '#bdeeff'],
  ['--turn-pink-500', '#ea5da1'],
  ['--turn-pink-200', '#ff8caf'],
  ['--turn-pink-100', '#ffd1e6'],
  ['--turn-red-500', '#ff6b6b'],
  ['--turn-red-200', '#ff9b91'],
  ['--turn-green-500', '#8ce99a'],
  ['--turn-green-200', '#d9f5c2'],
  ['--turn-green-100', '#c8f5d0'],
  ['--turn-orange-500', '#ff7b54'],
  ['--turn-orange-200', '#ffb89f'],
  ['--turn-orange-100', '#ffd0ae']
]);

assert.equal(
  [...design.matchAll(/class="swatch" data-token="([^"]+)"/g)].length,
  primitivePalette.size,
  'The reference must show every primitive colour exactly once'
);
for (const [token, value] of primitivePalette) {
  assert.ok(tokens.includes(`${token}: ${value}`), `Missing primitive definition ${token}: ${value}`);
  assert.ok(design.includes(`data-token="${token}"`), `Missing primitive swatch ${token}`);
  assert.ok(design.includes(`<code>${token}</code>`), `Missing visible primitive variable ${token}`);
  assert.ok(design.includes(`<span>${value}</span>`), `Missing visible primitive value ${value}`);
}

const semanticMappings = new Map([
  ['--turn-surface-page', '--turn-paper'],
  ['--turn-surface-raised', '--turn-white'],
  ['--turn-action-primary', '--turn-pink-500'],
  ['--turn-action-share', '--turn-pink-500'],
  ['--turn-action-utility', '--turn-surface-page'],
  ['--turn-action-information', '--turn-blue-500'],
  ['--turn-action-game', '--turn-blue-500'],
  ['--turn-action-success', '--turn-green-500'],
  ['--turn-action-warning', '--turn-yellow-400'],
  ['--turn-action-danger', '--turn-red-500'],
  ['--turn-action-navigation', '--turn-orange-500'],
  ['--turn-form-control-idle', '--turn-surface-page'],
  ['--turn-form-control-selected', '--turn-pink-500'],
  ['--turn-form-control-focus', '--turn-blue-500'],
  ['--turn-disclosure-trigger', '--turn-blue-300'],
  ['--turn-disclosure-panel', '--turn-surface-page'],
  ['--turn-difficulty-easy', '--turn-green-200'],
  ['--turn-difficulty-medium', '--turn-yellow-200'],
  ['--turn-difficulty-advanced', '--turn-orange-200'],
  ['--turn-difficulty-expert', '--turn-red-200'],
  ['--turn-difficulty-locked', '--turn-muted'],
  ['--turn-control-gas', '--turn-green-500'],
  ['--turn-control-drift', '--turn-blue-500'],
  ['--turn-control-boost', '--turn-yellow-400'],
  ['--turn-control-boost-empty', '--turn-yellow-200'],
  ['--turn-control-brake', '--turn-orange-500'],
  ['--turn-social-racer-1', '--turn-pink-100'],
  ['--turn-social-racer-2', '--turn-blue-100'],
  ['--turn-social-racer-3', '--turn-green-100'],
  ['--turn-social-racer-4', '--turn-yellow-100'],
  ['--turn-social-racer-5', '--turn-orange-100']
]);

assert.equal(
  [...design.matchAll(/data-semantic="([^"]+)"/g)].length,
  semanticMappings.size,
  'The reference must show every semantic colour role exactly once'
);
for (const [semanticToken, primitiveToken] of semanticMappings) {
  const definition = `${semanticToken}: var(${primitiveToken})`;
  assert.ok(tokens.includes(definition), `Missing semantic mapping ${definition}`);
  assert.ok(design.includes(`data-semantic="${semanticToken}"`), `Missing semantic reference row ${semanticToken}`);
  assert.ok(design.includes(`<code>${semanticToken}</code>`), `Missing visible semantic variable ${semanticToken}`);
  assert.ok(design.includes(`<code>var(${primitiveToken})</code>`), `Missing visible semantic mapping ${semanticToken}`);
}

const compatibilityAliases = new Map([
  ['--ink', '--turn-ink'],
  ['--paper', '--turn-paper'],
  ['--cyan', '--turn-blue-500'],
  ['--pink', '--turn-pink-500'],
  ['--yellow', '--turn-yellow-400'],
  ['--lime', '--turn-green-500'],
  ['--m8-ink', '--turn-ink'],
  ['--m8-cream', '--turn-paper'],
  ['--m8-pink', '--turn-pink-500'],
  ['--m8-yellow', '--turn-yellow-600'],
  ['--m8-blue', '--turn-blue-300']
]);
for (const [alias, target] of compatibilityAliases) {
  assert.ok(tokens.includes(`${alias}: var(${target})`), `Missing compatibility alias ${alias}`);
  assert.ok(design.includes(`<code>${alias}</code>`), `Missing visible compatibility alias ${alias}`);
  assert.ok(design.includes(`<code>var(${target})</code>`), `Missing visible compatibility target ${target}`);
}

for (const token of [
  '--turn-border-micro', '--turn-border-compact', '--turn-border-default', '--turn-border-heavy',
  '--turn-radius-micro', '--turn-radius-compact', '--turn-radius-default', '--turn-radius-hero',
  '--turn-radius-pill', '--turn-radius-circle', '--turn-shadow-compact', '--turn-shadow-default', '--turn-shadow-hero'
]) {
  assert.ok(tokens.includes(token), `Missing geometry or elevation token ${token}`);
}

assert.match(semantic, new RegExp(`@import url\\('\\./design-tokens\\.css\\?build=${release.cacheKey}'\\)`));
assert.match(semantic, /\.install-primary \{[\s\S]*?background: var\(--turn-action-primary\)/);
const preRace = await fs.readFile(new URL('../turn/pre-race.css', import.meta.url), 'utf8');
// One elevation scale (design-scale.css): the older shadow tokens and ROADBOOK/GARAGE's
// primitives resolve to its levels instead of carrying their own pixel values.
for (const level of ['press', 'control', 'action', 'card', 'dialog']) {
  assert.match(scale, new RegExp(`--turn-shadow-${level}: \\d+px \\d+px 0 var\\(--turn-shadow-color\\)`), `design-scale.css defines the ${level} elevation`);
}
assert.match(tokens, /--turn-shadow-compact: var\(--turn-shadow-control,/);
assert.match(tokens, /--turn-shadow-default: var\(--turn-shadow-card,/);
assert.match(tokens, /--turn-shadow-hero: var\(--turn-shadow-dialog,/);
for (const [name, level] of [['shadow', 'card'], ['shadow-action', 'action'], ['shadow-press', 'press'], ['shadow-sheet', 'dialog']]) {
  assert.match(preRace, new RegExp(`--turn-pr-${name}: var\\(--turn-shadow-${level},`), `ROADBOOK/GARAGE ${name} uses the ${level} elevation`);
}
assert.doesNotMatch(preRace.replace(/--turn-pr-shadow[^;]*;/g, ''), /box-shadow: \d/, 'pre-race.css writes no literal hard shadow');
assert.match(preRace, /\.turn-pr-button\.is-primary \{[\s\S]*?background: var\(--turn-action-primary/,
  'ROADBOOK and GARAGE carry the main forward action in the same primary colour');
assert.match(semantic, /\.drive-drift-zone,[\s\S]*var\(--turn-control-drift\)/);
assert.match(semantic, /\.drive-pad \.drive-gas-zone,[\s\S]*var\(--turn-control-gas\)/);
assert.match(semantic, /\.drive-pad \.drive-brake-zone,[\s\S]*var\(--turn-control-brake\)/);
assert.match(semantic, /\.drive-boost-zone[\s\S]*var\(--turn-control-boost\)[\s\S]*var\(--turn-control-boost-empty\)/);

for (const section of ['principles', 'foundations', 'components', 'gameplay', 'progression', 'layouts', 'accessibility', 'legacy']) {
  assert.match(design, new RegExp(`id="${section}"`));
  assert.match(design, new RegExp(`href="#${section}"`));
}
for (const colourLayer of ['primitive-palette', 'semantic-mappings', 'compatibility-aliases']) {
  assert.match(design, new RegExp(`id="${colourLayer}"`));
}

for (const decision of [
  'Race this track', 'Settings', 'How to play', 'Achievements', 'Leave race',
  'Easy', 'Medium', 'Advanced', 'Expert', 'Locked',
  'Device steering', 'On-screen steering', 'Left-handed layout', 'Drive By Ear',
  'DRIFT and FLOW scorekeeper', 'Drift', 'Boost', 'Gas', 'Brake', 'R', 'Lock', 'Shift',
  'Scorekeeper paper', 'Trophy Road is a literal road now', 'START', 'FINISH',
  'Vehicle', 'Feature / perk', 'Scoring', 'The Lot', 'SPORTS CAR',
  'Screen reader', 'Blank screen', 'Reduced motion'
]) {
  assert.ok(design.toLocaleLowerCase('en').includes(decision.toLocaleLowerCase('en')), `Missing current design decision ${decision}`);
}

assert.match(design, /Colour reinforces progression but never replaces the label/);
assert.match(design, /Social racer colour follows stable join order\. A faster lap may change race rank, but never the racer’s social colour\./);
assert.match(design, /Vehicle[\s\S]*blue-100 → blue-500/);
assert.match(design, /Track[\s\S]*green-200 → green-500/);
assert.match(design, /Feature \/ perk[\s\S]*yellow-100 → yellow-400/);
assert.match(design, /Scoring[\s\S]*pink-100 → pink-200/);
assert.match(design, /Locked perks stay still/);
assert.match(design, /selecting a car with an active perk gives the short confirmation wiggle/);
assert.match(design, /clicking outside also closes it/i);
assert.match(design, /detail close button uses[\s\S]*--turn-orange-500/i);

assert.match(referenceCss, /\.system-header[\s\S]*background: var\(--turn-yellow-600\)/,
  'The reference itself must use the current solid yellow Home-header language');
assert.match(referenceCss, /\.system-toolbar[\s\S]*background: var\(--turn-blue-300\)/);
assert.match(referenceCss, /\.button-sample\.primary[\s\S]*background: var\(--turn-action-primary\)/);
assert.match(referenceCss, /\.dialog-demo__close[\s\S]*background: var\(--turn-orange-500\)/);
assert.match(referenceCss, /\.drive-demo__drift[\s\S]*var\(--turn-control-drift\)/);
assert.match(referenceCss, /\.drive-demo__boost[\s\S]*var\(--turn-control-boost\)/);
assert.match(referenceCss, /\.drive-demo__gas[\s\S]*var\(--turn-control-gas\)/);
assert.match(referenceCss, /\.drive-demo__brake[\s\S]*var\(--turn-control-brake\)/);
assert.match(referenceCss, /\.score-row\.flow \.score-gauge i[\s\S]*var\(--turn-pink-500\)/);
assert.match(referenceCss, /\.reward-tile\.vehicle\.locked[\s\S]*var\(--turn-blue-100\)/);
assert.match(referenceCss, /\.reward-tile\.scoring\.unlocked[\s\S]*var\(--turn-pink-200\)/);
assert.match(referenceCss, /@media \(prefers-reduced-motion: reduce\)/);

assert.match(dialogs, /TURN dialogs/i);
assert.match(dialogs, /Standardize the shell, not the content\./);
assert.match(dialogs, /Production dialog inventory/);
assert.match(dialogs, /About TURN/);
assert.match(dialogs, /Development history &amp; changelog/);
assert.match(dialogs, /Drive By Ear 101 introduction/);
assert.match(dialogs, /Motion access denied/);
assert.match(dialogs, /In-race audio settings/);
assert.match(dialogs, /Compact[\s\S]*Standard[\s\S]*Wide[\s\S]*Reader/);
assert.match(dialogs, /Do not stack modal dialogs/);
assert.match(dialogs, /Focus the heading first/);
assert.match(dialogs, /Return focus/);
assert.match(dialogs, /Contain scrolling/);

assert.match(index, new RegExp(`TURN v${escapeRegex(release.version)} · Build ${escapeRegex(release.id)}`));
assert.match(index, new RegExp(`version: '${escapeRegex(release.version)}'`));
assert.match(index, new RegExp(`id: '${escapeRegex(release.id)}'`));
assert.match(index, new RegExp(`cacheKey: '${escapeRegex(release.cacheKey)}'`));

// Layer 3: rendered-size tokens in real CSS pixels, exempt from the 0.75 baseline.
assert.match(index, new RegExp(`href="\\./design-tokens\\.css\\?build=${escapeRegex(release.cacheKey)}">\\n\\s*<link rel="stylesheet" href="\\./design-scale\\.css\\?build=${escapeRegex(release.cacheKey)}" data-turn-responsive>`),
  'design-scale.css loads right after the palette tokens, exempt from the UI baseline');
for (const [token, value] of [['--turn-text-floor', '11px'], ['--turn-type-micro', '11px'], ['--turn-target-min', '44px'],
  ['--turn-type-body', '15px'], ['--turn-gutter', 'clamp(12px, 4vw, 24px)']]) {
  assert.match(scale, new RegExp(`${token}: ${escapeRegex(value)};`), `${token} must be ${value}`);
}
assert.match(scale, /prefers-reduced-motion: reduce[\s\S]*--turn-motion-base: 0ms/);
assert.match(tokens, /@media \(color-gamut: p3\) \{\s*@supports \(color: color\(display-p3 1 1 1\)\)/,
  'P3 accents apply only on wide-gamut displays that parse display-p3, with sRGB as the fallback');
assert.match(tokens, /--turn-pink-500: #ea5da1;[\s\S]*--turn-pink-500: color\(display-p3 0\.852 0\.4 0\.623\)/,
  'The sRGB accent is declared first and remains the default');
assert.match(design, /id="rendered-scale"[\s\S]*--turn-text-floor|id="rendered-scale"[\s\S]*no text below 11px/);
// Themes (#1067): one resolver in index.html before any stylesheet; the dark theme
// changes only neutral roles, never semantic colours; the THEME setting is a radio group.
{
  const head = index.slice(0, index.indexOf('<link rel="stylesheet"'));
  assert.match(head, /globalThis\.__turnTheme = Object\.freeze\(/, 'the theme resolver runs before any stylesheet');
  assert.match(head, /matchMedia\('\(prefers-color-scheme: dark\)'\)/, 'System follows the OS');
  assert.match(head, /root\.dataset\.theme = theme/);
  assert.match(head, /meta\[name="theme-color"\][\s\S]*meta\.content = HEADER\[theme\]/, 'the browser colour follows the header');
  assert.match(head, /const HEADER = \{ light: '#ffbd12', dark: '#111214' \}/);
  assert.equal((index.match(/<meta name="theme-color"/g) || []).length, 1, 'one theme-color meta, updated by the resolver');
  const dark = tokens.match(/:root\[data-theme="dark"\] \{([\s\S]*?)\}/)?.[1] || '';
  const darkNames = [...dark.matchAll(/(--[\w-]+):/g)].map((match) => match[1]).sort();
  assert.deepEqual(darkNames, ['--turn-header', '--turn-outline', '--turn-outline-muted', '--turn-shadow-color', '--turn-surface-bright', '--turn-surface-card', '--turn-surface-page', '--turn-surface-raised', '--turn-text', '--turn-text-faint', '--turn-text-muted'], 'the dark theme changes only neutral roles');
  assert.match(tokens, /--turn-shadow-color: var\(--turn-ink\);/, 'hard shadows have their own colour');
  const bar = await fs.readFile(new URL('../turn/ui/home-app-bar.js', import.meta.url), 'utf8');
  assert.match(bar, /<legend>COLOR THEME<\/legend>/);
  assert.match(bar, /type="radio" name="turn-theme"/, 'THEME is one radio group');
  // Text on a light semantic colour reads Ink in the dark theme; the guard never runs in light.
  const guard = await fs.readFile(new URL('../turn/ui/theme-contrast.js', import.meta.url), 'utf8');
  assert.match(index, /<script type="module" src="\.\/ui\/theme-contrast\.js\?build=/);
  assert.match(guard, /if \(root\.dataset\.theme !== 'dark'\) \{/, 'the light theme never runs the contrast guard');
  assert.match(guard, /const MIN_CONTRAST = 4\.5;/, 'text below WCAG AA against its own backdrop is corrected');
  assert.match(guard, /turn-race-active/, 'during a race only a dialog opening or closing calls a scan');
  assert.match(guard, /if \(controlFill && luminance\(controlFill\) > NIGHT\) \{\s*if \(control\.getAttribute\(MARK\) !== 'light'\)/, 'a button on a colour reads Ink, exactly as in the light theme');
  assert.match(tokens, /:root\[data-theme="dark"\] \[data-turn-on="light"\] \{[\s\S]*?--turn-text: var\(--turn-ink\);/);
  assert.match(tokens, /:root\[data-theme="dark"\] \[data-turn-on="dark"\] \{[\s\S]*?--turn-text: #fff8e8;/);
  assert.match(tokens, /:root\[data-theme="dark"\] \[data-turn-on="light"\] \{[\s\S]*?--turn-surface-page: var\(--turn-paper\);/, 'a coloured button is drawn with the light roles');
  assert.doesNotMatch(head, /turn-admin-unlock/, 'every player can choose a theme');
  assert.match(guard, /for \(const marked of document\.querySelectorAll\(`\[\$\{MARK\}\], \[\$\{EDGE\}\]`\)\)/, 'every scan starts clean, so a mark never follows a moved button');
  assert.match(tokens, /:root\[data-theme="dark"\] \[data-turn-edge\] \{\s*border-color: var\(--turn-ink\) !important;/, 'an outline on a colour is Ink, as in light');
  assert.match(dark, /--turn-outline: #fff8e8;/, 'active dark outlines are Paper cream');
  assert.match(guard, /const SCENERY = 'body, \.garage-stage, \.garage-car-art, \.drive-pad';/, 'an outline over the race scene, the 3D stage or inside the drive pad stays cream');
  const semantic = await fs.readFile(new URL('../turn/design-semantic.css', import.meta.url), 'utf8');
  assert.match(semantic, /\.back-to-lot-button,[\s\S]*?\{\s*color: var\(--turn-ink\) !important;/, 'a coloured control reads Ink without waiting for the contrast guard');
  assert.match(await fs.readFile(new URL('../turn/ui/hud.js', import.meta.url), 'utf8'), /dataset\.theme === 'dark' \? '#fff8e8' : '#08090a'/, 'the minimap track outline follows the theme');
  for (const file of ['styles.css', 'drive-pad.css', 'home-app-bar.css', 'garage/garage.css', 'achievements.css']) {
    const css = await fs.readFile(new URL(`../turn/${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(css, /(?:^|[\s;{])border[a-z-]*:[^;]*var\(--turn-ink\)/m, `${file}: an Ink outline in light is the cream outline in dark (--turn-outline)`);
  }
  assert.match(dark, /--turn-outline-muted: #d6cdb9;/, 'inactive dark outlines are a muted cream, never grey');
  assert.match(tokens, /:root\[data-theme="dark"\] :is\(button, \[role="button"\]\):is\(:disabled, \[aria-disabled="true"\], \.is-locked\)[^{]*\{\s*border-color: var\(--turn-outline-muted\);/, 'a locked or disabled control keeps the muted outline');
  assert.match(tokens, /:root\[data-theme="dark"\] \[data-turn-pill\] \{[\s\S]*?background-image: linear-gradient\(var\(--turn-ink\), var\(--turn-ink\)\)[\s\S]*?color: var\(--turn-pill\)/, 'a pill on a night surface is a coloured wireframe');
}

console.log('TURN current product-language design system, palette, gameplay, progression and dialog reference passed.');

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
