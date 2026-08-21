import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [client, about, privacyCss, statsHtml, statsJs, productionIndex, workerConfig, workerRouter, workerTelemetry] = await Promise.all([
  fs.readFile(new URL('../turn/telemetry/client.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/content/about-turn.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/about-privacy.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/stats/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/stats/stats.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8'),
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
assert.match(client, /turn\.telemetry\.developer\.v1/);
assert.match(client, /developer: isDeveloperDevice\(\)/);
assert.match(client, /localStorage\.getItem\(DEVELOPER_STORAGE_KEY\) === '1'/);
assert.doesNotMatch(client, /localStorage\.setItem|sessionStorage|document\.cookie|indexedDB/i,
  'Gameplay telemetry must not create a persistent player or session identifier');
assert.doesNotMatch(client, /requestAnimationFrame|setInterval|devicemotion|pointermove|mousemove/,
  'Telemetry must remain event-driven and stay out of the racing/rendering loops');

assert.match(about, /installTurnTelemetry\(\)/);
assert.match(about, /telemetry\/client\.js\?revision=r2/);
assert.match(about, /<details class="turn-about-privacy">/);
assert.match(about, /<summary>PRIVACY &amp; USAGE STATISTICS<\/summary>/);
assert.match(about, /no analytics cookie and creates no persistent analytics identifier/i);
assert.match(about, /developer yes\/no flag/i);
assert.match(about, /same local yes\/no marker used by every developer device/i);
assert.match(about, /does not include your name, challenge name, challenge link or ID, replay, driving path, control inputs/i);
assert.match(about, /private developer dashboard/i);
assert.match(about, /anonymous daily aggregate statistics in Cloudflare D1/i);
assert.match(about, /does not keep raw gameplay-event histories/i);
assert.match(about, /about-privacy\.css\?revision=r1/);

assert.match(privacyCss, /\.turn-about-privacy summary[\s\S]*color: inherit[\s\S]*font: inherit/);
assert.match(privacyCss, /text-decoration: underline/);
assert.match(privacyCss, /keep the native disclosure marker/i);
assert.doesNotMatch(privacyCss, /--turn-disclosure-trigger|background:\s*var\(--turn-blue|list-style:\s*none/,
  'Privacy must stay a quiet native disclosure rather than the salient blue disclosure pattern');

assert.match(statsHtml, /<meta name="robots" content="noindex,nofollow,noarchive">/);
assert.match(statsHtml, /PRIVATE · ENKEL\.DESIGN/);
assert.match(statsHtml, /PLAY SESSIONS/);
assert.match(statsHtml, /data-audience="players" aria-pressed="true">PLAYERS/);
assert.match(statsHtml, /data-audience="developer">DEVELOPER/);
assert.match(statsHtml, /MARK AS DEVELOPER/);
assert.match(statsHtml, /older activity cannot be separated/i);
assert.doesNotMatch(productionIndex, /href=["'][^"']*\/turn\/stats|href=["'][^"']*stats\//i,
  'The private dashboard must not be linked into public TURN navigation');
assert.match(statsJs, /location\.hash\.slice\(1\)/,
  'The private key must stay in the URL fragment so GitHub Pages never receives it');
assert.match(statsJs, /Authorization: `Bearer \$\{statsKey\}`/);
assert.match(statsJs, /turn\.telemetry\.developer\.v1/);
assert.match(statsJs, /localStorage\.setItem\(DEVELOPER_STORAGE_KEY, '1'\)/);
assert.match(statsJs, /localStorage\.removeItem\(DEVELOPER_STORAGE_KEY\)/);
assert.doesNotMatch(statsJs, /localStorage\.(?:setItem|getItem)\([^\n]*statsKey|sessionStorage|document\.cookie/i,
  'The private dashboard must never persist its bearer key into browser storage');
assert.match(statsJs, /audience/);
assert.match(statsJs, /renderFavourite\('Track', tracks, races\)/);
assert.match(statsJs, /renderFavourite\('Car', cars, races\)/);
assert.match(statsJs, /YOUR TURN play sessions/);
assert.match(statsJs, /Motion-steered races/);
assert.match(statsJs, /Drive By Ear races/);

assert.match(workerConfig, /"main": "src\/router\.js"/);
assert.match(workerConfig, /"d1_databases"/);
assert.match(workerConfig, /"binding": "DB"/);
assert.doesNotMatch(workerConfig, /analytics_engine_datasets|"binding": "ANALYTICS"/,
  'Private stats must deploy using the already-proven D1 binding only');
assert.match(workerRouter, /handleTelemetryRoute/);
assert.match(workerTelemetry, /'play_session'[\s\S]*'race_start'[\s\S]*'lap_complete'[\s\S]*'lap_invalid'/);
assert.match(workerTelemetry, /CREATE TABLE IF NOT EXISTS turn_telemetry_daily_v2/);
assert.match(workerTelemetry, /developer INTEGER NOT NULL/);
assert.match(workerTelemetry, /developer: Boolean\(value\.developer\)/);
assert.match(workerTelemetry, /STATS_AUDIENCES/);
assert.match(workerTelemetry, /audience === 'players'/);
assert.match(workerTelemetry, /UNION ALL/,
  'ALL stats must retain the original aggregate history while including new cohort-separated data');
assert.doesNotMatch(workerTelemetry, /INSERT INTO turn_telemetry_(?:event|raw|session)|session_hash TEXT|player_id TEXT|installation_id TEXT/i,
  'D1 must keep daily aggregate usage only, not persistent player/session histories');
assert.match(workerTelemetry, /Authorization/);
assert.match(workerTelemetry, /stats_unauthorized/);

console.log('TURN developer-filtered private telemetry, privacy disclosure and stats dashboard regression passed.');
