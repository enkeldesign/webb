import * as THREE from 'three';

import { TRACK_CATALOG, createTrackRuntime } from '../turn/tracks/catalog.js';
import { getTrackPaceNotes } from '../turn/tracks/pace-notes.js';
import {
  auditAuthoredPaceNotes,
  directionName
} from '../turn/tracks/pace-note-geometry.js';
import { SAMPLE_COUNT, TRAINING_STAGES } from '../turn/training/stages.js';

const reports = [];

for (const track of TRACK_CATALOG) {
  const runtime = createTrackRuntime(track.id, track.sampleCount || 720);
  reports.push(auditAuthoredPaceNotes({
    trackId: track.id,
    samples: runtime.samples,
    notes: getTrackPaceNotes(track.id),
    closed: true
  }));
}

for (const stage of TRAINING_STAGES) {
  const samples = sampleTrainingStage(stage);
  reports.push(auditAuthoredPaceNotes({
    trackId: stage.id,
    samples,
    notes: groupTrainingNotes(stage),
    closed: false,
    options: {
      maximumLeadMetres: 180,
      maximumLinkedGapMetres: 120
    }
  }));
}

let issueCount = 0;
for (const report of reports) {
  issueCount += report.issueCount;
  console.log(`\n${report.trackId.toUpperCase()} · ${report.trackLength.toFixed(0)} m · ${report.curves.length} detected curves`);
  for (const curve of report.curves) {
    console.log(
      `  curve ${String(curve.index + 1).padStart(2, '0')} @ ${curve.startProgress.toFixed(3)}`
      + ` ${directionName(curve.direction)} ${curve.severity}/${curve.length}`
      + ` · ${curve.lengthMetres.toFixed(0)} m · radius ${Number.isFinite(curve.radiusMetres) ? curve.radiusMetres.toFixed(0) : '∞'} m`
      + ` · turn ${(curve.turnAngleRadians * 180 / Math.PI).toFixed(0)}°`
    );
  }

  for (const entry of report.entries) {
    const authored = entry.authoredGroups.map(groupLabel).join(' -> ') || 'none';
    const expected = entry.expectedGroups.map(groupLabel).join(' -> ') || 'no curve found';
    const lead = entry.slowLeadMetres == null ? 'n/a' : `${entry.slowLeadMetres.toFixed(0)} m`;
    const marker = entry.issues.length ? 'FAIL' : 'OK';
    console.log(`  ${marker} ${entry.id}: ${authored} | geometry ${expected} | lead ${lead}`);
    for (const issue of entry.issues) console.log(`       - ${issue}`);
  }
}

console.log(`\nPace-note geometry audit found ${issueCount} issue(s).`);
if (process.env.PACE_NOTE_STRICT === '1' && issueCount > 0) process.exitCode = 1;

function sampleTrainingStage(stage) {
  const points = stage.points.map(([x, z]) => new THREE.Vector3(x, 0, z));
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  return Array.from({ length: SAMPLE_COUNT }, (_, index) => {
    const progress = index / (SAMPLE_COUNT - 1);
    const point = curve.getPointAt(progress);
    const tangent = curve.getTangentAt(progress).normalize();
    return { point, tangent };
  });
}

function groupTrainingNotes(stage) {
  const grouped = new Map();
  stage.notes.forEach((note, index) => {
    const key = Number(note.progress).toFixed(6);
    const existing = grouped.get(key) || {
      id: `${stage.id}-${index + 1}`,
      progress: note.progress,
      groups: []
    };
    existing.groups.push({
      direction: note.direction,
      severity: note.severity,
      length: note.long ? 'long' : undefined
    });
    grouped.set(key, existing);
  });
  return [...grouped.values()];
}

function groupLabel(group) {
  const direction = directionName(group.direction).slice(0, 1).toUpperCase();
  const length = group.length || (group.long ? 'long' : 'unspecified');
  return `${direction}${group.severity}/${length}`;
}
