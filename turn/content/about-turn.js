import { installTurnTelemetry } from '../telemetry/client.js?revision=r3-scoring-calibration';

installTurnTelemetry();
installSharedAboutStyles();

function installSharedAboutStyles() {
  if (document.querySelector('link[data-turn-about-privacy]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/turn/about-privacy.css?revision=r1';
  link.setAttribute('data-turn-about-privacy', '');
  document.head.appendChild(link);
}

export function aboutTurnHtml() {
  return `
    <div class="turn-about-shared-copy yourturn-about-copy">
      <p class="m8-about-lead">TURN is a racing game about tilt steering, personal rivals and learning to drive by ear.</p>
      <p class="m8-about-summary">Built through inclusive and universal design so players can use sight, sound, touch, motion, a keyboard or assistive technology.</p>
      <p class="m8-about-credits">© 2026 <a href="https://enkel.design/" target="_blank" rel="noreferrer">enkel.design</a>. Created by Erik Jansson, aided by OpenAI Codex. Game assets include <a href="https://kenney.nl" target="_blank" rel="noreferrer">Kenney Game Assets</a>. Drive By Ear™ is inspired by <a href="https://ceal.cs.columbia.edu/rad/" target="_blank" rel="noreferrer">RAD – Racing Auditory Display</a>.</p>
      <details class="turn-about-privacy">
        <summary>PRIVACY &amp; USAGE STATISTICS</summary>
        <div class="turn-about-privacy-copy">
          <p>TURN sends a few anonymous gameplay events to Cloudflare after a race starts so enkel.design can see whether the game is being played, which tracks and cars are used, and where the game may need improvement.</p>
          <p>The events can include TURN or YOUR TURN, app build, track, car, motion or manual steering, browser or installed web app, Drive By Ear and blank-screen state, valid or void laps, lap time, and eligible DRIFT or FLOW lap scores. Devices explicitly marked as developer in the private dashboard—or through TURN’s hidden admin test unlock—also send a developer yes/no flag so test activity can be excluded from player statistics.</p>
          <p>TURN’s analytics payload does not include your name, challenge name, challenge link or ID, replay, driving path, control inputs, advertising identifiers, IP address or precise location. Cloudflare processes normal network request information while carrying the events, but TURN does not add that information to its gameplay statistics.</p>
          <p>TURN sets no analytics cookie and creates no persistent analytics identifier. A random identifier exists only in memory for the current page load so events from that one play session can be grouped; it disappears when the page is closed or reloaded. A device marked as developer stores only the same local yes/no marker used by every developer device, not a unique identifier.</p>
          <p>TURN keeps anonymous daily aggregate statistics in Cloudflare D1 for the private developer dashboard. It does not keep raw gameplay-event histories in that database. The statistics are not public and are not used for advertising.</p>
        </div>
      </details>
    </div>`;
}
