const freezeChoices = (choices) => Object.freeze(choices.map((choice) => Object.freeze(choice)));

export const BUILD_A_CAR_EXPERIMENT_ID = 'prototype-1';

export const PART_CATEGORIES = Object.freeze([
  Object.freeze({ id: 'body', label: 'BODY' }),
  Object.freeze({ id: 'cabin', label: 'CABIN' }),
  Object.freeze({ id: 'wheels', label: 'WHEELS' }),
  Object.freeze({ id: 'spoiler', label: 'SPOILER' }),
  Object.freeze({ id: 'roofAccessory', label: 'ROOF' }),
  Object.freeze({ id: 'lights', label: 'LIGHTS' })
]);

export const PARTS_BY_CATEGORY = Object.freeze({
  body: freezeChoices([
    {
      id: 'body-hatch',
      label: 'HATCH',
      description: 'Short, upright lower body',
      family: 'kenney-compact',
      source: '/turn/assets/cars/hatchback-sports.glb',
      node: 'body',
      extraction: 'lower',
      splitY: 0.62,
      paintProfile: 'hatchback-sports'
    },
    {
      id: 'body-sedan',
      label: 'SEDAN',
      description: 'Long, low lower body',
      family: 'kenney-compact',
      source: '/turn/assets/cars/sedan-sports.glb',
      node: 'body',
      extraction: 'lower',
      splitY: 0.62,
      paintProfile: 'sedan-sports'
    }
  ]),
  cabin: freezeChoices([
    {
      id: 'cabin-hatch',
      label: 'UPRIGHT',
      description: 'Tall hatchback roof and glass',
      family: 'kenney-compact',
      source: '/turn/assets/cars/hatchback-sports.glb',
      node: 'body',
      extraction: 'upper',
      splitY: 0.66,
      paintProfile: 'hatchback-sports'
    },
    {
      id: 'cabin-sedan',
      label: 'FASTBACK',
      description: 'Lower sports-sedan roof and glass',
      family: 'kenney-compact',
      source: '/turn/assets/cars/sedan-sports.glb',
      node: 'body',
      extraction: 'upper',
      splitY: 0.66,
      paintProfile: 'sedan-sports'
    }
  ]),
  wheels: freezeChoices([
    {
      id: 'wheels-classic',
      label: 'CLASSIC',
      description: 'Simple road wheels',
      family: 'kenney-compact',
      source: '/turn-lab/assets/build-a-car/parts/wheel-default.glb',
      node: 'wheel-default',
      rimCells: [[5, 4], [5, 5]]
    },
    {
      id: 'wheels-racing',
      label: 'RACING',
      description: 'Lightweight competition rims',
      family: 'kenney-compact',
      source: '/turn-lab/assets/build-a-car/parts/wheel-racing.glb',
      node: 'wheel-racing',
      rimCells: [[5, 4], [5, 5]]
    },
    {
      id: 'wheels-dark',
      label: 'DARK',
      description: 'Dark performance wheels',
      family: 'kenney-compact',
      source: '/turn-lab/assets/build-a-car/parts/wheel-dark.glb',
      node: 'wheel-dark',
      rimCells: [[5, 4], [5, 5]]
    }
  ]),
  spoiler: freezeChoices([
    {
      id: 'spoiler-none',
      label: 'NONE',
      description: 'Keep the rear deck clean',
      family: 'kenney-compact',
      source: null
    },
    {
      id: 'spoiler-low',
      label: 'LOW WING',
      description: 'Compact rear wing',
      family: 'kenney-compact',
      source: '/turn-lab/assets/build-a-car/parts/debris-spoiler-a.glb',
      node: 'debris-spoiler-a',
      scale: 1
    },
    {
      id: 'spoiler-high',
      label: 'HIGH WING',
      description: 'Tall competition rear wing',
      family: 'kenney-compact',
      source: '/turn-lab/assets/build-a-car/parts/debris-spoiler-b.glb',
      node: 'debris-spoiler-b',
      scale: 1
    }
  ]),
  roofAccessory: freezeChoices([
    {
      id: 'roof-none',
      label: 'NONE',
      description: 'No roof accessory',
      family: 'kenney-compact',
      procedural: null
    },
    {
      id: 'roof-taxi',
      label: 'TAXI SIGN',
      description: 'A bright roof-mounted taxi sign',
      family: 'kenney-compact',
      procedural: 'taxi-sign'
    },
    {
      id: 'roof-lightbar',
      label: 'LIGHT BAR',
      description: 'Red and blue emergency lamps',
      family: 'kenney-compact',
      procedural: 'emergency-lightbar'
    }
  ]),
  lights: freezeChoices([
    {
      id: 'lights-round',
      label: 'ROUND',
      description: 'Two round headlamps',
      family: 'kenney-compact',
      procedural: 'round-headlights'
    },
    {
      id: 'lights-bar',
      label: 'LIGHT STRIP',
      description: 'A slim futuristic light strip',
      family: 'kenney-compact',
      procedural: 'light-strip'
    }
  ])
});

export const CUSTOM_CAR_PERKS = freezeChoices([
  {
    id: 'long-burn',
    label: 'LONG BURN',
    description: 'Longer BOOST, but less BOOST power.'
  },
  {
    id: 'holeshot',
    label: 'HOLESHOT',
    description: 'Quicker launch, but slightly less top speed.'
  },
  {
    id: 'drift-dynamo',
    label: 'DRIFT DYNAMO',
    description: 'More BOOST from DRIFT, but less retained drift speed.'
  }
]);

export const CUSTOM_CAR_STAT_ROWS = Object.freeze([
  Object.freeze({ id: 'speed', label: 'TOP SPEED' }),
  Object.freeze({ id: 'acceleration', label: 'ACCELERATION' }),
  Object.freeze({ id: 'control', label: 'CONTROL' }),
  Object.freeze({ id: 'drift', label: 'DRIFT' }),
  Object.freeze({ id: 'boostPower', label: 'BOOST POWER' }),
  Object.freeze({ id: 'boostDuration', label: 'BOOST TANK' })
]);

export function getPart(category, id) {
  return PARTS_BY_CATEGORY[category]?.find((part) => part.id === id) || null;
}

export function getPerk(id) {
  return CUSTOM_CAR_PERKS.find((perk) => perk.id === id) || null;
}

export function isPartCombinationCompatible(parts) {
  const body = getPart('body', parts?.body);
  if (!body) return false;
  return PART_CATEGORIES.every(({ id: category }) => {
    const part = getPart(category, parts?.[category]);
    return Boolean(part && part.family === body.family);
  });
}
