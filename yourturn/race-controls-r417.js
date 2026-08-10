const NativeMutationObserver = globalThis.MutationObserver;

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

async function waitForControlRuntime() {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    const utilityGroup = document.querySelector('#controls .utility-group');
    const blankButton = document.querySelector('.turn-screen-blank-control');
    if (globalThis.__turnRuntime
        && globalThis.__turnRaceSession
        && globalThis.__yourTurnSession
        && utilityGroup
        && blankButton) {
      return utilityGroup;
    }
    await nextFrame();
  }
  throw new Error('YOUR TURN r417 could not find the race-control runtime.');
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
    await import('/yourturn/race-controls-r411.js?revision=r417-observer-loop-fix');
  } finally {
    if (NativeMutationObserver) globalThis.MutationObserver = NativeMutationObserver;
  }

  utilityGroup.dataset.r417ObserverLoopFix = 'true';
}

install().catch((error) => {
  console.error('YOUR TURN race-control fix could not install.', error);
});
