import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const turnDir = path.resolve(scriptDir, '..');
const releasePath = path.join(turnDir, 'release.json');
const indexPath = path.join(turnDir, 'index.html');
const labIndexPath = path.resolve(turnDir, '../turn-lab/index.html');
const RACING_MUSIC_SPECIFIER_PATTERN = /^\/turn\/audio\/racing-music-v2\.js\?build=\d{8}-r\d+-racing-music-warm-v2$/;
const AUDIO_PREFERENCES_SPECIFIER_PATTERN = /^\/turn\/audio\/audio-preferences\.js\?build=\d{8}-r\d+$/;
const COVERED_RENDERING_SPECIFIER_PATTERN = /^\/turn\/render\/covered-rendering\.js\?build=\d{8}-r\d+$/;

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

function synchronizeRuntimeMusicSpecifier(importMap, release) {
  const imports = importMap.imports || {};
  const currentSpecifier = `/turn/audio/racing-music-v2.js?build=${release.cacheKey}-racing-music-warm-v2`;
  const staleSpecifier = Object.keys(imports).find((specifier) =>
    RACING_MUSIC_SPECIFIER_PATTERN.test(specifier) && specifier !== currentSpecifier
  );

  if (!staleSpecifier) return;

  const synchronizedImports = {};
  for (const [specifier, target] of Object.entries(imports)) {
    synchronizedImports[specifier === staleSpecifier ? currentSpecifier : specifier] = target;
  }
  importMap.imports = synchronizedImports;
}

function synchronizeReleaseBoundSpecifier(importMap, release, pattern, currentSpecifier) {
  const imports = importMap.imports || {};
  const sourceSpecifier = Object.keys(imports).find((specifier) => pattern.test(specifier));
  if (!sourceSpecifier) return;

  const sourceTarget = imports[sourceSpecifier];
  const targetUrl = new URL(sourceTarget, 'https://enkel.design');
  targetUrl.searchParams.set('build', release.cacheKey);
  const currentTarget = `${targetUrl.pathname}${targetUrl.search}`;

  const synchronizedImports = {};
  for (const [specifier, target] of Object.entries(imports)) {
    synchronizedImports[specifier === sourceSpecifier ? currentSpecifier : specifier] =
      specifier === sourceSpecifier ? currentTarget : target;
  }
  importMap.imports = synchronizedImports;
}

function synchronizeRuntimeReleaseBoundSpecifiers(importMap, release) {
  // Keep this list to modules imported through withBuild(); historical alias keys intentionally retain their source revisions.
  synchronizeReleaseBoundSpecifier(
    importMap,
    release,
    AUDIO_PREFERENCES_SPECIFIER_PATTERN,
    `/turn/audio/audio-preferences.js?build=${release.cacheKey}`
  );
  synchronizeReleaseBoundSpecifier(
    importMap,
    release,
    COVERED_RENDERING_SPECIFIER_PATTERN,
    `/turn/render/covered-rendering.js?build=${release.cacheKey}`
  );
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
      synchronizeRuntimeMusicSpecifier(importMap, release);
      synchronizeRuntimeReleaseBoundSpecifiers(importMap, release);
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

export function renderLabReleaseIndex(source, productionIndex, release) {
  validateReleaseDefinition(release);
  const productionImportMap = productionIndex.match(/<script type="importmap">[\s\S]*?<\/script>/)?.[0];
  assert.ok(productionImportMap, 'Production TURN must expose an import map before TURN LAB can be synchronized');
  const revision = release.id.match(/-r(\d+)$/)?.[1] || '';

  return source
    .replace(
      /<!-- TURN LAB viewport diagnostics\. Runtime source: production TURN [^>]* -->/,
      `<!-- TURN LAB viewport diagnostics. Runtime source: production TURN ${release.id}. -->`
    )
    .replace(
      /globalThis\.__TURN_BUILD__ = Object\.freeze\(\{[\s\S]*?\}\);/,
      `globalThis.__TURN_BUILD__ = Object.freeze({\n      version: '${release.version}',\n      id: '${release.id}',\n      cacheKey: '${release.cacheKey}'\n    });`
    )
    .replace(
      /TURN LAB · production TURN \d+\.\d+\.\d+ r\d+/g,
      `TURN LAB · production TURN ${release.version} r${revision}`
    )
    .replace(/((?:href|src)="\.\/[^"?]+\?build=)\d{8}-r\d+/g, `$1${release.cacheKey}`)
    .replace(/<script type="importmap">[\s\S]*?<\/script>/, productionImportMap);
}

export async function checkReleaseFiles({ write = false } = {}) {
  const [release, source, labSource] = await Promise.all([
    loadReleaseDefinition(),
    fs.readFile(indexPath, 'utf8'),
    fs.readFile(labIndexPath, 'utf8')
  ]);
  const expected = renderReleaseIndex(source, release);
  const expectedLab = renderLabReleaseIndex(labSource, expected, release);

  if (write) {
    const productionChanged = expected !== source;
    const labChanged = expectedLab !== labSource;
    if (productionChanged) await fs.writeFile(indexPath, expected);
    if (labChanged) await fs.writeFile(labIndexPath, expectedLab);
    return { release, changed: productionChanged || labChanged };
  }

  assert.equal(
    source,
    expected,
    'turn/index.html is not synchronized with turn/release.json. Run: node turn/scripts/release.mjs --write'
  );
  assert.equal(
    labSource,
    expectedLab,
    'turn-lab/index.html is not synchronized with production TURN. Run: node turn/scripts/release.mjs --write'
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
