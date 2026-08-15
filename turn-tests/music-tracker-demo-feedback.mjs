import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [index, bootstrap, audio, css] = await Promise.all([
  fs.readFile(new URL('../turn/audio/music/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/audio/music/tracker-demo-feedback-r204.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/audio/music/tracker-audio.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/audio/music/tracker-demo-feedback-r204.css', import.meta.url), 'utf8')
]);

assert.match(index, /tracker-demo-feedback-r204\.css\?revision=r204-local-demo-feedback/,
  'Music Tracker must cache-bust the localized demo feedback styles');
assert.match(index, /tracker-demo-feedback-r204\.js\?revision=r204-local-demo-feedback/,
  'Music Tracker must load the localized demo feedback entry module');
assert.match(index, /Tap an instrument repeatedly to step through its sounds/,
  'Instrument demo instructions should remain at the top of the disclosure');
assert.doesNotMatch(index, /id="demoStatus"[^>]*aria-live/,
  'The persistent demo instruction is not a live status region');

assert.match(bootstrap, /tracker-audio\.js\?revision=r204-demo-feedback/,
  'Demo feedback must use a fresh tracker audio module identity');
assert.match(bootstrap, /instrumentDemos\.replaceChildren\(\)/,
  'Fresh demo controls replace any controls rendered by a cached tracker entry module');

for (const [token, label] of [
  ['K', 'KICK'], ['S', 'SNARE'], ['H', 'HIHAT'], ['O', 'OPEN HIHAT'],
  ['C', 'CLAP'], ['T', 'TOM'], ['M', 'METAL'], ['R', 'SHAKER']
]) {
  assert.match(audio, new RegExp(`${token}: '${label}'`), `${token} should expose a human-readable drum name`);
}
assert.match(audio, /feedback\.dataset\.demoFeedback = group/,
  'Each instrument section owns its own feedback region');
assert.match(audio, /feedback\.setAttribute\('aria-live', 'polite'\)/,
  'Instrument feedback should be announced politely');
assert.match(audio, /followUp\.textContent = `\(Tap again: \$\{next\}\)`/,
  'Feedback should preview what the next tap will play');
assert.match(audio, /setTimeout\(\(\) => \{[\s\S]*?\}, 3000\)/,
  'Instrument demo sequence and visual feedback should reset after three seconds');
assert.match(audio, /clearDemoFeedback\(\)/,
  'Feedback from another instrument section should not remain as the current sound');

assert.match(css, /\.demo-group-head\s*\{/,
  'Each instrument section should expose a dedicated heading row');
assert.match(css, /\.demo-feedback\s*\{/,
  'Localized sound feedback should be styled in the section heading');

console.log('TURN Music Tracker demo feedback regression passed.');
