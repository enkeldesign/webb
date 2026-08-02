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
  'The feedback and About actions must be installed only after the fixed Home interface exists'
);

assert.match(feedback, /FEEDBACK_VERSION = 'r136-about-turn'/);
assert.match(feedback, /FEEDBACK_EMAIL = 'erik@enkel\.design'/);
assert.match(feedback, /feedbackTrigger\.textContent = 'GIVE FEEDBACK'/);
assert.match(feedback, /feedbackTrigger\.setAttribute\('aria-haspopup', 'dialog'\)/);
assert.match(feedback, /menu\.insertBefore\(feedbackTrigger, status\)/, 'GIVE FEEDBACK must sit with the other Home menu actions, before status and RACE');
assert.match(feedback, /dialog\.className = 'm8-dialog m8-feedback-dialog'/);
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

assert.match(feedback, /meta\.className = 'm8-home-meta'/);
assert.match(feedback, /buildLabel\.replaceWith\(meta\)/);
assert.match(feedback, /meta\.appendChild\(buildLabel\)/);
assert.match(feedback, /trigger\.className = 'm8-about-trigger'/);
assert.match(feedback, /trigger\.textContent = 'ABOUT TURN'/);
assert.match(feedback, /trigger\.setAttribute\('aria-haspopup', 'dialog'\)/);
assert.match(feedback, /meta\.appendChild\(trigger\)/, 'ABOUT TURN must appear directly under the build information');
assert.match(feedback, /dialog\.className = 'm8-dialog m8-about-dialog'/);
assert.match(feedback, /aria-labelledby', 'm8AboutTitle'/);
assert.match(feedback, /<h2 id="m8AboutTitle">ABOUT TURN<\/h2>/);
assert.match(feedback, /TURN is a racing game about tilt steering, personal rivals and learning to drive by ear/);

assert.match(feedback, /inclusive and universal design/);
assert.match(feedback, /accessibility built into the game from the start/);
assert.match(feedback, /© 2026/);
assert.match(feedback, /Created by Erik Jansson, aided by OpenAI Codex/);
assert.match(feedback, /Drive By Ear™ is inspired by/);
assert.match(feedback, /https:\/\/ceal\.cs\.columbia\.edu\/rad\//);
assert.match(feedback, /RAD – Racing Auditory Display/);
assert.equal(
  (feedback.match(/\$\{attributionMarkup\(\)\}/g) || []).length,
  2,
  'Attribution must remain available from both Give Feedback and About TURN'
);
assert.match(feedback, /dialog\.__turnReturnFocus\?\.focus\?\.\(\)/, 'Closing either modal must return focus to its trigger');
assert.match(feedback, /if \(event\.target === dialog\) closeDialog\(dialog\)/, 'Pressing a dialog backdrop should close it without hijacking content clicks');

assert.match(css, /\.m8-home-fixed-layout \.m8-feedback-button/);
assert.match(css, /\.m8-home-fixed-layout \.m8-home-meta[\s\S]*grid-column: 3[\s\S]*flex-direction: column/);
assert.match(css, /\.m8-home-fixed-layout \.m8-about-trigger[\s\S]*font-size: clamp\(0\.62rem, 1vw, 0\.82rem\)[\s\S]*text-decoration: underline/);
assert.match(css, /\.m8-feedback-dialog[\s\S]*width: min\(760px, calc\(100vw - 32px\)\)/);
assert.match(css, /\.m8-about-dialog[\s\S]*width: min\(660px, calc\(100vw - 32px\)\)/);
assert.match(css, /\.m8-feedback-email[\s\S]*background: var\(--m8-pink\)/);
assert.match(css, /\.m8-feedback-copy[\s\S]*background: var\(--m8-yellow\)/);
assert.match(css, /\.m8-feedback-attribution[\s\S]*border-top: 3px solid var\(--m8-ink\)/);
assert.match(css, /@media \(max-width: 760px\) and \(orientation: portrait\)[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/, 'Four Home menu actions should remain a readable two-by-two grid in portrait');
assert.match(css, /@media \(max-width: 760px\) and \(orientation: portrait\)[\s\S]*\.m8-home-fixed-layout \.m8-home-meta[\s\S]*display: none/, 'Header metadata must stay out of the compact portrait layout');
assert.doesNotMatch(`${feedback}\n${css}`, /setInterval|@keyframes|animation:/, 'Feedback and About must add no loop or decorative animation');

console.log('TURN inclusive Home feedback and About attribution regression passed.');
