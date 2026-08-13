import { ARP_VOICES } from './arp-voices.js?revision=r184-score-v2';
import { captureTieTone } from './tie-tone-capture.js?revision=r186-note-ties';

export function tiedArp(base, ties, getStepSeconds) {
  return (event, time, voice = 'soft') => {
    const tied = event && typeof event === 'object' ? event : null;
    const note = tied ? tied.note : event;
    const before = new Set(base.graphs.keys());
    base.playArp(note, time, voice);
    if (!note) return;
    const preset = ARP_VOICES[voice] || ARP_VOICES.soft;
    const state = captureTieTone(base, before, time, preset, getStepSeconds());
    if (!state) return;
    ties.remember('arp', state);
    if (tied && tied.heldSteps > 1) ties.sustain('arp', time, tied.heldSteps);
  };
}
