const DEGREES_TO_RADIANS = Math.PI / 180;

export function createWebPlatform(environment = globalThis) {
  const windowRef = environment.window || environment;
  const documentRef = environment.document || windowRef.document;
  const screenRef = environment.screen || windowRef.screen;
  const motionEventType = environment.DeviceMotionEvent || windowRef.DeviceMotionEvent;
  const requestMotionPermission = motionEventType?.requestPermission;
  const addWindowEventListener = typeof windowRef?.addEventListener === 'function'
    ? windowRef.addEventListener.bind(windowRef)
    : null;
  const removeWindowEventListener = typeof windowRef?.removeEventListener === 'function'
    ? windowRef.removeEventListener.bind(windowRef)
    : null;
  const defaultFullscreenRoot = documentRef?.documentElement;
  const requestDefaultFullscreen = defaultFullscreenRoot?.requestFullscreen;
  const requestDefaultWebkitFullscreen = defaultFullscreenRoot?.webkitRequestFullscreen;
  const screenOrientation = screenRef?.orientation;
  const lockScreenOrientation = screenOrientation?.lock;

  const motion = Object.freeze({
    isAvailable() {
      return typeof motionEventType !== 'undefined' && motionEventType !== null;
    },

    getScreenOrientationAngle() {
      const screenAngle = screenRef?.orientation?.angle;
      const degrees = Number.isFinite(screenAngle)
        ? screenAngle
        : Number(windowRef?.orientation || 0);
      return (Number.isFinite(degrees) ? degrees : 0) * DEGREES_TO_RADIANS;
    },

    async requestPermission() {
      if (!motion.isAvailable()) {
        throw new Error('Motion sensors are not available in this browser.');
      }

      if (typeof requestMotionPermission === 'function') {
        const permission = await requestMotionPermission.call(motionEventType);
        if (permission !== 'granted') {
          throw new Error('Motion permission was not granted.');
        }
      }

      return true;
    },

    subscribe(listener) {
      if (typeof listener !== 'function' && typeof listener?.handleEvent !== 'function') {
        throw new TypeError('TURN motion listener must be callable.');
      }
      if (!addWindowEventListener) {
        throw new Error('Motion events are not available in this environment.');
      }

      addWindowEventListener('devicemotion', listener, { passive: true });
      return () => removeWindowEventListener?.('devicemotion', listener);
    }
  });

  const display = Object.freeze({
    async requestFullscreen(root = defaultFullscreenRoot) {
      const request = root === defaultFullscreenRoot
        ? (requestDefaultFullscreen || requestDefaultWebkitFullscreen)
        : (root?.requestFullscreen || root?.webkitRequestFullscreen);
      if (
        typeof request !== 'function'
        || documentRef?.fullscreenElement
        || documentRef?.webkitFullscreenElement
      ) {
        return false;
      }

      try {
        await request.call(root);
        return true;
      } catch (_) {
        return false;
      }
    },

    async lockLandscape() {
      if (typeof lockScreenOrientation !== 'function') return false;

      try {
        await lockScreenOrientation.call(screenOrientation, 'landscape');
        return true;
      } catch (_) {
        return false;
      }
    }
  });

  return Object.freeze({
    kind: 'web',
    motion,
    display
  });
}
