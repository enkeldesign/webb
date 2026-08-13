import { ARP_VOICES } from './arp-voices.js?revision=r184-score-v2';
import { captureTieTone } from './tie-tone-capture.js?revision=r186-note-ties';

export function tiedArp(base, ties, getStepSeconds) {
  return (note, time, voice = 'soft') => {
    if (note === '=') { ties.extend('arp', time); return; }
    const before = new Set(base.graphs.keys());
    base.playArp(note, time, voice);
    if (!note) return;
    const preset = ARP_VOICES[voice] || ARP_VOICES.soft;
    const state = captureTieTone(base, before, time, preset, getStepSeconds());
    if (state) ties.remember('arp', state);
  };
}
