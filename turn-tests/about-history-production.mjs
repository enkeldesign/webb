import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { CHANGELOG, CURRENT_RELEASE, DEVELOPMENT_HISTORY } from '../turn/content/about-history-current.js';

const [
  releaseSource,
  productionEntry,
  bootstrapEntry,
  bootstrap,
  browserInstallCss,
  currentContent,
  dialogCss,
  historyCss,
  designMain,
  designReference,
  designReferenceCss
] = await Promise.all([
  fs.readFile(new URL('../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/ui/about-history-bootstrap.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/ui/about-history-bootstrap-r165.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/browser-install-r165.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/content/about-history-current.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/dialog-system-r163.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/about-history-r163.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/design.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/design-dialogs.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/design-reference.css', import.meta.url), 'utf8')
]);

const release = JSON.parse(releaseSource);

assert.match(productionEntry, new RegExp(`about-history-bootstrap-r165\\.js\\?build=${escapeRegex(release.cacheKey)}-r534-heading-first-about-r224-modal-headings`),
  'The public website must load the heading-first browser-aware About implementation directly with the current release cache identity');
assert.ok(
  productionEntry.indexOf('about-history-bootstrap-r165.js') < productionEntry.indexOf('./app.js?build='),
  'Website About must load before the game module waits for explicit browser launch'
);
assert.match(bootstrapEntry, /about-history-bootstrap-r165\.js\?revision=r165-browser-about/,
  'The stable About entry must route to the browser-aware implementation');

assert.match(productionEntry, /href="\.\/browser-install-r165\.css\?build=\d{8}-r\d+"/);
assert.match(productionEntry, /id="installAboutButton"[\s\S]*aria-haspopup="dialog"[\s\S]*>ABOUT TURN<\/button>/);
assert.match(productionEntry, /id="installTurnButton"[\s\S]*id="installNote"[\s\S]*id="playBrowserButton"/,
  'Install, recommendation and browser-play controls must appear in the requested order');
assert.match(productionEntry, /Install TURN as a home screen web app for the best fullscreen experience\. You can also play here, but it is not recommended\./);

assert.match(bootstrap, /CHANGELOG[\s\S]*CURRENT_RELEASE[\s\S]*DEVELOPMENT_HISTORY/);
assert.match(bootstrap, new RegExp(`about-history-current\\.js\\?build=${escapeRegex(release.cacheKey)}`),
  'Current History data must use the current release cache identity');
assert.match(bootstrap, /function focusDialogHeading\(dialog\)/,
  'Dialog opening must have a heading-first focus path');
assert.match(bootstrap, /heading\.setAttribute\('tabindex', '-1'\)/,
  'Dialog headings must be programmatically focusable without entering the normal tab order');
assert.match(bootstrap, /focusDialogHeading\(dialog\);/,
  'Opening About and History dialogs must focus the labelled heading rather than the close button');
assert.doesNotMatch(bootstrap, /querySelector\('\[data-dialog-close\]'\)\?\.focus/,
  'Initial dialog focus must not be forced to Close');
assert.match(bootstrap, /const releases = \[\.\.\.CHANGELOG\]\.reverse\(\)/,
  'The changelog must render newest entries first without mutating its source data');
assert.match(bootstrap, /<details class="turn-changelog-archive">[\s\S]*<summary>Earlier milestones<\/summary>/,
  'Earlier milestones must use a native, initially collapsed disclosure');
assert.match(historyCss, /\.turn-changelog-archive > summary[\s\S]*min-height: var\(--turn-target-min, 44px\)/,
  'The archive disclosure must retain a full touch target');
assert.match(bootstrap, /const INSTALL_NOTE[\s\S]*Install TURN as a home screen web app for the best fullscreen experience\. You can also play here, but it is not recommended\./);
assert.match(bootstrap, /const INSTALL_PITCH = 'TURN is an accessible motion-controlled arcade drift racer\.'/,
  'The browser install page must use the concise product pitch from the approved mockup');
assert.match(bootstrap, /ACCESSIBILITY_SYMBOL_URL = new URL\('\.\.\/assets\/icons\/accessibility\.svg', import\.meta\.url\)/,
  'The original Wikimedia accessibility SVG must be available without a third-party request');
await fs.access(new URL('../turn/assets/icons/accessibility.svg', import.meta.url));
for (const copy of [
  'Fun and inclusive racing game – play your way!',
  'Non-visual access with Drive By Ear',
  'Enhanced screen reader experience design',
  'Supports one-handed play and assistive tech'
]) {
  assert.ok(bootstrap.includes(copy), `Install accessibility summary must include: ${copy}`);
}
assert.match(bootstrap, /function ensureAccessibilitySummary\(gate, actions\)/,
  'The accessibility summary must be a reusable browser-install presentation layer');
assert.match(bootstrap, /summary\.setAttribute\('aria-labelledby', 'installAccessibilityTitle'\)/,
  'Accessibility features must have a real section label for assistive technology');
assert.match(bootstrap, /symbol\.alt = ''/,
  'The accessibility logo is decorative beside equivalent semantic copy');
assert.match(bootstrap, /note\.setAttribute\('role', 'status'\)/,
  'Browser-specific install guidance remains available as a status message when visually quiet');
assert.match(bootstrap, /recommendation\.textContent = '\(NOT RECOMMENDED\)'/,
  'Browser play must retain the explicit secondary recommendation in the control itself');
assert.match(bootstrap, /function installWebsiteAbout\(\)/);
assert.match(bootstrap, /id = 'installAboutButton'/);
assert.match(bootstrap, /aria-haspopup', 'dialog'/);
assert.match(bootstrap, /className = 'm8-dialog m8-about-dialog install-about-dialog'/);
assert.match(bootstrap, /aria-labelledby', 'turnWebsiteAboutTitle'/);
assert.match(bootstrap, /<h2 id="turnWebsiteAboutTitle">ABOUT TURN<\/h2>/);
assert.match(bootstrap, /actions\.append\(installButton, note, browserButton\)/,
  'The browser-only status node stays between the two actions in DOM order');
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

assert.match(browserInstallCss, /html\.turn-browser:not\(\.turn-browser-launched\) #installGate:not\(\.turn-startup-loading\)[\s\S]*background: var\(--turn-surface-page\)/,
  'The browser install page must use the same semantic page surface as startup');
assert.match(browserInstallCss, /\.install-shell[\s\S]*border: 0;[\s\S]*border-radius: 0;/,
  'The install shell must not draw the phone/frame from the visual mockup');
assert.match(browserInstallCss, /\.install-icon[\s\S]*border-width: var\(--turn-border-default\);[\s\S]*box-shadow: var\(--turn-shadow-action\);/,
  'The TURN app mark must use the same tokenized treatment as the startup/loading screen');
assert.match(browserInstallCss, /\.install-card[\s\S]*border: 0[\s\S]*background: transparent[\s\S]*box-shadow: none/,
  'The inner install card must stay out of the visual hierarchy');
assert.match(browserInstallCss, /\.install-accessibility::before[\s\S]*width: calc\(var\(--turn-space-12\) \+ var\(--turn-space-12\)\)/,
  'The accessibility mark size must use the spacing scale');
assert.match(browserInstallCss, /\.install-accessibility::before[\s\S]*background: var\(--turn-action-information\)[\s\S]*assets\/icons\/accessibility\.svg/,
  'Both themes must colour the Wikimedia accessibility mark with the semantic information token');
assert.match(browserInstallCss, /\.install-accessibility-list[\s\S]*font-size: var\(--turn-type-small\)[\s\S]*text-align: left/,
  'Accessibility bullets must use the type scale and retain the available inline reading width');
assert.match(browserInstallCss, /\.install-actions button[\s\S]*border: var\(--turn-border-control\) solid var\(--turn-outline\)[\s\S]*border-radius: var\(--turn-radius-control\)[\s\S]*font-size: var\(--turn-type-body\)/,
  'Both install actions must share the standard control geometry and type tokens');
assert.match(browserInstallCss, /\.install-primary[\s\S]*background: var\(--turn-action-primary\)/,
  'Install TURN remains the semantic primary action');
assert.match(browserInstallCss, /\.install-secondary[\s\S]*border-color: var\(--turn-outline\)[\s\S]*background: var\(--turn-surface-page\)[\s\S]*opacity: 1/,
  'Browser play must remain a real outlined secondary action');
assert.match(browserInstallCss, /text-size-adjust: 100%/,
  'iOS rotation must not trigger browser text autosizing on the install page');
assert.doesNotMatch(browserInstallCss, /font-size: max\(var\(--turn-text-floor/,
  'Install-page typography must come from the shared type scale rather than local viewport formulas');
assert.match(browserInstallCss, /\.install-kicker[\s\S]*flex-direction: column[\s\S]*background: transparent[\s\S]*font-size: var\(--turn-type-small\)/,
  'Build identity and About must form the quiet tokenized stacked footer');
assert.match(browserInstallCss, /#installGate\.turn-startup-loading \.install-accessibility \{\s*display: none !important;/,
  'Browser-only accessibility content must leave the DOM presentation when startup takes over');
assert.match(browserInstallCss, /@media \(max-height: 520px\) and \(min-width: 560px\)[\s\S]*grid-template-columns: minmax\(104px, 0\.32fr\) minmax\(0, 1fr\)/,
  'Short landscape viewports must recompose without changing to a second local type scale');
assert.match(browserInstallCss, /\.install-guide-card[\s\S]*width: min\(420px, 100%\)/);
assert.match(browserInstallCss, /\.install-about-trigger[\s\S]*text-decoration: underline/);
assert.match(browserInstallCss, /\.install-about-trigger[\s\S]*min-height: var\(--turn-target-min\)/,
  'The quiet About link must keep the shared minimum touch target');
assert.match(browserInstallCss, /@media \(max-height: 520px\) and \(min-width: 760px\)/,
  'The three-column install composition requires enough width for its actions');
assert.doesNotMatch(browserInstallCss, /radial-gradient|linear-gradient/,
  'The retired decorative install gradient must not return');

// Guard readability and chronology rather than requiring old implementation
// details or a minimum number of entries. Milestones are intentionally curated.
const wordCount = (text) => text.trim().split(/\s+/).length;
const historyText = DEVELOPMENT_HISTORY.flatMap((entry) => [entry.title, ...entry.paragraphs, ...entry.milestones]).join(' ');
const changelogText = CHANGELOG.flatMap((entry) => entry.entries.flat()).join(' ');
assert.ok(DEVELOPMENT_HISTORY.length > 0 && DEVELOPMENT_HISTORY.length <= 12,
  'History must stay within twelve short chapters; consolidate before extending it');
assert.ok(wordCount(historyText) <= 1000, 'History must remain a short read');
assert.ok(wordCount(changelogText) <= 1000, 'The complete changelog, including the archive, must remain a short read');
assert.doesNotMatch(changelogText, /admin|tester|prototype|reverted|hotfix|regression|revision=|\br\d{2,}\b/i,
  'The changelog must describe lasting features, not the testing or release machinery');

let previousDate = -Infinity;
const featureNames = new Set();
for (const milestone of CHANGELOG) {
  assert.match(milestone.date, /^\d{1,2} [A-Z][a-z]+ \d{4}$/,
    'Every milestone must have its own explicit date and year');
  const timestamp = Date.parse(milestone.date);
  assert.ok(Number.isFinite(timestamp) && timestamp > previousDate,
    'Milestone dates must be valid, unique and in ascending order');
  previousDate = timestamp;
  assert.ok(milestone.entries.length > 0, 'Empty release groups must be removed');
  for (const [feature, description] of milestone.entries) {
    assert.ok(feature && description, 'Each milestone must name a feature and explain its outcome');
    assert.ok(!featureNames.has(feature), 'Related feature revisions must be consolidated');
    featureNames.add(feature);
    assert.ok(wordCount(description) <= 40, 'A feature description must stay concise');
  }
}
for (const chapter of DEVELOPMENT_HISTORY) {
  assert.ok(chapter.period && chapter.title && chapter.paragraphs.length > 0,
    'Each History chapter must retain its period, heading and story');
}
assert.deepEqual(CURRENT_RELEASE, { version: release.version, build: release.id },
  'Curating historical milestones must not replace the current release identity');

assert.match(currentContent, new RegExp(`version: '${escapeRegex(release.version)}'`),
  'The current History facade must name the canonical release version');
assert.match(currentContent, new RegExp(`build: '${escapeRegex(release.id)}'`),
  'The current History facade must name the canonical release build');

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
assert.match(historyCss, /\.m8-about-summary[\s\S]*font-size: max\(var\(--turn-text-floor, 11px\), 0\.6rem\) !important/,
  'About supporting copy must be compact enough for short landscape viewports');
assert.match(historyCss, /\.m8-about-actions[\s\S]*grid-template-columns: 1fr/,
  'The sole About action must span the full available width');

assert.match(designReference, /TURN dialogs/i);
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
  assert.match(designPage, /href="\.\/design-reference\.css\?revision=r204-current-product-language"/,
    'Every design-system page must use the shared current-product reference shell');
  assert.match(designPage, /class="system-toolbar" aria-label="Design reference pages"/);
  assert.match(designPage, />Design system<\/a>[\s\S]*>Dialogs<\/a>[\s\S]*>Open TURN<\/a>/,
    'Design-system pages must expose the same page navigation in the same order');
  assert.match(designPage, /href="\.\/" target="_blank" rel="noopener">Open TURN<\/a>/,
    'Open TURN must use a fresh browsing context so mobile Safari cannot carry documentation viewport state into the game');
  assert.match(designPage, /class="section-nav" aria-label="[^"]+ sections"/,
    'Every design-system page must expose compact sticky section navigation');
  assert.match(designPage, new RegExp(`TURN ${escapeRegex(release.version)}`),
    'Design references must identify the current production version');
  assert.match(designPage, new RegExp(`Build ${escapeRegex(release.id)}`, 'i'),
    'Design references must identify the current production build');
}

assert.match(designMain, /href="\.\/design\.html" aria-current="page">Design system<\/a>/);
assert.match(designReference, /href="\.\/design-dialogs\.html" aria-current="page">Dialogs<\/a>/);
assert.match(designReferenceCss, /\.system-header[\s\S]*background: var\(--turn-yellow-600\)/);
assert.match(designReferenceCss, /\.system-toolbar[\s\S]*background: var\(--turn-blue-300\)/);
assert.match(designReferenceCss, /\.section-nav[\s\S]*position: sticky/);
assert.match(designReferenceCss, /prefers-reduced-motion: reduce/);

console.log('TURN website About, history, dialog system and current design-reference navigation regression passed.');

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
