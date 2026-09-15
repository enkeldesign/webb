const REQUIRED_PORTS = Object.freeze({
  motion: Object.freeze([
    'isAvailable',
    'getScreenOrientationAngle',
    'requestPermission',
    'subscribe'
  ]),
  display: Object.freeze([
    'requestFullscreen',
    'lockLandscape'
  ])
});

const PLATFORM_REGISTRY_KEY = Symbol.for('turn.platform.context');

function platformRegistry() {
  const existing = globalThis[PLATFORM_REGISTRY_KEY];
  if (existing) return existing;

  const registry = { installedPlatform: null };
  Object.defineProperty(globalThis, PLATFORM_REGISTRY_KEY, {
    configurable: false,
    enumerable: false,
    writable: false,
    value: registry
  });
  return registry;
}

export function installTurnPlatform(platform) {
  validateTurnPlatform(platform);
  const registry = platformRegistry();

  if (registry.installedPlatform && registry.installedPlatform !== platform) {
    throw new Error('TURN platform has already been installed.');
  }

  registry.installedPlatform = platform;
  return registry.installedPlatform;
}

export function getTurnPlatform() {
  return platformRegistry().installedPlatform;
}

export function requireTurnPlatform() {
  const installedPlatform = getTurnPlatform();
  if (!installedPlatform) {
    throw new Error('TURN platform has not been installed.');
  }
  return installedPlatform;
}

export function validateTurnPlatform(platform) {
  if (!platform || typeof platform !== 'object') {
    throw new TypeError('TURN platform must be an object.');
  }
  if (typeof platform.kind !== 'string' || !platform.kind.trim()) {
    throw new TypeError('TURN platform.kind must be a non-empty string.');
  }

  for (const [portName, methods] of Object.entries(REQUIRED_PORTS)) {
    const port = platform[portName];
    if (!port || typeof port !== 'object') {
      throw new TypeError(`TURN platform.${portName} must be an object.`);
    }
    for (const methodName of methods) {
      if (typeof port[methodName] !== 'function') {
        throw new TypeError(`TURN platform.${portName}.${methodName} must be a function.`);
      }
    }
  }

  return true;
}
