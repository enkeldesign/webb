import fs from 'node:fs/promises';

const path = 'turn-lab/tests/multi-track-production.mjs';
let source = await fs.readFile(path, 'utf8');
const from = "assert.match(trackDefinitions, /freeRoamDistance: 78/, 'Cliffside must own its world envelope');";
const to = "assert.match(trackDefinitions, /freeRoamDistance: 15\\.7/, 'Cliffside must own its curb-aligned containment envelope');";
const matches = source.split(from).length - 1;
if (matches !== 1) throw new Error(`Expected one old Cliffside envelope assertion, found ${matches}`);
source = source.replace(from, to);
await fs.writeFile(path, source);
