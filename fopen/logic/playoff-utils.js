(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.PlayoffUtils = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function computeGoalDiff(entry) {
    return (entry?.goalsFor || 0) - (entry?.goalsAgainst || 0);
  }

  function compareBestOfEntries(a, b, sortBy) {
    for (const criterion of sortBy || []) {
      if (criterion === 'points') {
        const diff = (b.points || 0) - (a.points || 0);
        if (diff !== 0) return diff;
      }
      if (criterion === 'goalDiff') {
        const diff = computeGoalDiff(b) - computeGoalDiff(a);
        if (diff !== 0) return diff;
      }
      if (criterion === 'goalsFor') {
        const diff = (b.goalsFor || 0) - (a.goalsFor || 0);
        if (diff !== 0) return diff;
      }
      if (criterion === 'fairPlay') {
        const diff = (a.fairPlay || 0) - (b.fairPlay || 0);
        if (diff !== 0) return diff;
      }
      if (criterion === 'stableSeed') {
        const diff = String(a.stableSeed).localeCompare(String(b.stableSeed), 'sv');
        if (diff !== 0) return diff;
      }
    }

    return String(a.team || '').localeCompare(String(b.team || ''), 'sv');
  }

  function resolveBestOfSeed(seedDef, rankedStatsByGroup) {
    const fromBestOf = seedDef?.fromBestOf;
    if (!fromBestOf) return null;
    const candidates = [];
    const groups = fromBestOf.groups || [];
    for (const groupLabel of groups) {
      const ranked = rankedStatsByGroup[groupLabel] || [];
      const idx = (fromBestOf.rank || 1) - 1;
      const teamStats = ranked[idx];
      if (teamStats) {
        candidates.push({ ...teamStats, stableSeed: `${groupLabel}${fromBestOf.rank}` });
      }
    }

    candidates.sort((a, b) => compareBestOfEntries(a, b, fromBestOf.sortBy || []));
    const pickIndex = (fromBestOf.pick || 1) - 1;
    return candidates[pickIndex] ? candidates[pickIndex].team : null;
  }

  function resolveSeedToTeam(seed, playoffSeeds, rankedStatsByGroup) {
    if (typeof seed !== 'string') return null;
    const seedDef = playoffSeeds?.[seed];
    if (seedDef?.from) {
      const groupLabel = seedDef.from.group;
      const idx = seedDef.from.rank - 1;
      return rankedStatsByGroup[groupLabel]?.[idx]?.team || null;
    }

    if (seedDef?.fromBestOf) {
      return resolveBestOfSeed(seedDef, rankedStatsByGroup);
    }

    if (/^[A-Z][0-9]+$/.test(seed)) {
      const groupLabel = seed.charAt(0);
      const idx = parseInt(seed.slice(1), 10) - 1;
      return rankedStatsByGroup[groupLabel]?.[idx]?.team || null;
    }

    return null;
  }

  function collectSpecialPlayoffFormats(ruleset) {
    const flagged = [];
    for (const format of ruleset.formats || []) {
      const seeds = format.playoffs?.seeds || {};
      const fromBestOfSeeds = Object.keys(seeds).filter((seedName) => Boolean(seeds[seedName]?.fromBestOf));
      if (fromBestOfSeeds.length || Array.isArray(format.playoffs?.groupPlayoffs)) {
        flagged.push({
          participants: format.participants,
          fromBestOfSeeds,
          hasGroupPlayoffs: Array.isArray(format.playoffs?.groupPlayoffs)
        });
      }
    }
    return flagged;
  }

  return {
    collectSpecialPlayoffFormats,
    compareBestOfEntries,
    resolveSeedToTeam
  };
});
