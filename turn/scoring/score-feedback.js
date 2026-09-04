export const SCORE_FEEDBACK_CHANNEL = Object.freeze({
  DRIFT: 'drift',
  FLOW: 'flow'
});

export const SCORE_FEEDBACK_EVENT = Object.freeze({
  BUILD: 'build',
  TECHNIQUE: 'technique',
  MILESTONE: 'milestone',
  BANK: 'bank',
  LOSS: 'loss',
  PERSONAL_BEST: 'personal-best',
  LAP_RESULT: 'lap-result',
  RESET: 'reset'
});

export const SCORE_FEEDBACK_PRIORITY = Object.freeze({
  [SCORE_FEEDBACK_EVENT.BUILD]: 10,
  [SCORE_FEEDBACK_EVENT.TECHNIQUE]: 20,
  [SCORE_FEEDBACK_EVENT.MILESTONE]: 30,
  [SCORE_FEEDBACK_EVENT.BANK]: 40,
  [SCORE_FEEDBACK_EVENT.LOSS]: 40,
  [SCORE_FEEDBACK_EVENT.PERSONAL_BEST]: 50,
  [SCORE_FEEDBACK_EVENT.LAP_RESULT]: 50,
  [SCORE_FEEDBACK_EVENT.RESET]: 100
});

export const SCORE_FEEDBACK_COMMIT_INTERVAL_MS = 100;
export const SCORE_FEEDBACK_ANNOUNCEMENT_INTERVAL_MS = 1200;

const EVENT_DURATION_MS = Object.freeze({
  [SCORE_FEEDBACK_EVENT.BUILD]: 500,
  [SCORE_FEEDBACK_EVENT.TECHNIQUE]: 850,
  [SCORE_FEEDBACK_EVENT.MILESTONE]: 1100,
  [SCORE_FEEDBACK_EVENT.BANK]: 1500,
  [SCORE_FEEDBACK_EVENT.LOSS]: 1600,
  [SCORE_FEEDBACK_EVENT.PERSONAL_BEST]: 2400,
  [SCORE_FEEDBACK_EVENT.LAP_RESULT]: 2400
});

const CHANNEL_LABEL = Object.freeze({
  [SCORE_FEEDBACK_CHANNEL.DRIFT]: 'DRIFT',
  [SCORE_FEEDBACK_CHANNEL.FLOW]: 'FLOW'
});

const numberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0
});

function makeChannel(label) {
  return {
    active: false,
    visible: false,
    score: 0,
    unbanked: 0,
    multiplier: 1,
    intensity: 0,
    phase: 'quiet',
    label,
    tokens: ['', '', '', '', '']
  };
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function setText(element, value) {
  const text = String(value);
  if (element.textContent !== text) element.textContent = text;
}

function setHidden(element, hidden) {
  if (element.hidden !== hidden) element.hidden = hidden;
}

function setData(element, key, value) {
  const text = String(value);
  if (element.dataset[key] !== text) element.dataset[key] = text;
}

function requiredElement(root, selector) {
  const element = root?.querySelector?.(selector);
  if (!element) throw new Error(`TURN ScoreFeedback could not find ${selector}.`);
  return element;
}

function optionalElement(root, selector) {
  return root?.querySelector?.(selector) || null;
}

function normalizeChannel(channel) {
  return channel === SCORE_FEEDBACK_CHANNEL.FLOW
    ? SCORE_FEEDBACK_CHANNEL.FLOW
    : SCORE_FEEDBACK_CHANNEL.DRIFT;
}

function normalizeEventType(type) {
  return Object.values(SCORE_FEEDBACK_EVENT).includes(type)
    ? type
    : SCORE_FEEDBACK_EVENT.BUILD;
}

function heatTier(intensity, active = true) {
  const value = clamp(finiteNumber(intensity), 0, 1);
  if (!active || value <= 0) return 'quiet';
  if (value >= 0.92) return 'critical';
  if (value >= 0.74) return 'hot';
  if (value >= 0.5) return 'warm';
  return 'build';
}

function defaultEventLabel(type, channel, score, multiplier) {
  const channelLabel = CHANNEL_LABEL[channel];
  if (type === SCORE_FEEDBACK_EVENT.BANK) return `✓ BANKED ×${formatMultiplier(multiplier)}`;
  if (type === SCORE_FEEDBACK_EVENT.LOSS) return `${channelLabel} LOST`;
  if (type === SCORE_FEEDBACK_EVENT.PERSONAL_BEST) return 'NEW BEST';
  if (type === SCORE_FEEDBACK_EVENT.LAP_RESULT) return `${channelLabel} ${numberFormatter.format(score)}`;
  if (type === SCORE_FEEDBACK_EVENT.MILESTONE) return `${channelLabel} ×${formatMultiplier(multiplier)}`;
  return channelLabel;
}

function defaultAnnouncement(type, channel, score, multiplier) {
  const channelLabel = CHANNEL_LABEL[channel].toLocaleLowerCase('en');
  if (type === SCORE_FEEDBACK_EVENT.BANK) {
    return `${channelLabel} banked. ${numberFormatter.format(score)} points.`;
  }
  if (type === SCORE_FEEDBACK_EVENT.LOSS) {
    return `${channelLabel} lost. ${numberFormatter.format(score)} unbanked points lost.`;
  }
  if (type === SCORE_FEEDBACK_EVENT.PERSONAL_BEST) return `New ${channelLabel} best.`;
  if (type === SCORE_FEEDBACK_EVENT.LAP_RESULT) {
    return `${channelLabel} result. ${numberFormatter.format(score)} points.`;
  }
  if (type === SCORE_FEEDBACK_EVENT.MILESTONE) {
    return `${channelLabel} multiplier times ${formatMultiplier(multiplier)}.`;
  }
  return '';
}

function formatMultiplier(value) {
  const multiplier = Math.max(1, finiteNumber(value, 1));
  return Number.isInteger(multiplier) ? String(multiplier) : multiplier.toFixed(1);
}

function formatScore(value) {
  return numberFormatter.format(Math.max(0, Math.round(finiteNumber(value))));
}

export function createScoreFeedback({
  root,
  commitIntervalMs = SCORE_FEEDBACK_COMMIT_INTERVAL_MS,
  announcementIntervalMs = SCORE_FEEDBACK_ANNOUNCEMENT_INTERVAL_MS,
  onSound = null
} = {}) {
  if (!root) throw new Error('TURN ScoreFeedback requires a fixed root element.');

  const statePanel = requiredElement(root, '[data-score-feedback-state]');
  const driftReadout = optionalElement(root, '[data-score-feedback-drift-readout]') || statePanel;
  const stateLabel = requiredElement(root, '[data-score-feedback-label]');
  const currentScore = requiredElement(root, '[data-score-feedback-current]');
  const multiplier = requiredElement(root, '[data-score-feedback-multiplier]');
  const lapScore = requiredElement(root, '[data-score-feedback-total]');
  const driftGaugeFill = requiredElement(root, '[data-score-feedback-meter-fill]');
  const flowGaugeFill = optionalElement(root, '[data-score-feedback-flow-meter-fill]');
  const flowReadout = optionalElement(root, '[data-score-feedback-flow-readout]');
  const flowStatePanel = optionalElement(root, '[data-score-feedback-flow-state]');
  const flowCurrentScore = optionalElement(root, '[data-score-feedback-flow-current]');
  const flowMultiplier = optionalElement(root, '[data-score-feedback-flow-multiplier]');
  const flowLapScore = optionalElement(root, '[data-score-feedback-flow-total]');
  const flowTechniquePool = optionalElement(root, '[data-score-feedback-flow-techniques]');
  const flowTechniqueTokens = flowTechniquePool?.querySelectorAll?.('span') || [];
  const callout = requiredElement(root, '[data-score-feedback-callout]');
  const calloutLabel = requiredElement(root, '[data-score-feedback-callout-label]');
  const calloutScore = requiredElement(root, '[data-score-feedback-callout-score]');
  const announcer = requiredElement(root, '[data-score-feedback-announcer]');

  const channels = {
    [SCORE_FEEDBACK_CHANNEL.DRIFT]: makeChannel(CHANNEL_LABEL.drift),
    [SCORE_FEEDBACK_CHANNEL.FLOW]: makeChannel(CHANNEL_LABEL.flow)
  };
  const activeEvent = {
    active: false,
    channel: SCORE_FEEDBACK_CHANNEL.DRIFT,
    type: SCORE_FEEDBACK_EVENT.BUILD,
    priority: 0,
    score: 0,
    multiplier: 1,
    label: '',
    announcement: '',
    expiresAt: 0,
    revision: 0
  };
  const minCommitInterval = Math.max(80, finiteNumber(commitIntervalMs, SCORE_FEEDBACK_COMMIT_INTERVAL_MS));
  const minAnnouncementInterval = Math.max(
    500,
    finiteNumber(announcementIntervalMs, SCORE_FEEDBACK_ANNOUNCEMENT_INTERVAL_MS)
  );
  let dirty = true;
  let lastCommitAt = -Infinity;
  let lastAnnouncementAt = -Infinity;
  let lastAnnouncementPriority = 0;
  let announcementRevision = 0;

  function updateState(channel, snapshot = {}, now = 0) {
    const normalizedChannel = normalizeChannel(channel);
    const target = channels[normalizedChannel];
    target.active = snapshot.active === true;
    target.score = Math.max(0, finiteNumber(snapshot.score));
    target.unbanked = Math.max(0, finiteNumber(snapshot.unbanked));
    target.multiplier = Math.max(1, finiteNumber(snapshot.multiplier, 1));
    target.intensity = clamp(finiteNumber(snapshot.intensity), 0, 1);
    target.phase = String(snapshot.phase || (target.active ? 'build' : 'quiet'));
    target.label = String(snapshot.label || CHANNEL_LABEL[normalizedChannel]);
    if (Array.isArray(snapshot.tokens)) {
      for (let index = 0; index < target.tokens.length; index += 1) {
        target.tokens[index] = String(snapshot.tokens[index] || '');
      }
    }
    dirty = true;
    return commit(now);
  }

  function setChannelVisible(channel, visible, now = 0) {
    const normalizedChannel = normalizeChannel(channel);
    channels[normalizedChannel].visible = visible !== false;
    if (!channels[normalizedChannel].visible
      && activeEvent.active
      && activeEvent.channel === normalizedChannel) {
      clearEvent();
    }
    dirty = true;
    return commit(now, true);
  }

  function publishEvent(channel, type, detail = {}, now = 0) {
    const normalizedChannel = normalizeChannel(channel);
    const normalizedType = normalizeEventType(type);
    const timestamp = finiteNumber(now);
    if (normalizedType === SCORE_FEEDBACK_EVENT.RESET) {
      return clearChannel(normalizedChannel, timestamp);
    }
    if (!channels[normalizedChannel].visible) return false;

    const priority = Math.max(
      SCORE_FEEDBACK_PRIORITY[normalizedType] || 0,
      finiteNumber(detail.priority)
    );
    if (activeEvent.active && timestamp < activeEvent.expiresAt && priority < activeEvent.priority) {
      return false;
    }

    const score = Math.max(0, finiteNumber(detail.score));
    const eventMultiplier = Math.max(1, finiteNumber(detail.multiplier, 1));
    activeEvent.active = true;
    activeEvent.channel = normalizedChannel;
    activeEvent.type = normalizedType;
    activeEvent.priority = priority;
    activeEvent.score = score;
    activeEvent.multiplier = eventMultiplier;
    activeEvent.label = String(
      detail.label || defaultEventLabel(normalizedType, normalizedChannel, score, eventMultiplier)
    );
    activeEvent.announcement = detail.announce === false
      ? ''
      : String(
        detail.announcement || defaultAnnouncement(
          normalizedType,
          normalizedChannel,
          score,
          eventMultiplier
        )
      );
    activeEvent.expiresAt = timestamp + Math.max(
      250,
      finiteNumber(detail.durationMs, EVENT_DURATION_MS[normalizedType] || 800)
    );
    activeEvent.revision += 1;
    dirty = true;

    if (channels[normalizedChannel].visible) {
      announceActiveEvent(timestamp);
      if (typeof onSound === 'function') onSound(normalizedType, normalizedChannel, detail);
    }
    return commit(timestamp, true);
  }

  function announceActiveEvent(now) {
    const message = activeEvent.announcement.trim();
    if (!message) return false;
    const higherPriority = activeEvent.priority > lastAnnouncementPriority;
    if (!higherPriority && now - lastAnnouncementAt < minAnnouncementInterval) return false;

    lastAnnouncementAt = now;
    lastAnnouncementPriority = activeEvent.priority;
    const revision = ++announcementRevision;
    announcer.textContent = '';
    globalThis.queueMicrotask?.(() => {
      if (revision === announcementRevision) announcer.textContent = message;
    });
    return true;
  }

  function clearEvent() {
    activeEvent.active = false;
    activeEvent.priority = 0;
    activeEvent.expiresAt = 0;
    activeEvent.label = '';
    activeEvent.announcement = '';
  }

  function resetChannelState(channel) {
    channel.active = false;
    channel.score = 0;
    channel.unbanked = 0;
    channel.multiplier = 1;
    channel.intensity = 0;
    channel.phase = 'quiet';
    channel.tokens.fill('');
  }

  function clearChannel(channel, now = 0) {
    const normalizedChannel = normalizeChannel(channel);
    resetChannelState(channels[normalizedChannel]);
    if (activeEvent.active && activeEvent.channel === normalizedChannel) clearEvent();
    dirty = true;
    return commit(now, true);
  }

  function dismissEvent(channel, now = 0) {
    const normalizedChannel = normalizeChannel(channel);
    if (!activeEvent.active || activeEvent.channel !== normalizedChannel) return false;
    clearEvent();
    dirty = true;
    return commit(now, true);
  }

  function reset(now = 0) {
    for (const channel of Object.values(channels)) {
      resetChannelState(channel);
      channel.visible = false;
    }
    clearEvent();
    announcementRevision += 1;
    announcer.textContent = '';
    lastAnnouncementPriority = 0;
    dirty = true;
    return commit(now, true);
  }

  function commit(now = 0, force = false) {
    const timestamp = finiteNumber(now);
    if (activeEvent.active && timestamp >= activeEvent.expiresAt) {
      clearEvent();
      dirty = true;
      lastAnnouncementPriority = 0;
    }
    if (!dirty || (!force && timestamp - lastCommitAt < minCommitInterval)) return false;

    const flow = channels[SCORE_FEEDBACK_CHANNEL.FLOW];
    const drift = channels[SCORE_FEEDBACK_CHANNEL.DRIFT];
    const driftActive = drift.visible && drift.active;
    const flowActive = flow.visible && flow.active;
    const primary = flowActive
      ? flow
      : driftActive
        ? drift
        : drift.visible
          ? drift
          : flow.visible
            ? flow
            : null;
    const eventVisible = activeEvent.active && channels[activeEvent.channel].visible;
    const flowHasOwnGauge = Boolean(flowGaugeFill);
    const fallbackGaugeToFlow = !flowHasOwnGauge && flowActive && primary === flow;
    const driftGaugeActive = driftActive || fallbackGaugeToFlow;
    const driftGaugeVisible = drift.visible || fallbackGaugeToFlow;
    const driftGaugeIntensity = fallbackGaugeToFlow ? flow.intensity : drift.intensity;

    driftGaugeFill.style.setProperty(
      '--score-feedback-progress',
      String(driftGaugeActive ? driftGaugeIntensity : 0)
    );
    if (flowGaugeFill) {
      flowGaugeFill.style.setProperty(
        '--score-feedback-progress',
        String(flowActive ? flow.intensity : 0)
      );
    }
    setData(root, 'driftActive', driftActive);
    setData(root, 'flowActive', flowActive);
    setData(root, 'driftVisible', drift.visible);
    setData(root, 'flowVisible', flow.visible);
    setData(root, 'driftGaugeVisible', driftGaugeVisible);
    setData(root, 'flowGaugeVisible', Boolean(flowHasOwnGauge && flow.visible));
    setData(root, 'driftHeat', heatTier(drift.intensity, driftActive));
    setData(root, 'flowHeat', heatTier(flow.intensity, flowActive));
    setData(root, 'gaugeHeat', heatTier(driftGaugeIntensity, driftGaugeActive));
    setData(root, 'gaugeChannel', fallbackGaugeToFlow ? SCORE_FEEDBACK_CHANNEL.FLOW : SCORE_FEEDBACK_CHANNEL.DRIFT);
    setData(root, 'scoreLayout', flow.visible && drift.visible ? 'dual' : 'single');
    setHidden(driftReadout, !drift.visible);
    if (flowReadout) setHidden(flowReadout, !flow.visible);

    if (drift.visible) {
      const liveScore = drift.active
        ? drift.unbanked > 0 ? drift.unbanked : drift.score
        : 0;
      setData(driftReadout, 'phase', drift.phase);
      setText(stateLabel, drift.label);
      setText(currentScore, formatScore(liveScore));
      setText(multiplier, `×${formatMultiplier(drift.multiplier)}`);
      setText(lapScore, formatScore(drift.score));
    }
    if (flow.visible && flowStatePanel && flowCurrentScore && flowMultiplier && flowLapScore) {
      const liveScore = flow.active
        ? flow.unbanked > 0 ? flow.unbanked : flow.score
        : 0;
      setData(flowReadout, 'phase', flow.phase);
      setText(flowCurrentScore, formatScore(liveScore));
      setText(flowMultiplier, `×${formatMultiplier(flow.multiplier)}`);
      setText(flowLapScore, formatScore(flow.score));
      for (let index = 0; index < flowTechniqueTokens.length; index += 1) {
        setText(flowTechniqueTokens[index], flow.tokens[index] || '');
      }
    }
    if (primary) {
      setData(root, 'channel', primary === flow ? SCORE_FEEDBACK_CHANNEL.FLOW : SCORE_FEEDBACK_CHANNEL.DRIFT);
      setData(root, 'phase', primary.phase);
    }

    setHidden(callout, !eventVisible);
    if (eventVisible) {
      setData(callout, 'event', activeEvent.type);
      setData(callout, 'channel', activeEvent.channel);
      setText(calloutLabel, activeEvent.label);
      const eventScore = activeEvent.type === SCORE_FEEDBACK_EVENT.BANK
        ? `+${formatScore(activeEvent.score)}`
        : formatScore(activeEvent.score);
      setText(calloutScore, activeEvent.score > 0 ? eventScore : '');
      calloutScore.hidden = !(activeEvent.score > 0);
      callout.classList.toggle('is-release', activeEvent.priority >= SCORE_FEEDBACK_PRIORITY.bank);
      const evenRevision = activeEvent.revision % 2 === 0;
      callout.classList.toggle('is-event-a', !evenRevision);
      callout.classList.toggle('is-event-b', evenRevision);
    } else {
      callout.classList.remove('is-release', 'is-event-a', 'is-event-b');
    }

    setHidden(root, !drift.visible && !flow.visible && !eventVisible);
    dirty = false;
    lastCommitAt = timestamp;
    return true;
  }

  function inspect() {
    return {
      activeEvent: { ...activeEvent },
      drift: { ...channels[SCORE_FEEDBACK_CHANNEL.DRIFT] },
      flow: { ...channels[SCORE_FEEDBACK_CHANNEL.FLOW] },
      lastCommitAt
    };
  }

  reset(0);
  return Object.freeze({
    updateState,
    publishEvent,
    setChannelVisible,
    commit,
    clearChannel,
    dismissEvent,
    reset,
    inspect
  });
}
