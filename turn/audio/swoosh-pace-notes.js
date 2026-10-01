// SWOOSH pace notes (#909, #928): the road ahead painted with sound. Every bend comes
// from the course's centreline (route-geometry.js), so every track, future tracks and
// DRIVE BY EAR 101 are covered by the same path. Each segment of at most 90° is one
// swipe (swoosh-sound.js, 'swipe-tone', chosen in listening test round 3):
//
// - side: the swipe travels from 50% to 100% on the bend's side;
// - tightness: pitch, from the tightest sustained radius;
// - length: a quick swipe for a short curve, a slower one for a long turn.
//
// Timing: each swipe should end a steering lead before its bend begins. Where swipes
// would overlap, earlier ones start earlier, so a dense sequence plays as one linked
// phrase and no bend is dropped. Route cues yield to recovery and safety: off road they
// are held back, driving the wrong way cancels them, and any pause, reset or track
// change clears them, so nothing stale plays afterwards.
//
// Output goes through the engine's route channel (globalThis.__turnRouteAudio): Drive
// By Ear's balance and on/off apply, and the car sounds and music duck underneath.
import { routeForSamples, routeSegmentAt, upcomingRouteSegments } from './route-geometry.js';
import { SWOOSH_LENGTHS, SWORD_STYLES, SWORD_VARIANTS, startSwoosh } from './swoosh-sound.js';

export const SWOOSH_PACE_TUNING = Object.freeze({
  variant: 'swipe-undertone',
  // Peak level into the route channel. At TURN's default balance, swooshes sit close to the
  // guiding ribbon (Erik found 0.24 comfortable only with Drive By Ear at 10–20%, i.e.
  // ~0.036); as the balance favours Drive By Ear they rise, reaching 0.24 at 92.5%.
  level: 0.036,
  focusLevel: 0.24,
  defaultBalance: 0.55,
  focusBalance: 0.925,
  // Pitch from the tightest sustained radius (metres): tight below 40, medium below 120.
  tightRadius: 40,
  mediumRadius: 120,
  // Swipe speed from the segment's length: a long swipe from 100 m of road.
  longMetres: 100,
  // A swipe ends at least this long before its bend begins.
  steeringLeadSeconds: 1,
  // Between linked swipes, as in the listening tests.
  gapSeconds: 0.035,
  // Swipes planned ahead, and how close to its start a swipe is handed to Web Audio.
  planSegments: 8,
  scheduleAheadSeconds: 0.12,
  // Below this speed, plan as if rolling at it; nothing plays until the car moves forward.
  minimumPlanningSpeed: 6,
  minimumForwardSpeed: 1,
  // A jump along the road bigger than this (respawn, restart) clears delivery.
  jumpMetres: 120,
  updateIntervalMs: 1000 / 30,
  historySize: 12
});

const SILENCE_EVENT = 'turn:pace-note-silence';

let installed = false;
let wrappedAudio = null;
let route = null;
let channel = null;
let lastCheckedAt = -Infinity;
let lastDistance = null;
let nextFreeAt = 0;
let lastEndsAt = -Infinity;
// Per segment id, for the current approach: { status, ... }. Cleared once the car is past.
const delivery = new Map();
const live = new Map();
const history = [];
const counts = { fired: 0, late: 0, phrases: 0, suppressed: 0, cancelled: 0 };

// Admin sound picker: an admin-unlocked profile may race with any of these. Choice 0 is
// the race sound every player hears; 1–10 are the sword swings. Players are unaffected.
export const SWOOSH_SOUND_CHOICES = Object.freeze([
  Object.freeze({ variant: SWOOSH_PACE_TUNING.variant, name: 'RACE' }),
  ...SWORD_VARIANTS.map((variant) => Object.freeze({ variant, name: SWORD_STYLES[variant].name }))
]);
const ADMIN_UNLOCK_MARKER = 'turn-admin-unlock-v1';
export const SWOOSH_SOUND_STORAGE_KEY = 'turn-swoosh-sound-v1';

/** The chosen sound's index: the admin's stored choice, else 0 (the race sound). */
export function swooshSoundIndex(storage = globalThis.localStorage) {
  try {
    if (!storage?.getItem(ADMIN_UNLOCK_MARKER)) return 0;
    const index = Number(storage.getItem(SWOOSH_SOUND_STORAGE_KEY));
    return Number.isInteger(index) && index >= 0 && index < SWOOSH_SOUND_CHOICES.length ? index : 0;
  } catch (_) {
    return 0;
  }
}

/** Pitch anchor for a segment. */
export function swooshTightness(segment, tuning = SWOOSH_PACE_TUNING) {
  const radius = Number(segment?.peakRadius) || Infinity;
  if (radius < tuning.tightRadius) return 'tight';
  return radius < tuning.mediumRadius ? 'medium' : 'gentle';
}

/** Swipe length for a segment: road length, never speed. */
export function swooshDuration(segment, tuning = SWOOSH_PACE_TUNING) {
  return (Number(segment?.length) || 0) >= tuning.longMetres ? SWOOSH_LENGTHS.long : SWOOSH_LENGTHS.short;
}

/**
 * When each upcoming swoosh should play, in seconds from now: it ends a steering lead
 * before its bend, unless the next swoosh needs the time, in which case it starts
 * earlier. upcoming: [{ segment, ahead }] nearest first.
 */
export function planSwooshes(upcoming, speed, tuning = SWOOSH_PACE_TUNING) {
  const pace = Math.max(Number(speed) || 0, tuning.minimumPlanningSpeed);
  const plan = upcoming.map(({ segment, ahead }) => {
    const duration = swooshDuration(segment, tuning);
    const entry = ahead / pace;
    const end = entry - tuning.steeringLeadSeconds;
    return { segment, ahead, entry, duration, start: end - duration, end };
  });
  for (let index = plan.length - 2; index >= 0; index -= 1) {
    const latestEnd = plan[index + 1].start - tuning.gapSeconds;
    if (plan[index].end > latestEnd) {
      plan[index].end = latestEnd;
      plan[index].start = latestEnd - plan[index].duration;
    }
  }
  return plan;
}

export function installSwooshPaceNotes() {
  if (installed) return wrappedAudio || globalThis.__turnAudio;
  const baseAudio = globalThis.__turnAudio;
  if (!baseAudio) return null;
  installed = true;

  if (typeof window !== 'undefined') {
    window.addEventListener(SILENCE_EVENT, () => resetSwooshDelivery('silenced'));
    window.addEventListener('turn:track-changed', () => resetSwooshDelivery('track changed'));
    window.addEventListener('turn:ui-state-change', (event) => {
      if (!event.detail?.running || event.detail?.reason === 'race-reset') resetSwooshDelivery('race ended');
    });
  }

  wrappedAudio = Object.freeze({
    unlock: (...args) => baseAudio.unlock(...args),
    update(frame = {}, now = performance.now()) {
      if (now - lastCheckedAt >= SWOOSH_PACE_TUNING.updateIntervalMs) {
        lastCheckedAt = now;
        updateSwooshPaceNotes(globalThis.__turnRuntime, frame);
      }
      baseAudio.update(frame, now);
    },
    cue: (...args) => baseAudio.cue(...args),
    silence(...args) {
      resetSwooshDelivery('silenced');
      return baseAudio.silence(...args);
    },
    get available() {
      return baseAudio.available;
    },
    get state() {
      return baseAudio.state;
    }
  });

  globalThis.__turnSwooshPaceNotes = Object.freeze({
    tuning: SWOOSH_PACE_TUNING,
    soundChoices: SWOOSH_SOUND_CHOICES,
    get soundIndex() {
      return swooshSoundIndex();
    },
    // Admin sound picker: store a choice (admin profiles only) and hear it once.
    setSoundIndex(index) {
      const next = ((Math.round(Number(index)) || 0) % SWOOSH_SOUND_CHOICES.length + SWOOSH_SOUND_CHOICES.length) % SWOOSH_SOUND_CHOICES.length;
      try {
        if (!globalThis.localStorage?.getItem(ADMIN_UNLOCK_MARKER)) return 0;
        globalThis.localStorage.setItem(SWOOSH_SOUND_STORAGE_KEY, String(next));
      } catch (_) {
        return swooshSoundIndex();
      }
      return swooshSoundIndex();
    },
    preview({ side = 1, tightness = 'medium', long = false } = {}) {
      const routeAudio = globalThis.__turnRouteAudio;
      if (!routeAudio?.ready || !routeAudio.destination) return false;
      startSwoosh(routeAudio.context, routeAudio.destination, {
        side,
        tightness,
        variant: SWOOSH_SOUND_CHOICES[swooshSoundIndex()].variant,
        durationSeconds: long ? SWOOSH_LENGTHS.long : SWOOSH_LENGTHS.short,
        level: swooshLevel(globalThis.__turnAudioPreferences?.getSettings?.()?.balance)
      });
      return true;
    },
    get audioTime() {
      return globalThis.__turnRouteAudio?.context?.currentTime ?? 0;
    },
    get route() {
      return route;
    },
    get history() {
      return history.slice();
    },
    get counts() {
      return Object.freeze({ ...counts });
    },
    statusOf: (segmentId) => delivery.get(segmentId) || null
  });
  globalThis.__turnAudio = wrappedAudio;
  return wrappedAudio;
}

/** One planning pass; returns the swooshes started. Exported for tests. */
export function updateSwooshPaceNotes(runtime, frame = {}, routeAudio = globalThis.__turnRouteAudio) {
  channel = routeAudio || null;
  const state = runtime?.state;
  const courseId = String(runtime?.trackId || state?.trackId || globalThis.__turnGetTrackId?.() || '');
  const nextRoute = routeForSamples(runtime?.samples, courseId);
  if (nextRoute !== route) {
    resetSwooshDelivery('new course');
    route = nextRoute;
  }
  if (!state || !route?.segments.length) return [];

  const active = state.running === true
    && String(state.mode || '') !== 'spectating'
    && frame.active !== false
    && routeCuesEnabled();
  if (!active) {
    cancelLive('paused');
    lastDistance = null;
    return [];
  }

  const index = Math.max(0, Math.round(Number(state.nearestTrackIndex) || 0)) % runtime.samples.length;
  const distance = index * route.sampleSpacing;
  if (lastDistance !== null && jumped(lastDistance, distance)) resetSwooshDelivery('jumped');
  lastDistance = distance;

  const audioNow = routeAudio?.context?.currentTime ?? 0;
  pruneLive(audioNow);
  const current = routeSegmentAt(route, distance);
  rearmPassed(distance, current);

  const blocked = frame.wrongWay ? 'wrong way' : frame.offRoad ? 'off road' : '';
  if (blocked) cancelLive(blocked);
  if (current && !delivery.has(current.id)) {
    record(current, blocked ? 'suppressed' : 'missed', { reason: blocked || 'no time' });
  }
  if (blocked) return [];

  const sample = runtime.samples[index];
  const forwardSpeed = (Number(state.velocity?.x) || 0) * (Number(sample?.tangent?.x) || 0)
    + (Number(state.velocity?.z) || 0) * (Number(sample?.tangent?.z) || 0);
  if (forwardSpeed < SWOOSH_PACE_TUNING.minimumForwardSpeed) return [];
  if (!routeAudio?.ready || !routeAudio.destination) return [];

  const upcoming = upcomingRouteSegments(route, distance, SWOOSH_PACE_TUNING.planSegments)
    .filter(({ segment, ahead }) => ahead > 0 && segment !== current && !delivery.has(segment.id));
  const speed = Math.max(0, Number(state.speed) || forwardSpeed);
  const started = [];
  for (const item of planSwooshes(upcoming, speed)) {
    if (item.start > SWOOSH_PACE_TUNING.scheduleAheadSeconds) break;
    started.push(playPlanned(item, routeAudio));
  }
  return started;
}

function playPlanned(item, routeAudio) {
  const tuning = SWOOSH_PACE_TUNING;
  const context = routeAudio.context;
  const now = context.currentTime;
  const at = Math.max(now + 0.012, now + item.start, nextFreeAt);
  const handle = startSwoosh(context, routeAudio.destination, {
    side: item.segment.direction,
    tightness: swooshTightness(item.segment),
    variant: SWOOSH_SOUND_CHOICES[swooshSoundIndex()].variant,
    durationSeconds: item.duration,
    level: swooshLevel(globalThis.__turnAudioPreferences?.getSettings?.()?.balance),
    at
  });
  const linked = at <= lastEndsAt + tuning.gapSeconds + 0.02;
  if (!linked) counts.phrases += 1;
  nextFreeAt = handle.endsAt + tuning.gapSeconds;
  lastEndsAt = handle.endsAt;
  live.set(item.segment.id, { segment: item.segment, handle, at, endsAt: handle.endsAt });

  routeAudio.holdMixUntil?.(handle.endsAt + 0.05);
  globalThis.__turnRacingMusic?.duck?.(at - now, handle.endsAt - at);

  // Seconds between the swoosh ending and the car reaching the bend.
  const margin = item.entry - (handle.endsAt - now);
  const late = margin < tuning.steeringLeadSeconds / 2;
  record(item.segment, late ? 'late' : 'fired', { margin, linked, at, endsAt: handle.endsAt });
  return Object.freeze({ id: item.segment.id, at, endsAt: handle.endsAt, margin, linked });
}

function record(segment, status, detail = {}) {
  const entry = Object.freeze({
    id: segment.id,
    side: segment.side,
    angleDegrees: segment.angleDegrees,
    tightness: swooshTightness(segment),
    long: swooshDuration(segment) === SWOOSH_LENGTHS.long,
    status,
    ...detail
  });
  delivery.set(segment.id, entry);
  if (status === 'fired' || status === 'late') counts.fired += 1;
  if (status === 'late') counts.late += 1;
  if (status === 'suppressed' || status === 'missed') counts.suppressed += 1;
  if (status === 'cancelled') counts.cancelled += 1;
  history.push(entry);
  if (history.length > SWOOSH_PACE_TUNING.historySize) history.shift();
}

// Segments the car has left behind are re-armed for the next lap.
function rearmPassed(distance, current) {
  for (const id of delivery.keys()) {
    const segment = route.segments.find((candidate) => candidate.id === id);
    if (!segment) {
      delivery.delete(id);
      continue;
    }
    if (segment === current) continue;
    const ahead = route.closed === false
      ? segment.startDistance - distance
      : ((segment.startDistance - distance) % route.trackLength + route.trackLength) % route.trackLength;
    const behind = route.closed === false ? ahead < 0 : ahead > route.trackLength / 2;
    if (behind && !live.has(id)) delivery.delete(id);
  }
}

function jumped(from, to) {
  const length = route.trackLength;
  const forward = route.closed === false ? to - from : ((to - from) % length + length) % length;
  const backward = route.closed === false ? from - to : ((from - to) % length + length) % length;
  return Math.min(Math.abs(forward), Math.abs(backward)) > SWOOSH_PACE_TUNING.jumpMetres;
}

function pruneLive(audioNow) {
  for (const [id, entry] of live) {
    if (entry.endsAt <= audioNow) live.delete(id);
  }
}

// Stop every swoosh not yet finished; its bend is re-armed, so it plays again if the car
// is still before it once cues may play.
function cancelLive(reason) {
  if (!live.size) return;
  for (const [id, entry] of live) {
    entry.handle.stop();
    live.delete(id);
    record(entry.segment, 'cancelled', { reason });
    delivery.delete(id);
  }
  nextFreeAt = 0;
  lastEndsAt = -Infinity;
  (channel || globalThis.__turnRouteAudio)?.releaseMix?.();
}

/** Stop everything and forget this approach (pause, reset, track change, respawn). */
export function resetSwooshDelivery(reason = 'reset') {
  cancelLive(reason);
  delivery.clear();
  lastDistance = null;
  nextFreeAt = 0;
  lastEndsAt = -Infinity;
}

/** Swoosh peak for a Sound balance (0 other sounds … 1 Drive By Ear). */
export function swooshLevel(balance, tuning = SWOOSH_PACE_TUNING) {
  const value = Number.isFinite(Number(balance)) ? Number(balance) : tuning.defaultBalance;
  const focus = Math.min(1, Math.max(0, (value - tuning.defaultBalance) / (tuning.focusBalance - tuning.defaultBalance)));
  return tuning.level + (tuning.focusLevel - tuning.level) * focus;
}

function routeCuesEnabled() {
  const settings = globalThis.__turnAudioPreferences?.getSettings?.();
  return globalThis.__turnDriveByEarEnabled !== false
    && settings?.audioEnabled !== false
    && settings?.dbeEnabled !== false;
}
