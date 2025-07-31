/*
* Pappa Quest - a small top down game built with HTML5 canvas.
*
* The game loosely recreates the floor plan provided by the user. Rooms are
* defined as simple rectangles with furniture and walls represented by
* rectangular obstacles. You control Pappa, who receives quests from his
* children Arvid and Kerstin. While you work on one quest the other child
* keeps calling “Pappa!”, draining your stamina. Complete quests to earn
* points and keep an eye on your HP – when it gets too low you need to
* rest in one of the beds.
*
* Author: ChatGPT
*/

(() => {
/** Utility functions **/
function rectsIntersect(ax, ay, aw, ah, bx, by, bw, bh) {
return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

// Clamp a value between min and max
function clamp(v, min, max) {
return Math.max(min, Math.min(max, v));
}

// Generate a random integer between min and max inclusive
function randInt(min, max) {
return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Facts/bragging lines that Arvid can say randomly when he is not
// actively calling Pappa. These are used instead of the old
// “vet du något om …” question lines. Each entry should be a
// lighthearted brag or fact. The list can be extended freely.
const ARVID_FACTS = [
'Pappa, jag är level 735 i spelet nu!',
'Pappa, det finns en planet gjord av diamant!',
'Pappa, jag fick en legendary!',
'Pappa, vet du vilka mina favorit-moves är?',
'Pappa, visste du att det finns en vulkan på Mars?',
'Pappa, jag hittade en jättecool AoT-animation!',
'Pappa, jag är den bästa i hela servern!',
'Pappa, jag gjorde ett skitsnyggt mål!'
];

// Simple message manager that keeps a queue of messages and displays
// the most recent few in the dialogue area. Messages automatically
// expire after a fixed duration.
class MessageLog {
constructor(element) {
this.el = element;
this.messages = [];
}
add(text, duration = 3000) {
const msg = { text, time: performance.now(), duration };
this.messages.push(msg);
}
update() {
const now = performance.now();
this.messages = this.messages.filter(m => now - m.time < m.duration);
// Render the most recent two messages
this.el.innerHTML = this.messages
.slice(-3)
.map(m => `<p>${m.text}</p>`) // Preserve simple paragraphs
.join('');
}
}

/** Base class for any drawable/interactive character on the map. **/
class Entity {
constructor(x, y, w, h) {
this.x = x;
this.y = y;
this.w = w;
this.h = h;
}
get rect() {
return { x: this.x, y: this.y, w: this.w, h: this.h };
}
intersects(other) {
return rectsIntersect(this.x, this.y, this.w, this.h, other.x, other.y, other.w, other.h);
}
}

/** The player character controlled with the keyboard. **/
class Player extends Entity {
constructor(x, y) {
super(x, y, 24, 36);
this.speed = 140; // pixels per second
this.dx = 0;
this.dy = 0;
this.hp = 100;
this.points = 0;
this.holdEars = false;
this.carryItem = null;
this.activeQuest = null;
this.isResting = false;
this.restTimer = 0;
// direction facing (for moustache orientation). values: 'down','up','left','right'
this.dir = 'down';

// Whether Pappa is downstairs fetching an item. When true he is
// temporarily hidden from the upstairs floor. downTimer tracks the
// elapsed time spent downstairs and downType identifies the item being
// retrieved (e.g. 'snack' or 'toapapper'). downQuest references the
// quest waiting on this item so we can update its state when he
// returns.
this.isDownstairs = false;
this.downTimer = 0;
this.downType = null;
this.downQuest = null;

// Path the player should follow when using click to walk. When
// non empty, the player will move towards the first waypoint until
// it is reached (within a small threshold), then proceed to the
// next. Each waypoint is an object with {x, y} coordinates
// representing the centre of a grid cell in world space.
this.path = [];
// Debug flag: when true, clicking on the map teleports Pappa
// instantly to the clicked location (as in the old behaviour). When
// false, clicking uses pathfinding for natural movement. This
// toggles when the user presses a dedicated key (e.g. T).
this.debugTeleport = false;

// Speech line and timers for Pappa. When speakTimer > 0, the
// speakLine will be rendered in a speech bubble above Pappa's
// head. greetCooldown prevents repeated greetings when Pappa
// stays near a child; it must reach zero before another
// greeting is triggered. All timers are measured in seconds.
this.speakLine = '';
this.speakTimer = 0;
this.greetCooldown = 0;
}
update(dt, keys, obstacles, interactiveObjs) {
// Decrement timers for speech bubbles and greeting cooldown.
if (this.speakTimer > 0) {
this.speakTimer -= dt;
if (this.speakTimer <= 0) {
this.speakTimer = 0;
this.speakLine = '';
}
}
if (this.greetCooldown > 0) {
this.greetCooldown -= dt;
if (this.greetCooldown < 0) this.greetCooldown = 0;
}
// Handle resting: if resting, we can't move and we recover HP
if (this.isResting) {
this.dx = 0;
this.dy = 0;
this.restTimer += dt;
// Recover HP at 20 HP per second
this.hp = Math.min(100, this.hp + 20 * dt);
if (this.hp >= 80) {
this.isResting = false;
messageLog.add('Upp och hoppa, pappa!');
}
} else if (!this.isDownstairs) {
// If a path exists, follow it smoothly. Ignore keyboard input
// until the path is exhausted. The path contains waypoints at
// the centre of grid cells.
if (this.path && this.path.length > 0) {
const target = this.path[0];
// Current centre of Pappa
const cx = this.x + this.w / 2;
const cy = this.y + this.h / 2;
const dx = target.x - cx;
const dy = target.y - cy;
const dist = Math.sqrt(dx * dx + dy * dy);
// If very close to the waypoint, snap to it and pop the next one
const epsilon = 2;
if (dist <= Math.max(epsilon, this.speed * dt)) {
// Move directly to the waypoint
this.x = target.x - this.w / 2;
this.y = target.y - this.h / 2;
this.path.shift();
// Update facing direction based on next waypoint if exists
if (this.path.length > 0) {
const next = this.path[0];
if (next.x < target.x) this.dir = 'left';
else if (next.x > target.x) this.dir = 'right';
if (next.y < target.y) this.dir = 'up';
else if (next.y > target.y) this.dir = 'down';
}
} else {
// Normalise direction vector
const dirX = dx / dist;
const dirY = dy / dist;
// Update facing based on movement direction
if (Math.abs(dirX) > Math.abs(dirY)) {
this.dir = dirX < 0 ? 'left' : 'right';
} else {
this.dir = dirY < 0 ? 'up' : 'down';
}
// Move along direction at constant speed
const speedMod = this.holdEars ? 0.6 : 1.0;
this.x += dirX * this.speed * speedMod * dt;
this.y += dirY * this.speed * speedMod * dt;
}
// Clamp to canvas boundaries
this.x = clamp(this.x, 0, Game.WIDTH - this.w);
this.y = clamp(this.y, 0, Game.HEIGHT - this.h);
} else {
// No path: use keyboard controls for free roaming
const speedMod = this.holdEars ? 0.6 : 1.0;
this.dx = 0;
this.dy = 0;
if (keys['ArrowUp'] || keys['KeyW']) {
this.dy = -1;
this.dir = 'up';
}
if (keys['ArrowDown'] || keys['KeyS']) {
this.dy = 1;
this.dir = 'down';
}
if (keys['ArrowLeft'] || keys['KeyA']) {
this.dx = -1;
this.dir = 'left';
}
if (keys['ArrowRight'] || keys['KeyD']) {
this.dx = 1;
this.dir = 'right';
}
// Normalize diagonal movement
if (this.dx !== 0 && this.dy !== 0) {
const norm = Math.sqrt(2);
this.dx /= norm;
this.dy /= norm;
}
let newX = this.x + this.dx * this.speed * speedMod * dt;
let newY = this.y + this.dy * this.speed * speedMod * dt;
// Clamp to canvas boundaries
newX = clamp(newX, 0, Game.WIDTH - this.w);
newY = clamp(newY, 0, Game.HEIGHT - this.h);
this.x = newX;
this.y = newY;
}
}
}
draw(ctx) {
// Draw the character: head, body, moustache and maybe item in hand
const cx = this.x + this.w / 2;
const cy = this.y + 8; // top of head
const headR = 10;
// Body colors
const skin = '#f8d9b0';
const hair = '#6b4423';
const shirt = '#3e8fc4';
const pants = '#2f4a6f';
const moustacheColor = '#3c2c1d';
// Draw hair (rectangle on top of head)
ctx.fillStyle = hair;
ctx.fillRect(cx - headR, cy, headR * 2, 8);
// Draw head
ctx.fillStyle = skin;
ctx.beginPath();
ctx.arc(cx, cy + headR, headR, 0, Math.PI * 2);
ctx.fill();
// Draw moustache
ctx.fillStyle = moustacheColor;
// moustache position depends on facing direction; moustache below nose only drawn when facing down/up.
const mWidth = 14;
const mHeight = 3;
let mx = cx - mWidth / 2;
let my = cy + headR + 3;
if (this.dir === 'left') {
mx = cx - mWidth / 2 - 2;
my = cy + headR;
} else if (this.dir === 'right') {
mx = cx - mWidth / 2 + 2;
my = cy + headR;
}
ctx.fillRect(mx, my, mWidth, mHeight);
// Draw body
ctx.fillStyle = shirt;
ctx.fillRect(cx - 10, cy + headR * 2 - 4, 20, 20);
// Draw pants
ctx.fillStyle = pants;
ctx.fillRect(cx - 10, cy + headR * 2 + 16, 20, 12);
// Draw item if carrying
if (this.carryItem) {
ctx.fillStyle = '#fff899';
ctx.fillRect(this.x + this.w, this.y + this.h / 2 - 4, 8, 8);
}
// Draw ear cover indicator when holding ears
if (this.holdEars) {
ctx.fillStyle = 'rgba(255,255,0,0.6)';
ctx.beginPath();
ctx.arc(cx, cy + headR, headR + 4, 0, Math.PI * 2);
ctx.fill();
}

// Draw speech bubble above Pappa when he has something to say.
if (this.speakTimer > 0 && this.speakLine) {
// Use a helper to draw a rounded speech bubble similar to the
// children's bubble. Bubble width scales with text length.
const drawPlayerBubble = (text) => {
const paddingX = 6;
const paddingY = 4;
ctx.font = '12px sans-serif';
const textWidth = ctx.measureText(text).width;
const bubbleW = Math.max(50, textWidth + paddingX * 2);
const bubbleH = 26;
const bx = cx - bubbleW / 2;
const by = this.y - bubbleH - 6;
ctx.fillStyle = 'rgba(255,255,255,0.9)';
ctx.strokeStyle = '#333';
ctx.lineWidth = 1;
ctx.beginPath();
ctx.moveTo(bx + 5, by);
ctx.lineTo(bx + bubbleW - 5, by);
ctx.quadraticCurveTo(bx + bubbleW, by, bx + bubbleW, by + 5);
ctx.lineTo(bx + bubbleW, by + bubbleH - 5);
ctx.quadraticCurveTo(bx + bubbleW, by + bubbleH, bx + bubbleW - 5, by + bubbleH);
ctx.lineTo(bx + 15, by + bubbleH);
// Tail of bubble
ctx.lineTo(bx + 10, by + bubbleH + 6);
ctx.lineTo(bx + 5, by + bubbleH);
ctx.lineTo(bx + 5, by + 5);
ctx.quadraticCurveTo(bx + 5, by, bx + 5 + 5, by);
ctx.closePath();
ctx.fill();
ctx.stroke();
ctx.fillStyle = '#333';
ctx.fillText(text, bx + paddingX, by + 16);
};
drawPlayerBubble(this.speakLine);
}
}
}

/** Child/NPC class **/
class Child extends Entity {
constructor(name, x, y, questPool) {
super(x, y, 20, 32);
this.name = name;
this.questPool = questPool; // array of quest types strings

// Remember the type of the last quest this child gave. This
// property is used to avoid giving the same quest twice in a row.
this.lastQuestType = null;
this.callTimer = 0;
this.isCalling = false;
// Base interval between calls in milliseconds. This will be
// randomised depending on the child. Arvid calls a bit more
// frequently than Kerstin, but still with several seconds
// between each shout. Kerstin has a longer pause so she does
// not constantly cry for Pappa. A new interval is chosen
// every time the child calls.
if (name === 'Arvid') {
this.callInterval = randInt(3000, 5000);
} else {
this.callInterval = randInt(6000, 9000);
}
this.activeQuest = null;
this.yellCooldown = 0; // time since last yell for message display
this.color = name === 'Arvid' ? '#e05d5d' : '#d68fce';
// Running call state: used to decide when to apply HP penalty
this.callElapsed = 0;

// Additional state for dynamic behavior
// Current line displayed when calling. Arvid cycles through several
// humorous lines rather than always yelling "Pappa!". Kerstin keeps
// it simple.
this.callLine = 'Pappa!';
// Time spent calling without receiving help. After 15 seconds Arvid
// will start chasing Pappa around the house.
this.chaseTimer = 0;
this.chaseActive = false;
// Time remaining for a "Tack pappa!" bubble after completing a quest.
this.thankTimer = 0;

// Wandering behaviour: when idle (no quest, not calling, not
// chasing and not walking to the toilet) the child can move
// between a set of idle points. Only Kerstin has defined
// wander targets. wanderTarget holds the current destination,
// wanderDelay introduces a pause before choosing a new target,
// and idlePoints lists possible destinations. All values are
// in pixels.
this.wanderTarget = null;
this.wanderDelay = 0;
if (name === 'Kerstin') {
// Define some interesting spots in the house: sofa area,
// Kerstin’s desk/computer and her bed. Kerstin will
// occasionally wander among these when idle.
this.idlePoints = [
{ x: 80, y: 240 }, // near sofa and living area
{ x: 520, y: 500 }, // near Kerstin's desk
{ x: 400, y: 450 } // her bed area
];
} else {
this.idlePoints = [];
}

// Remember the child's starting position as their home. When the
// child finishes chasing or completes certain quests they will
// return to this location. Having a stored home prevents
// repeated hard coding of room coordinates throughout the game.
this.homeX = x;
this.homeY = y;

// Whether the child is currently walking back to their home.
this.returningHome = false;
// Optional target the child should walk toward (e.g. bathroom).
this.walkTarget = null;
// Flag indicating the child is on the way to the toilet for the
// toapapper quest. When true the child will move toward
// walkTarget and stop calling until they arrive.
this.isWalkingToToilet = false;
// Speech line and timer for arbitrary short messages such as
// "Pappa pratar med Arvid" or "Pappa jag ska gå på toa". When
// speakTimer > 0 the line will be drawn in a bubble above the
// child's head. speakTimer is measured in milliseconds.
this.speakLine = '';
this.speakTimer = 0;

// Properties related to Arvid's bragging lines. These
// properties are only used for Arvid. callInterval will be
// randomised between 3–5 seconds each time he calls, ensuring
// variation. There is no separate fact timer; the bragging
// lines replace the old "vet du något om …" questions.
this.factCooldown = 0;
this.timeSinceLastFact = 0;
this.factTimer = 0;
this.currentFact = '';
}
update(dt, player) {
// Decrement any active speak timer. When it reaches zero the
// speech line disappears. dt is in seconds so convert to ms.
if (this.speakTimer > 0) {
this.speakTimer -= dt * 1000;
if (this.speakTimer < 0) this.speakTimer = 0;
}

// If the child is currently returning home, walk back to their
// starting position. While returning home the child does not
// chase or call the player. They walk at a gentle pace.
if (this.returningHome) {
const dxHome = this.homeX - this.x;
const dyHome = this.homeY - this.y;
const distHome = Math.sqrt(dxHome * dxHome + dyHome * dyHome);
const speed = 80;
if (distHome > 1) {
this.x += (dxHome / distHome) * speed * dt;
this.y += (dyHome / distHome) * speed * dt;
} else {
this.x = this.homeX;
this.y = this.homeY;
this.returningHome = false;
}
return;
}

// If the child is walking to a specific target (e.g. the toilet)
// then move them towards that point and skip calling until they
// arrive. After arriving reset the flag.
if (this.isWalkingToToilet && this.walkTarget) {
const dxT = this.walkTarget.x - this.x;
const dyT = this.walkTarget.y - this.y;
const distT = Math.sqrt(dxT * dxT + dyT * dyT);
const speed = 80;
if (distT > 1) {
this.x += (dxT / distT) * speed * dt;
this.y += (dyT / distT) * speed * dt;
} else {
// Snap to target and finish walking
this.x = this.walkTarget.x;
this.y = this.walkTarget.y;
this.isWalkingToToilet = false;
this.walkTarget = null;
}
return;
}
if (this.activeQuest) {
// If the player is performing this child's quest, no calls
this.isCalling = false;
this.callTimer = 0;
this.chaseTimer = 0;
this.chaseActive = false;
// Reduce fact timers even when a quest is active so the bubble can
// expire gracefully.
if (this.factTimer > 0) {
this.factTimer -= dt * 1000;
if (this.factTimer < 0) this.factTimer = 0;
}
return;
}

// Idle wandering: when the child has no active quest, is not
// currently calling, chasing, returning home or walking to the
// toilet, let them wander between a set of idle points. Only
// Kerstin has idle points defined. They will pause briefly
// between movements. This behaviour prevents Kerstin from
// standing in one spot and constantly yelling.
if (!this.activeQuest && !this.isCalling && !this.chaseActive && !this.returningHome && !this.isWalkingToToilet && this.idlePoints && this.idlePoints.length > 0) {
// If a wander target exists, move towards it
if (this.wanderTarget) {
const dx = this.wanderTarget.x - this.x;
const dy = this.wanderTarget.y - this.y;
const dist = Math.sqrt(dx * dx + dy * dy);
const speed = 40;
if (dist > 1) {
this.x += (dx / dist) * speed * dt;
this.y += (dy / dist) * speed * dt;
} else {
// Arrived: clear target and set a delay before picking next
this.x = this.wanderTarget.x;
this.y = this.wanderTarget.y;
this.wanderTarget = null;
// Pause for a few seconds before choosing next destination
this.wanderDelay = randInt(2000, 5000);
}
// While wandering do not call Pappa
this.callTimer = 0;
this.isCalling = false;
this.callElapsed = 0;
} else {
// No current target: count down delay
if (this.wanderDelay > 0) {
this.wanderDelay -= dt * 1000;
}
if (this.wanderDelay <= 0) {
// Choose a new target randomly from idlePoints
const idx = randInt(0, this.idlePoints.length - 1);
const pt = this.idlePoints[idx];
// Set new wander target
this.wanderTarget = { x: pt.x, y: pt.y };
this.wanderDelay = 0;
}
}
}
// Determine if we should call: if the player is not near us and not resting
const near = rectsIntersect(this.x - 8, this.y - 8, this.w + 16, this.h + 16, player.x, player.y, player.w, player.h);
if (!near) {
// Increase timer
this.callTimer += dt * 1000;
if (this.callTimer >= this.callInterval) {
this.callTimer = 0;
this.isCalling = true;
this.callElapsed = 0;
// Choose a new line for the call bubble. Arvid has several lines;
// Kerstin simply yells "Pappa!".
if (this.name === 'Arvid') {
// Pick a bragging line from the predefined facts and
// randomise the next call interval between 3–5 seconds.
const idx = randInt(0, ARVID_FACTS.length - 1);
this.callLine = ARVID_FACTS[idx];
// Randomise the call interval (ms) for the next call
this.callInterval = randInt(3000, 5000);
} else {
this.callLine = 'Pappa!';
// Kerstin also randomises her call interval but uses a longer range
this.callInterval = randInt(6000, 9000);
}
}
} else {
this.isCalling = false;
this.callTimer = 0;
// Reset chase when Pappa arrives
this.chaseTimer = 0;
this.chaseActive = false;
}
// Apply HP penalty if calling
if (this.isCalling) {
// Accumulate elapsed time for chasing behaviour
this.callElapsed += dt;
// Drain HP continuously while the child is calling. Each calling
// child reduces HP by approximately 6 per second, unless Pappa is
// covering his ears or resting. This results in a more punishing
// drain when multiple children are calling simultaneously.
if (!player.holdEars && !player.isResting) {
// Drain HP at a gentler rate to give the player more time
// before exhaustion. Each calling child now reduces HP by
// approximately 3 per second instead of 6.
player.hp = Math.max(0, player.hp - 3 * dt);
}
// Only Arvid gets increasingly frustrated and starts chasing.
// After roughly 10 seconds of continuous calling he will
// pursue Pappa until contact.
if (this.name === 'Arvid') {
this.chaseTimer += dt;
if (this.chaseTimer >= 10) {
this.chaseActive = true;
}
}
}
// Chasing behaviour: if active, move towards Pappa
if (this.chaseActive) {
const speed = 100; // pixels per second
const dx = player.x - this.x;
const dy = player.y - this.y;
const dist = Math.sqrt(dx * dx + dy * dy);
if (dist > 1) {
this.x += (dx / dist) * speed * dt;
this.y += (dy / dist) * speed * dt;
}

// If Arvid reaches Pappa while chasing, have him talk for a
// moment and then walk back to his room. This prevents him
// from continually colliding and stopping on top of Pappa.
if (this.name === 'Arvid' && rectsIntersect(this.x, this.y, this.w, this.h, player.x, player.y, player.w, player.h)) {
// Show a short speech bubble above Arvid
this.speakLine = 'Pappa pratar med Arvid';
this.speakTimer = 2000;
// End chasing state and begin walking home
this.chaseActive = false;
this.chaseTimer = 0;
this.returningHome = true;
// Give Pappa a brief reprieve before the next call
this.callTimer = -2000;
}
}
// Decay thank timer
if (this.thankTimer > 0) {
this.thankTimer -= dt * 1000;
if (this.thankTimer < 0) this.thankTimer = 0;
}

// Arvid's bragging lines are selected in the call initiation above.
}
draw(ctx) {
// Draw simple child: circle head and rectangle body
const cx = this.x + this.w / 2;
const cy = this.y + 6;
const headR = 8;
// Hair color based on child
const hair = this.name === 'Arvid' ? '#3a2f3a' : '#8b5e3c';
const shirt = this.name === 'Arvid' ? '#e05d5d' : '#d68fce';
const pants = this.name === 'Arvid' ? '#3f3f3f' : '#415f75';
const skin = '#f8d9b0';
ctx.fillStyle = hair;
ctx.fillRect(cx - headR, cy, headR * 2, 6);
ctx.fillStyle = skin;
ctx.beginPath();
ctx.arc(cx, cy + headR, headR, 0, Math.PI * 2);
ctx.fill();
ctx.fillStyle = shirt;
ctx.fillRect(cx - 8, cy + headR * 2, 16, 14);
ctx.fillStyle = pants;
ctx.fillRect(cx - 8, cy + headR * 2 + 14, 16, 10);
// Draw speech bubble if child is calling for Pappa
// Choose which bubble to draw: thank bubble has priority
const drawBubble = (text) => {
// Bubble dimensions scale with text length
const paddingX = 6;
const paddingY = 4;
ctx.font = '12px sans-serif';
const textWidth = ctx.measureText(text).width;
const bubbleW = Math.max(50, textWidth + paddingX * 2);
const bubbleH = 26;
const bx = cx - bubbleW / 2;
const by = this.y - bubbleH - 6;
ctx.fillStyle = 'rgba(255,255,255,0.9)';
ctx.strokeStyle = '#333';
ctx.lineWidth = 1;
ctx.beginPath();
ctx.moveTo(bx + 5, by);
ctx.lineTo(bx + bubbleW - 5, by);
ctx.quadraticCurveTo(bx + bubbleW, by, bx + bubbleW, by + 5);
ctx.lineTo(bx + bubbleW, by + bubbleH - 5);
ctx.quadraticCurveTo(bx + bubbleW, by + bubbleH, bx + bubbleW - 5, by + bubbleH);
ctx.lineTo(bx + 15, by + bubbleH);
// Tail
ctx.lineTo(bx + 10, by + bubbleH + 6);
ctx.lineTo(bx + 5, by + bubbleH);
ctx.lineTo(bx + 5, by + bubbleH);
ctx.lineTo(bx + 5, by + 5);
ctx.quadraticCurveTo(bx + 5, by, bx + 5 + 5, by);
ctx.closePath();
ctx.fill();
ctx.stroke();
ctx.fillStyle = '#333';
ctx.fillText(text, bx + paddingX, by + 16);
};
// Determine which bubble to draw, prioritising explicit speech
// lines first. If the child is currently chasing Pappa, show
// a simple repetitive “Pappa.” call while moving. Otherwise,
// show thank you messages, play prompts and normal call lines.
if (this.speakTimer > 0 && this.speakLine) {
drawBubble(this.speakLine);
} else if (this.chaseActive) {
drawBubble('Pappa.');
} else if (this.activeQuest && this.activeQuest.type === 'play' && this.activeQuest.state === 'play_with_child') {
// Show play prompt during active play quests (e.g. Kerstins lek quest)
drawBubble('Leka mer!');
} else if (this.isCalling && !this.activeQuest) {
// Display Arvid's bragging line or Kerstin's call line when calling
drawBubble(this.callLine);
}
// Draw exclamation mark when child has a quest assigned (activeQuest set)
if (this.activeQuest) {
ctx.fillStyle = '#ff8800';
ctx.font = '24px serif';
ctx.fillText('!', cx - 8, this.y - 16);
}
}
}

/** Wasp entity that flies randomly. **/
class Wasp extends Entity {
constructor(x, y) {
super(x, y, 12, 12);
// Random velocity
this.vx = (Math.random() * 2 - 1) * 40;
this.vy = (Math.random() * 2 - 1) * 40;
}
update(dt) {
this.x += this.vx * dt;
this.y += this.vy * dt;
// Bounce off boundaries
if (this.x < 0 || this.x + this.w > Game.WIDTH) {
this.vx *= -1;
this.x = clamp(this.x, 0, Game.WIDTH - this.w);
}
if (this.y < 0 || this.y + this.h > Game.HEIGHT) {
this.vy *= -1;
this.y = clamp(this.y, 0, Game.HEIGHT - this.h);
}
}
draw(ctx) {
// Body
ctx.fillStyle = '#f5d90a';
ctx.beginPath();
ctx.ellipse(this.x + 6, this.y + 6, 6, 4, 0, 0, Math.PI * 2);
ctx.fill();
// Stripes
ctx.fillStyle = '#333';
ctx.fillRect(this.x + 4, this.y + 2, 4, 8);
// Wings
ctx.fillStyle = 'rgba(255,255,255,0.6)';
ctx.beginPath();
ctx.ellipse(this.x + 3, this.y + 4, 4, 6, 0, 0, Math.PI * 2);
ctx.fill();
ctx.beginPath();
ctx.ellipse(this.x + 9, this.y + 4, 4, 6, 0, 0, Math.PI * 2);
ctx.fill();
}
}

/** Cat entity (Lova) that wanders slowly around a room. Used for Arvid's
* "lova" quest. */
class Cat extends Entity {
/**
* Create a wandering cat.
* @param {string} name Name of the cat (e.g. 'Lova', 'Bella', 'Kasper').
* @param {number} x Starting x position.
* @param {number} y Starting y position.
* @param {Object} bounds Optional bounding rectangle {x,y,w,h} limiting the
* cat's movement. If omitted the cat roams the
* entire map.
*/
constructor(name, x, y, bounds = null) {
super(x, y, 16, 12);
this.name = name;
this.vx = (Math.random() * 2 - 1) * 30;
this.vy = (Math.random() * 2 - 1) * 30;
this.bounds = bounds;
// Whether the cat is currently active/visible. Bella starts
// inactive until the player triggers the door event.
this.active = true;
// Meow bubble state: timer counts down when the cat is meowing.
this.meowTimer = 0;
this.meowText = '';
}
update(dt) {
if (!this.active) return;
// Move
this.x += this.vx * dt;
this.y += this.vy * dt;
// Determine bounds for bouncing: use custom bounds if provided
const minX = this.bounds ? this.bounds.x : 0;
const maxX = this.bounds ? this.bounds.x + this.bounds.w - this.w : Game.WIDTH - this.w;
const minY = this.bounds ? this.bounds.y : 0;
const maxY = this.bounds ? this.bounds.y + this.bounds.h - this.h : Game.HEIGHT - this.h;
// Bounce off edges
if (this.x < minX || this.x > maxX) {
this.vx *= -1;
this.x = clamp(this.x, minX, maxX);
}
if (this.y < minY || this.y > maxY) {
this.vy *= -1;
this.y = clamp(this.y, minY, maxY);
}
// Occasionally change direction
if (Math.random() < 0.02) {
this.vx = (Math.random() * 2 - 1) * 30;
this.vy = (Math.random() * 2 - 1) * 30;
}
// Randomly start a meow every few seconds
if (this.meowTimer <= 0 && Math.random() < 0.01) {
const sounds = ['Mjau!', 'Määäh', 'Mrrr...'];
this.meowText = sounds[randInt(0, sounds.length - 1)];
this.meowTimer = 2.0; // show for 2 seconds
}
if (this.meowTimer > 0) {
this.meowTimer -= dt;
if (this.meowTimer < 0) this.meowTimer = 0;
}
}
draw(ctx) {
if (!this.active) return;
// Body colour depends on cat
let bodyColour = '#563d00';
if (this.name === 'Bella') bodyColour = '#907050';
else if (this.name === 'Kasper') bodyColour = '#c0cfd7';
// Draw body
ctx.fillStyle = bodyColour;
ctx.fillRect(this.x, this.y + 4, this.w, this.h - 4);
// Head
ctx.beginPath();
ctx.arc(this.x + this.w / 2, this.y + 4, 6, 0, Math.PI * 2);
ctx.fill();
// Ears
ctx.fillRect(this.x + 2, this.y, 3, 3);
ctx.fillRect(this.x + this.w - 5, this.y, 3, 3);
// Draw meow bubble if currently meowing
if (this.meowTimer > 0 && this.meowText) {
ctx.font = '12px sans-serif';
const paddingX = 4;
const paddingY = 2;
const textWidth = ctx.measureText(this.meowText).width;
const bubbleW = Math.max(36, textWidth + paddingX * 2);
const bubbleH = 20;
const bx = this.x + this.w / 2 - bubbleW / 2;
const by = this.y - bubbleH - 4;
ctx.fillStyle = 'rgba(255,255,255,0.9)';
ctx.strokeStyle = '#333';
ctx.lineWidth = 1;
ctx.beginPath();
ctx.moveTo(bx + 4, by);
ctx.lineTo(bx + bubbleW - 4, by);
ctx.quadraticCurveTo(bx + bubbleW, by, bx + bubbleW, by + 4);
ctx.lineTo(bx + bubbleW, by + bubbleH - 4);
ctx.quadraticCurveTo(bx + bubbleW, by + bubbleH, bx + bubbleW - 4, by + bubbleH);
ctx.lineTo(bx + 10, by + bubbleH);
ctx.lineTo(bx + 6, by + bubbleH + 4);
ctx.lineTo(bx + 4, by + bubbleH);
ctx.lineTo(bx + 4, by + 4);
ctx.quadraticCurveTo(bx + 4, by, bx + 8, by);
ctx.closePath();
ctx.fill();
ctx.stroke();
ctx.fillStyle = '#333';
ctx.fillText(this.meowText, bx + paddingX, by + 13);
}
}
}

/** Main game manager **/
class Game {
constructor(canvas) {
this.canvas = canvas;
this.ctx = canvas.getContext('2d');
Game.WIDTH = canvas.width;
Game.HEIGHT = canvas.height;
this.obstacles = [];
this.interactives = [];
this.children = [];
this.player = null;
this.wasp = null;
this.keys = {};
this.lastTime = 0;

// Grid/pathfinding related properties. cellSize defines the
// resolution of the pathfinding grid. grid will be a 2D array
// where 0 represents a walkable cell and 1 represents a blocked
// cell. gridWidth/Height describe the size of the grid. These
// values are initialised in buildGrid(), which should be called
// after the layout and obstacles are constructed.
// Pathfinding cell size controls the granularity of the A* grid.
// Using a smaller cell size improves navigation through narrow gaps
// (e.g. between walls and furniture). The default was 20px which
// made it hard to click into the far right bedroom. Reducing it
// to 12px yields a finer grid and smoother paths.
this.cellSize = 12;
this.grid = [];
this.gridWidth = 0;
this.gridHeight = 0;
// Rooms mapping for each child. Each child is given a room
// rectangle so that quest delivery/pick up can trigger when Pappa
// enters the room rather than needing to collide with the child.
this.rooms = {};
// HP warning timer for red flash when low HP and flag to ensure
// the warning only triggers once per low HP event.
this.hpWarningTimer = 0;
this.hpWarningShown = false;

// Cats array: holds all roaming cats (Lova, Bella, Kasper). Each
// entry is an instance of Cat. Bella starts inactive until the
// player triggers the door event. Lova and Kasper are active
// from the start. See setup() for initialisation.
this.cats = [];
// Event flags for the Bella door sequence. bellaSpawned is
// toggled when Bella has entered the house. bellaScratch
// controls whether to draw a scratch bubble at the stairs.
this.bellaSpawned = false;
this.bellaScratch = false;
// Start with Bella quiet. After a set delay she will scratch
// at the door to request entry. The timer is measured in seconds
// and counts down in update().
this.bellaTimer = 60;

    // Timer to track how long no quest has been active.  When
    // both children and Pappa have no active quest for a set
    // duration, the next child on rotation will automatically call
    // Pappa and start a new quest without the player needing to
    // visit them.  Measured in seconds and reset when a quest
    // starts.
    this.noQuestTimer = 0;

// Track which child should receive the next quest. After each
// quest completes this value toggles between 'Arvid' and
// 'Kerstin'. This enforces alternating quests so one child
// doesn’t monopolise the player’s attention.
this.nextQuestChildName = 'Arvid';

// Define a list of possible charger spawn points. Each time
// Arvid requests a charger this array is used to randomise
// where the charger appears. Coordinates are approximate
// positions on desks, tables or floor tiles around the map.
this.chargerSpots = [
{ x: 380, y: 260 }, // parents’ bedroom bedside table
{ x: 80, y: 240 }, // sofa in living room
{ x: 500, y: 480 }, // Kerstin’s desk
{ x: 260, y: 340 } // hallway near middle of house
];
}

/**
* Start the main game loop. This should be called once after
* setup() has been invoked and the user has chosen to start the
* game (e.g. by clicking the "Starta" button on the title screen).
*/
start() {
this.lastTime = performance.now();
requestAnimationFrame(this.loop.bind(this));
}
setup() {
// Build obstacles and interactive objects from our floor plan
this.buildLayout();
// After building layout, create a grid for pathfinding
this.buildGrid();
// Create player
this.player = new Player(250, 300);
// Create children
const arvidStart = { x: 500, y: 80 };
const kerstinStart = { x: 80, y: 240 };
// Arvid now has an additional quest to chase away the cat Lova
this.children.push(new Child('Arvid', arvidStart.x, arvidStart.y, ['wasp', 'charger', 'help_computer', 'play', 'lova']));
this.children.push(new Child('Kerstin', kerstinStart.x, kerstinStart.y, ['wasp', 'snack', 'play', 'toapapper']));
// Define room boundaries for the children. These bounds roughly
// correspond to the floor plan layout: Arvid's room occupies the
// top right quadrant and Kerstin's room occupies the bottom right
// quadrant. Each rectangle is defined by x, y, width and height.
this.rooms['Arvid'] = { x: 320, y: 0, w: Game.WIDTH - 320, h: 200 };
this.rooms['Kerstin'] = { x: 320, y: 400, w: Game.WIDTH - 320, h: Game.HEIGHT - 400 };
// Attach room reference to each child for easy lookup
for (const child of this.children) {
child.room = this.rooms[child.name];
}

// Initialise roaming cats. Lova and Kasper start active. Bella
// begins outside the house (inactive) and will be spawned when
// the player answers the scratch at the door. Each cat is
// given a bounding rectangle that limits its movement.
// Lova wanders in Arvid's room.
const arvidRoom = this.rooms['Arvid'];
const lovaX = arvidRoom.x + arvidRoom.w / 2;
const lovaY = arvidRoom.y + arvidRoom.h / 2;
const lova = new Cat('Lova', lovaX, lovaY, { x: arvidRoom.x, y: arvidRoom.y, w: arvidRoom.w, h: arvidRoom.h });
lova.active = true;
this.cats.push(lova);
// Kasper wanders in the hall and Kerstin's room (combined). Define a
// bounding box covering x=200..600, y=200..600 (hallway and
// Kerstins room).
const kasperBounds = { x: 200, y: 200, w: 400, h: 400 };
const kasperX = kasperBounds.x + kasperBounds.w / 2;
const kasperY = kasperBounds.y + kasperBounds.h / 2;
const kasper = new Cat('Kasper', kasperX, kasperY, kasperBounds);
kasper.active = true;
this.cats.push(kasper);
// Bella starts outside the house; she will enter via an event. Give
// her a default bounding box of the entire house. Spawn her off
// screen to the bottom of the stairwell.
const bella = new Cat('Bella', 260, Game.HEIGHT - 20, { x: 0, y: 0, w: Game.WIDTH, h: Game.HEIGHT });
bella.active = false;
this.cats.push(bella);
// Do not show the scratch bubble immediately. It will appear
// after the bellaTimer counts down to zero.
this.bellaScratch = false;
// Input listeners
window.addEventListener('keydown', e => {
this.keys[e.code] = true;
// Toggle ear cover on keyE
if (e.code === 'KeyE') {
this.player.holdEars = true;
}
// Toggle debug teleport with T key
if (e.code === 'KeyT') {
this.player.debugTeleport = !this.player.debugTeleport;
messageLog.add(this.player.debugTeleport ? 'Debug teleport på.' : 'Debug teleport av.', 2000);
}
});
window.addEventListener('keyup', e => {
this.keys[e.code] = false;
if (e.code === 'KeyE') {
this.player.holdEars = false;
}
});
// Allow repositioning via mouse click for convenience. Useful when running
// in environments where keyboard input is unavailable. The click moves
// Pappa moves to the clicked location using pathfinding. When
// debugTeleport is enabled, he teleports instantly as before. In
// normal mode, clicking computes a path and sets it on the player.
this.canvas.addEventListener('click', e => {
const clickX = clamp(e.offsetX, 0, Game.WIDTH);
const clickY = clamp(e.offsetY, 0, Game.HEIGHT);
if (this.player.debugTeleport) {
// Teleport directly and clear any path
const clampedX = clamp(clickX - this.player.w / 2, 0, Game.WIDTH - this.player.w);
const clampedY = clamp(clickY - this.player.h / 2, 0, Game.HEIGHT - this.player.h);
this.player.x = clampedX;
this.player.y = clampedY;
this.player.path = [];
} else {
// Compute path from current centre to clicked point
const startX = this.player.x + this.player.w / 2;
const startY = this.player.y + this.player.h / 2;
const path = this.findPath(startX, startY, clickX, clickY);
if (path && path.length > 0) {
// Remove the first node if it corresponds to the current cell
const first = path[0];
const dx = Math.abs(first.x - startX);
const dy = Math.abs(first.y - startY);
if (dx < this.cellSize / 2 && dy < this.cellSize / 2) {
path.shift();
}
this.player.path = path;
} else {
// If no path found, do nothing
}
}
});
// Start loop
this.lastTime = performance.now();
requestAnimationFrame(this.loop.bind(this));
}
buildLayout() {
const obs = this.obstacles;
const objs = this.interactives;
const WT = 8; // wall thickness
const DW = 20; // doorway width
/*
* Original design included vertical dividing walls at x=200 and x=300.
* To improve navigation the user requested removing the vertical segments
* marked in their screenshot. Therefore we no longer push those
* obstacles here. The horizontal walls remain for visual separation
* but they do not block movement.
*/
// Horizontal wall segments at y=200 and y=400 act purely as visual
// separators between rooms. They should not block movement for
// pathfinding, so we mark them with blocking: false. Removing
// blocking behaviour fixes an issue where Pappa could not reach
// the far right side of the house due to the grid centre falling
// inside these thin walls. Visual wall drawing is still handled
// in drawRooms().
// y=200 walls: left and right segments
obs.push({ x: 0, y: 200, w: 200, h: WT, blocking: false });
// Middle segment removed (was 220..300)
obs.push({ x: 320, y: 200, w: 280, h: WT, blocking: false });
// y=400 walls: three segments
obs.push({ x: 0, y: 400, w: 200, h: WT, blocking: false });
obs.push({ x: 220, y: 400, w: 80, h: WT, blocking: false });
obs.push({ x: 320, y: 400, w: 280, h: WT, blocking: false });
// Furniture and fixtures (obstacles)
// Bathroom fixtures
obs.push({ x: 20, y: 20, w: 160, h: 60, type: 'tub' });
obs.push({ x: 20, y: 140, w: 40, h: 40, type: 'toilet' });
obs.push({ x: 100, y: 140, w: 60, h: 40, type: 'sink' });
// Closet is both an obstacle and interactive (for toapapper quest)
// Closet removed as an interactive pick up; toapapper is now on the
// downstairs level.
// Living room furniture
obs.push({ x: 40, y: 220, w: 120, h: 40, type: 'sofa' });
obs.push({ x: 40, y: 320, w: 120, h: 40, type: 'sofa' });
obs.push({ x: 80, y: 270, w: 60, h: 40, type: 'table' });
obs.push({ x: 0, y: 320, w: 40, h: 60, type: 'tv' });
// Guest/office furniture
obs.push({ x: 40, y: 420, w: 100, h: 60, type: 'bed_guest' });
obs.push({ x: 110, y: 480, w: 70, h: 60, type: 'desk_office' });
// Arvid's room furniture
obs.push({ x: 450, y: 100, w: 120, h: 60, type: 'bed_arvid' });
obs.push({ x: 520, y: 20, w: 60, h: 80, type: 'desk_arvid' });
obs.push({ x: 300, y: 20, w: 60, h: 80, type: 'wardrobe' });
// Parent's bedroom furniture
obs.push({ x: 400, y: 260, w: 180, h: 100, type: 'bed_parents' });
// charger: interactive but not obstacle
objs.push({ x: 380, y: 260, w: 40, h: 20, type: 'charger', collected: false });
// Kerstin's room furniture
obs.push({ x: 400, y: 420, w: 140, h: 60, type: 'bed_kerstin' });
obs.push({ x: 500, y: 480, w: 60, h: 60, type: 'desk_kerstin' });
obs.push({ x: 560, y: 480, w: 40, h: 60, type: 'bookshelf' });
// New vertical wall with a doorway separating Arvids rum from the
// hallway. There is an opening between y=80 and y=140.
const doorWallX = 300;
const doorThickness = WT;
// Upper and lower parts of the wall are drawn for visual separation
// but do not block movement. Without setting blocking:false here
// certain grid cells ended up being considered blocked in the
// pathfinding grid, preventing Pappa from reaching the far right
// side of Arvids rum on both desktop and mobile. By marking
// these segments as non blocking they will still render like walls
// but the navmesh will treat them as passable.
obs.push({ x: doorWallX, y: 0, w: doorThickness, h: 80, blocking: false });
obs.push({ x: doorWallX, y: 140, w: doorThickness, h: 60, blocking: false });
// Windows: interactive but not obstacles
objs.push({ x: 0, y: 40, w: 20, h: 60, type: 'window' }); // bathroom window
objs.push({ x: 580, y: 40, w: 20, h: 60, type: 'window' }); // arvid window
objs.push({ x: 580, y: 120, w: 20, h: 60, type: 'window' });
objs.push({ x: 300, y: 380, w: 20, h: 40, type: 'window' });
objs.push({ x: 580, y: 380, w: 20, h: 40, type: 'window' });
objs.push({ x: 520, y: 580, w: 60, h: 20, type: 'window' });
objs.push({ x: 0, y: 220, w: 20, h: 60, type: 'window' });
objs.push({ x: 0, y: 300, w: 20, h: 60, type: 'window' });
objs.push({ x: 0, y: 520, w: 20, h: 60, type: 'window' });
// Stairs: interactive area allowing Pappa to go downstairs. When the
// player collides with this region during relevant quests he will
// temporarily disappear to fetch an item from the lower floor.
// Represent the entire stairwell between x=200 and x=300, y=0 to 200.
objs.push({ x: 200, y: 0, w: 100, h: 200, type: 'stairs' });
// Snacks and toilet paper are fetched via the stairs instead of upstairs.
}

/** Build the walkable grid used for pathfinding. This should be
* called after obstacles are constructed. Each grid cell
* represents a square of side cellSize pixels. A cell is
* considered blocked if the centre of the cell lies inside any
* obstacle rectangle. The resulting grid is stored on the Game
* instance along with its dimensions. */
buildGrid() {
this.gridWidth = Math.ceil(Game.WIDTH / this.cellSize);
this.gridHeight = Math.ceil(Game.HEIGHT / this.cellSize);
this.grid = [];
for (let y = 0; y < this.gridHeight; y++) {
const row = [];
for (let x = 0; x < this.gridWidth; x++) {
// Compute centre of the cell in world coordinates
const cx = x * this.cellSize + this.cellSize / 2;
const cy = y * this.cellSize + this.cellSize / 2;
// Determine if this cell centre lies within any obstacle
let blocked = false;
for (const obs of this.obstacles) {
// Skip decorative walls (blocking: false) so that thin
// separators do not impede the grid. Only consider
// obstacles without blocking defined or explicitly true.
if (obs.blocking === false) continue;
// Furniture items are treated with a small margin to
// reduce their effective hitbox in pathfinding. This
// margin allows Pappa to squeeze past large sofas and
// desks without getting stuck. Walls (no type) remain
// strict boundaries (margin 0).
// Shrink the effective hitbox of furniture slightly more to
// allow Pappa to navigate around tight corners. Using a
// margin of 6 pixels ensures the far right of Arvids rum is
// reachable.
const margin = obs.type ? 10 : 0;
const minX = obs.x + margin;
const maxX = obs.x + obs.w - margin;
const minY = obs.y + margin;
const maxY = obs.y + obs.h - margin;
if (cx >= minX && cx <= maxX && cy >= minY && cy <= maxY) {
blocked = true;
break;
}
}
row.push(blocked ? 1 : 0);
}
this.grid.push(row);
}
}

/** A* pathfinding on the game's grid. Given start and target
* coordinates in pixel space, compute a list of waypoints
* representing the centre of each grid cell along the shortest
* path (using Manhattan distance as the heuristic). Returns null
* if no path is found. */
findPath(startX, startY, targetX, targetY) {
// Convert pixel coords to grid indices
const cellX = (px) => clamp(Math.floor(px / this.cellSize), 0, this.gridWidth - 1);
const cellY = (py) => clamp(Math.floor(py / this.cellSize), 0, this.gridHeight - 1);
const sx = cellX(startX);
const sy = cellY(startY);
const tx = cellX(targetX);
const ty = cellY(targetY);
// If target cell is blocked, find nearest passable neighbour
if (this.grid[ty][tx] === 1) {
// If the target cell is blocked, look in a larger neighbourhood
// around the desired location for the nearest reachable cell. A
// wider search radius makes it easier to click into tight
// corners (e.g. the far side of the parents’ bed).
let found = false;
let nearest = null;
let minDist = Infinity;
// Search radius of six cells in each direction. Increasing the
// search radius helps find a nearby passable cell in tight
// corners or along the far right side of the map where the
// target cell may be partially blocked by furniture.
const radius = 8;
for (let dy = -radius; dy <= radius; dy++) {
for (let dx = -radius; dx <= radius; dx++) {
const nx = tx + dx;
const ny = ty + dy;
if (nx >= 0 && nx < this.gridWidth && ny >= 0 && ny < this.gridHeight) {
if (this.grid[ny][nx] === 0) {
const dist = Math.abs(dx) + Math.abs(dy);
if (dist < minDist) {
minDist = dist;
nearest = { x: nx, y: ny };
found = true;
}
}
}
}
}
if (found) {
targetX = nearest.x * this.cellSize + this.cellSize / 2;
targetY = nearest.y * this.cellSize + this.cellSize / 2;
} else {
// No passable neighbour
return null;
}
}
// Recompute integer coordinates after potential adjustment
const startNode = { x: sx, y: sy };
const goalNode = { x: cellX(targetX), y: cellY(targetY) };
// A* open and closed sets
const openSet = new Set();
const closedSet = new Set();
// Maps stringified node to cost / parent
const gScore = {};
const fScore = {};
const cameFrom = {};
const nodeKey = (n) => `${n.x},${n.y}`;
// Heuristic function: Manhattan distance
const h = (n) => Math.abs(n.x - goalNode.x) + Math.abs(n.y - goalNode.y);
const startKey = nodeKey(startNode);
gScore[startKey] = 0;
fScore[startKey] = h(startNode);
openSet.add(startKey);
const dirs = [
{ dx: 1, dy: 0 },
{ dx: -1, dy: 0 },
{ dx: 0, dy: 1 },
{ dx: 0, dy: -1 },
// Diagonals allow smoother paths; include them but with a slight cost multiplier
{ dx: 1, dy: 1 },
{ dx: 1, dy: -1 },
{ dx: -1, dy: 1 },
{ dx: -1, dy: -1 }
];
while (openSet.size > 0) {
// Find node in open set with lowest fScore
let currentKey = null;
let currentNode = null;
let lowestF = Infinity;
for (const key of openSet) {
const score = fScore[key];
if (score < lowestF) {
lowestF = score;
currentKey = key;
}
}
if (!currentKey) break;
const parts = currentKey.split(',');
currentNode = { x: parseInt(parts[0], 10), y: parseInt(parts[1], 10) };
// Check if we reached the goal
if (currentNode.x === goalNode.x && currentNode.y === goalNode.y) {
// Reconstruct path
const path = [];
let ck = currentKey;
while (ck) {
const [ix, iy] = ck.split(',').map(n => parseInt(n, 10));
const wx = ix * this.cellSize + this.cellSize / 2;
const wy = iy * this.cellSize + this.cellSize / 2;
path.unshift({ x: wx, y: wy });
ck = cameFrom[ck];
}
return path;
}
openSet.delete(currentKey);
closedSet.add(currentKey);
// Explore neighbours
for (const dir of dirs) {
const nx = currentNode.x + dir.dx;
const ny = currentNode.y + dir.dy;
// Skip out of bounds
if (nx < 0 || ny < 0 || nx >= this.gridWidth || ny >= this.gridHeight) continue;
// Skip blocked
if (this.grid[ny][nx] === 1) continue;
// Prevent diagonal movement through corners: if moving diagonally, both adjacent
// orthogonal neighbours must be passable
if (dir.dx !== 0 && dir.dy !== 0) {
const adj1 = { x: currentNode.x + dir.dx, y: currentNode.y };
const adj2 = { x: currentNode.x, y: currentNode.y + dir.dy };
if (this.grid[adj1.y][adj1.x] === 1 || this.grid[adj2.y][adj2.x] === 1) {
continue;
}
}
const neighbourKey = nodeKey({ x: nx, y: ny });
if (closedSet.has(neighbourKey)) continue;
const tentativeG = gScore[currentKey] + ((dir.dx !== 0 && dir.dy !== 0) ? 1.4 : 1);
if (!openSet.has(neighbourKey) || tentativeG < (gScore[neighbourKey] || Infinity)) {
cameFrom[neighbourKey] = currentKey;
gScore[neighbourKey] = tentativeG;
fScore[neighbourKey] = tentativeG + h({ x: nx, y: ny });
openSet.add(neighbourKey);
}
}
}
// No path found
return null;
}
assignQuest(child) {
// Only assign quest if player has no active quest
if (this.player.activeQuest || child.activeQuest) {
return;
}
// Enforce alternation of quests between the two children. If
// this child is not designated to give the next quest, ignore
// their request and wait for the other child. They will
// continue calling but no quest will start until it's their
// turn again.
if (this.nextQuestChildName && child.name !== this.nextQuestChildName) {
return;
}
    // Choose a random quest type for this child. Do not pick the
    // same quest type as the last quest they gave (if possible).
    let available = child.questPool.filter(t => t !== child.lastQuestType);
    if (available.length === 0) {
      // All quests have been used recently; fall back to the full pool
      available = child.questPool.slice();
    }
    // Ensure certain quests only occur when the child is physically
    // present in their room. For Arvid, the "lova" and
    // "help_computer" quests require him to be at home; if he is
    // elsewhere, remove these from the available list.  Determine
    // whether Arvid is inside his room by checking the child’s
    // bounding box against the assigned room rectangle.
    if (child.name === 'Arvid') {
      let inRoom = false;
      if (child.room) {
        inRoom = rectsIntersect(child.x, child.y, child.w, child.h,
                                child.room.x, child.room.y, child.room.w, child.room.h);
      }
      if (!inRoom) {
        available = available.filter(t => t !== 'lova' && t !== 'help_computer');
        // If removing these types leaves no quests, fall back to the
        // child's full pool excluding the last quest type and the
        // restricted types.
        if (available.length === 0) {
          available = child.questPool.filter(t => t !== child.lastQuestType && t !== 'lova' && t !== 'help_computer');
          // If still empty, just remove the restricted types
          if (available.length === 0) {
            available = child.questPool.filter(t => t !== 'lova' && t !== 'help_computer');
          }
        }
      }
    }
    const questType = available[randInt(0, available.length - 1)];
const quest = {
type: questType,
child: child,
state: 'init',
progress: 0,
description: ''
};
// Setup quest description and any special actions
switch (questType) {
case 'wasp':
quest.description = `${child.name}: GETING! Få ut den genom ett fönster.`;
break;
case 'charger':
quest.description = `${child.name}: Min iPad är snart död, kan du hämta laddsladden?`;
break;
case 'snack':
quest.description = `${child.name}: Jag är hungrig. Kan du hämta kvällsfika?`;
break;
case 'help_computer':
quest.description = `${child.name}: Min dator krånglar! Hjälp mig.`;
break;
case 'play':
quest.description = `${child.name}: Kan vi leka en stund?`;
break;
case 'toapapper':
quest.description = `${child.name}: Pappa! Jag behöver toapapper!`;
break;
case 'lova':
quest.description = `${child.name}: Ta bort Lova! Hon är i mitt rum.`;
break;
}
child.activeQuest = quest;
this.player.activeQuest = quest;
messageLog.add(quest.description, 4000);
// Special initialisation for certain quests
if (questType === 'wasp') {
// Spawn wasp at a random window location
const possibleSpawns = this.interactives.filter(o => o.type === 'window');
const spawn = possibleSpawns[randInt(0, possibleSpawns.length - 1)];
this.wasp = new Wasp(spawn.x + spawn.w / 2 - 6, spawn.y + spawn.h / 2 - 6);
quest.state = 'find_wasp';
} else if (questType === 'toapapper') {
// For the toilet paper quest Kerstin announces she needs
// to visit the bathroom and walks there rather than teleporting.
const toiletX = 40;
const toiletY = 140;
// Set a walk target near the toilet so she moves over time.
child.walkTarget = { x: toiletX + 60, y: toiletY + 10 };
child.isWalkingToToilet = true;
// Show a speech bubble as she departs for the toilet
child.speakLine = 'Pappa jag ska gå på toa';
child.speakTimer = 2000;
quest.state = 'need_paper';
} else if (questType === 'snack') {
// For snacks, Pappa needs to go downstairs. Simply set state
// to need_snack.
quest.state = 'need_snack';
} else if (questType === 'lova') {
// Activate the existing Lova cat for the quest. Lova should
// already be present in this.cats; ensure she is active and
// instruct the player to chase her away. Do not spawn a
// duplicate.
if (this.cats) {
const lova = this.cats.find(c => c.name === 'Lova');
if (lova) lova.active = true;
}
quest.state = 'catch_cat';
}
// Reposition the charger for Arvid's charger quest. Each time
// the charger quest is assigned choose a random spot from the
// predefined chargerSpots array and move the charger interactive
// object there. Reset its collected flag so it can be picked
// up. This should occur after the quest state is set to
// "get_charger" in updateQuest().
if (questType === 'charger') {
const charger = this.interactives.find(o => o.type === 'charger');
if (charger) {
const spot = this.chargerSpots[randInt(0, this.chargerSpots.length - 1)];
charger.x = spot.x;
charger.y = spot.y;
charger.collected = false;
}
}
}
updateQuest(dt) {
const quest = this.player.activeQuest;
if (!quest) return;
const child = quest.child;
switch (quest.type) {
case 'wasp':
if (quest.state === 'find_wasp') {
// Wasps move automatically in update
// If player collides with wasp, catch it
if (this.wasp && this.player.intersects(this.wasp)) {
this.player.carryItem = 'wasp';
messageLog.add('Pappa fångade getingen! Släpp ut den vid ett fönster.', 3000);
quest.state = 'carry_wasp';
this.wasp = null;
}
} else if (quest.state === 'carry_wasp') {
// Check if near window
for (const obj of this.interactives) {
if (obj.type === 'window' && rectsIntersect(this.player.x, this.player.y, this.player.w, this.player.h, obj.x, obj.y, obj.w, obj.h)) {
// Release wasp
this.player.carryItem = null;
messageLog.add('Getingen flög ut genom fönstret!', 3000);
quest.state = 'return';
break;
}
}
}
if (quest.state === 'return') {
// Return to child to complete. Standing anywhere in the child's
// room is sufficient; touching the child directly also works.
const room = child.room;
const inRoom = room && rectsIntersect(this.player.x, this.player.y, this.player.w, this.player.h, room.x, room.y, room.w, room.h);
const touching = rectsIntersect(this.player.x, this.player.y, this.player.w, this.player.h, child.x, child.y, child.w, child.h);
if (inRoom || touching) {
messageLog.add(`${child.name}: Tack så mycket!`, 3000);
this.finishQuest(quest);
}
}
break;
case 'charger':
if (quest.state === 'init') {
quest.state = 'get_charger';
}
if (quest.state === 'get_charger') {
// Find charger interactive object
const charger = this.interactives.find(o => o.type === 'charger' && !o.collected);
if (charger && rectsIntersect(this.player.x, this.player.y, this.player.w, this.player.h, charger.x, charger.y, charger.w, charger.h)) {
charger.collected = true;
this.player.carryItem = 'charger';
messageLog.add('Pappa hittade laddsladden.', 2000);
quest.state = 'deliver_charger';
}
} else if (quest.state === 'deliver_charger') {
// Deliver when Pappa enters the child's room instead of having
// to touch the child directly.
const room = child.room;
        if (this.player.carryItem === 'charger' && room && rectsIntersect(this.player.x, this.player.y, this.player.w, this.player.h, room.x, room.y, room.w, room.h)) {
          this.player.carryItem = null;
          messageLog.add(`${child.name}: Tack för laddsladden!`, 3000);
          this.finishQuest(quest);
          // After delivering the charger, send Arvid back to his room
          if (child && child.name === 'Arvid') {
            child.returningHome = true;
          }
        }
}
break;
case 'snack': {
// Kerstin wants Pappa to fetch a snack from downstairs.
if (quest.state === 'need_snack') {
// Check if Pappa is at the stairs to go downstairs
const stairs = this.interactives.find(o => o.type === 'stairs');
if (stairs && rectsIntersect(this.player.x, this.player.y, this.player.w, this.player.h, stairs.x, stairs.y, stairs.w, stairs.h)) {
// Start going downstairs if not already doing so
if (!this.player.isDownstairs) {
this.player.isDownstairs = true;
this.player.downTimer = 0;
this.player.downType = 'snack';
this.player.downQuest = quest;
quest.state = 'getting_snack';
messageLog.add('Pappa går ner för att hämta kvällsfika...', 3000);
}
}
} else if (quest.state === 'deliver_snack') {
// Deliver snack directly to the child rather than just
// entering their room. This makes it clear that Pappa
// needs to find the child wherever she currently is (she
// may have wandered) and hand over the snack.
if (this.player.carryItem === 'snack' && rectsIntersect(this.player.x, this.player.y, this.player.w, this.player.h, child.x, child.y, child.w, child.h)) {
this.player.carryItem = null;
messageLog.add(`${child.name}: Mums!`, 3000);
this.finishQuest(quest);
}
}
break;
}
case 'help_computer':
if (quest.state === 'init') quest.state = 'go_desk';
if (quest.state === 'go_desk') {
// Determine correct desk based on child
const targetDesk = this.obstacles.find(o => o.type === 'desk_' + child.name.toLowerCase());
if (targetDesk && rectsIntersect(this.player.x, this.player.y, this.player.w, this.player.h, targetDesk.x, targetDesk.y, targetDesk.w, targetDesk.h)) {
        quest.state = 'fixing';
        quest.progress = 0;
        messageLog.add('Pappa fixar datorn...', 2000);
        // Once Pappa starts working on the computer, have Arvid
        // return to his room so he doesn’t continue following
        // Pappa around.  Only Arvid has this quest type.
        if (child && child.name === 'Arvid') {
          child.returningHome = true;
        }
}
} else if (quest.state === 'fixing') {
quest.progress += dt;
if (quest.progress >= 4) {
messageLog.add(`${child.name}: Nu funkar det! Tack!`, 3000);
this.finishQuest(quest);
}
}
break;
case 'play': {
if (quest.state === 'init') quest.state = 'play_with_child';
if (quest.state === 'play_with_child') {
// Play quests now behave the same for both Arvid and Kerstin:
// stay close to the child for a few seconds to complete the
// activity. For Arvid we still allow a generous margin so
// the player doesn’t need to stand exactly on top of him.
const playMargin = child.name === 'Arvid' ? 40 : 20;
if (rectsIntersect(this.player.x, this.player.y, this.player.w, this.player.h, child.x - playMargin, child.y - playMargin, child.w + playMargin * 2, child.h + playMargin * 2)) {
quest.progress += dt;
// Require roughly five seconds of proximity for play quests
if (quest.progress >= 5) {
// Instead of saying "Tack pappa" after play, Kerstin keeps
// her playful tone by saying "Leka mer!" once finished. For
// other children we keep the default thank you message.
if (child.name === 'Kerstin') {
child.speakLine = 'Leka mer!';
child.speakTimer = 2000;
} else {
child.speakLine = `${child.name}: Det var kul!`;
child.speakTimer = 2000;
}
this.finishQuest(quest);
}
} else {
// Lose some progress if Pappa strays too far
if (quest.progress > 0) {
quest.progress = Math.max(0, quest.progress - dt * 0.5);
}
}
}
break;
}
case 'toapapper': {
// Kerstin needs toilet paper. Pappa must go downstairs to fetch it.
if (quest.state === 'need_paper') {
// Check if Pappa is at stairs
const stairs = this.interactives.find(o => o.type === 'stairs');
if (stairs && rectsIntersect(this.player.x, this.player.y, this.player.w, this.player.h, stairs.x, stairs.y, stairs.w, stairs.h)) {
if (!this.player.isDownstairs) {
this.player.isDownstairs = true;
this.player.downTimer = 0;
this.player.downType = 'toapapper';
this.player.downQuest = quest;
quest.state = 'getting_paper';
messageLog.add('Pappa går ner för att hämta toapapper...', 3000);
}
}
} else if (quest.state === 'deliver_paper') {
// Deliver the toilet paper directly to the child. Pappa must
// collide with Kerstin wherever she happens to be rather than
// simply entering her room. This allows her to wander while
// Pappa searches for her.
if (this.player.carryItem === 'toapapper' && rectsIntersect(this.player.x, this.player.y, this.player.w, this.player.h, child.x, child.y, child.w, child.h)) {
this.player.carryItem = null;
messageLog.add(`${child.name}: Äntligen!`, 3000);
// After receiving the paper, Kerstin returns to the sofa
if (child.name === 'Kerstin') {
child.x = 80;
child.y = 240;
child.isWalkingToToilet = false;
child.walkTarget = null;
}
this.finishQuest(quest);
}
}
break;
}
case 'lova': {
// Arvid wants Pappa to chase away the cat Lova
if (quest.state === 'catch_cat') {
// Find the Lova cat in the cats array
if (this.cats) {
const lova = this.cats.find(c => c.name === 'Lova' && c.active);
if (lova && this.player.intersects(lova)) {
// Cat runs away: deactivate it
lova.active = false;
messageLog.add('Pappa bar ut Lova.', 2000);
          quest.state = 'return';
          // Pappa has carried out Lova; send Arvid back to his room
          if (child && child.name === 'Arvid') {
            child.returningHome = true;
          }
}
}
} else if (quest.state === 'return') {
if (rectsIntersect(this.player.x, this.player.y, this.player.w, this.player.h, child.x, child.y, child.w, child.h)) {
messageLog.add(`${child.name}: Såja, tack!`, 3000);
this.finishQuest(quest);
}
}
break;
}
}
}
finishQuest(quest) {
// Give points
this.player.points += 10;
// Reset child's quest state
quest.child.activeQuest = null;
this.player.activeQuest = null;
// Remove any temporary entities
if (quest.type === 'wasp') {
this.wasp = null;
}
// Reset child's call timer so they wait several seconds before
// calling again. A longer pause prevents rapid quest chaining
// and gives the player some breathing room between tasks.
// Kerstin takes a slightly longer break than Arvid before her
// next call to avoid immediate follow ups.
if (quest.child && quest.child.name === 'Kerstin') {
quest.child.callTimer = -8000;
} else {
quest.child.callTimer = -5000;
}
// Show a thank you speech bubble for a short time using speakLine
// Play quests with Kerstin use a different message ("Leka mer!") set
// before calling finishQuest(), so avoid overriding it here. For
// all other quests we default to "Tack pappa!".
if (!(quest.type === 'play' && quest.child && quest.child.name === 'Kerstin')) {
quest.child.speakLine = 'Tack pappa!';
quest.child.speakTimer = 2000;
}

// Remember the quest type on the child so we don’t repeat the same
// task consecutively. This value is checked when selecting a
// new quest in assignQuest().
if (quest.child) {
quest.child.lastQuestType = quest.type;
}

// Toggle which child should give the next quest. Alternate
// between Arvid and Kerstin so the children take turns.
if (quest.child) {
this.nextQuestChildName = (quest.child.name === 'Arvid' ? 'Kerstin' : 'Arvid');
}
// Reset thankTimer (legacy) just in case
quest.child.thankTimer = 0;
}
loop(now) {
const dt = (now - this.lastTime) / 1000;
this.update(dt);
this.draw();
this.lastTime = now;
requestAnimationFrame(this.loop.bind(this));
}
update(dt) {
// If Pappa is downstairs fetching an item, update the timer and skip
// other updates until he returns. While downstairs we still update
// the dialogue and HUD.
if (this.player.isDownstairs) {
this.player.downTimer += dt;
// After 3 seconds he returns with the requested item
if (this.player.downTimer >= 3) {
const type = this.player.downType;
const quest = this.player.downQuest;
// Provide the item corresponding to the downstairs errand
if (type === 'snack') {
this.player.carryItem = 'snack';
quest.state = 'deliver_snack';
messageLog.add('Pappa hämtade kvällsfika.', 3000);
} else if (type === 'toapapper') {
this.player.carryItem = 'toapapper';
quest.state = 'deliver_paper';
messageLog.add('Pappa hämtade toapapper.', 3000);
}
// Reappear at top of stairs
this.player.x = 240;
this.player.y = 160;
this.player.isDownstairs = false;
this.player.downType = null;
this.player.downQuest = null;
}
// Update HUD and message log while waiting
document.getElementById('hp').textContent = `HP: ${Math.floor(this.player.hp)}`;
document.getElementById('points').textContent = `Poäng: ${this.player.points}`;
messageLog.update();
return;
}

// Countdown to when Bella starts scratching at the door. Only
// decrease the timer if Bella hasn’t spawned yet. Once the
// timer reaches zero the scratch bubble will be displayed.
if (!this.bellaSpawned && this.bellaTimer > 0) {
this.bellaTimer -= dt;
if (this.bellaTimer <= 0) {
this.bellaScratch = true;
}
}

// Input toggles for resting: if HP below threshold then require rest
// Low HP warning and rest recommendation. When Pappa's HP drops
// below or equal to 25 for the first time in a low HP cycle, display
// a yawning message and start a brief red blink overlay. The
// warning is only shown once until Pappa has regained HP above
// the threshold.
if (!this.hpWarningShown && this.player.hp <= 25) {
// Display a more descriptive warning when Pappa is exhausted. He
// looks bewildered and in need of quiet rather than just
// yawning.
messageLog.add('Pappa gapar och ser förvirrad ut. Han behöver lugn och ro.', 3000);
this.hpWarningTimer = 1.0;
this.hpWarningShown = true;
}
// Update player
this.player.update(dt, this.keys, this.obstacles, this.interactives);

// Handle the Bella door event. If Bella has not yet spawned,
// display a scratch bubble at the stairs and wait for Pappa to
// investigate. When Pappa reaches the stairs (and is not
// currently on a downstairs quest), spawn Bella inside and play
// a door sound message. This can trigger even when other
// quests are active, but will not interfere with snack or
// toapapper errands.
if (!this.bellaSpawned) {
const stairs = this.interactives.find(o => o.type === 'stairs');
if (stairs) {
// Check if Pappa has reached the stairs area
const touchingStairs = rectsIntersect(this.player.x, this.player.y, this.player.w, this.player.h, stairs.x, stairs.y, stairs.w, stairs.h);
// Only trigger if Pappa is not going downstairs for another quest
const isBusyDown = this.player.isDownstairs || (this.player.activeQuest && (this.player.activeQuest.type === 'snack' || this.player.activeQuest.type === 'toapapper'));
if (touchingStairs && !isBusyDown) {
// Spawn Bella
const bella = this.cats.find(c => c.name === 'Bella');
if (bella) {
bella.active = true;
// Place Bella at the bottom of the stairs (slightly below)
bella.x = stairs.x + stairs.w / 2 - bella.w / 2;
bella.y = stairs.y + stairs.h + 4;
// Make Bella meow as she enters
bella.meowText = 'Määäh. Määääh';
bella.meowTimer = 2.0;
}
this.bellaSpawned = true;
this.bellaScratch = false;
messageLog.add('Dörren nere öppnas och stängs.', 3000);
}
}
}
// Update all cats
if (this.cats) {
for (const cat of this.cats) {
cat.update(dt);
}
}
// Check for rest conditions: if player collides with bed and chooses to rest (press R) or automatically when HP low
let atBed = false;
for (const obj of this.obstacles) {
if (obj.type && obj.type.startsWith('bed') && rectsIntersect(this.player.x, this.player.y, this.player.w, this.player.h, obj.x, obj.y, obj.w, obj.h)) {
atBed = true;
break;
}
}
// Automatically initiate rest when HP is very low and Pappa is at a bed.
// The threshold is lowered to 25 to match the warning. When resting
// begins the player will recover HP until 80 as before.
if (this.player.hp <= 25 && atBed) {
if (!this.player.isResting) {
this.player.isResting = true;
this.player.restTimer = 0;
messageLog.add('Pappa lägger sig för att vila...', 3000);
}
}
// Update children (calls)
for (const child of this.children) {
child.update(dt, this.player);
}
// Check interactions with children to stop calls and assign quests
for (const child of this.children) {
// Determine if Pappa is within the child's personal space or in
// their room. Entering the room should be enough to trigger a
// quest assignment or complete certain tasks.
const playerRect = { x: this.player.x, y: this.player.y, w: this.player.w, h: this.player.h };
const inRoom = child.room && rectsIntersect(playerRect.x, playerRect.y, playerRect.w, playerRect.h, child.room.x, child.room.y, child.room.w, child.room.h);
const touchingChild = rectsIntersect(playerRect.x, playerRect.y, playerRect.w, playerRect.h, child.x, child.y, child.w, child.h);
if (inRoom || touchingChild) {
// Stop calls when Pappa arrives in the room
child.isCalling = false;
child.callTimer = 0;
child.callElapsed = 0;
// Only assign new quest if none active on either side
if (!this.player.activeQuest && !child.activeQuest) {
this.assignQuest(child);
}

// Trigger a friendly greeting from Pappa when he enters or passes
// a child. Use greetCooldown to avoid spamming the same
// message repeatedly when lingering near the child. Only greet
// if Pappa isn't already speaking.
if (this.player.greetCooldown <= 0 && this.player.speakTimer <= 0) {
this.player.speakLine = 'Hej älsklingen!';
this.player.speakTimer = 2; // seconds
this.player.greetCooldown = 15; // wait at least 4 seconds before greeting again
}
}
}
// Update quest logic
this.updateQuest(dt);
// Update wasp if exists
if (this.wasp) {
this.wasp.update(dt);
}
// Reduce HP gradually if hold ears? Not needed
// Ensure HP stays within bounds
this.player.hp = clamp(this.player.hp, 0, 100);

    // If there is no active quest (neither Pappa nor either child has
    // an assigned quest) for a period of time, automatically assign
    // the next quest in rotation to keep the game flowing.  This
    // prevents players from having to walk back to the children to
    // request a new task.  Increment the noQuestTimer when idle and
    // reset it whenever a quest is in progress.
    const anyActiveChildQuest = this.children.some(c => c.activeQuest);
    if (!this.player.activeQuest && !anyActiveChildQuest) {
      this.noQuestTimer += dt;
      if (this.noQuestTimer >= 10) {
        // Find the child who should receive the next quest based on
        // alternation.  If not specified or missing, default to the
        // first child.
        let targetChild = null;
        if (this.nextQuestChildName) {
          targetChild = this.children.find(c => c.name === this.nextQuestChildName);
        }
        if (!targetChild && this.children.length > 0) {
          targetChild = this.children[0];
        }
        if (targetChild) {
          this.assignQuest(targetChild);
        }
        this.noQuestTimer = 0;
      }
    } else {
      this.noQuestTimer = 0;
    }

// Manage HP warning timer. The timer decrements over real time and
// resets once Pappa has regained sufficient HP (>30) or when
// depleted. When HP climbs above 30 the warning can be shown
// again on the next drop below threshold.
if (this.hpWarningTimer > 0) {
this.hpWarningTimer -= dt;
if (this.hpWarningTimer < 0) this.hpWarningTimer = 0;
}
if (this.player.hp > 30) {
this.hpWarningShown = false;
}
// Update HUD
document.getElementById('hp').textContent = `HP: ${Math.floor(this.player.hp)}`;
document.getElementById('points').textContent = `Poäng: ${this.player.points}`;
// Update quest indicator and progress bar. Show the current
// active quest description or a dash when no quest is active.
const questEl = document.getElementById('quest');
const progressBar = document.getElementById('progress-bar');
if (questEl && progressBar) {
if (this.player.activeQuest) {
questEl.textContent = 'Uppdrag: ' + this.player.activeQuest.description;
// Determine progress fraction for timed quests
let frac = 0;
const q = this.player.activeQuest;
if (q.type === 'help_computer' && q.state === 'fixing') {
frac = clamp(q.progress / 4, 0, 1);
} else if (q.type === 'play' && q.state === 'play_with_child') {
// Arvid play quest lasts 5 seconds, Kerstin play quest uses escort with no timer
frac = clamp(q.progress / 5, 0, 1);
} else {
frac = 0;
}
progressBar.style.width = (frac * 100) + '%';
} else {
questEl.textContent = 'Uppdrag: –';
progressBar.style.width = '0%';
}
}
// Update message log
messageLog.update();
}
draw() {
const ctx = this.ctx;
ctx.clearRect(0, 0, Game.WIDTH, Game.HEIGHT);
// Draw rooms backgrounds
this.drawRooms(ctx);
// Draw obstacles (furniture) for debugging or decoration
this.drawFurniture(ctx);
// Draw interactive icons (charger, snack, closet) if not collected
for (const obj of this.interactives) {
if (obj.type === 'charger' && !obj.collected) {
ctx.fillStyle = '#ffde6a';
ctx.fillRect(obj.x + obj.w / 4, obj.y + obj.h / 4, obj.w / 2, obj.h / 2);
} else if (obj.type === 'snack' && !obj.collected) {
ctx.fillStyle = '#d2815a';
ctx.fillRect(obj.x + 2, obj.y + 2, obj.w - 4, obj.h - 4);
} else if (obj.type === 'window') {
ctx.fillStyle = 'rgba(173, 216, 230, 0.5)';
ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
} else if (obj.type === 'closet' && !obj.collected) {
ctx.fillStyle = '#8b6a4f';
ctx.fillRect(obj.x + 2, obj.y + 2, obj.w - 4, obj.h - 4);
}
}
// Draw wasp
if (this.wasp) {
this.wasp.draw(ctx);
}
// Draw all cats
if (this.cats) {
for (const cat of this.cats) {
cat.draw(ctx);
}
}
// Draw children
for (const child of this.children) {
child.draw(ctx);
}
        // Draw player
        // When Pappa is downstairs he is hidden; otherwise draw him
        if (!this.player.isDownstairs) {
          this.player.draw(ctx);
          // Draw a quest progress bar above Pappa when he is performing
          // a timed activity (e.g. fixing a computer or playing).  The
          // bar shows the fraction of the task completed and stays
          // positioned relative to Pappa’s sprite.  Only draw if
          // there is measurable progress on a quest.
          if (this.player.activeQuest) {
            const q = this.player.activeQuest;
            let frac = 0;
            if (q.type === 'help_computer' && q.state === 'fixing') {
              frac = clamp(q.progress / 4, 0, 1);
            } else if (q.type === 'play' && q.state === 'play_with_child') {
              // Play quests complete after approximately five seconds
              frac = clamp(q.progress / 5, 0, 1);
            }
            if (frac > 0) {
              const barW = 40;
              const barH = 6;
              const px = this.player.x + this.player.w / 2 - barW / 2;
              const py = this.player.y - 14;
              // Background of progress bar
              ctx.fillStyle = 'rgba(255,255,255,0.8)';
              ctx.fillRect(px, py, barW, barH);
              // Filled portion
              ctx.fillStyle = '#4caf50';
              ctx.fillRect(px, py, barW * frac, barH);
              // Outline
              ctx.strokeStyle = '#333';
              ctx.lineWidth = 1;
              ctx.strokeRect(px, py, barW, barH);
            }
          }
        } else {
// Draw a mumbling bubble at the stairs to indicate Pappa is away
const stairs = this.interactives.find(o => o.type === 'stairs');
if (stairs) {
// Text may be longer than one line; break it manually
const lines = ['Pappa mumlar', 'och pratar för sig själv.'];
const text = lines.join('\n');
const centerX = stairs.x + stairs.w / 2;
const centerY = stairs.y + 80;
const bubbleW = 180;
const bubbleH = 40;
const bx = centerX - bubbleW / 2;
const by = centerY - bubbleH;
ctx.fillStyle = 'rgba(255,255,255,0.9)';
ctx.strokeStyle = '#333';
ctx.lineWidth = 1;
ctx.beginPath();
ctx.moveTo(bx + 5, by);
ctx.lineTo(bx + bubbleW - 5, by);
ctx.quadraticCurveTo(bx + bubbleW, by, bx + bubbleW, by + 5);
ctx.lineTo(bx + bubbleW, by + bubbleH - 5);
ctx.quadraticCurveTo(bx + bubbleW, by + bubbleH, bx + bubbleW - 5, by + bubbleH);
ctx.lineTo(bx + 15, by + bubbleH);
// Tail pointing upward into stairs
ctx.lineTo(bx + 10, by + bubbleH + 6);
ctx.lineTo(bx + 5, by + bubbleH);
ctx.lineTo(bx + 5, by + 5);
ctx.quadraticCurveTo(bx + 5, by, bx + 10, by);
ctx.closePath();
ctx.fill();
ctx.stroke();
ctx.fillStyle = '#333';
ctx.font = '12px sans-serif';
ctx.fillText(lines[0], bx + 8, by + 16);
ctx.fillText(lines[1], bx + 8, by + 28);
}
}

// Draw a semi transparent red overlay when HP warning is active. This
// provides a visual cue that Pappa is exhausted. The overlay fades
// as the timer counts down.
if (this.hpWarningTimer > 0) {
const alpha = Math.min(0.4, this.hpWarningTimer); // alpha up to 0.4
ctx.fillStyle = `rgba(255, 0, 0, ${alpha})`;
ctx.fillRect(0, 0, Game.WIDTH, Game.HEIGHT);
}

// Draw scratch bubble at the stairs to hint about Bella if she has
// not yet entered the house. The bubble appears just above the
// stairwell and is removed once Bella spawns.
if (!this.bellaSpawned && this.bellaScratch) {
const stairs = this.interactives.find(o => o.type === 'stairs');
if (stairs) {
const text = 'Klös, klös, klös, klös';
ctx.font = '12px sans-serif';
const paddingX = 6;
const textWidth = ctx.measureText(text).width;
const bubbleW = Math.max(80, textWidth + paddingX * 2);
const bubbleH = 24;
const bx = stairs.x + stairs.w / 2 - bubbleW / 2;
const by = stairs.y + stairs.h + 8; // position below the stair area
ctx.fillStyle = 'rgba(255,255,255,0.9)';
ctx.strokeStyle = '#333';
ctx.lineWidth = 1;
ctx.beginPath();
ctx.moveTo(bx + 5, by);
ctx.lineTo(bx + bubbleW - 5, by);
ctx.quadraticCurveTo(bx + bubbleW, by, bx + bubbleW, by + 5);
ctx.lineTo(bx + bubbleW, by + bubbleH - 5);
ctx.quadraticCurveTo(bx + bubbleW, by + bubbleH, bx + bubbleW - 5, by + bubbleH);
ctx.lineTo(bx + 15, by + bubbleH);
ctx.lineTo(bx + 10, by + bubbleH + 6);
ctx.lineTo(bx + 5, by + bubbleH);
ctx.lineTo(bx + 5, by + 5);
ctx.quadraticCurveTo(bx + 5, by, bx + 10, by);
ctx.closePath();
ctx.fill();
ctx.stroke();
ctx.fillStyle = '#333';
ctx.fillText(text, bx + paddingX, by + 15);
}
}
}
drawRooms(ctx) {
// Fill each room with a subtle background color
// Bathroom
ctx.fillStyle = '#e5f0f9';
ctx.fillRect(0, 0, 200, 200);
// Stairs/hall top area (non walkable – dark to indicate stairs)
// Draw the stairwell with alternating shades to look like steps. We
// alternate colours every half step to simulate a set of stairs.
const stairX = 200;
const stairY = 0;
const stairW = 100;
const stairH = 200;
const stepHeight = 20;
for (let i = 0; i < stairH; i += stepHeight) {
// Alternate between two grey tones
const shade = (i / stepHeight) % 2 === 0 ? '#c8ced3' : '#bfc5cb';
ctx.fillStyle = shade;
// Draw only the top half of the step to create a subtle edge
ctx.fillRect(stairX, stairY + i, stairW, stepHeight);
}
// Arvid's room
ctx.fillStyle = '#f5f0e1';
ctx.fillRect(300, 0, 300, 200);
// Living area
ctx.fillStyle = '#f4f4f4';
ctx.fillRect(0, 200, 200, 200);
// Hallway
ctx.fillStyle = '#e9e9e9';
ctx.fillRect(200, 200, 100, 200);
// Parent's room
ctx.fillStyle = '#fff7e8';
ctx.fillRect(300, 200, 300, 200);
// Guest room/office
ctx.fillStyle = '#f0e8f8';
ctx.fillRect(0, 400, 200, 200);
// Kerstin's room
ctx.fillStyle = '#fdf0f5';
ctx.fillRect(300, 400, 300, 200);
// Draw walls (for visual aesthetics)
ctx.fillStyle = '#555';
for (const w of this.obstacles) {
// draw only wall segments (no type property)
if (!w.type) {
ctx.fillRect(w.x, w.y, w.w, w.h);
}
}
}
drawFurniture(ctx) {
// Draw furniture as slightly darker blocks
for (const obj of this.obstacles) {
if (obj.type) {
let color = '#c0b8a0';
if (obj.type.includes('bed')) color = '#c2dfff';
else if (obj.type.includes('desk')) color = '#d1c0b5';
else if (obj.type.includes('sofa')) color = '#95cfff';
else if (obj.type.includes('table')) color = '#e7d9b0';
else if (obj.type === 'tv') color = '#404040';
else if (obj.type === 'wardrobe' || obj.type === 'bookshelf' || obj.type === 'closet') color = '#9c7a56';
else if (obj.type === 'tub') color = '#dedede';
else if (obj.type === 'toilet') color = '#ffffff';
else if (obj.type === 'sink') color = '#e8e8e8';
ctx.fillStyle = color;
ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
}
}
}
}

// Initialise global message log
const messageLog = new MessageLog(document.getElementById('dialogue'));

// Expose Game and messageLog to the global scope. This allows the
// title screen code in index.html to instantiate and control the
// game. Do not automatically create or start a game here.
window.Game = Game;
window.messageLog = messageLog;
})();
