import {
  VEHICLE_SHIFT_STAT_FIELDS,
  blockedVehicleShiftReceivers,
  requiredVehicleShiftReceivers,
  shiftedVehicleStatsFromReceivers,
  vehicleStatsSupportShift
} from '../vehicle/shift-profile.js?revision=r232-double-shift';

export const VEHICLE_SHIFT_LEVER_STATES = Object.freeze({
  GAIN: 'gain',
  NEUTRAL: 'neutral',
  LOSS: 'loss'
});

function normalizedReceiverSelection(stats, receivingStats, shiftAmount) {
  const required = new Set(requiredVehicleShiftReceivers(stats, shiftAmount));
  const blocked = new Set(blockedVehicleShiftReceivers(stats, shiftAmount));
  const selected = new Set(required);

  for (const key of Array.isArray(receivingStats) ? receivingStats : []) {
    if (blocked.has(key) || selected.size >= 3) continue;
    if (VEHICLE_SHIFT_STAT_FIELDS.some((field) => field.key === key)) selected.add(key);
  }

  return { required, blocked, selected };
}

export function resolveVehicleShiftGearbox(stats, receivingStats = [], shiftAmount = 1) {
  if (!vehicleStatsSupportShift(stats)) return null;

  const amount = Number(shiftAmount) === 2 ? 2 : 1;
  const { required, blocked, selected } = normalizedReceiverSelection(stats, receivingStats, amount);
  const selectedReceivers = Object.freeze(
    VEHICLE_SHIFT_STAT_FIELDS
      .map(({ key }) => key)
      .filter((key) => selected.has(key))
  );
  const complete = selectedReceivers.length === 3;
  const shiftedStats = complete
    ? shiftedVehicleStatsFromReceivers(stats, selectedReceivers, amount)
    : null;

  const levers = VEHICLE_SHIFT_STAT_FIELDS.map((field) => {
    const baseValue = Number(stats[field.key]);
    const selectedToGain = selected.has(field.key);
    const forcedToGain = required.has(field.key);
    const forcedToLose = blocked.has(field.key);
    const automaticallyLoses = complete && !selectedToGain && !forcedToLose;
    const state = selectedToGain
      ? VEHICLE_SHIFT_LEVER_STATES.GAIN
      : forcedToLose || complete
        ? VEHICLE_SHIFT_LEVER_STATES.LOSS
        : VEHICLE_SHIFT_LEVER_STATES.NEUTRAL;
    const change = state === VEHICLE_SHIFT_LEVER_STATES.GAIN
      ? amount
      : state === VEHICLE_SHIFT_LEVER_STATES.LOSS
        ? -amount
        : 0;
    const shiftedValue = baseValue + change;
    const forced = forcedToGain || forcedToLose;
    const interactive = !forced && (!complete || selectedToGain);

    return Object.freeze({
      ...field,
      state,
      baseValue,
      shiftedValue,
      displayValue: complete || state === VEHICLE_SHIFT_LEVER_STATES.NEUTRAL
        ? String(shiftedValue)
        : `${baseValue}→${shiftedValue}`,
      selectedToGain,
      forced,
      automaticallyLoses,
      interactive
    });
  });

  return Object.freeze({
    complete: Boolean(complete && shiftedStats),
    shiftAmount: amount,
    selectedReceivers,
    shiftedStats,
    levers: Object.freeze(levers)
  });
}
