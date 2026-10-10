// A car to show over the one GARAGE would otherwise open on, once GARAGE is showing:
// a support challenge's recommended car, or the SEDAN the SHIFT introduction sends
// players to (progression/unlock-introductions.js).
const VIEW_TIMEOUT_MS = 12000;

export function viewCarWhenGarageOpens(vehicleId) {
  if (!vehicleId) return false;
  const select = () => {
    const garage = globalThis.__turnGarage;
    if (!garage?.root?.isConnected) return false;
    garage.viewCar(vehicleId);
    return true;
  };
  if (select()) return true;

  const observer = new MutationObserver(() => {
    if (!select()) return;
    observer.disconnect();
    globalThis.clearTimeout(timeout);
  });
  observer.observe(document.body, { childList: true, subtree: true });
  const timeout = globalThis.setTimeout(() => observer.disconnect(), VIEW_TIMEOUT_MS);
  return true;
}
