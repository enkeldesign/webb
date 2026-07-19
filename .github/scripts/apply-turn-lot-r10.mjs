import fs from 'node:fs';

function replaceOnce(path, from, to) {
  const source = fs.readFileSync(path, 'utf8');
  const count = source.split(from).length - 1;
  if (count !== 1) {
    throw new Error(`${path}: expected exactly one occurrence of ${JSON.stringify(from)}, found ${count}`);
  }
  fs.writeFileSync(path, source.replace(from, to));
}

function replaceAllRequired(path, from, to, minimum = 1) {
  const source = fs.readFileSync(path, 'utf8');
  const count = source.split(from).length - 1;
  if (count < minimum) {
    throw new Error(`${path}: expected at least ${minimum} occurrences of ${JSON.stringify(from)}, found ${count}`);
  }
  fs.writeFileSync(path, source.split(from).join(to));
}

replaceOnce(
  'turn/main.js',
  "import { showTheLot } from './garage/lot.js';",
  "import { showTheLot } from './garage/lot-r10.js';"
);

replaceAllRequired('turn/index.html', 'v1.1.0', 'v1.1.1', 3);
replaceAllRequired('turn/index.html', '2026.07.19-r9', '2026.07.19-r10', 3);
replaceAllRequired('turn/index.html', '20260719-r9', '20260719-r10', 8);
replaceOnce(
  'turn/index.html',
  './garage/lot.css?build=20260719-r10',
  './garage/lot-r10.css?build=20260719-r10'
);
replaceAllRequired('turn/index.html', 'TURN r9 Pages deployment trigger', 'TURN r10 Lot polish');

replaceOnce(
  'turn-lab/tests/manual-steering-production.mjs',
  'manual-steering\\.css\\?build=20260719-r9',
  'manual-steering\\.css\\?build=20260719-r10'
);

replaceOnce(
  'turn-lab/tests/garage-production.mjs',
  'TURN v1\\.1\\.0 · Build 2026\\.07\\.19-r9',
  'TURN v1\\.1\\.1 · Build 2026\\.07\\.19-r10'
);
replaceOnce(
  'turn-lab/tests/garage-production.mjs',
  '\\.\\/garage\\/lot\\.css\\?build=20260719-r9',
  '\\.\\/garage\\/lot-r10\\.css\\?build=20260719-r10'
);

const garageTestPath = 'turn-lab/tests/garage-production.mjs';
let garageTest = fs.readFileSync(garageTestPath, 'utf8');
const anchor = "assert.match(carModels, /loadCarSource\\(car\\.id\\)/, 'Car model factory must load the catalog-selected vehicle');";
if (!garageTest.includes(anchor)) throw new Error('garage regression anchor missing');
garageTest = garageTest.replace(anchor, `${anchor}\n\nconst lotR10 = await fs.readFile(path.join(turnDir, 'garage/lot-r10.js'), 'utf8');\nconst lotR10Css = await fs.readFile(path.join(turnDir, 'garage/lot-r10.css'), 'utf8');\nassert.match(main, /garage\\/lot-r10\\.js/, 'Production must load the r10 Lot module');\nassert.match(lotR10, /MUTED_COLOR/, 'Unselected Lot cars must have a muted visual state');\nassert.match(lotR10, /selectedColor = DEFAULT_VEHICLE_COLOR/, 'Newly selected cars must return to the default yellow paint');\nassert.match(lotR10, /lot-viewbox/, 'The Lot must include a dedicated 3D car viewbox');\nassert.match(lotR10, /DRAG TO ROTATE/, 'The 3D car viewer must advertise drag rotation');\nassert.match(lotR10Css, /--lot-rail-width/, 'The stats and viewer rail must reserve space beside the parking lot');`);
fs.writeFileSync(garageTestPath, garageTest);

console.log('TURN Lot r10 references applied.');
