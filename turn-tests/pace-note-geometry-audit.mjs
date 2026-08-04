import assert from 'node:assert/strict';
import * as THREE from 'three';

import { TRACK_CATALOG, createTrackRuntime } from '../turn/tracks/catalog.js';
import {
  compileTrackPaceNotes,
  measureCurveAtProgress
} from '../turn/tracks/pace-note-compiler.js';
import {
  getTrackPaceNoteRecipes,
  validatePaceNoteRecipes
} from '../turn/tracks/pace-note-recipes.js';
import { paceNoteDuration } from '../turn/audio/pace-notes.js';
import { SAMPLE_COUNT, TRAINING_STAGES } from '../turn/training/stages.js';

const EXPECTED_TRACK_LANGUAGE = Object.freeze({
  countryside: Object.freeze([
    ['L2/long'],
    ['L1/long'],
    ['L2/medium'],
    ['L1/long']
  ]),
  airport: Object.freeze([
    ['L3/short'],
    ['L1/long'],
    ['L2/short', 'R3/medium'],
    ['L2/short']
  ]),
  cliffside: Object.freeze([
    ['L2/medium'],
    ['R1/medium'],
    ['L2/medium'],
    ['R1/short', 'L2/medium'],
    ['L1/medium']
  ]),
  harbor: Object.freeze([
    ['L3/short'],
    ['L3/medium'],
    ['R3/medium'],
    ['L3/medium'],
    ['L1/medium']
  ]),
  'midnight-city': Object.freeze([
    ['L1/medium'],
    ['L2/medium'],
    ['R2/medium', 'R3/short'],
    ['L2/medium', 'L3/long'],
    ['R3/short'],
    ['L3/short'],
    ['L2/long', 'L3/medium'],
    ['R3/short', 'R3/medium'],
    ['L2/medium', 'L3/long'],
    ['R3/short'],
    ['L2/short']
  ])
});

const TRAINING_CALIBRATION = Object.freeze({
  'dbe-training-2': Object.freeze([
    Object.freeze({ cueProgress: 0.10, anchors: [0.339], labels: ['R1/short'], reason: 'The first lesson deliberately reduces a broad bend to one introductory BIP.' }),
    Object.freeze({ cueProgress: 0.49, anchors: [0.588], labels: ['L2/short'], reason: 'The second lesson deliberately contrasts two BIPs with the earlier one-BIP curve.' })
  ]),
  'dbe-training-3': Object.freeze([
    Object.freeze({ cueProgress: 0.17, anchors: [0.590], labels: ['R1/short'], reason: 'Recovery training keeps the first post-recovery turn to one unambiguous BIP.' })
  ]),
  'dbe-training-4': Object.freeze([
    Object.freeze({ cueProgress: 0.16, anchors: [0.385], labels: ['L3/long'], reason: 'The lesson is the canonical BIP BIP BEEP example for a long tight curve.' })
  ]),
  'dbe-training-5': Object.freeze([
    Object.freeze({ cueProgress: 0.08, anchors: [0.259], labels: ['R1/short'], reason: 'The graduation run begins with a deliberately simple one-BIP right.' }),
    Object.freeze({ cueProgress: 0.43, anchors: [0.566, 0.700], labels: ['R2/short', 'L2/long'], reason: 'The final linked phrase is an explicit right-medium then long-left vocabulary exercise.' })
  ])
});

assert.deepEqual(validatePaceNoteRecipes(), [], 'Production geometry overrides must always include a reason');

for (const track of TRACK_CATALOG) {
  const runtime = createTrackRuntime(track.id, track.sampleCount || 720);
  const recipes = getTrackPaceNoteRecipes(track.id);
  const notes = compileTrackPaceNotes(track.id, runtime.samples, recipes);
  const expected = EXPECTED_TRACK_LANGUAGE[track.id];

  assert.ok(expected, `${track.id} needs an independent QA expectation`);
  assert.equal(notes.length, recipes.length, `${track.id} must compile every recipe exactly once`);
  assert.equal(notes.length, expected.length, `${track.id} QA expectations must cover every phrase`);
  assert.deepEqual(
    notes.map((note) => note.groups.map(groupLabel)),
    expected,
    `${track.id} direction, tightness and duration changed; inspect the route before accepting the new language`
  );

  const ids = new Set();
  notes.forEach((note, noteIndex) => {
    assert.ok(!ids.has(note.id), `${track.id} repeats pace-note id ${note.id}`);
    ids.add(note.id);
    assert.ok(note.groups.length >= 1 && note.groups.length <= 2, `${note.id} must remain a short, actionable phrase`);
    assert.ok(paceNoteDuration(note.groups) < 1.2, `${note.id} is too long to finish before the next driving decision`);

    const firstGeometry = note.geometry.groups[0].geometry;
    const fastLead = forwardDistance(
      runtime.trackLength,
      note.triggerStart * runtime.trackLength,
      firstGeometry.startDistance
    );
    const slowLead = forwardDistance(
      runtime.trackLength,
      note.triggerEnd * runtime.trackLength,
      firstGeometry.startDistance
    );
    assert.ok(fastLead > slowLead, `${note.id} must play earlier for a faster car`);
    assert.ok(fastLead >= 110 && fastLead <= 230, `${note.id} fast lead ${fastLead.toFixed(1)} m is unsafe or distracting`);
    assert.ok(slowLead >= 45 && slowLead <= 120, `${note.id} slow lead ${slowLead.toFixed(1)} m is unsafe or distracting`);
    assert.ok(Math.abs(fastLead - note.geometry.fastLeadMetres) < 1.5, `${note.id} fast trigger drifted from its generated distance`);
    assert.ok(Math.abs(slowLead - note.geometry.slowLeadMetres) < 1.5, `${note.id} slow trigger drifted from its generated distance`);

    note.geometry.groups.forEach((group, groupIndex) => {
      const geometry = group.geometry;
      const anchorDelta = circularProgressDistance(geometry.anchorProgress, geometry.peakProgress);
      assert.ok(anchorDelta <= 0.025, `${note.id} group ${groupIndex + 1} anchor missed its curvature peak by ${anchorDelta.toFixed(3)}`);
      assert.ok(geometry.peakCurvature >= 0.0025, `${note.id} group ${groupIndex + 1} is anchored to an almost straight road section`);
      assert.equal(group.direction, Math.sign(geometry.turnAngleRadians), `${note.id} group ${groupIndex + 1} direction disagrees with route geometry`);
      if (group.overrideReason) assert.ok(group.overrideReason.length >= 24, `${note.id} group ${groupIndex + 1} needs a useful override explanation`);
    });

    if (noteIndex > 0) {
      const previous = notes[noteIndex - 1];
      const spacing = forwardDistance(
        runtime.trackLength,
        previous.geometry.groups.at(-1).geometry.peakDistance,
        firstGeometry.peakDistance
      );
      assert.ok(spacing >= 18, `${previous.id} and ${note.id} describe the same physical apex twice`);
    }
  });

  console.log(`${track.id}: ${notes.map((note) => `${note.id} ${note.groups.map(groupLabel).join(' → ')}`).join(' | ')}`);
}

for (const stage of TRAINING_STAGES) {
  const calibration = TRAINING_CALIBRATION[stage.id] || [];
  if (!stage.notes.length) {
    assert.equal(calibration.length, 0);
    continue;
  }

  const samples = sampleTrainingStage(stage);
  const groupedNotes = groupTrainingNotes(stage);
  assert.equal(groupedNotes.length, calibration.length, `${stage.id} needs one QA calibration entry per phrase`);

  groupedNotes.forEach((note, noteIndex) => {
    const expected = calibration[noteIndex];
    assert.equal(note.progress, expected.cueProgress, `${stage.id} cue timing changed without recalibration`);
    assert.deepEqual(note.groups.map(groupLabel), expected.labels, `${stage.id} teaching phrase changed`);
    assert.ok(expected.reason.length >= 40, `${stage.id} pedagogical override needs a clear reason`);
    assert.equal(expected.anchors.length, note.groups.length, `${stage.id} needs one geometry anchor per group`);

    expected.anchors.forEach((anchor, groupIndex) => {
      const measured = measureCurveAtProgress(samples, anchor, { closed: false });
      const authored = note.groups[groupIndex];
      assert.equal(authored.direction, measured.direction, `${stage.id} group ${groupIndex + 1} is in the wrong semantic direction`);
      const lead = forwardDistance(routeLength(samples), note.progress * routeLength(samples), measured.startDistance);
      assert.ok(lead >= 35 && lead <= 260, `${stage.id} group ${groupIndex + 1} cue lead ${lead.toFixed(1)} m is implausible`);
    });
  });
}

console.log('TURN strict all-track and Drive By Ear 101 pace-note geometry audit passed.');

function groupLabel(group) {
  const side = Number(group.direction) < 0 ? 'L' : 'R';
  const length = group.length || (group.long ? 'long' : 'short');
  return `${side}${group.severity}/${length}`;
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
  stage.notes.forEach((entry) => {
    const key = Number(entry.progress).toFixed(6);
    const existing = grouped.get(key) || { progress: entry.progress, groups: [] };
    existing.groups.push(entry);
    grouped.set(key, existing);
  });
  return [...grouped.values()];
}

function routeLength(samples) {
  let length = 0;
  for (let index = 1; index < samples.length; index += 1) {
    length += samples[index].point.distanceTo(samples[index - 1].point);
  }
  return length;
}

function forwardDistance(trackLength, from, to) {
  return ((to - from) % trackLength + trackLength) % trackLength;
}

function circularProgressDistance(a, b) {
  const direct = Math.abs(a - b);
  return Math.min(direct, 1 - direct);
}
