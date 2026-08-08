import * as THREE from 'three';
import {
  AIRPORT_RUNWAY_ACCESS_ROADS,
  AIRPORT_RUNWAY_Z
} from './airport-runway-spec.js';

const [ENTRY, AIRCRAFT_EXIT, AIRCRAFT_REENTRY, HANGAR_EXIT] = AIRPORT_RUNWAY_ACCESS_ROADS;

// TURN NEXT-only prototype of AIRPORT: RUNWAY.
// The lower/outer Airport circuit is preserved. The upper section is replaced by the
// four-access-road sequence from the sketch:
//   road -> runway -> off before the A380 -> around it -> runway -> off -> hangar -> road.
// Keeping the plane between access roads 2 and 3 is deliberate: the obstacle now enforces
// the detour instead of sitting on top of the authored racing line.
export const AIRPORT_RUNWAY_CONTROL_POINTS = Object.freeze([
  [-205, -126],
  [-120, -138],
  [-20, -142],
  [90, -140],
  [175, -128],
  [214, -100],
  [232, -58],
  [232, -12],
  [218, 34],
  [192, 70],
  [154, 98],

  // 1. Cones close the old continuation; turn down the first access road.
  [ENTRY.x, 74],
  [ENTRY.x, 20],
  [ENTRY.x, -62],
  [ENTRY.x, -132],
  [ENTRY.x, -188],
  [ENTRY.x, AIRPORT_RUNWAY_Z],

  // First runway burst. The A380 is ahead, so leave before reaching its wing.
  [105, AIRPORT_RUNWAY_Z],
  [78, AIRPORT_RUNWAY_Z],
  [AIRCRAFT_EXIT.x, -190],
  [AIRCRAFT_EXIT.x, -150],
  [AIRCRAFT_EXIT.x, -118],

  // Pass behind the aircraft on the service road.
  [35, -118],
  [0, -118],
  [-30, -118],
  [AIRCRAFT_REENTRY.x, -118],

  // 3. Cones close the service-road continuation; return to the runway.
  [AIRCRAFT_REENTRY.x, -155],
  [AIRCRAFT_REENTRY.x, -190],
  [AIRCRAFT_REENTRY.x, AIRPORT_RUNWAY_Z],

  // Second runway burst, then leave before the runway-end barrier.
  [-105, AIRPORT_RUNWAY_Z],
  [-150, AIRPORT_RUNWAY_Z],
  [HANGAR_EXIT.x, AIRPORT_RUNWAY_Z],
  [HANGAR_EXIT.x, -180],
  [HANGAR_EXIT.x, -140],
  [HANGAR_EXIT.x, -110],

  // 4. Thread the open hangar and turn left back onto the established Airport loop.
  [-156, -86],
  [-130, -66],
  [-104, -55],
  [-80, -34],
  [-58, -8],
  [-38, 32],
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
].map(([x, z]) => Object.freeze([x, z])));

export function createAirportRunwayControlPoints() {
  return AIRPORT_RUNWAY_CONTROL_POINTS.map(([x, z]) => new THREE.Vector3(x, 0, z));
}
