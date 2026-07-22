import { showTheLot as showOriginalLot } from './lot-r10.js?build=20260720-r25';
import { chooseTrackBeforeLot } from '../tracks/track-manager.js?build=20260722-r51';

export async function showTheLot(options = {}) {
  const trackId = await chooseTrackBeforeLot();
  if (!trackId) return null;
  return showOriginalLot(options);
}
