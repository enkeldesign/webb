import assert from 'node:assert/strict';
import { ACHIEVEMENTS, ACHIEVEMENT_FAMILIES, TRACK_IDS } from '../turn/achievements/catalog.js';
import { achievementGroups, completedAchievementFamily } from '../turn/achievements/families.js';

const groups = achievementGroups(ACHIEVEMENTS);
assert.equal(groups.flatMap(({ master, children }) => [master, ...children]).length, ACHIEVEMENTS.length);
assert.equal(new Set(groups.flatMap(({ master, children }) => [master.id, ...children.map(({ id }) => id)])).size, ACHIEVEMENTS.length);
for (const family of ACHIEVEMENT_FAMILIES) {
  const earned = new Set(family.childIds);
  assert.equal(completedAchievementFamily(family, (id) => earned.has(id)), false, 'Children alone do not collapse');
  earned.add(family.masterId);
  assert.equal(completedAchievementFamily(family, (id) => earned.has(id)), true, 'A complete earned collection collapses');
  earned.delete(family.childIds[0]);
  assert.equal(completedAchievementFamily(family, (id) => earned.has(id)), false, 'A new/missing child keeps the collection visible');
  if (family.masterId !== 'emergency-master') assert.equal(family.childIds.length % TRACK_IDS.length, 0, 'Production families follow current track count');
}
const syntheticChildren = Array.from({ length: 13 }, (_, index) => ({ id: `track-${index}` }));
const family = { masterId: 'master', label: 'SPRINT', childIds: syntheticChildren.map(({ id }) => id) };
const synthetic = achievementGroups([...syntheticChildren, { id: 'master' }], [family]);
assert.equal(synthetic.length, 1);
assert.equal(synthetic[0].children.length, 13, 'No eight-track ceiling');
assert.equal(synthetic[0].master.id, 'master', 'The master precedes its children even if last in catalog');
console.log('Achievement families: complete/partial collections, canonical membership, exact counts and >8 tracks pass.');
