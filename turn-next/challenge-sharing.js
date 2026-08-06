import { getTrackDefinition } from '/turn/tracks/catalog.js?build=20260805-r160';
import { getTrackStorageRevision } from '/turn/tracks/definitions.js?build=20260805-r160';
import { getCarDefinition } from '/turn/vehicle/catalog.js?build=20260805-r160';
import {
  challengeFromLap,
  encodeChallenge,
  formatChallengeTime,
  makeBuiltInChallengeUrl,
  makeChallengeUrl
} from '/turn-next/challenge-codec.js?revision=r182-race-my-ghost';
import { escapeHtml } from '/turn-next/challenge-ui.js?revision=r182-race-my-ghost';

const BASE_URL = 'https://enkel.design/turn-next/';
const PERSONAL_RIVAL_KEY = 'turn-personal-rivals-v1';

export function installChallengeSharing({ runtime, ui, isChallengeActive }) {
  installLapSharing(runtime, ui, isChallengeActive);
  installTrackBestSharing(ui);
}

export async function shareGiveUpReply({
  ui,
  builtInId,
  encoded,
  challenge,
  responder
}) {
  const url = builtInId
    ? makeBuiltInChallengeUrl(builtInId, {
      baseUrl: BASE_URL,
      reply: 'give-up',
      responder
    })
    : makeChallengeUrl(encoded, {
      baseUrl: BASE_URL,
      reply: 'give-up',
      responder
    });
  return shareUrl(ui, {
    title: `${responder} gave up on a TURN challenge`,
    text: `${responder} gave up. ${challenge.challengerName}’s ${formatChallengeTime(challenge.time)} ghost held the lead.`,
    url,
    success: 'Give-up reply ready to send.'
  });
}

export async function shareWinningReply({ ui, challenge, winningLap, responder }) {
  const replyChallenge = challengeFromLap({
    challengerName: responder,
    trackId: challenge.trackId,
    trackRevision: getTrackStorageRevision(challenge.trackId),
    trackName: getTrackDefinition(challenge.trackId).name,
    lap: winningLap,
    replyTo: {
      kind: 'win',
      opponent: challenge.challengerName,
      previousTime: challenge.time
    }
  });
  const encoded = await encodeChallenge(replyChallenge);
  const url = makeChallengeUrl(encoded, { baseUrl: BASE_URL });
  return shareUrl(ui, {
    title: `${responder} beat your TURN ghost`,
    text: `${responder} beat ${challenge.challengerName} with ${formatChallengeTime(winningLap.time)}. Race the reply ghost.`,
    url,
    success: 'Winning reply ready to send.'
  });
}

function installLapSharing(runtime, ui, isChallengeActive) {
  let lastShareableLap = null;
  window.addEventListener('turn:lap-result', (event) => {
    if (isChallengeActive()) return;
    const time = Number(event.detail?.time);
    const recording = runtime.state.recording;
    if (!Number.isFinite(time) || !Array.isArray(recording) || recording.length < 21) return;
    lastShareableLap = {
      trackId: runtime.state.trackId || globalThis.__turnGetTrackId?.() || 'countryside',
      lap: {
        time,
        carId: runtime.state.vehicleId,
        carColor: runtime.state.vehicleColor,
        carSecondaryColor: runtime.state.vehicleSecondaryColor,
        frames: recording.map((frame) => ({ ...frame }))
      }
    };
    requestAnimationFrame(() => installLapToastButton(ui, () => lastShareableLap));
  });
}

function installLapToastButton(ui, getShareable) {
  const toast = document.querySelector('.lap-result-toast');
  if (!toast || toast.querySelector('[data-share-lap-challenge]')) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.shareLapChallenge = '';
  button.textContent = 'CHALLENGE A FRIEND';
  button.addEventListener('click', () => {
    const shareable = getShareable();
    if (shareable) openShareDialog(ui, shareable.trackId, shareable.lap);
  });
  toast.appendChild(button);
}

function installTrackBestSharing(ui) {
  const installOnHome = () => {
    const home = document.querySelector('.m8-home');
    const continueButton = home?.querySelector('.m8-track-continue');
    if (!home || !continueButton) return false;

    let button = home.querySelector('[data-share-track-best]');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.dataset.shareTrackBest = '';
      button.className = 'turn-challenge-share-best';
      button.textContent = 'SHARE BEST';
      button.hidden = true;
      continueButton.insertAdjacentElement('afterend', button);
      button.addEventListener('click', () => {
        const trackId = selectedHomeTrackId(home);
        const lap = readStoredBestLap(trackId);
        if (lap) openShareDialog(ui, trackId, lap);
      });
    }

    const sync = () => {
      const trackId = selectedHomeTrackId(home);
      button.hidden = !readStoredBestLap(trackId);
    };
    home.addEventListener('click', () => requestAnimationFrame(sync));
    window.addEventListener('turn:rivals-reset', sync);
    window.addEventListener('turn:ui-state-change', sync);
    sync();
    return true;
  };

  if (installOnHome()) return;
  const observer = new MutationObserver(() => {
    if (installOnHome()) observer.disconnect();
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

function selectedHomeTrackId(home) {
  return home.querySelector('.track-card[aria-pressed="true"]')?.dataset.trackId
    || home.querySelector('.track-card:not([disabled])')?.dataset.trackId
    || 'countryside';
}

function readStoredBestLap(trackId) {
  try {
    const revision = getTrackStorageRevision(trackId);
    const key = revision === 'countryside'
      ? PERSONAL_RIVAL_KEY
      : `${PERSONAL_RIVAL_KEY}:${revision}`;
    const saved = JSON.parse(localStorage.getItem(key));
    return Array.isArray(saved?.laps)
      ? saved.laps
        .filter((lap) => Number.isFinite(Number(lap?.time))
          && Array.isArray(lap?.frames)
          && lap.frames.length > 20)
        .sort((a, b) => a.time - b.time)[0] || null
      : null;
  } catch (_) {
    return null;
  }
}

function openShareDialog(ui, trackId, lap) {
  const track = getTrackDefinition(trackId);
  const car = getCarDefinition(lap.carId);
  ui.showModal({
    title: 'CHALLENGE A FRIEND',
    details: `
      <strong>${escapeHtml(track.name.toUpperCase())}</strong>
      <span>${escapeHtml(car.name)} · ${formatChallengeTime(Number(lap.time))}</span>`,
    copy: 'Share this lap as a playable ghost challenge.',
    requestName: true,
    actions: [
      {
        label: 'SHARE CHALLENGE',
        primary: true,
        action: () => void shareLapChallenge(ui, trackId, lap)
      },
      { label: 'CLOSE', action: ui.closeModal }
    ]
  });
}

async function shareLapChallenge(ui, trackId, lap) {
  const responder = ui.playerName();
  const track = getTrackDefinition(trackId);
  const challenge = challengeFromLap({
    challengerName: responder,
    trackId,
    trackRevision: getTrackStorageRevision(trackId),
    trackName: track.name,
    lap
  });
  const encoded = await encodeChallenge(challenge);
  const url = makeChallengeUrl(encoded, { baseUrl: BASE_URL });
  return shareUrl(ui, {
    title: `${responder} challenges you in TURN`,
    text: `${responder} ran ${formatChallengeTime(challenge.time)} on ${track.name}. Beat the ghost.`,
    url,
    success: 'Challenge link ready to send.'
  });
}

async function shareUrl(ui, { title, text, url, success }) {
  try {
    if (navigator.share) {
      await navigator.share({ title, text, url });
      ui.setDialogStatus(success);
      return true;
    }
    await navigator.clipboard.writeText(url);
    ui.setDialogStatus('Challenge link copied.');
    return true;
  } catch (error) {
    if (error?.name === 'AbortError') return false;
    try {
      await navigator.clipboard.writeText(url);
      ui.setDialogStatus('Challenge link copied.');
      return true;
    } catch (_) {
      ui.setDialogStatus(url);
      return false;
    }
  }
}
