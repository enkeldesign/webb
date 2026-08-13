import { NOTE_TIE } from './note-ties.js?revision=r186-note-ties';

export function tieRunLength(sequence, step) {
  if (!sequence?.[step] || sequence[step] === NOTE_TIE) return 0;
  let length = 1;
  while (step + length < sequence.length && sequence[step + length] === NOTE_TIE) length += 1;
  return length;
}

export function isTie(token) {
  return token === NOTE_TIE;
}
