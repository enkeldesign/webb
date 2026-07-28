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

let installedPlatform = null;

export function installTurnPlatform(platform) {
  validateTurnPlatform(platform);

  if (installedPlatform && installedPlatform !== platform) {
    throw new Error('TURN platform has already been installed.');
  }

  installedPlatform = platform;
  return installedPlatform;
}

export function getTurnPlatform() {
  return installedPlatform;
}

export function requireTurnPlatform() {
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
