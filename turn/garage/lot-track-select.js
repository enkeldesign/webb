import {
  enhanceLotNow,
  prepareLotEnhancements
} from './lot-enhancement-runtime.js?revision=r588-canonical-attributes&build=20260804-r157';
import { chooseTrackBeforeLot } from '../tracks/track-manager.js?build=20260722-r52';
import { showTrackIntro } from '../ui/track-intro.js?build=20260725-r75';

// Historical production regression marker while the showroom replaces this loader:
// lot-r10.js?build=20260809-r163-native-html&revision=r590-canonical-lock-icon

// Keep the showroom implementation and its CSS out of TURN's initial module graph.
// Choosing a track gives us a natural warmup window for both resources.
const SHOWROOM_STYLE_ID = 'turn-lot-showroom-r200';
let showroomStylePromise = null;

function prepareShowroomStyles() {
  if (showroomStylePromise) return showroomStylePromise;
  showroomStylePromise = new Promise((resolve) => {
    const existing = document.getElementById(SHOWROOM_STYLE_ID);
    if (existing) {
      resolve();
      return;
    }

    const link = document.createElement('link');
    link.id = SHOWROOM_STYLE_ID;
    link.rel = 'stylesheet';
    link.href = new URL('./lot-showroom-experiment.css?revision=r200-production-candidate', import.meta.url).href;
    link.addEventListener('load', resolve, { once: true });
    link.addEventListener('error', () => {
      console.warn('TURN: showroom stylesheet could not be loaded.');
      resolve();
    }, { once: true });
    document.head.appendChild(link);
  });
  return showroomStylePromise;
}

let originalLotPromise = null;
function loadOriginalLot() {
  if (!originalLotPromise) {
    originalLotPromise = import('./lot-showroom-experiment.js?revision=r200-production-candidate');
  }
  return originalLotPromise;
}

export async function showTheLot(options = {}) {
  const lotWarmup = Promise.all([
    loadOriginalLot(),
    prepareShowroomStyles(),
    prepareLotEnhancements()
  ]);
  const trackId = await chooseTrackBeforeLot();
  if (!trackId) return null;

  await lotWarmup;
  const selection = await showEnhancedLot(options);
  if (selection) await showTrackIntro(trackId);
  return selection;
}

export async function showEnhancedLot(options = {}) {
  const [{ showTheLot: showOriginalLot }] = await Promise.all([
    loadOriginalLot(),
    prepareShowroomStyles(),
    prepareLotEnhancements()
  ]);

  const lotResult = showOriginalLot(options);
  const removeEnhancements = enhanceLotNow();
  try {
    return await lotResult;
  } finally {
    removeEnhancements();
  }
}
