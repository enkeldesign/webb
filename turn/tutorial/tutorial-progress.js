// Hands-on tutorials (#1130, #1131): one persistent lifecycle for TURN TUTORIAL and
// the later DRIFT ATTACK, SHIFT and FLOW modules.
//
// A module is not started, in progress or completed. Skipping a tutorial turns its
// reminders off; it is not completion, and the tutorial stays in HOW TO PLAY.
export const TUTORIAL_STORAGE_KEY = 'turn-tutorials-v1';
const STORAGE_VERSION = 1;

export const TUTORIAL_STATUS = Object.freeze({
  NOT_STARTED: 'not-started',
  IN_PROGRESS: 'in-progress',
  COMPLETED: 'completed'
});

// Dispatched at the line when a tutorial is completed: { id, revision, firstCompletion }.
export const TUTORIAL_COMPLETED_EVENT = 'turn:tutorial-completed';

export const TURN_TUTORIAL = Object.freeze({
  id: 'turn-tutorial',
  // Raise only for a revised tutorial. A player who completed any revision is never
  // put through onboarding again.
  revision: 1,
  trackId: 'countryside',
  // The LEARNER CAR.
  vehicleId: 'classic'
});

// DRIFT ATTACK TUTORIAL (#1150): DRIFT scoring and OVERCHARGE, offered once DRIFT ATTACK
// unlocks. The track and car are a first choice, to be confirmed on devices: COUNTRYSIDE's
// long bends leave room to fill BOOST, build OVERCHARGE, then catch and spend it.
export const DRIFT_ATTACK_TUTORIAL = Object.freeze({
  id: 'drift-attack',
  revision: 1,
  trackId: 'countryside',
  vehicleId: 'classic'
});

const STATUSES = new Set(Object.values(TUTORIAL_STATUS));

function normalizeRecord(raw) {
  const status = STATUSES.has(raw?.status) ? raw.status : TUTORIAL_STATUS.NOT_STARTED;
  return {
    status,
    remindersOff: raw?.remindersOff === true,
    completedRevision: status === TUTORIAL_STATUS.COMPLETED
      ? Math.max(0, Math.floor(Number(raw?.completedRevision) || 0))
      : 0,
    // Completed by the first-read rule below, not by playing the tutorial.
    migrated: raw?.migrated === true
  };
}

function readModules(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem?.(TUTORIAL_STORAGE_KEY) || 'null');
    if (parsed?.version !== STORAGE_VERSION || typeof parsed.modules !== 'object' || !parsed.modules) return {};
    return Object.fromEntries(Object.entries(parsed.modules).map(([id, record]) => [id, normalizeRecord(record)]));
  } catch {
    return {};
  }
}

// Anyone who finished a lap or earned a trophy before TURN TUTORIAL existed already
// knows how to play. This is decided when the tutorial is first considered, not when
// the module loads, so a profile is judged at the moment the tutorial is offered.
export function hasPlayedBefore(achievements = globalThis.__turnAchievements) {
  const store = achievements?.store;
  return Boolean(store?.isUnlocked?.('first-turn') || Number(store?.trophyTotal?.()) > 0);
}

export function createTutorialProgress({
  storage = globalThis.localStorage,
  hasPlayed = () => hasPlayedBefore()
} = {}) {
  const modules = readModules(storage);

  function save() {
    try {
      storage?.setItem?.(TUTORIAL_STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, modules }));
    } catch {
      // Storage blocked: the lifecycle still holds for this page.
    }
  }

  function record(id) {
    if (modules[id]) return modules[id];
    if (id === TURN_TUTORIAL.id && hasPlayed()) {
      modules[id] = normalizeRecord({ status: TUTORIAL_STATUS.COMPLETED, migrated: true });
      save();
      return modules[id];
    }
    return normalizeRecord(null);
  }

  function update(id, change) {
    modules[id] = normalizeRecord({ ...record(id), ...change });
    save();
    return { ...modules[id] };
  }

  return Object.freeze({
    get: (id) => ({ ...record(id) }),
    status: (id) => record(id).status,
    // A new player's first launch of TURN starts the tutorial, and so does every later
    // launch until they finish it or stop it.
    startsOnLaunch(id) {
      const current = record(id);
      return current.status !== TUTORIAL_STATUS.COMPLETED && !current.remindersOff;
    },
    // Entering the tutorial, first run or replay. A completed tutorial stays completed.
    begin(id) {
      const current = record(id);
      if (current.status === TUTORIAL_STATUS.COMPLETED) return { ...current };
      return update(id, { status: TUTORIAL_STATUS.IN_PROGRESS });
    },
    // Returns true only for the first completion, which is the one that is rewarded.
    complete(id, revision = 1) {
      const first = record(id).status !== TUTORIAL_STATUS.COMPLETED;
      update(id, {
        status: TUTORIAL_STATUS.COMPLETED,
        completedRevision: Math.max(record(id).completedRevision, revision),
        remindersOff: false
      });
      return first;
    },
    // SKIP TUTORIAL: no more automatic starts. The tutorial stays in HOW TO PLAY.
    stop(id) {
      return update(id, { remindersOff: true });
    }
  });
}
