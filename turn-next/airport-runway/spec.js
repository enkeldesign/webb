// TURN NEXT-only AIRPORT: RUNWAY prototype contract.
// Keep this file browser- and Node-friendly so geometry/collision QA can import it directly.

export const AIRPORT_RUNWAY_ID = 'airport';
export const AIRPORT_RUNWAY_STORAGE_REVISION = 'airport-runway-next-r2';
export const AIRPORT_RUNWAY_Z = -221;
export const AIRPORT_SERVICE_ROAD_Z = -140;

export const AIRPORT_RUNWAY_ACCESS_ROADS = Object.freeze([-150, -55, 65, 170]);
export const CANONICAL_AIRPORT_ACCESS_ROADS = Object.freeze([-132, 18, 170]);

// The first horizontal Airport section is replaced by two runway runs with a service-road
// diversion between them. After the open blue hangar, the route rejoins the canonical
// Airport outer curve; the rest of the lap remains the familiar Airport.
export const AIRPORT_RUNWAY_CONTROL_POINTS = Object.freeze([
  [-205, -126],
  [-182, -132],
  [-162, -138],
  [-150, -150],
  [-150, -180],
  [-150, -221],
  [-110, -221],
  [-80, -221],
  [-55, -221],
  [-55, -190],
  [-55, -158],
  [-55, -140],
  [-20, -140],
  [20, -140],
  [45, -140],
  [60, -145],
  [65, -160],
  [65, -190],
  [65, -221],
  [105, -221],
  [140, -221],
  [170, -221],
  [170, -190],
  [170, -160],
  [170, -135],
  [168, -105],
  [164, -80],
  [160, -66],
  [158, -50],
  [158, -32],
  [175, -22],
  [195, -14],
  [213, -4],
  [225, 10],
  [228, 24],
  [218, 34],
  [192, 70],
  [154, 98],
  [110, 118],
  [75, 120],
  [55, 108],
  [42, 88],
  [32, 65],
  [25, 43],
  [0, 22],
  [-25, 43],
  [-32, 65],
  [-42, 88],
  [-55, 108],
  [-85, 121],
  [-128, 126],
  [-168, 112],
  [-204, 84],
  [-228, 45],
  [-236, 2],
  [-229, -45],
  [-215, -88]
].map((point) => Object.freeze(point)));

export const AIRPORT_RUNWAY_AIRCRAFT = Object.freeze({
  x: 5,
  z: AIRPORT_RUNWAY_Z,
  targetLength: 74,
  source: 'https://raw.githubusercontent.com/amvlab/aircraft-models/91d835e8e851b2317fe79af291c9fed6153fd525/models/A380_nologo.glb'
});

export const AIRPORT_RUNWAY_HANGAR = Object.freeze({
  x: 158,
  z: -48,
  rotationY: 0,
  width: 54,
  height: 20,
  depth: 34,
  wallThickness: 2.2,
  wallOffsetX: 25.9
});

// Long cone rows close the tempting straight-on route. Their collision footprint reaches
// the prototype's track envelope, so a player cannot bypass the intended diversion by
// simply driving around the last cone on the apron.
export const AIRPORT_RUNWAY_BARRIERS = Object.freeze([
  Object.freeze({ id: 'first-access', x: -120, z: AIRPORT_SERVICE_ROAD_Z, rotationY: Math.PI / 2, count: 17, spacing: 4.5 }),
  Object.freeze({ id: 'second-access', x: 92, z: AIRPORT_SERVICE_ROAD_Z, rotationY: Math.PI / 2, count: 17, spacing: 4.5 }),
  Object.freeze({ id: 'runway-exit', x: 210, z: AIRPORT_RUNWAY_Z, rotationY: Math.PI / 2, count: 17, spacing: 4.5 })
]);

// Authored against the route above. Strings are translated to TURN's pace-note constants
// by pace-notes.js; keeping the blueprint plain makes directional QA deterministic in Node.
export const AIRPORT_RUNWAY_PACE_NOTE_BLUEPRINT = Object.freeze([
  Object.freeze({ id: 'airport-runway-1', triggerStart: 0.008, triggerEnd: 0.034, direction: 'left', severity: 2, length: 'medium' }),
  Object.freeze({ id: 'airport-runway-2', triggerStart: 0.052, triggerEnd: 0.076, direction: 'right', severity: 3, length: 'medium' }),
  Object.freeze({ id: 'airport-runway-3', triggerStart: 0.108, triggerEnd: 0.132, direction: 'right', severity: 3, length: 'medium' }),
  Object.freeze({ id: 'airport-runway-4', triggerStart: 0.154, triggerEnd: 0.180, direction: 'left', severity: 3, length: 'medium' }),
  Object.freeze({ id: 'airport-runway-5', triggerStart: 0.220, triggerEnd: 0.250, direction: 'left', severity: 3, length: 'medium' }),
  Object.freeze({ id: 'airport-runway-6', triggerStart: 0.268, triggerEnd: 0.294, direction: 'right', severity: 3, length: 'medium' }),
  Object.freeze({ id: 'airport-runway-7', triggerStart: 0.326, triggerEnd: 0.354, direction: 'right', severity: 3, length: 'medium' }),
  Object.freeze({ id: 'airport-runway-8', triggerStart: 0.438, triggerEnd: 0.468, direction: 'left', severity: 2, length: 'medium' }),
  Object.freeze({ id: 'airport-runway-9', triggerStart: 0.492, triggerEnd: 0.525, direction: 'right', severity: 2, length: 'long' }),
  Object.freeze({ id: 'airport-runway-10', triggerStart: 0.674, triggerEnd: 0.710, direction: 'left', severity: 3, length: 'medium' }),
  Object.freeze({ id: 'airport-runway-11', triggerStart: 0.754, triggerEnd: 0.808, direction: 'right', severity: 2, length: 'long' }),
  Object.freeze({ id: 'airport-runway-12', triggerStart: 0.888, triggerEnd: 0.928, direction: 'right', severity: 2, length: 'medium' })
]);
