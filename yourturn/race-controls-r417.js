const NativeMutationObserver = globalThis.MutationObserver;

function nextTick() {
  return new Promise((resolve) => globalThis.setTimeout(resolve, 100));
}

// TURN can take many seconds to load on a slower device (an iPad 9 took longer than
// the 300 frames this used to allow, leaving TURN's default race buttons in place).
// Keep waiting; a timer keeps polling where animation frames are throttled.
async function waitForControlRuntime() {
  for (;;) {
    const utilityGroup = document.querySelector('#controls .utility-group');
    if (globalThis.__turnRuntime
        && globalThis.__turnRaceSession
        && globalThis.__yourTurnSession
        && utilityGroup) {
      return utilityGroup;
    }
    await nextTick();
  }
}

function makeFilteredMutationObserver(utilityGroup) {
  if (typeof NativeMutationObserver !== 'function') return NativeMutationObserver;

  return class YourTurnFilteredMutationObserver {
    constructor(callback) {
      this.observer = new NativeMutationObserver(callback);
    }

    observe(target, options = {}) {
      // PR #413 observed the utility row's child list and then rearranged that
      // same child list from the observer callback. Once a challenge was accepted,
      // appendChild() retriggered the observer indefinitely and starved Safari's
      // portrait -> landscape paint. Suppress only that self-observing edge.
      if (target === utilityGroup && options.childList === true && options.subtree !== true) {
        return;
      }
      this.observer.observe(target, options);
    }

    disconnect() {
      this.observer.disconnect();
    }

    takeRecords() {
      return this.observer.takeRecords();
    }
  };
}

async function install() {
  const utilityGroup = await waitForControlRuntime();
  const FilteredMutationObserver = makeFilteredMutationObserver(utilityGroup);

  if (FilteredMutationObserver) globalThis.MutationObserver = FilteredMutationObserver;
  try {
    await import('/yourturn/race-controls-r411.js?revision=r602-funnel');
  } finally {
    if (NativeMutationObserver) globalThis.MutationObserver = NativeMutationObserver;
  }

  utilityGroup.dataset.r417ObserverLoopFix = 'true';
}

install().catch((error) => {
  console.error('YOUR TURN race-control fix could not install.', error);
});
