export const NOTE_TIE = '=';

export function heldStepCount(sequence, step) {
  const note = sequence?.[step];
  if (!note || note === NOTE_TIE) return 0;
  let heldSteps = 1;
  while (step + heldSteps < sequence.length && sequence[step + heldSteps] === NOTE_TIE) heldSteps += 1;
  return heldSteps;
}
