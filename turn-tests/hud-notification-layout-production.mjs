import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [runtime, components, css, scoreFeedback, scorekeeper] = await Promise.all([
  fs.readFile(new URL('../turn/ui/hud-notification-runtime.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/ui/hud-notifications.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/hud-notifications.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/scoring/score-feedback.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/scoring/scorekeeper-records.js', import.meta.url), 'utf8')
]);

// Component 1: one race-status slot takes over the complete normal stats footprint.
assert.match(runtime, /controller\.elementFor\(HUD_NOTIFICATION_SLOT\.RACE_STATUS\)/);
assert.match(runtime, /stats\.classList\?\.add\?\('turn-hud-race-status-host'\)/);
assert.match(runtime, /stats\.append\(statusSlot\)/,
  'Race status is physically hosted by .stats instead of guessing its viewport geometry');
assert.match(css, /\.stats\.turn-hud-race-status-host > \.turn-hud-notification-slot\[data-slot="race-status"\] \{[\s\S]*?inset: 0;[\s\S]*?width: 100%;[\s\S]*?height: 100%;/,
  'Component 1 covers speed/lap/time/best exactly');
assert.match(runtime, /makeLapResultBody/);
assert.match(runtime, /'LAP', `\$\{place\}\/\$\{total\} · \$\{formatLapTime\(result\.time\)\}`/);
assert.match(runtime, /\[\['DRIFT', result\.drift\], \['FLOW', result\.flow\]\]/,
  'Lap status reuses both scoring result channels');
assert.match(runtime, /kicker: 'LAP VOID'/);
assert.match(runtime, /STAY ON THE TRACK!/);

// Component 2: one GO!-derived pill owns all race cues, including legacy producers
// and the prepared CHASE YOUR BEST viewer.
assert.match(components, /RACE_CUE: 'race-cue'/);
assert.match(css, /data-slot="race-cue"[\s\S]*?--turn-hud-notification-radius: var\(--turn-radius-pill, 999px\)/,
  'Race cues retain the maximally rounded GO! silhouette');
assert.match(runtime, /legacy-message:\$\{copy\}/,
  'Existing #message producers migrate into the shared race-cue component');
assert.match(runtime, /PATIENT ON BOARD\|MAYDAY\|SECONDS/,
  'MAYDAY guidance has explicit danger semantics rather than a one-off visual');
assert.match(runtime, /rival\.classList\.add\('turn-hud-notification', 'turn-hud-rival-cue'\)/,
  'CHASE YOUR BEST reuses Component 2 without throwing away its warmed 3D viewer');
assert.match(css, /\.turn-hud-rival-cue \{[\s\S]*?position: relative !important;/);

// Component 3: one smaller progression surface, queued by the shared controller.
assert.match(components, /\[HUD_NOTIFICATION_SLOT\.PROGRESSION\]: 'queue'/);
assert.match(runtime, /reward \? HUD_NOTIFICATION_KIND\.REWARD : HUD_NOTIFICATION_KIND\.ACHIEVEMENT/);
assert.match(css, /data-slot="progression"[\s\S]*?width: min\(500px, 44vw\);[\s\S]*?min-height: 56px;/,
  'Progression is deliberately smaller than the old toast footprint');
assert.match(runtime, /toast\.setAttribute\?\.\('aria-hidden', 'true'\)/,
  'The hidden legacy progression node cannot duplicate the shared accessible announcement');
assert.match(runtime, /onActivate: \(\) => toast\.click\?\.\(\)/,
  'Reward notification actions retain the existing feature-owned interaction');

// Component 4: fixed channel-local event plates live inside each scorekeeper paper
// and cover BEST, never the large live score.
assert.match(scorekeeper, /ensureEventCallout\(documentRef, root, 'drift'\)/);
assert.match(scorekeeper, /ensureEventCallout\(documentRef, root, 'flow'\)/);
assert.match(scorekeeper, /data-score-feedback-\$\{channel\}-callout/);
assert.match(scoreFeedback, /const activeEvents = \{/);
assert.match(scoreFeedback, /renderEventCallout\(SCORE_FEEDBACK_CHANNEL\.DRIFT\)/);
assert.match(scoreFeedback, /renderEventCallout\(SCORE_FEEDBACK_CHANNEL\.FLOW\)/);
assert.match(css, /\.turn-score-event-callout \{[\s\S]*?right: 7px;[\s\S]*?bottom: 6px;/,
  'Right-handed scoring callouts occupy the BEST corner');
assert.match(scoreFeedback, /setText\(currentScore, formatScore\(liveScore\)\)/);
assert.match(scoreFeedback, /setText\(flowCurrentScore, formatScore\(liveScore\)\)/,
  'Local callout rendering does not replace either channel live value');

// The complete asymmetric notification composition mirrors from the existing root
// handedness state. Component 1 follows .topbar/.stats automatically.
assert.match(css, /:root\.turn-left-handed-controls \.turn-hud-notification-slot\[data-slot="race-cue"\] \{[\s\S]*?right:/);
assert.match(css, /:root\.turn-left-handed-controls \.turn-hud-notification-slot\[data-slot="progression"\] \{[\s\S]*?right:/);
assert.match(css, /:root\.turn-left-handed-controls \.turn-score-event-callout \{[\s\S]*?right: auto;[\s\S]*?left: 7px;/);
assert.doesNotMatch(runtime, /insertBefore|after\(|before\(/,
  'Mirroring does not mutate semantic/focus order');

// Legacy visuals remain state/action sources during migration but no longer compete
// visually. Existing race/lap message announcers stay canonical where explicitly kept.
assert.match(css, /turn-hud-notifications-active \.lap-result-toast \{ display: none !important; \}/);
assert.match(css, /turn-hud-notifications-active \.turn-achievement-toast[\s\S]*?visibility: hidden !important;/);
assert.match(css, /turn-hud-notifications-active #message[\s\S]*?clip-path: inset\(50%\)/);
assert.match(runtime, /announce: false[\s\S]*Existing lap-result announcer remains the single speech owner/);
assert.match(runtime, /announce: false[\s\S]*#message remains the canonical polite speech source/);

assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?animation: none;/,
  'Shared notifications have a no-motion presentation path');
assert.doesNotMatch(css, /filter\s*:/,
  'The standardized HUD avoids compositor-expensive filters');
assert.match(scoreFeedback, /installHudNotificationRuntime/,
  'Production, TURN NEXT and TURN LAB activate the same notification composition through shared ScoreFeedback');
assert.match(runtime, /hud-notifications\.css\?revision=r266-standard-hud/,
  'The dynamically loaded notification CSS has an explicit release identity');

console.log('TURN standardized HUD notification layout regression passed.');
