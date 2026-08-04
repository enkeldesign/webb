import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import {
  getTrackPaceNoteRecipes,
  validatePaceNoteRecipes
} from '../turn/tracks/pace-note-recipes.js';

const [recipesSource, compilerSource, auditSource] = await Promise.all([
  fs.readFile(new URL('../turn/tracks/pace-note-recipes.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/pace-note-compiler.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('./pace-note-geometry-audit.mjs', import.meta.url), 'utf8')
]);

const recipes = getTrackPaceNoteRecipes('midnight-city');
assert.equal(recipes.length, 11, 'Midnight City must have eleven non-duplicated decision phrases');
assert.deepEqual(
  recipes.map((recipe) => recipe.id),
  Array.from({ length: 11 }, (_, index) => `midnight-city-${index + 1}`)
);
assert.deepEqual(
  recipes.map((recipe) => recipe.groups.length),
  [1, 1, 2, 2, 1, 1, 2, 2, 2, 1, 1],
  'Linked phrases are authored as one decision rather than overlapping standalone cues'
);
assert.deepEqual(validatePaceNoteRecipes().filter((issue) => issue.includes('midnight-city')), []);

const anchors = recipes.flatMap((recipe) => recipe.groups.map((group) => group.progress));
for (let index = 1; index < anchors.length; index += 1) {
  assert.ok(anchors[index] > anchors[index - 1], 'Midnight City anchors must follow route order with no duplicated apex');
}
assert.ok(anchors[0] > 0.1 && anchors.at(-1) > 0.9);
assert.doesNotMatch(recipesSource, /\bdirection\s*:/, 'Midnight City must not hand-author panner signs');
assert.match(recipesSource, /The first section introduces a tightening city hairpin/);
assert.match(recipesSource, /The broad first section flows directly into a tighter section/);
assert.match(compilerSource, /direction: turnAngleRadians < 0/);
assert.match(compilerSource, /classifyCurveMetrics/);
assert.match(compilerSource, /progressBeforeDistance/);
assert.match(auditSource, /'midnight-city': Object\.freeze/);
assert.match(auditSource, /direction, tightness and duration changed; inspect the route/);
assert.doesNotMatch(auditSource, /signedTurn > 0 \? RIGHT : LEFT/, 'The old inverted control-point sign heuristic must not return');

console.log('TURN Midnight City semantic recipe order, linked decisions and strict geometry QA passed.');
