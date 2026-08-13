import { createToneRuntime as createBaseToneRuntime } from './tone-runtime.js?revision=r184-score-v2';
import { LEAD_VOICES, BASS_VOICES, ARP_VOICES } from './instrument-bank.js?revision=r184-score-v2';
import { createTieToneController } from './tie-tone-controller.js?revision=r186-note-ties';
import { captureTieTone } from './tie-tone-capture.js?revision=r186-note-ties';

export function createToneRuntime(options) {
  const base = createBaseToneRuntime(options);
  const ties = createTieToneController(options);

  function wrap(lane, library, fallback, play, aliasFlute = false) {
    return { lane, library, fallback, play, aliasFlute };
  }

  void wrap; void LEAD_VOICES; void BASS_VOICES; void ARP_VOICES; void captureTieTone; void ties;
  return base;
}
