// GARAGE selection model. Three things stay separate:
//
// - the saved last-used car: whatever the game will race by default. GARAGE never
//   writes it; the race start does, as it always has;
// - the current choice: the playable car (and paint) the player has picked in this
//   visit. RACE starts it;
// - a locked preview: a car the player is only looking at. It is never the choice,
//   never saved and never raced; leaving it returns to the choice.
//
// Example: enter with AWD, choose Van, look at locked Monster Truck, leave the
// preview: the choice is Van again, and AWD stays saved until a race starts.
//
// Pure data: the caller supplies the car order, the lock test and each car's paint.

export function createGarageSelection({
  order,
  initial,
  fallbackCarId,
  isLocked,
  paintFor
}) {
  if (!Array.isArray(order) || !order.length) throw new Error('GARAGE needs a car order.');
  const known = (carId) => order.includes(carId);
  const playable = (carId) => known(carId) && !isLocked(carId);

  function paintedChoice(carId, paint = paintFor(carId)) {
    return Object.freeze({ carId, color: paint.color, secondaryColor: paint.secondaryColor });
  }

  // A saved car that is unknown or locked (a reset profile, a removed car) falls
  // back to the established starter.
  let choice = playable(initial?.carId)
    ? paintedChoice(initial.carId, {
      color: initial.color ?? paintFor(initial.carId).color,
      secondaryColor: initial.secondaryColor ?? paintFor(initial.carId).secondaryColor
    })
    : paintedChoice(playable(fallbackCarId) ? fallbackCarId : order.find(playable) || order[0]);
  let preview = null;

  function viewedCarId() {
    return preview || choice.carId;
  }

  // Show a car: a playable one becomes the choice, a locked one is only previewed.
  function view(carId) {
    if (!known(carId)) return state();
    if (isLocked(carId)) {
      preview = carId === choice.carId ? null : carId;
    } else {
      preview = null;
      if (carId !== choice.carId) choice = paintedChoice(carId);
    }
    return state();
  }

  function step(direction) {
    const index = order.indexOf(viewedCarId());
    const next = order[(index + direction + order.length) % order.length];
    return view(next);
  }

  function leavePreview() {
    preview = null;
    return state();
  }

  // Paint belongs to the choice; a preview has none to change.
  function paint({ color, secondaryColor }) {
    if (preview) return state();
    choice = Object.freeze({
      carId: choice.carId,
      color: color ?? choice.color,
      secondaryColor: secondaryColor ?? choice.secondaryColor
    });
    return state();
  }

  // Trophy Road moved on while GARAGE was open: a preview that became playable is now
  // simply the choice.
  function refreshLocks() {
    if (preview && !isLocked(preview)) {
      choice = paintedChoice(preview);
      preview = null;
    }
    if (isLocked(choice.carId)) choice = paintedChoice(order.find(playable) || order[0]);
    return state();
  }

  function state() {
    return Object.freeze({
      viewedCarId: viewedCarId(),
      choice,
      preview,
      raceable: preview === null && playable(choice.carId)
    });
  }

  return Object.freeze({ view, step, leavePreview, paint, refreshLocks, state });
}
