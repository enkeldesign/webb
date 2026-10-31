import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { ACHIEVEMENT_STORAGE_KEY, createAchievementStore } from '../../turn/achievements/store.js';
import { TROPHY_ROAD_REWARDS, prepareTrophyRoadProfile, isFeatureUnlocked, isTrackUnlocked, isVehicleUnlocked } from '../../turn/progression/trophy-road.js';
import { isPerkAvailable, installPerk } from '../../turn/vehicle/perkulator.js';

const source = await fs.readFile(new URL('../../turn/testing/session-admin.js', import.meta.url), 'utf8');
function memory(entries = {}) {
  const items = new Map(Object.entries(entries));
  return {
    get length() { return items.size; },
    key: (i) => [...items.keys()][i] ?? null,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, String(value)),
    removeItem: (key) => items.delete(key),
    clear: () => items.clear(),
    snapshot: () => [...items]
  };
}
function boot(href, localStorage = memory(), sessionStorage = memory()) {
  const url = new URL(href);
  const page = vm.createContext({
    URL, localStorage, sessionStorage,
    location: { hostname: url.hostname, protocol: url.protocol, href, replace(value) { page.next = value; }, reload() { page.next = page.visible; } },
    history: { state: { keep: true }, replaceState(state, _, value) { page.visible = value; assert.deepEqual(state, { keep: true }); } },
    document: { documentElement: { dataset: {} } }
  });
  vm.runInContext(source, page);
  return page;
}
for (const host of ['branch.turntest.pages.dev', 'a.b.turntest.pages.dev', 'localhost', '127.0.0.1', '[::1]', 'dev.localhost']) {
  const page = boot(`http://${host}/turn/?other=keep&turn-admin=1#here`);
  assert.ok(page.__turnSessionAdmin, `${host}: allowed`);
  assert.equal(page.visible, undefined, 'The address keeps the parameter, so a hand-off to another browser stays in admin');
  assert.equal(page.next, undefined, 'Activation never reloads');
}
for (const host of ['enkel.design', 'www.enkel.design', 'turntest.pages.dev', 'evilturntest.pages.dev', 'branch.turntest.pages.dev.evil.example', 'production.example']) {
  const storage = new Proxy({}, { get() { throw new Error('Production must not touch admin storage'); } });
  const page = boot(`https://${host}/turn/?turn-admin=1`, storage, storage);
  assert.equal(page.__turnSessionAdmin, undefined, `${host}: parameter inert`);
  assert.equal(page.visible, undefined, 'Production URL is untouched');
}
assert.equal(boot('http://localhost/turn/').__turnSessionAdmin, undefined, 'Local sessions need explicit activation');

const real = memory({
  [ACHIEVEMENT_STORAGE_KEY]: JSON.stringify({ version: 10, bonuses: { old: { trophies: 5000, grantedAt: 1 } }, rewards: { unlocked: ['perkulator'] } }),
  'turn-theme-v1': 'dark', 'turn-perkulator-v1': '{"installed":{"truck":"carry-on"}}',
  'turn-tutorial-v1': '{"completed":true}', 'turn-personal-rivals-v1': 'original rivals',
  'turn-admin-unlock-v1': 'legacy marker is inert', 'unrelated-key': 'untouched'
});
const session = memory({ 'ordinary-session-key': 'keep' });
const original = real.snapshot();
let page = boot('http://localhost/turn/?turn-admin=1', real, session);
const activateGlobals = () => {
  globalThis.__turnSessionAdmin = page.__turnSessionAdmin;
  globalThis.localStorage = page.localStorage;
  const store = createAchievementStore();
  globalThis.__turnAchievements = { store };
  return store;
};
let store = activateGlobals();
assert.deepEqual(real.snapshot(), original, 'Startup cannot mutate the real profile');
const history = JSON.stringify(store.state.unlocked);
page.__turnSessionAdmin.configure({ tracks: true, cars: true, rewards: true });
for (const reward of TROPHY_ROAD_REWARDS) {
  assert.equal(store.isRewardUnlocked(reward.id), true, reward.id);
  for (const id of reward.trackIds || []) assert.equal(isTrackUnlocked(id), true);
  for (const id of reward.vehicleIds || []) assert.equal(isVehicleUnlocked(id), true);
}
assert.equal(isPerkAvailable('carry-on'), true);
assert.equal(installPerk('truck', 'carry-on'), false, 'Already installed in the copied save');
assert.equal(installPerk('suv', 'carry-on'), true, 'Perks install only in the session');
assert.equal(JSON.stringify(store.state.unlocked), history, 'Exposure never completes achievements');
page.__turnSessionAdmin.configure({});
assert.equal(store.setTemporaryTrophyTotal(-1), false);
assert.equal(store.setTemporaryTrophyTotal(1.5), false);
assert.equal(store.setTemporaryTrophyTotal(1975), true);
assert.equal(store.trophyTotal(), 1975, 'Arbitrary total replaces even a higher saved baseline');
assert.equal(isFeatureUnlocked('perkulator'), false, 'The 2000 gate is genuinely locked');
page.localStorage.setItem('turn-theme-v1', 'light');
page.localStorage.removeItem('turn-personal-rivals-v1');
page.sessionStorage.setItem('ordinary-session-key', 'changed');
assert.deepEqual(real.snapshot(), original);
assert.equal(session.getItem('ordinary-session-key'), 'keep');
// Reloading the same address resumes the session copy rather than starting afresh.
page = boot('http://localhost/turn/?turn-admin=1', real, session);
store = activateGlobals();
assert.equal(store.trophyTotal(), 1975);
assert.equal(store.isRewardUnlocked('perkulator'), false);
// An address that lost the parameter (an in-game link) gets it back while the session lasts.
assert.equal(boot('http://localhost/turn/#here', real, session).visible, 'http://localhost/turn/?turn-admin=1#here');
assert.ok(store.unlock('first-turn', { trackId: 'countryside', vehicleId: 'classic' }));
assert.equal(store.trophyTotal(), 1975 + store.state.unlocked['first-turn'].awardedTrophies);
if (store.trophyTotal() < 2000) store.grantBonus('race-bonus', 2000 - store.trophyTotal());
assert.ok(store.syncRewards().some(({ id }) => id === 'perkulator'), 'Ordinary trophy awards announce the real 2000 unlock');
assert.equal(isFeatureUnlocked('perkulator'), true);
store.markAllSeen();
assert.deepEqual(real.snapshot(), original, 'Awards, rewards, seen state, perks and settings never leak');
page.__turnSessionAdmin.leave();
page.localStorage.setItem('late-unload-write', 'still isolated');
assert.deepEqual(real.snapshot(), original, 'Late callbacks during leave are also isolated');
assert.equal(session.getItem('turn-session-admin-v1'), null);
const normal = boot(page.next, real, session);
assert.equal(normal.__turnSessionAdmin, undefined);
assert.equal(normal.localStorage, real, 'Leaving exposes the original storage');
assert.deepEqual(normal.localStorage.snapshot(), original);
page = boot('http://localhost/turn/?turn-admin=1', real, session);
page.__turnSessionAdmin.configure({ tracks: true });
page.__turnSessionAdmin.reset();
page = boot(page.next, real, session);
assert.equal(page.__turnSessionAdmin.options.tracks, false, 'Reset begins again from the untouched save');
assert.deepEqual(real.snapshot(), original);
for (const name of ['__turnSessionAdmin', '__turnAchievements', 'localStorage']) delete globalThis[name];

const index = await fs.readFile(new URL('../../turn/index.html', import.meta.url), 'utf8');
assert.ok(index.indexOf('./testing/session-admin.js') < index.indexOf('turn-storage-probe'), 'Isolation precedes the very first player-data access');
for (const name of ['admin-unlock-sequence', 'swoosh-listening-test', 'swoosh-sound-picker', 'route-test-hud']) {
  assert.equal(index.includes(name), false);
  await assert.rejects(fs.access(new URL(`../../turn/testing/${name}.js`, import.meta.url)));
}
for (const path of ['audio/swoosh-pace-notes.js', 'progression/unlock-introductions.js']) {
  assert.doesNotMatch(await fs.readFile(new URL(`../../turn/${path}`, import.meta.url), 'utf8'), /turn-admin-unlock-v1/);
}
// The sole legacy-marker read prevents a destructive old migration; it grants no
// privileges. This is why it cannot simply be removed with the unlock mechanism.
const legacy = memory({
  'turn-admin-unlock-v1': 'old marker',
  [ACHIEVEMENT_STORAGE_KEY]: JSON.stringify({ version: 10, rewards: { unlocked: TROPHY_ROAD_REWARDS.map(({ id }) => id) } })
});
const beforeLegacy = legacy.snapshot();
prepareTrophyRoadProfile(legacy);
assert.deepEqual(legacy.snapshot(), beforeLegacy, 'Old rewards-only saves must not be erased on normal startup');
assert.equal(boot('http://localhost/turn/', legacy).__turnSessionAdmin, undefined, 'A legacy marker never activates admin');
console.log('TURN session admin: host gate, isolation, overlays, 1975 → 2000, reload/reset/leave and legacy removal passed.');
