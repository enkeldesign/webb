import { LEAD_VOICES } from './lead-voices.js?revision=r184-score-v2';
import { captureTieTone } from './tie-tone-capture.js?revision=r186-note-ties';

export function tiedLead(base, ties, getStepSeconds) {
  return (note, time, voice = 'lead') => {
    if (note === '=') { ties.extend('lead', time); return; }
    const before = new Set(base.graphs.keys());
    base.playLead(note, time, voice);
    if (!note) return;
    const preset = LEAD_VOICES[voice === 'flute' ? 'picked' : voice] || LEAD_VOICES.lead;
    const state = captureTieTone(base, before, time, preset, getStepSeconds());
    if (state) ties.remember('lead', state);
  };
}
