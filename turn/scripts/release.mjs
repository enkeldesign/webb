import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const turnDir = path.resolve(scriptDir, '..');
const releasePath = path.join(turnDir, 'release.json');
const indexPath = path.join(turnDir, 'index.html');

export async function loadReleaseDefinition() {
  const release = JSON.parse(await fs.readFile(releasePath, 'utf8'));
  validateReleaseDefinition(release);
  return Object.freeze({ ...release });
}

export function validateReleaseDefinition(release) {
  assert.match(release?.version || '', /^\d+\.\d+\.\d+$/, 'TURN release version must use semver');
  assert.match(release?.id || '', /^\d{4}\.\d{2}\.\d{2}-r\d+$/, 'TURN release id must use YYYY.MM.DD-rN');
  assert.match(release?.cacheKey || '', /^\d{8}-r\d+$/, 'TURN cache key must use YYYYMMDD-rN');
  assert.equal(release.id.replaceAll('.', '').replace('-', '-'), release.cacheKey, 'Release id and cache key must describe the same build');
}

export function renderReleaseIndex(source, release) {
  validateReleaseDefinition(release);

  let output = source
    .replace(/<!-- TURN [^>]* -->/, `<!-- TURN ${release.id} release identity -->`)
    .replace(/<title>TURN v[^<]+<\/title>/, `<title>TURN v${release.version} · Build ${release.id}</title>`)
    .replace(
      /globalThis\.__TURN_BUILD__ = Object\.freeze\(\{[\s\S]*?\}\);/,
      `globalThis.__TURN_BUILD__ = Object.freeze({\n      version: '${release.version}',\n      id: '${release.id}',\n      cacheKey: '${release.cacheKey}'\n    });`
    )
    .replace(/TURN v\d+\.\d+\.\d+ · Build \d{4}\.\d{2}\.\d{2}-r\d+/g, `TURN v${release.version} · Build ${release.id}`)
    // Update the canonical build prefix while preserving an explicit per-asset
    // revision such as "-icon-20260730" after it.
    .replace(/((?:href|src)="\.\/[^"?]+\?build=)\d{8}-r\d+/g, `$1${release.cacheKey}`);

  output = output.replace(
    /<script type="importmap">\s*([\s\S]*?)\s*<\/script>/,
    (match, jsonText) => {
      const importMap = JSON.parse(jsonText);
      for (const [specifier, target] of Object.entries(importMap.imports || {})) {
        if (typeof target !== 'string' || !target.startsWith('./')) continue;
        const url = new URL(target, 'https://enkel.design/turn/');
        url.searchParams.set('build', release.cacheKey);
        importMap.imports[specifier] = `.${url.pathname.slice('/turn'.length)}${url.search}`;
      }
      return `<script type="importmap">\n${indentJson(importMap, 4)}\n  </script>`;
    }
  );

  return output;
}

export async function checkReleaseFiles({ write = false } = {}) {
  const [release, source] = await Promise.all([
    loadReleaseDefinition(),
    fs.readFile(indexPath, 'utf8')
  ]);
  const expected = renderReleaseIndex(source, release);

  if (write) {
    if (expected !== source) await fs.writeFile(indexPath, expected);
    return { release, changed: expected !== source };
  }

  assert.equal(
    source,
    expected,
    'turn/index.html is not synchronized with turn/release.json. Run: node turn/scripts/release.mjs --write'
  );
  return { release, changed: false };
}

function indentJson(value, spaces) {
  const indent = ' '.repeat(spaces);
  return JSON.stringify(value, null, 2)
    .split('\n')
    .map((line) => `${indent}${line}`)
    .join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const write = process.argv.includes('--write');
  const { release, changed } = await checkReleaseFiles({ write });
  const verb = write ? (changed ? 'synchronized' : 'already synchronized') : 'verified';
  console.log(`TURN ${release.id} release identity ${verb}.`);
}
