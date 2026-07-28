const DBE_DISABLED_FRAME = Object.freeze({
  sliderPresence: 0,
  sliderRisk: 0,
  sliderPan: 0,
  surfaceAmount: 0,
  offRoad: false,
  wrongWay: false,
  headingCorrectionPan: 0,
  nearestRivalDistance: Infinity,
  nearestRivalPan: 0
});

let installed = false;

export function installAudioPreferenceRuntime() {
  if (installed) return globalThis.__turnAudio;
  const baseAudio = globalThis.__turnAudio;
  if (!baseAudio) return null;
  installed = true;

  const preferredAudio = Object.freeze({
    unlock: (...args) => baseAudio.unlock(...args),
    update(frame = {}, now = performance.now()) {
      const settings = globalThis.__turnAudioPreferences?.getSettings?.();
      const nextFrame = settings?.dbeEnabled === false
        ? { ...frame, ...DBE_DISABLED_FRAME }
        : frame;
      baseAudio.update(nextFrame, now);
    },
    cue: (...args) => baseAudio.cue(...args),
    silence: (...args) => baseAudio.silence(...args),
    get available() {
      return baseAudio.available;
    },
    get state() {
      return baseAudio.state;
    }
  });

  globalThis.__turnAudio = preferredAudio;
  return preferredAudio;
}
