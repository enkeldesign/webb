// HOW TO PLAY demos (#748): small copies of the race's own controls that act out what
// a card explains: a thumb sliding between the drive pad's zones, LOCK, SHIFT and REVERSE
// sliding out, DRIFT filling the BOOST bar and OVERCHARGE growing past it, RECALIBRATE
// centring the steering, and the chips that show your place among your rivals. They
// mirror the race (drive-pad.css, gameplay-v2.css, styles.css, in-game-menu.css) at the
// same sizes, in the same colour roles and with the same motion, light and dark, and
// follow the left-handed layout. The drive pad and the BOOST bar read the race's own
// values (the custom properties drive-pad.css and gameplay-v2.css declare), so they
// change when the race does. They are pictures: hidden from assistive technology,
// since the card's text says the same, and built from their own classes, so nothing
// that looks for the real controls finds them. They move only while their card is open;
// with Reduced Motion each is one still frame. SPECTATE plays the same pad and steering
// back from a recorded lap (#1217, ui/spectate-controls.js): there the race's own state
// names set the pad, and the lap's steering the knob or the phone, instead of a loop.
const STYLE_ID = 'turn-how-to-play-demo-styles';

// A score counts up as the race's does, one held value after another, each its own
// keyframe and never an interpolation: Safari does not redraw a counter while a
// registered number animates, so an interpolated count showed 0 and then a flash
// (#1189). count values reach top in equal steps from start% to end%.
function countUp(start, end, top, count) {
  return Array.from({ length: count }, (_, step) => {
    const at = Math.round((start + (end - start) * step / (count - 1)) * 100) / 100;
    return `    ${at}% { --turn-demo-score: ${Math.round(top * (step + 1) / count)}; }`;
  }).join('\n');
}

const STYLES = `
  /* BOOST's charge, 0 to 1, shared by the bar and the pad's BOOST zone. */
  @property --turn-demo-charge { syntax: '<number>'; inherits: true; initial-value: 1; }
  /* The live DRIFT or FLOW score, counted up as the race's scorekeeper does. */
  @property --turn-demo-score { syntax: '<integer>'; inherits: true; initial-value: 0; }

  /* Pictures at the race's own sizes, in px: they do not grow with the text size, so a
     label never outgrows its control. The card's text, which says the same, does. */
  .turn-demo {
    display: flex;
    justify-content: center;
    margin: 0 0 var(--turn-space-4);
    color: var(--turn-text);
    pointer-events: none;
    user-select: none;
    -webkit-user-select: none;
  }

  /* The drive pad, at the race's smallest size, with room on the left for its bubbles. */
  .turn-demo-stack {
    position: relative;
    isolation: isolate;
    width: 142.5px;
    height: 142.5px;
    margin-inline: 42px 0;
  }
  .turn-demo-pad {
    position: relative;
    z-index: 2;
    box-sizing: border-box;
    height: 100%;
    overflow: hidden;
    display: grid;
    grid-template: var(--turn-drive-pad-rows) / 1fr 1fr;
    border: var(--turn-drive-outline) solid var(--turn-outline);
    border-radius: var(--turn-drive-pad-radius);
    background: var(--turn-control-gas);
    box-shadow: var(--turn-drive-pad-shadow-x) var(--turn-drive-pad-shadow-y) 0 var(--turn-shadow-color);
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.025em;
    line-height: 1;
  }
  .turn-demo-pad > span {
    min-width: 0;
    display: grid;
    place-items: center;
  }
  .turn-demo-pad > .is-drift {
    border-right: var(--turn-drive-divider) solid var(--turn-outline);
    background-color: var(--turn-control-drift);
  }
  .turn-demo-pad > .is-boost {
    --turn-demo-boost-fill: var(--turn-control-boost);
    border-left: var(--turn-drive-divider) solid var(--turn-outline);
    background: linear-gradient(
      to top,
      var(--turn-demo-boost-fill) 0 calc(var(--turn-demo-charge) * 100%),
      var(--turn-control-boost-empty) calc(var(--turn-demo-charge) * 100%) 100%
    );
  }
  .turn-demo-pad > :is(.is-gas, .is-brake) {
    grid-column: 1 / -1;
    border-top: var(--turn-drive-outline) solid var(--turn-outline);
    background-color: var(--turn-control-gas);
  }
  .turn-demo-pad > .is-brake { background-color: var(--turn-control-brake); letter-spacing: 0.035em; }

  .turn-demo-bubble {
    position: absolute;
    z-index: 1;
    right: calc(100% - 3px);
    box-sizing: border-box;
    display: grid;
    place-items: center;
    overflow: hidden;
    border: var(--turn-drive-outline) solid var(--turn-outline);
    border-radius: var(--turn-drive-bubble-radius) 0 0 var(--turn-drive-bubble-radius);
    color: var(--turn-ink);
    font-size: 11px;
    font-weight: 950;
    letter-spacing: 0.035em;
    line-height: 1;
    opacity: 0;
    transform: var(--turn-demo-tucked);
    transform-origin: right center;
  }
  .turn-demo-bubble > b {
    display: inline-flex;
    align-items: center;
    gap: 0.32em;
    font: inherit;
    white-space: nowrap;
    transform: rotate(-90deg);
  }
  .turn-demo-bubble.is-lock > b { font-weight: 900; }
  .turn-demo-bubble.is-lock {
    top: 0;
    width: 39px;
    height: calc(32% + 4.08px);
    background-color: var(--turn-control-lock);
  }
  .turn-demo-bubble.is-shift {
    top: calc(32% + 1.08px);
    width: 43.5px;
    height: calc(44% + 0.36px);
    background-color: var(--turn-control-gas);
  }
  .turn-demo-bubble.is-shift i {
    width: 0;
    overflow: hidden;
    opacity: 0;
    font-size: 0.9em;
    font-style: normal;
  }
  .turn-demo-bubble.is-reverse > b { letter-spacing: normal; transform: none; }
  .turn-demo-bubble.is-reverse {
    bottom: 0;
    width: 39px;
    height: calc(24% + 1.56px);
    background-color: var(--turn-control-brake);
  }

  /* The thumb: an Ink ring with a Paper halo reads on every control colour, light and
     dark, and lets the zone's name show through. */
  .turn-demo-thumb {
    position: absolute;
    z-index: 3;
    left: 50%;
    top: 54%;
    width: 30px;
    height: 30px;
    margin: -15px 0 0 -15px;
    box-sizing: border-box;
    border: 3px solid var(--turn-ink);
    border-radius: 50%;
    background: color-mix(in srgb, var(--turn-paper) 22%, transparent);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--turn-paper) 70%, transparent);
  }

  /* Left-handed controls: the pad mirrors, its bubbles on the right; words stay readable. */
  :root.turn-left-handed-controls .turn-demo-stack {
    margin-inline: 0 42px;
    transform: scaleX(-1);
  }
  :root.turn-left-handed-controls .turn-demo-pad {
    box-shadow: calc(-1 * var(--turn-drive-pad-shadow-x)) var(--turn-drive-pad-shadow-y) 0 var(--turn-shadow-color);
  }
  :root.turn-left-handed-controls .turn-demo-pad > span,
  :root.turn-left-handed-controls .turn-demo-bubble.is-reverse > b { transform: scaleX(-1); }
  :root.turn-left-handed-controls .turn-demo-bubble > b { transform: scaleX(-1) rotate(-90deg); }

  /* Motion follows the race (drive-pad.css). A bubble slides out from its tuck over
     --turn-drive-bubble-slide on the pad's curve and fades in over
     --turn-drive-bubble-fade; LOCK, SHIFT and REVERSE change colour over
     --turn-drive-bubble-colour-change; a pressed zone, its ring and the pad's corner
     change at once. Each changes as the thumb crosses into or out of its zone. A
     keyframe's place in the loop cannot be a custom property, so each step is laid out
     to last as long as the race's, and how-to-play-guide-production.mjs checks it. */
  .turn-demo {
    --turn-demo-tucked: translateX(var(--turn-drive-bubble-tuck)) scaleX(var(--turn-drive-bubble-tuck-scale));
    --turn-demo-out: translateX(0) scaleX(1);
  }

  /* DRIVE, 10 s: GAS; DRIFT, out into LOCK; BOOST; GAS; BRAKE, out into REVERSE; GAS. */
  details[open] .turn-demo-stack[data-demo="drive"] .turn-demo-thumb { animation: turn-demo-drive-thumb 10s ease-in-out infinite; }
  details[open] .turn-demo-stack[data-demo="drive"] .turn-demo-pad { animation: turn-demo-drive-corners 10s steps(1, end) infinite; }
  details[open] .turn-demo-stack[data-demo="drive"] .is-gas { animation: turn-demo-drive-gas 10s steps(1, end) infinite; }
  details[open] .turn-demo-stack[data-demo="drive"] .is-drift { animation: turn-demo-drive-drift 10s steps(1, end) infinite; }
  details[open] .turn-demo-stack[data-demo="drive"] .is-boost { animation: turn-demo-drive-boost 10s steps(1, end) infinite; }
  details[open] .turn-demo-stack[data-demo="drive"] .is-brake { animation: turn-demo-drive-brake 10s steps(1, end) infinite; }
  details[open] .turn-demo-stack[data-demo="drive"] .is-lock {
    animation:
      turn-demo-drive-lock-slide 10s linear infinite,
      turn-demo-drive-lock-fade 10s linear infinite,
      turn-demo-drive-lock-colour 10s linear infinite,
      turn-demo-drive-lock-ring 10s steps(1, end) infinite;
  }
  details[open] .turn-demo-stack[data-demo="drive"] .is-reverse {
    animation:
      turn-demo-drive-reverse-slide 10s linear infinite,
      turn-demo-drive-reverse-fade 10s linear infinite,
      turn-demo-drive-reverse-colour 10s linear infinite,
      turn-demo-drive-reverse-ring 10s steps(1, end) infinite;
  }
  @keyframes turn-demo-drive-thumb {
    0%, 10% { left: 50%; top: 54%; }
    14%, 28% { left: 25%; top: 16%; }
    31%, 42% { left: -12%; top: 16%; }
    45% { left: 25%; top: 16%; }
    49%, 60% { left: 75%; top: 16%; }
    63%, 68% { left: 50%; top: 54%; }
    71%, 80% { left: 50%; top: 88%; }
    83%, 92% { left: -12%; top: 88%; }
    96%, 100% { left: 50%; top: 54%; }
  }
  @keyframes turn-demo-drive-gas {
    0%, 61.5%, 94.5% { box-shadow: var(--turn-drive-zone-pressed); }
    12%, 69.5% { box-shadow: var(--turn-demo-released); }
  }
  @keyframes turn-demo-drive-drift {
    0%, 47% { box-shadow: var(--turn-demo-released); }
    12% { box-shadow: var(--turn-drive-zone-pressed); }
  }
  @keyframes turn-demo-drive-boost {
    0%, 61.5% { box-shadow: var(--turn-demo-released); --turn-demo-boost-fill: var(--turn-control-boost); }
    47% { box-shadow: var(--turn-drive-zone-pressed); --turn-demo-boost-fill: var(--turn-yellow-600); }
  }
  @keyframes turn-demo-drive-brake {
    0%, 94.5% { box-shadow: var(--turn-demo-released); }
    69.5% { box-shadow: var(--turn-drive-zone-pressed); }
  }
  @keyframes turn-demo-drive-corners {
    0%, 47%, 94.5% { border-top-left-radius: var(--turn-drive-pad-radius); border-bottom-left-radius: var(--turn-drive-pad-radius); }
    12% { border-top-left-radius: 0; border-bottom-left-radius: var(--turn-drive-pad-radius); }
    69.5% { border-top-left-radius: var(--turn-drive-pad-radius); border-bottom-left-radius: 0; }
  }
  @keyframes turn-demo-drive-lock-slide {
    0%, 12% { transform: var(--turn-demo-tucked); animation-timing-function: var(--turn-drive-bubble-slide-easing); }
    13.4%, 47% { transform: var(--turn-demo-out); animation-timing-function: var(--turn-drive-bubble-slide-easing); }
    48.4%, 100% { transform: var(--turn-demo-tucked); }
  }
  @keyframes turn-demo-drive-lock-fade {
    0%, 12% { opacity: 0; animation-timing-function: ease-out; }
    12.8%, 47% { opacity: 1; animation-timing-function: ease-out; }
    47.8%, 100% { opacity: 0; }
  }
  @keyframes turn-demo-drive-lock-colour {
    0%, 30% { background-color: var(--turn-control-lock); animation-timing-function: ease; }
    31%, 43% { background-color: var(--turn-control-overcharge); animation-timing-function: ease; }
    44%, 100% { background-color: var(--turn-control-lock); }
  }
  @keyframes turn-demo-drive-lock-ring {
    0%, 43% { box-shadow: var(--turn-demo-released); }
    30% { box-shadow: var(--turn-drive-bubble-pressed); }
  }
  @keyframes turn-demo-drive-reverse-slide {
    0%, 69.5% { transform: var(--turn-demo-tucked); animation-timing-function: var(--turn-drive-bubble-slide-easing); }
    70.9%, 94.5% { transform: var(--turn-demo-out); animation-timing-function: var(--turn-drive-bubble-slide-easing); }
    95.9%, 100% { transform: var(--turn-demo-tucked); }
  }
  @keyframes turn-demo-drive-reverse-fade {
    0%, 69.5% { opacity: 0; animation-timing-function: ease-out; }
    70.3%, 94.5% { opacity: 1; animation-timing-function: ease-out; }
    95.3%, 100% { opacity: 0; }
  }
  @keyframes turn-demo-drive-reverse-colour {
    0%, 82% { background-color: var(--turn-control-brake); animation-timing-function: ease; }
    83%, 93% { background-color: var(--turn-orange-200); animation-timing-function: ease; }
    94%, 100% { background-color: var(--turn-control-brake); }
  }
  @keyframes turn-demo-drive-reverse-ring {
    0%, 93% { box-shadow: var(--turn-demo-released); }
    82% { box-shadow: var(--turn-drive-bubble-pressed); }
  }

  /* SHIFT, 6 s: from GAS, out into SHIFT and back; SHIFT stays on until the next. */
  .turn-demo-stack[data-demo="shift"] .is-shift { opacity: 1; transform: var(--turn-demo-out); }
  details[open] .turn-demo-stack[data-demo="shift"] .turn-demo-thumb { animation: turn-demo-shift-thumb 6s ease-in-out infinite; }
  details[open] .turn-demo-stack[data-demo="shift"] .is-gas { animation: turn-demo-shift-gas 6s steps(1, end) infinite; }
  details[open] .turn-demo-stack[data-demo="shift"] .is-shift { animation: turn-demo-shift-on 6s linear infinite; }
  details[open] .turn-demo-stack[data-demo="shift"] .is-shift i { animation: turn-demo-shift-dot 6s linear infinite; }
  @keyframes turn-demo-shift-thumb {
    0%, 15% { left: 50%; top: 54%; }
    20%, 32% { left: -13%; top: 54%; }
    37%, 55% { left: 50%; top: 54%; }
    60%, 72% { left: -13%; top: 54%; }
    77%, 100% { left: 50%; top: 54%; }
  }
  @keyframes turn-demo-shift-gas {
    0%, 33.5%, 73.5% { box-shadow: var(--turn-drive-zone-pressed); }
    18.5%, 58.5% { box-shadow: var(--turn-demo-released); }
  }
  @keyframes turn-demo-shift-on {
    0%, 18.5% { background-color: var(--turn-control-gas); animation-timing-function: ease; }
    20.17%, 58.5% { background-color: var(--turn-control-shift-on); animation-timing-function: ease; }
    60.17%, 100% { background-color: var(--turn-control-gas); }
  }
  @keyframes turn-demo-shift-dot {
    0%, 18.5% { width: 0; opacity: 0; animation-timing-function: ease; }
    20.17%, 58.5% { width: 0.72em; opacity: 1; animation-timing-function: ease; }
    60.17%, 100% { width: 0; opacity: 0; }
  }

  /* BOOST on the pad. While racing, the BOOST bar sits above the pad at its width with
     no label (responsive.css, r104-polish.css), and OVERCHARGE widens it at both ends in
     purple (gameplay-v2.css). The pad's BOOST zone fills with the same charge. */
  .turn-demo-stack.has-bar { margin-block-start: 30px; }
  .turn-demo-bar {
    position: absolute;
    z-index: 2;
    left: 50%;
    bottom: calc(100% + 10px);
    box-sizing: border-box;
    width: 100%;
    height: calc(var(--turn-boost-bar-height) + 2 * var(--turn-boost-bar-outline));
    overflow: hidden;
    border: var(--turn-boost-bar-outline) solid var(--turn-outline);
    border-radius: var(--turn-boost-bar-radius);
    background: color-mix(in srgb, var(--turn-surface-page) var(--turn-boost-bar-track-opacity), transparent);
    box-shadow: var(--turn-boost-bar-shadow-offset) var(--turn-boost-bar-shadow-offset) 0 var(--turn-shadow-color);
    transform: translateX(-50%);
  }
  :root.turn-left-handed-controls .turn-demo-bar { transform: translateX(-50%) scaleX(-1); }
  .turn-demo-bar > b {
    position: absolute;
    inset: 0;
    opacity: 0;
    background: var(--turn-boost-overcharge);
  }
  .turn-demo-bar > i {
    position: absolute;
    inset: 0 auto 0 0;
    width: calc(var(--turn-demo-charge) * 136.5px);
    background: linear-gradient(90deg, var(--turn-yellow-600), var(--turn-control-boost));
  }
  /* While DRIFT charges it, the fill is DRIFT's colour into GAS's. */
  .turn-demo-bar > i::after {
    content: "";
    position: absolute;
    inset: 0;
    opacity: 0;
    background: linear-gradient(90deg, var(--turn-control-drift), var(--turn-control-gas));
  }

  /* BOOST, 8 s: from GAS into DRIFT, which fills BOOST (LOCK waits beside it); back to
     GAS; into BOOST, which spends it; back to GAS. */
  details[open] .turn-demo-stack[data-demo="boost"] { animation: turn-demo-boost-charge 8s linear infinite; }
  details[open] .turn-demo-stack[data-demo="boost"] .turn-demo-thumb { animation: turn-demo-boost-thumb 8s ease-in-out infinite; }
  details[open] .turn-demo-stack[data-demo="boost"] .turn-demo-pad { animation: turn-demo-boost-corners 8s steps(1, end) infinite; }
  details[open] .turn-demo-stack[data-demo="boost"] .is-gas { animation: turn-demo-boost-gas 8s steps(1, end) infinite; }
  details[open] .turn-demo-stack[data-demo="boost"] .is-drift { animation: turn-demo-boost-drift 8s steps(1, end) infinite; }
  details[open] .turn-demo-stack[data-demo="boost"] .is-boost { animation: turn-demo-boost-boost 8s steps(1, end) infinite; }
  details[open] .turn-demo-stack[data-demo="boost"] .turn-demo-bar > i::after { animation: turn-demo-boost-drifting 8s steps(1, end) infinite; }
  details[open] .turn-demo-stack[data-demo="boost"] .is-lock {
    animation:
      turn-demo-boost-lock-slide 8s linear infinite,
      turn-demo-boost-lock-fade 8s linear infinite;
  }
  @keyframes turn-demo-boost-charge {
    0%, 10% { --turn-demo-charge: 0.2; }
    38%, 60% { --turn-demo-charge: 1; }
    82%, 100% { --turn-demo-charge: 0.2; }
  }
  @keyframes turn-demo-boost-thumb {
    0%, 5% { left: 50%; top: 54%; }
    10%, 40% { left: 25%; top: 16%; }
    45%, 55% { left: 50%; top: 54%; }
    60%, 85% { left: 75%; top: 16%; }
    90%, 100% { left: 50%; top: 54%; }
  }
  @keyframes turn-demo-boost-gas {
    0%, 42.5%, 87.5% { box-shadow: var(--turn-drive-zone-pressed); }
    7.5%, 57.5% { box-shadow: var(--turn-demo-released); }
  }
  @keyframes turn-demo-boost-drift {
    0%, 42.5% { box-shadow: var(--turn-demo-released); }
    7.5% { box-shadow: var(--turn-drive-zone-pressed); }
  }
  @keyframes turn-demo-boost-boost {
    0%, 87.5% { box-shadow: var(--turn-demo-released); --turn-demo-boost-fill: var(--turn-control-boost); }
    57.5% { box-shadow: var(--turn-drive-zone-pressed); --turn-demo-boost-fill: var(--turn-yellow-600); }
  }
  @keyframes turn-demo-boost-drifting {
    0%, 42.5% { opacity: 0; }
    7.5% { opacity: 1; }
  }
  @keyframes turn-demo-boost-corners {
    0%, 42.5% { border-top-left-radius: var(--turn-drive-pad-radius); }
    7.5% { border-top-left-radius: 0; }
  }
  @keyframes turn-demo-boost-lock-slide {
    0%, 7.5% { transform: var(--turn-demo-tucked); animation-timing-function: var(--turn-drive-bubble-slide-easing); }
    9.25%, 42.5% { transform: var(--turn-demo-out); animation-timing-function: var(--turn-drive-bubble-slide-easing); }
    44.25%, 100% { transform: var(--turn-demo-tucked); }
  }
  @keyframes turn-demo-boost-lock-fade {
    0%, 7.5% { opacity: 0; animation-timing-function: ease-out; }
    8.5%, 42.5% { opacity: 1; animation-timing-function: ease-out; }
    43.5%, 100% { opacity: 0; }
  }

  /* OVERCHARGE, 10 s: DRIFT fills BOOST, then builds OVERCHARGE past it; GAS catches and
     holds it; BOOST spends OVERCHARGE first, then BOOST. Like the race's bar, the fill
     takes DRIFT's colours at once, and the bar turns purple at once. */
  details[open] .turn-demo-stack[data-demo="overcharge"] { animation: turn-demo-overcharge-charge 10s linear infinite; }
  details[open] .turn-demo-stack[data-demo="overcharge"] .turn-demo-thumb { animation: turn-demo-overcharge-thumb 10s ease-in-out infinite; }
  details[open] .turn-demo-stack[data-demo="overcharge"] .turn-demo-pad { animation: turn-demo-overcharge-corners 10s steps(1, end) infinite; }
  details[open] .turn-demo-stack[data-demo="overcharge"] .is-gas { animation: turn-demo-overcharge-gas 10s steps(1, end) infinite; }
  details[open] .turn-demo-stack[data-demo="overcharge"] .is-drift { animation: turn-demo-overcharge-drift 10s steps(1, end) infinite; }
  details[open] .turn-demo-stack[data-demo="overcharge"] .is-boost { animation: turn-demo-overcharge-boost 10s steps(1, end) infinite; }
  details[open] .turn-demo-stack[data-demo="overcharge"] .turn-demo-bar { animation: turn-demo-overcharge-bar 10s linear infinite; }
  details[open] .turn-demo-stack[data-demo="overcharge"] .turn-demo-bar > b { animation: turn-demo-overcharge-purple 10s steps(1, end) infinite; }
  details[open] .turn-demo-stack[data-demo="overcharge"] .turn-demo-bar > i { animation: turn-demo-overcharge-fill 10s linear infinite; }
  details[open] .turn-demo-stack[data-demo="overcharge"] .turn-demo-bar > i::after { animation: turn-demo-overcharge-drifting 10s steps(1, end) infinite; }
  details[open] .turn-demo-stack[data-demo="overcharge"] .is-lock {
    animation:
      turn-demo-overcharge-lock-slide 10s linear infinite,
      turn-demo-overcharge-lock-fade 10s linear infinite;
  }
  @keyframes turn-demo-overcharge-charge {
    0%, 8% { --turn-demo-charge: 0.2; }
    28%, 74% { --turn-demo-charge: 1; }
    88%, 100% { --turn-demo-charge: 0.2; }
  }
  @keyframes turn-demo-overcharge-thumb {
    0%, 4% { left: 50%; top: 54%; }
    8%, 46% { left: 25%; top: 16%; }
    50%, 60% { left: 50%; top: 54%; }
    64%, 88% { left: 75%; top: 16%; }
    92%, 100% { left: 50%; top: 54%; }
  }
  @keyframes turn-demo-overcharge-gas {
    0%, 48%, 90% { box-shadow: var(--turn-drive-zone-pressed); }
    6%, 62% { box-shadow: var(--turn-demo-released); }
  }
  @keyframes turn-demo-overcharge-drift {
    0%, 48% { box-shadow: var(--turn-demo-released); }
    6% { box-shadow: var(--turn-drive-zone-pressed); }
  }
  @keyframes turn-demo-overcharge-boost {
    0%, 90% { box-shadow: var(--turn-demo-released); --turn-demo-boost-fill: var(--turn-control-boost); }
    62% { box-shadow: var(--turn-drive-zone-pressed); --turn-demo-boost-fill: var(--turn-yellow-600); }
  }
  @keyframes turn-demo-overcharge-bar {
    0%, 30%, 74%, 100% { width: 100%; }
    44%, 64% { width: 130%; }
  }
  @keyframes turn-demo-overcharge-fill {
    0%, 30%, 74%, 100% { left: 0; }
    44%, 64% { left: 21.375px; }
  }
  @keyframes turn-demo-overcharge-purple {
    0%, 74% { opacity: 0; }
    30% { opacity: 1; }
  }
  @keyframes turn-demo-overcharge-drifting {
    0%, 48% { opacity: 0; }
    6% { opacity: 1; }
  }
  @keyframes turn-demo-overcharge-corners {
    0%, 48% { border-top-left-radius: var(--turn-drive-pad-radius); }
    6% { border-top-left-radius: 0; }
  }
  @keyframes turn-demo-overcharge-lock-slide {
    0%, 6% { transform: var(--turn-demo-tucked); animation-timing-function: var(--turn-drive-bubble-slide-easing); }
    7.4%, 48% { transform: var(--turn-demo-out); animation-timing-function: var(--turn-drive-bubble-slide-easing); }
    49.4%, 100% { transform: var(--turn-demo-tucked); }
  }
  @keyframes turn-demo-overcharge-lock-fade {
    0%, 6% { opacity: 0; animation-timing-function: ease-out; }
    6.8%, 48% { opacity: 1; animation-timing-function: ease-out; }
    48.8%, 100% { opacity: 0; }
  }

  /* STEER, 8 s: the device turns like a wheel, settles where the player likes to hold
     it, and RECALIBRATE makes that straight ahead: it blinks twice as STEERING CENTRED
     shows, as in the race (in-game-menu.css, styles.css), in the race's message yellow. */
  .turn-demo-steer {
    flex-direction: column;
    align-items: center;
    gap: var(--turn-space-3);
  }
  .turn-demo-message {
    padding: 5.25px 9.75px;
    border: 3px solid var(--turn-outline);
    border-radius: 749.25px;
    background: var(--yellow);
    color: var(--turn-ink);
    box-shadow: 3px 3px 0 var(--turn-shadow-color);
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.04em;
    white-space: nowrap;
    opacity: 0;
    transform: rotate(-2deg);
  }
  /* A phone held in landscape: a dark body around its screen, the camera at one end. */
  .turn-demo-device {
    position: relative;
    width: 112px;
    height: 58px;
    margin: 6px 0;
    padding: 5px 8px 5px 14px;
    box-sizing: border-box;
    border: 3px solid var(--turn-outline);
    border-radius: 15px;
    background: var(--turn-ink);
    box-shadow: 3px 3px 0 var(--turn-shadow-color);
  }
  .turn-demo-device::before {
    content: "";
    position: absolute;
    left: 4.5px;
    top: 50%;
    width: 4px;
    height: 4px;
    margin-top: -2px;
    border-radius: 50%;
    background: var(--turn-road);
  }
  .turn-demo-device > i {
    position: relative;
    display: block;
    height: 100%;
    overflow: hidden;
    border-radius: 8px;
  }
  /* Keep the screen's clip with the phone, but counter-rotate its scenery. The
     overscan covers the screen's corners throughout the tilt. */
  .turn-demo-device > i::after {
    content: "";
    position: absolute;
    inset: -50%;
    background: linear-gradient(var(--turn-blue-200) 0 52%, var(--turn-demo-ground) 52% 100%);
  }
  .turn-demo-recalibrate {
    display: grid;
    place-items: center;
    min-height: var(--turn-target-min, 44px);
    padding: 6px 13.2px;
    box-sizing: border-box;
    border: var(--turn-border-control, 3px) solid var(--turn-outline);
    border-radius: var(--turn-radius-control, 12px);
    background-color: var(--turn-action-utility);
    color: var(--turn-text);
    box-shadow: var(--turn-shadow-control, 3px 3px 0 var(--turn-shadow-color));
    font-size: 11px;
    font-weight: 800;
    letter-spacing: normal;
  }
  details[open] .turn-demo-steer .turn-demo-device { animation: turn-demo-steer-device 8s ease-in-out infinite; }
  details[open] .turn-demo-steer .turn-demo-device > i::after { animation: turn-demo-steer-horizon 8s ease-in-out infinite; }
  details[open] .turn-demo-steer .turn-demo-message { animation: turn-demo-steer-message 8s linear infinite; }
  details[open] .turn-demo-steer .turn-demo-recalibrate {
    animation:
      turn-demo-steer-press 8s steps(1, end) infinite,
      turn-demo-steer-blink 8s steps(1, end) infinite;
  }
  @keyframes turn-demo-steer-device {
    0%, 6% { transform: rotate(0deg); }
    18% { transform: rotate(-16deg); }
    32% { transform: rotate(16deg); }
    44%, 90% { transform: rotate(7deg); }
    100% { transform: rotate(0deg); }
  }
  /* Match the phone's stops and easing while it moves, so the horizon stays level
     between poses too. Only while the phone holds at 7deg do we introduce an
     offset, then level it as RECALIBRATE is pressed and STEERING CENTRED appears. */
  @keyframes turn-demo-steer-horizon {
    0%, 6% { transform: rotate(0deg); }
    18% { transform: rotate(16deg); }
    32% { transform: rotate(-16deg); }
    44% { transform: rotate(-7deg); }
    50%, 56% { transform: rotate(0deg); }
    57.75%, 90% { transform: rotate(-7deg); }
    100% { transform: rotate(0deg); }
  }
  @keyframes turn-demo-steer-press {
    0%, 57.5% { transform: none; box-shadow: var(--turn-shadow-control, 3px 3px 0 var(--turn-shadow-color)); }
    56% { transform: translate(2px, 2px); box-shadow: 1px 1px 0 var(--turn-shadow-color); }
  }
  @keyframes turn-demo-steer-blink {
    0%, 59%, 65% { background-color: var(--turn-action-utility); color: var(--turn-text); }
    56%, 62% { background-color: var(--yellow); color: var(--turn-ink); }
  }
  @keyframes turn-demo-steer-message {
    0%, 56% { opacity: 0; animation-timing-function: ease; }
    57.75%, 82% { opacity: 1; animation-timing-function: ease; }
    83.75%, 100% { opacity: 0; }
  }

  /* On-screen steering, 6 s (manual-steering.css): the thumb drags the knob left, then
     right; let go, it springs back to the middle on the race's 110 ms curve. */
  .turn-demo-manual-steer {
    position: relative;
    width: 150px;
    height: 96px;
    box-sizing: border-box;
    overflow: hidden;
    border: 5px solid var(--turn-outline);
    border-radius: 22.5px;
    background: var(--yellow);
    /* A coloured control: Ink on it in both themes, as design-tokens.css gives the race's. */
    color: var(--turn-ink);
    box-shadow: 5.25px 5.25px 0 var(--turn-shadow-color);
  }
  .turn-demo-manual-steer > span {
    position: absolute;
    top: 50%;
    font-size: 26.4px;
    font-weight: 1000;
    line-height: 1;
    transform: translateY(-54%);
  }
  .turn-demo-manual-steer > span:first-child { left: 7%; }
  .turn-demo-manual-steer > span:nth-child(2) { right: 7%; }
  .turn-demo-manual-steer > i {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 58px;
    aspect-ratio: 1;
    box-sizing: border-box;
    border: 5px solid var(--turn-ink);
    border-radius: 50%;
    background: var(--cyan);
    box-shadow: 3.75px 5.25px 0 color-mix(in srgb, var(--turn-shadow-color) 35%, transparent);
    transform: translate(-50%, -50%);
  }
  details[open] .turn-demo-manual-steer > i { animation: turn-demo-manual-knob 6s linear infinite; }
  @keyframes turn-demo-manual-knob {
    0%, 10% { left: 50%; animation-timing-function: ease-in-out; }
    24%, 38% { left: 24%; animation-timing-function: ease-in-out; }
    58%, 72% { left: 76%; animation-timing-function: cubic-bezier(0.2, 0.9, 0.25, 1.15); }
    73.83%, 100% { left: 50%; }
  }

  /* REPLAY (#1217): a recorded lap sets the pad by the race's own state names
     (drive-pad.css) and data-thumb, where the thumb is. The steering box's knob and the
     phone follow the lap's steering, --turn-demo-steer: -1 right to 1 left, as far as
     the steering demos go. Nothing moves on its own. */
  .turn-demo-stack[data-demo="replay"] .turn-demo-thumb {
    opacity: 0;
    transition: left 120ms ease-out, top 120ms ease-out, opacity 120ms ease-out;
  }
  .turn-demo-stack[data-demo="replay"]:not([data-thumb=""]) .turn-demo-thumb { opacity: 1; }
  .turn-demo-stack[data-demo="replay"][data-thumb="drift"] .turn-demo-thumb { left: 25%; top: 16%; }
  .turn-demo-stack[data-demo="replay"][data-thumb="lock"] .turn-demo-thumb { left: -12%; top: 16%; }
  .turn-demo-stack[data-demo="replay"][data-thumb="boost"] .turn-demo-thumb { left: 75%; top: 16%; }
  .turn-demo-stack[data-demo="replay"][data-thumb="shift"] .turn-demo-thumb { left: -13%; top: 54%; }
  .turn-demo-stack[data-demo="replay"][data-thumb="brake"] .turn-demo-thumb { left: 50%; top: 88%; }
  .turn-demo-stack[data-demo="replay"][data-thumb="reverse"] .turn-demo-thumb { left: -12%; top: 88%; }
  .turn-demo-stack[data-demo="replay"] .turn-demo-bubble {
    transition:
      opacity var(--turn-drive-bubble-fade) ease-out,
      transform var(--turn-drive-bubble-slide) var(--turn-drive-bubble-slide-easing),
      background-color var(--turn-drive-bubble-colour-change) ease;
  }
  .turn-demo-stack[data-demo="replay"].is-drift-ready .is-lock,
  .turn-demo-stack[data-demo="replay"]:is(.is-brake-ready, .is-reversing) .is-reverse,
  .turn-demo-stack[data-demo="replay"]:is(.is-shift-available.is-gas-ready, .is-shift-active, .is-shift-pressing) .is-shift {
    opacity: 1;
    transform: var(--turn-demo-out);
  }
  .turn-demo-stack[data-demo="replay"].is-drift-ready .turn-demo-pad { border-top-left-radius: 0; }
  .turn-demo-stack[data-demo="replay"]:is(.is-brake-ready, .is-reversing) .turn-demo-pad { border-bottom-left-radius: 0; }
  .turn-demo-stack[data-demo="replay"].is-gas-ready .is-gas,
  .turn-demo-stack[data-demo="replay"].is-drift-ready .is-drift,
  .turn-demo-stack[data-demo="replay"].is-boost-ready .is-boost,
  .turn-demo-stack[data-demo="replay"].is-brake-ready .is-brake { box-shadow: var(--turn-drive-zone-pressed); }
  .turn-demo-stack[data-demo="replay"].is-boost-ready .is-boost { --turn-demo-boost-fill: var(--turn-yellow-600); }
  .turn-demo-stack[data-demo="replay"].is-drift-locking .is-lock {
    background-color: var(--turn-control-overcharge);
    box-shadow: var(--turn-drive-bubble-pressed);
  }
  .turn-demo-stack[data-demo="replay"].is-reversing .is-reverse {
    background-color: var(--turn-orange-200);
    box-shadow: var(--turn-drive-bubble-pressed);
  }
  .turn-demo-stack[data-demo="replay"].is-shift-active .is-shift { background-color: var(--turn-control-shift-on); }
  .turn-demo-stack[data-demo="replay"].is-shift-active .is-shift i { width: 0.72em; opacity: 1; }
  /* Laid out for the hand the lap was driven with (data-hand), whatever this device's. */
  [data-hand="right"] .turn-demo .turn-demo-stack[data-demo="replay"] { margin-inline: 42px 0; transform: none; }
  [data-hand="right"] .turn-demo .turn-demo-stack[data-demo="replay"] .turn-demo-pad {
    box-shadow: var(--turn-drive-pad-shadow-x) var(--turn-drive-pad-shadow-y) 0 var(--turn-shadow-color);
  }
  [data-hand="right"] .turn-demo .turn-demo-stack[data-demo="replay"] .turn-demo-pad > span,
  [data-hand="right"] .turn-demo .turn-demo-stack[data-demo="replay"] .turn-demo-bubble.is-reverse > b { transform: none; }
  [data-hand="right"] .turn-demo .turn-demo-stack[data-demo="replay"] .turn-demo-bubble > b { transform: rotate(-90deg); }
  [data-hand="left"] .turn-demo .turn-demo-stack[data-demo="replay"] { margin-inline: 0 42px; transform: scaleX(-1); }
  [data-hand="left"] .turn-demo .turn-demo-stack[data-demo="replay"] .turn-demo-pad {
    box-shadow: calc(-1 * var(--turn-drive-pad-shadow-x)) var(--turn-drive-pad-shadow-y) 0 var(--turn-shadow-color);
  }
  [data-hand="left"] .turn-demo .turn-demo-stack[data-demo="replay"] .turn-demo-pad > span,
  [data-hand="left"] .turn-demo .turn-demo-stack[data-demo="replay"] .turn-demo-bubble.is-reverse > b { transform: scaleX(-1); }
  [data-hand="left"] .turn-demo .turn-demo-stack[data-demo="replay"] .turn-demo-bubble > b { transform: scaleX(-1) rotate(-90deg); }
  .turn-demo-manual-steer.is-replay > i {
    transform: translate(calc(-50% - var(--turn-demo-steer, 0) * 39px), -50%);
  }
  .turn-demo-tilt .turn-demo-device { transform: rotate(calc(var(--turn-demo-steer, 0) * -16deg)); }
  .turn-demo-tilt .turn-demo-device > i::after { transform: rotate(calc(var(--turn-demo-steer, 0) * 16deg)); }

  /* RIVALS: the race's POSITION and BEST chips (styles.css, position-hud-r83.css). */
  .turn-demo-rivals { gap: var(--turn-space-3); }
  .turn-demo-chip {
    min-width: 61.5px;
    min-height: 44px;
    padding: 5.25px 7.5px 6px;
    box-sizing: border-box;
    border: 3px solid var(--turn-outline);
    border-radius: 12px;
    background: color-mix(in srgb, var(--turn-surface-page) 90%, transparent);
    color: var(--turn-text);
    box-shadow: 3px 3px 0 var(--turn-shadow-color);
    font-size: 11px;
    font-weight: 800;
    line-height: 1;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    white-space: nowrap;
  }
  .turn-demo-chip > strong {
    display: block;
    margin-top: 2.25px;
    font-size: 16.8px;
    font-weight: 900;
    letter-spacing: -0.04em;
  }

  /* DRIFT ATTACK and FLOW: the race's scorekeeper (scoring/score-feedback.css): the live
     score and COMBO, LAP, LAST and BEST, and the callout that follows a bank or a new
     COMBO. */
  .turn-demo-score {
    flex-direction: column;
    align-items: center;
    gap: 6.75px;
  }
  .turn-demo-paper {
    display: grid;
    grid-template-rows: auto 1fr auto;
    width: 149px;
    min-height: 78px;
    padding: 6px 7.5px 6.75px;
    box-sizing: border-box;
    border: 3px solid var(--turn-outline);
    border-radius: 11.25px;
    background: color-mix(in srgb, var(--turn-surface-page) 94%, transparent);
    color: var(--turn-text);
    box-shadow: 2.25px 2.25px 0 var(--turn-shadow-color);
  }
  .turn-demo-paper > div {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 6px;
  }
  .turn-demo-paper .is-heading,
  .turn-demo-paper .is-record {
    font-size: 11px;
    font-weight: 950;
    letter-spacing: 0.075em;
    line-height: 1;
  }
  .turn-demo-paper .is-values {
    margin-top: 2.25px;
    line-height: 1;
  }
  .turn-demo-paper .is-values > strong {
    align-self: center;
    font-size: 21.36px;
    font-weight: 900;
    letter-spacing: -0.055em;
    counter-reset: turn-demo-score var(--turn-demo-score);
  }
  .turn-demo-paper .is-values > strong::before { content: counter(turn-demo-score); }
  .turn-demo-paper .is-record {
    justify-content: flex-start;
    gap: 3px;
    margin-top: 3px;
    letter-spacing: 0.055em;
  }
  .turn-demo-paper .is-record > b { font: inherit; font-size: 1.08em; }
  /* Values that change in the demo stack in one cell and take turns. */
  .turn-demo-swap { display: inline-grid; }
  .turn-demo-swap > * { grid-area: 1 / 1; font-style: normal; }
  .turn-demo-swap > :not(:first-child) { opacity: 0; }
  .turn-demo-paper .is-values > b {
    align-self: center;
    padding: 1.5px 3.75px 2.25px;
    border: 1.5px solid var(--turn-outline);
    border-radius: 749.25px;
    background: var(--turn-blue-200);
    color: var(--turn-ink);
    font-size: 11px;
    font-weight: 900;
    line-height: 1;
  }
  .turn-demo-score[data-demo="flow"] .is-values > b { background: var(--turn-control-flow); }
  .turn-demo-callout {
    padding: 5.25px 7.5px 6px;
    box-sizing: border-box;
    border: 3px solid var(--turn-outline);
    border-radius: 9px;
    background: color-mix(in srgb, var(--turn-surface-page) 94%, transparent);
    color: var(--turn-text);
    box-shadow: 3px 3px 0 var(--turn-shadow-color);
    opacity: 0;
  }
  .turn-demo-callout strong,
  .turn-demo-callout b {
    display: block;
    white-space: nowrap;
    line-height: 1;
  }
  .turn-demo-callout strong { font-size: 11px; font-weight: 950; letter-spacing: 0.055em; }
  .turn-demo-callout > .turn-demo-swap { display: grid; }
  .turn-demo-callout > .turn-demo-swap > span { align-self: center; }
  .turn-demo-callout b { margin-top: 2.25px; font-size: 15.12px; font-weight: 900; }

  /* The race's side gauge (score-feedback.css): it unfolds beside the score while a
     slide or FLOW is live, or COMBO is held, fills with how hard it is going, and is
     bolder at a higher COMBO. */
  .turn-demo-scorekeeper {
    position: relative;
    margin-inline-end: 41.25px;
  }
  .turn-demo-scorekeeper > .turn-demo-paper {
    position: relative;
    z-index: 1;
  }
  .turn-demo-gauge {
    --turn-demo-gauge-fill: var(--turn-control-drift);
    position: absolute;
    z-index: 0;
    top: 5.25px;
    bottom: 5.25px;
    left: calc(100% - 2.25px);
    width: 43.5px;
    box-sizing: border-box;
    overflow: hidden;
    border: 3px solid var(--turn-outline);
    border-radius: 0 7.5px 7.5px 0;
    background: var(--turn-ink);
    opacity: 0;
    transform: scaleX(0);
    transform-origin: left center;
  }
  .turn-demo-score[data-demo="flow"] .turn-demo-gauge { --turn-demo-gauge-fill: var(--turn-control-flow); }
  /* A sliver of colour marks zero inside the dark gauge. */
  .turn-demo-gauge::before {
    content: "";
    position: absolute;
    top: 3.75px;
    bottom: 3.75px;
    left: 3.75px;
    width: 3.75px;
    border-radius: 749.25px;
    background: var(--turn-demo-gauge-fill);
  }
  .turn-demo-gauge > i {
    position: absolute;
    z-index: 1;
    inset: 3.75px;
    border-radius: 3px;
    background: linear-gradient(to right, var(--turn-demo-gauge-fill), color-mix(in srgb, var(--turn-demo-gauge-fill) 55%, var(--turn-paper)));
    transform: scaleX(0);
    transform-origin: left center;
  }
  /* Left-handed, the scorekeeper sits on the right and its gauge unfolds to the left. */
  :root.turn-left-handed-controls .turn-demo-scorekeeper { margin-inline: 41.25px 0; }
  :root.turn-left-handed-controls .turn-demo-gauge {
    right: calc(100% - 2.25px);
    left: auto;
    border-radius: 7.5px 0 0 7.5px;
    transform-origin: right center;
  }
  :root.turn-left-handed-controls .turn-demo-gauge::before { right: 3.75px; left: auto; }
  :root.turn-left-handed-controls .turn-demo-gauge > i {
    background: linear-gradient(to left, var(--turn-demo-gauge-fill), color-mix(in srgb, var(--turn-demo-gauge-fill) 55%, var(--turn-paper)));
    transform-origin: right center;
  }

  /* DRIFT ATTACK, 10 s: a slide builds its score, and a clean exit BANKS it into LAP. The
     next slide, linked the other way in time, raises COMBO to ×2 and builds faster; it
     banks too, and COMBO drops back once the link runs out. Each value holds long
     enough to read. */
  details[open] .turn-demo-score[data-demo="drift"] { animation: turn-demo-drift-score 10s steps(1, end) infinite; }
  details[open] .turn-demo-score[data-demo="drift"] .is-values .turn-demo-swap > :nth-child(1) { animation: turn-demo-drift-combo-1 10s steps(1, end) infinite; }
  details[open] .turn-demo-score[data-demo="drift"] .is-values .turn-demo-swap > :nth-child(2) { animation: turn-demo-drift-combo-2 10s steps(1, end) infinite; }
  details[open] .turn-demo-score[data-demo="drift"] .is-lap .turn-demo-swap > :nth-child(1) { animation: turn-demo-drift-lap-1 10s steps(1, end) infinite; }
  details[open] .turn-demo-score[data-demo="drift"] .is-lap .turn-demo-swap > :nth-child(2) { animation: turn-demo-drift-lap-2 10s steps(1, end) infinite; }
  details[open] .turn-demo-score[data-demo="drift"] .is-lap .turn-demo-swap > :nth-child(3) { animation: turn-demo-drift-lap-3 10s steps(1, end) infinite; }
  details[open] .turn-demo-score[data-demo="drift"] .turn-demo-callout { animation: turn-demo-drift-callout 10s linear infinite; }
  details[open] .turn-demo-score[data-demo="drift"] .turn-demo-callout .turn-demo-swap > :nth-child(1) { animation: turn-demo-drift-event-1 10s steps(1, end) infinite; }
  details[open] .turn-demo-score[data-demo="drift"] .turn-demo-callout .turn-demo-swap > :nth-child(2) { animation: turn-demo-drift-event-2 10s steps(1, end) infinite; }
  details[open] .turn-demo-score[data-demo="drift"] .turn-demo-callout .turn-demo-swap > :nth-child(3) { animation: turn-demo-drift-event-3 10s steps(1, end) infinite; }
  details[open] .turn-demo-score[data-demo="drift"] .turn-demo-gauge { animation: turn-demo-drift-gauge 10s linear infinite; }
  details[open] .turn-demo-score[data-demo="drift"] .turn-demo-gauge > i { animation: turn-demo-drift-gauge-fill 10s linear infinite; }
  @keyframes turn-demo-drift-score {
    0% { --turn-demo-score: 0; }
${countUp(6, 28, 300, 12)}
    30% { --turn-demo-score: 0; }
${countUp(44, 66, 600, 12)}
    68% { --turn-demo-score: 0; }
  }
  @keyframes turn-demo-drift-combo-1 { 0% { opacity: 1; } 40% { opacity: 0; } 84% { opacity: 1; } }
  @keyframes turn-demo-drift-combo-2 { 0% { opacity: 0; } 40% { opacity: 1; } 84% { opacity: 0; } }
  @keyframes turn-demo-drift-lap-1 { 0% { opacity: 1; } 30% { opacity: 0; } }
  @keyframes turn-demo-drift-lap-2 { 0% { opacity: 0; } 30% { opacity: 1; } 68% { opacity: 0; } }
  @keyframes turn-demo-drift-lap-3 { 0% { opacity: 0; } 68% { opacity: 1; } }
  @keyframes turn-demo-drift-callout {
    0%, 30% { opacity: 0; }
    31.4%, 46.6% { opacity: 1; }
    48%, 68% { opacity: 0; }
    69.4%, 80.6% { opacity: 1; }
    82%, 100% { opacity: 0; }
  }
  @keyframes turn-demo-drift-event-1 { 0% { opacity: 1; } 40% { opacity: 0; } }
  @keyframes turn-demo-drift-event-2 { 0% { opacity: 0; } 40% { opacity: 1; } 68% { opacity: 0; } }
  @keyframes turn-demo-drift-event-3 { 0% { opacity: 0; } 68% { opacity: 1; } }
  /* The gauge unfolds over 140 ms as a slide starts, and folds away 180 ms after a bank
     leaves nothing live and no COMBO held. */
  @keyframes turn-demo-drift-gauge {
    0%, 6% { opacity: 0; transform: scaleX(0); }
    7.4%, 31.8% { opacity: 0.75; transform: scaleX(1); }
    33.2%, 40% { opacity: 0; transform: scaleX(0); }
    41.4%, 84% { opacity: 0.79; transform: scaleX(1); }
    85.4%, 100% { opacity: 0; transform: scaleX(0); }
  }
  @keyframes turn-demo-drift-gauge-fill {
    0%, 6% { transform: scaleX(0); }
    28%, 30% { transform: scaleX(0.8); }
    31%, 44% { transform: scaleX(0); }
    66%, 68% { transform: scaleX(0.95); }
    69%, 100% { transform: scaleX(0); }
  }

  /* FLOW, 6 s: each different technique raises COMBO, and the score grows faster. */
  details[open] .turn-demo-score[data-demo="flow"] { animation: turn-demo-flow-score 6s steps(1, end) infinite; }
  details[open] .turn-demo-score[data-demo="flow"] .is-values .turn-demo-swap > :nth-child(1) { animation: turn-demo-flow-step-1 6s steps(1, end) infinite; }
  details[open] .turn-demo-score[data-demo="flow"] .is-values .turn-demo-swap > :nth-child(2) { animation: turn-demo-flow-step-2 6s steps(1, end) infinite; }
  details[open] .turn-demo-score[data-demo="flow"] .is-values .turn-demo-swap > :nth-child(3) { animation: turn-demo-flow-step-3 6s steps(1, end) infinite; }
  details[open] .turn-demo-score[data-demo="flow"] .turn-demo-callout { animation: turn-demo-flow-callout 6s steps(1, end) infinite; }
  details[open] .turn-demo-score[data-demo="flow"] .turn-demo-callout .turn-demo-swap > :first-child { animation: turn-demo-flow-label-1 6s steps(1, end) infinite; }
  details[open] .turn-demo-score[data-demo="flow"] .turn-demo-callout .turn-demo-swap > :last-child { animation: turn-demo-flow-label-2 6s steps(1, end) infinite; }
  @keyframes turn-demo-flow-score {
    0% { --turn-demo-score: 0; }
    20% { --turn-demo-score: 140; }
    45% { --turn-demo-score: 390; }
    70% { --turn-demo-score: 760; }
  }
  @keyframes turn-demo-flow-step-1 { 0% { opacity: 1; } 45% { opacity: 0; } }
  @keyframes turn-demo-flow-step-2 { 0% { opacity: 0; } 45% { opacity: 1; } 70% { opacity: 0; } }
  @keyframes turn-demo-flow-step-3 { 0% { opacity: 0; } 70% { opacity: 1; } }
  @keyframes turn-demo-flow-callout { 0% { opacity: 0; } 45% { opacity: 1; } 62% { opacity: 0; } 70% { opacity: 1; } 90% { opacity: 0; } }
  @keyframes turn-demo-flow-label-1 { 0% { opacity: 1; } 70% { opacity: 0; } }
  @keyframes turn-demo-flow-label-2 { 0% { opacity: 0; } 70% { opacity: 1; } }
  details[open] .turn-demo-score[data-demo="flow"] .turn-demo-gauge { animation: turn-demo-flow-gauge 6s linear infinite; }
  details[open] .turn-demo-score[data-demo="flow"] .turn-demo-gauge > i { animation: turn-demo-flow-gauge-fill 6s linear infinite; }
  @keyframes turn-demo-flow-gauge {
    0%, 20% { opacity: 0; transform: scaleX(0); }
    22.3%, 45% { opacity: 0.75; transform: scaleX(1); }
    45.1%, 70% { opacity: 0.79; transform: scaleX(1); }
    70.1%, 96% { opacity: 0.82; transform: scaleX(1); }
    98.3%, 100% { opacity: 0; transform: scaleX(0); }
  }
  @keyframes turn-demo-flow-gauge-fill {
    0%, 20% { transform: scaleX(0); }
    23%, 45% { transform: scaleX(0.35); }
    48%, 70% { transform: scaleX(0.62); }
    73%, 96% { transform: scaleX(0.9); }
    98.3%, 100% { transform: scaleX(0); }
  }

  .turn-demo {
    --turn-demo-released: inset 0 0 0 0 transparent;
    --turn-demo-pressed-pill: 0 0 0 3px var(--turn-surface-page), 0 0 0 5px var(--turn-outline);
  }

  /* Reduced Motion: one still frame each. DRIFT out into LOCK; SHIFT on; DRIFT filling
     BOOST, or building OVERCHARGE past a full bar; STEERING CENTRED with RECALIBRATE
     held highlighted, as the race does under Reduced Motion. */
  @media (prefers-reduced-motion: reduce) {
    .turn-demo,
    .turn-demo *,
    .turn-demo *::after { animation: none !important; }
    /* A replay changes state at once; its steering still moves, since that is the lap. */
    .turn-demo-stack[data-demo="replay"] :is(.turn-demo-thumb, .turn-demo-bubble) { transition: none; }
    .turn-demo-stack[data-demo="drive"] .turn-demo-thumb { left: -12%; top: 16%; }
    .turn-demo-stack:is([data-demo="drive"], [data-demo="boost"], [data-demo="overcharge"]) .turn-demo-pad { border-top-left-radius: 0; }
    .turn-demo-stack:is([data-demo="drive"], [data-demo="boost"], [data-demo="overcharge"]) .is-drift { box-shadow: var(--turn-drive-zone-pressed); }
    .turn-demo-stack:is([data-demo="drive"], [data-demo="boost"], [data-demo="overcharge"]) .is-lock { opacity: 1; transform: var(--turn-demo-out); }
    .turn-demo-stack[data-demo="drive"] .is-lock {
      background-color: var(--turn-control-overcharge);
      box-shadow: var(--turn-drive-bubble-pressed);
    }
    .turn-demo-stack[data-demo="shift"] .turn-demo-thumb { left: -13%; top: 54%; }
    .turn-demo-stack[data-demo="shift"] .is-shift { background-color: var(--turn-control-shift-on); }
    .turn-demo-stack[data-demo="shift"] .is-shift i { width: 0.72em; opacity: 1; }
    .turn-demo-stack:is([data-demo="boost"], [data-demo="overcharge"]) .turn-demo-thumb { left: 25%; top: 16%; }
    .turn-demo-stack:is([data-demo="boost"], [data-demo="overcharge"]) .turn-demo-bar > i::after { opacity: 1; }
    .turn-demo-stack[data-demo="boost"] { --turn-demo-charge: 0.6; }
    .turn-demo-stack[data-demo="overcharge"] .turn-demo-bar { width: 130%; }
    .turn-demo-stack[data-demo="overcharge"] .turn-demo-bar > b { opacity: 1; }
    .turn-demo-stack[data-demo="overcharge"] .turn-demo-bar > i { left: 21.375px; }
    .turn-demo-steer .turn-demo-device { transform: rotate(7deg); }
    .turn-demo-steer .turn-demo-device > i::after { transform: rotate(-7deg); }
    .turn-demo-steer .turn-demo-message { opacity: 1; }
    .turn-demo-steer .turn-demo-recalibrate { background-color: var(--yellow); color: var(--turn-ink); }
    .turn-demo-manual-steer:not(.is-replay) > i { left: 24%; }
    .turn-demo-score[data-demo="drift"] { --turn-demo-score: 420; }
    .turn-demo-score[data-demo="drift"] .turn-demo-callout { display: none; }
    .turn-demo-score[data-demo="drift"] .turn-demo-swap > * { opacity: 0; }
    .turn-demo-score[data-demo="drift"] .turn-demo-swap > :nth-child(2) { opacity: 1; }
    .turn-demo-score[data-demo="drift"] .turn-demo-gauge { opacity: 0.79; transform: none; }
    .turn-demo-score[data-demo="drift"] .turn-demo-gauge > i { transform: scaleX(0.7); }
    .turn-demo-score[data-demo="flow"] { --turn-demo-score: 760; }
    .turn-demo-score[data-demo="flow"] .turn-demo-swap > * { opacity: 0; }
    .turn-demo-score[data-demo="flow"] .turn-demo-swap > :last-child,
    .turn-demo-score[data-demo="flow"] .turn-demo-callout { opacity: 1; }
    .turn-demo-score[data-demo="flow"] .turn-demo-gauge { opacity: 0.82; transform: none; }
    .turn-demo-score[data-demo="flow"] .turn-demo-gauge > i { transform: scaleX(0.9); }
  }

  /* Forced colours drop fills and shadows: the thumb and the fill take Highlight. */
  @media (forced-colors: active) {
    .turn-demo-thumb { forced-color-adjust: none; border-color: CanvasText; background: Highlight; box-shadow: none; }
    .turn-demo-bar > i { forced-color-adjust: none; background: Highlight; }
    .turn-demo-bar > i::after { display: none; }
    .turn-demo-bar > b { forced-color-adjust: none; background: CanvasText; }
    .turn-demo-gauge { forced-color-adjust: none; border-color: CanvasText; background: Canvas; }
    .turn-demo-gauge::before,
    .turn-demo-gauge > i { forced-color-adjust: none; background: Highlight; }
  }
`;

function installStyles(documentRef) {
  if (documentRef.getElementById(STYLE_ID)) return;
  const style = documentRef.createElement('style');
  style.id = STYLE_ID;
  style.textContent = STYLES;
  documentRef.head.appendChild(style);
}

function demoElement(className, documentRef) {
  installStyles(documentRef);
  const demo = documentRef.createElement('div');
  demo.className = `turn-demo ${className}`.trim();
  demo.setAttribute('aria-hidden', 'true');
  return demo;
}

// kind: 'drive' (GAS, DRIFT into LOCK, BOOST, BRAKE into REVERSE), 'shift', or 'boost'
// and 'overcharge', which add the BOOST bar above the pad; 'replay' is SPECTATE's, set
// from a recorded lap.
export function createDrivePadDemo(kind, documentRef = globalThis.document) {
  const demo = demoElement('', documentRef);
  const bar = kind === 'boost' || kind === 'overcharge';
  demo.innerHTML = `
    <div class="turn-demo-stack${bar ? ' has-bar' : ''}" data-demo="${kind}">
      ${bar ? '<div class="turn-demo-bar"><b></b><i></i></div>' : ''}
      <span class="turn-demo-bubble is-lock"><b>LOCK</b></span>
      <span class="turn-demo-bubble is-shift"><b>SHIFT<i>●</i></b></span>
      <span class="turn-demo-bubble is-reverse"><b>R</b></span>
      <div class="turn-demo-pad">
        <span class="is-drift">DRIFT</span><span class="is-boost">BOOST</span>
        <span class="is-gas">GAS</span>
        <span class="is-brake">BRAKE</span>
      </div>
      <i class="turn-demo-thumb"></i>
    </div>`;
  return demo;
}

// STEER: the device turns, then RECALIBRATE centres it.
export function createSteerDemo(documentRef = globalThis.document) {
  const demo = demoElement('turn-demo-steer', documentRef);
  demo.innerHTML = `
    <span class="turn-demo-message">STEERING CENTRED</span>
    <span class="turn-demo-device"><i></i></span>
    <span class="turn-demo-recalibrate">RECALIBRATE</span>`;
  return demo;
}

// RIVALS: your place among your rivals, and your record.
export function createRivalsDemo(documentRef = globalThis.document) {
  const demo = demoElement('turn-demo-rivals', documentRef);
  demo.innerHTML = `
    <span class="turn-demo-chip">POSITION<strong>2/5</strong></span>
    <span class="turn-demo-chip">BEST<strong>0:39.874</strong></span>`;
  return demo;
}

// DRIFT ATTACK ('drift') or FLOW ('flow'): the race's scorekeeper, with its callout.
export function createScoreDemo(kind, documentRef = globalThis.document) {
  const demo = demoElement('turn-demo-score', documentRef);
  demo.dataset.demo = kind;
  const drift = kind === 'drift';
  demo.innerHTML = drift ? `
    <div class="turn-demo-scorekeeper">
      <div class="turn-demo-paper">
        <div class="is-heading"><span>DRIFT</span><span>COMBO</span></div>
        <div class="is-values"><strong></strong><b class="turn-demo-swap"><i>×1</i><i>×2</i></b></div>
        <div class="is-record is-lap"><span>LAP:</span><b class="turn-demo-swap"><i>1,240</i><i>1,540</i><i>2,140</i></b></div>
        <div class="is-record"><span>LAST:</span><b>1,905</b></div>
        <div class="is-record"><span>BEST:</span><b>2,480</b></div>
      </div>
      <div class="turn-demo-gauge"><i></i></div>
    </div>
    <div class="turn-demo-callout"><span class="turn-demo-swap">
      <span><strong>✓ BANKED</strong><b>+300</b></span>
      <span><strong>DRIFT ×2</strong></span>
      <span><strong>✓ BANKED ×2</strong><b>+600</b></span>
    </span></div>` : `
    <div class="turn-demo-scorekeeper">
      <div class="turn-demo-paper">
        <div class="is-heading"><span>FLOW</span><span>COMBO</span></div>
        <div class="is-values"><strong></strong><b class="turn-demo-swap"><i>×1</i><i>×2</i><i>×3</i></b></div>
        <div class="is-record"><span>LAP:</span><b>3,410</b></div>
        <div class="is-record"><span>LAST:</span><b>2,960</b></div>
        <div class="is-record"><span>BEST:</span><b>4,125</b></div>
      </div>
      <div class="turn-demo-gauge"><i></i></div>
    </div>
    <div class="turn-demo-callout"><strong class="turn-demo-swap"><i>FLOW ×2</i><i>FLOW ×3</i></strong></div>`;
  return demo;
}

// STEER with on-screen steering: the race's steering control, dragged left and right,
// or, as a replay's, held where the lap's steering puts it.
export function createManualSteerDemo(documentRef = globalThis.document, { replay = false } = {}) {
  const demo = demoElement('', documentRef);
  demo.innerHTML = `<div class="turn-demo-manual-steer${replay ? ' is-replay' : ''}"><span>←</span><span>→</span><i></i></div>`;
  return demo;
}

// The phone alone, tilted by a replay's steering (#1217).
export function createTiltDemo(documentRef = globalThis.document) {
  const demo = demoElement('turn-demo-tilt', documentRef);
  demo.innerHTML = '<span class="turn-demo-device"><i></i></span>';
  return demo;
}
