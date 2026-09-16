import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const repoRoot = new URL('../../', import.meta.url);

async function read(path) {
  return fs.readFile(new URL(path, repoRoot), 'utf8');
}

async function write(path, content) {
  await fs.writeFile(new URL(path, repoRoot), content);
}

function replaceOnce(source, from, to, label) {
  const first = source.indexOf(from);
  assert.notEqual(first, -1, `Missing ${label}`);
  assert.equal(source.indexOf(from, first + from.length), -1, `Duplicate ${label}`);
  return source.slice(0, first) + to + source.slice(first + from.length);
}

const trainingPath = 'turn/training/drive-by-ear-training.js';
let training = await read(trainingPath);
training = replaceOnce(
  training,
  `} from './stages.js';`,
  `} from '/turn/training/stages.js';`,
  'DBE stages import identity'
);
training = replaceOnce(
  training,
  `} from './view.js';`,
  `} from '/turn/training/view.js';`,
  'DBE view import identity'
);
await write(trainingPath, training);

const releasePath = 'turn/scripts/release.mjs';
let release = await read(releasePath);
release = replaceOnce(
  release,
  `function synchronizeDriveByEarTrainingTargets(importMap, release) {\n  const pathname = '/turn/training/drive-by-ear-training.js';\n  const target = \`\${pathname}?build=\${release.cacheKey}\`;\n  for (const [specifier, existing] of Object.entries(importMap.imports || {})) {\n    if (typeof existing !== 'string') continue;\n    if (new URL(existing, 'https://enkel.design/turn/').pathname === pathname) {\n      importMap.imports[specifier] = target;\n    }\n  }\n}`,
  `function synchronizeDriveByEarTrainingTargets(importMap, release) {\n  const imports = importMap.imports ||= {};\n  const releaseBoundPaths = [\n    '/turn/training/drive-by-ear-training.js',\n    '/turn/training/stages.js',\n    '/turn/training/view.js'\n  ];\n  for (const pathname of releaseBoundPaths) {\n    const target = \`\${pathname}?build=\${release.cacheKey}\`;\n    imports[pathname] = target;\n    for (const [specifier, existing] of Object.entries(imports)) {\n      if (typeof existing !== 'string') continue;\n      if (new URL(existing, 'https://enkel.design/turn/').pathname === pathname) {\n        imports[specifier] = target;\n      }\n    }\n  }\n}`,
  'release-bound DBE module group'
);
await write(releasePath, release);

const testPath = 'turn-tests/drive-by-ear-training-production.mjs';
let test = await read(testPath);
test = replaceOnce(
  test,
  `assert.equal(\n  productionImports['/turn/training/drive-by-ear-training.js?build=20260817-r172-r151-dbe-training-device-fixes'],\n  \`/turn/training/drive-by-ear-training.js?build=\${release.cacheKey}\`,\n  'Legacy DBE 101 entrypoints must route to the current release build instead of a stale training module'\n);`,
  `assert.equal(\n  productionImports['/turn/training/drive-by-ear-training.js?build=20260817-r172-r151-dbe-training-device-fixes'],\n  \`/turn/training/drive-by-ear-training.js?build=\${release.cacheKey}\`,\n  'Legacy DBE 101 entrypoints must route to the current release build instead of a stale training module'\n);\nassert.equal(\n  productionImports['/turn/training/stages.js'],\n  \`/turn/training/stages.js?build=\${release.cacheKey}\`,\n  'Changed DBE stage definitions must have a release-bound module identity'\n);\nassert.equal(\n  productionImports['/turn/training/view.js'],\n  \`/turn/training/view.js?build=\${release.cacheKey}\`,\n  'Changed DBE view code must have a release-bound module identity'\n);`,
  'DBE child module identity assertions'
);
test = replaceOnce(
  test,
  `assert.match(training, /setAudioEnabled\\?\\.\\(true\\)/);`,
  `assert.match(training, /from '\\/turn\\/training\\/stages\\.js'/);\nassert.match(training, /from '\\/turn\\/training\\/view\\.js'/);\nassert.match(training, /setAudioEnabled\\?\\.\\(true\\)/);`,
  'DBE absolute child import assertions'
);
await write(testPath, test);

console.log('Prepared release-bound DBE child-module identities for r249.');
