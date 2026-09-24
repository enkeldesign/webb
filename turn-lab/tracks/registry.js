// TURN LAB registry overlay. Both experimental tracks are offered simultaneously:
// MOUNTAIN -> DEAD CANYON, CLIFFSIDE -> SUBURBS.
import * as production from '/turn/tracks/registry.js?lab-base=dead-canyon-suburbs';

export const TRACK_RUNTIME_REGISTRY = Object.freeze(production.TRACK_RUNTIME_REGISTRY.map((entry) => {
  if (entry.id === 'mountain') {
    return Object.freeze({
      ...entry,
      async installWorld({ scene, samples, trackWidth, runtime }) {
        const { installDeadCanyonWorld } = await import('/turn-lab/tracks/dead-canyon-world.js');
        return installDeadCanyonWorld({ scene, samples, trackWidth, runtime });
      }
    });
  }

  if (entry.id === 'cliffside') {
    return Object.freeze({
      ...entry,
      async installWorld({ scene, samples, trackWidth, runtime }) {
        const { installSuburbsWorld } = await import('/turn-lab/tracks/suburbs-world.js');
        return installSuburbsWorld({ scene, samples, trackWidth, runtime });
      }
    });
  }

  return entry;
}));

export function getTrackRuntimeEntry(trackId) {
  const productionEntry = production.getTrackRuntimeEntry(trackId);
  return TRACK_RUNTIME_REGISTRY.find((entry) => entry.id === productionEntry.id)
    || TRACK_RUNTIME_REGISTRY[0];
}
