import * as THREE from 'three';

import { TRACK_CATALOG, createTrackRuntime } from '../turn/tracks/catalog.js';
import { compileTrackPaceNotes } from '../turn/tracks/pace-note-compiler.js';
import { getTrackPaceNoteRecipes } from '../turn/tracks/pace-note-recipes.js';
import { directionName } from '../turn/tracks/pace-note-geometry.js';
import { SAMPLE_COUNT, TRAINING_STAGES } from '../turn/training/stages.js';

for (const track of TRACK_CATALOG) {
  const runtime = createTrackRuntime(track.id, track.sampleCount || 720);
  const notes = compileTrackPaceNotes(track.id, runtime.samples, getTrackPaceNoteRecipes(track.id));
  report(track.id, runtime.trackLength, notes);
}

for (const stage of TRAINING_STAGES) {
  const samples = sampleTrainingStage(stage);
  const length = routeLength(samples);
  console.log(`\n${stage.id.toUpperCase()} · ${length.toFixed(0)} m`);
  for (const note of groupTrainingNotes(stage)) {
    console.log(`  ${note.id} @ ${note.progress.toFixed(3)}: ${note.groups.map(groupLabel).join(' -> ')}`);
  }
}

function report(trackId, trackLength, notes) {
  console.log(`\n${trackId.toUpperCase()} · ${trackLength.toFixed(0)} m`);
  for (const note of notes) {
    const groupSummary = note.geometry.groups.map((group) => {
      const geometry = group.geometry;
      return `${directionName(group.direction)} ${group.severity}/${group.length}`
        + ` · anchor ${geometry.anchorProgress.toFixed(3)}`
        + ` peak ${geometry.peakProgress.toFixed(3)}`
        + ` r${Number.isFinite(geometry.radiusMetres) ? geometry.radiusMetres.toFixed(0) : '∞'}`
        + ` ${(Math.abs(geometry.turnAngleRadians) * 180 / Math.PI).toFixed(0)}°`
        + ` ${geometry.lengthMetres.toFixed(0)}m`
        + `${group.overrideReason ? ' · override' : ''}`;
    }).join(' -> ');
    console.log(
      `  ${note.id} [${note.triggerStart.toFixed(3)}..${note.triggerEnd.toFixed(3)}] ${groupSummary}`
    );
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
    current.groups.push(note);
    grouped.set(key, current);
  });
  return [...grouped.values()];
}

function groupLabel(group) {
  return `${directionName(group.direction)} ${group.severity}/${group.long ? 'long' : 'short'}`;
}

function routeLength(samples) {
  let length = 0;
  for (let index = 1; index < samples.length; index += 1) {
    length += samples[index].point.distanceTo(samples[index - 1].point);
  }
  return length;
}
