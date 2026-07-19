// Deterministic one-shot build helper for materializing the verified runtime pipeline.
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const labDir = path.join(root, 'turn-lab');
const VERIFIED_BUILD = '2026.07.19-r5';
const BUILD_CACHE_KEY = '20260719-r5';
const PATCH_FILES = [
  ['game-prepatch', 'game-prepatch.js'],
  ['gameplay-features', 'gameplay-features.js'],
  ['core-state', 'core-state-v1.js'],
  ['driving-core', 'driving-core-v1.js'],
  ['render-core', 'render-core-v1.js']
];

function installBuildEnvironment() {
  globalThis.window = globalThis;
  globalThis.location = new URL('https://enkel.design/turn-lab/index.html');
  globalThis.document = {
    readyState: 'loading',
    addEventListener() {},
    querySelector() { return null; }
  };
  globalThis.navigator = {};
  globalThis.__TURN_BUILD__ = Object.freeze({
    version: '1.0.0',
    id: VERIFIED_BUILD,
    cacheKey: BUILD_CACHE_KEY
  });
}

async function captureLegacyPatches() {
  let stagedResponse = null;
  const stagedFetch = async () => {
    if (!stagedResponse) throw new Error('TURN static build: patch requested source outside a pipeline stage.');
    return stagedResponse;
  };

  const patches = [];
  for (const [name, filename] of PATCH_FILES) {
    globalThis.fetch = stagedFetch;
    const code = await fs.readFile(path.join(labDir, filename), 'utf8');
    vm.runInThisContext(code, { filename });
    const wrapper = globalThis.fetch;
    if (wrapper === stagedFetch) throw new Error(`TURN static build: ${name} did not install a fetch transform.`);
    patches.push({ name, run: wrapper });
  }

  return {
    patches,
    setStagedResponse(response) { stagedResponse = response; },
    clearStagedResponse() { stagedResponse = null; }
  };
}

async function applyLegacyPipeline(gameSource, pipeline) {
  let current = new Response(gameSource, {
    status: 200,
    headers: { 'Content-Type': 'text/javascript; charset=utf-8' }
  });

  for (const patch of pipeline.patches) {
    pipeline.setStagedResponse(current);
    try {
      current = await patch.run.call(globalThis, '/turn/game.js');
      if (!(current instanceof Response)) {
        throw new Error(`${patch.name} did not return a Response.`);
      }
    } finally {
      pipeline.clearStagedResponse();
    }
  }

  return current.text();
}

async function applyMotionAdapterTransforms(patchedGameSource) {
  globalThis.fetch = async (input) => {
    const rawUrl = typeof input === 'string' ? input : input?.url;
    if (rawUrl === './game.js' || rawUrl === 'game.js') {
      return new Response(patchedGameSource, {
        status: 200,
        headers: { 'Content-Type': 'text/javascript; charset=utf-8' }
      });
    }
    throw new Error(`TURN static build: unexpected motion-adapter fetch: ${rawUrl}`);
  };

  const adapterPath = path.join(labDir, 'motion-adapter.js');
  const adapter = await fs.readFile(adapterPath, 'utf8');
  const marker = "const moduleUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));";
  const markerIndex = adapter.indexOf(marker);
  if (markerIndex < 0) throw new Error('TURN static build: motion-adapter capture marker not found.');

  const transformOnly = `${adapter.slice(0, markerIndex)}\n` +
    `globalThis.__TURN_STATIC_SOURCE__ = source;\n`;
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  await new AsyncFunction(transformOnly)();

  const source = globalThis.__TURN_STATIC_SOURCE__;
  delete globalThis.__TURN_STATIC_SOURCE__;
  if (typeof source !== 'string' || source.length < 1000) {
    throw new Error('TURN static build: motion-adapter did not produce a valid game source.');
  }
  return source;
}

function normalizeImports(source) {
  let normalized = source.replace(
    "import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.184.0/build/three.module.js';",
    "import * as THREE from 'three';"
  );

  normalized = normalized.replace(
    /from 'https:\/\/enkel\.design\/turn-lab\/([^']+)'/g,
    (_match, target) => {
      const cleanTarget = target.replace(/\?build=[^#]+$/, '');
      return `from './${cleanTarget}'`;
    }
  );

  return normalized;
}

function verifyStaticSource(source) {
  const required = [
    "import * as THREE from 'three';",
    "from './race/game-state.js'",
    "from './race/lap-system.js'",
    "from './race/replay-system.js'",
    "from './race/rival-storage.js'",
    "from './input/motion.js'",
    "from './vehicle/physics.js'",
    "from './render/camera.js'",
    "from './ui/hud.js'",
    "from './world-assets.js'",
    'const TRACK_WIDTH = 27;',
    'updateVehiclePhysicsState({',
    'updateLapProgressState({',
    'updateRaceCameraState({',
    'updateHudState({',
    'globalThis.__turnRuntime = turnRuntime;'
  ];

  const missing = required.filter((needle) => !source.includes(needle));
  if (missing.length) {
    throw new Error(`TURN static build: generated source is missing expected anchors:\n${missing.join('\n')}`);
  }

  const forbidden = [
    "from 'https://enkel.design/turn-lab/",
    'URL.createObjectURL(new Blob',
    '__turnCaptureLegacyPatch',
    '__turnLegacyPipeline'
  ];
  const present = forbidden.filter((needle) => source.includes(needle));
  if (present.length) {
    throw new Error(`TURN static build: generated source still contains runtime build machinery:\n${present.join('\n')}`);
  }
}

installBuildEnvironment();
const pipeline = await captureLegacyPatches();
const gameSource = await fs.readFile(path.join(labDir, 'game.js'), 'utf8');
const legacyPatched = await applyLegacyPipeline(gameSource, pipeline);
const fullyPatched = await applyMotionAdapterTransforms(legacyPatched);
const staticSource = normalizeImports(fullyPatched);
verifyStaticSource(staticSource);

const banner = `// TURN LAB static game core.\n// Generated deterministically from verified ${VERIFIED_BUILD}; do not hand-edit.\n\n`;
const outputPath = path.join(labDir, 'main.js');
await fs.writeFile(outputPath, banner + staticSource, 'utf8');

console.log(`TURN static build: wrote ${path.relative(root, outputPath)} (${staticSource.length} bytes).`);
console.log(`TURN static build: applied ${pipeline.patches.map((patch) => patch.name).join(' -> ')} -> motion-adapter transforms.`);
