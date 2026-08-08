import {
  AIRPORT_RUNWAY_AIRCRAFT,
  AIRPORT_RUNWAY_BLOCKERS,
  AIRPORT_RUNWAY_HANGAR
} from '/turn-next/airport-runway-spec.js';

function box(id, minX, maxX, minZ, maxZ, category) {
  return Object.freeze({ id, type: 'box', category, minX, maxX, minZ, maxZ });
}

function circle(id, x, z, radius, category) {
  return Object.freeze({ id, type: 'circle', category, x, z, radius });
}

function coneColliders() {
  return AIRPORT_RUNWAY_BLOCKERS.flatMap((barrier) => {
    const colliders = [];
    for (let index = 0; index < barrier.count; index += 1) {
      const offset = (index - (barrier.count - 1) / 2) * barrier.spacing;
      colliders.push(circle(
        `airport-runway-cone-${barrier.id}-${index}`,
        barrier.x + Math.cos(barrier.rotationY) * offset,
        barrier.z + Math.sin(barrier.rotationY) * offset,
        1.15,
        'cone'
      ));
    }
    return colliders;
  });
}

function hangarWallColliders() {
  const colliders = [];
  const localZs = [-14, -7, 0, 7, 14];
  const cosine = Math.cos(AIRPORT_RUNWAY_HANGAR.rotationY);
  const sine = Math.sin(AIRPORT_RUNWAY_HANGAR.rotationY);

  for (const side of [-1, 1]) {
    for (let index = 0; index < localZs.length; index += 1) {
      const localX = side * AIRPORT_RUNWAY_HANGAR.wallOffsetX;
      const localZ = localZs[index];
      const x = AIRPORT_RUNWAY_HANGAR.x + localX * cosine - localZ * sine;
      const z = AIRPORT_RUNWAY_HANGAR.z + localX * sine + localZ * cosine;
      colliders.push(circle(
        `airport-runway-hangar-${side < 0 ? 'left' : 'right'}-${index}`,
        x,
        z,
        1.2,
        'hangar-wall'
      ));
    }
  }
  return colliders;
}

const aircraftX = AIRPORT_RUNWAY_AIRCRAFT.x;
const aircraftZ = AIRPORT_RUNWAY_AIRCRAFT.z;

export const AIRPORT_RUNWAY_AIRCRAFT_COLLIDERS = Object.freeze([
  // The A380 is parked perpendicular to the runway. The fuselage extends beyond both
  // runway edges so the intended access-road detour cannot be bypassed on the shoulder.
  box(
    'airport-runway-a380-fuselage',
    aircraftX - 5,
    aircraftX + 5,
    aircraftZ - 42,
    aircraftZ + 42,
    'aircraft'
  ),
  // A second volume covers the wing planform. It is intentionally simpler than the mesh:
  // TURN collisions should be predictable at racing speed, not pixel-perfect punishment.
  box(
    'airport-runway-a380-wing',
    aircraftX - 41,
    aircraftX + 41,
    aircraftZ - 9,
    aircraftZ + 9,
    'aircraft'
  )
]);

export const AIRPORT_RUNWAY_CONE_COLLIDERS = Object.freeze(coneColliders());
export const AIRPORT_RUNWAY_HANGAR_COLLIDERS = Object.freeze(hangarWallColliders());

export const AIRPORT_RUNWAY_COLLIDERS = Object.freeze([
  ...AIRPORT_RUNWAY_AIRCRAFT_COLLIDERS,
  ...AIRPORT_RUNWAY_CONE_COLLIDERS,
  ...AIRPORT_RUNWAY_HANGAR_COLLIDERS
]);

export const AIRPORT_RUNWAY_COLLISION_RULES = Object.freeze({
  aircraftColliderCount: AIRPORT_RUNWAY_AIRCRAFT_COLLIDERS.length,
  coneColliderCount: AIRPORT_RUNWAY_CONE_COLLIDERS.length,
  hangarColliderCount: AIRPORT_RUNWAY_HANGAR_COLLIDERS.length,
  totalColliderCount: AIRPORT_RUNWAY_COLLIDERS.length
});
