import {
  enhanceLotNow,
  prepareLotEnhancements
} from './lot-enhancement-runtime.js?revision=r246-lot-saved-paint';
import { installLotPwaColorSwatches } from './lot-pwa-color-swatch.js?revision=r206-pwa-color';
import { chooseTrackBeforeLot } from '../tracks/track-manager.js?build=20260722-r52';
import { showTrackIntro } from '../ui/track-intro.js?build=20260725-r75';

// Historical production regression markers while the showroom replaces this loader:
// lot-r10.js?build=20260809-r163-native-html&revision=r590-canonical-lock-icon
// lot-enhancement-runtime.js?revision=r588-canonical-attributes
// lot-enhancement-runtime.js?revision=r205-color-baseline
// lot-enhancement-runtime.js?revision=r206-pwa-color
// lot-enhancement-runtime.js?revision=r214-future-racer-fit
// lot-enhancement-runtime.js?revision=r217-stable-perk-slot&build=20260804-r157
// lot-showroom-experiment.js?revision=r200-production-candidate
// lot-showroom-experiment.js?revision=r246-lot-saved-paint
// export async function showEnhancedLot
// SHOWROOM_CLEANUP_STYLE_ID = 'turn-lot-showroom-r203-polish'
// lot-showroom-cleanup-r201.css?revision=r203-thumbnail-color-polish
// SHOWROOM_CLEANUP_STYLE_ID = 'turn-lot-showroom-r204-polish'
// lot-showroom-cleanup-r201.css?revision=r204-color-swatch-cue
// SHOWROOM_CLEANUP_STYLE_ID = 'turn-lot-showroom-r205-polish'
// lot-showroom-cleanup-r201.css?revision=r205-color-baseline
// SHOWROOM_CLEANUP_STYLE_ID = 'turn-lot-showroom-r206-polish'
// lot-showroom-cleanup-r201.css?revision=r206-pwa-color
// The actual prepared M8 entry below is deliberately synchronous after warmup so
// its existing Race This Car motion-access gate can bind immediately after mount.

// Keep the showroom implementation and its CSS out of TURN's initial module graph.
// Choosing or activating a track gives us a natural warmup window for these resources.
const SHOWROOM_STYLE_ID = 'turn-lot-showroom-r200';
const SHOWROOM_CLEANUP_STYLE_ID = 'turn-lot-showroom-r209-polish';
const SHOWROOM_THUMBNAIL_STYLE_ID = 'turn-lot-thumbnail-r211-composition';
const SHOWROOM_INFO_STYLE_ID = 'turn-lot-info-r212-fit';
const SHOWROOM_TYPOGRAPHY_STYLE_ID = 'turn-lot-info-r214-worst-case-fit';
const SHOWROOM_SHIFT_STYLE_ID = 'turn-lot-shift-r228';
const SHOWROOM_SAVED_PAINT_STYLE_ID = 'turn-lot-saved-paint-r246';
const stylesheetPromises = new Map();
let showroomStylePromise = null;
let showroomPrepared = false;
let originalLotPromise = null;
let originalLotModule = null;
let screenReaderPassPromise = null;
let screenReaderPassModule = null;

function prepareStylesheet(id, relativeUrl) {
  if (stylesheetPromises.has(id)) return stylesheetPromises.get(id);
  const preparation = new Promise((resolve, reject) => {
    const existing = document.getElementById(id);
    if (existing?.sheet) {
      resolve();
      return;
    }

    const link = existing || document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = new URL(relativeUrl, import.meta.url).href;
    link.addEventListener('load', resolve, { once: true });
    link.addEventListener('error', () => {
      link.remove();
      reject(new Error(`TURN: showroom stylesheet could not be loaded: ${relativeUrl}`));
    }, { once: true });
    if (!existing) document.head.appendChild(link);
  }).catch((error) => {
    if (stylesheetPromises.get(id) === preparation) stylesheetPromises.delete(id);
    throw error;
  });
  stylesheetPromises.set(id, preparation);
  return preparation;
}

function prepareShowroomStyles() {
  if (showroomStylePromise) return showroomStylePromise;
  const preparation = Promise.all([
    prepareStylesheet(
      SHOWROOM_STYLE_ID,
      './lot-showroom-experiment.css?revision=r200-production-candidate'
    ),
    prepareStylesheet(
      SHOWROOM_CLEANUP_STYLE_ID,
      './lot-showroom-cleanup-r201.css?revision=r209-picker-above-showroom'
    ),
    prepareStylesheet(
      SHOWROOM_THUMBNAIL_STYLE_ID,
      './lot-thumbnail-composition-r211.css?revision=r211-half-ground-zoom'
    ),
    prepareStylesheet(
      SHOWROOM_INFO_STYLE_ID,
      './lot-info-panel-r212.css?revision=r216-meter-density'
    ),
    prepareStylesheet(
      SHOWROOM_TYPOGRAPHY_STYLE_ID,
      './lot-info-typography-r213.css?revision=r218-meter-black-outline'
    ),
    prepareStylesheet(
      SHOWROOM_SHIFT_STYLE_ID,
      './lot-shift.css?revision=r229-shift-feedback'
    ),
    prepareStylesheet(
      SHOWROOM_SAVED_PAINT_STYLE_ID,
      './lot-saved-paint.css?revision=r246-lot-saved-paint'
    )
  ]).catch((error) => {
    if (showroomStylePromise === preparation) showroomStylePromise = null;
    throw error;
  });
  showroomStylePromise = preparation;
  return showroomStylePromise;
}

function loadOriginalLot() {
  if (!originalLotPromise) {
    const preparation = import('./lot-showroom-experiment.js?revision=r252-supercar-outward-rims')
      .then((module) => {
        originalLotModule = module;
        return module;
      }).catch((error) => {
        if (originalLotPromise === preparation) originalLotPromise = null;
        throw error;
      });
    originalLotPromise = preparation;
  }
  return originalLotPromise;
}

function loadScreenReaderPass() {
  if (!screenReaderPassPromise) {
    const preparation = import('./lot-screen-reader-r202.js?revision=r202-heading-structure')
      .then((module) => {
        screenReaderPassModule = module;
        return module;
      }).catch((error) => {
        if (screenReaderPassPromise === preparation) screenReaderPassPromise = null;
        throw error;
      });
    screenReaderPassPromise = preparation;
  }
  return screenReaderPassPromise;
}

export async function prepareEnhancedLot() {
  if (showroomPrepared) return;
  await Promise.all([
    loadOriginalLot(),
    loadScreenReaderPass(),
    prepareShowroomStyles(),
    prepareLotEnhancements()
  ]);
  showroomPrepared = true;
}

function mountEnhancedLot(options) {
  if (!originalLotModule || !screenReaderPassModule) {
    throw new Error('TURN: showroom was mounted before its modules finished preparing.');
  }
  const { showTheLot: showOriginalLot } = originalLotModule;
  const { installLotScreenReaderPass } = screenReaderPassModule;
  const lotResult = showOriginalLot(options);
  const removePwaColorSwatches = installLotPwaColorSwatches();
  const removeEnhancements = enhanceLotNow();
  const removeScreenReaderPass = installLotScreenReaderPass();
  return Promise.resolve(lotResult).finally(() => {
    removeScreenReaderPass();
    removeEnhancements();
    removePwaColorSwatches();
  });
}

export async function showTheLot(options = {}) {
  const lotWarmup = prepareEnhancedLot();
  // Selection may cancel before warmup settles; a selected track still awaits
  // the original Promise below and receives its error normally.
  void lotWarmup.catch(() => {});
  const trackId = await chooseTrackBeforeLot();
  if (!trackId) return null;

  await lotWarmup;
  const selection = await mountEnhancedLot(options);
  if (selection) await showTrackIntro(trackId);
  return selection;
}

export function showEnhancedLot(options = {}) {
  if (showroomPrepared) return mountEnhancedLot(options);
  return prepareEnhancedLot().then(() => mountEnhancedLot(options));
}
