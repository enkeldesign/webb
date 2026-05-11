const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const statusEl = document.getElementById('status');
const classBtn = document.getElementById('classBtn');
const boostBtn = document.getElementById('boostBtn');
const dropBtn = document.getElementById('dropBtn');

const classes = [
  { name: 'Tank', speed: 1.4, hp: 180, dmg: 8 },
  { name: 'Scout', speed: 3.8, hp: 70, dmg: 10 },
  { name: 'Balanced', speed: 2.4, hp: 100, dmg: 12 },
  { name: 'Ranged', speed: 2.6, hp: 85, dmg: 15 },
  { name: 'Healer', speed: 2.4, hp: 90, dmg: 8 }
];

let klassIdx = 2;
let boostUntil = 0;
const state = {
  scoreBlue: 0,
  scoreRed: 0,
  player: { x: 140, y: 270, hp: 100, hasFlag: false },
  bots: Array.from({ length: 4 }, (_, i) => ({ x: 700 + i * 30, y: 180 + i * 40, hp: 90, carry: false })),
  blueBase: { x: 90, y: 270 },
  redBase: { x: 870, y: 270 },
  redFlag: { x: 870, y: 270, heldBy: null },
  blueFlag: { x: 90, y: 270, heldBy: null }
};

const touch = { active: false, x: 0, y: 0 };
canvas.addEventListener('pointerdown', (e) => { touch.active = true; touch.x = e.offsetX; touch.y = e.offsetY; });
canvas.addEventListener('pointermove', (e) => { if (touch.active) { touch.x = e.offsetX; touch.y = e.offsetY; } });
canvas.addEventListener('pointerup', () => { touch.active = false; });
canvas.addEventListener('pointercancel', () => { touch.active = false; });

classBtn.onclick = () => {
  klassIdx = (klassIdx + 1) % classes.length;
  const c = classes[klassIdx];
  state.player.hp = c.hp;
  classBtn.textContent = `Class: ${c.name}`;
};
boostBtn.onclick = () => { boostUntil = performance.now() + 3000; };
dropBtn.onclick = () => {
  if (!state.player.hasFlag) return;
  state.player.hasFlag = false;
  state.redFlag.heldBy = null;
  state.redFlag.x = state.player.x;
  state.redFlag.y = state.player.y;
};

function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

function update(dt, now) {
  const c = classes[klassIdx];
  let speed = c.speed * (now < boostUntil ? 1.7 : 1);

  if (touch.active) {
    const dx = touch.x - state.player.x;
    const dy = touch.y - state.player.y;
    const d = Math.hypot(dx, dy) || 1;
    state.player.x += (dx / d) * speed * dt;
    state.player.y += (dy / d) * speed * dt;
  }

  state.player.x = Math.max(25, Math.min(canvas.width - 25, state.player.x));
  state.player.y = Math.max(25, Math.min(canvas.height - 25, state.player.y));

  for (const bot of state.bots) {
    const tx = state.player.hasFlag ? state.player.x : state.blueFlag.x;
    const ty = state.player.hasFlag ? state.player.y : state.blueFlag.y;
    const dx = tx - bot.x;
    const dy = ty - bot.y;
    const d = Math.hypot(dx, dy) || 1;
    bot.x += (dx / d) * 1.8 * dt;
    bot.y += (dy / d) * 1.8 * dt;

    if (dist(bot, state.player) < 22) {
      state.player.hp -= 14 * dt;
      if (state.player.hp <= 0) {
        state.player.x = state.blueBase.x;
        state.player.y = state.blueBase.y;
        state.player.hp = c.hp;
        if (state.player.hasFlag) {
          state.player.hasFlag = false;
          state.redFlag.heldBy = null;
          state.redFlag.x = state.redBase.x;
          state.redFlag.y = state.redBase.y;
        }
      }
    }
  }

  if (!state.player.hasFlag && dist(state.player, state.redFlag) < 26) {
    state.player.hasFlag = true;
    state.redFlag.heldBy = 'player';
  }
  if (state.player.hasFlag) {
    state.redFlag.x = state.player.x;
    state.redFlag.y = state.player.y;
  }

  if (state.player.hasFlag && dist(state.player, state.blueBase) < 28 && !state.blueFlag.heldBy) {
    state.scoreBlue += 1;
    state.player.hasFlag = false;
    state.redFlag.heldBy = null;
    state.redFlag.x = state.redBase.x;
    state.redFlag.y = state.redBase.y;
  }

  if (state.scoreBlue >= 3 || state.scoreRed >= 3) {
    statusEl.textContent = state.scoreBlue > state.scoreRed ? 'Blue team wins!' : 'Red team wins!';
  } else {
    statusEl.textContent = state.player.hasFlag ? 'You carry the red flag! Return to base.' : 'Steal enemy flag and return home.';
  }

  scoreEl.textContent = `Blue ${state.scoreBlue} : ${state.scoreRed} Red`;
}

function drawCircle(x, y, r, color) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#213144';
  ctx.fillRect(0, 0, canvas.width / 2, canvas.height);
  ctx.fillStyle = '#442121';
  ctx.fillRect(canvas.width / 2, 0, canvas.width / 2, canvas.height);

  drawCircle(state.blueBase.x, state.blueBase.y, 18, '#4fa3ff');
  drawCircle(state.redBase.x, state.redBase.y, 18, '#ff6b6b');
  drawCircle(state.blueFlag.x, state.blueFlag.y, 8, '#8dc4ff');
  drawCircle(state.redFlag.x, state.redFlag.y, 8, '#ff9999');
  drawCircle(state.player.x, state.player.y, 12, '#ffffff');
  for (const bot of state.bots) drawCircle(bot.x, bot.y, 10, '#ff4d4d');

  ctx.fillStyle = '#fff';
  ctx.fillText(`HP ${Math.max(0, state.player.hp).toFixed(0)}`, state.player.x - 16, state.player.y - 20);
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(32, now - last) / 16;
  last = now;
  update(dt, now);
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
