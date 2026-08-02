import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [app, feedback, css] = await Promise.all([
  fs.readFile(new URL('../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/ui/home-feedback.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/home-feedback-r135.css', import.meta.url), 'utf8')
]);

assert.match(app, /home-feedback-r135\.css\?revision=r137-feedback-above-fold/);
assert.match(app, /data-turn-home-feedback/);
assert.match(app, /home-feedback\.js\?revision=r137-feedback-above-fold/);
assert.match(app, /installHomeFeedback\(\)/);
assert.ok(
  app.indexOf('await installM8HomeFixedLayout()') < app.indexOf('installHomeFeedback()'),
  'The feedback and About actions must be installed only after the fixed Home interface exists'
);

assert.match(feedback, /FEEDBACK_VERSION = 'r137-feedback-above-fold'/);
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
assert.match(feedback, /if \(card\) card\.scrollTop = 0/, 'Dialogs should always open at their top edge');

const feedbackDialogSource = feedback.slice(
  feedback.indexOf('function createFeedbackDialog()'),
  feedback.indexOf('function createAboutDialog()')
);
const aboutDialogSource = feedback.slice(
  feedback.indexOf('function createAboutDialog()'),
  feedback.indexOf('function installDialogBehavior(')
);

assert.doesNotMatch(feedbackDialogSource, /attributionMarkup|m8-feedback-attribution|© 2026|inclusive and universal design/, 'Give Feedback must contain feedback content only');
assert.match(aboutDialogSource, /\$\{attributionMarkup\(\)\}/, 'Attribution must live in About TURN');
assert.equal(
  (feedback.match(/\$\{attributionMarkup\(\)\}/g) || []).length,
  1,
  'Attribution must appear only in About TURN'
);

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
assert.match(feedback, /inclusive and universal design so everyone can play/);
assert.match(feedback, /regardless of ability or how they interact with the game/);
assert.doesNotMatch(feedback, /accessibility built into the game from the start/);
assert.match(feedback, /© 2026/);
assert.match(feedback, /Created by Erik Jansson, aided by OpenAI Codex/);
assert.match(feedback, /Drive By Ear™ is inspired by/);
assert.match(feedback, /https:\/\/ceal\.cs\.columbia\.edu\/rad\//);
assert.match(feedback, /RAD – Racing Auditory Display/);
assert.match(feedback, /dialog\.__turnReturnFocus\?\.focus\?\.\(\)/, 'Closing either modal must return focus to its trigger');
assert.match(feedback, /if \(event\.target === dialog\) closeDialog\(dialog\)/, 'Pressing a dialog backdrop should close it without hijacking content clicks');

assert.match(css, /\.m8-home-fixed-layout \.m8-feedback-button/);
assert.match(css, /\.m8-home-fixed-layout \.m8-home-meta[\s\S]*grid-column: 3[\s\S]*flex-direction: column/);
assert.match(css, /\.m8-home-fixed-layout \.m8-about-trigger[\s\S]*font-size: clamp\(0\.62rem, 1vw, 0\.82rem\)[\s\S]*text-decoration: underline/);
assert.match(css, /\.m8-feedback-dialog[\s\S]*width: min\(760px, calc\(100vw - 32px\)\)/);
assert.match(css, /\.m8-about-dialog[\s\S]*width: min\(660px, calc\(100vw - 32px\)\)/);
assert.match(css, /\.m8-feedback-dialog \.m8-dialog-head[\s\S]*margin-bottom: clamp\(14px, 2vh, 20px\)/, 'Feedback heading spacing should stay compact');
assert.match(css, /\.m8-feedback-actions[\s\S]*margin-top: clamp\(16px, 2\.5vh, 22px\)/, 'Feedback actions should remain close to the copy');
assert.match(css, /\.m8-feedback-status[\s\S]*min-height: 0[\s\S]*margin-top: 0 !important/);
assert.match(css, /\.m8-feedback-status:not\(:empty\)[\s\S]*min-height: 1\.5em/, 'The live region should consume space only when it has a message');
assert.doesNotMatch(css, /\.m8-feedback-attribution/, 'Removed feedback attribution must leave no stale layout rules');
assert.match(css, /\.m8-feedback-email[\s\S]*background: var\(--m8-pink\)/);
assert.match(css, /\.m8-feedback-copy[\s\S]*background: var\(--m8-yellow\)/);
assert.match(css, /@media \(max-width: 760px\) and \(orientation: portrait\)[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/, 'Four Home menu actions should remain a readable two-by-two grid in portrait');
assert.match(css, /@media \(max-width: 760px\) and \(orientation: portrait\)[\s\S]*\.m8-home-fixed-layout \.m8-home-meta[\s\S]*display: none/, 'Header metadata must stay out of the compact portrait layout');
assert.doesNotMatch(`${feedback}\n${css}`, /setInterval|@keyframes|animation:/, 'Feedback and About must add no loop or decorative animation');

console.log('TURN compact Home feedback and About-only attribution regression passed.');
