import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [
  home,
  app,
  fixedLayout,
  fixedCss,
  scroll,
  scrollCss,
  scaleCss,
  trophyGate,
  screenReader,
  rivalReset
] = await Promise.all([
  fs.readFile(new URL('../turn/m8-home.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/m8-home-fixed-layout.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/m8-home-fixed-layout.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/m8-home-card-scroll-fixes.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/m8-home-card-scroll-fixes.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/m8-record-car-scale.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/progression/m8-trophy-gate.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/ui/startup-screen-reader-handoff-r529.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/ui/home-rival-reset.js', import.meta.url), 'utf8')
]);

assert.match(home, /getBestDriftRecord/);
assert.match(home, /getBestFlowRecord/);
assert.match(home, /const TRACK_RECORD_KINDS = Object\.freeze\(\['time', 'drift', 'flow'\]\)/);
assert.match(home, /renderTrackRecord\('time', 'TIME', 'track-card-best-time'\)/);
assert.match(home, /renderTrackRecord\('drift', 'DRIFT', 'track-card-best-drift'\)/);
assert.match(home, /renderTrackRecord\('flow', 'FLOW', 'track-card-best-flow'\)/);
assert.match(home, /track-card-records" data-track-best="\$\{track\.id\}" hidden/,
  'Every card must start compact without exposing an oversized BEST panel');

const recordMarkup = home.slice(
  home.indexOf('function renderTrackRecord'),
  home.indexOf('function renderTrackCard')
);
assert.doesNotMatch(recordMarkup, /<(?:button|input|details|summary|select|textarea)\b/i,
  'Record content inside each track button must remain static and non-interactive');
assert.equal((home.match(/class="m8-track-bests-toggle"/g) || []).length, 1,
  'Home must expose one shared record toggle, not one disclosure per track');
assert.ok(
  home.indexOf('class="m8-track-bests-toggle"') < home.indexOf('TRACK_SELECTION_CATALOG.map(renderTrackCard)'),
  'The shared record toggle must remain outside every interactive track card'
);
assert.match(home, /aria-controls="m8TrackRail"[\s\S]*aria-expanded="false"/);
assert.match(home, /trackBestsToggle\.addEventListener\('click', toggleTrackBests\)/);
assert.match(home, /home\.classList\.toggle\('is-showing-track-bests'\)/);
assert.match(home, /bestBox\.hidden = !expanded/);
assert.match(home, /expanded \? 'HIDE BEST' : 'SHOW BEST'/);

assert.match(home, /if \(!record \|\| !model \|\| !renderModels\) return null/,
  'Compact Home must not request decorative WebGL record thumbnails');
assert.match(home, /for \(const request of requests\)[\s\S]*await renderBestCarThumbnail\(request\.record\)/,
  'Expanded record cars must render serially in visible progression order');
assert.match(home, /generation !== previewGeneration \|\| !trackRecordModelsShouldRender\(root\)/,
  'Hiding Home or collapsing BEST must stop the remaining thumbnail queue');
assert.match(home, /if \(expanded\) refreshTrackRecords\(home, \{ renderModels: true \}\)/,
  'The one explicit SHOW BEST action may start the queued record-car work');
assert.match(home, /clearTrackRecordModels\(home\)/,
  'Collapsing all records must invalidate pending model publication');
assert.doesNotMatch(home, /setInterval|setAnimationLoop/,
  'The shared record view must add no polling or continuous animation loop');

assert.match(fixedCss, /--m8-track-card-min-block-size: clamp\(132px, 20vh, 176px\)/,
  'Compact cards must be short enough for a comfortable six-card viewport');
assert.match(fixedCss, /\.is-showing-track-bests \.m8-home-tracks[\s\S]*--m8-track-card-min-block-size: clamp\(304px, 47vh, 390px\)/,
  'The shared state must expand every card to one consistent record height');
assert.match(scrollCss, /\.is-showing-track-bests \.m8-track-rail \.track-card[\s\S]*grid-template-rows: auto auto minmax\(0, 1fr\)/);
assert.match(scrollCss, /\.track-card-best\[hidden\][\s\S]*display: none !important/);
assert.match(scrollCss, /\.track-card-record\.is-drift[\s\S]*--turn-blue-300/);
assert.match(scrollCss, /\.track-card-record\.is-flow[\s\S]*--turn-pink-500/);
assert.match(scrollCss, /\.track-card-record-model\[hidden\][\s\S]*display: none/);
assert.match(scaleCss, /\.track-card-record[\s\S]*\.track-card-record-model/);

assert.match(scroll, /const hasOverflow = maximum > 2/);
assert.match(scroll, /viewport\.classList\.toggle\('has-track-overflow', hasOverflow\)/);
assert.match(scroll, /rail\.dataset\.scrollMode = hasOverflow \? 'native' : 'static'/);
assert.match(scroll, /if \(rail\.scrollTop !== 0\) rail\.scrollTop = 0/);
assert.match(scrollCss, /\.m8-track-scroll-viewport:not\(\.has-track-overflow\) \.m8-track-rail[\s\S]*overflow-y: hidden/,
  'A fully fitting six-card grid must disable its now-unnecessary scroll surface');
assert.match(scroll, /indicator\.hidden = !hasOverflow/,
  'The custom scroll indicator must disappear with the scroll surface');

assert.match(home, /dataset\.trackAccessibleLabel = label/);
assert.match(trophyGate, /entry\.card\.dataset\.trackAccessibleLabel \|\| entry\.originalLabel/,
  'Unlock synchronization must preserve the current compact or expanded accessible name');
assert.match(screenReader, /card\.dataset\.trackAccessibleLabel/,
  'The single-object VoiceOver treatment must use Home’s shared record state');
assert.match(rivalReset, /\[data-track-record-kind="time"\]/,
  'Reset Rivals must clear only the time row and leave DRIFT/FLOW records intact');

assert.match(app, /m8-home\.js\?revision=r206-shared-track-bests/);
assert.match(app, /m8-home-fixed-layout\.js\?revision=r206-shared-track-bests/);
assert.match(app, /m8-record-car-scale\.css\?revision=r206-three-records/);
assert.match(fixedLayout, /m8-home-card-scroll-fixes\.js\?build=\$\{buildKey\}-r206-shared-track-bests/);

console.log('TURN shared compact/expanded TIME, DRIFT and FLOW track records passed.');
