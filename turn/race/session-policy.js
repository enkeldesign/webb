// What a race session may change outside itself (#1131). Ordinary TURN changes
// everything. A reward preview (PATROL, EXCURSION) and a tutorial teaching lap are
// trials: they earn no achievements, progress or records. A teaching lap still
// becomes a ghost, the player's own lap to catch, but only for that run.
//
// ghost: 'saved'   the lap joins the rivals and is stored
//        'session' the lap joins the rivals for this run only (never stored)
//        'none'    the lap does not become a rival
const policy = (fields) => Object.freeze({ graduatesTo: null, ...fields });

export const SESSION_POLICY = Object.freeze({
  normal: policy({ id: 'normal', achievements: true, progress: true, challenges: true, records: true, ghost: 'saved' }),
  // The preview's own PATROL/EXCURSION challenge still completes and pays out.
  rewardPreview: policy({ id: 'reward-preview', achievements: false, progress: false, challenges: true, records: false, ghost: 'none' }),
  // Ordinary racing after a replayed tutorial graduates. The borrowed track's stored
  // rivals were set aside for the teaching lap, so nothing is written over them.
  sandbox: policy({ id: 'sandbox', achievements: true, progress: true, challenges: true, records: true, ghost: 'session' })
});

// The teaching lap. Crossing the line switches to `graduatesTo` once every lap-result
// listener has seen the teaching lap, so the next lap is fully eligible.
export function tutorialLapPolicy({ replay = false } = {}) {
  return policy({
    id: 'tutorial-lap',
    achievements: false,
    progress: false,
    challenges: false,
    records: false,
    ghost: 'session',
    graduatesTo: replay ? 'sandbox' : 'normal'
  });
}

export function sessionPolicy(state) {
  if (state?.rewardPreview) return SESSION_POLICY.rewardPreview;
  return state?.sessionPolicy || SESSION_POLICY.normal;
}

export function activeSessionPolicy() {
  return sessionPolicy(globalThis.__turnRuntime?.state);
}

// Called by the lap system after a completed lap has been published. Returns the
// policy the run continues under, or null when nothing changed.
export function graduateSessionPolicy(state) {
  const next = state?.sessionPolicy?.graduatesTo;
  if (!next) return null;
  state.sessionPolicy = next === 'normal' ? null : SESSION_POLICY[next];
  return sessionPolicy(state);
}
