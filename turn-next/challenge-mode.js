import { createChallengeSession, readChallengeRequest } from '/turn-next/challenge-session.js?revision=r182-race-my-ghost';
import { installChallengeSharing } from '/turn-next/challenge-sharing.js?revision=r182-race-my-ghost';
import { createChallengeUi } from '/turn-next/challenge-ui.js?revision=r182-race-my-ghost';

installChallengeStyles();
const request = readChallengeRequest();
if (request.hasChallenge) globalThis.__turnStartBrowserGame?.();

void install();

async function install() {
  const { runtime, raceSession } = await waitForRuntime();
  const ui = createChallengeUi();
  const challengeSession = createChallengeSession({ runtime, raceSession, ui, request });
  globalThis.__turnNextChallengeSession = challengeSession;

  installChallengeSharing({
    runtime,
    ui,
    isChallengeActive: challengeSession.isActive
  });

  if (!request.hasChallenge) return;
  try {
    await challengeSession.launch();
  } catch (error) {
    console.error('TURN NEXT: challenge could not open.', error);
    showFatalChallenge(ui, error instanceof Error ? error.message : 'This challenge could not be opened.');
  }
}

function installChallengeStyles() {
  if (document.querySelector('link[data-turn-next-challenge-style]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/turn-next/challenge-mode.css?revision=r182-race-my-ghost';
  link.dataset.turnNextChallengeStyle = '';
  document.head.appendChild(link);
}

function waitForRuntime() {
  if (globalThis.__turnRuntime && globalThis.__turnNextRaceSession) {
    return Promise.resolve({ runtime: globalThis.__turnRuntime, raceSession: globalThis.__turnNextRaceSession });
  }

  return new Promise((resolve) => {
    const check = () => {
      if (!globalThis.__turnRuntime || !globalThis.__turnNextRaceSession) return false;
      resolve({ runtime: globalThis.__turnRuntime, raceSession: globalThis.__turnNextRaceSession });
      return true;
    };
    if (check()) return;
    window.addEventListener('turn:runtime-ready', () => {
      if (!check()) requestAnimationFrame(check);
    }, { once: true });
  });
}

function showFatalChallenge(ui, message) {
  document.querySelector('#installGate')?.setAttribute('hidden', '');
  ui.showModal({
    title: 'CHALLENGE UNAVAILABLE',
    details: '<strong>RACE MY GHOST</strong>',
    copy: safeText(message),
    actions: [{
      label: 'RETURN TO TURN NEXT',
      primary: true,
      action: () => { globalThis.location.href = '/turn-next/'; }
    }]
  });
}

function safeText(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
