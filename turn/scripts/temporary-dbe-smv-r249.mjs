import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { checkReleaseFiles } from './release.mjs';

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

const releasePath = 'turn/release.json';
const release = JSON.parse(await read(releasePath));
assert.deepEqual(release, {
  version: '1.21.0',
  id: '2026.09.16-r248',
  cacheKey: '20260916-r248'
});
await write(releasePath, `${JSON.stringify({
  version: '1.21.0',
  id: '2026.09.16-r249',
  cacheKey: '20260916-r249'
}, null, 2)}\n`);

const stagesPath = 'turn/training/stages.js';
let stages = await read(stagesPath);
stages = replaceOnce(
  stages,
  "export const TRAINING_CAR_ID = 'classic';",
  "export const TRAINING_VEHICLE_ID = 'tractor';",
  'DBE training vehicle identity'
);
await write(stagesPath, stages);

const trainingPath = 'turn/training/drive-by-ear-training.js';
let training = await read(trainingPath);
training = replaceOnce(
  training,
  `import {\n  DEFAULT_VEHICLE_COLOR,\n  DEFAULT_VEHICLE_SECONDARY_COLOR,\n  VEHICLE_SELECTION_KEY\n} from '/turn/vehicle/catalog.js?build=20260720-r19';`,
  `import {\n  VEHICLE_SELECTION_KEY,\n  getVehicleDefaultColor,\n  getVehicleDefaultSecondaryColor\n} from '/turn/vehicle/catalog.js?build=20260720-r19';`,
  'DBE vehicle factory-colour imports'
);
training = replaceOnce(
  training,
  '  TRAINING_CAR_ID,',
  '  TRAINING_VEHICLE_ID,',
  'DBE training vehicle import'
);
training = replaceOnce(
  training,
  '      await applyTrainingCar();',
  '      await applyTrainingVehicle();',
  'DBE training vehicle setup call'
);
training = replaceOnce(
  training,
  "Training temporarily uses the Training Car and puts Drive By Ear at 95% of the sound mix.",
  "Training temporarily uses the slow-moving vehicle and puts Drive By Ear at 95% of the sound mix.",
  'DBE runtime introduction wording'
);
training = replaceOnce(
  training,
  `  async function applyTrainingCar() {\n    await raceSession.selectVehicle({\n      carId: TRAINING_CAR_ID,\n      color: DEFAULT_VEHICLE_COLOR,\n      secondaryColor: DEFAULT_VEHICLE_SECONDARY_COLOR\n    });`,
  `  async function applyTrainingVehicle() {\n    await raceSession.selectVehicle({\n      carId: TRAINING_VEHICLE_ID,\n      color: getVehicleDefaultColor(TRAINING_VEHICLE_ID),\n      secondaryColor: getVehicleDefaultSecondaryColor(TRAINING_VEHICLE_ID)\n    });`,
  'DBE training vehicle selection'
);
await write(trainingPath, training);

const viewPath = 'turn/training/view.js';
let view = await read(viewPath);
view = replaceOnce(
  view,
  "Training temporarily uses the Training Car and puts Drive By Ear at 95% of the sound mix.",
  "Training temporarily uses the slow-moving vehicle and puts Drive By Ear at 95% of the sound mix.",
  'DBE static introduction wording'
);
await write(viewPath, view);

const releaseScriptPath = 'turn/scripts/release.mjs';
let releaseScript = await read(releaseScriptPath);
releaseScript = replaceOnce(
  releaseScript,
  `function synchronizePlatformContextTarget(importMap, release) {\n  const imports = importMap.imports ||= {};\n  imports['/turn/platform/platform-context.js']\n    = \`/turn/platform/platform-context.js?build=\${release.cacheKey}\`;\n}\n\nfunction synchronizePerkFeedbackTargets`,
  `function synchronizePlatformContextTarget(importMap, release) {\n  const imports = importMap.imports ||= {};\n  imports['/turn/platform/platform-context.js']\n    = \`/turn/platform/platform-context.js?build=\${release.cacheKey}\`;\n}\n\nfunction synchronizeDriveByEarTrainingTargets(importMap, release) {\n  const pathname = '/turn/training/drive-by-ear-training.js';\n  const target = \`\${pathname}?build=\${release.cacheKey}\`;\n  for (const [specifier, existing] of Object.entries(importMap.imports || {})) {\n    if (typeof existing !== 'string') continue;\n    if (new URL(existing, 'https://enkel.design/turn/').pathname === pathname) {\n      importMap.imports[specifier] = target;\n    }\n  }\n}\n\nfunction synchronizePerkFeedbackTargets`,
  'release-bound DBE training target helper'
);
releaseScript = replaceOnce(
  releaseScript,
  `    synchronizeAchievementProgressionTargets(importMap, release);\n    synchronizePlatformContextTarget(importMap, release);\n    synchronizePerkFeedbackTargets(importMap, release);`,
  `    synchronizeAchievementProgressionTargets(importMap, release);\n    synchronizePlatformContextTarget(importMap, release);\n    synchronizeDriveByEarTrainingTargets(importMap, release);\n    synchronizePerkFeedbackTargets(importMap, release);`,
  'release-bound DBE training target registration'
);
await write(releaseScriptPath, releaseScript);

const testPath = 'turn-tests/drive-by-ear-training-production.mjs';
let test = await read(testPath);
test = replaceOnce(
  test,
  `  RECOVERY_LIMIT,\n  ROAD_HALF_WIDTH,\n  TRAINING_STAGES`,
  `  RECOVERY_LIMIT,\n  ROAD_HALF_WIDTH,\n  TRAINING_STAGES,\n  TRAINING_VEHICLE_ID`,
  'DBE test training vehicle import'
);
test = replaceOnce(
  test,
  `assert.equal(\n  productionImports['/turn/race/session-orchestrator.js?source=20260729-r118-m8'],\n  \`/turn/race/session-orchestrator.js?build=\${release.cacheKey}\`,\n  'Production must map the start-announcement-aware race session through the current release identity'\n);`,
  `assert.equal(\n  productionImports['/turn/race/session-orchestrator.js?source=20260729-r118-m8'],\n  \`/turn/race/session-orchestrator.js?build=\${release.cacheKey}\`,\n  'Production must map the start-announcement-aware race session through the current release identity'\n);\nassert.equal(\n  productionImports['/turn/training/drive-by-ear-training.js?build=20260817-r172-r151-dbe-training-device-fixes'],\n  \`/turn/training/drive-by-ear-training.js?build=\${release.cacheKey}\`,\n  'Legacy DBE 101 entrypoints must route to the current release build instead of a stale training module'\n);`,
  'DBE release identity assertion'
);
test = replaceOnce(
  test,
  `assert.equal(TRAINING_STAGES.length, 5, 'Training must contain exactly five authored parts');`,
  `assert.equal(TRAINING_VEHICLE_ID, 'tractor', 'DBE 101 must use the slow-moving vehicle');\nassert.equal(TRAINING_STAGES.length, 5, 'Training must contain exactly five authored parts');`,
  'DBE training vehicle assertion'
);
test = replaceOnce(
  test,
  `assert.match(training, /setAudioEnabled\\?\\.\\(true\\)/);`,
  `assert.match(training, /setAudioEnabled\\?\\.\\(true\\)/);\nassert.match(training, /carId: TRAINING_VEHICLE_ID/);\nassert.match(training, /color: getVehicleDefaultColor\\(TRAINING_VEHICLE_ID\\)/);\nassert.match(training, /secondaryColor: getVehicleDefaultSecondaryColor\\(TRAINING_VEHICLE_ID\\)/);\nassert.match(training, /temporarily uses the slow-moving vehicle/);\nassert.match(view, /temporarily uses the slow-moving vehicle/);\nassert.doesNotMatch(training, /Training Car/, 'DBE 101 runtime copy must call it the slow-moving vehicle');\nassert.doesNotMatch(view, /Training Car/, 'DBE 101 dialog copy must call it the slow-moving vehicle');\nassert.doesNotMatch(training, /DEFAULT_VEHICLE_COLOR|DEFAULT_VEHICLE_SECONDARY_COLOR/,\n  'DBE 101 must use the slow-moving vehicle factory paint rather than Learner Car defaults');`,
  'DBE training vehicle behavior assertions'
);
await write(testPath, test);

const historyPath = 'turn/content/about-history-current.js';
let history = await read(historyPath);
history = replaceOnce(
  history,
  `const FACTORY_SECONDARY_PAINT_HISTORY = Object.freeze({`,
  `const DBE_SMV_TRAINING_HISTORY = Object.freeze({\n  period: '16 September',\n  title: 'DRIVE BY EAR 101 adopts the slow-moving vehicle',\n  paragraphs: Object.freeze([\n    'TURN 1.21.0 build r249 now temporarily uses the slow-moving vehicle throughout DRIVE BY EAR 101. Its SMV propulsion ceilings give new non-visual drivers more time to hear the ribbon, pace notes, surface feedback and recovery guidance before the speed builds.',\n    'The training still restores the player’s chosen car and audio settings on exit, and now uses the slow-moving vehicle’s own factory paint instead of inheriting Learner Car colours.'\n  ]),\n  milestones: Object.freeze([\n    'Slow-moving vehicle in all five DRIVE BY EAR 101 parts',\n    'Factory paint follows the temporary training vehicle',\n    'Legacy DBE module identity routes through the current build',\n    'TURN 1.21.0 · 2026.09.16-r249'\n  ])\n});\n\nconst FACTORY_SECONDARY_PAINT_HISTORY = Object.freeze({`,
  'DBE r249 history insertion point'
);
history = replaceOnce(
  history,
  `  FACTORY_SECONDARY_PAINT_HISTORY,\n  TRACTOR_RELEASE_CLEANUP_HISTORY`,
  `  FACTORY_SECONDARY_PAINT_HISTORY,\n  TRACTOR_RELEASE_CLEANUP_HISTORY,\n  DBE_SMV_TRAINING_HISTORY`,
  'DBE r249 development-history registration'
);
history = replaceOnce(
  history,
  `    Object.freeze(['TRACTOR regression coverage', 'Exercises the normal and SHIFT SMV speed resolver directly while retaining the no-forced-clamp propulsion contract.'])`,
  `    Object.freeze(['TRACTOR regression coverage', 'Exercises the normal and SHIFT SMV speed resolver directly while retaining the no-forced-clamp propulsion contract.']),\n    Object.freeze(['1.21.0 r249', 'Uses the slow-moving vehicle throughout DRIVE BY EAR 101 so blank-screen and non-visual practice starts at the deliberately governed SMV speeds.']),\n    Object.freeze(['DBE 101 vehicle', 'Uses the temporary vehicle’s factory paint, restores the player’s selection on exit, and routes legacy training imports to the current build.'])`,
  'DBE r249 changelog insertion point'
);
await write(historyPath, history);

const result = await checkReleaseFiles({ write: true });
assert.equal(result.release.version, '1.21.0');
assert.equal(result.release.id, '2026.09.16-r249');

console.log('Prepared TURN 1.21.0 r249 DBE 101 slow-moving vehicle release and synchronized release surfaces.');
