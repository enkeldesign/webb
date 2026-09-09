// Authored track pictograms shared by Achievements, Trophy Road and The Lot.
// The SVG files stay as the canonical artwork; these mask instances let every
// surface inherit its existing currentColor without duplicating path geometry.

export const TRACK_ICON_ASSETS = Object.freeze({
  countryside: '/turn/assets/trophy-road/countryside.svg',
  airport: '/turn/assets/trophy-road/airport.svg',
  cliffside: '/turn/assets/trophy-road/cliffside.svg',
  harbor: '/turn/assets/trophy-road/harbor.svg',
  'midnight-city': '/turn/assets/trophy-road/midnight-city.svg',
  mountain: '/turn/assets/trophy-road/mountain.svg'
});

function maskMarkup(asset) {
  return `<span aria-hidden="true" style="display:block;width:100%;height:100%;background:currentColor;-webkit-mask:url('${asset}') center / contain no-repeat;mask:url('${asset}') center / contain no-repeat"></span>`;
}

export const TRACK_ICON_MARKUP = Object.freeze(Object.fromEntries(
  Object.entries(TRACK_ICON_ASSETS).map(([trackId, asset]) => [trackId, maskMarkup(asset)])
));

export function trackIconMarkup(trackId) {
  return TRACK_ICON_MARKUP[trackId] || '';
}
