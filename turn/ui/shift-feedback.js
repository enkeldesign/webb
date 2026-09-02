import {
  VEHICLE_SHIFT_STAT_FIELDS,
  vehicleShiftReceiversForReducers
} from '../vehicle/shift-profile.js?revision=r227-shift-feedback';

function canonicalKeys(keys) {
  const requested = new Set(Array.isArray(keys) ? keys : []);
  return VEHICLE_SHIFT_STAT_FIELDS
    .map(({ key }) => key)
    .filter((key) => requested.has(key));
}

function naturalList(items) {
  if (items.length < 2) return items[0] || '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items.at(-1)}`;
}

export function resolveVehicleShiftFeedback(profile, active) {
  const reducers = canonicalKeys(profile?.reducedStats);
  if (reducers.length !== 3) return null;

  const gainKeys = active
    ? canonicalKeys(vehicleShiftReceiversForReducers(reducers))
    : reducers;
  if (gainKeys.length !== 3) return null;

  const fields = gainKeys.map((key) =>
    VEHICLE_SHIFT_STAT_FIELDS.find((field) => field.key === key)
  );
  const labels = fields.map(({ label }) => label);
  const spokenLabels = labels.map((label, index) => {
    const spoken = label.toLowerCase();
    return index === 0 ? `${spoken.charAt(0).toUpperCase()}${spoken.slice(1)}` : spoken;
  });
  const activeState = active === true;
  const stateAnnouncement = activeState ? 'SHIFT on.' : 'SHIFT off.';

  return Object.freeze({
    active: activeState,
    title: 'SHIFT',
    gainKeys: Object.freeze(gainKeys),
    labels: Object.freeze(labels),
    briefAnnouncement: stateAnnouncement,
    announcement: `${stateAnnouncement} ${naturalList(spokenLabels)} gain one point.`
  });
}
