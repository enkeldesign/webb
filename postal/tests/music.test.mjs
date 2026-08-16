import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { POSTAL_SONG } from '../music.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.resolve(here, '..', 'music.mjs'), 'utf8');

assert.equal(POSTAL_SONG.name, 'Morning Routes');
assert.ok(POSTAL_SONG.bpm >= 70 && POSTAL_SONG.bpm <= 90, 'The management score should stay calm rather than race-paced');
assert.equal(POSTAL_SONG.arrangement.length, 6, 'The score needs a full tune/chorus/bridge loop');
assert.deepEqual(new Set(POSTAL_SONG.sections.map(section => section.name)), new Set(['tune', 'chorus', 'bridge']));

for (const section of POSTAL_SONG.sections) {
  assert.equal(section.lead.length, section.bass.length);
  assert.equal(section.lead.length, section.arp.length);
  assert.equal(section.lead.length, section.drums.length);
  assert.equal(section.drumKit, 'brush', 'POSTAL should use TURN’s gentlest percussion kit');
  assert.equal(section.bassVoice, 'drone', 'POSTAL should use a soft sustained foundation');
}

assert.match(source, /const DEFAULT_VOLUME = 48/, 'Music should start gently but be on by default');
assert.match(source, /musicVolume <= 0[\s\S]*stopPlayback\(\{ reset: true \}\)/, 'Music OFF must stop the scheduler and audio sources');
assert.match(source, /context\.suspend\(\)/, 'An inactive music engine must release processing work');

console.log('POSTAL calm music contract passed');
