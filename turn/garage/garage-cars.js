// GARAGE's car data: the catalog in Trophy Road order and one short description per
// car (how it drives, who it suits, its main tradeoff). Stats, perks and paint stay in
// vehicle/catalog.js; this module only adds what GARAGE presents.

// Every car in the order its reward arrives on Trophy Road.
export const GARAGE_CAR_ORDER = Object.freeze([
  'classic',
  'tractor',
  'truck',
  'sedan',
  'van',
  'suv',
  'convertible',
  'sedan-sports',
  'compact',
  'vintage-racer',
  'race',
  'firetruck',
  'ambulance',
  'police',
  'race-future',
  'monster-truck',
  'toy-racer',
  'supercar'
]);

export const GARAGE_STARTER_CAR_ID = 'classic';

export const GARAGE_CAR_DESCRIPTIONS = Object.freeze({
  classic: 'Slow and easy to control. A calm, forgiving car for learning each line.',
  tractor: 'Very slow, but it steers exactly where you point it. Boost is its only real burst of speed.',
  truck: 'Heavy and slow to get going, but planted in corners and happy to slide.',
  sedan: 'The honest all-rounder: nothing stands out and nothing lets you down. A fair baseline for every track.',
  van: 'Slow and boxy, but it slides smoothly and holds a long drift. Don’t count on its boost.',
  suv: 'Quick off the line and sure-footed on grip. It prefers clean lines to sliding.',
  convertible: 'Confident cornering, on grip or in a slide. A steady place to find your line.',
  'sedan-sports': 'Quick and precise on grip. Stiff in a drift and light on boost.',
  compact: 'Nimble city hatch. Easy to place and happy to drift, but runs out of puff on the straights.',
  'vintage-racer': 'Fast and loose. It loves to drift, but it needs a gentle hand on the steering.',
  race: 'Very fast with sharp grip. A short boost and a reluctant drift reward clean, committed lines.',
  firetruck: 'Big, steady and slow. It handles well and its boost lasts, but it never really pushes.',
  ambulance: 'Smooth and predictable in a slide, with a long, gentle boost. Not built for quick starts.',
  police: 'A fast cruiser that grips rather than slides, with a long, gentle boost.',
  'race-future': 'Fast and demanding. Huge speed, but it barely drifts and its boost runs out quickly.',
  'monster-truck': 'Huge and loose. It drifts all day but turns lazily and is slow on the straights.',
  'toy-racer': 'Fast, twitchy and hard to hold. It slides eagerly and hits hard with a short boost.',
  supercar: 'Quick everywhere, but it needs precise steering and resists sliding. A car for experienced drivers.'
});

export function garageCarDescription(carId) {
  return GARAGE_CAR_DESCRIPTIONS[carId] || '';
}

// Cars GARAGE shows: the ordered ones first, then any catalog car the order does not
// name yet, so a new car is never hidden.
export function garageCarOrder(catalogIds) {
  const ids = new Set(catalogIds);
  return Object.freeze([
    ...GARAGE_CAR_ORDER.filter((id) => ids.has(id)),
    ...catalogIds.filter((id) => !GARAGE_CAR_ORDER.includes(id))
  ]);
}
