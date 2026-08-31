import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [
  releaseSource,
  productionEntry,
  nextEntry,
  bootstrapEntry,
  bootstrap,
  browserInstallCss,
  content,
  dialogCss,
  historyCss,
  designMain,
  designReference,
  designNavigation
] = await Promise.all([
  fs.readFile(new URL('../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/ui/about-history-bootstrap.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/ui/about-history-bootstrap-r165.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/browser-install-r165.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/content/about-history.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/dialog-system-r163.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/about-history-r163.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/design.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/design-dialogs.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/design-navigation.css', import.meta.url), 'utf8')
]);

const release = JSON.parse(releaseSource);

assert.match(productionEntry, new RegExp(`about-history-bootstrap-r165\\.js\\?build=${escapeRegex(release.cacheKey)}-r534-heading-first-about`),
  'The public website must load the heading-first browser-aware About implementation directly with the current release cache identity');
assert.ok(
  productionEntry.indexOf('about-history-bootstrap-r165.js') < productionEntry.indexOf('./app.js?build='),
  'Website About must load before the game module waits for explicit browser launch'
);
assert.match(nextEntry, /about-history-bootstrap\.js\?revision=r164-design-navigation/,
  'TURN NEXT may continue through the stable shared About entry module');
assert.match(bootstrapEntry, /about-history-bootstrap-r165\.js\?revision=r165-browser-about/,
  'The stable About entry must route to the browser-aware implementation');

assert.match(productionEntry, /href="\.\/browser-install-r165\.css\?revision=r165-browser-about"/);
assert.match(productionEntry, /id="installAboutButton"[\s\S]*aria-haspopup="dialog"[\s\S]*>ABOUT TURN<\/button>/);
assert.match(productionEntry, /id="installTurnButton"[\s\S]*id="installNote"[\s\S]*id="playBrowserButton"/,
  'Install, recommendation and browser-play controls must appear in the requested order');
assert.match(productionEntry, /Install TURN as a home screen web app for the best fullscreen experience\. You can also play here, but it is not recommended\./);

assert.match(bootstrap, /CHANGELOG[\s\S]*CURRENT_RELEASE[\s\S]*DEVELOPMENT_HISTORY/);
assert.match(bootstrap, new RegExp(`about-history\\.js\\?build=${escapeRegex(release.cacheKey)}`),
  'History data must use the current release cache identity');
assert.match(bootstrap, /function focusDialogHeading\(dialog\)/,
  'Dialog opening must have a heading-first focus path');
assert.match(bootstrap, /heading\.setAttribute\('tabindex', '-1'\)/,
  'Dialog headings must be programmatically focusable without entering the normal tab order');
assert.match(bootstrap, /focusDialogHeading\(dialog\);/,
  'Opening About and History dialogs must focus the labelled heading rather than the close button');
assert.doesNotMatch(bootstrap, /querySelector\('\[data-dialog-close\]'\)\?\.focus/,
  'Initial dialog focus must not be forced to Close');
assert.match(bootstrap, /return \[\.\.\.CHANGELOG\]\.reverse\(\)\.map\(/,
  'The changelog must render newest entries first without mutating its source data');
assert.match(bootstrap, /const INSTALL_NOTE[\s\S]*Install TURN as a home screen web app for the best fullscreen experience\. You can also play here, but it is not recommended\./);
assert.match(bootstrap, /function installWebsiteAbout\(\)/);
assert.match(bootstrap, /id = 'installAboutButton'/);
assert.match(bootstrap, /aria-haspopup', 'dialog'/);
assert.match(bootstrap, /className = 'm8-dialog m8-about-dialog install-about-dialog'/);
assert.match(bootstrap, /aria-labelledby', 'turnWebsiteAboutTitle'/);
assert.match(bootstrap, /<h2 id="turnWebsiteAboutTitle">ABOUT TURN<\/h2>/);
assert.match(bootstrap, /actions\.append\(installButton, note, browserButton\)/,
  'The browser-only note must sit between Install TURN and Play in browser anyway');
assert.match(bootstrap, /trigger\.addEventListener\('click', \(\) => openDialog\(aboutDialog, trigger\)\)/);
assert.match(bootstrap, /aboutDialog\.addEventListener\('close', restoreTrigger\)/,
  'Closing website About must return focus to the version-strip trigger');
assert.doesNotMatch(bootstrap, /__turnStartBrowserGame|turn-browser-play|releaseBrowserLaunch/,
  'Opening or closing website About must never release the browser game launch gate');

assert.match(bootstrap, /className = 'm8-dialog turn-dialog turn-dialog--reader turn-history-dialog'/);
assert.match(bootstrap, /scope === 'website' \? 'turnWebsiteHistory' : 'turnHistory'/);
assert.match(bootstrap, /role="tablist" aria-label="TURN history sections"/);
assert.match(bootstrap, /role="tab"[\s\S]*aria-selected="true"/);
assert.match(bootstrap, /role="tabpanel"/);
assert.match(bootstrap, /event\.key === 'ArrowRight'/);
assert.match(bootstrap, /event\.key === 'ArrowLeft'/);
assert.match(bootstrap, /event\.key === 'Home'/);
assert.match(bootstrap, /event\.key === 'End'/);
assert.match(bootstrap, /aboutDialog\.close\(\)/,
  'The source About dialog must close before the history dialog opens; modal dialogs must not stack');
assert.match(bootstrap, /aboutDialog\.showModal\(\)/,
  'Closing the reader should restore the source About dialog');
assert.match(bootstrap, /historyButton\.focus\(\{ preventScroll: true \}\)/,
  'Focus should return to the History and Changelog action inside the restored About dialog');
assert.match(bootstrap, /<span>HISTORY AND<br>CHANGELOG<\/span>/,
  'The About history action must use the intended two-line label');
assert.doesNotMatch(bootstrap, /m8-about-design-system|href="\/turn\/design\.html"|<span>DESIGN<br>SYSTEM<\/span>/,
  'The About dialog must not expose a Design System action');
assert.match(bootstrap, /installStylesheet\('\.\.\/m8-home\.css/);
assert.match(bootstrap, /installStylesheet\('\.\.\/dialog-system-r163\.css/);
assert.match(bootstrap, /installStylesheet\('\.\.\/about-history-r163\.css/);
assert.match(bootstrap, /installStylesheet\('\.\.\/browser-install-r165\.css/);
assert.doesNotMatch(bootstrap, /setInterval|@keyframes|animation:/,
  'History and dialog behaviour must not add timing loops or decorative animation');

assert.match(browserInstallCss, /html\.turn-browser:not\(\.turn-browser-launched\)[\s\S]*overflow-x: clip/);
assert.match(browserInstallCss, /\.install-gate[\s\S]*justify-items: center[\s\S]*overflow-x: clip/);
assert.match(browserInstallCss, /\.install-shell[\s\S]*width: min\(920px, 100%\)/);
assert.match(browserInstallCss, /\.install-shell[\s\S]*grid-template-columns: minmax\(0, 0\.75fr\) minmax\(0, 1\.25fr\)/);
assert.match(browserInstallCss, /\.install-art,[\s\S]*\.install-card[\s\S]*min-width: 0/);
assert.match(browserInstallCss, /\.install-guide-card[\s\S]*width: min\(560px, 100%\)/);
assert.match(browserInstallCss, /\.install-about-trigger[\s\S]*text-decoration: underline/);
assert.match(browserInstallCss, /@media \(max-height: 500px\) and \(orientation: landscape\)[\s\S]*minmax\(0, 1fr\)/);

const historyEntries = (content.match(/period:/g) || []).length;
const changelogDays = (content.match(/date:/g) || []).length;
assert.ok(historyEntries >= 11, `Expected at least eleven development-history periods, found ${historyEntries}`);
assert.ok(changelogDays >= 20, `Expected at least twenty changelog dates, found ${changelogDays}`);
assert.match(content, /18–19 July 2026/);
assert.match(content, /Stabilization and progression/);
assert.match(content, /YOUR TURN makes personal rivals social/);
assert.match(content, /18 July 2026/);
assert.match(content, /8 August/);
assert.match(content, /TURN 1\.5\.1/,
  'History must retain the previous 1.5.1 milestone');
assert.match(content, new RegExp(`TURN ${escapeRegex(release.version)}`),
  'History must name the canonical current release');
assert.match(content, new RegExp(escapeRegex(release.id)),
  'History must name the canonical current build');
assert.match(content, /Cloudflare Worker and D1 snapshot store/,
  'History must explain the short-link transport introduced with YOUR TURN');
assert.match(content, /one oh one/);
assert.match(content, /28 achievements and 1,700 available trophies/);
assert.match(content, /SAVE BELLA!/);
assert.match(content, /AN ARMY OF ME/);
assert.match(content, /ON COURSE, OF COURSE/);
assert.match(content, /Paintjob MutationObserver/);
assert.match(content, /Playtesting reshapes the driving feel/);
assert.match(content, /Visible front-wheel steering tied to player input/);
assert.match(content, /Standard binary DRIFT LOCK/);
assert.match(content, /29–31 August/);
assert.match(content, /Long MOUNTAIN reaches production and difficulty gets clearer/);
assert.match(content, /EASY \/ MEDIUM \/ ADVANCED \/ EXPERT/);
assert.match(content, /MIDNIGHT CITY/);
assert.match(content, /≈4\.7 km/);
assert.match(content, /≈3\.8 km/);
assert.doesNotMatch(content, /MOUNTAIN at 1,000 trophies/);


for (const size of ['compact', 'standard', 'wide', 'reader']) {
  assert.match(dialogCss, new RegExp(`\\.turn-dialog--${size}`),
    `Dialog system must define the ${size} size`);
}
assert.match(dialogCss, /\.turn-dialog__surface/);
assert.match(dialogCss, /\.turn-dialog__header/);
assert.match(dialogCss, /\.turn-dialog__body/);
assert.match(dialogCss, /\.turn-dialog__actions/);
assert.match(dialogCss, /overscroll-behavior: contain/);
assert.match(dialogCss, /scrollbar-gutter: stable/);
assert.match(dialogCss, /prefers-reduced-motion: reduce/);

assert.match(historyCss, /\.turn-history-card[\s\S]*overflow: hidden !important/,
  'The reader shell must stay fixed while its body owns scrolling');
assert.match(historyCss, /\.turn-history-panel[\s\S]*overflow-y: auto/);
assert.match(historyCss, /\.m8-about-summary[\s\S]*font-size: 0\.8rem !important/,
  'About supporting copy must be compact enough for short landscape viewports');
assert.match(historyCss, /\.m8-about-actions[\s\S]*grid-template-columns: 1fr/,
  'The sole About action must span the full available width');

assert.match(designReference, /TURN DIALOGS/);
assert.match(designReference, /Standardize the shell, not the content/);
assert.match(designReference, /Production dialog inventory/);
assert.match(designReference, /About TURN/);
assert.match(designReference, /Development history &amp; changelog/);
assert.match(designReference, /Drive By Ear 101 introduction/);
assert.match(designReference, /Motion access denied/);
assert.match(designReference, /In-race audio settings/);
assert.match(designReference, /Compact[\s\S]*Standard[\s\S]*Wide[\s\S]*Reader/);
assert.match(designReference, /Do not stack modal dialogs/);
assert.match(designReference, /href="\.\/design\.html"/,
  'The dialog reference must remain connected to the main design system');

for (const designPage of [designMain, designReference]) {
  assert.match(designPage, /href="\.\/design-navigation\.css\?revision=r164-design-navigation"/,
    'Every design-system page must use the shared navigation pattern');
  assert.match(designPage, /class="design-page-nav" aria-label="Design system pages"/);
  assert.match(designPage, />Design system<\/a>[\s\S]*>Dialogs<\/a>[\s\S]*>Open TURN<\/a>/,
    'Design-system pages must expose the same page navigation in the same order');
  assert.match(designPage, /href="\/turn\/" target="_blank" rel="noopener noreferrer">Open TURN<\/a>/,
    'Open TURN must use a fresh browsing context so mobile Safari cannot carry the documentation viewport scale into the game');
  assert.match(designPage, /class="design-page-scroll" href="#[^"]+"/,
    'Every design-system hero must visibly indicate that content continues below');
  assert.match(designPage, /class="section-nav design-section-nav"/,
    'Every design-system page must use the shared section-navigation treatment');
}

assert.match(designMain, /href="\.\/design\.html" aria-current="page">Design system<\/a>/);
assert.match(designReference, /href="\.\/design-dialogs\.html" aria-current="page">Dialogs<\/a>/);
assert.match(designNavigation, /min-height: 100svh/);
assert.match(designNavigation, /\.design-page-nav a\[aria-current='page'\]/);
assert.match(designNavigation, /\.section-nav\.design-section-nav/);
assert.match(designNavigation, /prefers-reduced-motion: reduce/);

console.log('TURN website About, history, dialog system and design-system navigation regression passed.');

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
