import { MENU_SONG } from './menu-theme.js?revision=r194-user-scores';
import { COUNTRYSIDE_SONG } from './countryside.js?revision=r194-user-scores';
import { AIRPORT_SONG } from './airport.js?revision=r194-user-scores';
import { CLIFFSIDE_SONG } from './cliffside.js?revision=r194-user-scores';
import { HARBOR_SONG } from './harbor.js?revision=r194-user-scores';
import { MIDNIGHT_CITY_SONG } from './midnight-city.js?revision=r194-user-scores';

export { MENU_SONG };

export const TRACK_SONGS = Object.freeze({
  countryside: COUNTRYSIDE_SONG,
  airport: AIRPORT_SONG,
  cliffside: CLIFFSIDE_SONG,
  harbor: HARBOR_SONG,
  'midnight-city': MIDNIGHT_CITY_SONG
});

export const SONGBOOK = Object.freeze([
  MENU_SONG,
  COUNTRYSIDE_SONG,
  AIRPORT_SONG,
  CLIFFSIDE_SONG,
  HARBOR_SONG,
  MIDNIGHT_CITY_SONG
]);

export function songForTrack(trackId) {
  return TRACK_SONGS[trackId] || COUNTRYSIDE_SONG;
}
