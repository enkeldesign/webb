import { showTheLot as showOriginalLot } from './lot-r10.js?build=20260720-r25';
import { installLotStatLegend } from './lot-stat-legend.js?build=20260724-r59';
import { installLotLayout } from './lot-layout-r60.js?build=20260729-r116';
import { installLotAccessibility } from './lot-accessibility-r118.js?build=20260729-r118';
import { chooseTrackBeforeLot } from '../tracks/track-manager.js?build=20260722-r52';
import { showTrackIntro } from '../ui/track-intro.js?build=20260725-r75';

export async function showEnhancedLot(options = {}) {
  const lotResult = showOriginalLot(options);
  const removeStatLegend = installLotStatLegend();
  const removeLotLayout = installLotLayout();
  const removeLotAccessibility = installLotAccessibility();

  try {
    return await lotResult;
  } finally {
    removeLotAccessibility();
    removeLotLayout();
    removeStatLegend();
  }
}

export async function showTheLot(options = {}) {
  const trackId = await chooseTrackBeforeLot();
  if (!trackId) return null;

  const selection = await showEnhancedLot(options);
  if (selection) await showTrackIntro(trackId);
  return selection;
}
