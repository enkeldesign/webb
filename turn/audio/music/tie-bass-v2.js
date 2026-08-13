import { BASS_VOICES } from './bass-voices.js?revision=r184-score-v2';
import { captureTieTone } from './tie-tone-capture.js?revision=r186-note-ties';

export function tiedBass(base, ties, getStepSeconds) {
  return (event, time, voice = 'warm') => {
    const tied = event && typeof event === 'object' ? event : null;
    const note = tied ? tied.note : event;
    const before = new Set(base.graphs.keys());
    base.playBass(note, time, voice);
    if (!note) return;
    const preset = BASS_VOICES[voice] || BASS_VOICES.warm;
    const state = captureTieTone(base, before, time, preset, getStepSeconds());
    if (!state) return;
    ties.remember('bass', state);
    if (tied && tied.heldSteps > 1) ties.sustain('bass', time, tied.gateFactor || tied.heldSteps);
  };
}
