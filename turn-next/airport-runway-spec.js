// Shared geometry for the TURN NEXT-only AIRPORT: RUNWAY prototype.
// Keep route, scenery and collision data on the same coordinates so a visual blocker
// cannot drift away from the physical obstacle that enforces it.

export const AIRPORT_RUNWAY_ID = 'airport-runway';
export const AIRPORT_RUNWAY_Z = -221;

export const AIRPORT_RUNWAY_ACCESS_ROADS = Object.freeze([
  Object.freeze({ id: 'entry', x: 150 }),
  Object.freeze({ id: 'aircraft-exit', x: 72 }),
  Object.freeze({ id: 'aircraft-reentry', x: -55 }),
  Object.freeze({ id: 'hangar-exit', x: -185 })
]);

export const AIRPORT_RUNWAY_ACCESS_ROAD_CENTER_Z = -169;
export const AIRPORT_RUNWAY_ACCESS_ROAD_LENGTH = 104;

export const AIRPORT_RUNWAY_AIRCRAFT = Object.freeze({
  x: 6,
  z: AIRPORT_RUNWAY_Z,
  y: 0.22,
  rotationY: 0,
  targetSpan: 82,
  source: 'https://raw.githubusercontent.com/amvlab/aircraft-models/main/models/A380_nologo.glb'
});

export const AIRPORT_RUNWAY_HANGAR = Object.freeze({
  x: -104,
  z: -55,
  rotationY: -0.78,
  width: 38,
  depth: 34,
  wallOffsetX: 17.9,
  wallLength: 34,
  wallHeight: 13,
  guideLength: 42
});

// These are the deliberately authored barriers in the player's sketch. Each visible
// cone receives its own circle collider; spacing is therefore also gameplay data.
export const AIRPORT_RUNWAY_BLOCKERS = Object.freeze([
  Object.freeze({
    id: 'upper-road',
    x: 114,
    z: 109,
    rotationY: 0.12,
    count: 9,
    spacing: 3.2
  }),
  Object.freeze({
    id: 'service-road',
    x: -76,
    z: -118,
    rotationY: Math.PI / 2,
    count: 9,
    spacing: 3.2
  }),
  Object.freeze({
    id: 'runway-end',
    x: -211,
    z: AIRPORT_RUNWAY_Z,
    rotationY: Math.PI / 2,
    count: 13,
    spacing: 4.4
  })
]);
