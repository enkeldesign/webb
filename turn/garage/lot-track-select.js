import {
  enhanceLotNow,
  prepareLotEnhancements
} from './lot-enhancement-runtime.js?revision=r588-canonical-attributes&build=20260804-r157';
import { installLotSelectionBayPolish } from './lot-selection-bay.js?revision=r593-connected-bay';
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

  // The original Lot builds all 15 parking pads synchronously inside showTheLot().
  // Install a temporary construction hook only for that moment so the selected bay
  // can reuse the existing parking stripes without forking the garage renderer.
  const restoreSelectionBayPolish = installLotSelectionBayPolish();
  const lotResult = showOriginalLot(options);
  restoreSelectionBayPolish();

  const removeEnhancements = enhanceLotNow();
  try {
    return await lotResult;
  } finally {
    removeEnhancements();
  }
}
