import * as THREE from 'three';

// TRACK 6 experiment: a closed, non-self-crossing footprint with substantial vertical
// movement. Keeping the X/Z path free of over-under crossings means TURN's existing
// nearest-track and checkpoint infrastructure can remain untouched while we test a much
// more rollercoaster-like elevation profile.
export const TOYBOX_CONTROL_POINTS = Object.freeze([
  Object.freeze([0, 2, -180]),
  Object.freeze([65, 6, -185]),
  Object.freeze([132, 22, -165]),
  Object.freeze([188, 44, -122]),
  Object.freeze([215, 50, -62]),
  Object.freeze([220, 34, 5]),
  Object.freeze([205, 8, 72]),
  Object.freeze([170, 4, 125]),
  Object.freeze([118, 18, 162]),
  Object.freeze([55, 32, 182]),
  Object.freeze([-15, 44, 186]),
  Object.freeze([-85, 48, 166]),
  Object.freeze([-145, 38, 128]),
  Object.freeze([-195, 20, 73]),
  Object.freeze([-220, 5, 10]),
  Object.freeze([-215, 12, -58]),
  Object.freeze([-180, 25, -118]),
  Object.freeze([-130, 16, -160]),
  Object.freeze([-65, 5, -185])
]);

export function createToyboxTrackCurve() {
  const points = TOYBOX_CONTROL_POINTS.map(([x, y, z]) => new THREE.Vector3(x, y, z));
  return new THREE.CatmullRomCurve3(points, true, 'centripetal');
}
