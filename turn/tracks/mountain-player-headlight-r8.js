import { installNightPlayerSpotlight } from './night-player-spotlight-r560.js?revision=r174-night-headlight-tune';

// Keep the MOUNTAIN-facing API stable while using the exact same physical
// spotlight rig and configuration as MIDNIGHT CITY.
export function installMountainSpotlightHeadlight(playerCar, runtime) {
  return installNightPlayerSpotlight(playerCar, runtime);
}
