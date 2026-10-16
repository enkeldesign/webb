import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium, webkit } from 'playwright';

const TARGET = process.env.TURN_SUPPORT_FEEDBACK_URL || 'http://127.0.0.1:8000/';
const rules = JSON.parse(await fs.readFile(new URL('../turn/support-challenges.json', import.meta.url), 'utf8'));
const GAP = rules.offerAfterValidLapsWithoutTrophy;
const HOW_TO_PLAY_PARTS = ['turn-device-to-steer', 'drive-with-one-thumb', 'build-and-use-overcharge',
  'choose-track-and-car', 'drive-by-ear-sounds'];
const entry = await fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8');
const importMap = entry.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1];
const fixture = `<!doctype html><html class="turn-home-ready"><head>
<script type="importmap">${importMap}</script></head><body>
<section class="m8-home" hidden><div class="m8-home-pitch"></div>
<div class="m8-home-menu"><p class="m8-home-status"></p></div>
<button class="m8-how-button">HOW TO PLAY</button>
<button class="roadbook-card" data-track-id="countryside">COUNTRYSIDE</button>
<button class="m8-track-continue">RACE</button></section>
<div class="utility-group" data-menu-state="racing"></div>
<div class="drive-pad"></div><button id="calibrateButton">Calibrate</button>
</body></html>`;

async function setup(browser, { type = 'safety', trophies = 975, persisted = null, home = false, support = null } = {}) {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/__support-feedback-fixture', (route) => route.fulfill({ contentType: 'text/html', body: fixture }));
  await page.goto(new URL('__support-feedback-fixture', TARGET).href);
  await page.clock.install({ time: new Date('2026-09-14T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-09-14T12:00:01Z'));
  await page.evaluate(async ({ type, trophies, persisted, home, support }) => {
    const map = JSON.parse(document.querySelector('[type="importmap"]').textContent).imports;
    const url = (path) => map[path] || Object.values(map).find((target) => target.split('?')[0] === path) || path;
    globalThis.testModuleUrl = url;
    if (persisted) {
      for (const [key, value] of Object.entries(persisted)) localStorage.setItem(key, value);
    } else {
      const { createAchievementStore } = await import(url('/turn/achievements/store.js'));
      const store = createAchievementStore();
      for (const id of ['first-turn', 'new-wheels', 'your-own-rival', 'ahead-of-yourself']) store.unlock(id);
      store.grantBonus('test:seed', trophies - store.trophyTotal());
      store.syncRewards();
      store.markAllSeen();
      localStorage.setItem('turn-support-challenges-v1', JSON.stringify(support || {
        version: 1, dryValidLaps: 6, lapsSinceChallengeProgress: 0,
        active: { key: `${type}:countryside`, type, trackId: 'countryside', vehicleId: 'sedan-sports',
          sourceAchievementId: `countryside-${type}`, baselineParts: [] },
        seenActiveKey: `${type}:countryside`, completed: [], skipped: []
      }));
    }
    const rivals = type === 'winner' ? Array.from({ length: 4 }, () => ({
      time: 80, frames: Array.from({ length: 21 }, (_, i) => ({ t: i, x: i, z: 0, rotation: 0 }))
    })) : [];
    globalThis.__turnRuntime = { state: {
      trackId: 'countryside', vehicleId: 'sedan-sports', competitorLaps: rivals,
      running: false, lapActive: false, speed: 0
    } };
    globalThis.feedbackEvents = [];
    window.addEventListener('turn:trophy-road-toast-shown', (event) => {
      const toast = document.querySelector('.turn-trophy-reward-toast');
      globalThis.feedbackEvents.push({ type: 'reward', ids: event.detail.ids, at: globalThis.performance.now(),
        home: document.body.classList.contains('turn-home-open'),
        visible: !toast.hidden && toast.classList.contains('is-visible') });
    });
    window.addEventListener('turn:trophy-road-updated', (event) => {
      globalThis.feedbackEvents.push({ type: 'earned', ids: event.detail.unlocked });
    });
    for (const phase of ['started', 'ended']) window.addEventListener(`turn:support-home-feedback-${phase}`, () => {
      globalThis.feedbackEvents.push({ type: phase, at: globalThis.performance.now() });
    });
    if (home) {
      document.querySelector('.m8-home').hidden = false;
      document.body.classList.add('turn-home-open');
    }
    const ready = new Promise((resolve) => window.addEventListener('turn:support-challenges-ready', resolve, { once: true }));
    const achievements = await import(url('/turn/achievements.js'));
    achievements.installAchievements(globalThis.__turnRuntime);
    achievements.installAchievementChallengeExpansion();
    await ready;
  }, { type, trophies, persisted, home, support });
  await page.clock.runFor(32);
  return { page, errors, close: async () => { assert.deepEqual(errors, [], 'No browser runtime errors'); await context.close(); } };
}

async function lap(page, detail = {}) {
  await page.evaluate((detail) => {
    window.dispatchEvent(new CustomEvent('turn:ui-state-change', { detail: { reason: 'lap-started' } }));
    window.dispatchEvent(new CustomEvent('turn:lap-result', { detail: {
      valid: true, time: 17.25, onCourseThroughout: true, position: 1, total: 1, ...detail
    } }));
  }, detail);
  await page.clock.runFor(32);
}

// The challenge on offer once its idle-time selection has had its chance.
async function offered(page) {
  await page.clock.runFor(1000);
  return page.evaluate(() => globalThis.__turnSupportChallenges.state.active);
}

// How many valid laps without a trophy it takes until a challenge is offered.
async function lapsUntilOffered(page) {
  for (let laps = 1; laps <= GAP * 2; laps += 1) {
    await lap(page);
    if (await offered(page)) return laps;
  }
  return null;
}

async function race(page, state) {
  await page.evaluate((state) => Object.assign(globalThis.__turnRuntime.state, state), state);
}

// The challenge buttons on screen: the finished challenge's fading copy, or the button.
async function challengeButtons(page) {
  return page.evaluate(() => [...document.querySelectorAll('.turn-support-challenge-trigger')]
    .filter((node) => !node.hidden && globalThis.getComputedStyle(node).display !== 'none')
    .map((node) => (node.classList.contains('turn-support-completion-indicator') ? 'finished' : 'offered')));
}

async function showHome(page, open = true) {
  await page.evaluate((open) => {
    document.querySelector('.m8-home').hidden = !open;
    document.body.classList.toggle('turn-home-open', open);
    window.dispatchEvent(new CustomEvent(open ? 'turn:home-shown' : 'turn:home-hidden'));
  }, open);
  await page.clock.runFor(32);
}

async function snapshot(page) {
  return page.evaluate(() => {
    const visible = (selector) => {
      const node = document.querySelector(selector);
      return Boolean(node && !node.hidden && node.classList.contains('is-visible'));
    };
    const support = globalThis.__turnSupportChallenges;
    return {
      race: visible('.turn-support-bonus-toast:not(.turn-support-home-toast)'),
      home: visible('.turn-support-home-toast'),
      achievement: visible('.turn-achievement-toast:not(.turn-trophy-reward-toast)'),
      reward: visible('.turn-trophy-reward-toast'),
      indicator: Boolean(document.querySelector('.turn-support-completion-indicator')),
      completed: support.state.completed,
      active: support.state.active,
      trophies: globalThis.__turnAchievements.getTrophies(),
      bonuses: globalThis.__turnAchievements.getState().bonuses,
      unlocked: globalThis.__turnAchievements.getState().unlocked,
      pending: localStorage.getItem('turn-support-feedback-v1'),
      replay: JSON.parse(localStorage.getItem('turn-home-reward-replay-v1')),
      events: globalThis.feedbackEvents,
      pillText: document.querySelector('.turn-support-bonus-toast:not(.turn-support-home-toast)').textContent
    };
  });
}

for (const [name, browserType] of [['Chromium', chromium], ['WebKit', webkit]]) {
  const browser = await browserType.launch({ headless: true });
  try {
    // Real runtime/store/view and release import map. Only the host race shell is a fixture.
    const solo = await setup(browser);
    const routing = await solo.page.evaluate(async () => {
      let track = '';
      let car = '';
      document.querySelector('.roadbook-card').addEventListener('click', (event) => { track = event.currentTarget.dataset.trackId; });
      // GARAGE stand-in: the challenge asks the open GARAGE to feature its recommended car.
      const garageRoot = document.createElement('section');
      document.querySelector('.m8-track-continue').addEventListener('click', () => {
        document.body.appendChild(garageRoot);
        globalThis.__turnGarage = { root: garageRoot, viewCar: (carId) => { car = carId; } };
      });
      globalThis.__turnSupportChallenges.trigger.click();
      document.querySelector('[data-support-start]').click();
      await Promise.resolve();
      garageRoot.remove();
      delete globalThis.__turnGarage;
      return { track, car };
    });
    assert.deepEqual(routing, { track: 'countryside', car: 'sedan-sports' }, 'START CHALLENGE selects its track and recommended owned car');
    await lap(solo.page, { valid: false });
    assert.equal((await snapshot(solo.page)).bonuses['support:safety:countryside'], undefined, 'Invalid laps cannot complete support');
    await solo.page.evaluate(() => { globalThis.__turnRuntime.state.vehicleId = 'sedan'; });
    await lap(solo.page);
    assert.equal((await snapshot(solo.page)).bonuses['support:safety:countryside'], undefined, 'Recommended car is required');
    await solo.page.evaluate(() => { globalThis.__turnRuntime.state.vehicleId = 'sedan-sports'; });
    await lap(solo.page);
    let state = await snapshot(solo.page);
    assert.equal(state.race, true, `${name}: support-only completion shows its race pill`);
    assert.equal(state.achievement, false);
    assert.equal(state.trophies, 1000);
    assert.match(state.pillText, /CHALLENGE COMPLETE\+25 🏆/);
    assert.equal(state.bonuses['support:safety:countryside'].trophies, 25);
    assert.deepEqual(state.completed, ['safety:countryside']);
    await lap(solo.page);
    assert.equal((await snapshot(solo.page)).trophies, 1000, 'Repeated laps cannot duplicate bonuses');

    await showHome(solo.page);
    state = await snapshot(solo.page);
    assert.equal(state.race, false, 'Home reprise replaces the still-visible race pill');
    assert.equal(state.home && state.indicator, true);
    await solo.page.clock.runFor(500);
    assert.equal((await snapshot(solo.page)).reward, false);
    await solo.page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
      document.dispatchEvent(new globalThis.Event('visibilitychange'));
    });
    await solo.page.clock.runFor(200);
    state = await snapshot(solo.page);
    assert.ok(state.pending, 'Backgrounding cannot consume challenge feedback');
    assert.ok(state.replay.pending.length, 'A reward shown to a hidden page still needs a Home reprise');
    await solo.page.evaluate(() => {
      delete document.visibilityState;
      document.dispatchEvent(new globalThis.Event('visibilitychange'));
    });
    await solo.page.clock.runFor(32);
    assert.equal((await snapshot(solo.page)).home, true, 'Returning to the foreground restores pending feedback');
    await showHome(solo.page, false);
    state = await snapshot(solo.page);
    assert.equal(state.home || state.indicator, false, 'Leaving Home removes its feedback');
    assert.ok(state.pending, 'Interrupted feedback remains owed');
    const persisted = await solo.page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
    await solo.close();

    const reload = await setup(browser, { persisted, home: true });
    assert.equal((await snapshot(reload.page)).home, true, 'Reload waits for runtime and challenge trigger, then replays');
    await reload.page.clock.runFor(3900);
    state = await snapshot(reload.page);
    assert.equal(state.pending, null);
    assert.equal(state.home || state.indicator, false);
    assert.equal(state.reward, true, 'Reloaded reward follows the completed Home cue');
    assert.ok(state.events.filter((event) => event.type === 'reward').every((event) => event.visible));
    assert.deepEqual(state.replay.pending, [], 'Consume reward replay only once it is visibly shown');
    const count = state.events.filter((event) => event.type === 'reward').length;
    await showHome(reload.page, false);
    await showHome(reload.page);
    await reload.page.clock.runFor(4500);
    state = await snapshot(reload.page);
    assert.equal(state.home, false);
    assert.equal(state.events.filter((event) => event.type === 'reward').length, count, 'Home re-entry cannot duplicate feedback');
    await reload.close();

    for (const [type, total, detail] of [
      ['winner', 975, { time: 60, total: 5, onCourseThroughout: false }],
      ['safety', 2275, { time: 14.5, ranked: false }]
    ]) {
      const paired = await setup(browser, { type, trophies: total });
      await lap(paired.page, detail);
      state = await snapshot(paired.page);
      assert.ok(state.unlocked[`countryside-${type}`], `${name}: normal ${type} achievement awarded`);
      assert.equal(state.bonuses[`support:${type}:countryside`]?.trophies, 25, `${name}: same-lap bonus survives normal reward/cap crossing`);
      assert.equal(state.race && state.achievement, true, 'Challenge and same-lap achievement present together');
      assert.equal(state.reward, false, 'Rewards wait for the paired feedback');
      await paired.page.clock.runFor(3950);
      state = await snapshot(paired.page);
      assert.equal(state.reward, true);
      const earned = [...new Set(state.events.filter((event) => event.type === 'earned').flatMap((event) => event.ids))].sort();
      assert.deepEqual([...new Set(state.events.filter((event) => event.type === 'reward').flatMap((event) => event.ids))].sort(), earned);
      // Enter Home while that exact reward batch is visible: the runtime must retain it.
      await showHome(paired.page);
      state = await snapshot(paired.page);
      assert.equal(state.home, true);
      assert.equal(state.reward, false);
      await paired.page.clock.runFor(3850);
      state = await snapshot(paired.page);
      const homeRewards = state.events.filter((event) => event.type === 'reward' && event.home);
      assert.equal(homeRewards.length, 1, 'One complete reward batch after the Home cue');
      assert.deepEqual([...homeRewards[0].ids].sort(), earned, 'No reward is lost when an active toast is held');
      assert.deepEqual(state.replay.pending, []);
      await paired.close();
    }
    // #1218: every challenge, PATROL and EXCURSION included, waits for the same run of
    // valid laps without a trophy after the one before it ends. Driven through the real
    // runtime: HOW TO PLAY's parts, then laps, previews and a procedural challenge.
    const reading = { key: 'learning:how-to-play', type: 'learning', trackId: '', vehicleId: '',
      sourceAchievementId: 'learn-to-play', baselineParts: [] };
    const cadence = await setup(browser, { support: { version: 1, dryValidLaps: GAP, lapsSinceChallengeProgress: 0,
      active: reading, seenActiveKey: reading.key, completed: [], skipped: [] } });
    const normal = { trackId: 'countryside', vehicleId: 'sedan-sports', rewardPreview: null };
    await cadence.page.evaluate((parts) => {
      for (const disclosureId of parts) {
        window.dispatchEvent(new CustomEvent('turn:how-to-play-disclosure-opened', { detail: { disclosureId } }));
      }
    }, HOW_TO_PLAY_PARTS);
    assert.ok((await snapshot(cadence.page)).completed.includes(reading.key), 'Opening every part ends DID YOU READ ALL OF IT?');
    assert.equal(await offered(cadence.page), null, `${name}: PATROL does not follow DID YOU READ ALL OF IT? straight away`);
    assert.equal(await lapsUntilOffered(cadence.page), GAP, `PATROL waits ${GAP} valid laps`);
    assert.equal((await offered(cadence.page)).key, 'patrol:midnight-city');
    await race(cadence.page, { trackId: 'midnight-city', vehicleId: 'police', rewardPreview: { key: 'patrol:midnight-city' } });
    await lap(cadence.page);
    assert.ok((await snapshot(cadence.page)).completed.includes('patrol:midnight-city'), 'A valid PATROL lap completes it');
    assert.equal(await offered(cadence.page), null, 'Nothing follows PATROL straight away');
    await race(cadence.page, normal);
    assert.equal(await lapsUntilOffered(cadence.page), GAP, 'Slot three waits the same gap');
    const third = await offered(cadence.page);
    assert.equal(third.key, 'safety:countryside', 'Slot three is a procedural challenge');
    await race(cadence.page, { trackId: third.trackId, vehicleId: third.vehicleId });
    await lap(cadence.page);
    assert.ok((await snapshot(cadence.page)).completed.includes(third.key));
    assert.equal(await offered(cadence.page), null, 'EXCURSION does not follow slot three straight away');
    await race(cadence.page, normal);
    assert.equal(await lapsUntilOffered(cadence.page), GAP, `EXCURSION waits ${GAP} valid laps`);
    assert.equal((await offered(cadence.page)).key, 'excursion:mountain');
    await race(cadence.page, { trackId: 'mountain', vehicleId: 'monster-truck', rewardPreview: { key: 'excursion:mountain' } });
    await lap(cadence.page);
    assert.ok((await snapshot(cadence.page)).completed.includes('excursion:mountain'), 'A valid EXCURSION lap completes it');
    assert.equal(await offered(cadence.page), null, 'Nothing follows EXCURSION straight away');
    await race(cadence.page, normal);
    assert.equal(await lapsUntilOffered(cadence.page), GAP, 'Procedural challenges continue on the same cadence');
    assert.match((await offered(cadence.page)).key, /^(winner|safety|drift):/);
    await cadence.close();

    // #1218: a challenge offered while the last one's completion still waits for Home
    // shows its button only once that completion has played: never two buttons at once.
    const overlap = await setup(browser);
    await lap(overlap.page);
    assert.deepEqual((await snapshot(overlap.page)).completed, ['safety:countryside']);
    assert.equal(await lapsUntilOffered(overlap.page), GAP, 'The next challenge is offered during the same race');
    await showHome(overlap.page);
    assert.deepEqual(await challengeButtons(overlap.page), ['finished'], `${name}: Home plays the finished challenge alone`);
    await overlap.page.clock.runFor(3000);
    assert.deepEqual(await challengeButtons(overlap.page), ['finished'], 'and keeps it alone as it fades');
    await overlap.page.clock.runFor(500);
    assert.deepEqual(await challengeButtons(overlap.page), ['offered'], 'Then the new challenge\'s button appears');
    await overlap.close();
    console.log(`${name}: real support completion, same-lap awards, reward ordering, interruptions, reload, the challenge cadence and one button at a time passed.`);
  } finally {
    await browser.close();
  }
}
