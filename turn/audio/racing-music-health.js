const HEALTH_CHECK_INTERVAL_MS = 1000;
const RECOVERY_GRACE_MS = 900;
const STOP_SETTLE_TIMEOUT_MS = 600;
const STOP_SETTLE_POLL_MS = 20;
const INSTALL_RETRY_MS = 250;
const INSTALL_RETRY_LIMIT = 40;

let installed = null;

export function installRacingMusicHealth(music = globalThis.__turnRacingMusic) {
  if (installed) return installed;
  if (!music) return null;

  let checkTimer = 0;
  let unhealthySince = 0;
  let recovering = false;
  let hasPlayed = music.state === 'running' && music.playing;
  let recoveryCount = 0;

  function shouldRun() {
    return music.enabled
      && document.visibilityState !== 'hidden'
      && globalThis.__turnAudioPreferences?.getSettings?.().audioEnabled !== false;
  }

  function schedule(delay = HEALTH_CHECK_INTERVAL_MS) {
    globalThis.clearTimeout(checkTimer);
    checkTimer = globalThis.setTimeout(check, delay);
  }

  function check() {
    checkTimer = 0;
    const healthy = music.state === 'running' && music.playing;
    if (healthy) {
      hasPlayed = true;
      unhealthySince = 0;
      schedule();
      return;
    }

    if (!hasPlayed || !shouldRun()) {
      unhealthySince = 0;
      schedule();
      return;
    }

    const now = performance.now();
    if (!unhealthySince) unhealthySince = now;
    if (!recovering && now - unhealthySince >= RECOVERY_GRACE_MS) {
      void recover();
      return;
    }
    schedule(Math.min(HEALTH_CHECK_INTERVAL_MS, RECOVERY_GRACE_MS));
  }

  async function recover() {
    if (recovering || !shouldRun()) {
      schedule();
      return false;
    }

    recovering = true;
    const restoreVolume = music.volume;
    try {
      // v3 deliberately stops every scheduled source synchronously when volume
      // reaches zero. Its public stop also begins an async context suspend, so
      // wait for that lifecycle to settle before restoring volume; otherwise an
      // old suspend can land after the new scheduler has already started.
      music.stop();
      await waitForStoppedPlayback(music);
      if (restoreVolume > 0 && document.visibilityState !== 'hidden'
        && globalThis.__turnAudioPreferences?.getSettings?.().audioEnabled !== false) {
        music.setVolume(restoreVolume, { restart: true });
        recoveryCount += 1;
      }
    } finally {
      recovering = false;
      unhealthySince = 0;
      schedule(HEALTH_CHECK_INTERVAL_MS);
    }
    return true;
  }

  function checkSoon() {
    if (!hasPlayed && music.state === 'running' && music.playing) hasPlayed = true;
    schedule(120);
  }

  document.addEventListener('visibilitychange', checkSoon, { passive: true });
  document.addEventListener('pointerdown', checkSoon, { capture: true, passive: true });
  document.addEventListener('keydown', checkSoon, { capture: true });
  globalThis.addEventListener('pageshow', checkSoon, { passive: true });
  globalThis.addEventListener('pagehide', () => {
    unhealthySince = 0;
    globalThis.clearTimeout(checkTimer);
    checkTimer = 0;
  }, { passive: true });

  schedule();
  installed = Object.freeze({
    id: 'r164-long-session-music-health',
    check: checkSoon,
    get recoveryCount() {
      return recoveryCount;
    }
  });
  globalThis.__turnRacingMusicHealth = installed;
  return installed;
}

async function waitForStoppedPlayback(music) {
  const deadline = performance.now() + STOP_SETTLE_TIMEOUT_MS;
  while (performance.now() < deadline) {
    if (!music.playing && music.state !== 'running') return true;
    await delay(STOP_SETTLE_POLL_MS);
  }
  return !music.playing;
}

function delay(milliseconds) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds));
}

function installWhenHomeReady() {
  let attempts = 0;
  const tryInstall = () => {
    if (installRacingMusicHealth()) return;
    attempts += 1;
    if (attempts < INSTALL_RETRY_LIMIT) globalThis.setTimeout(tryInstall, INSTALL_RETRY_MS);
  };
  tryInstall();
}

if (globalThis.__turnRacingMusic) {
  installWhenHomeReady();
} else {
  document.addEventListener('turn:home-ready', installWhenHomeReady, { once: true });
}
