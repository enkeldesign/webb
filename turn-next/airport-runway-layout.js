import * as THREE from 'three';

// TURN NEXT-only prototype of AIRPORT: RUNWAY.
// The route preserves the lower half of Airport and replaces the northern half with
// four runway access roads, two runway runs, an aircraft diversion, and a hangar pass-through.
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

  // Access road 1: force onto the runway.
  [130, 74],
  [130, 22],
  [130, -62],
  [130, -132],
  [130, -188],

  // First runway run, then aircraft forces the player off via access road 2.
  [72, -221],
  [20, -221],
  [-28, -221],
  [-28, -175],
  [-28, -116],

  // Cones feed back to access road 3 and onto the runway again.
  [-86, -118],
  [-86, -174],
  [-86, -221],
  [-145, -221],
  [-188, -221],

  // Leave the runway on access road 4 before the threshold.
  [-188, -170],
  [-188, -112],

  // Open hangar pass-through, then left back onto the original lower Airport route.
  [-150, -82],
  [-112, -50],
  [-72, -12],
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
