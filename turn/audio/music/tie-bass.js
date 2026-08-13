import { BASS_VOICES } from './bass-voices.js?revision=r184-score-v2';
import { captureTieTone } from './tie-tone-capture.js?revision=r186-note-ties';

export function tiedBass(base, ties, getStepSeconds) {
  return (note, time, voice = 'warm') => {
    if (note === '=') { ties.extend('bass', time); return; }
    const before = new Set(base.graphs.keys());
    base.playBass(note, time, voice);
    if (!note) return;
    const preset = BASS_VOICES[voice] || BASS_VOICES.warm;
    const state = captureTieTone(base, before, time, preset, getStepSeconds());
    if (state) ties.remember('bass', state);
  };
}
