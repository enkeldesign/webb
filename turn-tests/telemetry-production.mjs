import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [client, about, privacyCss, statsHtml, statsJs, workerConfig, workerRouter, workerTelemetry] = await Promise.all([
  fs.readFile(new URL('../turn/telemetry/client.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/content/about-turn.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/about-privacy.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/stats/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/stats/stats.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../workers/turn-challenges/wrangler.jsonc', import.meta.url), 'utf8'),
  fs.readFile(new URL('../workers/turn-challenges/src/router.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../workers/turn-challenges/src/telemetry.js', import.meta.url), 'utf8')
]);

assert.match(client, /turn-challenges\.erik-jansson-ux\.workers\.dev\/v1\/telemetry/);
assert.match(client, /deployment === 'next'/,
  'TURN NEXT must never pollute production usage statistics');
assert.match(client, /event\.detail\?\.reason !== 'race-started'/);
assert.match(client, /queueEvent\('play_session'\)/);
assert.match(client, /queueEvent\('race_start'\)/);
assert.match(client, /turn:lap-result/);
assert.match(client, /queueEvent\('lap_complete'/);
assert.match(client, /turn:lap-invalid/);
assert.match(client, /navigator\.sendBeacon/);
assert.match(client, /keepalive: true/);
assert.match(client, /credentials: 'omit'/);
assert.doesNotMatch(client, /localStorage|sessionStorage|document\.cookie|indexedDB/i,
  'Gameplay telemetry must not create a persistent analytics identifier');
assert.doesNotMatch(client, /requestAnimationFrame|setInterval|devicemotion|pointermove|mousemove/,
  'Telemetry must remain event-driven and stay out of the racing/rendering loops');

assert.match(about, /installTurnTelemetry\(\)/);
assert.match(about, /<details class="turn-about-privacy">/);
assert.match(about, /<summary>PRIVACY &amp; USAGE STATISTICS<\/summary>/);
assert.match(about, /no analytics cookie and creates no persistent analytics identifier/i);
assert.match(about, /does not include your name, challenge name, challenge link or ID, replay, driving path, control inputs/i);
assert.match(about, /private developer dashboard/i);
assert.match(about, /about-privacy\.css\?revision=r1/);

assert.match(privacyCss, /\.turn-about-privacy summary[\s\S]*color: inherit[\s\S]*font: inherit/);
assert.match(privacyCss, /text-decoration: underline/);
assert.match(privacyCss, /keep the native disclosure marker/i);
assert.doesNotMatch(privacyCss, /--turn-disclosure-trigger|background:\s*var\(--turn-blue|list-style:\s*none/,
  'Privacy must stay a quiet native disclosure rather than the salient blue disclosure pattern');

assert.match(statsHtml, /<meta name="robots" content="noindex,nofollow,noarchive">/);
assert.match(statsHtml, /PRIVATE · ENKEL\.DESIGN/);
assert.match(statsHtml, /PLAY SESSIONS/);
assert.match(statsHtml, /does not assign a persistent analytics identifier/);
assert.doesNotMatch(statsHtml, /href=["'][^"']*stats/i,
  'The private dashboard must not link itself into public game navigation');
assert.match(statsJs, /location\.hash\.slice\(1\)/,
  'The private key must stay in the URL fragment so GitHub Pages never receives it');
assert.match(statsJs, /Authorization: `Bearer \$\{statsKey\}`/);
assert.doesNotMatch(statsJs, /localStorage|sessionStorage|document\.cookie/i,
  'The private dashboard must not persist its bearer key into browser storage');
assert.match(statsJs, /MOST PLAYED|mostTrack|mostCar/);
assert.match(statsJs, /YOUR TURN play sessions/);
assert.match(statsJs, /Motion-steered races/);
assert.match(statsJs, /Drive By Ear races/);

assert.match(workerConfig, /"main": "src\/router\.js"/);
assert.match(workerConfig, /"analytics_engine_datasets"/);
assert.match(workerConfig, /"binding": "ANALYTICS"/);
assert.match(workerConfig, /"dataset": "turn_gameplay"/);
assert.match(workerRouter, /handleTelemetryRoute/);
assert.match(workerTelemetry, /'play_session'[\s\S]*'race_start'[\s\S]*'lap_complete'[\s\S]*'lap_invalid'/);
assert.match(workerTelemetry, /writeDataPoint/);
assert.match(workerTelemetry, /const sessionHash = await sha256Hex\(event\.session\)/);
assert.match(workerTelemetry, /CREATE TABLE IF NOT EXISTS turn_telemetry_daily/);
assert.doesNotMatch(workerTelemetry, /INSERT INTO turn_telemetry_(?:event|raw|session)|session_hash TEXT|player_id TEXT/i,
  'D1 must keep daily aggregate usage only, not persistent player/session histories');
assert.match(workerTelemetry, /Authorization/);
assert.match(workerTelemetry, /stats_unauthorized/);

console.log('TURN private event-driven telemetry, privacy disclosure and stats dashboard regression passed.');
