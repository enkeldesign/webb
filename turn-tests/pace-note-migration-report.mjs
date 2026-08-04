import * as THREE from 'three';

import { TRACK_CATALOG, createTrackRuntime } from '../turn/tracks/catalog.js';
import { getTrackPaceNotes } from '../turn/tracks/pace-notes.js';
import {
  analyzePaceNoteGeometry,
  directionName,
  forwardRouteDistance
} from '../turn/tracks/pace-note-geometry.js';
import { SAMPLE_COUNT, TRAINING_STAGES } from '../turn/training/stages.js';

for (const track of TRACK_CATALOG) {
  const runtime = createTrackRuntime(track.id, track.sampleCount || 720);
  reportMap(track.id, runtime.samples, runtime.trackLength, getTrackPaceNotes(track.id), true);
}

for (const stage of TRAINING_STAGES) {
  const samples = sampleTrainingStage(stage);
  const length = routeLength(samples, false);
  reportMap(stage.id, samples, length, groupTrainingNotes(stage), false);
}

function reportMap(trackId, samples, trackLength, notes, closed) {
  const curves = analyzePaceNoteGeometry(samples, { closed });
  console.log(`\n${trackId.toUpperCase()} semantic migration anchors`);
  for (const note of notes) {
    const groups = note.groups || [];
    const approach = Number.isFinite(Number(note.triggerEnd)) ? note.triggerEnd : note.progress;
    const selected = [];
    let cursorDistance = normalizedProgress(approach) * trackLength;

    for (const group of groups) {
      // Existing production and training data stores the physical-device panner sign.
      // Migration converts it back to semantic road direction before central panning.
      const semanticDirection = -Math.sign(Number(group.direction) || 1);
      const candidates = curves
        .filter((curve) => curve.direction === semanticDirection && !selected.includes(curve))
        .map((curve) => ({
          curve,
          lead: forwardRouteDistance(trackLength, cursorDistance, curve.peakDistance)
        }))
        .filter(({ lead }) => lead > 1 && lead < 620)
        .sort((a, b) => a.lead - b.lead);
      const match = candidates[0] || null;
      if (!match) break;
      selected.push(match.curve);
      cursorDistance = match.curve.peakDistance + 1;
    }

    const summary = selected.map((curve) => (
      `${curve.peakProgress.toFixed(3)} ${directionName(curve.direction)} ${curve.severity}/${curve.length}`
      + ` r${curve.radiusMetres.toFixed(0)} ${Math.abs(curve.turnAngleRadians * 180 / Math.PI).toFixed(0)}°`
    )).join(' -> ');
    console.log(`  ${note.id}: ${summary || 'NO MATCH'}`);
  }
}

function sampleTrainingStage(stage) {
  const points = stage.points.map(([x, z]) => new THREE.Vector3(x, 0, z));
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  return Array.from({ length: SAMPLE_COUNT }, (_, index) => {
    const progress = index / (SAMPLE_COUNT - 1);
    return {
      point: curve.getPointAt(progress),
      tangent: curve.getTangentAt(progress).normalize()
    };
  });
}

function groupTrainingNotes(stage) {
  const grouped = new Map();
  stage.notes.forEach((note, index) => {
    const key = Number(note.progress).toFixed(6);
    const current = grouped.get(key) || {
      id: `${stage.id}-${index + 1}`,
      progress: note.progress,
      groups: []
    };
    current.groups.push({
      direction: note.direction,
      severity: note.severity,
      length: note.long ? 'long' : undefined
    });
    grouped.set(key, current);
  });
  return [...grouped.values()];
}

function routeLength(samples, closed) {
  let length = 0;
  for (let index = 1; index < samples.length; index += 1) {
    length += samples[index].point.distanceTo(samples[index - 1].point);
  }
  if (closed && samples.length > 1) length += samples[0].point.distanceTo(samples.at(-1).point);
  return length;
}

function normalizedProgress(value) {
  const progress = Number(value) || 0;
  return ((progress % 1) + 1) % 1;
}
