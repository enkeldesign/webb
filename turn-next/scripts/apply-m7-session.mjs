import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const repositoryRoot = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));

async function update(relativePath, transform) {
  const filePath = path.join(repositoryRoot, relativePath);
  const source = await fs.readFile(filePath, 'utf8');
  const output = transform(source);
  assert.notEqual(output, source, `${relativePath} was not changed by the M7 migration.`);
  await fs.writeFile(filePath, output);
}

function replaceRequired(source, search, replacement, label) {
  const firstIndex = source.indexOf(search);
  assert.notEqual(firstIndex, -1, `M7 migration could not find ${label}.`);
  assert.equal(source.indexOf(search, firstIndex + search.length), -1, `M7 migration found more than one ${label}.`);
  return source.slice(0, firstIndex) + replacement + source.slice(firstIndex + search.length);
}

await update('turn-next/scripts/build-parity-app.mjs', (source) => {
  let output = source;
  output = replaceRequired(
    output,
    "document.documentElement.dataset.turnDisplayLifecycle = 'platform-m6';\nconst turnNextBadgeDetail = document.querySelector('.turn-next-badge span');\nif (turnNextBadgeDetail) turnNextBadgeDetail.textContent += ' · Platform M5–M6 · Motion + Display Lifecycle';",
    "document.documentElement.dataset.turnDisplayLifecycle = 'platform-m6';\nconst turnNextBadgeDetail = document.querySelector('.turn-next-badge span');\nif (turnNextBadgeDetail) turnNextBadgeDetail.textContent += ' · Platform M5–M7 · Motion + Display + Session Lifecycle';",
    'M6 staging badge'
  );
  output = replaceRequired(
    output,
    "  output = replaceRequired(\n    output,\n    \"console.info(`TURN: ${globalThis.__TURN_BUILD__?.id || 'development'} loaded from the static module graph.`);\",",
    "  output = replaceRequired(\n    output,\n    \"await import(withBuild('./main.js'));\",\n    \"await import(new URL(`./main.js?source=${buildKey}-m7`, stagingModuleBase).href);\\ndocument.documentElement.dataset.turnSessionLifecycle = 'orchestrator-m7';\",\n    'M7 race-session entry'\n  );\n\n  output = replaceRequired(\n    output,\n    \"console.info(`TURN: ${globalThis.__TURN_BUILD__?.id || 'development'} loaded from the static module graph.`);\",",
    'bootstrap completion replacement insertion point'
  );
  output = replaceRequired(
    output,
    "  assert.match(output, /turnDisplayLifecycle = 'platform-m6'/);\n  assert.match(output, /installStylesheet\\('\\.\\/steering-limit-warning\\.css'/);",
    "  assert.match(output, /turnDisplayLifecycle = 'platform-m6'/);\n  assert.match(output, /turnSessionLifecycle = 'orchestrator-m7'/);\n  assert.match(output, /main\\.js\\?source=\\$\\{buildKey\\}-m7/);\n  assert.match(output, /installStylesheet\\('\\.\\/steering-limit-warning\\.css'/);",
    'M7 bootstrap assertions'
  );
  output = replaceRequired(
    output,
    "  assert.match(output, /Platform M5–M6 · Motion \\+ Display Lifecycle/);",
    "  assert.match(output, /Platform M5–M7 · Motion \\+ Display \\+ Session Lifecycle/);",
    'M6 badge assertion'
  );
  output = output.replaceAll("output.indexOf(\"withBuild('./main.js')\")", "output.indexOf('main.js?source=${buildKey}-m7')");
  assert.match(output, /M5–M7/);
  assert.match(output, /race-session entry/);
  return output;
});

await update('turn-next/scripts/build-parity-entry.mjs', (source) => {
  let output = source.replaceAll('-m6', '-m7');
  assert.notEqual(output, source, 'TURN NEXT entry did not contain the M6 cache key.');
  return output;
});

await update('turn-tests/turn-next-entry-production.mjs', (source) => {
  let output = source.replaceAll('-m6"/', '-m7"/');
  output = output.replaceAll("/Platform M5–M6 · Motion \\+ Display Lifecycle/", "/Platform M5–M7 · Motion \\+ Display \\+ Session Lifecycle/");
  output = replaceRequired(
    output,
    "assert.match(nextApp, /dataset\\.turnDisplayLifecycle = 'platform-m6'/);",
    "assert.match(nextApp, /dataset\\.turnDisplayLifecycle = 'platform-m6'/);\nassert.match(nextApp, /dataset\\.turnSessionLifecycle = 'orchestrator-m7'/);\nassert.match(nextApp, /main\\.js\\?source=\\$\\{buildKey\\}-m7/);",
    'TURN NEXT M6 dataset assertion'
  );
  output = output.replaceAll("nextApp.indexOf(\"withBuild('./main.js')\")", "nextApp.indexOf('main.js?source=${buildKey}-m7')");
  output = output.replace("console.log(`TURN NEXT Platform M5–M6 entry for TURN ${release.id} passed.`);", "console.log(`TURN NEXT Platform M5–M7 entry for TURN ${release.id} passed.`);");
  assert.match(output, /orchestrator-m7/);
  return output;
});

await update('turn-tests/platform-production.mjs', (source) => {
  let output = source;
  output = replaceRequired(
    output,
    "assert.match(nextApp, /turnDisplayLifecycle = 'platform-m6'/);\nassert.match(nextApp, /Platform M5–M6 · Motion \\+ Display Lifecycle/);",
    "assert.match(nextApp, /turnDisplayLifecycle = 'platform-m6'/);\nassert.match(nextApp, /turnSessionLifecycle = 'orchestrator-m7'/);\nassert.match(nextApp, /Platform M5–M7 · Motion \\+ Display \\+ Session Lifecycle/);",
    'platform M6 badge assertions'
  );
  output = output.replaceAll("nextApp.indexOf(\"withBuild('./main.js')\")", "nextApp.indexOf('main.js?source=${buildKey}-m7')");
  output = output.replace("console.log('TURN web platform contract and TURN NEXT Platform M5–M6 lifecycles passed.');", "console.log('TURN web platform contract and TURN NEXT Platform M5–M7 lifecycles passed.');");
  assert.match(output, /orchestrator-m7/);
  return output;
});

await update('turn-tests/motion-safe-zone-production.mjs', (source) => {
  let output = replaceRequired(
    source,
    `for (const appSource of [productionApp, nextApp]) {
  assert.match(appSource, /installStylesheet\\('\\.\\/steering-limit-warning\\.css'/);
  assert.match(appSource, /installSteeringLimitWarning\\(\\)/);
  assert.ok(
    appSource.indexOf('installSteeringLimitWarning()') < appSource.indexOf("withBuild('./main.js')"),
    'The canonical warning must install before the race core starts'
  );
}

assert.match(nextApp, /Platform M5–M6 · Motion \\+ Display Lifecycle/);`,
    `for (const appSource of [productionApp, nextApp]) {
  assert.match(appSource, /installStylesheet\\('\\.\\/steering-limit-warning\\.css'/);
  assert.match(appSource, /installSteeringLimitWarning\\(\\)/);
}
assert.ok(
  productionApp.indexOf('installSteeringLimitWarning()') < productionApp.indexOf("withBuild('./main.js')"),
  'Production warning must install before the race core starts'
);
assert.ok(
  nextApp.indexOf('installSteeringLimitWarning()') < nextApp.indexOf('main.js?source=\${buildKey}-m7'),
  'TURN NEXT warning must install before the M7 race core starts'
);

assert.match(nextApp, /Platform M5–M7 · Motion \\+ Display \\+ Session Lifecycle/);`,
    'safe-zone M6 bootstrap contract'
  );
  return output;
});

await update('eslint.config.mjs', (source) => replaceRequired(
  source,
  "      'turn/race/rival-storage.js',\n      'turn/race/track-spatial-index.js',",
  "      'turn/race/rival-storage.js',\n      'turn/race/session-orchestrator.js',\n      'turn/race/track-spatial-index.js',",
  'race domain lint list'
));

await update('.github/workflows/turn-lab-tests.yml', (source) => {
  let output = replaceRequired(
    source,
    "      - name: Verify TURN NEXT generated parity bootstrap\n        run: node turn-next/scripts/build-parity-app.mjs --check",
    "      - name: Verify TURN NEXT generated parity bootstrap\n        run: node turn-next/scripts/build-parity-app.mjs --check\n\n      - name: Verify TURN NEXT generated parity main\n        run: node turn-next/scripts/build-parity-main.mjs --check",
    'TURN NEXT bootstrap parity step'
  );
  output = replaceRequired(
    output,
    "      - name: Run web platform and motion composition regression\n        run: node turn-tests/platform-production.mjs",
    "      - name: Run web platform and motion composition regression\n        run: node turn-tests/platform-production.mjs\n\n      - name: Run TURN NEXT race-session orchestration regression\n        run: node turn-tests/session-orchestrator-production.mjs",
    'platform regression step'
  );
  return output;
});

for (const script of [
  'turn-next/scripts/build-parity-main.mjs',
  'turn-next/scripts/build-parity-app.mjs',
  'turn-next/scripts/build-parity-entry.mjs'
]) {
  await execFileAsync(process.execPath, [path.join(repositoryRoot, script)], { cwd: repositoryRoot });
}

console.log('Applied TURN NEXT Platform M7 session orchestration.');
