const DEGREES_TO_RADIANS = Math.PI / 180;

export function createWebPlatform(environment = globalThis) {
  const windowRef = environment.window || environment;
  const documentRef = environment.document || windowRef.document;
  const screenRef = environment.screen || windowRef.screen;
  const motionEventType = environment.DeviceMotionEvent || windowRef.DeviceMotionEvent;

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

      const request = motionEventType?.requestPermission;
      if (typeof request === 'function') {
        const permission = await request.call(motionEventType);
        if (permission !== 'granted') {
          throw new Error('Motion permission was not granted.');
        }
      }

      return true;
    },

    subscribe(listener) {
      if (typeof listener !== 'function') {
        throw new TypeError('TURN motion listener must be a function.');
      }
      if (typeof windowRef?.addEventListener !== 'function') {
        throw new Error('Motion events are not available in this environment.');
      }

      windowRef.addEventListener('devicemotion', listener, { passive: true });
      return () => windowRef.removeEventListener?.('devicemotion', listener);
    }
  });

  const display = Object.freeze({
    async requestFullscreen(root = documentRef?.documentElement) {
      const request = root?.requestFullscreen || root?.webkitRequestFullscreen;
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
      const orientation = screenRef?.orientation;
      if (typeof orientation?.lock !== 'function') return false;

      try {
        await orientation.lock('landscape');
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
