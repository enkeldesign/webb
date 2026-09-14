import fs from 'node:fs';

function update(path, transform) {
  const before = fs.readFileSync(path, 'utf8');
  const after = transform(before);
  if (after === before) throw new Error(`No change made to ${path}`);
  fs.writeFileSync(path, after);
}

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Missing ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`Ambiguous ${label}`);
  return source.slice(0, first) + after + source.slice(first + before.length);
}

update('turn/achievements/runtime.js', (source) => {
  source = replaceOnce(
    source,
    `    rewardToastTimer: 0,\n    samplingTimer: 0,`,
    `    rewardToastTimer: 0,\n    rewardPresentationHolds: new Set(),\n    samplingTimer: 0,`,
    'runtime reward hold state'
  );

  source = replaceOnce(
    source,
    `  function scheduleRewardToastFlush(delay = 0) {\n    window.clearTimeout(session.rewardToastTimer);\n    session.rewardToastTimer = window.setTimeout(() => {\n      session.rewardToastTimer = 0;\n      view.showRewardToastBatch(session.pendingToastRewards.splice(0));\n    }, delay);\n  }`,
    `  function scheduleRewardToastFlush(delay = 0) {\n    window.clearTimeout(session.rewardToastTimer);\n    session.rewardToastTimer = 0;\n    if (session.rewardPresentationHolds.size) return;\n    session.rewardToastTimer = window.setTimeout(() => {\n      session.rewardToastTimer = 0;\n      if (session.rewardPresentationHolds.size) return;\n      const batch = session.pendingToastRewards.splice(0);\n      if (batch.length) view.showRewardToastBatch(batch);\n    }, delay);\n  }`,
    'runtime reward flush'
  );

  const queueRewards = `  function queueRewards(rewards, { delay = 0 } = {}) {\n    for (const reward of rewards) {\n      if (!reward || session.pendingToastRewards.some((item) => item.id === reward.id)) continue;\n      session.pendingToastRewards.push(reward);\n    }\n    view.syncTriggers();\n    view.render();\n    if (delay >= 0) scheduleRewardToastFlush(delay);\n  }`;
  source = replaceOnce(
    source,
    queueRewards,
    `${queueRewards}\n\n  function holdRewardPresentation(key) {\n    if (typeof key !== 'string' || !key) return false;\n    session.rewardPresentationHolds.add(key);\n    window.clearTimeout(session.rewardToastTimer);\n    session.rewardToastTimer = 0;\n    view.hideRewardToast();\n    return true;\n  }\n\n  function releaseRewardPresentation(key, { delay = 0 } = {}) {\n    if (typeof key !== 'string' || !key) return false;\n    const removed = session.rewardPresentationHolds.delete(key);\n    if (!session.rewardPresentationHolds.size && session.pendingToastRewards.length) {\n      scheduleRewardToastFlush(delay);\n    }\n    return removed;\n  }`,
    'runtime reward queue'
  );

  source = replaceOnce(
    source,
    `    unlock: (id, context = {}) => unlock([id], context, { delay: 0 }),\n    grantBonus,\n    getTrophies: () => store.trophyTotal(),`,
    `    unlock: (id, context = {}) => unlock([id], context, { delay: 0 }),\n    grantBonus,\n    holdRewardPresentation,\n    releaseRewardPresentation,\n    hideRewardToast: view.hideRewardToast,\n    showRewardToastBatch: view.showRewardToastBatch,\n    getTrophies: () => store.trophyTotal(),`,
    'runtime public feedback API'
  );
  return source;
});

update('turn/achievements/view.js', (source) => {
  source = replaceOnce(
    source,
    `  function showToast(toastElement, batch, { reward = false } = {}) {`,
    `  function showToast(toastElement, batch, { reward = false, announce = true } = {}) {`,
    'view toast signature'
  );

  source = replaceOnce(
    source,
    `      : \`${'${batch.length === 1 ? \'Achievement unlocked\' : `${batch.length} achievements unlocked`}. ${batch.map((achievement) => achievement.title).join(\', \')}. ${total} trophies.'}\`);\n\n    const alreadyVisible = !toastElement.hidden && toastElement.classList.contains('is-visible');`,
    `      : \`${'${batch.length === 1 ? \'Achievement unlocked\' : `${batch.length} achievements unlocked`}. ${batch.map((achievement) => achievement.title).join(\', \')}. ${total} trophies.'}\`);\n\n    if (reward && announce) {\n      window.dispatchEvent(new CustomEvent('turn:trophy-road-toast-shown', {\n        detail: { ids: batch.map((item) => item.id).filter(Boolean) }\n      }));\n    }\n\n    const alreadyVisible = !toastElement.hidden && toastElement.classList.contains('is-visible');`,
    'view reward presentation event'
  );

  source = replaceOnce(
    source,
    `  function showRewardToastBatch(batch) {\n    showToast(rewardToast, batch, { reward: true });\n  }`,
    `  function showRewardToastBatch(batch, { announce = true } = {}) {\n    showToast(rewardToast, batch, { reward: true, announce });\n  }`,
    'view reward batch API'
  );

  source = replaceOnce(
    source,
    `    showRewardToastBatch,\n    open,`,
    `    showRewardToastBatch,\n    hideRewardToast,\n    open,`,
    'view public hide API'
  );
  return source;
});

update('turn/m8-home.js', (source) => replaceOnce(
  source,
  `    syncSelection();\n    scheduleEnhancedLotWarmup();\n    requestAnimationFrame(() => {`,
  `    syncSelection();\n    scheduleEnhancedLotWarmup();\n    window.dispatchEvent(new CustomEvent('turn:home-shown', { detail: { focus } }));\n    requestAnimationFrame(() => {`,
  'Home shown lifecycle event'
));

update('turn/achievements/support-challenges.js', (source) => {
  const before = `title: \`+${'${reward}'} TROPHIES\``;
  const after = `title: \`+${'${reward}'} 🏆\``;
  const count = source.split(before).length - 1;
  if (count !== 2) throw new Error(`Expected 2 support reward labels, found ${count}`);
  return source.replaceAll(before, after);
});

update('turn-tests/support-challenges-production.mjs', (source) => {
  source = replaceOnce(
    source,
    `const facadeSource = await fs.readFile(new URL('../turn/achievements.js', import.meta.url), 'utf8');\nconst config = normalizeSupportChallengeConfig(rawConfig);`,
    `const facadeSource = await fs.readFile(new URL('../turn/achievements.js', import.meta.url), 'utf8');\nconst runtimeSource = await fs.readFile(new URL('../turn/achievements/runtime.js', import.meta.url), 'utf8');\nconst viewSource = await fs.readFile(new URL('../turn/achievements/view.js', import.meta.url), 'utf8');\nconst homeSource = await fs.readFile(new URL('../turn/m8-home.js', import.meta.url), 'utf8');\nconst homeReplaySource = await fs.readFile(new URL('../turn/achievements/home-reward-replay-r225.js', import.meta.url), 'utf8');\nconst config = normalizeSupportChallengeConfig(rawConfig);`,
    'support regression source inputs'
  );

  source = replaceOnce(
    source,
    `assert.match(feedbackSource, /turn:achievements-updated/,\n  'Challenge completion must coordinate with same-lap achievement feedback');\nassert.match(feedbackSource, /turn:trophy-bonus/,\n  'Challenge completion must follow the authoritative support bonus event');\nassert.match(feedbackSource, /turn-trophy-reward-toast/,\n  'Trophy Road reward feedback must be deferred while challenge/achievement feedback owns the cue lane');`,
    `assert.match(feedbackSource, /turn:trophy-bonus/,\n  'Challenge completion must follow the authoritative support bonus event');\nassert.match(feedbackSource, /turn:home-shown/,\n  'Home challenge replay must use the canonical Home lifecycle rather than watching DOM state');\nassert.match(feedbackSource, /holdRewardPresentation/,\n  'Home challenge replay must acquire the achievement runtime reward hold before presenting');\nassert.match(feedbackSource, /releaseRewardPresentation/,\n  'Home challenge replay must release the runtime reward hold after its pill and notification finish');\nassert.doesNotMatch(feedbackSource, /achievementObserver|rewardObserver|supportObserver|bodyObserver/,\n  'Support feedback must not coordinate achievement and reward ordering by observing toast DOM');\nassert.match(runtimeSource, /rewardPresentationHolds: new Set\(\)/,\n  'The achievement runtime must own reward presentation holds');\nassert.match(runtimeSource, /if \(session\.rewardPresentationHolds\.size\) return;/,\n  'Queued Trophy Road rewards must stay queued while a presentation hold is active');\nassert.match(viewSource, /turn:trophy-road-toast-shown/,\n  'The achievement view must publish reward presentation explicitly');\nassert.match(homeSource, /turn:home-shown/,\n  'Home navigation must publish a real Home shown lifecycle event');\nassert.match(homeReplaySource, /turn:support-home-feedback-started/,\n  'Home reward replay must pause while support feedback owns the cue lane');\nassert.match(homeReplaySource, /turn:support-home-feedback-ended/,\n  'Home reward replay must resume after support feedback ends');\nassert.doesNotMatch(homeReplaySource, /new MutationObserver/,\n  'Home reward replay must use explicit presentation and Home lifecycle events rather than DOM observation');`,
    'support regression feedback contract'
  );
  return source;
});

update('turn-lab/tests/stat-legend-production.mjs', (source) => replaceOnce(
  source,
  `assert.match(homeRewardReplay, /consume\\(currentIds\\)/,\n  'If the ordinary reward toast first appears after Home is already open, it must count as the Home reminder instead of duplicating immediately');`,
  `assert.match(homeRewardReplay, /turn:trophy-road-toast-shown/,\n  'The ordinary reward toast must explicitly tell Home replay when it has actually been presented');\nassert.match(homeRewardReplay, /turn:support-home-feedback-started/,\n  'Home reward replay must yield to support completion feedback before replaying a reward');\nassert.match(homeRewardReplay, /turn:support-home-feedback-ended/,\n  'Home reward replay must resume only after support completion feedback is finished');`,
  'Home reward replay regression assertions'
));

update('turn-tests/home-navigation-production.mjs', (source) => {
  const anchor = `assert.match(homeSource, /showHome\\(\\{ focus: true \\}\\)/);`;
  return replaceOnce(
    source,
    anchor,
    `${anchor}\nassert.match(homeSource, /turn:home-shown/, 'Home navigation must publish an explicit shown lifecycle event for queued feedback');`,
    'Home lifecycle regression assertion'
  );
});

console.log('Support feedback lifecycle refactor applied.');
