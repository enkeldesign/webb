import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const hierarchy = fs.readFileSync(path.join(root, 'hierarchy.css'), 'utf8');
const ui = fs.readFileSync(path.join(root, 'runtime', 'visuals-ui-core.js'), 'utf8');
const interaction = fs.readFileSync(path.join(root, 'runtime', 'interaction-boot.js'), 'utf8');

assert.match(html, /href="\.\/styles\.css"[\s\S]*href="\.\/hierarchy\.css"/, 'Hierarchy overrides must load after the base styles');
assert.match(html, /id="action-dock"[\s\S]*id="action-primary"/, 'The contextual next action must remain visible above the package rail');
assert.match(html, /id="package-console"|class="package-console"[\s\S]*id="package-rail"/, 'The live package rail must be persistent HUD, not sheet content');
assert.doesNotMatch(html.match(/<section id="action-dock"[^>]*>/)?.[0] || '', /data-tutorial-reveal/, 'The tutorial must never hide the current action');
assert.doesNotMatch(html.match(/<section class="package-console"[^>]*>/)?.[0] || '', /data-tutorial-reveal/, 'The tutorial must never hide live packages');
assert.match(hierarchy, /\.first-day-pending \[data-tutorial-reveal\][\s\S]*display:\s*none !important/, 'Unintroduced controls must not flash before tutorial state loads');
assert.match(hierarchy, /\.tutorial-just-revealed[\s\S]*tutorialReveal/, 'New controls need a legible visual entrance');
assert.match(hierarchy, /\.dock-button-primary[\s\S]*background:\s*var\(--yellow\)/, 'Yellow belongs to the direct executable action');
assert.match(hierarchy, /\.level-tab\[aria-pressed="true"\][\s\S]*background:\s*rgba\(255,255,255/, 'Navigation must be quieter than the CTA');
assert.match(hierarchy, /\.metric-issues[\s\S]*background:\s*rgba\(7, 29, 28/, 'Issue count should be status, not a competing red action card');
assert.match(hierarchy, /\.live-package-card\[aria-pressed="true"\][\s\S]*border-color:\s*var\(--yellow\)/, 'Selected package must have obvious continuity across levels');
assert.match(hierarchy, /\.package-rail[\s\S]*overflow-x:\s*auto/, 'Portrait package rail must scroll horizontally without shrinking cards');
assert.match(ui, /pkg\.issue === 'scan-gap'[\s\S]*primary = 'SCAN CAGE'/, 'The package state must produce a concrete operational verb');
assert.match(ui, /pkg\.status === 'ready-local' \|\| pkg\.status === 'ready-national'[\s\S]*action = 'load-package'/, 'Ready packages must expose loading in the main CTA');
assert.match(interaction, /action === 'dispatch-truck'[\s\S]*dispatchSelectedTruck/, 'Truck departure must be a player action');

console.log('POSTAL hierarchy CTA tests passed');
