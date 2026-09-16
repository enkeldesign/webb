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
  id: '2026.09.16-r247',
  cacheKey: '20260916-r247'
});
await write(releasePath, `${JSON.stringify({
  version: '1.21.0',
  id: '2026.09.16-r248',
  cacheKey: '20260916-r248'
}, null, 2)}\n`);

const semanticPath = 'turn-lab/tests/semantic-car-finish-production.mjs';
let semantic = await read(semanticPath);
semantic = replaceOnce(
  semantic,
  "assert.equal(tractorDefinition.defaultSecondaryColor, '#ffcc00');",
  "assert.equal(tractorDefinition.defaultSecondaryColor, '#666000');",
  'stale Tractor secondary-colour expectation'
);
semantic = replaceOnce(
  semantic,
  "  'Tractor must paint its authored body green and its bonnet and rims with the secondary yellow');",
  "  'Tractor must paint its authored body green and its bonnet and rims with the configured secondary factory colour');",
  'stale Tractor semantic-paint wording'
);
await write(semanticPath, semantic);

const tractorTestPath = 'turn-tests/tractor-smv-production.mjs';
await write(tractorTestPath, `import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  SMV_SHIFT_SPEED_LIMITS_KMH,
  SMV_SPEED_LIMITS_KMH,
  getSmvPropulsiveSpeedLimit
} from '../turn/vehicle/physics.js';
import { shiftedVehicleStats } from '../turn/vehicle/shift-profile.js';

const catalogSource = await fs.readFile(new URL('../turn/vehicle/catalog.js', import.meta.url), 'utf8');
const lotSource = await fs.readFile(new URL('../turn/garage/lot-showroom-experiment.js', import.meta.url), 'utf8');
const trophyOrderSource = await fs.readFile(new URL('../turn/garage/lot-trophy-order.js', import.meta.url), 'utf8');
const physicsSource = await fs.readFile(new URL('../turn/vehicle/physics.js', import.meta.url), 'utf8');

assert.match(catalogSource, /\\['tractor', 'Tractor', 'car', \\{ speed: 1, acceleration: 1, control: 5, drift: 1, boostPower: 5, boostDuration: 5 \\}/);
assert.match(catalogSource, /tractor: Object\\.freeze\\(\\{[\\s\\S]*title: 'SMV'[\\s\\S]*blank screen and non-visual driving practice/);
assert.match(catalogSource, /tractor: Object\\.freeze\\(\\{ fallback: '#4f7f36' \\}\\)/);
assert.match(catalogSource, /tractor: Object\\.freeze\\(\\{ fallback: '#666000' \\}\\)/);
assert.match(lotSource, /'classic',[\\s\\S]*'tractor',[\\s\\S]*'truck'/);
assert.match(trophyOrderSource, /'classic',[\\s\\S]*'tractor',[\\s\\S]*'truck'/,
  'The enhanced Trophy Road order must keep Learner Car first and Tractor second');

assert.deepEqual(SMV_SPEED_LIMITS_KMH, { drift: 40, gas: 60, boost: 80 });
assert.deepEqual(SMV_SHIFT_SPEED_LIMITS_KMH, { drift: 50, gas: 70, boost: 90 });

const smvLimit = (input = {}) => getSmvPropulsiveSpeedLimit({
  vehicleId: 'tractor',
  perkUnlocked: true,
  ...input
});
const approximately = (actual, expected, message) => {
  assert.ok(
    Math.abs(actual - expected) < 1e-12,
    message + ': expected ' + expected + ', got ' + actual
  );
};

approximately(smvLimit({ driftHeld: true }), 40 / 2.9, 'Base DRIFT ceiling');
approximately(smvLimit({ throttle: 1 }), 60 / 2.9, 'Base GAS ceiling');
approximately(smvLimit({ boostActive: true, throttle: 1 }), 80 / 2.9, 'Base BOOST ceiling');
approximately(smvLimit({ driftHeld: true, shiftActive: true }), 50 / 2.9, 'SHIFT DRIFT ceiling');
approximately(smvLimit({ throttle: 1, shiftActive: true }), 70 / 2.9, 'SHIFT GAS ceiling');
approximately(smvLimit({ boostActive: true, throttle: 1, shiftActive: true }), 90 / 2.9, 'SHIFT BOOST ceiling');
assert.equal(getSmvPropulsiveSpeedLimit({ vehicleId: 'tractor', perkUnlocked: false, throttle: 1 }), Infinity,
  'SMV ceilings must be perk-owned');
assert.equal(getSmvPropulsiveSpeedLimit({ vehicleId: 'classic', perkUnlocked: true, throttle: 1 }), Infinity,
  'SMV ceilings must not affect other vehicles');
assert.equal(smvLimit(), Infinity, 'Coasting must not impose an SMV speed clamp');

const tractorBaseStats = Object.freeze({
  speed: 1,
  acceleration: 1,
  control: 5,
  drift: 1,
  boostPower: 5,
  boostDuration: 5
});
assert.deepEqual(
  shiftedVehicleStats(tractorBaseStats, ['control', 'boostPower', 'boostDuration']),
  { speed: 2, acceleration: 2, control: 4, drift: 2, boostPower: 4, boostDuration: 4 },
  'Tractor generic SHIFT must produce the intended intermediate difficulty profile'
);

assert.match(physicsSource, /Math\\.max\\(0, smvPropulsiveLimit - Math\\.max\\(0, forwardSpeed\\)\\)/,
  'SMV must limit only newly added propulsion when already above the ceiling');
assert.match(physicsSource, /Math\\.min\\(propulsionStep, availablePropulsion\\)/,
  'SMV propulsion must stop at the available ceiling without clamping existing momentum');

console.log('TURN Tractor SMV catalog, ordering, direct speed-limit and SHIFT behavior checks passed.');
`);

const workflowPath = '.github/workflows/turn-lab-tests.yml';
let regressionWorkflow = await read(workflowPath);
regressionWorkflow = replaceOnce(
  regressionWorkflow,
  `      - name: Run DRIFT handling contract regression\n        run: node turn-lab/tests/vehicle-drift-production.mjs\n\n      - name: Run Trophy Road vehicle perk regression`,
  `      - name: Run DRIFT handling contract regression\n        run: node turn-lab/tests/vehicle-drift-production.mjs\n\n      - name: Run Tractor SMV regression\n        run: node turn-tests/tractor-smv-production.mjs\n\n      - name: Run Trophy Road vehicle perk regression`,
  'Tractor regression CI insertion point'
);
await write(workflowPath, regressionWorkflow);

const historyPath = 'turn/content/about-history-current.js';
let history = await read(historyPath);
history = replaceOnce(
  history,
  `const TRACTOR_SMV_HISTORY = Object.freeze({\n  period: '16 September',\n  title: 'TRACTOR slows things down for non-visual practice',\n  paragraphs: Object.freeze([\n    'TURN 1.21.0 adds TRACTOR as a start-available Kenney Car Kit vehicle with the SMV perk. Its 1 / 1 / 5 / 1 / 5 / 5 attributes keep the normal 18-point vehicle budget while its green body and yellow secondary paint give it a distinct factory identity.',\n    'SMV limits added propulsion to 50 km/h on DRIFT, 75 km/h on GAS and 100 km/h on BOOST without forcibly removing existing momentum. This makes it suitable for blank screen and non-visual driving practice. Once SHIFT is available, its only legal one-point setup becomes 2 / 2 / 4 / 2 / 4 / 4, providing a small built-in difficulty step.'\n  ]),\n  milestones: Object.freeze([\n    'Start-available TRACTOR with SMV perk',\n    '40 / 60 / 80 km/h DRIFT, GAS and BOOST practice ceilings',\n    'SHIFT progression to 2 / 2 / 4 / 2 / 4 / 4 and 50 / 70 / 90 km/h ceilings',\n    'TURN 1.21.0 · 2026.09.16-r243'\n  ])\n});`,
  `const TRACTOR_SMV_HISTORY = Object.freeze({\n  period: '16 September',\n  title: 'TRACTOR slows things down for non-visual practice',\n  paragraphs: Object.freeze([\n    'TURN 1.21.0 adds TRACTOR as a start-available Kenney Car Kit vehicle with the SMV perk. Its 1 / 1 / 5 / 1 / 5 / 5 attributes keep the normal 18-point vehicle budget while its green body and yellow secondary paint give it a distinct factory identity.',\n    'The first SMV build limits added propulsion to 50 km/h on DRIFT, 75 km/h on GAS and 100 km/h on BOOST without forcibly removing existing momentum. The standard SHIFT profile can change its attributes to 2 / 2 / 4 / 2 / 4 / 4, while these initial SMV ceilings themselves remain fixed.'\n  ]),\n  milestones: Object.freeze([\n    'Start-available TRACTOR with SMV perk',\n    'Initial 50 / 75 / 100 km/h DRIFT, GAS and BOOST propulsion ceilings',\n    'Standard SHIFT attribute profile: 2 / 2 / 4 / 2 / 4 / 4',\n    'TURN 1.21.0 · 2026.09.16-r243'\n  ])\n});\n\nconst TRACTOR_SMV_TUNING_HISTORY = Object.freeze({\n  period: '16 September',\n  title: 'TRACTOR practice speeds become progressive',\n  paragraphs: Object.freeze([\n    'TURN 1.21.0 build r245 retunes SMV to 40 / 60 / 80 km/h on DRIFT, GAS and BOOST, then raises those ceilings to 50 / 70 / 90 km/h while SHIFT is active. The live SHIFT state now changes both the ordinary attribute profile and the SMV propulsion ceiling, making SHIFT a real step up in blank screen practice speed.',\n    'The same build keeps LEARNER CAR as the canonical default and first Lot car with TRACTOR second. Build r246 fixes the enhanced Trophy Road ordering layer too, so the visible rail, previous/next controls and keyboard cycling all preserve LEARNER CAR → TRACTOR → TRUCK.'\n  ]),\n  milestones: Object.freeze([\n    '40 / 60 / 80 km/h base SMV ceilings and 50 / 70 / 90 km/h with SHIFT',\n    'LEARNER CAR remains the default and first Lot car; TRACTOR is second',\n    'Enhanced Lot cycling aligned in r246',\n    'TURN 1.21.0 · 2026.09.16-r245–r246'\n  ])\n});`,
  'Tractor r243 history block'
);

history = replaceOnce(
  history,
  `const FACTORY_SECONDARY_PAINT_HISTORY = Object.freeze({\n  period: '16 September',\n  title: 'Factory secondary paint gets tuned',`,
  `const TRACTOR_RELEASE_CLEANUP_HISTORY = Object.freeze({\n  period: '16 September',\n  title: 'TRACTOR release records and regressions align',\n  paragraphs: Object.freeze([\n    'TURN 1.21.0 build r248 reconciles the r243, r245 and r246 release record with the behavior that actually shipped, and updates the semantic native-finish regression to TRACTOR’s current #666000 factory secondary paint.',\n    'The dedicated TRACTOR regression now exercises the live SMV speed-limit resolver directly for normal and SHIFT inputs, while retaining the contract that SMV limits newly added propulsion instead of forcibly clamping existing momentum. Gameplay tuning is unchanged.'\n  ]),\n  milestones: Object.freeze([\n    'Release history matches the shipped SMV progression',\n    'Semantic paint regression follows #666000 factory secondary paint',\n    'Direct normal and SHIFT SMV resolver coverage',\n    'TURN 1.21.0 · 2026.09.16-r248'\n  ])\n});\n\nconst FACTORY_SECONDARY_PAINT_HISTORY = Object.freeze({\n  period: '16 September',\n  title: 'Factory secondary paint gets tuned',`,
  'r248 history insertion point'
);

history = replaceOnce(
  history,
  `  TRACTOR_SMV_HISTORY,\n  FACTORY_SECONDARY_PAINT_HISTORY`,
  `  TRACTOR_SMV_HISTORY,\n  TRACTOR_SMV_TUNING_HISTORY,\n  FACTORY_SECONDARY_PAINT_HISTORY,\n  TRACTOR_RELEASE_CLEANUP_HISTORY`,
  'Tractor development-history registration'
);

history = replaceOnce(
  history,
  `    Object.freeze(['TRACTOR SHIFT step', 'Uses the normal SHIFT system to move from 1 / 1 / 5 / 1 / 5 / 5 to 2 / 2 / 4 / 2 / 4 / 4.']),\n    Object.freeze(['1.21.0 r247', 'Retunes factory secondary paint: TRACTOR to #666000 and AWD to #aa9988 while keeping their body colours unchanged.']),`,
  `    Object.freeze(['TRACTOR SHIFT step', 'Uses the normal SHIFT system to move from 1 / 1 / 5 / 1 / 5 / 5 to 2 / 2 / 4 / 2 / 4 / 4.']),\n    Object.freeze(['1.21.0 r245', 'Retunes TRACTOR SMV to 40 / 60 / 80 km/h and 50 / 70 / 90 with SHIFT, while keeping LEARNER CAR as the default and first Lot car.']),\n    Object.freeze(['SMV SHIFT progression', 'Lets live SHIFT state raise the TRACTOR propulsion ceilings as well as applying its 2 / 2 / 4 / 2 / 4 / 4 attribute profile.']),\n    Object.freeze(['1.21.0 r246', 'Keeps TRACTOR immediately after LEARNER CAR in the enhanced Lot order, including previous/next and keyboard cycling.']),\n    Object.freeze(['1.21.0 r247', 'Retunes factory secondary paint: TRACTOR to #666000 and AWD to #aa9988 while keeping their body colours unchanged.']),`,
  'Tractor r245/r246 changelog insertion point'
);

history = replaceOnce(
  history,
  `    Object.freeze(['Factory paint migration', 'Moves existing factory-painted selections and saved rivals to the new secondary colours without changing custom PAINTJOB combinations.'])`,
  `    Object.freeze(['Factory paint migration', 'Moves existing factory-painted selections and saved rivals to the new secondary colours without changing custom PAINTJOB combinations.']),\n    Object.freeze(['1.21.0 r248', 'Aligns TRACTOR release history and regression coverage with the shipped SMV tuning and #666000 secondary paint; gameplay is unchanged.']),\n    Object.freeze(['TRACTOR regression coverage', 'Exercises the normal and SHIFT SMV speed resolver directly while retaining the no-forced-clamp propulsion contract.'])`,
  'Tractor r248 changelog insertion point'
);
await write(historyPath, history);

const result = await checkReleaseFiles({ write: true });
assert.equal(result.release.version, '1.21.0');
assert.equal(result.release.id, '2026.09.16-r248');

console.log('Prepared TURN 1.21.0 r248 Tractor review cleanup and synchronized release surfaces.');
