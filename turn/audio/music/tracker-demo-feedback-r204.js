import { renderDemos } from './tracker-audio.js?revision=r204-demo-feedback';

const demoStatus = document.getElementById('demoStatus');
if (demoStatus) {
  demoStatus.textContent = 'Tap an instrument repeatedly to step through its sounds. Pitched instruments play DO · RE · MI · FA · SOL · LA · TI · DO. Switching instrument or waiting 3 seconds resets the sequence.';
}

const instrumentDemos = document.getElementById('instrumentDemos');
if (instrumentDemos) {
  instrumentDemos.replaceChildren();
  renderDemos();
}
