export const PACE_NOTE_EAR_POLARITY = -1;
export const PACE_NOTE_PAN_AMOUNT = 0.96;

// Pace-note data always uses semantic road direction: -1 left, +1 right.
// Physical landscape-device testing established that TURN's current audio output
// requires the opposite panner sign. Keeping that calibration here prevents every
// track and tutorial from independently learning or reintroducing the inversion.
export function paceNotePan(direction, amount = PACE_NOTE_PAN_AMOUNT) {
  const semanticDirection = Math.sign(Number(direction) || 0);
  const panAmount = Math.min(1, Math.max(0, Math.abs(Number(amount) || 0)));
  return semanticDirection * PACE_NOTE_EAR_POLARITY * panAmount;
}
