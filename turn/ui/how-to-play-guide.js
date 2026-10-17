import {
  HOW_TO_PLAY_DISCLOSURE_IDS,
  HOW_TO_PLAY_DISCLOSURE_OPENED_EVENT,
  LEARNING_FEEDBACK_READY_EVENT
} from '../achievements/learning-progress.js?revision=r1-learning-achievements';
import { isOverchargeAvailable } from '../progression/overcharge-unlock.js';
import {
  TROPHY_ROAD_REWARDS,
  TROPHY_ROAD_REWARD_ICONS,
  isTrophyRoadRewardUnlocked
} from '../progression/trophy-road.js';
import { ROTATE_DEVICE_ICON } from './race-orientation.js';
import {
  createDrivePadDemo,
  createManualSteerDemo,
  createRivalsDemo,
  createScoreDemo,
  createSteerDemo
} from './how-to-play-demos.js';

// HOW TO PLAY (#748, #1130): after the tutorials, a QUICK REFERENCE of what every player
// has, each card one real control acted out and a few lines about TURN only; then what
// the Trophy Road unlocks, taught once the player has it and named, with where it
// unlocks, before then. The five QUICK REFERENCE parts are what LEARN TO PLAY counts.
const GUIDE_VERSION = 'r442-how-to-play-remake';
const PACE_NOTE_EXPLANATION = "Pace notes are swipes. Before every bend, a swipe travels out to the ear on the bend's side and ends before the bend begins. Higher pitch means a tighter bend, a quick swipe a short bend and a slower swipe a long one. A bend of more than 120° is told as linked swipes, and bends that follow each other link into one phrase in the order you will meet them. Pace notes need stereo: use headphones or hold the device so both speakers face you.";

// Pictograms in the stroke style of Trophy Road's FLOW icon, where the game has no icon.
const DRIVE_PAD_ICON = '<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><rect x="11" y="4" width="26" height="40" rx="7"></rect><path d="M11 17h26M24 4v13M11 33h26"></path></svg>';
const BOOST_BAR_ICON = '<svg viewBox="0 0 64 48" aria-hidden="true" focusable="false"><rect x="3" y="14" width="58" height="20" rx="10"></rect><path d="M13 24h22M45 24h6" stroke-width="7"></path></svg>';

// STEER teaches the steering the player has chosen in SETTINGS (m8-home.js).
const STEER_CARD = Object.freeze({
  id: 'turn-device-to-steer',
  title: 'STEER',
  icon: ROTATE_DEVICE_ICON,
  demo: Object.freeze({ motion: createSteerDemo, manual: createManualSteerDemo }),
  body: Object.freeze({
    motion: `
      <p>Turn the device like a steering wheel. When a race starts, hold it the way you like to drive: that becomes straight ahead. <strong>RECALIBRATE</strong> sets it again at any time.</p>
      <p>Rather not tilt? Choose <strong>On-screen steering</strong> in SETTINGS.</p>`,
    manual: `
      <p>Drag the <strong>steering control</strong> left and right with one thumb while the other drives. With a keyboard, the arrow keys or A and D steer.</p>
      <p>Rather turn the device? Choose <strong>Device rotation</strong> in SETTINGS.</p>`
  })
});

const QUICK_REFERENCE = Object.freeze([
  Object.freeze({
    id: 'drive-with-one-thumb',
    title: 'DRIVE PAD',
    icon: DRIVE_PAD_ICON,
    demo: (documentRef) => createDrivePadDemo('drive', documentRef),
    body: `
      <p>Keep one thumb on the pad and slide between <strong>GAS</strong>, <strong>DRIFT</strong>, <strong>BOOST</strong> and <strong>BRAKE</strong>.</p>
      <p>While using DRIFT, slide outward past it into <strong>LOCK</strong> for a stronger slide. BRAKE stops at zero without reversing; to back up, hold BRAKE and slide outward into <strong>REVERSE</strong>.</p>
      <p>Staying on the track is <strong>clean driving</strong>, which some perks and achievements reward.</p>`
  })
]);

// BOOST is everyone's; OVERCHARGE arrives with DRIFT ATTACK (progression/overcharge-unlock.js),
// so the card shows BOOST alone until then.
const BOOST_CARD = Object.freeze({
  id: 'build-and-use-overcharge',
  icon: BOOST_BAR_ICON,
  title: Object.freeze({ boost: 'BOOST', overcharge: 'BOOST AND OVERCHARGE' }),
  demo: Object.freeze({
    boost: (documentRef) => createDrivePadDemo('boost', documentRef),
    overcharge: (documentRef) => createDrivePadDemo('overcharge', documentRef)
  }),
  body: Object.freeze({
    boost: `
      <p><strong>DRIFT</strong> fills <strong>BOOST</strong> as you slide. Slide to BOOST to spend it as a burst of speed.</p>
      <p class="m8-guide-note"><strong>OVERCHARGE unlocks with DRIFT ATTACK</strong> on the Trophy Road.</p>`,
    overcharge: `
      <ol class="m8-overcharge-steps">
        <li><strong>FILL</strong><span>DRIFT fills BOOST.</span></li>
        <li><strong>BUILD</strong><span>On a full bar, keep using DRIFT: purple OVERCHARGE grows past it.</span></li>
        <li><strong>CATCH</strong><span>Slide to GAS before it leaks away, and stay on GAS to hold it.</span></li>
        <li><strong>SPEND</strong><span>Slide to BOOST. OVERCHARGE burns first, as a stronger burst called KICK.</span></li>
      </ol>
      <p class="m8-overcharge-leak"><strong>WATCH THE PEAK</strong> At its peak, uncaught OVERCHARGE leaks even while you keep using DRIFT.</p>`
  })
});

const RIVALS_CARD = Object.freeze({
  id: 'choose-track-and-car',
  title: 'RIVALS',
  icon: TROPHY_ROAD_REWARD_ICONS.race,
  demo: createRivalsDemo,
  body: `
    <p>You race recordings of your own fastest laps, not computer drivers. <strong>POSITION</strong> shows your place among them, and <strong>BEST</strong> your record.</p>
    <p>Beat them and your new laps take their place. The <strong>Track sheet</strong> keeps your records for every track.</p>`
});

const FLOW_COMBOS_DISCLOSURE = `
  <details class="m8-guide-disclosure m8-overcharge-guide" data-how-to-play-disclosure="flow-combos">
    <summary><span class="m8-disclosure-symbol" aria-hidden="true"></span><span>FLOW techniques and combos</span></summary>
    <div class="m8-guide-disclosure-panel">
      <ul class="m8-overcharge-steps">
        <li><strong>DRIFT</strong><span>Bank a slide. Longer, stronger slides earn more.</span></li>
        <li><strong>LOCK</strong><span>Use LOCK in a slide you bank.</span></li>
        <li><strong>EXIT</strong><span>Straighten out, or link into the next slide, after at least 0.7 seconds of drifting.</span></li>
        <li><strong>BOOST</strong><span>BOOST that gains speed. OVERCHARGE makes it worth more.</span></li>
        <li><strong>CATCH</strong><span>Catch OVERCHARGE on GAS.</span></li>
        <li><strong>SHIFT</strong><span>SHIFT just before it helps: DRIFT or CONTROL into a slide, speed or BOOST before a BOOST, acceleration out of a bend.</span></li>
      </ul>
      <p class="m8-overcharge-leak"><strong>COMBOS</strong> Each different technique within 5 seconds of the last raises COMBO, up to ×8. Repeating one adds little, and a lost slide breaks the chain. For example:</p>
      <ul class="m8-flow-combos">
        <li><strong>DRIFT, EXIT, BOOST</strong>Slide through a bend, straighten out cleanly, then BOOST away.</li>
        <li><strong>LOCK, DRIFT, EXIT, CATCH, BOOST</strong>With BOOST full, LOCK a long slide to build OVERCHARGE, straighten out onto GAS to catch it, then spend it.</li>
        <li><strong>SHIFT, DRIFT, EXIT, SHIFT, BOOST</strong>SHIFT into a drifting setup before the bend, slide out of it, then SHIFT back and BOOST away.</li>
      </ul>
    </div>
  </details>`;

// In the order the Trophy Road unlocks them.
const TROPHY_ROAD_CARDS = Object.freeze([
  Object.freeze({
    id: 'drift-points',
    rewardId: 'drift-attack',
    title: 'DRIFT ATTACK',
    icon: TROPHY_ROAD_REWARD_ICONS.drift,
    teaser: 'Score your slides, and build OVERCHARGE past a full BOOST bar.',
    demo: (documentRef) => createScoreDemo('drift', documentRef),
    body: `
      <p><strong>DRIFT ATTACK</strong> scores your slides: stronger, faster, controlled slides score more. The big number is the slide at risk. Exit cleanly to <strong>BANK</strong> it; a failed slide loses it, but never what you have banked. Link slides to raise <strong>COMBO</strong>.</p>
      <p><strong>LAP</strong> is this lap, <strong>LAST</strong> your previous lap and <strong>BEST</strong> your record on this track.</p>`
  }),
  Object.freeze({
    id: 'shift',
    rewardId: 'shift',
    title: 'SHIFT',
    icon: TROPHY_ROAD_REWARD_ICONS.shift,
    teaser: 'Switch every car between two setups during a race.',
    demo: (documentRef) => createDrivePadDemo('shift', documentRef),
    body: `
      <p><strong>SHIFT</strong> switches your car between two setups: its normal attributes and the SHIFT setup you make in <strong>GARAGE</strong>.</p>
      <p>In a race, slide from GAS out into SHIFT to switch, and again to switch back. Switch for what comes next: DRIFT or CONTROL into a bend, acceleration or BOOST out of it.</p>`
  }),
  Object.freeze({
    id: 'flow-points',
    rewardId: 'flow',
    title: 'FLOW',
    icon: TROPHY_ROAD_REWARD_ICONS.flow,
    teaser: 'Score for linking different techniques.',
    demo: (documentRef) => createScoreDemo('flow', documentRef),
    body: `
      <p><strong>FLOW</strong> scores linking different techniques, each at a moment it helps. Mix them to raise <strong>COMBO</strong>; repeating one adds little. <strong>LAP</strong>, <strong>LAST</strong> and <strong>BEST</strong> work as in DRIFT ATTACK.</p>
      ${FLOW_COMBOS_DISCLOSURE}`
  })
]);

export function installHowToPlayGuide(root = document) {
  const dialog = root.querySelector('.m8-how-dialog');
  const grid = dialog?.querySelector('.m8-guide-grid');
  if (!dialog || !grid) return false;
  if (dialog.dataset.guideVersion === GUIDE_VERSION) return true;

  buildGuide(dialog, grid);
  installStateSync(dialog);
  installDisclosureProgress(dialog);
  installLearningFeedbackRelease(dialog, 'how-to-play');
  updateAudioPanelCopy(root);

  dialog.dataset.guideVersion = GUIDE_VERSION;
  document.documentElement.dataset.turnHowToPlayGuide = GUIDE_VERSION;
  return true;
}

function buildGuide(dialog, grid) {
  const documentRef = dialog.ownerDocument;
  grid.replaceChildren(
    sectionTitle(documentRef, 'm8QuickReferenceTitle', 'QUICK REFERENCE'),
    variantCard(documentRef, STEER_CARD, 'data-steer-guide'),
    ...QUICK_REFERENCE.map((card) => guideCard(documentRef, card)),
    variantCard(documentRef, BOOST_CARD, 'data-boost-guide'),
    guideCard(documentRef, RIVALS_CARD),
    driveByEarCard(documentRef),
    sectionTitle(documentRef, 'm8TrophyRoadTitle', 'ON THE TROPHY ROAD'),
    ...TROPHY_ROAD_CARDS.flatMap((card) => [guideCard(documentRef, card), lockedCard(documentRef, card)])
  );
}

function sectionTitle(documentRef, id, text) {
  const title = documentRef.createElement('h3');
  title.className = 'm8-guide-section-title';
  title.id = id;
  title.textContent = text;
  return title;
}

// A disclosure card: the icon (decorative: the title names the card), the title, and a
// panel with the card's demo above its text.
function guideCard(documentRef, { id, title, icon, demo, body }) {
  const shell = documentRef.createElement('section');
  shell.className = 'm8-guide-card-shell';
  shell.dataset.guideTopic = id;
  shell.innerHTML = `
    <details class="m8-guide-card-disclosure" data-how-to-play-disclosure="${id}">
      <summary><strong class="m8-guide-card-number has-icon" aria-hidden="true">${icon}</strong><span class="m8-guide-card-title" role="heading" aria-level="4">${title}</span></summary>
      <div class="m8-guide-card-panel">${body}</div>
    </details>`;
  if (demo) shell.querySelector('.m8-guide-card-panel').prepend(demo(documentRef));
  return shell;
}

// A card with one version per state (steering mode, OVERCHARGE), each with its demo;
// the sync below shows the one that applies.
function variantCard(documentRef, card, attribute) {
  const kinds = Object.keys(card.body);
  const title = typeof card.title === 'string' ? card.title : card.title[kinds[0]];
  const shell = guideCard(documentRef, {
    ...card,
    title,
    demo: null,
    body: kinds.map((kind) => `<div ${attribute}="${kind}">${card.body[kind]}</div>`).join('')
  });
  for (const kind of kinds) shell.querySelector(`[${attribute}="${kind}"]`).prepend(card.demo[kind](documentRef));
  return shell;
}

// Before the Trophy Road unlocks it: what it is and where it unlocks, without teaching it.
function lockedCard(documentRef, { id, rewardId, title, icon, teaser }) {
  const threshold = TROPHY_ROAD_REWARDS.find((reward) => reward.id === rewardId)?.threshold;
  const row = documentRef.createElement('section');
  row.className = 'm8-guide-locked';
  row.dataset.guideLocked = id;
  row.innerHTML = `
    <strong class="m8-guide-card-number has-icon" aria-hidden="true">${icon}</strong>
    <div>
      <span class="m8-guide-card-title" role="heading" aria-level="4">${title}</span>
      <p>${teaser}</p>
      <p class="m8-guide-locked-at" aria-hidden="true">LOCKED · ${threshold} TROPHIES</p>
      <p class="turn-sr-only">Unlocks at ${threshold} trophies on the Trophy Road.</p>
    </div>`;
  return row;
}

function driveByEarCard(documentRef) {
  const section = documentRef.createElement('section');
  section.className = 'm8-guide-wide';
  section.innerHTML = `
    <strong aria-hidden="true">♪</strong>
    <div>
      <h4>Drive By Ear™</h4>
      <p>Drive By Ear turns the racing line, upcoming corners, grip, surfaces, recovery and nearby rivals into spatial sound. Steer toward the warm guiding hum. Headphones provide the clearest left and right information. Together with a screen reader, it is designed to support complete non-visual play.</p>

      <details class="m8-dbe-guide" data-how-to-play-disclosure="drive-by-ear-sounds">
        <summary><span class="m8-disclosure-symbol" aria-hidden="true"></span><span>Explore the Drive By Ear sounds</span></summary>
        <div class="m8-dbe-guide-panel">
          <div class="m8-dbe-guide-content">
            <p class="m8-dbe-guide-intro">The sounds have different jobs. Guidance tells you where to steer, pace notes tell you what is coming next, and car or surface sounds tell you what is happening now.</p>

            <div class="m8-dbe-guide-basics" aria-labelledby="m8DbeBasics">
              <h5 id="m8DbeBasics">Start here</h5>
              <ul>
                <li>Use headphones and begin at a comfortable speed.</li>
                <li>Steer <strong>toward</strong> the warm guiding hum.</li>
                <li>Listen to pace notes before bends. The ear gives the direction and the pitch gives the tightness.</li>
                <li>Engine, tyre, BOOST and gravel sounds describe the car or surface. They are not steering instructions.</li>
              </ul>
            </div>

            <div class="m8-dbe-guide-section" aria-labelledby="m8DbeRibbon">
              <h5 id="m8DbeRibbon">Guiding ribbon</h5>
              <p>A warm organic hum points toward the side you should steer toward. It combines your position with where the moving car is likely to go. As the trajectory becomes safer, the hum settles closer to the centre and softens. At higher speed it looks farther ahead, so smooth corrections work better than chasing every tiny movement.</p>
            </div>

            <div class="m8-dbe-guide-section" aria-labelledby="m8DbePaceNotes">
              <h5 id="m8DbePaceNotes">Pace notes</h5>
              <p>${PACE_NOTE_EXPLANATION}</p>
            </div>

            <div class="m8-dbe-guide-section" aria-labelledby="m8DbeDrift">
              <h5 id="m8DbeDrift">Drift and grip</h5>
              <p>Tyre noise stays centred. As the car loses more grip, the sound spreads wider across both ears. This describes how much the car is sliding without becoming a second left or right instruction.</p>
            </div>

            <div class="m8-dbe-guide-section" aria-labelledby="m8DbePower">
              <h5 id="m8DbePower">Engine and BOOST</h5>
              <p>Engine and BOOST sounds stay centred. A rising burst confirms that BOOST starts, while a separate empty cue tells you the charge is gone. These are status sounds, not steering guidance.</p>
            </div>

            <div class="m8-dbe-guide-section" aria-labelledby="m8DbeRecovery">
              <h5 id="m8DbeRecovery">Off-road recovery</h5>
              <p>Centred gravel marks that the car is off road. The guiding hum changes to recovery guidance and points toward a useful place to rejoin, rather than simply the nearest edge. Steer toward the hum until normal on-road guidance returns.</p>
            </div>

            <div class="m8-dbe-guide-section" aria-labelledby="m8DbeRivals">
              <h5 id="m8DbeRivals">Nearby rivals</h5>
              <p>A short directional cue sounds when a rival comes close. It plays from the side of the nearby car. Treat it as a heads-up rather than a continuous tracker.</p>
            </div>

            <div class="m8-dbe-guide-section" aria-labelledby="m8DbeWrongWay">
              <h5 id="m8DbeWrongWay">Wrong way</h5>
              <p>A repeating low double falling tone confirms that you are facing the wrong direction. A final side tone indicates which way to turn. Continue turning until the regular guiding ribbon returns.</p>
            </div>

            <div class="m8-dbe-guide-section m8-dbe-guide-screen-reader" aria-labelledby="m8DbeScreenReader">
              <h5 id="m8DbeScreenReader">With a screen reader</h5>
              <p>Drive By Ear is designed to work alongside screen readers. The screen reader presents menus, controls, continuous position updates and lap results; Drive By Ear supplies the spatial information needed to steer and stay on course. Together they are intended to provide a complete non-visual way to play TURN.</p>
            </div>
          </div>
        </div>
      </details>
    </div>`;
  return section;
}

function rewardUnlocked(rewardId) {
  try {
    return isTrophyRoadRewardUnlocked(rewardId);
  } catch (_) {
    return false;
  }
}

function overchargeUnlocked() {
  try {
    return isOverchargeAvailable();
  } catch (_) {
    return true;
  }
}

// The steering chosen in SETTINGS, read as m8-home.js reads it: on-screen when chosen or
// when the device has no motion sensors, otherwise device rotation.
function steeringMode() {
  try {
    if (globalThis.localStorage?.getItem('turn-steering-mode-v1') === 'manual') return 'manual';
  } catch (_) {}
  return typeof globalThis.DeviceMotionEvent === 'undefined' ? 'manual' : 'motion';
}

function showVariant(card, attribute, kind) {
  for (const part of card?.querySelectorAll(`[${attribute}]`) || []) part.hidden = part.getAttribute(attribute) !== kind;
}

// Each time HOW TO PLAY opens, and whenever the Trophy Road changes.
function installStateSync(dialog) {
  const sync = () => {
    for (const { id, rewardId } of TROPHY_ROAD_CARDS) {
      const unlocked = rewardUnlocked(rewardId);
      const card = dialog.querySelector(`[data-guide-topic="${id}"]`);
      const locked = dialog.querySelector(`[data-guide-locked="${id}"]`);
      if (card) card.hidden = !unlocked;
      if (locked) locked.hidden = unlocked;
    }
    showVariant(dialog.querySelector(`[data-guide-topic="${STEER_CARD.id}"]`), 'data-steer-guide', steeringMode());
    const boostKind = overchargeUnlocked() ? 'overcharge' : 'boost';
    const boost = dialog.querySelector(`[data-guide-topic="${BOOST_CARD.id}"]`);
    if (!boost) return;
    boost.querySelector('.m8-guide-card-title').textContent = BOOST_CARD.title[boostKind];
    showVariant(boost, 'data-boost-guide', boostKind);
  };
  sync();
  dialog.addEventListener('toggle', sync);
  globalThis.addEventListener?.('turn:trophy-road-updated', sync);
}

function installDisclosureProgress(dialog) {
  const expectedIds = new Set(HOW_TO_PLAY_DISCLOSURE_IDS);
  const disclosures = dialog.querySelectorAll('details[data-how-to-play-disclosure]');
  for (const details of disclosures) {
    const disclosureId = details.dataset.howToPlayDisclosure;
    if (!expectedIds.has(disclosureId)) continue;
    details.addEventListener('toggle', () => {
      if (!details.open) return;
      globalThis.dispatchEvent(new CustomEvent(HOW_TO_PLAY_DISCLOSURE_OPENED_EVENT, {
        detail: Object.freeze({ disclosureId })
      }));
    });
  }
}

function installLearningFeedbackRelease(dialog, source) {
  dialog.addEventListener('close', () => {
    globalThis.dispatchEvent(new CustomEvent(LEARNING_FEEDBACK_READY_EVENT, {
      detail: Object.freeze({ source })
    }));
  });
}

function updateAudioPanelCopy(root) {
  const paceHeading = root.querySelector('#dbeGuidePaceNotes');
  const paceParagraph = paceHeading?.parentElement?.querySelector('p');
  if (paceParagraph) paceParagraph.textContent = PACE_NOTE_EXPLANATION;

  const screenReaderHeading = root.querySelector('#dbeGuideScreenReaders');
  const screenReaderParagraph = screenReaderHeading?.parentElement?.querySelector('p');
  if (screenReaderParagraph) {
    screenReaderParagraph.textContent = 'Drive By Ear is designed to work alongside screen readers, including VoiceOver. The screen reader presents menus, controls, race position and lap results; Drive By Ear provides the continuous spatial information needed to steer and stay on course. Together they are intended to provide a complete non-visual way to play TURN, from choosing a car and track to completing a race.';
  }
}
