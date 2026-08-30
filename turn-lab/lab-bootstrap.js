(() => {
  globalThis.__TURN_LAB__ = true;

  const localStorageRef = window.localStorage;
  const sessionStorageRef = window.sessionStorage;
  const storageProto = Storage.prototype;
  const nativeStorage = {
    getItem: storageProto.getItem,
    setItem: storageProto.setItem,
    removeItem: storageProto.removeItem,
    clear: storageProto.clear,
    key: storageProto.key
  };
  const LOCAL_PREFIX = 'turn-lab:';
  const SESSION_PREFIX = 'turn-lab-session:';

  function prefixFor(storage) {
    if (storage === localStorageRef) return LOCAL_PREFIX;
    if (storage === sessionStorageRef) return SESSION_PREFIX;
    return '';
  }

  storageProto.getItem = function getItem(key) {
    const prefix = prefixFor(this);
    return nativeStorage.getItem.call(this, prefix ? prefix + String(key) : key);
  };
  storageProto.setItem = function setItem(key, value) {
    const prefix = prefixFor(this);
    return nativeStorage.setItem.call(this, prefix ? prefix + String(key) : key, value);
  };
  storageProto.removeItem = function removeItem(key) {
    const prefix = prefixFor(this);
    return nativeStorage.removeItem.call(this, prefix ? prefix + String(key) : key);
  };
  storageProto.clear = function clear() {
    const prefix = prefixFor(this);
    if (!prefix) return nativeStorage.clear.call(this);
    const keys = [];
    for (let index = 0; index < this.length; index += 1) {
      const key = nativeStorage.key.call(this, index);
      if (key?.startsWith(prefix)) keys.push(key);
    }
    for (const key of keys) nativeStorage.removeItem.call(this, key);
  };
  storageProto.key = function key(index) {
    const prefix = prefixFor(this);
    if (!prefix) return nativeStorage.key.call(this, index);
    const keys = [];
    for (let cursor = 0; cursor < this.length; cursor += 1) {
      const candidate = nativeStorage.key.call(this, cursor);
      if (candidate?.startsWith(prefix)) keys.push(candidate.slice(prefix.length));
    }
    return keys[index] ?? null;
  };

  // MOUNTAIN is the subject of this LAB build, so a fresh isolated LAB profile
  // must not inherit production's 700-trophy gate. Seed only that reward in the
  // prefixed LAB achievement record; production TURN storage is never read or
  // written, and every other Trophy Road reward keeps its production behavior.
  const ACHIEVEMENT_KEY = `${LOCAL_PREFIX}turn-achievements-v1`;
  const MOUNTAIN_REWARD_ID = 'mountain';
  const TROPHY_ROAD_STORAGE_VERSION = 6;

  function ensureMountainLabAccess() {
    let stored = null;
    try {
      const raw = nativeStorage.getItem.call(localStorageRef, ACHIEVEMENT_KEY);
      stored = raw ? JSON.parse(raw) : null;
    } catch (_) {}

    const state = stored && typeof stored === 'object' ? stored : {};
    const rewards = state.rewards && typeof state.rewards === 'object' ? state.rewards : {};
    const unlocked = Array.isArray(rewards.unlocked)
      ? rewards.unlocked.filter((id) => typeof id === 'string')
      : [];
    const seenRewards = Array.isArray(rewards.seen)
      ? rewards.seen.filter((id) => typeof id === 'string')
      : [];
    if (
      Number(state.version) >= TROPHY_ROAD_STORAGE_VERSION
      && unlocked.includes(MOUNTAIN_REWARD_ID)
      && seenRewards.includes(MOUNTAIN_REWARD_ID)
    ) {
      return true;
    }
    if (!unlocked.includes(MOUNTAIN_REWARD_ID)) unlocked.push(MOUNTAIN_REWARD_ID);
    if (!seenRewards.includes(MOUNTAIN_REWARD_ID)) seenRewards.push(MOUNTAIN_REWARD_ID);

    const next = {
      ...state,
      version: Math.max(TROPHY_ROAD_STORAGE_VERSION, Number(state.version) || 0),
      unlocked: state.unlocked && typeof state.unlocked === 'object' ? state.unlocked : {},
      seen: Array.isArray(state.seen) ? state.seen : [],
      progress: state.progress && typeof state.progress === 'object'
        ? state.progress
        : { tracks: [], blankTracks: [] },
      rewards: {
        ...rewards,
        unlocked,
        seen: seenRewards
      }
    };

    try {
      nativeStorage.setItem.call(localStorageRef, ACHIEVEMENT_KEY, JSON.stringify(next));
      return true;
    } catch (_) {
      return false;
    }
  }

  const mountainAccessReady = ensureMountainLabAccess();

  const isStandalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: fullscreen)').matches ||
    navigator.standalone === true;

  document.documentElement.classList.toggle('turn-standalone', isStandalone);
  document.documentElement.classList.toggle('turn-browser', !isStandalone);
  document.documentElement.dataset.turnLab = 'mountain-long-course';
  document.documentElement.dataset.turnLabMountainAccess = mountainAccessReady ? 'unlocked' : 'storage-blocked';

  let releaseBrowserLaunch = null;
  let browserReleased = false;
  globalThis.__turnLaunchReady = isStandalone
    ? Promise.resolve({ mode: 'standalone', lab: true })
    : new Promise((resolve) => {
      releaseBrowserLaunch = () => {
        if (browserReleased) return;
        browserReleased = true;
        document.documentElement.classList.add('turn-browser-launched');
        resolve({ mode: 'browser', lab: true });
      };
    });

  function installGate() {
    const gate = document.querySelector('#installGate');
    const installButton = document.querySelector('#installTurnButton');
    const browserButton = document.querySelector('#playBrowserButton');
    const guide = document.querySelector('#installGuide');
    const guideClose = document.querySelector('#installGuideClose');
    const guideSteps = document.querySelector('#installSteps');

    if (!gate || !installButton || !browserButton || !guide || !guideClose || !guideSteps) return;

    if (isStandalone) {
      gate.hidden = true;
      return;
    }

    gate.hidden = false;
    installButton.addEventListener('click', () => {
      guideSteps.innerHTML = `
        <div class="install-step"><div class="install-step-number" aria-hidden="true">1</div><div><strong>Open Safari’s Share menu</strong><span>Use the Share button while TURN LAB is open.</span></div></div>
        <div class="install-step"><div class="install-step-number" aria-hidden="true">2</div><div><strong>Choose Add to Home Screen</strong><span>Keep the separate TURN LAB name so production TURN remains untouched.</span></div></div>
        <div class="install-step"><div class="install-step-number" aria-hidden="true">3</div><div><strong>Launch TURN LAB from its icon</strong><span>LAB keeps its own saves and layers the long MOUNTAIN course over the production TURN engine.</span></div></div>`;
      guide.hidden = false;
    });
    browserButton.addEventListener('click', () => {
      gate.hidden = true;
      releaseBrowserLaunch?.();
    });
    guideClose.addEventListener('click', () => { guide.hidden = true; });
    guide.addEventListener('click', (event) => {
      if (event.target === guide) guide.hidden = true;
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installGate, { once: true });
  } else {
    installGate();
  }
})();
