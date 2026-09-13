import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderParityEntry } from '../../turn-next/scripts/build-parity-entry.mjs';
import { buildTurnNextApp } from '../../turn-next/scripts/build-parity-app.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const turnDir = path.resolve(scriptDir, '..');
const releasePath = path.join(turnDir, 'release.json');
const indexPath = path.join(turnDir, 'index.html');
const labIndexPath = path.resolve(turnDir, '../turn-lab/index.html');
const RACING_MUSIC_SPECIFIER_PATTERN = /^\/turn\/audio\/racing-music-v2\.js\?build=\d{8}-r\d+-racing-music-warm-v2$/;
const AUDIO_PREFERENCES_SPECIFIER_PATTERN = /^\/turn\/audio\/audio-preferences\.js\?build=\d{8}-r\d+$/;
const COVERED_RENDERING_SPECIFIER_PATTERN = /^\/turn\/render\/covered-rendering\.js\?build=\d{8}-r\d+$/;
const RIVAL_ONBOARDING_SPECIFIER_PATTERN = /^\/turn\/ui\/rival-onboarding\.js\?build=\d{8}-r\d+$/;
const LOT_ENHANCEMENT_SPECIFIER_PATTERN = /^\/turn\/garage\/lot-enhancement-runtime\.js\?revision=r164-post-soak&build=\d{8}-r\d+$/;
const KNOWN_INSTALLED_LOT_SPECIFIER = '/turn/garage/lot-enhancement-runtime.js?revision=r164-post-soak&build=20260826-r184';
const SESSION_ORCHESTRATOR_SPECIFIER = '/turn/race/session-orchestrator.js?source=20260729-r118-m8';
const RIVAL_STORAGE_PATH = '/turn/race/rival-storage.js';
const RIVAL_STORAGE_REVISION = 'r224-finish-line-summary';
const companionPaths = Object.freeze([
  'turn-next/index.html',
  'turn-next/app.js',
  'yourturn/index.html',
  'turn/ui/about-history-bootstrap-r165.js',
  'turn/content/about-history-current.js',
  'turn/design.html',
  'turn/design-dialogs.html'
]);

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

function synchronizeReleaseBoundImportTarget(importMap, release, specifier) {
  const sourceTarget = importMap.imports?.[specifier];
  if (typeof sourceTarget !== 'string') return;

  const targetUrl = new URL(sourceTarget, 'https://enkel.design/turn/');
  targetUrl.searchParams.set('build', release.cacheKey);
  importMap.imports[specifier] = `${targetUrl.pathname}${targetUrl.search}`;
}

function synchronizeLotEnhancementSpecifiers(importMap, release) {
  const imports = importMap.imports || {};
  const currentSpecifier = `/turn/garage/lot-enhancement-runtime.js?revision=r164-post-soak&build=${release.cacheKey}`;
  const sourceSpecifier = Object.keys(imports).find((specifier) =>
    LOT_ENHANCEMENT_SPECIFIER_PATTERN.test(specifier) && specifier !== KNOWN_INSTALLED_LOT_SPECIFIER
  ) || Object.keys(imports).find((specifier) => LOT_ENHANCEMENT_SPECIFIER_PATTERN.test(specifier));
  if (!sourceSpecifier) return;

  const sourceTarget = imports[sourceSpecifier];
  const targetUrl = new URL(sourceTarget, 'https://enkel.design');
  targetUrl.searchParams.set('build', release.cacheKey);
  const currentTarget = `${targetUrl.pathname}${targetUrl.search}`;

  const synchronizedImports = {};
  let inserted = false;
  for (const [specifier, target] of Object.entries(imports)) {
    if (!LOT_ENHANCEMENT_SPECIFIER_PATTERN.test(specifier)) {
      synchronizedImports[specifier] = target;
      continue;
    }
    if (inserted) continue;

    // r184 shipped a Lot runtime URL that installed PWAs can still request from
    // their module cache. Keep that one known compatibility route while the
    // canonical current-build route advances normally. This is intentionally
    // narrow rather than a general revision-history system.
    if (KNOWN_INSTALLED_LOT_SPECIFIER !== currentSpecifier) {
      synchronizedImports[KNOWN_INSTALLED_LOT_SPECIFIER] = currentTarget;
    }
    synchronizedImports[currentSpecifier] = currentTarget;
    inserted = true;
  }
  importMap.imports = synchronizedImports;
}

function synchronizeRivalStorageTargets(importMap, release) {
  const canonicalTarget = `${RIVAL_STORAGE_PATH}?build=${release.cacheKey}&revision=${RIVAL_STORAGE_REVISION}`;
  for (const [specifier, target] of Object.entries(importMap.imports || {})) {
    if (typeof target !== 'string') continue;
    const targetUrl = new URL(target, 'https://enkel.design/turn/');
    if (targetUrl.pathname !== RIVAL_STORAGE_PATH) continue;
    importMap.imports[specifier] = canonicalTarget;
  }
}

function synchronizeScoreStoreTargets(importMap, release) {
  const aliases = {
    'drift-records.js': ['', '?revision=r206-home-track-records', '?revision=r219-record-paint'],
    'flow-records.js': ['', '?revision=r206-home-track-records', '?revision=r219-record-paint'],
    'score-record-store.js': [''],
    'drift-attack-runtime.js': ['', '?revision=r240-trophy-road-2'],
    'flow-runtime.js': ['', '?revision=r240-trophy-road-2']
  };
  const imports = importMap.imports ||= {};
  imports['/turn/achievements/runtime.js?revision=r244-reward-toast-guide']
    = `/turn/achievements/runtime.js?revision=r244-reward-toast-guide&build=${release.cacheKey}`;
  for (const [file, suffixes] of Object.entries(aliases)) {
    const pathname = `/turn/scoring/${file}`;
    const target = `${pathname}?build=${release.cacheKey}`;
    for (const suffix of suffixes) imports[`${pathname}${suffix}`] = target;
    for (const [specifier, existing] of Object.entries(imports)) {
      if (typeof existing === 'string' && new URL(existing, 'https://enkel.design/turn/').pathname === pathname) {
        imports[specifier] = target;
      }
    }
  }
  // The lap-result achievement batch also needs a fresh URL in shared shells.
  for (const [specifier, target] of Object.entries(imports)) {
    if (typeof target !== 'string') continue;
    if (new URL(target, 'https://enkel.design/turn/').pathname === '/turn/achievements/runtime.js') {
      synchronizeReleaseBoundImportTarget(importMap, release, specifier);
    }
  }
}

function synchronizeVisualResourceTargets(importMap, release) {
  const modules = {
    '/turn/main.js': ['r270-runtime-health', '?build=20260909-r212'],
    '/turn/vehicle/car-models.js': ['r257-authored-wheel-spin', '?revision=r257-authored-wheel-spin'],
    '/turn/vehicle/car-visual-resources.js': ['', ''],
    '/turn/vehicle/emergency-livery-models.js': ['r223-training-car-taxi', '?build=20260823-r179', '?build=20260811-r164'],
    '/turn/vehicle/learner-car-livery.js': ['r223-training-car-taxi', '?revision=r223-training-car-taxi'],
    '/turn/vehicle/supercar-kenney-wheels.js': ['r253-supercar-release', '?revision=r253-supercar-release'],
    '/turn/ui/track-best-car.js': ['r253-supercar-release', '?revision=r253-supercar-release'],
    '/turn/garage/lot-showroom-experiment.js': ['r259-swift-lot-ui-base', '?revision=r259-swift-lot-ui-base'],
    '/turn/achievements/trophy-road-showcase.js': ['r253-supercar-release', '?revision=r253-supercar-release']
  };
  const imports = importMap.imports ||= {};
  for (const [pathname, [revision, ...aliases]] of Object.entries(modules)) {
    const target = `${pathname}?${revision ? `revision=${revision}&` : ''}build=${release.cacheKey}`;
    for (const suffix of ['', ...aliases]) {
      const specifier = `${pathname}${suffix}`;
      // Preserve presentation bridges (car liveries and the Lot heading wrapper).
      if (imports[specifier] && new URL(imports[specifier], 'https://enkel.design/turn/').pathname !== pathname) continue;
      imports[specifier] = target;
    }
    for (const [specifier, existing] of Object.entries(imports)) {
      if (typeof existing === 'string' && new URL(existing, 'https://enkel.design/turn/').pathname === pathname) {
        imports[specifier] = target;
      }
    }
  }
}

function renderSharedResourceImports(source, release) {
  return source.replace(/<script type="importmap">\s*([\s\S]*?)\s*<\/script>/, (_, jsonText) => {
    const importMap = JSON.parse(jsonText);
    synchronizeScoreStoreTargets(importMap, release);
    synchronizeVisualResourceTargets(importMap, release);
    return `<script type="importmap">\n${indentJson(importMap, 4)}\n  </script>`;
  });
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
  synchronizeReleaseBoundSpecifier(
    importMap,
    release,
    RIVAL_ONBOARDING_SPECIFIER_PATTERN,
    `/turn/ui/rival-onboarding.js?build=${release.cacheKey}`
  );
  synchronizeLotEnhancementSpecifiers(importMap, release);
  synchronizeRivalStorageTargets(importMap, release);
  synchronizeScoreStoreTargets(importMap, release);
  synchronizeVisualResourceTargets(importMap, release);
  synchronizeReleaseBoundImportTarget(importMap, release, SESSION_ORCHESTRATOR_SPECIFIER);
  // These presentation modules now use the release build instead of a new
  // hand-maintained revision. Advance every alias, including installed routes.
  for (const [specifier, target] of Object.entries(importMap.imports || {})) {
    if (typeof target !== 'string' || !target.startsWith('/turn/')) continue;
    const pathname = new URL(target, 'https://enkel.design').pathname;
    if (pathname === '/turn/garage/lot-enhancement-runtime.js'
      || pathname === '/turn/progression/trophy-road-track-icons.js'
      || pathname === '/turn/garage/lot-track-select.js'
      || pathname === '/turn/m8-home.js') {
      synchronizeReleaseBoundImportTarget(importMap, release, specifier);
    }
  }
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
      /(<!-- TURN LAB [^>]*Runtime source: production TURN )\d{4}\.\d{2}\.\d{2}-r\d+(\. -->)/,
      `$1${release.id}$2`
    )
    .replace(
      /globalThis\.__TURN_BUILD__ = Object\.freeze\(\{[\s\S]*?\}\);/,
      `globalThis.__TURN_BUILD__ = Object.freeze({\n      version: '${release.version}',\n      id: '${release.id}',\n      cacheKey: '${release.cacheKey}'\n    });`
    )
    .replace(
      /runtime: 'production TURN \d{4}\.\d{2}\.\d{2}-r\d+'/g,
      `runtime: 'production TURN ${release.id}'`
    )
    .replace(
      /TURN LAB · production TURN \d+\.\d+\.\d+ r\d+/g,
      `TURN LAB · production TURN ${release.version} r${revision}`
    )
    .replace(/((?:href|src)="\.\/[^"?]+\?build=)\d{8}-r\d+/g, `$1${release.cacheKey}`)
    .replace(/<script type="importmap">[\s\S]*?<\/script>/, productionImportMap);
}

export function renderReleaseCompanion(repositoryPath, source, release) {
  validateReleaseDefinition(release);
  if (repositoryPath === 'turn-next/index.html') return renderSharedResourceImports(renderParityEntry(source, release), release);
  if (repositoryPath === 'turn-next/app.js') return buildTurnNextApp(release);
  if (repositoryPath === 'yourturn/index.html') {
    return renderSharedResourceImports(source.replace(/((?:href|src)="\/turn\/[^"?]+\?build=)\d{8}-r\d+/g, `$1${release.cacheKey}`), release);
  }
  if (repositoryPath === 'turn/ui/about-history-bootstrap-r165.js') {
    return source.replace(/(about-history-current\.js\?build=)\d{8}-r\d+/, `$1${release.cacheKey}`);
  }
  if (repositoryPath === 'turn/content/about-history-current.js') {
    // Historical entries keep their original release identities.
    return source.replace(
      /(export const CURRENT_RELEASE = Object\.freeze\(\{\s*version: ')[^']+(',\s*build: ')[^']+(')/,
      `$1${release.version}$2${release.id}$3`
    );
  }
  assert.ok(repositoryPath === 'turn/design.html' || repositoryPath === 'turn/design-dialogs.html',
    `Unknown release companion: ${repositoryPath}`);
  return source
    .replace(/(<span>TURN )\d+\.\d+\.\d+(<\/span>)/, `$1${release.version}$2`)
    .replace(/(<span>Build )\d{4}\.\d{2}\.\d{2}-r\d+(<\/span>)/, `$1${release.id}$2`)
    .replace(/(class="home-mini__build">)TURN \d+\.\d+\.\d+ · \d{4}\.\d{2}\.\d{2}-r\d+/, `$1TURN ${release.version} · ${release.id}`);
}

export async function checkReleaseFiles({ write = false } = {}) {
  const [release, source, labSource, companions] = await Promise.all([
    loadReleaseDefinition(),
    fs.readFile(indexPath, 'utf8'),
    fs.readFile(labIndexPath, 'utf8'),
    Promise.all(companionPaths.map(async (repositoryPath) => [
      repositoryPath,
      await fs.readFile(path.resolve(turnDir, '..', repositoryPath), 'utf8')
    ]))
  ]);
  const expected = renderReleaseIndex(source, release);
  const expectedLab = renderLabReleaseIndex(labSource, expected, release);
  const files = [
    ['turn/index.html', source, expected],
    ['turn-lab/index.html', labSource, expectedLab],
    ...companions.map(([repositoryPath, content]) => [
      repositoryPath, content, renderReleaseCompanion(repositoryPath, content, release)
    ])
  ];
  let changed = false;
  for (const [repositoryPath, current, rendered] of files) {
    if (write && current !== rendered) {
      await fs.writeFile(path.resolve(turnDir, '..', repositoryPath), rendered);
      changed = true;
    } else if (!write) {
      assert.equal(current, rendered,
        `${repositoryPath} is not synchronized with turn/release.json. Run: node turn/scripts/release.mjs --write`);
    }
  }
  return { release, changed };
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
