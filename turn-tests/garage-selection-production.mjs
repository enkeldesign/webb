import assert from 'node:assert/strict';
import { createGarageSelection } from '../turn/garage/garage-selection.js';
import {
  GARAGE_CAR_DESCRIPTIONS,
  GARAGE_CAR_ORDER,
  GARAGE_STARTER_CAR_ID,
  garageCarOrder
} from '../turn/garage/garage-cars.js';
import { CAR_CATALOG } from '../turn/vehicle/catalog.js';

// GARAGE keeps the saved car, the current playable choice and a locked preview apart.
const catalogIds = CAR_CATALOG.map((car) => car.id);
const order = garageCarOrder(catalogIds);
assert.deepEqual([...order].sort(), [...catalogIds].sort(), 'GARAGE shows every catalog car exactly once');
assert.deepEqual(order.slice(0, GARAGE_CAR_ORDER.length), GARAGE_CAR_ORDER.filter((id) => catalogIds.includes(id)));
assert.deepEqual(garageCarOrder([...catalogIds, 'new-car']).at(-1), 'new-car', 'A new catalog car is never hidden');
for (const id of catalogIds) {
  assert.ok(GARAGE_CAR_DESCRIPTIONS[id]?.length > 20, `${id} has a description`);
}
assert.equal(GARAGE_STARTER_CAR_ID, 'classic');

const locked = new Set(['monster-truck', 'supercar', 'race']);
const paintFor = (carId) => ({ color: `#${carId.length.toString(16).padStart(2, '0')}0000`, secondaryColor: '#ffffff' });
const make = (initial) => createGarageSelection({
  order,
  initial,
  fallbackCarId: GARAGE_STARTER_CAR_ID,
  isLocked: (carId) => locked.has(carId),
  paintFor
});

// Entering with AWD, choosing Van, previewing Monster Truck and leaving: Van.
const garage = make({ carId: 'convertible', color: '#123456', secondaryColor: '#654321' });
let state = garage.state();
assert.equal(state.viewedCarId, 'convertible');
assert.deepEqual({ ...state.choice }, { carId: 'convertible', color: '#123456', secondaryColor: '#654321' },
  'The saved car and its paint are the first choice');
state = garage.view('van');
assert.equal(state.choice.carId, 'van');
assert.equal(state.raceable, true);
state = garage.view('monster-truck');
assert.equal(state.viewedCarId, 'monster-truck', 'A locked car can be looked at');
assert.equal(state.preview, 'monster-truck');
assert.equal(state.choice.carId, 'van', 'A preview never becomes the choice');
assert.equal(state.raceable, false, 'A preview is never raceable');
assert.equal(garage.paint({ color: '#000000' }).choice.color, paintFor('van').color, 'A preview has no paint to change');
state = garage.leavePreview();
assert.equal(state.viewedCarId, 'van', 'Leaving the preview returns to the choice, not to the saved car');
assert.equal(state.raceable, true);

// Stepping walks the order and wraps; locked cars along the way are previews.
const walker = make({ carId: 'classic' });
assert.equal(walker.step(-1).viewedCarId, order.at(-1), 'Previous from the first car wraps to the last');
assert.equal(walker.state().preview, 'supercar');
assert.equal(walker.state().choice.carId, 'classic');
assert.equal(walker.step(1).viewedCarId, 'classic', 'Stepping back onto the choice ends the preview');
assert.equal(walker.state().preview, null);

// A locked or unknown saved car falls back to the starter.
assert.equal(make({ carId: 'supercar' }).state().choice.carId, 'classic');
assert.equal(make({ carId: 'missing' }).state().choice.carId, 'classic');
assert.equal(make(null).state().choice.carId, 'classic');

// Paint follows the choice; a new choice starts from that car's own paint.
const painter = make({ carId: 'van' });
assert.equal(painter.paint({ color: '#abcdef' }).choice.color, '#abcdef');
assert.equal(painter.view('truck').choice.color, paintFor('truck').color);

// Trophy Road moves on while GARAGE is open: the previewed car becomes the choice.
const unlocking = make({ carId: 'van' });
unlocking.view('monster-truck');
locked.delete('monster-truck');
state = unlocking.refreshLocks();
assert.deepEqual([state.choice.carId, state.preview, state.raceable], ['monster-truck', null, true]);

console.log('GARAGE keeps the saved car, the current choice and a locked preview apart.');
