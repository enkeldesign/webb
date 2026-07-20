export const ABILITY_ZONE_TYPE = Object.freeze({
  DRIFT: 'drift',
  BOOST: 'boost'
});

// These positions are authored for TURN's permanent 720-sample circuit.
// Ratios keep them stable if the visual sampling density changes later.
export const ABILITY_ZONES = Object.freeze([
  zone({
    id: 'drift-east-outer',
    type: ABILITY_ZONE_TYPE.DRIFT,
    start: 0.018,
    end: 0.104,
    laneCenter: -0.32,
    laneWidth: 0.24,
    edge: 'outer'
  }),
  zone({
    id: 'boost-north-straight',
    type: ABILITY_ZONE_TYPE.BOOST,
    start: 0.145,
    end: 0.184,
    laneCenter: -0.18,
    laneWidth: 0.26,
    straightAfter: Object.freeze([0.184, 0.305])
  }),
  zone({
    id: 'drift-northwest-outer',
    type: ABILITY_ZONE_TYPE.DRIFT,
    start: 0.313,
    end: 0.397,
    laneCenter: -0.32,
    laneWidth: 0.24,
    edge: 'outer'
  }),
  zone({
    id: 'drift-west-outer',
    type: ABILITY_ZONE_TYPE.DRIFT,
    start: 0.472,
    end: 0.565,
    laneCenter: -0.32,
    laneWidth: 0.24,
    edge: 'outer'
  }),
  zone({
    id: 'boost-south-straight',
    type: ABILITY_ZONE_TYPE.BOOST,
    start: 0.708,
    end: 0.752,
    laneCenter: 0.12,
    laneWidth: 0.26,
    straightAfter: Object.freeze([0.752, 0.865])
  })
]);

function zone(definition) {
  return Object.freeze(definition);
}

export function progressInZone(progress, abilityZone) {
  const value = wrapProgress(progress);
  const start = wrapProgress(abilityZone.start);
  const end = wrapProgress(abilityZone.end);
  return start <= end
    ? value >= start && value <= end
    : value >= start || value <= end;
}

export function zoneSampleIndices(abilityZone, sampleCount) {
  const count = Math.max(1, Math.floor(sampleCount));
  const start = Math.round(wrapProgress(abilityZone.start) * count) % count;
  const end = Math.round(wrapProgress(abilityZone.end) * count) % count;
  const indices = [];
  let index = start;

  for (let guard = 0; guard <= count; guard += 1) {
    indices.push(index);
    if (index === end) break;
    index = (index + 1) % count;
  }

  return indices;
}

export function findAbilityZoneAt({
  position,
  nearestTrackIndex,
  samples,
  trackWidth,
  abilityZones = ABILITY_ZONES
}) {
  if (!samples?.length || !position) return null;

  const count = samples.length;
  const index = modulo(Math.round(nearestTrackIndex || 0), count);
  const progress = index / count;
  const sample = samples[index];
  const laneOffset = signedLaneOffset(position, sample);

  for (const abilityZone of abilityZones) {
    if (!progressInZone(progress, abilityZone)) continue;

    const targetLaneOffset = abilityZone.laneCenter * trackWidth;
    const halfWidth = abilityZone.laneWidth * trackWidth * 0.5;
    const laneError = targetLaneOffset - laneOffset;
    if (Math.abs(laneError) > halfWidth) continue;

    return Object.freeze({
      id: abilityZone.id,
      type: abilityZone.type,
      definition: abilityZone,
      sample,
      index,
      progress,
      laneOffset,
      targetLaneOffset,
      laneError,
      halfWidth
    });
  }

  return null;
}

export function signedLaneOffset(position, sample) {
  const dx = (Number(position.x) || 0) - (Number(sample?.point?.x) || 0);
  const dz = (Number(position.z) || 0) - (Number(sample?.point?.z) || 0);
  return dx * (Number(sample?.normal?.x) || 0) + dz * (Number(sample?.normal?.z) || 0);
}

function wrapProgress(value) {
  const number = Number(value) || 0;
  return ((number % 1) + 1) % 1;
}

function modulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}
