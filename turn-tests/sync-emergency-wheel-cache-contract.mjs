import fs from 'node:fs/promises';

const path = 'turn-lab/tests/emergency-vehicles-production.mjs';
let source = await fs.readFile(path, 'utf8');

const oldR19 = 'new RegExp(`"\\\\.\\\\/vehicle\\\\/car-models\\\\.js\\\\?build=20260720-r19": "\\\\.\\\\/vehicle\\\\/emergency-livery-models\\\\.js\\\\?build=${escapedBuild}"`)';
const newR19 = 'new RegExp(`"\\\\.\\\\/vehicle\\\\/car-models\\\\.js\\\\?build=20260720-r19": "\\\\.\\\\/vehicle\\\\/emergency-livery-models\\\\.js\\\\?build=${escapedBuild}&wheel=r211-steering-wheels"`)';
const oldR22 = 'new RegExp(`"\\\\.\\\\/vehicle\\\\/car-models\\\\.js\\\\?build=20260720-r22": "\\\\.\\\\/vehicle\\\\/emergency-livery-models\\\\.js\\\\?build=${escapedBuild}"`)';
const newR22 = 'new RegExp(`"\\\\.\\\\/vehicle\\\\/car-models\\\\.js\\\\?build=20260720-r22": "\\\\.\\\\/vehicle\\\\/emergency-livery-models\\\\.js\\\\?build=${escapedBuild}&wheel=r211-steering-wheels"`)';

for (const [from, to, label] of [[oldR19, newR19, 'r19 bridge'], [oldR22, newR22, 'r22 bridge']]) {
  if (!source.includes(from)) throw new Error(`Missing ${label} assertion`);
  source = source.replace(from, to);
}

await fs.writeFile(path, source);
console.log('Emergency vehicle regression now asserts the steering-wheel car-model bridge revision.');
