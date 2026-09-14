import assert from 'node:assert/strict';
import { chromium, webkit } from 'playwright';

const TARGET = process.env.TURN_SUPPORT_FEEDBACK_URL || 'http://127.0.0.1:8000/';
const STORAGE_KEY = 'turn-support-challenges-v1';

for (const [name, browserType] of [['Chromium', chromium], ['WebKit', webkit]]) {
  const browser = await browserType.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(TARGET, { waitUntil: 'domcontentloaded' });

  const result = await page.evaluate(async ({ storageKey }) => {
    localStorage.clear();
    document.documentElement.className = 'turn-home-ready';
    document.body.className = '';
    document.body.innerHTML = `
      <section class="m8-home" hidden>
        <div class="m8-home-pitch"></div>
        <button type="button" class="m8-how-button">HOW TO PLAY</button>
        <button type="button" class="track-card" data-track-id="countryside">COUNTRYSIDE</button>
        <button type="button" class="m8-track-continue">RACE</button>
      </section>`;

    localStorage.setItem(storageKey, JSON.stringify({
      version: 1,
      dryValidLaps: 6,
      lapsSinceChallengeProgress: 0,
      active: {
        key: 'safety:countryside',
        type: 'safety',
        trackId: 'countryside',
        vehicleId: 'sedan-sports',
        sourceAchievementId: 'countryside-safety',
        baselineParts: []
      },
      seenActiveKey: 'safety:countryside',
      completed: [],
      skipped: []
    }));

    const supportModule = await import('/turn/achievements/support-challenges.js?browser-smoke=feedback-lifecycle');
    await import('/turn/achievements/home-reward-replay-r225.js?browser-smoke=feedback-lifecycle');
    await import('/turn/achievements/support-challenge-feedback.js?browser-smoke=feedback-lifecycle');

    const calls = [];
    const bonuses = new Map();
    let trophies = 1000;
    const store = {
      state: { progress: { howToPlayDisclosures: [] } },
      isUnlocked: () => false,
      isRewardUnlocked: () => false,
      trophyTotal: () => trophies,
      hasBonus: (id) => bonuses.has(id)
    };
    const achievements = {
      store,
      grantBonus(id, amount, context = {}) {
        if (bonuses.has(id)) return null;
        const bonus = { id, trophies: amount, context };
        bonuses.set(id, bonus);
        trophies += amount;
        window.dispatchEvent(new CustomEvent('turn:trophy-bonus', {
          detail: { ...bonus, total: trophies }
        }));
        return bonus;
      },
      holdRewardPresentation(key) {
        calls.push({ type: 'hold', key, at: performance.now() });
        return true;
      },
      releaseRewardPresentation(key) {
        calls.push({ type: 'release', key, at: performance.now() });
        return true;
      },
      showRewardToastBatch(batch) {
        calls.push({ type: 'reward', ids: batch.map((item) => item.id), at: performance.now() });
        return true;
      }
    };
    globalThis.__turnAchievements = achievements;
    const runtime = {
      state: {
        trackId: 'countryside',
        vehicleId: 'sedan-sports',
        competitorLaps: []
      }
    };
    globalThis.__turnRuntime = runtime;

    const config = {
      version: 1,
      enabled: true,
      offerAfterValidLapsWithoutTrophy: 6,
      rerollAfterAdditionalValidLaps: 10,
      stopAtTrophies: 2300,
      priority: ['safety'],
      trackOrder: ['countryside'],
      winner: { enabled: false, reward: 25, cars: {} },
      learning: { enabled: false, title: 'DID YOU READ ALL OF IT?', rewardPerPart: 5, description: '' },
      safety: {
        enabled: true,
        reward: 25,
        cleanLapExplanation: 'A clean lap means staying on the road from start to finish.',
        targets: { countryside: 18 },
        cars: { countryside: ['sedan-sports'] }
      },
      drift: { enabled: false, requiredReward: 'drift-attack', reward: 25, targets: {}, cars: {} }
    };
    const fetchImpl = async () => ({ ok: true, json: async () => config });
    const support = await supportModule.installSupportChallenges({
      achievements,
      runtime,
      storage: localStorage,
      fetchImpl
    });
    if (!support) throw new Error('Support challenges did not install in browser smoke.');

    window.dispatchEvent(new CustomEvent('turn:lap-result', {
      detail: {
        valid: true,
        time: 17.25,
        onCourseThroughout: true,
        position: 1,
        total: 1
      }
    }));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const raceToast = document.querySelector('.turn-support-bonus-toast:not(.turn-support-home-toast)');
    const race = {
      visible: Boolean(raceToast && !raceToast.hidden && raceToast.classList.contains('is-visible')),
      label: raceToast?.querySelector('span')?.textContent || '',
      value: raceToast?.querySelector('strong')?.textContent || '',
      activeCleared: support.state.active === null,
      completed: support.state.completed.includes('safety:countryside')
    };

    // Let the in-race cue finish before reproducing the later Home reprise.
    await new Promise((resolve) => setTimeout(resolve, 3450));

    // Model the reported case accurately: the Trophy Road reward was earned and
    // its ordinary banner was already presented during the race, so Home owes a
    // reprise rather than waiting to learn whether the live queue will show it.
    window.dispatchEvent(new CustomEvent('turn:trophy-road-updated', {
      detail: { unlocked: ['awd-traction'], trophies }
    }));
    window.dispatchEvent(new CustomEvent('turn:trophy-road-toast-shown', {
      detail: { ids: ['awd-traction'] }
    }));

    const home = document.querySelector('.m8-home');
    home.hidden = false;
    document.body.classList.add('turn-home-open');
    const homeShownAt = performance.now();
    window.dispatchEvent(new CustomEvent('turn:home-shown', { detail: { focus: false } }));

    await new Promise((resolve) => setTimeout(resolve, 500));
    const homePill = document.querySelector('.turn-support-home-toast');
    const duringHome = {
      pillVisible: Boolean(homePill && !homePill.hidden && homePill.classList.contains('is-visible')),
      indicatorVisible: Boolean(document.querySelector('.turn-support-completion-indicator')),
      held: calls.some((call) => call.type === 'hold' && call.key === 'support-home-feedback'),
      rewardCalls: calls.filter((call) => call.type === 'reward').length
    };

    await new Promise((resolve) => setTimeout(resolve, 3400));
    const release = calls.find((call) => call.type === 'release');
    const reward = calls.find((call) => call.type === 'reward');
    const afterHome = {
      indicatorGone: !document.querySelector('.turn-support-completion-indicator'),
      homePillGone: !document.querySelector('.turn-support-home-toast'),
      releaseAfterStartMs: release ? release.at - homeShownAt : null,
      rewardAfterStartMs: reward ? reward.at - homeShownAt : null,
      releaseBeforeReward: Boolean(release && reward && release.at <= reward.at),
      pendingFeedback: localStorage.getItem('turn-support-feedback-v1')
    };

    return { race, duringHome, afterHome, calls };
  }, { storageKey: STORAGE_KEY });

  assert.equal(result.race.visible, true, `${name}: clean SAFETY completion shows the green race pill.`);
  assert.equal(result.race.label, 'CHALLENGE COMPLETE', `${name}: race pill identifies challenge completion.`);
  assert.equal(result.race.value, '+25 🏆', `${name}: race pill uses the compact trophy value.`);
  assert.equal(result.race.activeCleared, true, `${name}: completed SAFETY challenge is retired.`);
  assert.equal(result.race.completed, true, `${name}: completed SAFETY challenge is persisted as completed.`);

  assert.equal(result.duringHome.pillVisible, true, `${name}: CHOOSE TRACK replays the challenge pill.`);
  assert.equal(result.duringHome.indicatorVisible, true, `${name}: CHOOSE TRACK shows the temporary completion notification.`);
  assert.equal(result.duringHome.held, true, `${name}: Home challenge feedback acquires the Trophy Road reward presentation hold.`);
  assert.equal(result.duringHome.rewardCalls, 0, `${name}: Trophy Road reward cannot cover the Home challenge notification.`);

  assert.equal(result.afterHome.indicatorGone, true, `${name}: completion notification clears after its pulse.`);
  assert.equal(result.afterHome.homePillGone, true, `${name}: Home challenge pill clears after presentation.`);
  assert.ok(result.afterHome.releaseAfterStartMs >= 3200, `${name}: reward hold survives the complete support presentation.`);
  assert.ok(result.afterHome.rewardAfterStartMs >= 3400, `${name}: reward reprise waits until support feedback has finished.`);
  assert.equal(result.afterHome.releaseBeforeReward, true, `${name}: support feedback releases ownership before the reward reprise.`);
  assert.equal(result.afterHome.pendingFeedback, null, `${name}: replayed support completion is consumed exactly once.`);

  await context.close();
  await browser.close();
}

console.log('Support feedback browser lifecycle smoke passed in Chromium and WebKit.');
