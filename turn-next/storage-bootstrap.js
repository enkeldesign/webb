(() => {
  const DEPLOYMENT_ID = 'next';
  const LOCAL_PREFIX = 'turn-next:';
  const SESSION_PREFIX = 'turn-next-session:';
  const PATCH_MARKER = Symbol.for('turn.next.storage.patch');

  function renderIsolationFailure(error) {
    console.error('TURN NEXT: save-data isolation failed.', error);
    globalThis.__TURN_NEXT_STORAGE_READY__ = false;

    const showMessage = () => {
      if (!document.body) return;
      document.body.innerHTML = `
        <main style="min-height:100vh;display:grid;place-items:center;padding:24px;background:#111;color:#fff;font:600 18px/1.5 system-ui,sans-serif">
          <section role="alert" style="max-width:42rem;border:4px solid #ff5b5b;border-radius:20px;padding:24px;background:#241111">
            <h1 style="margin:0 0 12px;font-size:1.5rem">TURN NEXT did not start</h1>
            <p style="margin:0">Its separate test storage could not be established, so the runtime was stopped before it could touch production TURN records.</p>
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
      throw new Error('TURN NEXT storage bootstrap was installed more than once.');
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
      label: 'TURN NEXT',
      production: false,
      storageNamespace: LOCAL_PREFIX,
      sessionStorageNamespace: SESSION_PREFIX
    });
    globalThis.__TURN_NEXT_STORAGE_READY__ = true;

    console.info('TURN NEXT: isolated save-data namespace enabled.');
  } catch (error) {
    renderIsolationFailure(error);
  }
})();
