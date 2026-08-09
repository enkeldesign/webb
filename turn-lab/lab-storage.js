(() => {
  globalThis.__TURN_LAB__ = true;

  const localStorageRef = window.localStorage;
  const sessionStorageRef = window.sessionStorage;
  const proto = Storage.prototype;
  const native = {
    getItem: proto.getItem,
    setItem: proto.setItem,
    removeItem: proto.removeItem,
    clear: proto.clear,
    key: proto.key
  };

  const LOCAL_PREFIX = 'turn-lab:';
  const SESSION_PREFIX = 'turn-lab-session:';

  function prefixFor(storage) {
    if (storage === localStorageRef) return LOCAL_PREFIX;
    if (storage === sessionStorageRef) return SESSION_PREFIX;
    return '';
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

    const keys = [];
    for (let index = 0; index < this.length; index += 1) {
      const key = native.key.call(this, index);
      if (key?.startsWith(prefix)) keys.push(key);
    }
    for (const key of keys) native.removeItem.call(this, key);
  };

  proto.key = function key(index) {
    const prefix = prefixFor(this);
    if (!prefix) return native.key.call(this, index);

    const keys = [];
    for (let cursor = 0; cursor < this.length; cursor += 1) {
      const candidate = native.key.call(this, cursor);
      if (candidate?.startsWith(prefix)) keys.push(candidate.slice(prefix.length));
    }
    return keys[index] ?? null;
  };

  console.info('TURN LAB: isolated empty save-data namespace enabled.');
})();
