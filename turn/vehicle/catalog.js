export const DEFAULT_VEHICLE_ID = 'classic';
export const LEGACY_VEHICLE_ID = 'sedan';
export const DEFAULT_VEHICLE_COLOR = '#ffcc00';
export const DEFAULT_VEHICLE_SECONDARY_COLOR = '#f8f9fa';
export const VEHICLE_SELECTION_KEY = 'turn-vehicle-selection-v1';
export const VEHICLE_STAT_BUDGET = 18;
export const SPORTS_SEDAN_EASTER_EGG_COLOR = '#666666';
export const MAXED_VEHICLE_STATS = Object.freeze({
  speed: 5,
  acceleration: 5,
  control: 5,
  drift: 5,
  boostPower: 5,
  boostDuration: 5
});

export const VEHICLE_STAT_LEGEND = Object.freeze([
  Object.freeze({ key: 'speed', label: 'TOP SPEED', description: 'How fast the car can go without boost.' }),
  Object.freeze({ key: 'acceleration', label: 'ACCELERATION', description: 'How quickly the car reaches speed.' }),
  Object.freeze({ key: 'control', label: 'CONTROL', description: 'How precisely and quickly the car steers while gripping the road.' }),
  Object.freeze({ key: 'drift', label: 'DRIFT', description: 'How well the car retains speed and settles while drifting. Drift is always slower than Gas.' }),
  Object.freeze({ key: 'boostPower', label: 'BOOST POWER', description: 'How strongly boost accelerates the car and raises its speed limit.' }),
  Object.freeze({ key: 'boostDuration', label: 'BOOST TANK', description: 'How long a full boost charge lasts.' })
]);

export const CAR_PALETTE = Object.freeze([
  Object.freeze({ name: 'Solar', value: '#ffcc00' }),
  Object.freeze({ name: 'Future Cyan', value: '#00aabb' }),
  Object.freeze({ name: 'Bubblegum', value: '#ff4fa3' }),
  Object.freeze({ name: 'Lime', value: '#8ce99a' }),
  Object.freeze({ name: 'Orange', value: '#ff922b' }),
  Object.freeze({ name: 'Violet', value: '#9775fa' }),
  Object.freeze({ name: 'Coral', value: '#ff6b6b' }),
  Object.freeze({ name: 'Ice', value: '#f8f9fa' })
]);

const DEFAULT_COLOR_BY_ID = Object.freeze({
  convertible: Object.freeze({ fallback: '#a8327a', p3: Object.freeze([0.66, 0.14, 0.43]) }),
  classic: Object.freeze({ fallback: '#ffcc00', p3: Object.freeze([1, 0.76, 0]) }),
  'vintage-racer': Object.freeze({ fallback: '#3f5368', p3: Object.freeze([0.22, 0.32, 0.43]) }),
  'toy-racer': Object.freeze({ fallback: '#cccccc' }),
  'monster-truck': Object.freeze({ fallback: '#3f5a3c', p3: Object.freeze([0.21, 0.35, 0.19]) }),
  'race-future': Object.freeze({ fallback: '#00aabb', p3: Object.freeze([0, 0.68, 0.74]) }),
  race: Object.freeze({ fallback: '#ff7700', p3: Object.freeze([1, 0.467, 0]) }),
  'sedan-sports': Object.freeze({ fallback: '#5e3c87', p3: Object.freeze([0.36, 0.19, 0.56]) }),
  sedan: Object.freeze({ fallback: '#2b6a70', p3: Object.freeze([0.12, 0.41, 0.43]) }),
  suv: Object.freeze({ fallback: '#0555aa', p3: Object.freeze([0.02, 0.333, 0.667]) }),
  firetruck: Object.freeze({ fallback: '#d92d20', p3: Object.freeze([0.82, 0.08, 0.04]) }),
  police: Object.freeze({ fallback: '#0b0d10', p3: Object.freeze([0.035, 0.045, 0.06]) }),
  ambulance: Object.freeze({ fallback: '#f8f9fa', p3: Object.freeze([0.95, 0.97, 0.98]) }),
  truck: Object.freeze({ fallback: '#b93632', p3: Object.freeze([0.72, 0.12, 0.12]) }),
  van: Object.freeze({ fallback: '#5d503f', p3: Object.freeze([0.34, 0.29, 0.21]) })
});

const DEFAULT_SECONDARY_COLOR_BY_ID = Object.freeze({
  classic: Object.freeze({ fallback: '#f8f9fa' }),
  truck: Object.freeze({ fallback: '#7b3032' }),
  sedan: Object.freeze({ fallback: '#163f45' }),
  van: Object.freeze({ fallback: '#292d33' }),
  suv: Object.freeze({ fallback: '#163f7a' }),
  convertible: Object.freeze({ fallback: '#792766' }),
  'vintage-racer': Object.freeze({ fallback: '#4dabf7', p3: Object.freeze([0.20, 0.58, 1]) }),
  'toy-racer': Object.freeze({ fallback: '#ffcc00' }),
  'monster-truck': Object.freeze({ fallback: '#d5e33b', p3: Object.freeze([0.78, 0.87, 0.08]) }),
  'race-future': Object.freeze({ fallback: '#9775fa', p3: Object.freeze([0.56, 0.38, 1]) }),
  race: Object.freeze({ fallback: '#442b25' }),
  'sedan-sports': Object.freeze({ fallback: '#252a35', p3: Object.freeze([0.13, 0.15, 0.21]) }),
  firetruck: Object.freeze({ fallback: '#ffcc00', p3: Object.freeze([1, 0.76, 0]) }),
  police: Object.freeze({ fallback: '#f8f9fa', p3: Object.freeze([0.95, 0.97, 0.98]) }),
  ambulance: Object.freeze({ fallback: '#d92d20', p3: Object.freeze([0.82, 0.08, 0.04]) })
});

const VISUAL_SIZE_MULTIPLIER_BY_ID = Object.freeze({
  convertible: 0.72,
  classic: 0.72,
  'vintage-racer': 0.75,
  police: 1.15
});
const FEATURED_VISUAL_SIZE_MULTIPLIER_BY_ID = Object.freeze({ 'monster-truck': 1.2 });
const EMERGENCY_SERVICE_BY_ID = Object.freeze({ firetruck: 'firetruck', police: 'police', ambulance: 'ambulance' });
const FIXED_LIVERY_IDS = new Set(Object.keys(EMERGENCY_SERVICE_BY_ID));
const RETIRED_VEHICLE_REPLACEMENTS = Object.freeze({
  'suv-luxury': 'firetruck',
  'hatchback-sports': 'police',
  'truck-flat': 'ambulance'
});

const SIRENS_PERK = Object.freeze({
  title: 'SIRENS',
  description: 'Boost activates flashing emergency lights and sirens.'
});

const VEHICLE_PERK_BY_ID = Object.freeze({
  'vintage-racer': Object.freeze({
    title: 'DRIFTAGE',
    description: 'DRIFT drains less speed, steering becomes more aggressive and the car can hold larger slip angles.'
  }),
  'toy-racer': Object.freeze({
    title: 'TWITCHY TURNY',
    description: 'DRIFT fills BOOST even faster than normal.'
  }),
  'monster-truck': Object.freeze({
    title: 'OVERSIZED',
    description: 'Going off-road doesn’t slow it down.'
  }),
  'race-future': Object.freeze({
    title: 'OVERDRIVE',
    description: '5 clean seconds builds +6% top speed. Off-road or collisions reset it.'
  }),
  firetruck: SIRENS_PERK,
  police: SIRENS_PERK,
  ambulance: SIRENS_PERK
});

const TUNING_OVERRIDE_BY_ID = Object.freeze({
  'vintage-racer': Object.freeze({
    driftDragAdd: 0.045,
    driftSpeedMultiplier: 0.95,
    driftYawMultiplier: 1.28,
    driftGripMultiplier: 0.72,
    driftSlideMultiplier: 1.18
  }),
  'toy-racer': Object.freeze({
    driftBoostRechargeMultiplier: 3.6
  })
});

const RAW_CARS = [
  ['convertible', 'Convertible', 'prototype', { speed: 4, acceleration: 4, control: 4, drift: 2, boostPower: 3, boostDuration: 1 }, 0.98, 1, 1.08],
  ['classic', 'Training Car', 'prototype', { speed: 1, acceleration: 1, control: 5, drift: 5, boostPower: 1, boostDuration: 5 }, 1.00, 1, 0.88],
  ['vintage-racer', 'Vintage Racer', 'toy', { speed: 4, acceleration: 3, control: 2, drift: 5, boostPower: 2, boostDuration: 2 }, 0.96, 0, 1.28],
  ['toy-racer', 'Rally Racer', 'car', { speed: 4, acceleration: 4, control: 1, drift: 4, boostPower: 4, boostDuration: 1 }, 0.98, 0, 1.18],
  ['monster-truck', 'Monster Truck', 'toy', { speed: 2, acceleration: 3, control: 2, drift: 5, boostPower: 2, boostDuration: 4 }, 0.83, 2, 0.62],
  ['race-future', 'Future Racer', 'car', { speed: 5, acceleration: 5, control: 3, drift: 1, boostPower: 3, boostDuration: 1 }, 0.96, 0, 1.42],
  ['race', 'Race Car', 'car', { speed: 5, acceleration: 4, control: 4, drift: 2, boostPower: 2, boostDuration: 1 }, 0.94, 0, 1.55],
  ['sedan-sports', 'Hatchback', 'car', { speed: 4, acceleration: 4, control: 4, drift: 2, boostPower: 2, boostDuration: 2 }, 0.98, 0, 1.12],
  ['sedan', 'Sedan', 'car', { speed: 3, acceleration: 3, control: 3, drift: 3, boostPower: 3, boostDuration: 3 }, 1.00, 0, 1.00],
  ['suv', 'SUV', 'car', { speed: 3, acceleration: 3, control: 3, drift: 4, boostPower: 2, boostDuration: 3 }, 1.05, 0, 0.90],
  ['firetruck', 'Fire Truck', 'car', { speed: 2, acceleration: 2, control: 4, drift: 4, boostPower: 1, boostDuration: 5 }, 1.10, 0, 0.66],
  ['police', 'Police Car', 'car', { speed: 4, acceleration: 3, control: 3, drift: 2, boostPower: 1, boostDuration: 5 }, 0.98, 0, 1.10],
  ['ambulance', 'Ambulance', 'car', { speed: 3, acceleration: 2, control: 3, drift: 4, boostPower: 1, boostDuration: 5 }, 1.05, 0, 0.78],
  ['truck', 'Truck', 'car', { speed: 3, acceleration: 2, control: 4, drift: 4, boostPower: 2, boostDuration: 3 }, 1.12, 0, 0.68],
  ['van', 'Van', 'car', { speed: 2, acceleration: 3, control: 3, drift: 5, boostPower: 1, boostDuration: 4 }, 1.08, 0, 0.80]
];

const VISUAL_CUSTOMIZATION_BY_ID = Object.freeze({
  classic: Object.freeze({
    secondaryPaint: Object.freeze({ label: 'Bumpers & trim', meshNames: Object.freeze([]) })
  }),
  truck: Object.freeze({
    secondaryPaint: Object.freeze({ label: 'Lower body trim', meshNames: Object.freeze([]) })
  }),
  sedan: Object.freeze({
    secondaryPaint: Object.freeze({ label: 'Lower body trim', meshNames: Object.freeze([]) })
  }),
  van: Object.freeze({
    secondaryPaint: Object.freeze({ label: 'Lower body trim', meshNames: Object.freeze([]) })
  }),
  suv: Object.freeze({
    secondaryPaint: Object.freeze({ label: 'Lower body trim', meshNames: Object.freeze([]) })
  }),
  convertible: Object.freeze({
    secondaryPaint: Object.freeze({ label: 'Interior & trim', meshNames: Object.freeze([]) })
  }),
  'vintage-racer': Object.freeze({
    secondaryPaint: Object.freeze({ label: 'Racing stripe', meshNames: Object.freeze([]) })
  }),
  'monster-truck': Object.freeze({
    secondaryPaint: Object.freeze({ label: 'Suspension trim', meshNames: Object.freeze([]) })
  }),
  'race-future': Object.freeze({
    secondaryPaint: Object.freeze({ label: 'Aero accents', meshNames: Object.freeze([]) })
  }),
  'sedan-sports': Object.freeze({
    secondaryPaint: Object.freeze({ label: 'Sport trim', meshNames: Object.freeze([]) })
  }),
  race: Object.freeze({
    secondaryPaint: Object.freeze({ label: 'Aero trim', meshNames: Object.freeze([]) })
  }),
  'toy-racer': Object.freeze({
    secondaryPaint: Object.freeze({ label: 'Rally trim', meshNames: Object.freeze(['spoiler']) })
  })
});

const MODEL_ASSET_BY_ID = Object.freeze({
  'sedan-sports': './assets/cars/hatchback-sports.glb',
  'toy-racer': './assets/cars/sedan-sports.glb'
});

const SURFACE_PROFILE_BY_ID = Object.freeze({
  'sedan-sports': 'hatchback-sports',
  'toy-racer': 'sedan-sports-rally'
});

export const CAR_CATALOG = Object.freeze(RAW_CARS.map(([
  id, name, pack, stats, visualScale, modelYawQuarterTurns, enginePitch
]) => Object.freeze({
  id,
  name,
  pack,
  asset: MODEL_ASSET_BY_ID[id] || `./assets/cars/${id}.glb`,
  surfaceProfileId: SURFACE_PROFILE_BY_ID[id] || id,
  stats: Object.freeze({ ...stats }),
  visualScale,
  visualSizeMultiplier: VISUAL_SIZE_MULTIPLIER_BY_ID[id] || 1,
  featuredVisualSizeMultiplier: FEATURED_VISUAL_SIZE_MULTIPLIER_BY_ID[id] || 1,
  modelYawQuarterTurns,
  defaultColor: DEFAULT_COLOR_BY_ID[id]?.fallback || DEFAULT_VEHICLE_COLOR,
  defaultColorP3: DEFAULT_COLOR_BY_ID[id]?.p3 || null,
  defaultSecondaryColor: DEFAULT_SECONDARY_COLOR_BY_ID[id]?.fallback || DEFAULT_VEHICLE_SECONDARY_COLOR,
  defaultSecondaryColorP3: DEFAULT_SECONDARY_COLOR_BY_ID[id]?.p3 || null,
  secondaryPaint: VISUAL_CUSTOMIZATION_BY_ID[id]?.secondaryPaint || null,
  visualUpgrade: VISUAL_CUSTOMIZATION_BY_ID[id]?.visualUpgrade || null,
  emergencyService: EMERGENCY_SERVICE_BY_ID[id] || null,
  fixedLivery: FIXED_LIVERY_IDS.has(id),
  perk: VEHICLE_PERK_BY_ID[id] || null,
  tuning: Object.freeze({
    ...deriveVehicleTuning(stats),
    ...(TUNING_OVERRIDE_BY_ID[id] || {}),
    enginePitch
  })
})));

const CAR_BY_ID = new Map(CAR_CATALOG.map((car) => [car.id, car]));
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/;
const SPORTS_SEDAN = CAR_BY_ID.get('sedan-sports');
const MAXED_SPORTS_SEDAN_TUNING = Object.freeze({ ...deriveVehicleTuning(MAXED_VEHICLE_STATS), enginePitch: SPORTS_SEDAN.tuning.enginePitch });
const MAXED_SPORTS_SEDAN = Object.freeze({ ...SPORTS_SEDAN, stats: MAXED_VEHICLE_STATS, tuning: MAXED_SPORTS_SEDAN_TUNING });
let activeVehicleSelection = null;

function getBaseCarDefinition(id) {
  return CAR_BY_ID.get(id) || CAR_BY_ID.get(DEFAULT_VEHICLE_ID);
}

export function getCarDefinition(id) {
  const definition = getBaseCarDefinition(id);
  return definition.id === 'sedan-sports' && isSportsSedanEasterEgg(activeVehicleSelection)
    ? MAXED_SPORTS_SEDAN
    : definition;
}

export function normalizeVehicleId(id) {
  const replacement = RETIRED_VEHICLE_REPLACEMENTS[id] || id;
  return CAR_BY_ID.has(replacement) ? replacement : DEFAULT_VEHICLE_ID;
}

export function getVehicleDefaultColorSpec(id) {
  const car = getBaseCarDefinition(id);
  return Object.freeze({ fallback: car.defaultColor, p3: car.defaultColorP3 });
}

export function getVehicleDefaultSecondaryColorSpec(id) {
  const car = getBaseCarDefinition(id);
  return Object.freeze({ fallback: car.defaultSecondaryColor, p3: car.defaultSecondaryColorP3 });
}

export function getVehicleDefaultColor(id) {
  return getBaseCarDefinition(id).defaultColor;
}

export function getVehicleDefaultSecondaryColor(id) {
  return getBaseCarDefinition(id).defaultSecondaryColor;
}

export function normalizeVehicleColor(color, fallback = DEFAULT_VEHICLE_COLOR) {
  const value = typeof color === 'string' ? color.toLowerCase() : '';
  return HEX_COLOR_PATTERN.test(value) ? value : fallback;
}

export function normalizeVehicleSecondaryColor(color, fallback = DEFAULT_VEHICLE_SECONDARY_COLOR) {
  const value = typeof color === 'string' ? color.toLowerCase() : '';
  if (value === '#666') return SPORTS_SEDAN_EASTER_EGG_COLOR;
  return HEX_COLOR_PATTERN.test(value) ? value : fallback;
}

export function normalizeVehicleSelection(selection) {
  const carId = normalizeVehicleId(selection?.carId);
  return {
    carId,
    color: normalizeVehicleColor(selection?.color, getVehicleDefaultColor(carId)),
    secondaryColor: normalizeVehicleSecondaryColor(selection?.secondaryColor, getVehicleDefaultSecondaryColor(carId))
  };
}

export function isSportsSedanEasterEgg(selection) {
  return normalizeVehicleId(selection?.carId) === 'sedan-sports'
    && normalizeVehicleSecondaryColor(selection?.secondaryColor) === SPORTS_SEDAN_EASTER_EGG_COLOR;
}

export function getEffectiveVehicleStats(selection) {
  return isSportsSedanEasterEgg(selection) ? MAXED_VEHICLE_STATS : getBaseCarDefinition(selection?.carId).stats;
}

export function getEffectiveVehicleTuning(selection) {
  return isSportsSedanEasterEgg(selection) ? MAXED_SPORTS_SEDAN_TUNING : getBaseCarDefinition(selection?.carId).tuning;
}

export function loadVehicleSelection() {
  try {
    activeVehicleSelection = normalizeVehicleSelection(JSON.parse(localStorage.getItem(VEHICLE_SELECTION_KEY)));
  } catch (_) {
    activeVehicleSelection = normalizeVehicleSelection(null);
  }
  return activeVehicleSelection;
}

export function saveVehicleSelection(selection) {
  const normalized = normalizeVehicleSelection(selection);
  activeVehicleSelection = normalized;
  try { localStorage.setItem(VEHICLE_SELECTION_KEY, JSON.stringify(normalized)); } catch (_) {}
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

export function getVehicleStatTotal(stats) {
  return [stats?.speed, stats?.acceleration, stats?.control, stats?.drift, stats?.boostPower, stats?.boostDuration]
    .reduce((total, value) => total + (Number(value) || 0), 0);
}

export function deriveVehicleTuning(stats) {
  return {
    topSpeedMultiplier: centeredStat(stats.speed, [0.84, 0.92, 1, 1.06, 1.12]),
    accelerationMultiplier: centeredStat(stats.acceleration, [0.82, 0.91, 1, 1.08, 1.16]),
    controlMultiplier: centeredStat(stats.control, [0.88, 0.94, 1, 1.07, 1.14]),
    driftEngineMultiplier: centeredStat(stats.drift, [0.78, 0.82, 0.86, 0.90, 0.94]),
    driftDragAdd: centeredStat(stats.drift, [0.16, 0.13, 0.10, 0.075, 0.055]),
    driftSpeedMultiplier: centeredStat(stats.drift, [0.76, 0.80, 0.84, 0.88, 0.92]),
    driftStabilityMultiplier: centeredStat(stats.drift, [0.82, 0.91, 1, 1.09, 1.18]),
    boostPowerMultiplier: centeredStat(stats.boostPower, [0.78, 0.89, 1, 1.13, 1.26]),
    boostSpeedMultiplier: centeredStat(stats.boostPower, [1.23, 1.275, 1.32, 1.35, 1.38]),
    boostDurationSeconds: centeredStat(stats.boostDuration, [1.2, 1.6, 2, 2.65, 3.4])
  };
}

function centeredStat(value, values) {
  const index = Math.max(0, Math.min(4, Math.round(Number(value) || 3) - 1));
  return values[index];
}
