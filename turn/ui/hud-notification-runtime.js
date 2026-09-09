import {
  HUD_NOTIFICATION_KIND,
  HUD_NOTIFICATION_SLOT,
  createHudNotificationController
} from './hud-notifications.js';

const STYLE_ID = 'turnHudNotificationsStyles';
const STYLE_HREF = '/turn/hud-notifications.css?revision=r266-standard-hud';
const RACE_STATUS_RESULT_PRIORITY = 20;
const RACE_STATUS_VOID_PRIORITY = 40;
const scoreFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

function text(value) {
  return value == null ? '' : String(value);
}

function number(value, fallback = 0) {
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
}

function ensureStylesheet(documentRef) {
  if (!documentRef?.head || documentRef.getElementById?.(STYLE_ID)) return;
  const link = documentRef.createElement('link');
  link.id = STYLE_ID;
  link.rel = 'stylesheet';
  link.href = STYLE_HREF;
  documentRef.head.append(link);
}

function makeStatusCell(documentRef, label, value, status = '') {
  const cell = documentRef.createElement('span');
  cell.className = 'turn-race-status-cell';

  const kicker = documentRef.createElement('small');
  kicker.textContent = label;
  const main = documentRef.createElement('strong');
  main.textContent = value;
  cell.append(kicker, main);

  if (status) {
    const aside = documentRef.createElement('b');
    aside.textContent = status;
    cell.append(aside);
  }
  return cell;
}

function formatLapTime(seconds) {
  const value = Math.max(0, number(seconds));
  const minutes = Math.floor(value / 60);
  const secs = Math.floor(value % 60).toString().padStart(2, '0');
  const millis = Math.floor((value % 1) * 1000).toString().padStart(3, '0');
  return `${minutes}:${secs}.${millis}`;
}

function makeLapResultBody(documentRef, result = {}) {
  const body = documentRef.createElement('span');
  body.className = 'turn-race-status-grid';
  const place = Math.max(1, Math.round(number(result.position, 1)));
  const total = Math.max(1, Math.round(number(result.total, 1)));
  body.append(makeStatusCell(documentRef, 'LAP', `${place}/${total} · ${formatLapTime(result.time)}`));

  for (const [label, scoreResult] of [['DRIFT', result.drift], ['FLOW', result.flow]]) {
    if (scoreResult?.available !== true || !Number.isFinite(Number(scoreResult.score))) continue;
    const score = scoreFormatter.format(Math.max(0, Math.round(Number(scoreResult.score))));
    const best = Math.max(0, Math.round(Number(scoreResult.bestScore) || 0));
    const status = scoreResult.newBest === true
      ? 'NEW BEST'
      : best > 0
        ? `BEST ${scoreFormatter.format(best)}`
        : '';
    body.append(makeStatusCell(documentRef, label, score, status));
  }
  return body;
}

function defaultLapResultAnnouncement(result = {}) {
  const place = Math.max(1, Math.round(number(result.position, 1)));
  const total = Math.max(1, Math.round(number(result.total, 1)));
  return `Lap result. Position ${place} of ${total}. Time ${formatLapTime(result.time)}.`;
}

function cueKind(message) {
  const upper = text(message).toUpperCase();
  if (/PATIENT ON BOARD|MAYDAY|SECONDS/.test(upper)) return HUD_NOTIFICATION_KIND.DANGER;
  if (/CENTERED|CALIBRAT|READY|GOOD/.test(upper)) return HUD_NOTIFICATION_KIND.SUCCESS;
  if (/GO!|CHASE YOUR BEST/.test(upper)) return HUD_NOTIFICATION_KIND.COMMAND;
  return HUD_NOTIFICATION_KIND.GUIDANCE;
}

function cuePriority(message) {
  const upper = text(message).toUpperCase();
  if (/PATIENT ON BOARD|MAYDAY/.test(upper)) return 40;
  if (/GO!/.test(upper)) return 30;
  return 10;
}

function isVisibleToast(element) {
  return Boolean(element && element.hidden !== true && element.classList?.contains?.('is-visible'));
}

function cloneMedia(documentRef, source) {
  if (!source) return null;
  const media = documentRef.createElement('span');
  media.className = 'turn-progression-icon';
  media.innerHTML = source.innerHTML || '';
  return media;
}

function installLegacyMessageBridge({ controller, documentRef, windowRef }) {
  const message = documentRef.querySelector?.('#message');
  if (!message || typeof MutationObserver !== 'function') return () => {};
  let lastSignature = '';

  const sync = () => {
    if (!message.classList?.contains?.('show')) return;
    const copy = text(message.textContent).trim();
    if (!copy) return;
    const signature = `${copy}|${message.className}`;
    if (signature === lastSignature) return;
    lastSignature = signature;
    controller.publish(HUD_NOTIFICATION_SLOT.RACE_CUE, {
      id: `legacy-message:${copy}`,
      kind: cueKind(copy),
      title: copy,
      priority: cuePriority(copy),
      durationMs: 2800,
      // #message remains the existing polite status source until its producers
      // migrate semantically. The shared visual must not speak it twice.
      announce: false
    });
  };

  const observer = new MutationObserver(sync);
  observer.observe(message, { attributes: true, attributeFilter: ['class'], childList: true, characterData: true, subtree: true });
  windowRef?.addEventListener?.('turn:ui-state-change', (event) => {
    if (!event.detail?.running) {
      lastSignature = '';
      controller.clear(HUD_NOTIFICATION_SLOT.RACE_CUE);
    }
  });
  sync();
  return () => observer.disconnect();
}

function installProgressionBridge({ controller, documentRef }) {
  if (typeof MutationObserver !== 'function') return () => {};
  const seenVisible = new WeakSet();

  const publishToast = (toast) => {
    if (!toast?.matches?.('.turn-achievement-toast') || !isVisibleToast(toast)) {
      if (toast && !isVisibleToast(toast)) seenVisible.delete(toast);
      return;
    }
    if (seenVisible.has(toast)) return;
    seenVisible.add(toast);

    const reward = toast.classList.contains('turn-trophy-reward-toast');
    const label = text(toast.querySelector?.('[data-achievement-toast-label]')?.textContent).trim();
    const title = text(toast.querySelector?.('[data-achievement-toast-title]')?.textContent).trim();
    const badge = text(toast.querySelector?.('[data-achievement-toast-badge]')?.textContent).trim();
    const guide = toast.querySelector?.('[data-trophy-reward-guide]');
    const guideCopy = guide && !guide.hidden ? text(guide.textContent).trim() : '';
    const icon = cloneMedia(documentRef, toast.querySelector?.('.turn-achievement-toast-icon'));
    const stableTitle = title || (reward ? 'TROPHY ROAD REWARD' : 'ACHIEVEMENT');

    controller.publish(HUD_NOTIFICATION_SLOT.PROGRESSION, {
      id: `${reward ? 'reward' : 'achievement'}:${stableTitle}:${badge}`,
      kind: reward ? HUD_NOTIFICATION_KIND.REWARD : HUD_NOTIFICATION_KIND.ACHIEVEMENT,
      kicker: label,
      title: stableTitle,
      detail: guideCopy,
      badge,
      mediaNode: icon,
      durationMs: 3200,
      announce: false,
      ...(reward ? {
        actionLabel: toast.getAttribute?.('aria-label') || `Open Achievements. ${stableTitle}`,
        onActivate: () => toast.click?.()
      } : {})
    });
  };

  const scan = (root = documentRef) => {
    for (const toast of root.querySelectorAll?.('.turn-achievement-toast') || []) publishToast(toast);
  };
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.target?.matches?.('.turn-achievement-toast')) publishToast(record.target);
      for (const node of record.addedNodes || []) {
        if (node?.matches?.('.turn-achievement-toast')) publishToast(node);
        scan(node);
      }
    }
  });
  observer.observe(documentRef.body, { attributes: true, attributeFilter: ['class', 'hidden'], childList: true, subtree: true });
  scan();
  return () => observer.disconnect();
}

function installRivalBridge({ controller, documentRef }) {
  if (typeof MutationObserver !== 'function') return () => {};
  let rival = documentRef.querySelector?.('.rival-onboarding');
  let slot = controller.elementFor(HUD_NOTIFICATION_SLOT.RACE_CUE);

  const adopt = () => {
    rival ||= documentRef.querySelector?.('.rival-onboarding');
    if (!rival || rival.dataset.turnHudAdopted === 'true') return;
    rival.dataset.turnHudAdopted = 'true';
    rival.dataset.slot = HUD_NOTIFICATION_SLOT.RACE_CUE;
    rival.dataset.kind = HUD_NOTIFICATION_KIND.COMMAND;
    rival.classList.add('turn-hud-notification', 'turn-hud-rival-cue');
    slot.append(rival);
  };

  const observer = new MutationObserver(() => adopt());
  observer.observe(documentRef.body, { childList: true, subtree: true });
  adopt();
  return () => observer.disconnect();
}

export function installHudNotificationRuntime({
  documentRef = globalThis.document,
  windowRef = globalThis,
  hud = documentRef?.querySelector?.('#hud')
} = {}) {
  if (globalThis.__turnHudNotifications?.controller) return globalThis.__turnHudNotifications;
  if (!hud) return null;
  ensureStylesheet(documentRef);
  documentRef.documentElement?.classList?.add?.('turn-hud-notifications-active');

  const controller = createHudNotificationController({ hud, documentRef });
  const cleanups = [];

  const onLapResult = (event) => {
    const result = event.detail || {};
    controller.publish(HUD_NOTIFICATION_SLOT.RACE_STATUS, {
      id: `lap-result:${number(result.position)}:${number(result.time)}`,
      kind: HUD_NOTIFICATION_KIND.INFO,
      contentNode: makeLapResultBody(documentRef, result),
      priority: RACE_STATUS_RESULT_PRIORITY,
      durationMs: 4000,
      // The canonical lap-result announcer remains the single speech owner.
      announce: false
    });
  };
  const onLapInvalid = (event) => {
    const guidance = event.detail?.reason === 'missed-checkpoint' ? 'STAY ON THE TRACK!' : 'TRY AGAIN';
    controller.publish(HUD_NOTIFICATION_SLOT.RACE_STATUS, {
      id: `lap-void:${event.detail?.reason || 'invalid'}`,
      kind: HUD_NOTIFICATION_KIND.DANGER,
      kicker: 'LAP VOID',
      title: guidance,
      priority: RACE_STATUS_VOID_PRIORITY,
      durationMs: 4000,
      announce: false
    });
  };
  const onUiState = (event) => {
    if (!event.detail?.running || event.detail?.reason === 'race-reset') {
      controller.clear(HUD_NOTIFICATION_SLOT.RACE_STATUS);
    }
  };
  windowRef.addEventListener?.('turn:lap-result', onLapResult);
  windowRef.addEventListener?.('turn:lap-invalid', onLapInvalid);
  windowRef.addEventListener?.('turn:ui-state-change', onUiState);
  cleanups.push(() => windowRef.removeEventListener?.('turn:lap-result', onLapResult));
  cleanups.push(() => windowRef.removeEventListener?.('turn:lap-invalid', onLapInvalid));
  cleanups.push(() => windowRef.removeEventListener?.('turn:ui-state-change', onUiState));
  cleanups.push(installLegacyMessageBridge({ controller, documentRef, windowRef }));
  cleanups.push(installProgressionBridge({ controller, documentRef }));
  cleanups.push(installRivalBridge({ controller, documentRef }));

  const api = Object.freeze({
    controller,
    publishRaceCue(detail) {
      return controller.publish(HUD_NOTIFICATION_SLOT.RACE_CUE, detail);
    },
    publishProgression(detail) {
      return controller.publish(HUD_NOTIFICATION_SLOT.PROGRESSION, detail);
    },
    clearRaceCue() {
      return controller.clear(HUD_NOTIFICATION_SLOT.RACE_CUE);
    },
    destroy() {
      for (const cleanup of cleanups.splice(0)) cleanup?.();
      controller.destroy();
      documentRef.documentElement?.classList?.remove?.('turn-hud-notifications-active');
      if (globalThis.__turnHudNotifications?.controller === controller) delete globalThis.__turnHudNotifications;
    }
  });
  globalThis.__turnHudNotifications = api;
  return api;
}

export const HUD_NOTIFICATION_STYLE_HREF = STYLE_HREF;
export { defaultLapResultAnnouncement };
