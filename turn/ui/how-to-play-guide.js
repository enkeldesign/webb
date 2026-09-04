const GUIDE_VERSION = 'r221-scoring-links';
const HOW_TO_PLAY_OPEN_EVENT = 'turn:open-how-to-play';
const PACE_NOTE_EXPLANATION = 'Before major corners, one to three beeps play in the ear on the turn side. One beep means a gentler corner, two means medium and three means tight. A long corner keeps the same number of beeps but holds the final beep longer: bip-beeeep for a long medium corner and bip-bip-beeeep for a long tight corner. Separate groups describe linked corners in the order you will meet them.';

const TARGET_SECTION_ID = Object.freeze({
  shift: 'm8HowShift',
  drift: 'm8HowDriftPoints',
  flow: 'm8HowFlowPoints'
});

export function installHowToPlayGuide(root = document) {
  const dialog = root.querySelector('.m8-how-dialog');
  if (!dialog) return false;
  if (dialog.dataset.guideVersion === GUIDE_VERSION) return true;

  updateDriveControlCopy(dialog);
  updateDriftAndBoostCopy(dialog);
  installShiftAndScoringSections(dialog);
  installDriveByEarDisclosure(dialog);
  installTargetedOpening(dialog);
  updateAudioPanelCopy(root);

  dialog.dataset.guideVersion = GUIDE_VERSION;
  document.documentElement.dataset.turnHowToPlayGuide = GUIDE_VERSION;
  return true;
}

function updateDriveControlCopy(dialog) {
  const section = findGuideSection(dialog, 'Drive with one thumb');
  const paragraph = section?.querySelector('p');
  if (!paragraph) return;

  paragraph.innerHTML = 'Keep one thumb on the drive pad and slide between <strong>GAS</strong>, <strong>DRIFT</strong>, <strong>BOOST</strong> and <strong>BRAKE · REVERSE</strong>. While using DRIFT, slide outward past it into <strong>LOCK</strong> for a stronger slide.';
}

function updateDriftAndBoostCopy(dialog) {
  const section = findGuideSection(dialog, 'Build and use OVERCHARGE')
    || findGuideSection(dialog, 'Use Drift and Boost wisely');
  const content = section?.querySelector('div');
  if (!content) return;

  content.innerHTML = `
    <h3>Build and use OVERCHARGE</h3>
    <p><strong>DRIFT</strong> charges <strong>BOOST</strong> as you slide. With BOOST full, keep using DRIFT to build purple <strong>OVERCHARGE</strong>.</p>
    <details class="m8-guide-disclosure m8-overcharge-guide">
      <summary><span class="m8-disclosure-symbol" aria-hidden="true"></span><span>How to catch and use OVERCHARGE</span></summary>
      <div class="m8-guide-disclosure-panel">
        <ol class="m8-overcharge-steps">
          <li><strong>BUILD</strong><span>With BOOST full, keep using DRIFT.</span></li>
          <li><strong>CATCH</strong><span>Slide to GAS before OVERCHARGE leaks away.</span></li>
          <li><strong>HOLD</strong><span>Stay on GAS to hold the OVERCHARGE you caught.</span></li>
          <li><strong>SPEND</strong><span>Slide to BOOST. OVERCHARGE is spent before normal BOOST.</span></li>
        </ol>
        <p class="m8-overcharge-leak"><strong>WATCH THE PEAK</strong> Uncaught OVERCHARGE leaks. At its peak, it starts leaking even while you keep using DRIFT.</p>
      </div>
    </details>`;
}

function makeGuideSection(dialog, { number, id, target, title, copy }) {
  const section = dialog.ownerDocument.createElement('section');
  section.className = 'm8-guide-system';
  section.dataset.howToPlayTarget = target;
  section.innerHTML = `
    <strong>${number}</strong>
    <div>
      <h3 id="${id}" tabindex="-1">${title}</h3>
      <p>${copy}</p>
    </div>`;
  return section;
}

function installShiftAndScoringSections(dialog) {
  const grid = dialog.querySelector('.m8-guide-grid');
  const before = grid?.querySelector('.m8-guide-wide');
  if (!grid || !before) return;

  for (const existing of grid.querySelectorAll('.m8-guide-system')) existing.remove();

  const shift = makeGuideSection(dialog, {
    number: '5',
    id: TARGET_SECTION_ID.shift,
    target: 'shift',
    title: 'SHIFT',
    copy: '<strong>SHIFT</strong> swaps between your car’s normal attributes and the alternate setup you configured in <strong>THE LOT</strong>. It redistributes attribute points — it does not add free power. During a race, slide from GAS into SHIFT to swap setup, then SHIFT again to return. Trade for what you need next: for example more DRIFT or CONTROL into a slide, or more acceleration and BOOST performance on the exit.'
  });
  const drift = makeGuideSection(dialog, {
    number: '6',
    id: TARGET_SECTION_ID.drift,
    target: 'drift',
    title: 'DRIFT POINTS',
    copy: '<strong>DRIFT POINTS</strong> reward strong, fast, controlled slides — not pressing DRIFT. The large live number is the current drift value at risk and the gauge shows how strongly it is scoring right now. Link drifts to raise <strong>COMBO</strong>. A clean exit <strong>BANKS</strong> the current drift; a failed drift can lose the unbanked points without erasing points already banked this lap. <strong>LAP</strong> is this lap, <strong>LAST</strong> is your previous completed lap and <strong>BEST</strong> is the saved record for this track.'
  });
  const flow = makeGuideSection(dialog, {
    number: '7',
    id: TARGET_SECTION_ID.flow,
    target: 'flow',
    title: 'FLOW POINTS',
    copy: '<strong>FLOW POINTS</strong> reward useful choreography between systems such as SHIFT, BOOST, DRIFT, LOCK, OVERCHARGE catches and clean exits. Button presses alone score nothing. Variety and useful timing build <strong>COMBO</strong>; repeating the same idea adds less and mistakes can break the chain. The gauge shows your current FLOW momentum. <strong>LAP</strong> is this lap, <strong>LAST</strong> is your previous completed lap and <strong>BEST</strong> is the saved record for this track.'
  });

  grid.insertBefore(shift, before);
  grid.insertBefore(drift, before);
  grid.insertBefore(flow, before);
}

function installTargetedOpening(dialog, eventTarget = globalThis) {
  if (dialog.dataset.targetedHelp === 'scoring-v1') return;
  dialog.dataset.targetedHelp = 'scoring-v1';

  const openTarget = (target, trigger = null) => {
    const id = TARGET_SECTION_ID[String(target || '').toLowerCase()];
    const heading = id ? dialog.querySelector(`#${id}`) : null;
    const section = heading?.closest?.('[data-how-to-play-target]');
    if (!heading || !section) return false;

    dialog.__turnReturnFocus = trigger || eventTarget.document?.activeElement || null;
    if (!dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    }

    heading.focus?.({ preventScroll: true });
    section.scrollIntoView?.({ behavior: 'auto', block: 'center', inline: 'nearest' });
    return true;
  };

  eventTarget.addEventListener?.(HOW_TO_PLAY_OPEN_EVENT, (event) => {
    openTarget(event?.detail?.section, event?.detail?.trigger || null);
  });

  globalThis.__turnOpenHowToPlaySection = openTarget;
}

function installDriveByEarDisclosure(dialog) {
  const section = dialog.querySelector('.m8-guide-wide');
  if (!section) return;

  section.innerHTML = `
    <strong aria-hidden="true">♪</strong>
    <div>
      <h3>Drive By Ear™</h3>
      <p>Drive By Ear turns the racing line, upcoming corners, grip, surfaces, recovery and nearby rivals into spatial sound. Steer toward the warm guiding hum. Headphones provide the clearest left and right information. Together with a screen reader, it is designed to support complete non-visual play.</p>

      <details class="m8-dbe-guide">
        <summary><span class="m8-disclosure-symbol" aria-hidden="true"></span><span>Explore the Drive By Ear sounds</span></summary>
        <div class="m8-dbe-guide-panel">
          <div class="m8-dbe-guide-content">
            <p class="m8-dbe-guide-intro">The sounds have different jobs. Guidance tells you where to steer, pace notes tell you what is coming next, and car or surface sounds tell you what is happening now.</p>

            <div class="m8-dbe-guide-basics" aria-labelledby="m8DbeBasics">
              <h4 id="m8DbeBasics">Start here</h4>
              <ul>
                <li>Use headphones and begin at a comfortable speed.</li>
                <li>Steer <strong>toward</strong> the warm guiding hum.</li>
                <li>Listen to pace notes before corners. The ear gives the direction and the beep count gives the severity.</li>
                <li>Engine, tyre, BOOST and gravel sounds describe the car or surface. They are not steering instructions.</li>
              </ul>
            </div>

            <div class="m8-dbe-guide-section" aria-labelledby="m8DbeRibbon">
              <h4 id="m8DbeRibbon">Guiding ribbon</h4>
              <p>A warm organic hum points toward the side you should steer toward. It combines your position with where the moving car is likely to go. As the trajectory becomes safer, the hum settles closer to the centre and softens. At higher speed it looks farther ahead, so smooth corrections work better than chasing every tiny movement.</p>
            </div>

            <div class="m8-dbe-guide-section" aria-labelledby="m8DbePaceNotes">
              <h4 id="m8DbePaceNotes">Pace notes</h4>
              <p>${PACE_NOTE_EXPLANATION}</p>
            </div>

            <div class="m8-dbe-guide-section" aria-labelledby="m8DbeDrift">
              <h4 id="m8DbeDrift">Drift and grip</h4>
              <p>Tyre noise stays centred. As the car loses more grip, the sound spreads wider across both ears. This describes how much the car is sliding without becoming a second left or right instruction.</p>
            </div>

            <div class="m8-dbe-guide-section" aria-labelledby="m8DbePower">
              <h4 id="m8DbePower">Engine and BOOST</h4>
              <p>Engine and BOOST sounds stay centred. A rising burst confirms that BOOST starts, while a separate empty cue tells you the charge is gone. These are status sounds, not steering guidance.</p>
            </div>

            <div class="m8-dbe-guide-section" aria-labelledby="m8DbeRecovery">
              <h4 id="m8DbeRecovery">Off-road recovery</h4>
              <p>Centred gravel marks that the car is off road. The guiding hum changes to recovery guidance and points toward a useful place to rejoin, rather than simply the nearest edge. Steer toward the hum until normal on-road guidance returns.</p>
            </div>

            <div class="m8-dbe-guide-section" aria-labelledby="m8DbeRivals">
              <h4 id="m8DbeRivals">Nearby rivals</h4>
              <p>A short directional cue sounds when a rival comes close. It plays from the side of the nearby car. Treat it as a heads-up rather than a continuous tracker.</p>
            </div>

            <div class="m8-dbe-guide-section" aria-labelledby="m8DbeWrongWay">
              <h4 id="m8DbeWrongWay">Wrong way</h4>
              <p>A repeating low double falling tone confirms that you are facing the wrong direction. A final side tone indicates which way to turn. Continue turning until the regular guiding ribbon returns.</p>
            </div>

            <div class="m8-dbe-guide-section m8-dbe-guide-screen-reader" aria-labelledby="m8DbeScreenReader">
              <h4 id="m8DbeScreenReader">With a screen reader</h4>
              <p>Drive By Ear is designed to work alongside screen readers. The screen reader presents menus, controls, continuous position updates and lap results; Drive By Ear supplies the spatial information needed to steer and stay on course. Together they are intended to provide a complete non-visual way to play TURN.</p>
            </div>
          </div>
        </div>
      </details>
    </div>`;
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

function findGuideSection(dialog, headingText) {
  return [...dialog.querySelectorAll('.m8-guide-grid > section')].find((section) => (
    section.querySelector('h3')?.textContent?.trim() === headingText
  ));
}
