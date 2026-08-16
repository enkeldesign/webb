import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const hierarchy = fs.readFileSync(path.join(root, 'hierarchy.css'), 'utf8');
const ui = fs.readFileSync(path.join(root, 'runtime', 'visuals-ui-core.js'), 'utf8');

assert.match(html, /href="\.\/styles\.css"[\s\S]*href="\.\/hierarchy\.css"/, 'Hierarchy overrides must load after the base styles');
assert.match(html, /id="event-ribbon"[^>]*class="[^"]*primary-cta/, 'The live exception needs an explicit primary CTA class');
assert.match(html, /id="event-cta-label">INVESTIGATE</, 'The primary CTA needs an action verb in its visible label');
assert.match(hierarchy, /\.event-ribbon\.primary-cta[\s\S]*background:\s*var\(--yellow\)/, 'Primary CTA should own the brand action color');
assert.match(hierarchy, /\.quick-action,[\s\S]*\.quick-action-focus[\s\S]*background:\s*rgba\(247, 242, 232/, 'Secondary operations should be visually quieter than the CTA');
assert.match(hierarchy, /\.metric-issues[\s\S]*background:\s*rgba\(8, 33, 32/, 'Issue count should be status, not a competing red action card');
assert.match(ui, /ctaLabel\s*=\s*packageNeedsAction\s*\?\s*'INVESTIGATE'/, 'Actionable package exceptions should announce INVESTIGATE');
assert.match(ui, /setAttribute\('aria-label', `\$\{ctaLabel\}: \$\{top\.title\}`\)/, 'The CTA accessible name should include both action and subject');

console.log('POSTAL hierarchy CTA tests passed');
