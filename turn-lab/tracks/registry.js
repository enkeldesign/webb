// TURN LAB registry overlay. Production owns every track runtime except the
// internal MOUNTAIN slot, which LAB repurposes as SUBURBS.
import * as production from '/turn/tracks/registry.js?lab-base=suburbs';

export const TRACK_RUNTIME_REGISTRY = Object.freeze(production.TRACK_RUNTIME_REGISTRY.map((entry) => {
  if (entry.id !== 'mountain') return entry;
  return Object.freeze({
    ...entry,
    async installWorld({ scene, samples, trackWidth, runtime }) {
      const { installSuburbsWorld } = await import('/turn-lab/tracks/suburbs-world.js');
      return installSuburbsWorld({ scene, samples, trackWidth, runtime });
    }
  });
}));

export function getTrackRuntimeEntry(trackId) {
  const productionEntry = production.getTrackRuntimeEntry(trackId);
  return TRACK_RUNTIME_REGISTRY.find((entry) => entry.id === productionEntry.id)
    || TRACK_RUNTIME_REGISTRY[0];
}
