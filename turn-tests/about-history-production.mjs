import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [
  productionEntry,
  nextEntry,
  bootstrap,
  content,
  dialogCss,
  historyCss,
  designMain,
  designReference,
  designNavigation
] = await Promise.all([
  fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/ui/about-history-bootstrap.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/content/about-history.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/dialog-system-r163.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/about-history-r163.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/design.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/design-dialogs.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/design-navigation.css', import.meta.url), 'utf8')
]);

for (const entry of [productionEntry, nextEntry]) {
  assert.match(entry, /about-history-bootstrap\.js\?revision=r164-design-navigation/,
    'Production and TURN NEXT must load the same refreshed About history enhancement');
}

assert.match(bootstrap, /CHANGELOG[\s\S]*CURRENT_RELEASE[\s\S]*DEVELOPMENT_HISTORY/);
assert.match(bootstrap, /className = 'm8-dialog turn-dialog turn-dialog--reader turn-history-dialog'/);
assert.match(bootstrap, /aria-labelledby', 'turnHistoryTitle'/);
assert.match(bootstrap, /role="tablist" aria-label="TURN history sections"/);
assert.match(bootstrap, /role="tab"[\s\S]*aria-selected="true"[\s\S]*aria-controls="turnHistoryDevelopmentPanel"/);
assert.match(bootstrap, /role="tabpanel"[\s\S]*aria-labelledby="turnHistoryDevelopmentTab"/);
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
assert.match(bootstrap, /HISTORY &amp; CHANGELOG/);
assert.match(bootstrap, /href="\/turn\/design\.html"/,
  'The About action must open the main TURN design system');
assert.match(bootstrap, />DESIGN SYSTEM<\/a>/);
assert.match(bootstrap, /installStylesheet\('\.\.\/dialog-system-r163\.css/);
assert.match(bootstrap, /installStylesheet\('\.\.\/about-history-r163\.css/);
assert.doesNotMatch(bootstrap, /setInterval|@keyframes|animation:/,
  'History and dialog behaviour must not add timing loops or decorative animation');

const historyEntries = (content.match(/period:/g) || []).length;
const changelogDays = (content.match(/date:/g) || []).length;
assert.ok(historyEntries >= 10, `Expected at least ten development-history periods, found ${historyEntries}`);
assert.ok(changelogDays >= 18, `Expected at least eighteen changelog dates, found ${changelogDays}`);
assert.match(content, /18–19 July 2026/);
assert.match(content, /Current stabilization/);
assert.match(content, /18 July 2026/);
assert.match(content, /5 August/);
assert.match(content, /TURN 1\.5\.1/);
assert.match(content, /2026\.08\.05-r160/);
assert.match(content, /one oh one/);
assert.match(content, /25 achievements and 1,375 available trophies/);
assert.match(content, /Paintjob MutationObserver/);

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
assert.match(historyCss, /\.m8-about-actions[\s\S]*grid-template-columns/);

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

console.log('TURN About history, changelog, dialog system and design-system navigation regression passed.');
