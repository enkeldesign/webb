import {
  AIRPORT_RUNWAY_AIRCRAFT,
  AIRPORT_RUNWAY_BARRIERS,
  AIRPORT_RUNWAY_HANGAR
} from './spec.js';

function box(id, minX, maxX, minZ, maxZ, category) {
  return Object.freeze({ id, type: 'box', category, minX, maxX, minZ, maxZ });
}

function barrierCollider(barrier) {
  const halfSpan = ((barrier.count - 1) * barrier.spacing) / 2 + 1.1;
  const horizontal = Math.abs(Math.cos(barrier.rotationY)) > 0.5;
  return horizontal
    ? box(
      `airport-runway-barrier-${barrier.id}`,
      barrier.x - halfSpan,
      barrier.x + halfSpan,
      barrier.z - 1.2,
      barrier.z + 1.2,
      'traffic-cones'
    )
    : box(
      `airport-runway-barrier-${barrier.id}`,
      barrier.x - 1.2,
      barrier.x + 1.2,
      barrier.z - halfSpan,
      barrier.z + halfSpan,
      'traffic-cones'
    );
}

const planeX = AIRPORT_RUNWAY_AIRCRAFT.x;
const planeZ = AIRPORT_RUNWAY_AIRCRAFT.z;

export const AIRPORT_RUNWAY_AIRCRAFT_COLLIDERS = Object.freeze([
  // A simplified plan-view A380. Predictable racing collision is preferable to a
  // triangle-perfect mesh collider: the wing and fuselage volumes communicate the
  // silhouette without snagging a car on landing gear or engine details.
  box(
    'airport-runway-a380-fuselage',
    planeX - 5.2,
    planeX + 5.2,
    planeZ - 40.5,
    planeZ + 40.5,
    'aircraft'
  ),
  box(
    'airport-runway-a380-wings',
    planeX - 41.5,
    planeX + 41.5,
    planeZ - 8.5,
    planeZ + 8.5,
    'aircraft'
  )
]);

export const AIRPORT_RUNWAY_BARRIER_COLLIDERS = Object.freeze(
  AIRPORT_RUNWAY_BARRIERS.map(barrierCollider)
);

export const AIRPORT_RUNWAY_HANGAR_COLLIDERS = Object.freeze([
  box(
    'airport-runway-blue-hangar-left-wall',
    AIRPORT_RUNWAY_HANGAR.x - AIRPORT_RUNWAY_HANGAR.wallOffsetX - AIRPORT_RUNWAY_HANGAR.wallThickness / 2,
    AIRPORT_RUNWAY_HANGAR.x - AIRPORT_RUNWAY_HANGAR.wallOffsetX + AIRPORT_RUNWAY_HANGAR.wallThickness / 2,
    AIRPORT_RUNWAY_HANGAR.z - AIRPORT_RUNWAY_HANGAR.depth / 2,
    AIRPORT_RUNWAY_HANGAR.z + AIRPORT_RUNWAY_HANGAR.depth / 2,
    'hangar-wall'
  ),
  box(
    'airport-runway-blue-hangar-right-wall',
    AIRPORT_RUNWAY_HANGAR.x + AIRPORT_RUNWAY_HANGAR.wallOffsetX - AIRPORT_RUNWAY_HANGAR.wallThickness / 2,
    AIRPORT_RUNWAY_HANGAR.x + AIRPORT_RUNWAY_HANGAR.wallOffsetX + AIRPORT_RUNWAY_HANGAR.wallThickness / 2,
    AIRPORT_RUNWAY_HANGAR.z - AIRPORT_RUNWAY_HANGAR.depth / 2,
    AIRPORT_RUNWAY_HANGAR.z + AIRPORT_RUNWAY_HANGAR.depth / 2,
    'hangar-wall'
  )
]);

export const AIRPORT_RUNWAY_COLLIDERS = Object.freeze([
  ...AIRPORT_RUNWAY_AIRCRAFT_COLLIDERS,
  ...AIRPORT_RUNWAY_BARRIER_COLLIDERS,
  ...AIRPORT_RUNWAY_HANGAR_COLLIDERS
]);

export const AIRPORT_RUNWAY_COLLISION_PROFILE = Object.freeze({
  // Tighter than ordinary Airport free-roam so the physical obstacle course cannot be
  // bypassed through the apron, while still leaving generous recovery room around the road.
  freeRoamDistance: 42,
  shoulderStartDistance: 27,
  shoulderDrag: 1.15,
  boundaryBounce: 0.04,
  boundaryTangentRetention: 0.94,
  boundaryMinimumRecoverySpeed: 5.5,
  colliders: AIRPORT_RUNWAY_COLLIDERS
});

export const AIRPORT_RUNWAY_COLLISION_RULES = Object.freeze({
  aircraftHitboxes: AIRPORT_RUNWAY_AIRCRAFT_COLLIDERS.length,
  barrierHitboxes: AIRPORT_RUNWAY_BARRIER_COLLIDERS.length,
  hangarHitboxes: AIRPORT_RUNWAY_HANGAR_COLLIDERS.length,
  totalHitboxes: AIRPORT_RUNWAY_COLLIDERS.length
});
