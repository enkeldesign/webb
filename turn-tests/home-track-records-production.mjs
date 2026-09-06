import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [
  home,
  app,
  fixedLayout,
  fixedCss,
  scroll,
  scrollCss,
  rowGapCss,
  scaleCss,
  trophyGate,
  screenReader,
  rivalReset,
  productionEntry,
  labEntry
] = await Promise.all([
  fs.readFile(new URL('../turn/m8-home.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/m8-home-fixed-layout.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/m8-home-fixed-layout.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/m8-home-card-scroll-fixes.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/m8-home-card-scroll-fixes.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/home-track-row-gap-r200.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/m8-record-car-scale.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/progression/m8-trophy-gate.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/ui/startup-screen-reader-handoff-r529.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/ui/home-rival-reset.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-lab/index.html', import.meta.url), 'utf8')
]);

assert.match(home, /getBestDriftRecord/);
assert.match(home, /getBestFlowRecord/);
assert.match(home, /const TRACK_RECORD_KINDS = Object\.freeze\(\['time', 'drift', 'flow'\]\)/);
assert.match(home, /renderTrackRecord\('time', 'TIME', 'track-card-best-time'\)/);
assert.match(home, /renderTrackRecord\('drift', 'DRIFT', 'track-card-best-drift'\)/);
assert.match(home, /renderTrackRecord\('flow', 'FLOW', 'track-card-best-flow'\)/);
assert.match(home, /track-card-records" data-track-best="\$\{track\.id\}" hidden/,
  'Every unlocked card must start with its records block hidden');

const recordMarkup = home.slice(
  home.indexOf('function renderTrackRecord'),
  home.indexOf('function renderTrackCard')
);
assert.doesNotMatch(recordMarkup, /<(?:button|input|details|summary|select|textarea)\b/i,
  'Record rows inside each track button must remain static and non-interactive');
assert.equal((home.match(/class="m8-track-bests-toggle"/g) || []).length, 1,
  'Home must expose one shared record toggle, not one disclosure per track');
assert.ok(
  home.indexOf('class="m8-track-bests-toggle"') < home.indexOf('TRACK_SELECTION_CATALOG.map(renderTrackCard)'),
  'The shared record toggle must remain outside every interactive track card'
);
assert.match(home, /aria-controls="m8TrackRail"[\s\S]*aria-expanded="false"/);
assert.match(home, /trackBestsToggle\.addEventListener\('click', toggleTrackBests\)/);
assert.match(home, /bestBox\.hidden = !expanded/);
assert.match(home, /expanded \? 'HIDE RECORDS' : 'SHOW RECORDS'/);

const cardMarkup = home.slice(
  home.indexOf('function renderTrackCard'),
  home.indexOf('function recordCarName')
);
assert.match(cardMarkup, /class="track-card-compact"[\s\S]*class="track-card-preview"/,
  'Every card must have one explicit compact frame containing the stable summary and map');
assert.match(cardMarkup, /class="track-card-compact"[\s\S]*class="track-card-best track-card-records"/,
  'Unlocked records must be a sibling block after the canonical compact frame');
const unlockedMarkup = cardMarkup.slice(cardMarkup.lastIndexOf('return `'));
assert.ok(
  unlockedMarkup.indexOf('class="track-card-compact"') < unlockedMarkup.indexOf('class="track-card-best track-card-records"'),
  'The unlocked records block must follow, never wrap, the compact frame'
);

assert.match(home, /if \(!record \|\| !model \|\| !renderModels\) return null/,
  'Compact Home must not request decorative WebGL record thumbnails');
assert.match(home, /for \(const request of requests\)[\s\S]*await renderBestCarThumbnail\(request\.record\)/,
  'Expanded record cars must render serially in visible progression order');
assert.match(home, /generation !== previewGeneration \|\| !trackRecordModelsShouldRender\(root\)/,
  'Hiding Home or collapsing records must stop the remaining thumbnail queue');
assert.match(home, /if \(expanded\) refreshTrackRecords\(home, \{ renderModels: true \}\)/,
  'Showing records may start the queued record-car work');
assert.match(home, /clearTrackRecordModels\(home\)/,
  'Collapsing records must invalidate pending model publication');
assert.doesNotMatch(home, /setInterval|setAnimationLoop/,
  'The shared record view must add no polling or continuous animation loop');

assert.match(home, /const TRACK_RECORDS_EXPANDED_KEY = 'turn-track-records-expanded-v1'/);
assert.match(home, /function loadTrackRecordsExpandedPreference\(\)[\s\S]*localStorage\.getItem\(TRACK_RECORDS_EXPANDED_KEY\) === 'true'/,
  'Home itself must own restoration of the shared record disclosure');
assert.match(home, /function saveTrackRecordsExpandedPreference\(expanded\)[\s\S]*localStorage\.setItem\(TRACK_RECORDS_EXPANDED_KEY, expanded \? 'true' : 'false'\)/,
  'Home itself must persist both record disclosure states');
assert.match(home, /home\.classList\.toggle\('is-showing-track-bests', loadTrackRecordsExpandedPreference\(\)\)/,
  'The saved disclosure state must be applied before Home is attached');
assert.match(home, /function setTrackRecordsExpanded\(expanded, \{ persist = false \} = \{\}\)[\s\S]*syncTrackBestVisibility\(\)/,
  'One Home-owned setter must synchronize class, visible records and accessible state');
assert.match(home, /setTrackRecordsExpanded\(!trackRecordsAreExpanded\(home\), \{ persist: true \}\)/,
  'The shared button must persist through the canonical Home setter');
assert.doesNotMatch(home, /toggle\.click\(|trackBestsToggle\.click\(/,
  'Restoration must never synthesize a user click');

assert.match(fixedCss, /--m8-track-card-min-block-size: clamp\(120px, calc\(20vh - 12px\), 164px\)/,
  'The fixed-layout stylesheet remains the stable post-782 baseline');
assert.match(fixedCss, /\.m8-track-rail \{[\s\S]*column-gap: clamp\(10px, 1\.4vw, 16px\)[\s\S]*row-gap: clamp\(13px, calc\(1\.4vw - 1px\), 15px\)/,
  'The fixed-layout baseline must keep independently tunable track column and row gaps');

assert.match(scrollCss, /--m8-track-compact-card-min-block-size: clamp\(108px, calc\(20vh - 24px\), 152px\)/,
  'The consolidated card component owns the final compact landscape floor');
assert.match(scrollCss, /--m8-track-compact-card-min-block-size: 96px/,
  'Short landscape retains the final compact floor that removed the last default overflow');
assert.match(scrollCss, /container-type: size/,
  'The track viewport must provide a CSS size container for deterministic compact-row sizing');
assert.match(scrollCss, /--m8-track-compact-card-block-size: max\([\s\S]*100cqh[\s\S]*2 \* var\(--m8-track-row-gap\)[\s\S]*\/ 3\)/,
  'Landscape compact row height must be derived in CSS from the actual viewport, not measured in JavaScript');
assert.match(scrollCss, /--m8-track-compact-card-content-block-size: calc\([\s\S]*--m8-track-compact-card-block-size[\s\S]*--m8-track-card-border-width[\s\S]*--m8-track-card-block-padding/,
  'Expanded cards must reuse the exact closed-card content frame');
assert.match(scrollCss, /\.track-card-compact \{[\s\S]*grid-template-columns: minmax\(0, 1fr\) minmax\(108px, 39%\)[\s\S]*align-content: center/,
  'Marker, name, difficulty and map must share one canonical compact grid');
assert.match(scrollCss, /\.is-showing-track-bests \.m8-track-rail \.track-card \{[\s\S]*grid-template-rows: var\(--m8-track-compact-card-content-block-size\) max-content[\s\S]*align-content: start/,
  'Expanded cards must append records below the unchanged compact frame');
assert.match(scrollCss, /\.is-showing-track-bests \.m8-track-rail \.track-card-compact \{[\s\S]*height: var\(--m8-track-compact-card-content-block-size\)/,
  'Opening records must not resize the compact summary frame');
assert.match(scrollCss, /\.track-card-best \{[\s\S]*grid-template-rows: auto repeat\(3, auto\)[\s\S]*row-gap: var\(--m8-track-row-gap\)/,
  'BEST, TIME, DRIFT and FLOW must all use natural height and the shared card rhythm');
assert.match(scrollCss, /\.is-showing-track-bests \.m8-track-rail \{[\s\S]*grid-auto-rows: max-content/,
  'Expanded rail rows must grow to contain FLOW rather than clip it');
assert.match(scrollCss, /\.track-card-best\[hidden\][\s\S]*display: none !important/);
assert.match(scrollCss, /\.track-card-record\.is-drift[\s\S]*--turn-blue-300/);
assert.match(scrollCss, /\.track-card-record\.is-flow[\s\S]*--turn-pink-500/);
assert.match(scrollCss, /\.track-card-record::before[\s\S]*border: 2px solid var\(--m8-ink\)/,
  'Record accents need a TURN-ink outline so they remain distinct on every track paper colour');
assert.match(scrollCss, /padding-left: calc\(var\(--track-record-stripe-width\) \+ var\(--track-record-stripe-gap\)\)/,
  'Record copy must retain breathing room after the outlined accent stripe');
assert.match(scrollCss, /\.track-card-record-model\[hidden\][\s\S]*display: none/);
assert.match(scaleCss, /\.track-card-record[\s\S]*\.track-card-record-model/);

assert.match(scrollCss, /\.m8-track-rail \{[\s\S]*column-gap: clamp\(14px, 1\.4vw, 16px\)[\s\S]*row-gap: var\(--m8-track-row-gap\)/,
  'Horizontal and vertical card gaps must remain independently controlled');
assert.match(scrollCss, /\.m8-track-scroll-viewport:not\(\.has-track-overflow\) \.m8-track-rail \{[\s\S]*grid-auto-rows: var\(--m8-track-compact-card-block-size\)[\s\S]*overflow-y: hidden/,
  'When all six compact cards fit, the rail must use the full deterministic frame without scrolling');
assert.match(scrollCss, /@media \(orientation: landscape\)[\s\S]*\.m8-track-rail \{[\s\S]*padding-right: 10px[\s\S]*\.m8-track-scroll-indicator \{[\s\S]*right: -11px/,
  'Landscape must keep identical card width whether the scroll indicator is visible or not');
assert.match(scrollCss, /height: clamp\(72px, 11vh, 104px\)/,
  'The compact preview must stay at the final no-scroll size');
assert.match(scrollCss, /height: 66px/,
  'Short landscape must keep its compact preview size');
assert.match(scrollCss, /not\(\.is-showing-track-bests\) \.m8-track-continue \{[\s\S]*margin-bottom: 7px/,
  'RACE must reserve its resting shadow depth at the shared compact baseline');
assert.match(scrollCss, /margin-bottom: 5px/,
  'Short landscape must preserve the reduced RACE baseline reserve');

assert.ok(rowGapCss.includes('row-gap: clamp(13px, calc(1.4vw - 1px), 15px)'),
  'The post-782 compatibility stylesheet must preserve the requested row gap');
assert.ok(rowGapCss.includes('padding: 3px 9px;'),
  'The post-782 compatibility stylesheet must preserve 3px 9px card padding');
assert.ok(rowGapCss.includes('--m8-track-card-min-block-size: clamp(120px, calc(20vh - 12px), 164px);')
  && rowGapCss.includes('--m8-track-card-min-block-size: clamp(292px, calc(47vh - 12px), 378px);')
  && rowGapCss.includes('--m8-track-card-min-block-size: 108px;')
  && rowGapCss.includes('--m8-track-card-min-block-size: 274px;'),
  'The compatibility stylesheet must be restored exactly to its post-782 sizing role');
assert.doesNotMatch(rowGapCss, /track-card-preview|track-card-best|m8-track-continue|track-scroll-indicator|grid-auto-rows|compact-card/,
  'The late compatibility stylesheet must not become a second Home layout engine again');
assert.ok(!rowGapCss.includes('row-gap: 28px'),
  'No late-loaded rule may restore the old oversized vertical gap');
for (const entrypoint of [productionEntry, labEntry]) {
  assert.ok(entrypoint.includes('home-track-row-gap-r200.css?revision=r210-compact-card-padding'),
    'Production and TURN LAB keep the post-782 compatibility stylesheet identity');
}

assert.match(scroll, /const FIX_ID = 'track-record-layout-v7'/);
assert.match(scroll, /m8-home-card-scroll-fixes\.css\?build=\$\{buildKey\}-r217-track-record-layout/);
assert.match(scroll, /const hasOverflow = maximum > 2/);
assert.match(scroll, /viewport\.classList\.toggle\('has-track-overflow', hasOverflow\)/);
assert.match(scroll, /rail\.dataset\.scrollMode = hasOverflow \? 'native' : 'static'/);
assert.match(scroll, /if \(rail\.scrollTop !== 0\) rail\.scrollTop = 0/);
assert.match(scroll, /indicator\.hidden = !hasOverflow/,
  'The custom scroll indicator must disappear with the scroll surface');
assert.doesNotMatch(scroll, /TRACK_RECORDS_EXPANDED_KEY|localStorage|getBoundingClientRect|--m8-track-compact-top-padding|--m8-track-expanded-records-margin/,
  'The scroll module must remain presentation-only: no disclosure state or runtime geometry reconstruction');
assert.doesNotMatch(home, /getBoundingClientRect|--m8-track-compact-top-padding|--m8-track-expanded-records-margin/,
  'Home record disclosure must not depend on measured geometry');

assert.match(home, /dataset\.trackAccessibleLabel = label/);
assert.match(trophyGate, /entry\.card\.dataset\.trackAccessibleLabel \|\| entry\.originalLabel/,
  'Unlock synchronization must preserve the current compact or expanded accessible name');
assert.match(screenReader, /card\.dataset\.trackAccessibleLabel/,
  'The single-object VoiceOver treatment must use Home’s shared record state');
assert.match(rivalReset, /\[data-track-record-kind="time"\]/,
  'Reset Rivals must clear only the time row and leave DRIFT/FLOW records intact');

assert.match(app, /m8-home\.js\?revision=r217-track-record-layout/);
assert.match(app, /m8-home-fixed-layout\.js\?revision=r217-track-record-layout/);
assert.match(app, /m8-record-car-scale\.css\?revision=r206-three-records/);
assert.match(fixedLayout, /m8-home-card-scroll-fixes\.js\?build=\$\{buildKey\}-r217-track-record-layout/);

console.log('TURN clean compact/expanded TIME, DRIFT and FLOW track record layout passed.');
