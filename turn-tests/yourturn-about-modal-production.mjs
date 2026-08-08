import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [indexSource, sessionSource, aboutCss] = await Promise.all([
  fs.readFile(new URL('../yourturn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../yourturn/session.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../yourturn/about-links.css', import.meta.url), 'utf8')
]);

assert.match(indexSource, /about-links\.css\?revision=r2/,
  'YOUR TURN must cache-bust the About modal scrolling fix');
assert.match(sessionSource, /titleText: 'ABOUT TURN'[\s\S]*className: 'about'[\s\S]*label: 'BACK'[\s\S]*label: 'GET THE GAME'/,
  'ABOUT TURN keeps its explicit About view and accessible footer actions');

assert.match(aboutCss, /\.yourturn-dialog\s*\{[\s\S]*overflow:\s*hidden/,
  'The outer dialog must not become a second scroll container');
assert.match(aboutCss, /\.yourturn-card\[data-view="about"\]\s*\{[\s\S]*display:\s*flex[\s\S]*flex-direction:\s*column[\s\S]*overflow:\s*hidden/,
  'The About card must contain scrolling instead of scrolling itself');
assert.match(aboutCss, /\.yourturn-card\[data-view="about"\]\s+\.yourturn-extra\s*\{[\s\S]*min-height:\s*0[\s\S]*overflow-y:\s*auto[\s\S]*overscroll-behavior-y:\s*contain[\s\S]*touch-action:\s*pan-y/,
  'Only the About content region should scroll normally on touch devices');
assert.match(aboutCss, /\.yourturn-card\[data-view="about"\]\s+\.yourturn-actions\s*\{[\s\S]*position:\s*relative[\s\S]*z-index:\s*2/,
  'About footer actions must stay outside the scrolling content and remain interactive');

console.log('YOUR TURN About modal top position, single-scroll behavior and footer access regression passed.');
