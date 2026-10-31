// Runs before any settings or game modules capture storage. Production only checks
// the host; it never reads the parameter or session state. No save is rewritten.
(() => {
  const host = location.hostname.toLowerCase();
  const allowed = host.endsWith('.turntest.pages.dev')
    || host === 'localhost' || host.endsWith('.localhost')
    || host === '127.0.0.1' || host === '[::1]' || location.protocol === 'file:';
  if (!allowed) return;
  const key = 'turn-session-admin-v1';
  const url = new URL(location.href);
  const requested = url.searchParams.get('turn-admin');
  let session;
  let saved;
  try {
    session = globalThis.sessionStorage;
    if (requested === '0') { session.removeItem(key); return; }
    saved = JSON.parse(session.getItem(key) || 'null');
  } catch (_) { /* Storage blocked: the overlay still lasts for this visit. */ }
  if (requested !== '1' && saved?.version !== 1) return;

  const copy = (storage) => {
    const entries = [];
    try {
      for (let i = 0; i < storage.length; i += 1) {
        const name = storage.key(i);
        if (name !== key) entries.push([name, storage.getItem(name)]);
      }
    } catch (_) { /* A fresh memory profile when website storage is blocked. */ }
    return entries;
  };
  let realStorage;
  try { realStorage = globalThis.localStorage; } catch (_) {}
  const state = saved?.version === 1 ? saved : {
    version: 1, local: copy(realStorage), session: copy(session),
    tracks: false, cars: false, rewards: false, trophyOffset: 0
  };
  let ended = false;
  const persist = () => {
    if (ended) return;
    try { session?.setItem(key, JSON.stringify(state)); } catch (_) { /* Runtime only. */ }
  };
  const overlay = (name) => {
    const items = new Map(state[name]);
    const changed = () => { state[name] = [...items]; persist(); };
    return Object.freeze({
      get length() { return items.size; },
      key: (index) => [...items.keys()][index] ?? null,
      getItem: (item) => items.get(String(item)) ?? null,
      setItem(item, value) { items.set(String(item), String(value)); changed(); },
      removeItem(item) { items.delete(String(item)); changed(); },
      clear() { items.clear(); changed(); }
    });
  };
  // Keep these adapters installed until navigation completes, including unload
  // handlers and delayed race writes. Never swap the real save back into a live game.
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: overlay('local') });
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: overlay('session') });
  globalThis.__turnSessionAdmin = Object.freeze({
    get options() { return { tracks: state.tracks, cars: state.cars, rewards: state.rewards }; },
    exposes(type) {
      if (!type) return false;
      return type === 'track' ? state.tracks
        : type === 'vehicle' || type === 'vehicle-pack' ? state.cars : state.rewards;
    },
    configure(options) {
      for (const option of ['tracks', 'cars', 'rewards']) state[option] = options[option] === true;
      persist();
    },
    trophyTotal(earned) { return Math.max(0, earned + state.trophyOffset); },
    setTrophyTotal(total, earned) {
      if (!Number.isSafeInteger(total) || total < 0) return false;
      state.trophyOffset = total - earned;
      persist();
      return true;
    },
    reset() {
      ended = true;
      try { session?.removeItem(key); } catch (_) {}
      url.searchParams.set('turn-admin', '1');
      location.replace(url.href);
    },
    leave() {
      ended = true;
      try { session?.removeItem(key); } catch (_) {}
      url.searchParams.delete('turn-admin');
      history.replaceState(history.state, '', url.href);
      location.reload();
    }
  });
  persist();
  // The address keeps the parameter for as long as the session lasts, so reopening
  // it or handing it to another browser still starts in admin. Only the tab's
  // session copy carries the settings; elsewhere a fresh session begins.
  if (requested !== '1') {
    url.searchParams.set('turn-admin', '1');
    history.replaceState(history.state, '', url.href);
  }
  document.documentElement.dataset.turnAdmin = 'session';
})();
