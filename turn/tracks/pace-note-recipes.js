const group = (progress, options = {}) => Object.freeze({
  progress,
  searchMetres: options.searchMetres,
  severity: options.severity,
  length: options.length,
  reason: options.reason
});

const note = (id, groups, options = {}) => Object.freeze({
  id,
  groups: Object.freeze(groups),
  fastLeadMetres: options.fastLeadMetres,
  slowLeadMetres: options.slowLeadMetres
});

// Recipes identify the road features that deserve a spoken pace phrase. Direction,
// tightness, duration and trigger windows are derived from the sampled route. The
// rare overrides below are limited to instructional or compound corners and require
// a human-readable reason so they cannot silently become another hand-authored map.
export const TRACK_PACE_NOTE_RECIPES = Object.freeze({
  countryside: Object.freeze([
    note('countryside-1', [group(0.992)]),
    note('countryside-2', [group(0.390)]),
    note('countryside-3', [group(0.508)]),
    note('countryside-4', [group(0.672)])
  ]),

  airport: Object.freeze([
    note('airport-1', [group(0.999)]),
    note('airport-2', [group(0.317)]),
    note('airport-3', [group(0.549), group(0.640)]),
    note('airport-4', [group(0.717)])
  ]),

  cliffside: Object.freeze([
    note('cliffside-1', [group(0.061)]),
    note('cliffside-2', [group(0.200)]),
    note('cliffside-3', [group(0.499)]),
    note('cliffside-4', [group(0.612), group(0.662)]),
    note('cliffside-5', [group(0.892)])
  ]),

  harbor: Object.freeze([
    note('harbor-1', [group(0.989)]),
    note('harbor-2', [group(0.224)]),
    note('harbor-3', [group(0.446)]),
    note('harbor-4', [group(0.647)]),
    note('harbor-5', [group(0.803)])
  ]),

  'midnight-city': Object.freeze([
    note('midnight-city-1', [group(0.142)]),
    note('midnight-city-2', [group(0.179)]),
    note('midnight-city-3', [group(0.267), group(0.290)]),
    note('midnight-city-4', [
      group(0.365, {
        searchMetres: 18,
        severity: 2,
        length: 'medium',
        reason: 'The first section introduces a tightening city hairpin before its sharper apex.'
      }),
      group(0.392, {
        searchMetres: 18,
        severity: 3,
        length: 'long',
        reason: 'The same hairpin tightens and continues after the first section.'
      })
    ]),
    note('midnight-city-5', [group(0.480)]),
    note('midnight-city-6', [group(0.516)]),
    note('midnight-city-7', [
      group(0.633, {
        searchMetres: 18,
        severity: 2,
        length: 'long',
        reason: 'The broad first section flows directly into a tighter section of the same left curve.'
      }),
      group(0.665, {
        searchMetres: 18,
        severity: 3,
        length: 'medium',
        reason: 'The left curve tightens near its apex.'
      })
    ]),
    note('midnight-city-8', [group(0.748), group(0.778)]),
    note('midnight-city-9', [
      group(0.834, {
        searchMetres: 18,
        severity: 2,
        reason: 'The first section is deliberately announced separately before the tightening apex.'
      }),
      group(0.866, {
        searchMetres: 18,
        severity: 3,
        reason: 'The second section tightens immediately after the first.'
      })
    ]),
    note('midnight-city-10', [group(0.934)]),
    note('midnight-city-11', [group(0.995)])
  ])
});

export const EMPTY_PACE_NOTE_RECIPES = Object.freeze([]);

export function getTrackPaceNoteRecipes(trackId) {
  return TRACK_PACE_NOTE_RECIPES[String(trackId || '').toLowerCase()] || EMPTY_PACE_NOTE_RECIPES;
}

export function validatePaceNoteRecipes(recipes = TRACK_PACE_NOTE_RECIPES) {
  const issues = [];
  for (const [trackId, trackRecipes] of Object.entries(recipes)) {
    const ids = new Set();
    trackRecipes.forEach((recipe, noteIndex) => {
      if (!recipe.id || ids.has(recipe.id)) issues.push(`${trackId} note ${noteIndex + 1} has a missing or duplicate id`);
      ids.add(recipe.id);
      if (!recipe.groups.length) issues.push(`${recipe.id} has no curve groups`);
      recipe.groups.forEach((curve, groupIndex) => {
        if (!(Number(curve.progress) >= 0 && Number(curve.progress) < 1)) {
          issues.push(`${recipe.id} group ${groupIndex + 1} has an invalid progress anchor`);
        }
        const overrides = curve.severity != null || curve.length != null;
        if (overrides && !String(curve.reason || '').trim()) {
          issues.push(`${recipe.id} group ${groupIndex + 1} overrides geometry without a reason`);
        }
      });
    });
  }
  return Object.freeze(issues);
}
