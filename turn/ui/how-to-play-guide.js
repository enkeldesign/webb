const GUIDE_VERSION = 'r138-external-keyboard-controls';
const PACE_NOTE_EXPLANATION = 'Before major corners, one to three beeps play in the ear on the turn side. One beep means a gentler corner, two means medium and three means tight. A long corner keeps the same number of beeps but holds the final beep longer: bip-beeeep for a long medium corner and bip-bip-beeeep for a long tight corner. Separate groups describe linked corners in the order you will meet them.';

export function installHowToPlayGuide(root = document) {
  const dialog = root.querySelector('.m8-how-dialog');
  if (!dialog) return false;
  if (dialog.dataset.guideVersion === GUIDE_VERSION) return true;

  updateDriftAndBoostCopy(dialog);
  installDriveByEarDisclosure(dialog);
  updateAudioPanelCopy(root);

  dialog.dataset.guideVersion = GUIDE_VERSION;
  document.documentElement.dataset.turnHowToPlayGuide = GUIDE_VERSION;
  return true;
}

function updateDriftAndBoostCopy(dialog) {
  const section = findGuideSection(dialog, 'Use Drift and Boost wisely');
  const paragraph = section?.querySelector('p');
  if (!paragraph) return;

  paragraph.innerHTML = 'DRIFT helps the car rotate but costs grip. Holding <strong>DRIFT</strong> also charges <strong>BOOST</strong> faster, so a controlled slide can prepare the next burst. BOOST gives speed but can make the next corner harder. Fast laps come from balancing both. With an external keyboard, use Arrow keys or W, A, S and D to drive; Q or Shift for DRIFT; E or Control for BOOST; Space for BRAKE/REVERSE; and R to restart the lap.';
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
        <summary>Explore the Drive By Ear sounds</summary>
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
