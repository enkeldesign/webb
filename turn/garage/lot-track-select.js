import {
  enhanceLotNow,
  prepareLotEnhancements
} from './lot-enhancement-runtime.js?revision=r588-canonical-attributes&build=20260804-r157';
import { chooseTrackBeforeLot } from '../tracks/track-manager.js?build=20260722-r52';
import { showTrackIntro } from '../ui/track-intro.js?build=20260725-r75';

// Keep the original Lot implementation out of TURN's initial module graph. The track
// chooser gives us a natural warmup window, so start fetching it only once the player
// has actually chosen to enter The Lot.
let originalLotPromise = null;
function loadOriginalLot() {
  if (!originalLotPromise) {
    originalLotPromise = import('./lot-r10.js?build=20260809-r163-native-html&revision=r589-beginner-bubble');
  }
  return originalLotPromise;
}

export async function showTheLot(options = {}) {
  // Begin the on-demand Lot graph while the player is choosing a track instead of
  // paying for it during application startup.
  const lotWarmup = Promise.all([
    loadOriginalLot(),
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
    prepareLotEnhancements()
  ]);

  // lot-r10 now applies the selected-bay polish from its own synchronous entry
  // bootstrap, so every caller—including M8 Home—gets the same presentation.
  const lotResult = showOriginalLot(options);
  const removeEnhancements = enhanceLotNow();
  try {
    return await lotResult;
  } finally {
    removeEnhancements();
  }
}
