// HOW TO PLAY demos (#748): small copies of the drive pad and the BOOST bar that act out
// what a card explains: a thumb sliding between the zones, LOCK, SHIFT and REVERSE
// sliding out, DRIFT filling BOOST and OVERCHARGE growing past it. They mirror the race
// controls (drive-pad.css, gameplay-v2.css) at the same sizes and in the same colour
// roles, light and dark, and follow the left-handed layout. They are pictures: hidden
// from assistive technology, since the card's text says the same, and built from their
// own classes, so nothing that looks for the real drive pad or BOOST bar finds them.
// They move only while their card is open; with Reduced Motion each is one still frame.
const STYLE_ID = 'turn-how-to-play-demo-styles';

const STYLES = `
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
    grid-template: 32% 44% 24% / 1fr 1fr;
    border: 4px solid var(--turn-outline);
    border-radius: 22.5px;
    background: var(--turn-control-gas);
    box-shadow: 5.25px 6px 0 var(--turn-shadow-color);
    font-size: max(var(--turn-text-floor, 11px), 0.585rem);
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
    border-right: 2px solid var(--turn-outline);
    background-color: var(--turn-control-drift);
  }
  .turn-demo-pad > .is-boost {
    border-left: 2px solid var(--turn-outline);
    background-color: var(--turn-control-boost);
  }
  .turn-demo-pad > :is(.is-gas, .is-brake) {
    grid-column: 1 / -1;
    border-top: 4px solid var(--turn-outline);
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
    border: 4px solid var(--turn-outline);
    border-radius: 749.25px 0 0 749.25px;
    color: var(--turn-ink);
    font-size: max(var(--turn-text-floor, 11px), 0.435rem);
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
  :root.turn-left-handed-controls .turn-demo-pad { box-shadow: -5.25px 6px 0 var(--turn-shadow-color); }
  :root.turn-left-handed-controls .turn-demo-pad > span,
  :root.turn-left-handed-controls .turn-demo-bubble.is-reverse > b { transform: scaleX(-1); }
  :root.turn-left-handed-controls .turn-demo-bubble > b { transform: scaleX(-1) rotate(-90deg); }

  /* Motion copies the race (drive-pad.css). A bubble slides out over 140 ms on the
     pad's curve from its edge and fades in over 80 ms; LOCK, SHIFT and REVERSE change
     colour over 100 ms; a pressed zone, its ring and the pad's corner change at once.
     Each changes as the thumb crosses into or out of its zone. */
  .turn-demo {
    --turn-demo-tucked: translateX(62%) scaleX(0.38);
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
    0%, 61.5%, 94.5% { box-shadow: var(--turn-demo-pressed); }
    12%, 69.5% { box-shadow: var(--turn-demo-released); }
  }
  @keyframes turn-demo-drive-drift {
    0%, 47% { box-shadow: var(--turn-demo-released); }
    12% { box-shadow: var(--turn-demo-pressed); }
  }
  @keyframes turn-demo-drive-boost {
    0%, 61.5% { box-shadow: var(--turn-demo-released); background-color: var(--turn-control-boost); }
    47% { box-shadow: var(--turn-demo-pressed); background-color: var(--turn-yellow-600); }
  }
  @keyframes turn-demo-drive-brake {
    0%, 94.5% { box-shadow: var(--turn-demo-released); }
    69.5% { box-shadow: var(--turn-demo-pressed); }
  }
  @keyframes turn-demo-drive-corners {
    0%, 47%, 94.5% { border-top-left-radius: 22.5px; border-bottom-left-radius: 22.5px; }
    12% { border-top-left-radius: 0; border-bottom-left-radius: 22.5px; }
    69.5% { border-top-left-radius: 22.5px; border-bottom-left-radius: 0; }
  }
  @keyframes turn-demo-drive-lock-slide {
    0%, 12% { transform: translateX(62%) scaleX(0.38); animation-timing-function: cubic-bezier(0.2, 0.88, 0.25, 1); }
    13.4%, 47% { transform: translateX(0) scaleX(1); animation-timing-function: cubic-bezier(0.2, 0.88, 0.25, 1); }
    48.4%, 100% { transform: translateX(62%) scaleX(0.38); }
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
    30% { box-shadow: var(--turn-demo-pressed-bubble); }
  }
  @keyframes turn-demo-drive-reverse-slide {
    0%, 69.5% { transform: translateX(62%) scaleX(0.38); animation-timing-function: cubic-bezier(0.2, 0.88, 0.25, 1); }
    70.9%, 94.5% { transform: translateX(0) scaleX(1); animation-timing-function: cubic-bezier(0.2, 0.88, 0.25, 1); }
    95.9%, 100% { transform: translateX(62%) scaleX(0.38); }
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
    82% { box-shadow: var(--turn-demo-pressed-bubble); }
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
    0%, 33.5%, 73.5% { box-shadow: var(--turn-demo-pressed); }
    18.5%, 58.5% { box-shadow: var(--turn-demo-released); }
  }
  @keyframes turn-demo-shift-on {
    0%, 18.5% { background-color: var(--turn-control-gas); animation-timing-function: ease; }
    20.2%, 58.5% { background-color: var(--turn-control-shift-on); animation-timing-function: ease; }
    60.2%, 100% { background-color: var(--turn-control-gas); }
  }
  @keyframes turn-demo-shift-dot {
    0%, 18.5% { width: 0; opacity: 0; animation-timing-function: ease; }
    20.2%, 58.5% { width: 0.72em; opacity: 1; animation-timing-function: ease; }
    60.2%, 100% { width: 0; opacity: 0; }
  }

  /* The BOOST bar, with the zone the thumb is on beneath it. */
  .turn-demo-boost {
    flex-direction: column;
    align-items: center;
    gap: var(--turn-space-2);
  }
  .turn-demo-boost > span {
    padding: 1.5px 6px 2.25px;
    border: 2px solid var(--turn-outline);
    border-radius: 749.25px;
    background: var(--turn-surface-page);
    box-shadow: 1.5px 1.5px 0 var(--turn-shadow-color);
    font-size: var(--turn-text-floor, 11px);
    font-weight: 800;
    letter-spacing: 0.08em;
  }
  .turn-demo-bar {
    position: relative;
    box-sizing: border-box;
    width: 150px;
    height: 20px;
    overflow: hidden;
    border: 3px solid var(--turn-outline);
    border-radius: 749.25px;
    background: var(--turn-surface-page);
    box-shadow: 2.25px 2.25px 0 var(--turn-shadow-color);
  }
  /* OVERCHARGE: the bar grows past full at both ends, in purple. */
  .turn-demo-bar > b {
    position: absolute;
    inset: 0;
    opacity: 0;
    background: linear-gradient(90deg,
      var(--turn-demo-overcharge-deep) 0%, var(--turn-control-overcharge) 4%, var(--turn-demo-overcharge-light) 9%,
      var(--turn-demo-overcharge-light) 91%, var(--turn-control-overcharge) 96%, var(--turn-demo-overcharge-deep) 100%);
  }
  .turn-demo-bar > i {
    position: absolute;
    inset: 0 auto 0 0;
    width: 144px;
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
  .turn-demo-zones {
    display: flex;
    gap: var(--turn-space-2);
  }
  .turn-demo-zones > span {
    padding: 3px 9px 4px;
    border: 2px solid var(--turn-outline);
    border-radius: 749.25px;
    color: var(--turn-ink);
    font-size: var(--turn-text-floor, 11px);
    font-weight: 900;
    letter-spacing: 0.04em;
    opacity: 0.38;
  }
  .turn-demo-zones > .is-drift { background-color: var(--turn-control-drift); }
  .turn-demo-zones > .is-gas { background-color: var(--turn-control-gas); }
  .turn-demo-zones > .is-boost { background-color: var(--turn-control-boost); }

  /* OVERCHARGE, 8 s: DRIFT fills BOOST, then builds OVERCHARGE past it; GAS catches it;
     BOOST spends OVERCHARGE first, then BOOST. Like the race's bar, the fill takes
     DRIFT's colours at once, and the bar turns purple at once. */
  details[open] .turn-demo-boost[data-demo="overcharge"] .turn-demo-bar { animation: turn-demo-overcharge-bar 8s ease-in-out infinite; }
  details[open] .turn-demo-boost[data-demo="overcharge"] .turn-demo-bar > b { animation: turn-demo-overcharge-purple 8s steps(1, end) infinite; }
  details[open] .turn-demo-boost[data-demo="overcharge"] .turn-demo-bar > i { animation: turn-demo-overcharge-fill 8s ease-in-out infinite; }
  details[open] .turn-demo-boost[data-demo="overcharge"] .turn-demo-bar > i::after { animation: turn-demo-overcharge-drift 8s steps(1, end) infinite; }
  details[open] .turn-demo-boost[data-demo="overcharge"] .turn-demo-zones > .is-drift { animation: turn-demo-overcharge-on-drift 8s steps(1, end) infinite; }
  details[open] .turn-demo-boost[data-demo="overcharge"] .turn-demo-zones > .is-gas { animation: turn-demo-overcharge-on-gas 8s steps(1, end) infinite; }
  details[open] .turn-demo-boost[data-demo="overcharge"] .turn-demo-zones > .is-boost { animation: turn-demo-overcharge-on-boost 8s steps(1, end) infinite; }
  @keyframes turn-demo-overcharge-bar {
    0%, 30%, 74%, 100% { width: 150px; }
    48%, 62% { width: 195px; }
  }
  @keyframes turn-demo-overcharge-purple {
    0%, 74% { opacity: 0; }
    30% { opacity: 1; }
  }
  @keyframes turn-demo-overcharge-fill {
    0% { left: 0; width: 22px; }
    30% { left: 0; width: 144px; }
    48%, 62% { left: 22.5px; width: 144px; }
    74% { left: 0; width: 144px; }
    90%, 100% { left: 0; width: 22px; }
  }
  @keyframes turn-demo-overcharge-drift {
    0%, 96% { opacity: 1; }
    48% { opacity: 0; }
  }
  @keyframes turn-demo-overcharge-on-drift {
    0%, 96% { opacity: 1; box-shadow: var(--turn-demo-pressed-pill); }
    48% { opacity: 0.38; box-shadow: none; }
  }
  @keyframes turn-demo-overcharge-on-gas {
    0%, 62% { opacity: 0.38; box-shadow: none; }
    48% { opacity: 1; box-shadow: var(--turn-demo-pressed-pill); }
  }
  @keyframes turn-demo-overcharge-on-boost {
    0%, 90% { opacity: 0.38; box-shadow: none; }
    62% { opacity: 1; box-shadow: var(--turn-demo-pressed-pill); }
  }

  .turn-demo {
    --turn-demo-pressed: inset 0 0 0 4.5px color-mix(in srgb, var(--turn-paper) 78%, transparent);
    --turn-demo-released: inset 0 0 0 0 transparent;
    --turn-demo-pressed-bubble: inset 0 0 0 3.75px color-mix(in srgb, var(--turn-paper) 62%, transparent);
    --turn-demo-pressed-pill: 0 0 0 3px var(--turn-surface-page), 0 0 0 5px var(--turn-outline);
    --turn-demo-overcharge-deep: color-mix(in oklab, var(--turn-control-overcharge) 72%, var(--turn-ink));
    --turn-demo-overcharge-light: color-mix(in oklab, var(--turn-control-overcharge) 40%, var(--turn-paper));
  }

  /* Reduced Motion: one still frame each. DRIFT out into LOCK; SHIFT on; DRIFT building
     OVERCHARGE past a full bar. */
  @media (prefers-reduced-motion: reduce) {
    .turn-demo,
    .turn-demo *,
    .turn-demo *::after { animation: none !important; }
    .turn-demo-stack[data-demo="drive"] .turn-demo-thumb { left: -12%; top: 16%; }
    .turn-demo-stack[data-demo="drive"] .turn-demo-pad { border-top-left-radius: 0; }
    .turn-demo-stack[data-demo="drive"] .is-drift { box-shadow: var(--turn-demo-pressed); }
    .turn-demo-stack[data-demo="drive"] .is-lock {
      opacity: 1;
      transform: var(--turn-demo-out);
      background-color: var(--turn-control-overcharge);
      box-shadow: var(--turn-demo-pressed-bubble);
    }
    .turn-demo-stack[data-demo="shift"] .turn-demo-thumb { left: -13%; top: 54%; }
    .turn-demo-stack[data-demo="shift"] .is-shift { background-color: var(--turn-control-shift-on); }
    .turn-demo-stack[data-demo="shift"] .is-shift i { width: 0.72em; opacity: 1; }
    .turn-demo-boost[data-demo="overcharge"] .turn-demo-bar { width: 195px; }
    .turn-demo-boost[data-demo="overcharge"] .turn-demo-bar > b { opacity: 1; }
    .turn-demo-boost[data-demo="overcharge"] .turn-demo-bar > i { left: 22.5px; }
    .turn-demo-boost[data-demo="overcharge"] .turn-demo-bar > i::after { opacity: 1; }
    .turn-demo-boost[data-demo="overcharge"] .turn-demo-zones > .is-drift { opacity: 1; box-shadow: var(--turn-demo-pressed-pill); }
  }

  /* Forced colours drop fills and shadows: the thumb and the fill take Highlight, and
     the zone in use keeps its outline. */
  @media (forced-colors: active) {
    .turn-demo-thumb { forced-color-adjust: none; border-color: CanvasText; background: Highlight; box-shadow: none; }
    .turn-demo-bar > i { forced-color-adjust: none; background: Highlight; }
    .turn-demo-bar > i::after { display: none; }
    .turn-demo-bar > b { forced-color-adjust: none; background: CanvasText; }
  }
`;

function installStyles(documentRef) {
  if (documentRef.getElementById(STYLE_ID)) return;
  const style = documentRef.createElement('style');
  style.id = STYLE_ID;
  style.textContent = STYLES;
  documentRef.head.appendChild(style);
}

// kind: 'drive' (GAS, DRIFT into LOCK, BOOST, BRAKE into REVERSE) or 'shift'.
export function createDrivePadDemo(kind, documentRef = globalThis.document) {
  installStyles(documentRef);
  const demo = documentRef.createElement('div');
  demo.className = 'turn-demo';
  demo.setAttribute('aria-hidden', 'true');
  demo.innerHTML = `
    <div class="turn-demo-stack" data-demo="${kind}">
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

// The BOOST bar: DRIFT fills it and builds OVERCHARGE, GAS catches it, BOOST spends it.
export function createBoostBarDemo(documentRef = globalThis.document) {
  installStyles(documentRef);
  const demo = documentRef.createElement('div');
  demo.className = 'turn-demo turn-demo-boost';
  demo.dataset.demo = 'overcharge';
  demo.setAttribute('aria-hidden', 'true');
  demo.innerHTML = `
    <span>BOOST</span>
    <div class="turn-demo-bar"><b></b><i></i></div>
    <div class="turn-demo-zones"><span class="is-drift">DRIFT</span><span class="is-gas">GAS</span><span class="is-boost">BOOST</span></div>`;
  return demo;
}
