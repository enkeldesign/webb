// TURN LAB registry overlay. Production owns every track runtime except the
// internal MOUNTAIN slot, which LAB repurposes as DEAD CANYON.
import * as production from '/turn/tracks/registry.js?lab-base=dead-canyon-r1';

export const TRACK_RUNTIME_REGISTRY = Object.freeze(production.TRACK_RUNTIME_REGISTRY.map((entry) => {
  if (entry.id !== 'mountain') return entry;
  return Object.freeze({
    ...entry,
    async installWorld({ scene, samples, trackWidth, runtime }) {
      const { installDeadCanyonWorld } = await import('/turn-lab/tracks/dead-canyon-world.js');
      return installDeadCanyonWorld({ scene, samples, trackWidth, runtime });
    }
  });
}));

export function getTrackRuntimeEntry(trackId) {
  const productionEntry = production.getTrackRuntimeEntry(trackId);
  return TRACK_RUNTIME_REGISTRY.find((entry) => entry.id === productionEntry.id)
    || TRACK_RUNTIME_REGISTRY[0];
}
