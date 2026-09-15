import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const contextPath = 'turn/platform/platform-context.js';
const contextSource = fs.readFileSync(contextPath, 'utf8');
const oldContext = `let installedPlatform = null;

export function installTurnPlatform(platform) {
  validateTurnPlatform(platform);

  if (installedPlatform && installedPlatform !== platform) {
    throw new Error('TURN platform has already been installed.');
  }

  installedPlatform = platform;
  return installedPlatform;
}

export function getTurnPlatform() {
  return installedPlatform;
}

export function requireTurnPlatform() {
  if (!installedPlatform) {
    throw new Error('TURN platform has not been installed.');
  }
  return installedPlatform;
}
`;
const newContext = `const PLATFORM_REGISTRY_KEY = Symbol.for('turn.platform.context');

function platformRegistry() {
  const existing = globalThis[PLATFORM_REGISTRY_KEY];
  if (existing) return existing;

  const registry = { installedPlatform: null };
  Object.defineProperty(globalThis, PLATFORM_REGISTRY_KEY, {
    configurable: false,
    enumerable: false,
    writable: false,
    value: registry
  });
  return registry;
}

export function installTurnPlatform(platform) {
  validateTurnPlatform(platform);
  const registry = platformRegistry();

  if (registry.installedPlatform && registry.installedPlatform !== platform) {
    throw new Error('TURN platform has already been installed.');
  }

  registry.installedPlatform = platform;
  return registry.installedPlatform;
}

export function getTurnPlatform() {
  return platformRegistry().installedPlatform;
}

export function requireTurnPlatform() {
  const installedPlatform = getTurnPlatform();
  if (!installedPlatform) {
    throw new Error('TURN platform has not been installed.');
  }
  return installedPlatform;
}
`;
if (!contextSource.includes(oldContext)) throw new Error('Expected module-local platform context not found');
fs.writeFileSync(contextPath, contextSource.replace(oldContext, newContext));

const testPath = 'turn-tests/platform-production.mjs';
let testSource = fs.readFileSync(testPath, 'utf8');
const runtimeMarker = `assert.equal(getTurnPlatform(), platform);
assert.equal(requireTurnPlatform(), platform);

const adaptedPose = motionPoseFromGravity({
`;
const runtimeReplacement = `assert.equal(getTurnPlatform(), platform);
assert.equal(requireTurnPlatform(), platform);

// The production shell cache-busts platform-context.js while motion historically
// reaches the same physical file through another module URL. Those identities must
// share exactly one installed adapter so a future native host cannot be bypassed.
const contextUrl = new URL('../turn/platform/platform-context.js', import.meta.url);
const alternateContextA = await import(\`${'${contextUrl.href}'}?identity=packaging-a\`);
const alternateContextB = await import(\`${'${contextUrl.href}'}?identity=packaging-b\`);
assert.equal(alternateContextA.getTurnPlatform(), platform);
assert.equal(alternateContextB.getTurnPlatform(), platform);
assert.equal(alternateContextA.requireTurnPlatform(), platform);
assert.equal(alternateContextB.installTurnPlatform(platform), platform);
const competingPlatform = { ...platform };
assert.throws(
  () => alternateContextA.installTurnPlatform(competingPlatform),
  /already been installed/,
  'A second module identity must not acquire independent platform ownership'
);

const adaptedPose = motionPoseFromGravity({
`;
if (!testSource.includes(runtimeMarker)) throw new Error('Platform runtime test insertion point not found');
testSource = testSource.replace(runtimeMarker, runtimeReplacement);

const sourceMarker = `const webPlatformSource = fs.readFileSync(new URL('../turn/platform/web-platform.js', import.meta.url), 'utf8');

assert.match(productionApp`;
const sourceReplacement = `const webPlatformSource = fs.readFileSync(new URL('../turn/platform/web-platform.js', import.meta.url), 'utf8');
const platformContextSource = fs.readFileSync(new URL('../turn/platform/platform-context.js', import.meta.url), 'utf8');

assert.match(platformContextSource, /Symbol\\.for\\('turn\\.platform\\.context'\\)/);
assert.doesNotMatch(platformContextSource, /let installedPlatform = null/);
assert.match(productionApp`;
if (!testSource.includes(sourceMarker)) throw new Error('Platform source assertion insertion point not found');
testSource = testSource.replace(sourceMarker, sourceReplacement);
fs.writeFileSync(testPath, testSource);

const releasePath = 'turn/release.json';
const release = JSON.parse(fs.readFileSync(releasePath, 'utf8'));
const expected = {
  version: '1.20.2',
  id: '2026.09.15-r237',
  cacheKey: '20260915-r237'
};
if (JSON.stringify(release) !== JSON.stringify(expected)) {
  throw new Error(`Unexpected base release: ${JSON.stringify(release)}`);
}
release.id = '2026.09.15-r238';
release.cacheKey = '20260915-r238';
fs.writeFileSync(releasePath, `${JSON.stringify(release, null, 2)}\n`);

execFileSync('node', ['turn-tests/platform-production.mjs'], { stdio: 'inherit' });
execFileSync('node', ['turn/scripts/release.mjs', '--write'], { stdio: 'inherit' });
execFileSync('node', ['turn-tests/platform-production.mjs'], { stdio: 'inherit' });
