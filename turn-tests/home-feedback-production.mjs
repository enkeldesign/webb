import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [app, feedback, css] = await Promise.all([
  fs.readFile(new URL('../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/ui/home-feedback.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/home-feedback-r135.css', import.meta.url), 'utf8')
]);

assert.match(app, /home-feedback-r135\.css\?revision=r135-inclusive-feedback/);
assert.match(app, /data-turn-home-feedback/);
assert.match(app, /home-feedback\.js\?revision=r135-inclusive-feedback/);
assert.match(app, /installHomeFeedback\(\)/);
assert.ok(
  app.indexOf('await installM8HomeFixedLayout()') < app.indexOf('installHomeFeedback()'),
  'The feedback button must be installed only after the fixed Home menu exists'
);

assert.match(feedback, /FEEDBACK_VERSION = 'r135-inclusive-feedback-attribution'/);
assert.match(feedback, /FEEDBACK_EMAIL = 'erik@enkel\.design'/);
assert.match(feedback, /trigger\.textContent = 'GIVE FEEDBACK'/);
assert.match(feedback, /trigger\.setAttribute\('aria-haspopup', 'dialog'\)/);
assert.match(feedback, /menu\.insertBefore\(trigger, status\)/, 'GIVE FEEDBACK must sit with the other Home menu actions, before status and RACE');
assert.match(feedback, /class="m8-dialog m8-feedback-dialog"/);
assert.match(feedback, /aria-labelledby', 'm8FeedbackTitle'/);
assert.match(feedback, /<h2 id="m8FeedbackTitle">GIVE FEEDBACK<\/h2>/);
assert.match(feedback, /Found a bug, an accessibility barrier or something that made TURN harder to use/);
assert.match(feedback, /Feature ideas and improvement suggestions are welcome too/);
assert.match(feedback, /Feedback from every kind of player helps make TURN better for everyone/);
assert.match(feedback, /Mention your device, browser or assistive technology when it is relevant/);
assert.match(feedback, /mailto:\$\{FEEDBACK_EMAIL\}\?subject=\$\{encodeURIComponent\(FEEDBACK_SUBJECT\)\}/);
assert.match(feedback, />EMAIL FEEDBACK<\/a>/);
assert.match(feedback, />COPY EMAIL ADDRESS<\/button>/);
assert.match(feedback, /navigator\?\.clipboard\?\.writeText/);
assert.match(feedback, /document\.execCommand\?\.\('copy'\)/, 'Copy email needs a fallback for browsers without the Clipboard API');
assert.match(feedback, /role="status" aria-live="polite"/);
assert.match(feedback, /Email address copied: \$\{FEEDBACK_EMAIL\}/);
assert.match(feedback, /inclusive and universal design/);
assert.match(feedback, /accessibility built into the game from the start/);
assert.match(feedback, /© 2026/);
assert.match(feedback, /Created by Erik Jansson, aided by OpenAI Codex/);
assert.match(feedback, /Drive By Ear™ is inspired by/);
assert.match(feedback, /https:\/\/ceal\.cs\.columbia\.edu\/rad\//);
assert.match(feedback, /RAD – Racing Auditory Display/);
assert.match(feedback, /dialog\.__turnReturnFocus\?\.focus\?\.\(\)/, 'Closing the modal must return focus to GIVE FEEDBACK');
assert.match(feedback, /if \(event\.target === dialog\) closeDialog\(dialog\)/, 'Pressing the backdrop should close the modal without hijacking content clicks');

assert.match(css, /\.m8-home-fixed-layout \.m8-feedback-button/);
assert.match(css, /\.m8-feedback-dialog[\s\S]*width: min\(760px, calc\(100vw - 32px\)\)/);
assert.match(css, /\.m8-feedback-email[\s\S]*background: var\(--m8-pink\)/);
assert.match(css, /\.m8-feedback-copy[\s\S]*background: var\(--m8-yellow\)/);
assert.match(css, /\.m8-feedback-attribution[\s\S]*border-top: 3px solid var\(--m8-ink\)/);
assert.match(css, /@media \(max-width: 760px\) and \(orientation: portrait\)[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/, 'Four Home actions should become a readable two-by-two grid in portrait');
assert.doesNotMatch(`${feedback}\n${css}`, /setInterval|@keyframes|animation:/, 'Feedback must add no loop or decorative animation');

console.log('TURN inclusive Home feedback and attribution regression passed.');
