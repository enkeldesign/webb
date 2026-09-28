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
const SESSION_ORCHESTRATOR_SPECIFIER = '/turn/race/session-orchestrator.js?source=20260729-r118-m8';
const RIVAL_STORAGE_PATH = '/turn/race/rival-storage.js';
const RIVAL_STORAGE_REVISION = 'r224-finish-line-summary';
// Stylesheets are authored at their rendered size since 1.25.0. A cached copy from
// an earlier release must never load under the same URL, so every stylesheet URL
// that is not already build-bound (CSS @import, literal link.href) takes the build.
const CSS_IMPORT_COMPANIONS = Object.freeze([
  'turn/design-semantic.css',
  'turn/install-gate.css',
  'turn/settings-components-r141.css',
  'turn/home-feedback-r135.css',
  'turn/progression/trophy-road-r157.css',
  'turn/progression/trophy-road.css'
]);
const STYLESHEET_LINK_COMPANIONS = Object.freeze([
  'turn/social/your-turn-share.js',
  'turn/audio/racing-music-v5.js',
  'turn/content/about-turn.js'
]);
const companionPaths = Object.freeze([
  'turn-next/index.html',
  'turn-next/app.js',
  'yourturn/index.html',
  'turn/ui/about-history-bootstrap-r165.js',
  'turn/content/about-history-current.js',
  'turn/input/keyboard-driving-controls.js',
  'turn/input/qe-drive-controls.js',
  'turn/design.html',
  'turn/design-dialogs.html',
  'turn/stats/index.html',
  'turn/stats/stats.js',
  'turn/tracks/registry.js',
  ...CSS_IMPORT_COMPANIONS,
  ...STYLESHEET_LINK_COMPANIONS
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

// Modules GARAGE retired (1.27.0): The Lot and its enhancement layers. Every import
// map route to or from them is removed, so no entry page can load a stale copy.
const RETIRED_MODULE_PATHS = new Set([
  '/turn/garage/lot-r10.js',
  '/turn/garage/lot-track-select.js',
  '/turn/garage/lot-enhancement-runtime.js',
  '/turn/garage/lot-showroom-experiment.js',
  '/turn/garage/lot-showroom-track-icon.js',
  '/turn/garage/lot-layout-r60.js',
  '/turn/garage/lot-card-scroll-boundary.js',
  '/turn/garage/lot-accessibility-r118.js',
  '/turn/garage/lot-screen-reader-r202.js',
  '/turn/garage/lot-selection-bay.js',
  '/turn/garage/lot-stat-legend.js',
  '/turn/garage/lot-perk-disclosure.js',
  '/turn/garage/lot-perk-icon.js',
  '/turn/garage/lot-pwa-color-swatch.js',
  '/turn/garage/lot-vehicle-copy.js',
  '/turn/garage/lot-trophy-order.js',
  '/turn/progression/lot-trophy-gate.js',
  '/turn/progression/lot-paint-reward.js',
  '/turn/vehicle/sports-sedan-easter-egg.js',
  // Renamed for GARAGE in 1.28.1 (shift-setup, shift-gearbox, saved-car-paint).
  '/turn/garage/lot-shift.js',
  '/turn/garage/lot-shift-gearbox.js',
  '/turn/garage/lot-saved-paint.js'
]);

function removeRetiredModuleRoutes(importMap) {
  const imports = importMap.imports || {};
  for (const [specifier, target] of Object.entries(imports)) {
    const keyPath = new URL(specifier, 'https://enkel.design/turn/').pathname;
    const targetPath = typeof target === 'string' ? new URL(target, 'https://enkel.design/turn/').pathname : '';
    if (RETIRED_MODULE_PATHS.has(keyPath) || RETIRED_MODULE_PATHS.has(targetPath)) delete imports[specifier];
  }
}

function synchronizeReleaseBoundImportTarget(importMap, release, specifier) {
  const sourceTarget = importMap.imports?.[specifier];
  if (typeof sourceTarget !== 'string') return;

  const targetUrl = new URL(sourceTarget, 'https://enkel.design/turn/');
  targetUrl.searchParams.set('build', release.cacheKey);
  importMap.imports[specifier] = `${targetUrl.pathname}${targetUrl.search}`;
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

// Canonical modules imported by bare path: drop every alias that routes to or from a
// retired layer, and keep exactly one release-bound entry per module (updated in place).
function consolidateModuleRoutes(imports, release, modules) {
  for (const [pathname, retired] of Object.entries(modules)) {
    const owned = new Set([pathname, ...retired]);
    for (const [specifier, existing] of Object.entries(imports)) {
      const keyPath = new URL(specifier, 'https://enkel.design/turn/').pathname;
      const targetPath = typeof existing === 'string' ? new URL(existing, 'https://enkel.design/turn/').pathname : '';
      if (specifier === pathname) continue;
      if (owned.has(keyPath) || owned.has(targetPath)) delete imports[specifier];
    }
    imports[pathname] = `${pathname}?build=${release.cacheKey}`;
  }
}

const TRACK_WORLD_MODULES = Object.freeze({
  '/turn/tracks/cliffside-world.js': ['/turn/tracks/cliffside-world-r76.js'],
  '/turn/tracks/cliffside-village.js': ['/turn/tracks/cliffside-inner-buildings-r202.js', '/turn/tracks/cliffside-house-inset-r203.js'],
  '/turn/tracks/mountain-world.js': ['/turn/tracks/mountain-world-long.js'],
  '/turn/tracks/mountain-world-base.js': ['/turn/tracks/mountain-world-r3.js', '/turn/tracks/mountain-player-headlight-r8.js'],
  '/turn/tracks/mountain-terrain.js': ['/turn/tracks/mountain-world-r3-terrain.js'],
  '/turn/tracks/mountain-scenery.js': ['/turn/tracks/mountain-world-r3-scenery.js'],
  '/turn/tracks/mountain-polish.js': ['/turn/tracks/mountain-world-r3-polish.js'],
  '/turn/tracks/mountain-visual-polish.js': ['/turn/tracks/mountain-world-r4-visual-polish.js'],
  '/turn/tracks/mountain-waterfall.js': ['/turn/tracks/mountain-world-r4-waterfall-notch.js', '/turn/tracks/mountain-world-r4-waterfall-face.js'],
  '/turn/tracks/mountain-village.js': ['/turn/tracks/mountain-world-r5-suburban-village.js'],
  '/turn/tracks/mountain-night.js': ['/turn/tracks/mountain-world-r6-night.js'],
  '/turn/tracks/mountain-long-extension.js': ['/turn/tracks/mountain-long-extension-r1.js']
});

function synchronizeTrackWorldTargets(importMap, release) {
  consolidateModuleRoutes(importMap.imports ||= {}, release, TRACK_WORLD_MODULES);
}

function synchronizeAchievementProgressionTargets(importMap, release) {
  const imports = importMap.imports ||= {};
  const storeTarget = `/turn/achievements/store.js?build=${release.cacheKey}`;
  for (const specifier of [
    '/turn/achievements/store.js',
    '/turn/achievements/store.js?revision=r240-trophy-road-2',
    '/turn/achievements/store.js?revision=r243-mountain-1300'
  ]) imports[specifier] = storeTarget;
  const challengeTarget = `/turn/achievements/challenge-expansion-r166.js?revision=r256-achievement-polling&build=${release.cacheKey}`;
  for (const specifier of [
    '/turn/achievements/challenge-expansion-r166.js?revision=r166-bella-records',
    '/turn/achievements/challenge-expansion-r166.js?revision=r241-learning-achievements',
    '/turn/achievements/challenge-expansion-r166.js?revision=r256-achievement-polling'
  ]) {
    imports[specifier] = challengeTarget;
  }
  // The achievements catalog and Trophy Road are each one canonical module. Every
  // importer uses the bare path, so each resolves to exactly one module instance;
  // app.js's withBuild() URL matches the target, so it shares that instance too.
  const progressionModules = Object.freeze({
    '/turn/achievements/catalog.js': [
      '/turn/achievements/catalog-production.js',
      '/turn/achievements/catalog-track-icons.js',
      '/turn/achievements/catalog-chromatic-r183.js'
    ],
    '/turn/progression/trophy-road.js': [
      '/turn/progression/trophy-road-track-icons.js',
      '/turn/progression/trophy-road-perks-r164.js',
      '/turn/progression/trophy-road-chromatic-r183.js'
    ]
  });
  consolidateModuleRoutes(imports, release, progressionModules);

  // Support-feedback modules are active production code. Keep historical import
  // specifiers as aliases, but route every active identity through the current
  // release build instead of minting another manual revision namespace.
  const releaseOwnedModules = {
    '/turn/achievements/support-challenges.js': [''],
    '/turn/achievements/support-challenge-feedback.js': ['', '?revision=r244-reward-toast-guide'],
    '/turn/achievements/view.js': ['', '?revision=r244-reward-toast-guide'],
    '/turn/achievements/home-reward-replay-r225.js': ['', '?revision=r244-reward-toast-guide'],
    // Consumers of the canonical catalog and Trophy Road modules (#989): their
    // historical revision URLs follow the release build so edits always reach players.
    '/turn/achievements/night-shift.js': ['?revision=r146-achievement-expansion']
  };
  for (const [pathname, suffixes] of Object.entries(releaseOwnedModules)) {
    const target = `${pathname}?build=${release.cacheKey}`;
    for (const suffix of suffixes) imports[`${pathname}${suffix}`] = target;
    for (const [specifier, existing] of Object.entries(imports)) {
      if (typeof existing !== 'string') continue;
      if (new URL(existing, 'https://enkel.design/turn/').pathname === pathname) {
        imports[specifier] = target;
      }
    }
  }
}

function synchronizeTrackCatalogScalabilityTargets(importMap, release) {
  const imports = importMap.imports ||= {};
  const aliases = Object.freeze({
    '/turn/tracks/definitions.js': ['', '?build=20260805-r160', '?build=20260806-r161', '?build=20260808-r162', '?lab-base=dead-canyon-suburbs'],
    '/turn/achievements/catalog-base.js': ['', '?revision=r222-awd-label', '?revision=r241-trophy-balance'],
    '/turn/achievements/scoring-achievements.js': ['', '?revision=r2-calibrated-targets', '?revision=r3-trophy-balance'],
    '/turn/audio/music/songbook.js': ['', '?revision=r197-audio-mix', '?revision=r214-mountain-ccttbb'],
    '/turn/accessibility/color-cues.js': ['', '?revision=r163'],
    '/turn/ui/track-icons.js': ['', '?revision=r1-track-reward-icons'],
    '/turn/tracks/pace-notes-base.js': [''],
    // #983: the eight-track catalog, its difficulty order and per-track SPRINT targets.
    '/turn/tracks/definitions-base.js': [''],
    '/turn/tracks/catalog.js': ['', '?source=20260729-r118-m8', '?build=20260806-r161', '?build=20260818-r175'],
    '/turn/achievements/time-trials.js': ['', '?revision=r166-bella-records', '?revision=r224-sprint-targets']
  });

  for (const [pathname, suffixes] of Object.entries(aliases)) {
    const target = `${pathname}?build=${release.cacheKey}`;
    for (const suffix of suffixes) imports[`${pathname}${suffix}`] = target;
    for (const [specifier, existing] of Object.entries(imports)) {
      if (typeof existing !== 'string') continue;
      if (new URL(existing, 'https://enkel.design/turn/').pathname === pathname) {
        imports[specifier] = target;
      }
    }
  }
}

function synchronizePlatformContextTarget(importMap, release) {
  const imports = importMap.imports ||= {};
  imports['/turn/platform/platform-context.js']
    = `/turn/platform/platform-context.js?build=${release.cacheKey}`;
}

function synchronizeKeyboardDrivingTargets(importMap, release) {
  const imports = importMap.imports ||= {};
  for (const pathname of [
    '/turn/input/keyboard-driving-controls.js',
    '/turn/input/keyboard-drive-ownership.js',
    '/turn/input/qe-drive-controls.js'
  ]) {
    imports[pathname] = `${pathname}?build=${release.cacheKey}`;
  }
}

// Modules whose injected styles moved to real CSS pixels in 1.25.0: every legacy
// specifier resolves to one release-bound URL.
function synchronizeUiBaselineTargets(importMap, release) {
  const imports = importMap.imports ||= {};
  for (const [pathname, suffixes] of [
    ['/turn/scoring/scorekeeper-records.js', []],
    ['/turn/tracks/airport-emergency-r496.js', ['?revision=r497-depth-fire']],
    ['/turn/ui/minor-ux-polish-r229.js', ['?revision=r229-discoverability-cues']],
    ['/turn/ui/leader-marker-r500.js', ['?revision=r227-night-marker-outline']],
    ['/turn/ui/player-marker-r428.js', ['?revision=r227-night-marker-outline']],
    ['/turn/roadbook/roadbook.js', []],
    ['/turn/garage/garage.js', []],
    ['/turn/garage/garage-cars.js', []],
    ['/turn/garage/garage-selection.js', []],
    ['/turn/garage/showroom-viewer.js', []],
    ['/turn/garage/garage-catalog.js', []],
    ['/turn/garage/car-view.js', []],
    ['/turn/garage/car-still.js', []],
    ['/turn/garage/shift-setup.js', []],
    ['/turn/garage/shift-gearbox.js', []],
    ['/turn/garage/saved-car-paint.js', []],
    ['/turn/garage/training-car-guide.js', ['?revision=r1']],
    // Modules that request a stylesheet by a release-bound literal URL.
    ['/turn/social/your-turn-share.js', ['?revision=r4-runtime-share-state']],
    ['/turn/content/about-turn.js', ['?revision=r1']],
    ['/turn/audio/racing-music-v5.js', ['?revision=r197-audio-mix']]
  ]) {
    const target = `${pathname}?build=${release.cacheKey}`;
    // Existing aliases that route to the module (the racing music entry) follow it.
    for (const [specifier, existing] of Object.entries(imports)) {
      if (typeof existing === 'string' && new URL(existing, 'https://enkel.design/turn/').pathname === pathname) {
        imports[specifier] = target;
      }
    }
    imports[pathname] = target;
    for (const suffix of suffixes) imports[`${pathname}${suffix}`] = target;
  }
}

function synchronizeResponsiveTargets(importMap, release) {
  const imports = importMap.imports ||= {};
  for (const pathname of ['/turn/ui/track-intro.js', '/turn/ui/race-orientation.js']) {
    const target = `${pathname}?build=${release.cacheKey}`;
    imports[pathname] = target;
    for (const [specifier, existing] of Object.entries(imports)) {
      if (typeof existing === 'string' && new URL(existing, 'https://enkel.design/turn/').pathname === pathname) {
        imports[specifier] = target;
      }
    }
  }
  for (const suffix of ['?source=20260729-r118-m8', '?build=20260725-r75']) {
    imports[`/turn/ui/track-intro.js${suffix}`] = `/turn/ui/track-intro.js?build=${release.cacheKey}`;
  }
}

function synchronizeSettingsUiTargets(importMap, release) {
  const imports = importMap.imports ||= {};
  const modules = {
    '/turn/ui/drift-camera-setting.js': ['', '?revision=r214-shared-speed-fov'],
    '/turn/ui/player-marker-r427.js': ['', '?revision=r427']
  };
  for (const [pathname, suffixes] of Object.entries(modules)) {
    const target = `${pathname}?build=${release.cacheKey}`;
    for (const suffix of suffixes) imports[`${pathname}${suffix}`] = target;
  }
}

function synchronizeNightSkyTargets(importMap, release) {
  const imports = importMap.imports ||= {};
  imports['/turn/tracks/shared-night-sky.js']
    = `/turn/tracks/shared-night-sky.js?build=${release.cacheKey}`;
}

function synchronizeDriveByEarTrainingTargets(importMap, release) {
  const imports = importMap.imports ||= {};
  const releaseBoundPaths = [
    '/turn/training/drive-by-ear-training.js',
    '/turn/training/stages.js',
    '/turn/training/view.js'
  ];
  for (const pathname of releaseBoundPaths) {
    const target = `${pathname}?build=${release.cacheKey}`;
    imports[pathname] = target;
    for (const [specifier, existing] of Object.entries(imports)) {
      if (typeof existing !== 'string') continue;
      if (new URL(existing, 'https://enkel.design/turn/').pathname === pathname) {
        imports[specifier] = target;
      }
    }
  }
}

function synchronizePerkFeedbackTargets(importMap, release) {
  const imports = importMap.imports ||= {};
  const flowShiftTarget = `/turn/vehicle/flow-shift.js?revision=r255-flow-shift-accessibility&build=${release.cacheKey}`;
  for (const specifier of [
    '/turn/vehicle/flow-shift.js?revision=r248-supercar',
    '/turn/vehicle/flow-shift.js?revision=r253-supercar-release',
    '/turn/vehicle/flow-shift.js?revision=r254-flow-shift-authority',
    '/turn/vehicle/flow-shift.js?revision=r255-flow-shift-accessibility'
  ]) imports[specifier] = flowShiftTarget;

  const perkPresentationTarget = `/turn/vehicle/perk-presentation.js?build=${release.cacheKey}`;
  for (const specifier of [
    '/turn/vehicle/perk-presentation.js',
    '/turn/vehicle/perk-presentation.js?revision=r220-apex-grip'
  ]) imports[specifier] = perkPresentationTarget;

  const catalogPath = '/turn/vehicle/catalog.js';
const catalogTarget = `${catalogPath}?build=${release.cacheKey}`;
const legacyCatalogSpecifiers = [
  '/turn/vehicle/catalog.js?revision=r253-supercar-release',
  '/turn/vehicle/catalog.js?source=20260729-r118-m8',
  '/turn/vehicle/catalog.js?build=20260806-r161',
  '/turn/vehicle/catalog.js?build=20260724-r59',
  '/turn/vehicle/catalog.js?revision=r230-vehicle-perks',
  '/turn/vehicle/catalog.js?build=20260720-r20&revision=r246-lot-saved-paint'
];
imports[catalogPath] = catalogTarget;
for (const [specifier, existing] of Object.entries(imports)) {
  if (typeof existing !== 'string') continue;
  if (new URL(existing, 'https://enkel.design/turn/').pathname === catalogPath) {
    imports[specifier] = catalogTarget;
  }
}
for (const specifier of legacyCatalogSpecifiers) imports[specifier] = catalogTarget;

}

function synchronizeGraphicsRuntimeTarget(importMap, release) {
  const imports = importMap.imports ||= {};
  const nativeTarget = imports['three-native']
    || (typeof imports.three === 'string' && /^https:\/\/cdn\.jsdelivr\.net\/npm\/three@/.test(imports.three)
      ? imports.three : null);
  if (!nativeTarget) return;
  imports['three-native'] = nativeTarget;
  imports.three = `/turn/three-runtime.js?build=${release.cacheKey}`;
  imports['/turn/graphics-profile.js'] = `/turn/graphics-profile.js?build=${release.cacheKey}`;
}

function synchronizeLowGraphicsProducerTargets(importMap, release) {
  const imports = importMap.imports ||= {};
  const legacySpecifiers = [
    '/turn/tracks/airport-emergency-r493.js?revision=r527-no-finish-sync-wreck',
    '/turn/tracks/airport-world-r50.js?build=20260722-r50',
    '/turn/tracks/airport-world-r53.js?build=20260814-r57',
    '/turn/tracks/countryside-world-r531.js?revision=r532-countryside-nature-polish',
    '/turn/tracks/start-area-polish-r519.js?revision=r519-midnight-full-width-accents',
    '/turn/tracks/airport-start-banner-r520.js?revision=r520-signature-yellow'
  ];
  const changedPaths = new Set(legacySpecifiers.map((specifier) =>
    new URL(specifier, 'https://enkel.design').pathname
  ));

  // Preserve existing legacy import specifiers for compatibility, but route every
  // active contour producer through the current release build. This avoids inventing
  // another hand-maintained revision namespace while guaranteeing fresh source code.
  for (const specifier of legacySpecifiers) {
    const pathname = new URL(specifier, 'https://enkel.design').pathname;
    imports[specifier] = `${pathname}?build=${release.cacheKey}`;
  }

  for (const [specifier, target] of Object.entries(imports)) {
    if (typeof target !== 'string') continue;
    const url = new URL(target, 'https://enkel.design/turn/');
    if (!changedPaths.has(url.pathname)) continue;
    imports[specifier] = `${url.pathname}?build=${release.cacheKey}`;
  }
}

// Shadow producers changed together when removing the legacy renderer path.
// Keep existing aliases, but advance their effective URLs in every shared shell.
function synchronizeProjectedShadowTargets(importMap, release) {
  const imports = importMap.imports ||= {};
  const paths = new Set([
    "/turn/graphics-profile.js",
    "/turn/main.js",
    "/turn/performance-monitor.js",
    "/turn/performance-profile.js",
    "/turn/render/car-shadows.js",
    "/turn/three-runtime.js",
    "/turn/tracks/airport-emergency-r493.js",
    "/turn/tracks/airport-emergency-r494.js",
    "/turn/tracks/airport-world-r50.js",
    "/turn/tracks/airport-world-r52.js",
    "/turn/tracks/airport-world-r53.js",
    "/turn/tracks/cliffside-world.js",
    "/turn/tracks/contextual-road-edges.js",
    "/turn/tracks/countryside-bella-r166.js",
    "/turn/tracks/countryside-world-r531.js",
    "/turn/tracks/harbor-world-r82.js",
    "/turn/tracks/harbor-world.js",
    "/turn/tracks/kenney-track-landmarks-r517.js",
    "/turn/tracks/midnight-city-world.js",
    "/turn/tracks/night-player-spotlight-r560.js",
    "/turn/tracks/start-area-polish-r519.js",
    "/turn/training/course.js",
    "/turn/ui/low-graphics-setting.js",
    "/turn/ui/spectate.js",
    "/turn/vehicle/car-models.js",
    "/turn/vehicle/learner-car-livery.js",
    "/turn/vehicle/tractor-smv-sign.js",
    "/turn/world-art-pass.js",
    "/turn/world-assets.js",
    "/turn/world-beauty.js"
  ]);
  for (const pathname of paths) {
    if (!imports[pathname]) imports[pathname] = `${pathname}?build=${release.cacheKey}`;
  }
  // These already-shipped specifiers were previously outside the import map.
  for (const specifier of [
    '/turn/performance-monitor.js?build=20260720-r20',
    '/turn/tracks/airport-emergency-r494.js?revision=r496-hud-depth',
    '/turn/tracks/airport-world-r52.js?build=20260722-r52',
    '/turn/tracks/contextual-road-edges.js?revision=r518-signature-yellow',
    '/turn/tracks/harbor-world.js?base=20260725-r80',
    '/turn/tracks/night-player-spotlight-r560.js?revision=r175-reconcile'
  ]) {
    const pathname = new URL(specifier, 'https://enkel.design').pathname;
    imports[specifier] = `${pathname}?build=${release.cacheKey}`;
  }
  for (const [specifier, target] of Object.entries(imports)) {
    if (typeof target !== 'string') continue;
    const url = new URL(target, 'https://enkel.design/turn/');
    if (!paths.has(url.pathname)) continue;
    url.searchParams.set('build', release.cacheKey);
    imports[specifier] = `${target.split('?')[0]}${url.search}`;
  }
}

function renderSharedResourceImports(source, release) {
  return source.replace(/<script type="importmap">\s*([\s\S]*?)\s*<\/script>/, (_, jsonText) => {
    const importMap = JSON.parse(jsonText);
    synchronizeScoreStoreTargets(importMap, release);
    synchronizeVisualResourceTargets(importMap, release);
    synchronizeAchievementProgressionTargets(importMap, release);
    synchronizeTrackCatalogScalabilityTargets(importMap, release);
    synchronizePlatformContextTarget(importMap, release);
    synchronizeKeyboardDrivingTargets(importMap, release);
    synchronizeSettingsUiTargets(importMap, release);
    synchronizeResponsiveTargets(importMap, release);
    synchronizeUiBaselineTargets(importMap, release);
    synchronizeDriveByEarTrainingTargets(importMap, release);
    synchronizePerkFeedbackTargets(importMap, release);
    synchronizeGraphicsRuntimeTarget(importMap, release);
    synchronizeLowGraphicsProducerTargets(importMap, release);
    synchronizeProjectedShadowTargets(importMap, release);
    synchronizeNightSkyTargets(importMap, release);
    synchronizeTrackWorldTargets(importMap, release);
    removeRetiredModuleRoutes(importMap);
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
  synchronizeRivalStorageTargets(importMap, release);
  synchronizeScoreStoreTargets(importMap, release);
  synchronizeVisualResourceTargets(importMap, release);
  synchronizeAchievementProgressionTargets(importMap, release);
  synchronizeTrackCatalogScalabilityTargets(importMap, release);
  synchronizePlatformContextTarget(importMap, release);
  synchronizeKeyboardDrivingTargets(importMap, release);
  synchronizeSettingsUiTargets(importMap, release);
  synchronizeResponsiveTargets(importMap, release);
  synchronizeUiBaselineTargets(importMap, release);
  synchronizeDriveByEarTrainingTargets(importMap, release);
  synchronizePerkFeedbackTargets(importMap, release);
  synchronizeGraphicsRuntimeTarget(importMap, release);
  synchronizeLowGraphicsProducerTargets(importMap, release);
  synchronizeProjectedShadowTargets(importMap, release);
  synchronizeNightSkyTargets(importMap, release);
  synchronizeReleaseBoundImportTarget(importMap, release, SESSION_ORCHESTRATOR_SPECIFIER);
  synchronizeTrackWorldTargets(importMap, release);
  // These presentation modules now use the release build instead of a new
  // hand-maintained revision. Advance every alias, including installed routes.
  for (const [specifier, target] of Object.entries(importMap.imports || {})) {
    if (typeof target !== 'string' || !target.startsWith('/turn/')) continue;
    const pathname = new URL(target, 'https://enkel.design').pathname;
    if (pathname === '/turn/m8-home.js') {
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
    .replace(/((?:href|src)="\.\/[^"?]+\?build=)\d{8}-r\d+/g, `$1${release.cacheKey}`)
    .replace(
      /(src="\.\/achievements\/chromatic-camouflage-r183\.js\?revision=r184-idle-summary-check)(?:&build=\d{8}-r\d+)?"/,
      `$1&build=${release.cacheKey}"`
    )
    .replace(
      /(src="\.\/render\/skid-continuity-r198\.js\?revision=r198-skid-continuity)(?:&build=\d{8}-r\d+)?"/,
      `$1&build=${release.cacheKey}"`
    )
    .replace(
      /(src="\.\/tracks\/kenney-track-landmarks-r517\.js\?revision=r532-countryside-nature-polish)(?:&build=\d{8}-r\d+)?"/,
      `$1&build=${release.cacheKey}"`
    );

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
      removeRetiredModuleRoutes(importMap);
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
    .replace(
      /(src="\.\/achievements\/chromatic-camouflage-r183\.js\?revision=r184-idle-summary-check)(?:&build=\d{8}-r\d+)?"/,
      `$1&build=${release.cacheKey}"`
    )
    .replace(
      /(src="\.\/render\/skid-continuity-r198\.js\?revision=r198-skid-continuity)(?:&build=\d{8}-r\d+)?"/,
      `$1&build=${release.cacheKey}"`
    )
    .replace(
      /(src="\.\/tracks\/kenney-track-landmarks-r517\.js\?revision=r532-countryside-nature-polish)(?:&build=\d{8}-r\d+)?"/,
      `$1&build=${release.cacheKey}"`
    )
    .replace(/<script type="importmap">[\s\S]*?<\/script>/, productionImportMap);
}

export function renderReleaseCompanion(repositoryPath, source, release) {
  validateReleaseDefinition(release);
  if (repositoryPath === 'turn-next/index.html') return renderSharedResourceImports(renderParityEntry(source, release), release);
  if (repositoryPath === 'turn-next/app.js') return buildTurnNextApp(release);
  if (repositoryPath === 'yourturn/index.html') {
    return renderSharedResourceImports(source.replace(/((?:href|src)="\/(?:turn|yourturn)\/[^"?]+\?build=)\d{8}-r\d+/g, `$1${release.cacheKey}`), release);
  }
  if (CSS_IMPORT_COMPANIONS.includes(repositoryPath)) {
    return source.replace(/(@import url\('[^'?]+\.css)(?:\?[^']*)?('\))/g, `$1?build=${release.cacheKey}$2`);
  }
  if (STYLESHEET_LINK_COMPANIONS.includes(repositoryPath)) {
    return source.replace(/(\.href = '[^'?]+\.css)(?:\?[^']*)?'/g, `$1?build=${release.cacheKey}'`);
  }
  if (repositoryPath === 'turn/ui/about-history-bootstrap-r165.js') {
    return source.replace(/(about-history-current\.js\?build=)\d{8}-r\d+/, `$1${release.cacheKey}`);
  }
  if (repositoryPath === 'turn/input/keyboard-driving-controls.js'
    || repositoryPath === 'turn/input/qe-drive-controls.js') {
    return source.replace(
      /(keyboard-drive-ownership\.js\?build=)\d{8}-r\d+/,
      `$1${release.cacheKey}`
    );
  }
  if (repositoryPath === 'turn/stats/index.html') {
    return source.replace(
      /(stats\.js\?build=)\d{8}-r\d+/,
      `$1${release.cacheKey}`
    );
  }
  if (repositoryPath === 'turn/stats/stats.js') {
    return source.replace(
      /(\.\.\/tracks\/definitions\.js\?build=)\d{8}-r\d+/,
      `$1${release.cacheKey}`
    );
  }
  if (repositoryPath === 'turn/content/about-history-current.js') {
    // Historical entries keep their original release identities.
    return source.replace(
      /(export const CURRENT_RELEASE = Object\.freeze\(\{\s*version: ')[^']+(',\s*build: ')[^']+(')/,
      `$1${release.version}$2${release.id}$3`
    );
  }
  if (repositoryPath === 'turn/tracks/registry.js') {
    return source
      .replace(
        /(await import\(\s*'\.\/midnight-city-world\.js\?build=)[^']+('\s*\))/,
        `$1${release.cacheKey}$2`
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
