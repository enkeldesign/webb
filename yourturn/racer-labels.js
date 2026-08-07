import * as THREE from 'three';

const LABEL_HEIGHT = 2.8;

export function installRacerLabels(runtime, getSessionState) {
  if (!runtime?.camera || runtime.__yourTurnRacerLabelsInstalled) return null;
  runtime.__yourTurnRacerLabelsInstalled = true;

  const root = document.createElement('div');
  root.className = 'yourturn-racer-labels';
  root.setAttribute('aria-hidden', 'true');
  document.body.appendChild(root);

  let labels = [];
  let signature = '';
  const point = new THREE.Vector3();

  function syncLabels(laps) {
    const nextSignature = laps.map((lap) => `${lap.racerId}:${lap.challengerName}`).join('|');
    if (nextSignature === signature) return;
    signature = nextSignature;
    root.replaceChildren();
    labels = laps.map((lap) => {
      const label = document.createElement('span');
      label.className = 'yourturn-racer-label';
      label.textContent = lap.challengerName || 'TURN PLAYER';
      root.appendChild(label);
      return label;
    });
  }

  function frame() {
    const state = getSessionState?.();
    const laps = state?.challengeLaps || [];
    syncLabels(laps);
    const visible = Boolean(state?.active)
      && !document.documentElement.classList.contains('turn-screen-blanked');

    for (let index = 0; index < labels.length; index += 1) {
      const label = labels[index];
      const car = runtime.competitorCars?.[index];
      if (!visible || !car?.visible) {
        label.hidden = true;
        continue;
      }

      point.copy(car.position);
      point.y += LABEL_HEIGHT;
      point.project(runtime.camera);
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || point.z < -1 || point.z > 1) {
        label.hidden = true;
        continue;
      }

      const x = (point.x * 0.5 + 0.5) * globalThis.innerWidth;
      const y = (-point.y * 0.5 + 0.5) * globalThis.innerHeight;
      if (x < -80 || x > globalThis.innerWidth + 80 || y < -60 || y > globalThis.innerHeight + 60) {
        label.hidden = true;
        continue;
      }

      label.hidden = false;
      label.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -100%)`;
    }

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
  return root;
}
