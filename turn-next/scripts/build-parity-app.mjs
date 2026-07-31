import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const releasePath = path.join(repositoryRoot, 'turn', 'release.json');
const outputPath = path.join(repositoryRoot, 'turn-next', 'app.js');

export function buildTurnNextApp(release) {
  return `// Generated from the canonical TURN v${release.version} runtime. Do not edit by hand.\nconst buildKey = globalThis.__TURN_BUILD__?.cacheKey || '';\nconst url = new URL('/turn/app.js', globalThis.location?.href || 'https://enkel.design/turn-next/');\nif (buildKey) url.searchParams.set('build', buildKey);\nawait import(url.href);\nconsole.info(\`TURN NEXT: \${globalThis.__TURN_BUILD__?.id || 'development'} loaded through the canonical TURN runtime.\`);\n`;
}

async function main() {
  const release = JSON.parse(await fs.readFile(releasePath, 'utf8'));
  const generated = buildTurnNextApp(release);

  if (process.argv.includes('--check')) {
    const current = await fs.readFile(outputPath, 'utf8').catch(() => null);
    assert.equal(current, generated, 'turn-next/app.js is stale. Run node turn-next/scripts/build-parity-app.mjs.');
    assert.match(current, /await import\(url\.href\)/);
    assert.doesNotMatch(current, /installMotionLifecycleBridge|installM8HomeNavigation/);
    console.log(`TURN NEXT bootstrap wraps canonical TURN ${release.id}.`);
    return;
  }

  await fs.writeFile(outputPath, generated);
  console.log(`Generated turn-next/app.js wrapper for TURN ${release.id}.`);
}

if (import.meta.url === new URL(process.argv[1], 'file:').href) await main();
