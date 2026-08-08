import { getStoredBestReplayLap } from '../race/rival-storage.js?build=20260806-r161';
import { TRACK_CATALOG, getTrackDefinition } from '../tracks/catalog.js?build=20260806-r161';
import { getTrackStorageRevision } from '../tracks/definitions.js?build=20260806-r161';
import { getCarDefinition } from '../vehicle/catalog.js?build=20260806-r161';
import {
  challengeFromLap,
  encodeChallenge,
  formatChallengeTime,
  normalizeChallengeName
} from '/yourturn/protocol-social.js?revision=r1';
import { makeShareableChallengeUrl } from '/yourturn/challenge-store.js?revision=r1';
import {
  loadSocialRacerProfile,
  saveSocialRacerName
} from './racer-profile.js?revision=r1';

const INSTALL_FLAG = Symbol.for('turn.yourturn.share.installed');
const PB_EPSILON = 0.0005;
const SHARE_ICON = `
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M12 15V3"></path>
    <path d="m7.5 7.5 4.5-4.5 4.5 4.5"></path>
    <path d="M5 11v8h14v-8"></path>
  </svg>`;

function installStylesheet() {
  const existing = document.querySelector('link[data-turn-yourturn-share]');
  if (existing?.sheet) return Promise.resolve(existing);
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve(existing), { once: true });
      existing.addEventListener('error', () => reject(new Error('TURN YOUR TURN sharing styles could not load.')), { once: true });
    });
  }

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/turn/social/your-turn-share.css?revision=r1';
  link.setAttribute('data-turn-yourturn-share', '');
  const ready = new Promise((resolve, reject) => {
    link.addEventListener('load', () => resolve(link), { once: true });
    link.addEventListener('error', () => reject(new Error('TURN YOUR TURN sharing styles could not load.')), { once: true });
  });
  document.head.appendChild(link);
  return ready;
}

function formatTrackName(trackId) {
  return getTrackDefinition(trackId)?.name || String(trackId || 'Track');
}

function createComposer() {
  const dialog = document.createElement('dialog');
  dialog.className = 'turn-yourturn-share-dialog';
  dialog.setAttribute('aria-labelledby', 'turnYourTurnShareTitle');
  dialog.innerHTML = `
    <article class="turn-yourturn-share-card">
      <header class="turn-yourturn-share-head">
        <div>
          <span>YOUR TURN</span>
          <h2 id="turnYourTurnShareTitle">SHARE YOUR TURN</h2>
        </div>
        <button class="turn-yourturn-share-close" type="button" aria-label="Close Share Your Turn">×</button>
      </header>
      <div class="turn-yourturn-share-details"></div>
      <p class="turn-yourturn-share-copy">Send your best lap as a challenge. Anyone who races it can add their car and pass the challenge on.</p>
      <label class="turn-yourturn-share-name">
        <span>Your name in the challenge</span>
        <input type="text" maxlength="24" autocomplete="nickname" placeholder="WRITE YOUR NAME HERE" required>
      </label>
      <p class="turn-yourturn-share-status" role="status" aria-live="polite"></p>
      <div class="turn-yourturn-share-actions">
        <button class="turn-yourturn-share-submit" type="button">SHARE YOUR TURN</button>
        <button class="turn-yourturn-share-back" type="button">BACK</button>
      </div>
    </article>`;
  document.body.appendChild(dialog);
  return dialog;
}

function wrapTrackCard(card) {
  if (card.parentElement?.classList.contains('turn-yourturn-track-slot')) {
    return card.parentElement;
  }
  const slot = document.createElement('div');
  slot.className = 'turn-yourturn-track-slot';
  card.replaceWith(slot);
  slot.appendChild(card);

  const share = document.createElement('button');
  share.type = 'button';
  share.className = 'turn-yourturn-track-share';
  share.dataset.trackId = card.dataset.trackId || '';
  share.innerHTML = SHARE_ICON;
  share.hidden = true;
  slot.appendChild(share);
  return slot;
}

function currentRaceIsVisible() {
  const hud = document.querySelector('#hud');
  return Boolean(hud && !hud.hidden && !document.body.classList.contains('turn-home-open'));
}

export async function installYourTurnShare({ home = document.querySelector('.m8-home') } = {}) {
  if (globalThis[INSTALL_FLAG]) return globalThis[INSTALL_FLAG];
  if (!home) throw new Error('TURN YOUR TURN sharing could not find Home.');

  await installStylesheet();
  const runtime = globalThis.__turnRuntime;
  const rail = home.querySelector('.m8-track-rail');
  if (!rail) throw new Error('TURN YOUR TURN sharing could not find the track rail.');

  for (const card of rail.querySelectorAll('.track-card')) wrapTrackCard(card);
  globalThis.__turnHomeCardScrollFixes?.syncIndicator?.();

  const dialog = createComposer();
  const details = dialog.querySelector('.turn-yourturn-share-details');
  const input = dialog.querySelector('input');
  const status = dialog.querySelector('.turn-yourturn-share-status');
  const submit = dialog.querySelector('.turn-yourturn-share-submit');
  const close = dialog.querySelector('.turn-yourturn-share-close');
  const back = dialog.querySelector('.turn-yourturn-share-back');
  const trackButtons = [...rail.querySelectorAll('.turn-yourturn-track-share')];
  const toast = document.querySelector('.lap-result-toast');
  let toastShare = null;
  let activeLap = null;
  let activeTrackId = '';
  let returnFocus = null;
  let pausedRace = false;
  let pausedAt = 0;
  let sharing = false;
  const knownBestTimes = new Map();

  for (const track of TRACK_CATALOG) {
    knownBestTimes.set(track.id, getStoredBestReplayLap(track.id)?.time ?? Infinity);
  }

  if (toast) {
    toastShare = document.createElement('button');
    toastShare.type = 'button';
    toastShare.className = 'lap-result-yourturn-share';
    toastShare.innerHTML = SHARE_ICON;
    toastShare.hidden = true;
    toastShare.setAttribute('aria-label', 'Share this new personal best as a YOUR TURN challenge');
    toast.appendChild(toastShare);
  }

  function syncTrackShareButtons() {
    for (const button of trackButtons) {
      const trackId = button.dataset.trackId || '';
      const card = button.parentElement?.querySelector('.track-card');
      const best = getStoredBestReplayLap(trackId);
      const unavailable = card?.disabled || card?.classList.contains('is-trophy-locked');
      button.hidden = !(card?.classList.contains('is-selected') && best && !unavailable);
      button.setAttribute(
        'aria-label',
        best
          ? `Share your best lap on ${formatTrackName(trackId)} as a YOUR TURN challenge`
          : `No shareable best lap on ${formatTrackName(trackId)}`
      );
    }
  }

  function setNameValidation(message = '') {
    status.textContent = message;
    if (message) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }

  function pauseForComposer() {
    pausedRace = currentRaceIsVisible();
    if (!pausedRace) return;
    pausedAt = performance.now();
    document.body.classList.add('turn-runtime-paused');
    globalThis.__turnAudio?.silence?.();
  }

  function resumeAfterComposer() {
    if (!pausedRace) return;
    const now = performance.now();
    const pausedFor = Math.max(0, now - pausedAt);
    const state = runtime?.state;
    if (state?.lapActive && Number.isFinite(state.lapStartedAt)) {
      state.lapStartedAt += pausedFor;
    }
    if (state) state.lastFrame = now;
    document.body.classList.remove('turn-runtime-paused');
    pausedRace = false;
    pausedAt = 0;
  }

  function openComposer(trackId, lap, trigger) {
    if (!lap || !Array.isArray(lap.frames) || lap.frames.length < 21) return false;
    activeTrackId = trackId;
    activeLap = lap;
    returnFocus = trigger || null;
    const track = getTrackDefinition(trackId);
    const car = getCarDefinition(lap.carId);
    details.innerHTML = `
      <strong>${escapeHtml(track?.name?.toUpperCase() || trackId.toUpperCase())}</strong>
      <span>${escapeHtml(car?.name || 'Car')} · ${formatChallengeTime(lap.time)}</span>`;
    const profile = loadSocialRacerProfile();
    input.value = profile.name || '';
    setNameValidation('');
    pauseForComposer();
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    if (input.value) submit.focus();
    else input.focus();
    return true;
  }

  function closeComposer({ restoreFocus = true } = {}) {
    if (typeof dialog.close === 'function' && dialog.open) dialog.close();
    else dialog.removeAttribute('open');
    resumeAfterComposer();
    if (restoreFocus) returnFocus?.focus?.();
    activeLap = null;
    activeTrackId = '';
    returnFocus = null;
  }

  async function shareActiveLap() {
    if (sharing || !activeLap || !activeTrackId) return;
    const racerName = normalizeChallengeName(input.value, '');
    if (!racerName) {
      setNameValidation('Write your name before sharing.');
      input.focus();
      return;
    }

    setNameValidation('');
    saveSocialRacerName(racerName);
    input.value = racerName;
    sharing = true;
    submit.disabled = true;
    try {
      const profile = loadSocialRacerProfile();
      const track = getTrackDefinition(activeTrackId);
      const challenge = challengeFromLap({
        challengerName: racerName,
        racerId: profile.id,
        trackId: activeTrackId,
        trackRevision: getTrackStorageRevision(activeTrackId),
        trackName: track?.name || activeTrackId,
        lap: activeLap
      });
      const encoded = await encodeChallenge(challenge);
      status.textContent = 'Preparing challenge link…';
      const prepared = await makeShareableChallengeUrl(encoded);
      const url = prepared.url;
      status.textContent = '';
      const shareData = {
        title: `${racerName} sends you YOUR TURN`,
        text: `${racerName} challenges you on ${track?.name || activeTrackId} with ${formatChallengeTime(activeLap.time)}. Your turn.`,
        url
      };

      if (navigator.share) {
        try {
          await navigator.share(shareData);
          closeComposer();
          return;
        } catch (error) {
          if (error?.name === 'AbortError') return;
        }
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        status.textContent = prepared.usedSnapshot
          ? 'Short challenge link copied.'
          : 'Challenge link copied.';
        return;
      }

      status.textContent = url;
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'The challenge could not be shared.';
    } finally {
      sharing = false;
      submit.disabled = false;
    }
  }

  for (const button of trackButtons) {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const trackId = button.dataset.trackId || '';
      openComposer(trackId, getStoredBestReplayLap(trackId), button);
    });
  }

  toastShare?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const trackId = toastShare.dataset.trackId || runtime?.state?.trackId || 'countryside';
    openComposer(trackId, getStoredBestReplayLap(trackId), toastShare);
  });

  submit.addEventListener('click', () => void shareActiveLap());
  close.addEventListener('click', () => closeComposer());
  back.addEventListener('click', () => closeComposer());
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeComposer();
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) closeComposer();
  });
  input.addEventListener('input', () => {
    if (normalizeChallengeName(input.value, '')) setNameValidation('');
  });

  const selectionObserver = typeof MutationObserver === 'function'
    ? new MutationObserver(syncTrackShareButtons)
    : null;
  for (const card of rail.querySelectorAll('.track-card')) {
    selectionObserver?.observe(card, { attributes: true, attributeFilter: ['class', 'aria-pressed', 'disabled'] });
  }

  window.addEventListener('turn:rivals-reset', () => {
    for (const track of TRACK_CATALOG) {
      knownBestTimes.set(track.id, getStoredBestReplayLap(track.id)?.time ?? Infinity);
    }
    syncTrackShareButtons();
  });

  window.addEventListener('turn:lap-invalid', () => {
    if (toastShare) toastShare.hidden = true;
    toast?.classList.remove('has-yourturn-share');
  });

  window.addEventListener('turn:lap-result', (event) => {
    const trackId = runtime?.state?.trackId || 'countryside';
    const time = Number(event.detail?.time);
    const previousBest = knownBestTimes.get(trackId) ?? Infinity;
    const currentBest = getStoredBestReplayLap(trackId);
    const isNewBest = Number.isFinite(time)
      && time < previousBest - PB_EPSILON
      && currentBest
      && Math.abs(currentBest.time - time) <= 0.002;
    knownBestTimes.set(trackId, currentBest?.time ?? previousBest);
    syncTrackShareButtons();

    if (!toastShare) return;
    toastShare.dataset.trackId = trackId;
    toastShare.hidden = !isNewBest;
    toast?.classList.toggle('has-yourturn-share', Boolean(isNewBest));
  });

  window.addEventListener('turn:ui-state-change', (event) => {
    if (!event.detail?.running || event.detail?.reason === 'race-reset') {
      if (toastShare) toastShare.hidden = true;
      toast?.classList.remove('has-yourturn-share');
    }
  });

  syncTrackShareButtons();

  const api = Object.freeze({
    dialog,
    openForTrack(trackId, trigger = null) {
      return openComposer(trackId, getStoredBestReplayLap(trackId), trigger);
    },
    sync: syncTrackShareButtons
  });
  globalThis[INSTALL_FLAG] = api;
  globalThis.__turnYourTurnShare = api;
  document.documentElement.dataset.turnYourTurnShare = 'r2';
  return api;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
