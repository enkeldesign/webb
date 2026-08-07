import * as THREE from 'three';

const LABEL_HEIGHT = 2.8;
const PLAYER_LABEL_HEIGHT = 3.05;
const MAX_ORDER_COLOR = 5;

export function installRacerLabels(runtime, getSessionState) {
  if (!runtime?.camera || runtime.__yourTurnRacerLabelsInstalled) return null;
  runtime.__yourTurnRacerLabelsInstalled = true;

  const root = document.createElement('div');
  root.className = 'yourturn-racer-labels';
  root.setAttribute('aria-hidden', 'true');
  document.body.appendChild(root);

  let labels = [];
  let playerLabel = null;
  let signature = '';
  const point = new THREE.Vector3();

  function syncLabels(state) {
    const laps = state?.challengeLaps || [];
    const playerOrder = resolvePlayerOrder(state, laps);
    const nextSignature = `${laps.map((lap) => `${lap.racerId}:${lap.challengerName}:${lap.challengeOrder}`).join('|')}|you:${playerOrder}`;
    if (nextSignature === signature) return;
    signature = nextSignature;
    root.replaceChildren();

    labels = laps.map((lap, index) => {
      const label = document.createElement('span');
      const order = lap.challengeOrder || index + 1;
      label.className = `yourturn-racer-label yourturn-order-${colorOrder(order)}`;
      label.textContent = lap.challengerName || 'TURN PLAYER';
      root.appendChild(label);
      return label;
    });

    playerLabel = document.createElement('span');
    playerLabel.className = `yourturn-racer-label yourturn-player-label yourturn-order-${colorOrder(playerOrder)}`;
    playerLabel.textContent = '( YOU )';
    root.appendChild(playerLabel);
  }

  function frame() {
    const state = getSessionState?.();
    const laps = state?.challengeLaps || [];
    syncLabels(state);
    const visible = Boolean(state?.active)
      && !document.documentElement.classList.contains('turn-screen-blanked');

    for (let index = 0; index < labels.length; index += 1) {
      positionLabel(labels[index], runtime.competitorCars?.[index], LABEL_HEIGHT, visible);
    }

    positionLabel(
      playerLabel,
      runtime.playerCar,
      PLAYER_LABEL_HEIGHT,
      visible && Boolean(state?.accepted)
    );

    requestAnimationFrame(frame);
  }

  function positionLabel(label, car, height, visible) {
    if (!label) return;
    if (!visible || !car?.visible) {
      label.hidden = true;
      return;
    }

    point.copy(car.position);
    point.y += height;
    point.project(runtime.camera);
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || point.z < -1 || point.z > 1) {
      label.hidden = true;
      return;
    }

    const x = (point.x * 0.5 + 0.5) * globalThis.innerWidth;
    const y = (-point.y * 0.5 + 0.5) * globalThis.innerHeight;
    if (x < -80 || x > globalThis.innerWidth + 80 || y < -60 || y > globalThis.innerHeight + 60) {
      label.hidden = true;
      return;
    }

    label.hidden = false;
    label.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -100%)`;
  }

  requestAnimationFrame(frame);
  return root;
}

function resolvePlayerOrder(state, laps) {
  const ownLap = laps.find((lap) => lap.racerId && lap.racerId === state?.racerId);
  if (ownLap?.challengeOrder) return ownLap.challengeOrder;
  return state?.challenge?.nextOrder || Math.min(MAX_ORDER_COLOR, laps.length + 1);
}

function colorOrder(order) {
  const value = Math.max(1, Math.round(Number(order) || 1));
  return Math.min(MAX_ORDER_COLOR, value);
}
