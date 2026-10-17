import { TROPHY_ROAD_REWARD_ICONS } from '../progression/trophy-road.js';

// Corner marks (#1230): a sheet, dialog or panel about one feature shows that feature's
// Trophy Road icon in the top-right corner of its content, as the Track sheet shows its
// track. The same artwork everywhere, drawn in the text colour, and hidden from assistive
// technology: the title names the feature. A feature without an icon shows none. Buttons
// stay words. Styles: surfaces.css.
export function cornerMarkMarkup(icon) {
  const markup = TROPHY_ROAD_REWARD_ICONS[icon];
  return markup ? `<span class="turn-corner-mark" aria-hidden="true">${markup}</span>` : '';
}
