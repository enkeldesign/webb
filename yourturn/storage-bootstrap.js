(() => {
  const LOCAL_PREFIX = 'yourturn:';
  const SESSION_PREFIX = 'yourturn-session:';
  const PATCH_MARKER = Symbol.for('yourturn.storage.patch');
  const SHARED_RACER_ID_KEY = 'turn-social-racer-id-v1';
  const SHARED_RACER_NAME_KEY = 'turn-social-racer-name-v1';
  const LEGACY_RACER_ID_KEY = `${LOCAL_PREFIX}yourturn-racer-id-v1`;
  const LEGACY_RACER_NAME_KEY = `${LOCAL_PREFIX}yourturn-player-name-v1`;

  function fail(error) {
    console.error('YOUR TURN: isolated storage could not be established.', error);
    globalThis.__YOUR_TURN_STORAGE_READY__ = false;
    const render = () => {
      if (!document.body) return;
      document.body.innerHTML = `
        <main style="min-height:100vh;display:grid;place-items:center;padding:24px;background:#08090a;color:#fff8e8;font:700 18px/1.45 system-ui,sans-serif">
          <section role="alert" style="max-width:42rem;border:4px solid #ff7f50;border-radius:20px;padding:24px;background:#241611">
            <h1 style="margin:0 0 12px;font-size:1.5rem">YOUR TURN could not start</h1>
            <p style="margin:0">This browser would not allow a separate challenge save area. The race was stopped before it could touch your TURN records.</p>
          </section>
        </main>`;
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render, { once: true });
    else render();
  }

  try {
    const localStorageRef = window.localStorage;
    const sessionStorageRef = window.sessionStorage;
    const proto = Storage.prototype;
    if (proto[PATCH_MARKER]) throw new Error('YOUR TURN storage bootstrap was installed more than once.');

    const native = Object.freeze({
      getItem: proto.getItem,
      setItem: proto.setItem,
      removeItem: proto.removeItem,
      clear: proto.clear,
      key: proto.key
    });

    // Migrate the earlier YOUR TURN-only identity into the shared social profile,
    // then mirror the shared racer ID back into the old namespaced key so the
    // existing session code starts with the same identity before any UI is shown.
    const sharedRacerId = native.getItem.call(localStorageRef, SHARED_RACER_ID_KEY);
    const legacyRacerId = native.getItem.call(localStorageRef, LEGACY_RACER_ID_KEY);
    if (!sharedRacerId && legacyRacerId) {
      native.setItem.call(localStorageRef, SHARED_RACER_ID_KEY, legacyRacerId);
    } else if (sharedRacerId && sharedRacerId !== legacyRacerId) {
      native.setItem.call(localStorageRef, LEGACY_RACER_ID_KEY, sharedRacerId);
    }

    const sharedRacerName = native.getItem.call(localStorageRef, SHARED_RACER_NAME_KEY);
    const legacyRacerName = native.getItem.call(localStorageRef, LEGACY_RACER_NAME_KEY);
    if (!sharedRacerName && legacyRacerName) {
      native.setItem.call(localStorageRef, SHARED_RACER_NAME_KEY, legacyRacerName);
    }

    // YOUR TURN isolates gameplay records, but the lightweight social racer
    // profile intentionally belongs to TURN as a whole. Expose a tiny raw local
    // storage bridge before patching Storage so /turn and /yourturn can share
    // that convenience identity when they happen to run in the same browser
    // storage context. Cross-browser/webview identity still relies on explicit
    // player confirmation in the challenge UI.
    globalThis.__TURN_SHARED_LOCAL_STORAGE__ = Object.freeze({
      getItem(key) {
        return native.getItem.call(localStorageRef, String(key));
      },
      setItem(key, value) {
        return native.setItem.call(localStorageRef, String(key), String(value));
      },
      removeItem(key) {
        return native.removeItem.call(localStorageRef, String(key));
      }
    });

    function prefixFor(storage) {
      if (storage === localStorageRef) return LOCAL_PREFIX;
      if (storage === sessionStorageRef) return SESSION_PREFIX;
      return '';
    }

    function scopedKeys(storage, prefix) {
      const keys = [];
      for (let index = 0; index < storage.length; index += 1) {
        const key = native.key.call(storage, index);
        if (key?.startsWith(prefix)) keys.push(key);
      }
      return keys;
    }

    proto.getItem = function getItem(key) {
      const prefix = prefixFor(this);
      return native.getItem.call(this, prefix ? prefix + String(key) : key);
    };
    proto.setItem = function setItem(key, value) {
      const prefix = prefixFor(this);
      return native.setItem.call(this, prefix ? prefix + String(key) : key, value);
    };
    proto.removeItem = function removeItem(key) {
      const prefix = prefixFor(this);
      return native.removeItem.call(this, prefix ? prefix + String(key) : key);
    };
    proto.clear = function clear() {
      const prefix = prefixFor(this);
      if (!prefix) return native.clear.call(this);
      for (const key of scopedKeys(this, prefix)) native.removeItem.call(this, key);
    };
    proto.key = function key(index) {
      const prefix = prefixFor(this);
      if (!prefix) return native.key.call(this, index);
      return scopedKeys(this, prefix)[index]?.slice(prefix.length) ?? null;
    };

    Object.defineProperty(proto, PATCH_MARKER, {
      value: true,
      configurable: false,
      enumerable: false,
      writable: false
    });

    globalThis.__TURN_DEPLOYMENT__ = Object.freeze({
      id: 'yourturn',
      label: 'YOUR TURN',
      production: false,
      storageNamespace: LOCAL_PREFIX,
      sessionStorageNamespace: SESSION_PREFIX
    });
    globalThis.__YOUR_TURN_STORAGE_READY__ = true;
  } catch (error) {
    fail(error);
  }
})();
