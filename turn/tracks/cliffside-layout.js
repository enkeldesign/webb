const CONTROL_POINT_COUNT = 32;

export const CLIFFSIDE_CONTROL_POINTS = Object.freeze(Array.from(
  { length: CONTROL_POINT_COUNT },
  (_, index) => {
    const angle = (index / CONTROL_POINT_COUNT) * Math.PI * 2;
    const radius = 205
      + Math.sin(angle * 3 + 0.45) * 28
      + Math.sin(angle * 5 - 0.8) * 12
      + Math.cos(angle * 2 + 0.2) * 16;
    const x = Math.cos(angle) * radius * 1.15 - 35;
    const y = 10
      + Math.cos(angle + 0.6) * 12
      + Math.sin(angle * 2 - 0.2) * 4;
    const z = Math.sin(angle) * radius * 0.82 + 12;
    return Object.freeze([x, y, z]);
  }
));

export const CLIFFSIDE_LAYOUT_RULES = Object.freeze({
  minimumTurnRadiusComparedWithAirport: 'not-smaller',
  verticalRoadOverlap: false,
  minimumElevation: -6,
  maximumElevation: 20
});
