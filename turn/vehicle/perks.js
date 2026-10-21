// TURN's vehicle perks (#1219). Each has an identity of its own, apart from the cars that
// carry it: a stable id, a rarity, and whether it may be installed on another car. A car
// runs its ORIGINAL perk once unlocked and at most one INSTALLED perk, never its own perk
// twice (perk-runtime.js). Rarity is presentation only: what a perk does lives in its
// mechanics, and whether it may move between cars in installable, never in its rarity.
// tuning holds the values a perk sets outright, the same on whichever car runs it.
export const PERK_RARITY = Object.freeze({
  COMMON: 'common',
  RARE: 'rare',
  EPIC: 'epic',
  // Vehicle-defining: stays with its car.
  LEGENDARY: 'legendary',
  MYTHIC: 'mythic'
});

function definePerk({
  id,
  title,
  vehicleIds = [],
  rarity,
  installable,
  description,
  rewardId,
  threshold,
  achievementId,
  tuning
}) {
  return Object.freeze({
    id,
    title,
    description,
    rarity,
    installable,
    vehicleIds: Object.freeze([...vehicleIds]),
    // The Trophy Road reward that unlocks it on its original car, when it has one.
    ...(rewardId ? { rewardId, threshold } : {}),
    ...(achievementId ? { achievementId } : {}),
    ...(tuning ? { tuning: Object.freeze({ ...tuning }) } : {})
  });
}

export const VEHICLE_PERKS = Object.freeze([
  definePerk({
    id: 'clean-exit',
    title: 'CLEAN EXIT',
    vehicleIds: ['compact'],
    rarity: PERK_RARITY.COMMON,
    installable: true,
    description: 'A clean DRIFT, one that ends without hitting a wall or spinning out, adds 1 CONTROL for a few seconds, up to 5/5.'
  }),
  definePerk({
    id: 'traction',
    title: 'TRACTION',
    vehicleIds: ['convertible'],
    rarity: PERK_RARITY.RARE,
    installable: true,
    description: 'Shallow off-road driving causes much less slowdown, while deep off-road remains punishing.',
    rewardId: 'awd-traction',
    threshold: 500
  }),
  definePerk({
    id: 'drift-demon',
    title: 'DRIFT DEMON',
    vehicleIds: ['sedan-sports'],
    rarity: PERK_RARITY.RARE,
    installable: true,
    description: 'DRIFT builds during sustained DRIFT or LOCK, up to 5/5.'
  }),
  definePerk({
    id: 'carry-on',
    title: 'CARRY ON',
    vehicleIds: ['van'],
    rarity: PERK_RARITY.RARE,
    installable: true,
    description: 'LOCK loses much less speed.',
    rewardId: 'van-carry-on',
    threshold: 1400,
    tuning: { lockDragAdd: 0.07 }
  }),
  definePerk({
    id: 'driftage',
    title: 'DRIFTAGE',
    vehicleIds: ['vintage-racer'],
    rarity: PERK_RARITY.EPIC,
    installable: true,
    description: 'DRIFT drains less speed, steering becomes more aggressive and the car can hold larger slip angles.',
    tuning: {
      driftDragAdd: 0.045,
      driftSpeedMultiplier: 0.95,
      driftYawMultiplier: 1.28,
      driftGripMultiplier: 0.72,
      driftSlideMultiplier: 1.18
    }
  }),
  definePerk({
    id: 'twitchy-turny',
    title: 'TWITCHY TURNY',
    vehicleIds: ['toy-racer'],
    rarity: PERK_RARITY.LEGENDARY,
    installable: false,
    description: 'DRIFT fills BOOST even faster than normal.',
    tuning: { driftBoostRechargeMultiplier: 3.6 }
  }),
  definePerk({
    id: 'apex-grip',
    title: 'APEX GRIP',
    vehicleIds: ['race'],
    rarity: PERK_RARITY.EPIC,
    installable: true,
    description: 'OVERCHARGE increases CONTROL and ACCELERATION beyond their ordinary limits.',
    tuning: {
      overchargeControlMultiplier: 1.21,
      overchargeAccelerationMultiplier: 1.24
    }
  }),
  definePerk({
    id: 'full-tank',
    title: 'FULL TANK',
    vehicleIds: ['suv'],
    rarity: PERK_RARITY.EPIC,
    installable: true,
    description: 'Clean driving builds BOOST TANK up to 5/5 and fills it as you go.',
    rewardId: 'suv-full-tank',
    threshold: 1700
  }),
  definePerk({
    id: 'torque',
    title: 'TORQUE',
    vehicleIds: ['truck'],
    rarity: PERK_RARITY.EPIC,
    installable: true,
    description: 'OVERCHARGE builds BOOST TANK to 5/5 and has a stronger KICK.',
    // TORQUE works through OVERCHARGE, so it unlocks with DRIFT ATTACK, which brings it.
    rewardId: 'drift-attack',
    threshold: 600,
    // The KICK: BOOST's thrust while spending OVERCHARGE (vehicle/physics.js), stronger
    // than every car's own (#1232).
    tuning: { overchargeBoostPowerMultiplier: 1.4 }
  }),
  definePerk({
    id: 'graduated',
    title: 'GRADUATED',
    vehicleIds: ['classic'],
    rarity: PERK_RARITY.LEGENDARY,
    installable: false,
    description: 'Clean driving improves CONTROL, then ACCELERATION, then TOP SPEED.',
    rewardId: 'learner-graduated',
    threshold: 2200
  }),
  definePerk({
    id: 'oversized',
    title: 'OVERSIZED',
    vehicleIds: ['monster-truck'],
    rarity: PERK_RARITY.LEGENDARY,
    installable: false,
    description: 'Going off-road doesn’t slow it down.'
  }),
  definePerk({
    id: 'double-shift',
    title: 'DOUBLE SHIFT',
    vehicleIds: ['sedan'],
    rarity: PERK_RARITY.LEGENDARY,
    installable: false,
    description: 'SHIFT moves 2 points between attributes instead of 1.',
    rewardId: 'sedan-double-shift',
    threshold: 1900
  }),
  definePerk({
    id: 'overdrive',
    title: 'OVERDRIVE',
    vehicleIds: ['race-future'],
    rarity: PERK_RARITY.LEGENDARY,
    installable: false,
    description: 'The longer you drive fast and clean, the higher the speed cap becomes. Leaving the track or colliding resets it.'
  }),
  definePerk({
    id: 'flow-shift',
    title: 'FLOW SHIFT',
    vehicleIds: ['supercar'],
    rarity: PERK_RARITY.LEGENDARY,
    installable: false,
    description: 'At FLOW ×3 or higher, SHIFT adds its three attribute points without reductions. SHIFT again moves the boost to the other three attributes.'
  }),
  definePerk({
    id: 'sirens',
    title: 'SIRENS',
    vehicleIds: ['firetruck', 'police', 'ambulance'],
    rarity: PERK_RARITY.LEGENDARY,
    installable: false,
    description: 'Boost activates flashing emergency lights and sirens.'
  }),
  definePerk({
    id: 'smv',
    title: 'SMV',
    vehicleIds: ['tractor'],
    rarity: PERK_RARITY.LEGENDARY,
    installable: false,
    description: 'A Slow-Moving Vehicle that’s not much to look at. Which makes it ideal for blank screen and non-visual driving practice.'
  })
]);

// Collection rewards have no original car. Availability is wired only once all
// collection mechanics and migration/reveal paths are ready (#1247).
export const ACHIEVEMENT_PERKS = Object.freeze([
  definePerk({
    id: 'hunter', title: 'HUNTER', rarity: PERK_RARITY.RARE, installable: true,
    achievementId: 'an-army-of-me',
    description: 'Your current race position adds that many tiers to ACCELERATION and TOP SPEED, up to 5/5.'
  }),
  definePerk({
    id: 'response-time', title: 'RESPONSE TIME', rarity: PERK_RARITY.EPIC, installable: true,
    achievementId: 'emergency-master',
    description: 'Brake decisively at speed, then return quickly to GAS or DRIFT for a brief acceleration kick after a short delay.'
  }),
  definePerk({
    id: 'turbo', title: 'TURBO', rarity: PERK_RARITY.MYTHIC, installable: true,
    achievementId: 'faster-than-the-dev',
    description: 'BOOST burns twice as fast and delivers 2.5 times the normal BOOST effect.',
    tuning: { boostConsumptionMultiplier: 2, boostEffectMultiplier: 2.5 }
  }),
  definePerk({
    id: 'road-rage', title: 'ROAD RAGE', rarity: PERK_RARITY.MYTHIC, installable: true,
    achievementId: 'on-course-of-course',
    description: 'With a full tank and some OVERCHARGE, clean driving gradually converts ordinary BOOST into OVERCHARGE. Using BOOST stops conversion.'
  }),
  definePerk({
    id: 'precision', title: 'PRECISION', rarity: PERK_RARITY.EPIC, installable: true,
    achievementId: 'drift-master',
    description: 'Only DRIFT that earns DRIFT ATTACK points recharges BOOST. Loose OVERCHARGE lasts three times as long.'
  }),
  definePerk({
    id: 'locked-in', title: 'LOCKED IN', rarity: PERK_RARITY.EPIC, installable: true,
    achievementId: 'flow-master',
    description: 'While FLOW is above ×2, gain one effective tier of CONTROL, ACCELERATION and DRIFT.'
  })
]);

export const PERKS = Object.freeze([...VEHICLE_PERKS, ...ACHIEVEMENT_PERKS]);
const PERK_BY_ID = new Map(PERKS.map((perk) => [perk.id, perk]));
const PERK_BY_VEHICLE_ID = new Map(VEHICLE_PERKS.flatMap((perk) => (
  perk.vehicleIds.map((vehicleId) => [vehicleId, perk])
)));

export function getVehiclePerk(id) {
  return PERK_BY_ID.get(id) || null;
}

// The perk a car comes with.
export function originalVehiclePerk(vehicleId) {
  return PERK_BY_VEHICLE_ID.get(String(vehicleId || '')) || null;
}
