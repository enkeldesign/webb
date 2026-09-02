import {
  enhanceLotNow,
  prepareLotEnhancements
} from './lot-enhancement-runtime.js?revision=r223-training-car-taxi';
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
let showroomStylePromise = null;
let originalLotPromise = null;
let originalLotModule = null;
let screenReaderPassPromise = null;
let screenReaderPassModule = null;

function prepareStylesheet(id, relativeUrl) {
  return new Promise((resolve) => {
    const existing = document.getElementById(id);
    if (existing) {
      resolve();
      return;
    }

    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = new URL(relativeUrl, import.meta.url).href;
    link.addEventListener('load', resolve, { once: true });
    link.addEventListener('error', () => {
      console.warn(`TURN: showroom stylesheet could not be loaded: ${relativeUrl}`);
      resolve();
    }, { once: true });
    document.head.appendChild(link);
  });
}

function prepareShowroomStyles() {
  if (showroomStylePromise) return showroomStylePromise;
  showroomStylePromise = Promise.all([
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
      './lot-shift.css?revision=r228-shift-gearbox'
    )
  ]);
  return showroomStylePromise;
}

function loadOriginalLot() {
  if (!originalLotPromise) {
    originalLotPromise = import('./lot-showroom-experiment.js?revision=r223-training-car-taxi')
      .then((module) => {
        originalLotModule = module;
        return module;
      });
  }
  return originalLotPromise;
}

function loadScreenReaderPass() {
  if (!screenReaderPassPromise) {
    screenReaderPassPromise = import('./lot-screen-reader-r202.js?revision=r202-heading-structure')
      .then((module) => {
        screenReaderPassModule = module;
        return module;
      });
  }
  return screenReaderPassPromise;
}

export async function prepareEnhancedLot() {
  await Promise.all([
    loadOriginalLot(),
    loadScreenReaderPass(),
    prepareShowroomStyles(),
    prepareLotEnhancements()
  ]);
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
  const trackId = await chooseTrackBeforeLot();
  if (!trackId) return null;

  await lotWarmup;
  const selection = await mountEnhancedLot(options);
  if (selection) await showTrackIntro(trackId);
  return selection;
}

export function showEnhancedLot(options = {}) {
  if (originalLotModule && screenReaderPassModule) return mountEnhancedLot(options);
  return prepareEnhancedLot().then(() => mountEnhancedLot(options));
}
