import { showTheLot as showOriginalLot } from './lot-r10.js?build=20260720-r25';
import { installLotStatLegend } from './lot-stat-legend.js?build=20260724-r59';
import { installLotLayout } from './lot-layout-r60.js?build=20260724-r60';
import { chooseTrackBeforeLot } from '../tracks/track-manager.js?build=20260722-r52';
import { showTrackIntro } from '../ui/track-intro.js?build=20260725-r75';

export async function showTheLot(options = {}) {
  const trackId = await chooseTrackBeforeLot();
  if (!trackId) return null;

  const lotResult = showOriginalLot(options);
  const removeStatLegend = installLotStatLegend();
  const removeLotLayout = installLotLayout();
  let selection = null;

  try {
    selection = await lotResult;
  } finally {
    removeLotLayout();
    removeStatLegend();
  }

  if (selection) await showTrackIntro(trackId);
  return selection;
}
