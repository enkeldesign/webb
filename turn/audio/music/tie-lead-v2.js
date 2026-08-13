import { LEAD_VOICES } from './lead-voices.js?revision=r184-score-v2';
import { captureTieTone } from './tie-tone-capture.js?revision=r186-note-ties';

export function tiedLead(base, ties, getStepSeconds) {
  return (event, time, voice = 'lead') => {
    const tied = event && typeof event === 'object' ? event : null;
    const note = tied ? tied.note : event;
    const before = new Set(base.graphs.keys());
    base.playLead(note, time, voice);
    if (!note) return;
    const preset = LEAD_VOICES[voice === 'flute' ? 'picked' : voice] || LEAD_VOICES.lead;
    const state = captureTieTone(base, before, time, preset, getStepSeconds());
    if (!state) return;
    ties.remember('lead', state);
    if (tied && tied.heldSteps > 1) ties.sustain('lead', time, tied.heldSteps);
  };
}
