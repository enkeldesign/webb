import { createToneRuntime as createBaseToneRuntime } from './tone-runtime.js?revision=r184-score-v2-base';
import { createTieToneController } from './tie-tone-controller.js?revision=r186-note-ties';
import { tiedLead } from './tie-lead-v2.js?revision=r186-note-ties';
import { tiedBass } from './tie-bass-v2.js?revision=r186-note-ties';
import { tiedArp } from './tie-arp-v2.js?revision=r186-note-ties';

export function createToneRuntime(options) {
  const base = createBaseToneRuntime(options);
  const ties = createTieToneController(options);
  return Object.freeze({
    playLead: tiedLead(base, ties, options.getStepSeconds),
    playBass: tiedBass(base, ties, options.getStepSeconds),
    playArp: tiedArp(base, ties, options.getStepSeconds),
    stop() { ties.clear(); base.stop(); },
    sources: base.sources,
    graphs: base.graphs
  });
}
