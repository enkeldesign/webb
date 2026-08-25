import fs from 'node:fs/promises';

const path = 'turn-tests/challenge-mode-production.mjs';
const source = await fs.readFile(path, 'utf8');

const accidental = `  carId: 'sedan',\n  carColor: '#ffcc00',\n  carSecondaryColor: '#f8f9fa',\n  time: 65,\n  frames: builtInStyleFrames\n});\nassert.equal(builtInStyleChallenge.frames.length, 450,\n  'Built-in generated challenges must obey the same replay cap as direct lap sharing');\nassert.equal(builtInStyleChallenge.frames.at(-1).t, 65,\n  'Built-in replay normalization must retain the final frame');\n\nconsole.log('TURN NEXT Race My Ghost prototype preserves production TURN and passes challenge codec/session contracts.');`;

const original = `  time: 65,\n  carId: 'sedan-sports',\n  carColor: '#ff4fa3',\n  carSecondaryColor: '#252a35',\n  frames: builtInStyleFrames\n});\nassert.ok(builtInStyleChallenge.frames.length <= 450);\nassert.ok(builtInStyleChallenge.frames.at(-1).t > 64.99,\n  'The stable built-in device challenge must retain its finish frame');\nassert.equal(builtInStyleChallenge.frames.at(-1).x, 719);\n\nconsole.log('TURN NEXT Race My Ghost challenge, repeat attempts, top-four isolation, compact links and replies passed.');`;

if (!source.includes(accidental)) throw new Error('Accidental challenge block not found exactly');
if (!source.includes('source=20260729-r118-m8&wheel=r211-steering-wheels')) throw new Error('Steering-wheel catalog contract is missing');
const output = source.replace(accidental, original);
await fs.writeFile(path, output);
console.log('Restored the original challenge replay contract while preserving the steering-wheel URL assertion.');
