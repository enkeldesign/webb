export const PACE_NOTE_DIRECTION = Object.freeze({
  LEFT: -1,
  RIGHT: 1
});

const AIRPORT_PACE_NOTES = Object.freeze([
  Object.freeze({
    id: 'airport-1',
    triggerStart: 0.948,
    triggerEnd: 0.988,
    groups: Object.freeze([
      Object.freeze({ direction: PACE_NOTE_DIRECTION.RIGHT, severity: 2 })
    ])
  }),
  Object.freeze({
    id: 'airport-2',
    triggerStart: 0.155,
    triggerEnd: 0.225,
    groups: Object.freeze([
      Object.freeze({ direction: PACE_NOTE_DIRECTION.RIGHT, severity: 1 })
    ])
  }),
  Object.freeze({
    id: 'airport-3',
    triggerStart: 0.385,
    triggerEnd: 0.455,
    groups: Object.freeze([
      Object.freeze({ direction: PACE_NOTE_DIRECTION.RIGHT, severity: 2 }),
      Object.freeze({ direction: PACE_NOTE_DIRECTION.LEFT, severity: 3 })
    ])
  }),
  Object.freeze({
    id: 'airport-4',
    triggerStart: 0.565,
    triggerEnd: 0.625,
    groups: Object.freeze([
      Object.freeze({ direction: PACE_NOTE_DIRECTION.RIGHT, severity: 2 })
    ])
  })
]);

const PACE_NOTE_MAPS = Object.freeze({
  airport: AIRPORT_PACE_NOTES
});

export function getTrackPaceNotes(trackId) {
  return PACE_NOTE_MAPS[String(trackId || '').toLowerCase()] || Object.freeze([]);
}

export function speedAdjustedPaceNoteTrigger(note, speed, maxSpeed = 88) {
  const start = clampProgress(note?.triggerStart);
  const end = clampProgress(note?.triggerEnd);
  const safeMaxSpeed = Math.max(20, Number(maxSpeed) || 88);
  const speedRatio = clamp((Math.max(0, Number(speed) || 0) - 6) / (safeMaxSpeed * 0.72), 0, 1);
  return end - (end - start) * speedRatio;
}

function clampProgress(value) {
  return clamp(Number(value) || 0, 0, 1);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
