import { showTheLot as showOriginalLot } from './lot-r10.js?build=20260720-r25';
import { enhanceLotNow } from './lot-enhancement-runtime.js?build=20260801-r121';
import { chooseTrackBeforeLot } from '../tracks/track-manager.js?build=20260722-r52';
import { showTrackIntro } from '../ui/track-intro.js?build=20260725-r75';

export async function showEnhancedLot(options = {}) {
  const lotResult = showOriginalLot(options);
  const removeEnhancements = enhanceLotNow();

  try {
    return await lotResult;
  } finally {
    removeEnhancements();
  }
}

export async function showTheLot(options = {}) {
  const trackId = await chooseTrackBeforeLot();
  if (!trackId) return null;

  const selection = await showEnhancedLot(options);
  if (selection) await showTrackIntro(trackId);
  return selection;
}
