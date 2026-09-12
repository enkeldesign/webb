import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const repositoryRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const productionDocumentUrl = new URL('https://enkel.design/turn/index.html');
const comparedExtensions = new Set(['.css', '.js', '.mjs']);

const criticalReleaseTargets = Object.freeze({
  '/turn/vehicle/catalog.js': '/turn/vehicle/catalog.js?revision=r253-supercar-release',
  '/turn/vehicle/car-models.js': '/turn/vehicle/car-models.js?revision=r257-authored-wheel-spin'
});

const crossDeploymentCompatibilityRoutes = Object.freeze({
  '/turn/vehicle/catalog.js?revision=r243-mountain-1300': criticalReleaseTargets['/turn/vehicle/catalog.js'],
  '/turn/vehicle/catalog.js?revision=r248-supercar': criticalReleaseTargets['/turn/vehicle/catalog.js'],
  '/turn/vehicle/catalog.js?revision=r250-supercar-finish': criticalReleaseTargets['/turn/vehicle/catalog.js'],
  '/turn/vehicle/car-models.js?revision=r252-supercar-outward-rims': criticalReleaseTargets['/turn/vehicle/car-models.js'],
  '/turn/vehicle/car-models.js?revision=r253-supercar-release': criticalReleaseTargets['/turn/vehicle/car-models.js'],
  '/turn/achievements/trophy-road-showcase.js?revision=r243-mountain-1300': '/turn/achievements/trophy-road-showcase.js?revision=r253-supercar-release',
  '/turn/achievements/challenge-expansion-r166.js?revision=r166-bella-records': '/turn/achievements/challenge-expansion-r166.js?revision=r256-achievement-polling',
  '/turn/achievements/challenge-expansion-r166.js?revision=r241-learning-achievements': '/turn/achievements/challenge-expansion-r166.js?revision=r256-achievement-polling',
  '/turn/vehicle/shift-profile.js?revision=r232-double-shift': '/turn/vehicle/shift-profile.js?revision=r255-flow-shift-accessibility',
  '/turn/vehicle/shift-profile.js?revision=r253-supercar-release': '/turn/vehicle/shift-profile.js?revision=r255-flow-shift-accessibility',
  '/turn/vehicle/flow-shift.js?revision=r248-supercar': '/turn/vehicle/flow-shift.js?revision=r255-flow-shift-accessibility',
  '/turn/vehicle/flow-shift.js?revision=r253-supercar-release': '/turn/vehicle/flow-shift.js?revision=r255-flow-shift-accessibility',
  '/turn/vehicle/flow-shift.js?revision=r254-flow-shift-authority': '/turn/vehicle/flow-shift.js?revision=r255-flow-shift-accessibility',
  '/turn/ui/shift-feedback.js?revision=r232-double-shift': '/turn/ui/shift-feedback.js?revision=r255-flow-shift-accessibility',
  '/turn/ui/shift-feedback.js?revision=r253-supercar-release': '/turn/ui/shift-feedback.js?revision=r255-flow-shift-accessibility'
});

const legacyTrophyRoadCompatibilityRoutes = Object.freeze({
  '/turn/progression/trophy-road.js?revision=r243-mountain-1300': '/turn/progression/trophy-road.js?revision=r253-supercar-release',
  '/turn/progression/trophy-road.js?revision=r248-supercar': '/turn/progression/trophy-road.js?revision=r253-supercar-release'
});

function productionPresentationRoutes(release) {
  const trophyRoadPresentation = `/turn/progression/trophy-road-track-icons.js?revision=r1-track-reward-icons&build=${release.cacheKey}`;
  return Object.freeze({
    '/turn/progression/trophy-road.js?revision=r243-mountain-1300': trophyRoadPresentation,
    '/turn/progression/trophy-road.js?revision=r248-supercar': trophyRoadPresentation,
    '/turn/progression/trophy-road.js?revision=r253-supercar-release': trophyRoadPresentation,
    '/turn/achievements/catalog.js?revision=r222-awd-label': '/turn/achievements/catalog-track-icons.js?revision=r1-track-reward-icons',
    '/turn/achievements/catalog.js?revision=r240-trophy-road-2': '/turn/achievements/catalog-track-icons.js?revision=r1-track-reward-icons',
    '/turn/achievements/catalog.js?revision=r241-learning-achievements': '/turn/achievements/catalog-track-icons.js?revision=r1-track-reward-icons',
    '/turn/achievements/catalog-production.js?revision=r222-awd-label': '/turn/achievements/catalog-track-icons.js?revision=r1-track-reward-icons',
    '/turn/achievements/catalog-production.js?revision=r240-trophy-road-2': '/turn/achievements/catalog-track-icons.js?revision=r1-track-reward-icons',
    '/turn/achievements/catalog-production.js?revision=r241-learning-achievements': '/turn/achievements/catalog-track-icons.js?revision=r1-track-reward-icons',
    '/turn/garage/lot-showroom-experiment.js?revision=r252-supercar-outward-rims': '/turn/garage/lot-showroom-track-icon.js?revision=r2-swift-lot-ui'
  });
}

const requiredActiveModules = Object.freeze([
  'turn/app.js',
  'turn/main.js',
  'turn/ui/gameplay-controls.js',
  'turn/ui/rival-onboarding.js',
  'turn/ui/shift-feedback.js',
  'turn/ui/track-best-car.js',
  'turn/ui/track-icons.js',
  'turn/vehicle/catalog.js',
  'turn/vehicle/car-models.js',
  'turn/vehicle/flow-shift.js',
  'turn/vehicle/shift-tuning.js',
  'turn/vehicle/shift-profile.js',
  'turn/vehicle/wheel-animation-rig.js',
  'turn/achievements/catalog-track-icons.js',
  'turn/achievements/trophy-road-feedback.js',
  'turn/achievements/trophy-road-showcase.js',
  'turn/progression/trophy-road-track-icons.js',
  'turn/garage/lot-showroom-track-icon.js',
  'turn/assets/cars/supercar-model-data.js'
]);

function argumentValue(name) {
  const inline = process.argv.find((argument) => argument.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || '' : '';
}

function repositoryPathFromUrl(url) {
  if (url.origin !== productionDocumentUrl.origin) return null;
  const repositoryPath = decodeURIComponent(url.pathname).replace(/^\//, '');
  if (!repositoryPath || repositoryPath.includes('..')) return null;
  return repositoryPath;
}

function parseImportMap(document) {
  const source = document.match(/<script type=["']importmap["']>\s*([\s\S]*?)\s*<\/script>/i)?.[1];
  assert.ok(source, 'TURN entrypoint must include an import map');
  return JSON.parse(source);
}

function normalizedImportMap(importMap, documentUrl = productionDocumentUrl) {
  const entries = Object.entries(importMap.imports || {}).map(([specifier, target]) => {
    const normalizedSpecifier = /^[./]|^https?:/.test(specifier)
      ? new URL(specifier, documentUrl).href
      : specifier;
    const normalizedTarget = /^[./]|^https?:/.test(target)
      ? new URL(target, documentUrl).href
      : target;
    return [normalizedSpecifier, normalizedTarget];
  });
  return entries.sort(([left], [right]) => right.length - left.length);
}

function resolveModuleSpecifier(specifier, importerUrl, importMapEntries) {
  const normalizedSpecifier = /^[./]|^https?:/.test(specifier)
    ? new URL(specifier, importerUrl).href
    : specifier;

  for (const [key, target] of importMapEntries) {
    if (normalizedSpecifier === key) return new URL(target);
    if (key.endsWith('/') && normalizedSpecifier.startsWith(key)) {
      return new URL(`${target}${normalizedSpecifier.slice(key.length)}`);
    }
  }

  if (/^[./]|^https?:/.test(specifier)) return new URL(specifier, importerUrl);
  return null;
}

function moduleReferences(source, importerUrl, release, importMapEntries) {
  const references = [];
  const add = (specifier, cacheBust = false) => {
    let resolved = resolveModuleSpecifier(specifier, importerUrl, importMapEntries);
    if (!resolved) return;
    if (cacheBust && release.cacheKey) {
      resolved.searchParams.set('build', release.cacheKey);
      resolved = resolveModuleSpecifier(resolved.href, importerUrl, importMapEntries) || resolved;
    }
    references.push(resolved);
  };

  const withoutComments = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

  for (const match of withoutComments.matchAll(/\b(?:import|export)\s+(?:[^'";]*?\s+from\s*)?['"]([^'"]+)['"]/g)) {
    add(match[1]);
  }
  for (const match of withoutComments.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    add(match[1]);
  }
  for (const match of withoutComments.matchAll(/\b(withBuild|assetUrl)\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    const specifier = match[1] === 'assetUrl'
      ? `../${match[2].replace(/^\.\//, '')}`
      : match[2];
    add(specifier, true);
  }
  for (const match of withoutComments.matchAll(/\binstallStylesheet\(\s*['"]([^'"]+)['"]/g)) {
    add(match[1], true);
  }
  for (const match of withoutComments.matchAll(/\bimport\s*\(\s*`([^`]*)`\s*\)/g)) {
    const specifier = match[1].replaceAll('${buildKey}', release.cacheKey);
    if (!specifier.includes('${')) add(specifier);
  }

  return references;
}

function documentAssets(document, documentUrl = productionDocumentUrl) {
  const assets = [];
  const modules = [];
  for (const match of document.matchAll(/<(?:link|script)\b[^>]*>/gi)) {
    const tag = match[0];
    const specifier = tag.match(/\b(?:href|src)=["']([^"']+)["']/i)?.[1];
    if (!specifier) continue;
    const url = new URL(specifier, documentUrl);
    assets.push(url);
    if (/^<script/i.test(tag) && /\btype=["']module["']/i.test(tag)) modules.push(url);
  }
  return { assets, modules };
}

function addIdentity(identities, url) {
  const repositoryPath = repositoryPathFromUrl(url);
  if (!repositoryPath) return;
  if (!identities.has(repositoryPath)) identities.set(repositoryPath, new Set());
  identities.get(repositoryPath).add(`${url.pathname}${url.search}`);
}

async function currentReader(repositoryPath) {
  try {
    return await fs.readFile(path.join(repositoryRoot, repositoryPath), 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

function gitReader(reference) {
  return async (repositoryPath) => {
    try {
      const { stdout } = await execFileAsync('git', ['show', `${reference}:${repositoryPath}`], {
        cwd: repositoryRoot,
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024
      });
      return stdout;
    } catch (error) {
      if (error?.code === 128 || /does not exist|exists on disk, but not in/.test(error?.stderr || '')) return null;
      throw error;
    }
  };
}

async function buildProductionGraph(readText) {
  const [document, releaseSource] = await Promise.all([
    readText('turn/index.html'),
    readText('turn/release.json')
  ]);
  assert.ok(document, 'Production TURN entrypoint must exist');
  assert.ok(releaseSource, 'TURN release definition must exist');
  const release = JSON.parse(releaseSource);
  const importMap = parseImportMap(document);
  const importMapEntries = normalizedImportMap(importMap);
  const { assets, modules } = documentAssets(document);
  const identities = new Map();
  const missingModules = [];
  const queue = [...modules];
  const visited = new Set();

  for (const asset of assets) addIdentity(identities, asset);

  while (queue.length) {
    let url = queue.shift();
    url = resolveModuleSpecifier(url.href, productionDocumentUrl, importMapEntries) || url;
    if (visited.has(url.href)) continue;
    visited.add(url.href);
    addIdentity(identities, url);

    const repositoryPath = repositoryPathFromUrl(url);
    if (!repositoryPath || !/\.(?:m?js)$/.test(repositoryPath)) continue;
    const source = await readText(repositoryPath);
    if (source === null) {
      missingModules.push(`${repositoryPath} (${url.pathname}${url.search})`);
      continue;
    }
    queue.push(...moduleReferences(source, url, release, importMapEntries));
  }

  assert.deepEqual(missingModules, [], `Active module URLs must point to repository files:\n${missingModules.join('\n')}`);
  return { document, identities, importMap, release };
}

function assertRouteTargets(importMap, expectedRoutes, label) {
  for (const [specifier, target] of Object.entries(expectedRoutes)) {
    assert.equal(importMap.imports?.[specifier], target, `${label} must route ${specifier} to the current release graph`);
  }
}

function assertLocalImportTargetsExist(importMap, label) {
  return Promise.all(Object.values(importMap.imports || {}).map(async (target) => {
    if (!/^[./]/.test(target)) return;
    const url = new URL(target, productionDocumentUrl);
    const repositoryPath = repositoryPathFromUrl(url);
    assert.ok(repositoryPath, `${label} local import target ${target} must stay inside this repository`);
    const source = await currentReader(repositoryPath);
    assert.notEqual(source, null, `${label} import target ${target} must exist at ${repositoryPath}`);
  }));
}

function assertSingleActiveIdentity(graph, repositoryPath, label) {
  const identities = [...(graph.identities.get(repositoryPath) || [])];
  assert.equal(
    identities.length,
    1,
    `${label} must resolve ${repositoryPath} through one active URL identity; got ${identities.join(', ') || 'none'}`
  );
}

export function assertNoUnchangedActiveIdentities(changedPaths, baseGraph, headGraph) {
  const stale = [];
  for (const repositoryPath of changedPaths) {
    if (!comparedExtensions.has(path.extname(repositoryPath))) continue;
    const before = baseGraph.identities.get(repositoryPath);
    const after = headGraph.identities.get(repositoryPath);
    if (!before || !after) continue;
    const unchanged = [...before].filter((identity) => after.has(identity));
    if (unchanged.length) stale.push(`${repositoryPath}: ${unchanged.join(', ')}`);
  }
  assert.deepEqual(
    stale,
    [],
    `Changed active TURN files must receive a new effective URL identity:\n${stale.join('\n')}`
  );
}

async function changedPathsSince(reference) {
  const { stdout } = await execFileAsync('git', ['diff', '--no-renames', '--name-only', reference, '--'], {
    cwd: repositoryRoot,
    encoding: 'utf8'
  });
  return stdout.split('\n').filter(Boolean);
}

function verifyIdentityGuard() {
  const staleIdentity = '/turn/example.js?revision=r1';
  const changed = ['turn/example.js'];
  const baseGraph = { identities: new Map([['turn/example.js', new Set([staleIdentity])]]) };
  const staleGraph = { identities: new Map([['turn/example.js', new Set([staleIdentity])]]) };
  const freshGraph = { identities: new Map([['turn/example.js', new Set(['/turn/example.js?revision=r2'])]]) };
  assert.throws(() => assertNoUnchangedActiveIdentities(changed, baseGraph, staleGraph));
  assert.doesNotThrow(() => assertNoUnchangedActiveIdentities(changed, baseGraph, freshGraph));
}

const turnWorkflowPaths = (await fs.readdir(path.join(repositoryRoot, '.github', 'workflows')))
  .filter((name) => /^turn-.*\.ya?ml$/.test(name))
  .sort()
  .map((name) => `.github/workflows/${name}`);

const [
  headGraph,
  labDocument,
  nextDocument,
  yourTurnDocument,
  aboutBootstrap,
  aboutHistory,
  workflowEntries
] = await Promise.all([
  buildProductionGraph(currentReader),
  currentReader('turn-lab/index.html'),
  currentReader('turn-next/index.html'),
  currentReader('yourturn/index.html'),
  currentReader('turn/ui/about-history-bootstrap-r165.js'),
  currentReader('turn/content/about-history-current.js'),
  Promise.all(turnWorkflowPaths.map(async (workflowPath) => [workflowPath, await currentReader(workflowPath)]))
]);

assert.ok(
  labDocument && nextDocument && yourTurnDocument && aboutBootstrap && aboutHistory,
  'TURN deployment and release-facing documents must exist'
);
const labImportMap = parseImportMap(labDocument);
const nextImportMap = parseImportMap(nextDocument);
const yourTurnImportMap = parseImportMap(yourTurnDocument);

assert.deepEqual(labImportMap, headGraph.importMap, 'TURN LAB must use the exact production import map');
assertRouteTargets(headGraph.importMap, criticalReleaseTargets, 'Production TURN');
assertRouteTargets(headGraph.importMap, crossDeploymentCompatibilityRoutes, 'Production TURN');
assertRouteTargets(headGraph.importMap, productionPresentationRoutes(headGraph.release), 'Production TURN');
assertRouteTargets(nextImportMap, criticalReleaseTargets, 'TURN NEXT');
assertRouteTargets(nextImportMap, crossDeploymentCompatibilityRoutes, 'TURN NEXT');
assertRouteTargets(nextImportMap, legacyTrophyRoadCompatibilityRoutes, 'TURN NEXT');
assertRouteTargets(yourTurnImportMap, criticalReleaseTargets, 'YOUR TURN');
assertRouteTargets(yourTurnImportMap, crossDeploymentCompatibilityRoutes, 'YOUR TURN');
assertRouteTargets(yourTurnImportMap, legacyTrophyRoadCompatibilityRoutes, 'YOUR TURN');

await Promise.all([
  assertLocalImportTargetsExist(headGraph.importMap, 'Production TURN'),
  assertLocalImportTargetsExist(nextImportMap, 'TURN NEXT'),
  assertLocalImportTargetsExist(yourTurnImportMap, 'YOUR TURN')
]);

assert.doesNotMatch(headGraph.document, /challenge-mode|challenge-codec|RACE MY GHOST/,
  'Challenge prototypes must remain isolated from production TURN');
assert.doesNotMatch(headGraph.document, /href=["'][^"']*(?:\/turn\/stats|stats\/)/i,
  'The private statistics dashboard must not be linked from production TURN');

const escapedVersion = headGraph.release.version.replaceAll('.', '\\.');
const escapedReleaseId = headGraph.release.id.replaceAll('.', '\\.');
assert.match(aboutBootstrap, new RegExp(`about-history-current\\.js\\?build=${headGraph.release.cacheKey}`),
  'About must import release history through the current cache identity');
assert.match(
  aboutHistory,
  new RegExp(`CURRENT_RELEASE[\\s\\S]*version: '${escapedVersion}'[\\s\\S]*build: '${escapedReleaseId}'`),
  'About history must describe the current release source of truth'
);
assert.match(nextDocument, new RegExp(`Source TURN v${escapedVersion} · Build ${escapedReleaseId}`),
  'TURN NEXT must identify the current production release');
for (const bootstrap of ['motion-safe-zone.js', 'orientation-compat.js']) {
  assert.match(yourTurnDocument, new RegExp(`/turn/${bootstrap.replace('.', '\\.')}\\?build=${headGraph.release.cacheKey}`),
    `YOUR TURN must load ${bootstrap} through the current production release`);
}

for (const repositoryPath of requiredActiveModules) {
  assert.ok(headGraph.identities.has(repositoryPath), `${repositoryPath} must remain represented in the production module graph`);
}

assertSingleActiveIdentity(
  headGraph,
  'turn/race/rival-storage.js',
  'Production TURN rival storage'
);

const rivalRoute = Object.entries(headGraph.importMap.imports || {}).find(([specifier]) =>
  /^\/turn\/ui\/rival-onboarding\.js\?build=\d{8}-r\d+$/.test(specifier)
);
assert.ok(rivalRoute, 'Production TURN must retain the release-bound rival onboarding route');
assert.match(rivalRoute[1], /[?&]revision=r277-main-rival-gpu-warmup(?:&|$)/,
  'Rival onboarding must publish the main-renderer GPU warm-up identity');

const workflows = Object.fromEntries(workflowEntries);
for (const [workflowPath, source] of Object.entries(workflows)) {
  assert.ok(source, `${workflowPath} must exist`);
  assert.match(source, /group: \$\{\{ github\.workflow \}\}-\$\{\{ github\.event\.pull_request\.number \|\| github\.ref \}\}/,
    `${workflowPath} must group superseded runs by workflow and pull request`);
  assert.match(source, /cancel-in-progress: \$\{\{ github\.event_name == 'pull_request' \}\}/,
    `${workflowPath} must cancel superseded pull-request runs without cancelling main`);
}

for (const workflowPath of [
  '.github/workflows/turn-admin-unlock-test.yml',
  '.github/workflows/turn-challenge-tests.yml',
  '.github/workflows/turn-chromatic-camouflage.yml',
  '.github/workflows/turn-color-accessibility.yml'
]) {
  assert.doesNotMatch(workflows[workflowPath], /- 'turn\/index\.html'/,
    `${workflowPath} must not fan out solely from the production entrypoint`);
}

const pullRequest782Files = [
  'turn-lab/index.html',
  'turn-tests/home-track-records-production.mjs',
  'turn/home-track-row-gap-r200.css',
  'turn/index.html',
  'turn/m8-home-card-scroll-fixes.css',
  'turn/m8-home-fixed-layout.css'
];
for (const workflowPath of [
  '.github/workflows/turn-admin-unlock-test.yml',
  '.github/workflows/turn-challenge-tests.yml',
  '.github/workflows/turn-chromatic-camouflage.yml',
  '.github/workflows/turn-color-accessibility.yml',
  '.github/workflows/turn-lab-mountain-long-visual.yml',
  '.github/workflows/turn-mountain-visual-smoke.yml'
]) {
  for (const changedPath of pullRequest782Files) {
    assert.ok(!workflows[workflowPath].includes(`- '${changedPath}'`),
      `${workflowPath} must not be selected by the #782 entrypoint/layout change set`);
  }
}

const longMountainWorkflow = workflows['.github/workflows/turn-lab-mountain-long-visual.yml'];
for (const broadPath of ['turn-lab/index.html', 'turn-lab/lab-bootstrap.js', 'turn-lab/site.webmanifest']) {
  assert.ok(!longMountainWorkflow.includes(`- '${broadPath}'`),
    `The long MOUNTAIN visual job must not run solely for ${broadPath}`);
}

const releaseWorkflow = workflows['.github/workflows/turn-release-composition.yml'];
assert.match(releaseWorkflow, /- 'turn\/index\.html'|- 'turn\/\*\*\/\*\.html'/,
  'The cheap composition job must own production entrypoint changes');
assert.match(releaseWorkflow, /node turn-tests\/release-composition-production\.mjs --base/,
  'The cheap composition job must compare changed active identities with the base revision');

const supercarWorkflow = workflows['.github/workflows/turn-supercar-lot-visual-smoke.yml'];
for (const dependency of [
  'turn/assets/cars/supercar-data-*.js',
  'turn/assets/cars/supercar-model-data.js',
  'turn/vehicle/catalog.js',
  'turn/vehicle/learner-car-livery.js',
  'turn/vehicle/wide-gamut.js',
  'turn/ui/rival-onboarding.js',
  'turn/rival-onboarding.css',
  'turn/garage/lot-saved-paint.js',
  'turn/garage/lot-showroom-experiment.css',
  'turn/progression/trophy-road.js'
]) {
  assert.ok(supercarWorkflow.includes(`- '${dependency}'`),
    `Supercar visual smoke must run when ${dependency} changes`);
}

verifyIdentityGuard();

const baseReference = argumentValue('--base');
if (baseReference && !/^0+$/.test(baseReference)) {
  const baseGraph = await buildProductionGraph(gitReader(baseReference));
  const changedPaths = await changedPathsSince(baseReference);
  assertNoUnchangedActiveIdentities(changedPaths, baseGraph, headGraph);
}

console.log(
  `TURN ${headGraph.release.id} composition passed with ${headGraph.identities.size} active local assets${
    baseReference ? `; changed identities compared with ${baseReference}` : ''
  }.`
);
