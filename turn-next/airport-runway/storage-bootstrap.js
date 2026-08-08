(() => {
  const DEPLOYMENT_ID = 'next-airport-runway';
  const LOCAL_PREFIX = 'turn-next-runway:';
  const SESSION_PREFIX = 'turn-next-runway-session:';
  const PATCH_MARKER = Symbol.for('turn.next.airport.runway.storage.patch');

  function renderIsolationFailure(error) {
    console.error('TURN NEXT AIRPORT: RUNWAY: save-data isolation failed.', error);
    globalThis.__TURN_NEXT_STORAGE_READY__ = false;

    const showMessage = () => {
      if (!document.body) return;
      document.body.innerHTML = `
        <main style="min-height:100vh;display:grid;place-items:center;padding:24px;background:#111;color:#fff;font:600 18px/1.5 system-ui,sans-serif">
          <section role="alert" style="max-width:42rem;border:4px solid #ff5f67;border-radius:20px;padding:24px;background:#241111">
            <h1 style="margin:0 0 12px;font-size:1.5rem">AIRPORT: RUNWAY did not start</h1>
            <p style="margin:0">Its separate TURN NEXT test storage could not be established, so the prototype stopped before it could touch other TURN records.</p>
          </section>
        </main>`;
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', showMessage, { once: true });
    } else {
      showMessage();
    }
  }

  try {
    const localStorageRef = window.localStorage;
    const sessionStorageRef = window.sessionStorage;
    const proto = Storage.prototype;

    if (proto[PATCH_MARKER]) {
      throw new Error('AIRPORT: RUNWAY storage bootstrap was installed more than once.');
    }

    const native = Object.freeze({
      getItem: proto.getItem,
      setItem: proto.setItem,
      removeItem: proto.removeItem,
      clear: proto.clear,
      key: proto.key
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
      id: DEPLOYMENT_ID,
      label: 'TURN NEXT · AIRPORT: RUNWAY',
      production: false,
      storageNamespace: LOCAL_PREFIX,
      sessionStorageNamespace: SESSION_PREFIX
    });
    globalThis.__TURN_NEXT_STORAGE_READY__ = true;

    // The isolated prototype is for Airport testing, so select Airport on a genuinely
    // fresh namespace without overwriting the tester's later choice.
    if (localStorageRef.getItem('turn-selected-track-v1') === null) {
      localStorageRef.setItem('turn-selected-track-v1', 'airport');
    }

    console.info('TURN NEXT AIRPORT: RUNWAY: isolated test storage enabled.');
  } catch (error) {
    renderIsolationFailure(error);
  }
})();
