import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [uiSource, sessionSource, sharingSource] = await Promise.all([
  fs.readFile(new URL('../turn-next/challenge-ui.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/challenge-session.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/challenge-sharing.js', import.meta.url), 'utf8')
]);

assert.match(
  uiSource,
  /modal\.addEventListener\('cancel',[\s\S]*turn-challenge-active[\s\S]*event\.preventDefault\(\)/,
  'Escape must not dismiss a state-critical modal while a ghost challenge is active'
);

assert.ok(
  sessionSource.indexOf("document.body.classList.add('turn-challenge-active', 'turn-challenge-preview')")
    < sessionSource.indexOf('showChallengeModal();'),
  'The challenge must become state-protected before its invitation dialog is shown'
);

assert.match(
  sharingSource,
  /title: 'CHALLENGE A FRIEND'/,
  'Ordinary share dialogs must continue to use the same dialog UI outside active challenge state'
);

console.log('TURN NEXT challenge dialog state-safety regression passed.');
