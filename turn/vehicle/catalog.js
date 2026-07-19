export const DEFAULT_VEHICLE_ID = 'sedan';
export const DEFAULT_VEHICLE_COLOR = '#ffd43b';
export const VEHICLE_SELECTION_KEY = 'turn-vehicle-selection-v1';

export const CAR_PALETTE = Object.freeze([
  Object.freeze({ name: 'Solar', value: '#ffd43b' }),
  Object.freeze({ name: 'Sky', value: '#38d9ff' }),
  Object.freeze({ name: 'Bubblegum', value: '#ff4fa3' }),
  Object.freeze({ name: 'Lime', value: '#8ce99a' }),
  Object.freeze({ name: 'Orange', value: '#ff922b' }),
  Object.freeze({ name: 'Violet', value: '#9775fa' }),
  Object.freeze({ name: 'Coral', value: '#ff6b6b' }),
  Object.freeze({ name: 'Ice', value: '#f8f9fa' })
]);

const RAW_CARS = [
  ['convertible', 'Convertible', 'prototype', { speed: 4, acceleration: 4, control: 4, drift: 3, boostPower: 4, boostDuration: 2 }, 0.98],
  ['classic', 'Classic', 'prototype', { speed: 3, acceleration: 3, control: 4, drift: 4, boostPower: 3, boostDuration: 3 }, 1.00],
  ['vintage-racer', 'Vintage Racer', 'toy', { speed: 5, acceleration: 4, control: 3, drift: 2, boostPower: 4, boostDuration: 2 }, 0.96],
  ['toy-racer', 'Toy Racer', 'toy', { speed: 5, acceleration: 5, control: 5, drift: 1, boostPower: 5, boostDuration: 1 }, 0.94],
  ['monster-truck', 'Monster Truck', 'toy', { speed: 2, acceleration: 3, control: 2, drift: 4, boostPower: 3, boostDuration: 4 }, 1.18],
  ['race-future', 'Future Racer', 'car', { speed: 5, acceleration: 5, control: 4, drift: 1, boostPower: 5, boostDuration: 1 }, 0.96],
  ['race', 'Race Car', 'car', { speed: 5, acceleration: 5, control: 5, drift: 1, boostPower: 5, boostDuration: 1 }, 0.94],
  ['sedan-sports', 'Sport Sedan', 'car', { speed: 4, acceleration: 4, control: 4, drift: 2, boostPower: 4, boostDuration: 2 }, 0.98],
  ['sedan', 'Sedan', 'car', { speed: 3, acceleration: 3, control: 4, drift: 3, boostPower: 3, boostDuration: 3 }, 1.00],
  ['suv', 'SUV', 'car', { speed: 3, acceleration: 3, control: 3, drift: 4, boostPower: 3, boostDuration: 4 }, 1.05],
  ['suv-luxury', 'Luxury SUV', 'car', { speed: 3, acceleration: 3, control: 4, drift: 4, boostPower: 3, boostDuration: 4 }, 1.06],
  ['hatchback-sports', 'Sport Hatch', 'car', { speed: 4, acceleration: 4, control: 5, drift: 3, boostPower: 3, boostDuration: 3 }, 0.96],
  ['truck-flat', 'Flatbed', 'car', { speed: 2, acceleration: 2, control: 3, drift: 5, boostPower: 2, boostDuration: 5 }, 1.12],
  ['truck', 'Truck', 'car', { speed: 2, acceleration: 2, control: 3, drift: 5, boostPower: 2, boostDuration: 5 }, 1.12],
  ['van', 'Van', 'car', { speed: 2, acceleration: 3, control: 3, drift: 5, boostPower: 2, boostDuration: 5 }, 1.08]
];

export const CAR_CATALOG = Object.freeze(RAW_CARS.map(([id, name, pack, stats, visualScale]) => Object.freeze({
  id,
  name,
  pack,
  asset: `./assets/cars/${id}.glb`,
  stats: Object.freeze({ ...stats }),
  visualScale,
  tuning: Object.freeze(deriveVehicleTuning(stats))
})));

const CAR_BY_ID = new Map(CAR_CATALOG.map((car) => [car.id, car]));
const PALETTE_VALUES = new Set(CAR_PALETTE.map((color) => color.value.toLowerCase()));

export function getCarDefinition(id) {
  return CAR_BY_ID.get(id) || CAR_BY_ID.get(DEFAULT_VEHICLE_ID);
}

export function normalizeVehicleId(id) {
  return CAR_BY_ID.has(id) ? id : DEFAULT_VEHICLE_ID;
}

export function normalizeVehicleColor(color) {
  const value = typeof color === 'string' ? color.toLowerCase() : '';
  return PALETTE_VALUES.has(value) ? value : DEFAULT_VEHICLE_COLOR;
}

export function normalizeVehicleSelection(selection) {
  return {
    carId: normalizeVehicleId(selection?.carId),
    color: normalizeVehicleColor(selection?.color)
  };
}

export function loadVehicleSelection() {
  try {
    return normalizeVehicleSelection(JSON.parse(localStorage.getItem(VEHICLE_SELECTION_KEY)));
  } catch (_) {
    return normalizeVehicleSelection(null);
  }
}

export function saveVehicleSelection(selection) {
  const normalized = normalizeVehicleSelection(selection);
  try {
    localStorage.setItem(VEHICLE_SELECTION_KEY, JSON.stringify(normalized));
  } catch (_) {}
  return normalized;
}

export function makeGhostColor(color) {
  const clean = normalizeVehicleColor(color).slice(1);
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const mix = (channel) => Math.round(channel + (255 - channel) * 0.48).toString(16).padStart(2, '0');
  return `#${mix(r)}${mix(g)}${mix(b)}`;
}

export function deriveVehicleTuning(stats) {
  return {
    topSpeedMultiplier: scaleStat(stats.speed, 0.84, 1.12),
    accelerationMultiplier: scaleStat(stats.acceleration, 0.82, 1.16),
    controlMultiplier: scaleStat(stats.control, 0.88, 1.14),
    driftEngineMultiplier: scaleStat(stats.drift, 0.84, 0.99),
    driftDragAdd: scaleStat(6 - stats.drift, 0.025, 0.14),
    boostPowerMultiplier: scaleStat(stats.boostPower, 0.78, 1.26),
    boostSpeedMultiplier: scaleStat(stats.boostPower, 1.23, 1.38),
    boostDurationSeconds: scaleStat(stats.boostDuration, 1.25, 3.35)
  };
}

function scaleStat(value, min, max) {
  const normalized = Math.max(0, Math.min(1, (Number(value) - 1) / 4));
  return min + (max - min) * normalized;
}
