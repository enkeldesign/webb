// The one view of a car in GARAGE: the showroom's starting angle, 20° off head-on,
// its camera and its light. The live showroom starts here and every car card's still
// is rendered from here (scripts/render-car-stills.mjs), so the two always agree.

export const CAR_VIEW = Object.freeze({
  // 180° faces the camera head-on; 200° turns the car 20° off it.
  yawDegrees: 200,
  fov: 34,
  camera: Object.freeze([8.6, 4.9, 9.7]),
  target: Object.freeze([0, 1.05, 0]),
  stageHeight: 0.26,
  targetLength: 6.5,
  hemisphere: Object.freeze({ sky: 0xffffff, ground: 0x43556c, intensity: 3.4 }),
  key: Object.freeze({ color: 0xfff2c9, intensity: 4.4, position: Object.freeze([-7, 11, 8]) }),
  rim: Object.freeze({ color: 0x8ed8ff, intensity: 2.2, position: Object.freeze([8, 5, -7]) })
});
