const NativeAudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;

let sharedContext = null;
let installed = false;

function createNativeContext() {
  if (!NativeAudioContextClass) return null;
  try {
    return new NativeAudioContextClass({ latencyHint: 'interactive' });
  } catch (_) {
    try {
      return new NativeAudioContextClass();
    } catch (_) {
      return null;
    }
  }
}

export function getSharedAudioContext() {
  if (sharedContext?.state === 'closed') sharedContext = null;
  if (!sharedContext) sharedContext = createNativeContext();
  return sharedContext;
}

export async function resumeSharedAudioContext() {
  const context = getSharedAudioContext();
  if (!context) return false;
  if (context.state === 'running') return true;
  try {
    await context.resume();
  } catch (_) {
    return false;
  }
  return context.state === 'running';
}

export function installSharedAudioContextConstructor() {
  if (installed) return Boolean(NativeAudioContextClass);
  installed = true;
  if (!NativeAudioContextClass) return false;

  function TurnSharedAudioContext() {
    return getSharedAudioContext();
  }

  try {
    Object.setPrototypeOf(TurnSharedAudioContext, NativeAudioContextClass);
  } catch (_) {}
  TurnSharedAudioContext.prototype = NativeAudioContextClass.prototype;

  try {
    globalThis.AudioContext = TurnSharedAudioContext;
  } catch (_) {}
  try {
    globalThis.webkitAudioContext = TurnSharedAudioContext;
  } catch (_) {}

  globalThis.__turnSharedAudioContext = Object.freeze({
    get context() {
      return sharedContext;
    },
    get state() {
      return sharedContext?.state || 'not-created';
    },
    get sampleRate() {
      return sharedContext?.sampleRate || 0;
    },
    get currentTime() {
      return sharedContext?.currentTime || 0;
    }
  });
  return true;
}
