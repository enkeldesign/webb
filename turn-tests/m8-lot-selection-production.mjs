import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [m8Home, lot, trainingGuide, selectionBay, wrapper] = await Promise.all([
  fs.readFile(new URL('../turn/m8-home.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/garage/lot-r10.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/garage/training-car-guide.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/garage/lot-selection-bay.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/garage/lot-track-select.js', import.meta.url), 'utf8')
]);

assert.match(
  m8Home,
  /import \{ showTheLot \} from '\/turn\/garage\/lot-r10\.js\?source=20260729-r118-m8';/,
  'The active M8 Home route must remain covered even when it imports lot-r10 directly'
);
assert.match(
  m8Home,
  /const lotPromise = showTheLot\(\{ initialSelection: selectedVehicle\(runtime\) \}\);/,
  'M8 must still enter the canonical Lot from continueToTrack()'
);

const canonicalBootstrap = lot.indexOf('installTrainingCarGuide();');
const firstPadConstruction = lot.indexOf('const platform = makeParkingPad(car.id === selectedCarId);');
assert.ok(canonicalBootstrap >= 0, 'lot-r10 must run its synchronous Lot-entry bootstrap');
assert.ok(firstPadConstruction >= 0, 'lot-r10 must construct the selectable parking pads');
assert.ok(
  canonicalBootstrap < firstPadConstruction,
  'The canonical Lot-entry bootstrap must run before any selected parking pad is built'
);

assert.match(
  trainingGuide,
  /import \{ installLotSelectionBayPolish \} from '\.\/lot-selection-bay\.js\?revision=r594-m8-entry';/,
  'The canonical Lot-entry bootstrap must include the selected-bay presentation'
);
assert.ok(
  trainingGuide.indexOf('installLotSelectionBayPolish();') < trainingGuide.indexOf('if (installed)'),
  'Bay polish must be installed on every Lot entry, not only the first Training Car guide install'
);

assert.match(selectionBay, /const PARKING_WHITE = 0xfff8e8;/);
assert.match(selectionBay, /const SELECTED_ASPHALT = 0x62676b;/);
assert.match(selectionBay, /leftLegacyEdge\.visible = false/,
  'The selector must reuse the persistent parking-space side stripes');
assert.match(selectionBay, /rightLegacyEdge\.visible = false/);
assert.match(selectionBay, /pointerOutline\.material\.visible = false/,
  'The old floating selection arrow outline must stay suppressed');
assert.match(selectionBay, /pointer\.material\.visible = false/,
  'The old floating selection arrow must stay suppressed');

assert.doesNotMatch(
  wrapper,
  /installLotSelectionBayPolish/,
  'Bay polish must no longer depend on the legacy Lot wrapper that M8 bypasses'
);

console.log('TURN M8 canonical Lot entry now receives the connected white selected-bay treatment.');
