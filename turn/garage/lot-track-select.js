import { showTheLot as showOriginalLot } from './lot-r10.js?build=20260720-r25';
import { installLotStatLegend } from './lot-stat-legend.js?build=20260724-r59';
import { chooseTrackBeforeLot } from '../tracks/track-manager.js?build=20260722-r52';

export async function showTheLot(options = {}) {
  const trackId = await chooseTrackBeforeLot();
  if (!trackId) return null;

  const removeStatLegend = installLotStatLegend();
  try {
    return await showOriginalLot(options);
  } finally {
    removeStatLegend();
  }
}
