export const HUD_NOTIFICATION_SLOT = Object.freeze({
  RACE_STATUS: 'race-status',
  RACE_CUE: 'race-cue',
  PROGRESSION: 'progression'
});

export const HUD_NOTIFICATION_KIND = Object.freeze({
  INFO: 'info',
  COMMAND: 'command',
  GUIDANCE: 'guidance',
  SUCCESS: 'success',
  DANGER: 'danger',
  ACHIEVEMENT: 'achievement',
  REWARD: 'reward'
});

export const HUD_NOTIFICATION_POLICY = Object.freeze({
  [HUD_NOTIFICATION_SLOT.RACE_STATUS]: 'replace',
  [HUD_NOTIFICATION_SLOT.RACE_CUE]: 'replace',
  [HUD_NOTIFICATION_SLOT.PROGRESSION]: 'queue'
});

export const HUD_NOTIFICATION_DEFAULT_DURATION_MS = Object.freeze({
  [HUD_NOTIFICATION_SLOT.RACE_STATUS]: 4000,
  [HUD_NOTIFICATION_SLOT.RACE_CUE]: 2800,
  [HUD_NOTIFICATION_SLOT.PROGRESSION]: 3200
});

export const HUD_NOTIFICATION_EXIT_MS = 160;

const SLOT_VALUES = new Set(Object.values(HUD_NOTIFICATION_SLOT));
const KIND_VALUES = new Set(Object.values(HUD_NOTIFICATION_KIND));

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeSlot(slot) {
  const value = String(slot || '');
  if (!SLOT_VALUES.has(value)) throw new TypeError(`Unknown TURN HUD notification slot: ${value || '(empty)'}`);
  return value;
}

function normalizeKind(kind) {
  const value = String(kind || HUD_NOTIFICATION_KIND.INFO);
  return KIND_VALUES.has(value) ? value : HUD_NOTIFICATION_KIND.INFO;
}

function text(value) {
  return value == null ? '' : String(value);
}

function defaultAnnouncement(notification) {
  return [notification.kicker, notification.title, notification.detail, notification.badge]
    .map((part) => text(part).trim())
    .filter(Boolean)
    .join('. ');
}

function accessibleActionLabel(notification) {
  return text(notification.actionLabel).trim() || defaultAnnouncement(notification);
}

function makeTextNode(documentRef, className, value) {
  if (!text(value).trim()) return null;
  const node = documentRef.createElement('span');
  node.className = className;
  node.textContent = text(value);
  return node;
}

function appendIf(parent, node) {
  if (node) parent.append(node);
}

function createPlate(documentRef, slot, notification) {
  const interactive = typeof notification.onActivate === 'function';
  const plate = documentRef.createElement(interactive ? 'button' : 'div');
  plate.className = 'turn-hud-notification';
  plate.dataset.slot = slot;
  plate.dataset.kind = normalizeKind(notification.kind);
  plate.dataset.state = 'visible';

  if (interactive) {
    plate.type = 'button';
    plate.classList.add('is-actionable');
    plate.setAttribute('aria-label', accessibleActionLabel(notification));
    plate.addEventListener('click', notification.onActivate);
  } else {
    plate.setAttribute('aria-hidden', 'true');
  }

  const media = documentRef.createElement('span');
  media.className = 'turn-hud-notification__media';
  media.setAttribute('aria-hidden', 'true');
  if (notification.mediaNode) media.append(notification.mediaNode);
  else media.hidden = true;

  const copy = documentRef.createElement('span');
  copy.className = 'turn-hud-notification__copy';
  appendIf(copy, makeTextNode(documentRef, 'turn-hud-notification__kicker', notification.kicker));
  appendIf(copy, makeTextNode(documentRef, 'turn-hud-notification__title', notification.title));
  appendIf(copy, makeTextNode(documentRef, 'turn-hud-notification__detail', notification.detail));

  const badge = makeTextNode(documentRef, 'turn-hud-notification__badge', notification.badge);
  appendIf(plate, media);
  appendIf(plate, copy);
  appendIf(plate, badge);
  return plate;
}

function makeSlotRecord(element) {
  return {
    element,
    active: null,
    queue: []
  };
}

export function createHudNotificationController({
  hud,
  documentRef = globalThis.document,
  setTimer = (callback, delay) => globalThis.setTimeout?.(callback, delay) || 0,
  clearTimer = (timer) => globalThis.clearTimeout?.(timer),
  queueMicrotaskRef = (callback) => globalThis.queueMicrotask?.(callback) ?? Promise.resolve().then(callback),
  exitMs = HUD_NOTIFICATION_EXIT_MS
} = {}) {
  if (!hud || !documentRef?.createElement) {
    throw new TypeError('TURN HUD notifications require a HUD element and document.');
  }

  const host = documentRef.createElement('div');
  host.className = 'turn-hud-notifications';
  host.setAttribute('data-turn-hud-notifications', '');

  const slots = {};
  for (const slot of Object.values(HUD_NOTIFICATION_SLOT)) {
    const element = documentRef.createElement('div');
    element.className = 'turn-hud-notification-slot';
    element.dataset.slot = slot;
    element.setAttribute('data-turn-hud-slot', slot);
    element.setAttribute('aria-live', 'off');
    host.append(element);
    slots[slot] = makeSlotRecord(element);
  }

  const announcer = documentRef.createElement('p');
  announcer.className = 'turn-sr-only turn-hud-notification-announcer';
  announcer.setAttribute('role', 'status');
  announcer.setAttribute('aria-live', 'polite');
  announcer.setAttribute('aria-atomic', 'true');
  host.append(announcer);
  hud.append(host);

  let destroyed = false;
  let announcementRevision = 0;
  const normalizedExitMs = Math.max(0, finiteNumber(exitMs, HUD_NOTIFICATION_EXIT_MS));

  function announce(message) {
    const value = text(message).trim();
    if (!value) return;
    const revision = ++announcementRevision;
    announcer.textContent = '';
    queueMicrotaskRef(() => {
      if (!destroyed && revision === announcementRevision) announcer.textContent = value;
    });
  }

  function release(record, slot, { advance = true } = {}) {
    if (!record?.active) {
      if (advance) showNext(slot);
      return;
    }
    const current = record.active;
    clearTimer(current.hideTimer);
    clearTimer(current.exitTimer);
    current.node.remove?.();
    record.active = null;
    if (typeof current.notification.onDismiss === 'function') {
      current.notification.onDismiss();
    }
    if (advance) showNext(slot);
  }

  function beginExit(slot) {
    const record = slots[slot];
    if (!record?.active) return false;
    const current = record.active;
    clearTimer(current.hideTimer);
    current.hideTimer = 0;
    current.node.dataset.state = 'leaving';
    current.exitTimer = setTimer(() => release(record, slot), normalizedExitMs);
    return true;
  }

  function mount(slot, notification) {
    const record = slots[slot];
    const node = createPlate(documentRef, slot, notification);
    record.element.append(node);

    const durationMs = Math.max(
      250,
      finiteNumber(notification.durationMs, HUD_NOTIFICATION_DEFAULT_DURATION_MS[slot])
    );
    const active = {
      notification,
      node,
      priority: finiteNumber(notification.priority),
      hideTimer: 0,
      exitTimer: 0
    };
    record.active = active;
    active.hideTimer = setTimer(() => beginExit(slot), durationMs);

    const shouldAnnounce = notification.announce !== false;
    if (shouldAnnounce) announce(notification.announcement || defaultAnnouncement(notification));
    return node;
  }

  function showNext(slot) {
    const record = slots[slot];
    if (!record || record.active || !record.queue.length || destroyed) return false;
    mount(slot, record.queue.shift());
    return true;
  }

  function publish(slotValue, detail = {}) {
    if (destroyed) return false;
    const slot = normalizeSlot(slotValue);
    const record = slots[slot];
    const notification = {
      ...detail,
      kind: normalizeKind(detail.kind),
      id: text(detail.id)
    };

    if (HUD_NOTIFICATION_POLICY[slot] === 'queue') {
      const duplicateId = notification.id && (
        record.active?.notification?.id === notification.id
        || record.queue.some((queued) => queued.id === notification.id)
      );
      if (duplicateId) return false;
      if (record.active) {
        record.queue.push(notification);
        return true;
      }
      mount(slot, notification);
      return true;
    }

    if (record.active) {
      const nextPriority = finiteNumber(notification.priority);
      if (nextPriority < record.active.priority) return false;
      release(record, slot, { advance: false });
    }
    mount(slot, notification);
    return true;
  }

  function dismiss(slotValue, { clearQueue = false } = {}) {
    const slot = normalizeSlot(slotValue);
    const record = slots[slot];
    if (clearQueue) record.queue.length = 0;
    return beginExit(slot);
  }

  function clear(slotValue) {
    const slot = normalizeSlot(slotValue);
    const record = slots[slot];
    record.queue.length = 0;
    release(record, slot, { advance: false });
    return true;
  }

  function inspect() {
    return Object.fromEntries(Object.entries(slots).map(([slot, record]) => [slot, {
      active: record.active ? {
        id: record.active.notification.id,
        kind: record.active.notification.kind,
        title: text(record.active.notification.title),
        priority: record.active.priority
      } : null,
      queued: record.queue.map((notification) => ({
        id: notification.id,
        kind: notification.kind,
        title: text(notification.title)
      }))
    }]));
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    announcementRevision += 1;
    for (const slot of Object.values(HUD_NOTIFICATION_SLOT)) {
      const record = slots[slot];
      record.queue.length = 0;
      release(record, slot, { advance: false });
    }
    announcer.textContent = '';
    host.remove?.();
  }

  return Object.freeze({
    host,
    publish,
    dismiss,
    clear,
    inspect,
    destroy,
    elementFor(slotValue) {
      return slots[normalizeSlot(slotValue)].element;
    }
  });
}
