/*
 * Pappa Quest - a small top‑down game built with HTML5 canvas.
 *
 * The game loosely recreates the floor plan provided by the user.  Rooms are
 * defined as simple rectangles with furniture and walls represented by
 * rectangular obstacles.  You control Pappa, who receives quests from his
 * children Arvid and Kerstin.  While you work on one quest the other child
 * keeps calling “Pappa!”, draining your stamina.  Complete quests to earn
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

  // Simple message manager that keeps a queue of messages and displays
  // the most recent few in the dialogue area.  Messages automatically
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

      // Whether Pappa is downstairs fetching an item.  When true he is
      // temporarily hidden from the upstairs floor.  downTimer tracks the
      // elapsed time spent downstairs and downType identifies the item being
      // retrieved (e.g. 'snack' or 'toapapper').  downQuest references the
      // quest waiting on this item so we can update its state when he
      // returns.
      this.isDownstairs = false;
      this.downTimer = 0;
      this.downType = null;
      this.downQuest = null;
    }
    update(dt, keys, obstacles, interactiveObjs) {
      // Handle resting: if resting, we can't move and we recover HP
      if (this.isResting) {
        this.dx = 0;
        this.dy = 0;
        this.restTimer += dt;
        // Recover HP at 20 HP per second
        this.hp = Math.min(100, this.hp + 20 * dt);
        if (this.hp >= 80) {
          this.isResting = false;
          messageLog.add('Pappa känner sig pigg igen.');
        }
      } else if (!this.isDownstairs) {
        // Movement input
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
        // Move without checking furniture collisions.  The player can
        // freely walk through furniture, which makes it easier to reach
        // children and beds.  We only clamp within the room boundaries.
        this.x = newX;
        this.y = newY;
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
      // Draw ear‑cover indicator when holding ears
      if (this.holdEars) {
        ctx.fillStyle = 'rgba(255,255,0,0.6)';
        ctx.beginPath();
        ctx.arc(cx, cy + headR, headR + 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /** Child/NPC class **/
  class Child extends Entity {
    constructor(name, x, y, questPool) {
      super(x, y, 20, 32);
      this.name = name;
      this.questPool = questPool; // array of quest types strings
      this.callTimer = 0;
      this.isCalling = false;
      this.callInterval = 2000; // ms between calls (slower so Pappa has time)
      this.activeQuest = null;
      this.yellCooldown = 0; // time since last yell for message display
      this.color = name === 'Arvid' ? '#e05d5d' : '#d68fce';
      // Running call state: used to decide when to apply HP penalty
      this.callElapsed = 0;

      // Additional state for dynamic behavior
      // Current line displayed when calling.  Arvid cycles through several
      // humorous lines rather than always yelling "Pappa!".  Kerstin keeps
      // it simple.
      this.callLine = 'Pappa!';
      // Time spent calling without receiving help.  After 15 seconds Arvid
      // will start chasing Pappa around the house.
      this.chaseTimer = 0;
      this.chaseActive = false;
      // Time remaining for a "Tack pappa!" bubble after completing a quest.
      this.thankTimer = 0;
    }
    update(dt, player) {
      if (this.activeQuest) {
        // If the player is performing this child's quest, no calls
        this.isCalling = false;
        this.callTimer = 0;
        this.chaseTimer = 0;
        this.chaseActive = false;
        return;
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
            // Choose a new line for the call bubble.  Arvid has several lines;
            // Kerstin simply yells "Pappa!".
            if (this.name === 'Arvid') {
              const lines = [
                'Pappa, pappa, pappa, pappa!',
                'Pappa, vilken är din favorit‑Titan?',
                'Pappa, vet du något om Roblox?',
                'Pappa, vet du något om rymden?'
              ];
              this.callLine = lines[randInt(0, lines.length - 1)];
            } else {
              this.callLine = 'Pappa!';
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
        this.callElapsed += dt * 1000;
        // Each second reduce HP if not holding ears and not resting
        if (this.callElapsed >= this.callInterval) {
          this.callElapsed = 0;
          if (!player.holdEars && !player.isResting) {
            player.hp = Math.max(0, player.hp - 1);
          }
        }
        // Only Arvid gets increasingly frustrated and starts chasing after 15s
        if (this.name === 'Arvid') {
          this.chaseTimer += dt;
          if (this.chaseTimer >= 15) {
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
      }
      // Decay thank timer
      if (this.thankTimer > 0) {
        this.thankTimer -= dt * 1000;
        if (this.thankTimer < 0) this.thankTimer = 0;
      }
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
      if (this.thankTimer > 0) {
        drawBubble('Tack pappa!');
      } else if (this.isCalling && !this.activeQuest) {
        drawBubble(this.callLine);
      }
      // Draw exclamation mark when child has a quest assigned (activeQuest set)
      if (this.activeQuest) {
        ctx.fillStyle = '#ffd700';
        ctx.font = '16px sans-serif';
        ctx.fillText('!', cx - 4, this.y - 8);
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

  /** Cat entity (Lova) that wanders slowly around a room.  Used for Arvid's
   *  "lova" quest. */
  class Cat extends Entity {
    constructor(x, y) {
      // Cats are slightly larger than wasps
      super(x, y, 16, 12);
      this.vx = (Math.random() * 2 - 1) * 30;
      this.vy = (Math.random() * 2 - 1) * 30;
    }
    update(dt) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      // Bounce off world boundaries
      if (this.x < 0 || this.x + this.w > Game.WIDTH) {
        this.vx *= -1;
        this.x = clamp(this.x, 0, Game.WIDTH - this.w);
      }
      if (this.y < 0 || this.y + this.h > Game.HEIGHT) {
        this.vy *= -1;
        this.y = clamp(this.y, 0, Game.HEIGHT - this.h);
      }
      // Occasionally change direction to wander
      if (Math.random() < 0.02) {
        this.vx = (Math.random() * 2 - 1) * 30;
        this.vy = (Math.random() * 2 - 1) * 30;
      }
    }
    draw(ctx) {
      // Simple cat shape: body and head
      ctx.fillStyle = '#d9a675';
      // body
      ctx.fillRect(this.x, this.y + 4, this.w, this.h - 4);
      // head
      ctx.beginPath();
      ctx.arc(this.x + this.w / 2, this.y + 4, 6, 0, Math.PI * 2);
      ctx.fill();
      // ears
      ctx.fillRect(this.x + 2, this.y, 3, 3);
      ctx.fillRect(this.x + this.w - 5, this.y, 3, 3);
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
    }
    setup() {
      // Build obstacles and interactive objects from our floor plan
      this.buildLayout();
      // Create player
      this.player = new Player(250, 300);
      // Create children
      const arvidStart = { x: 500, y: 80 };
      const kerstinStart = { x: 80, y: 240 };
      // Arvid now has an additional quest to chase away the cat Lova
      this.children.push(new Child('Arvid', arvidStart.x, arvidStart.y, ['wasp', 'charger', 'help_computer', 'play', 'lova']));
      this.children.push(new Child('Kerstin', kerstinStart.x, kerstinStart.y, ['wasp', 'snack', 'play', 'toapapper']));
      // Input listeners
      window.addEventListener('keydown', e => {
        this.keys[e.code] = true;
        // Toggle ear cover on keyE
        if (e.code === 'KeyE') {
          this.player.holdEars = true;
        }
      });
      window.addEventListener('keyup', e => {
        this.keys[e.code] = false;
        if (e.code === 'KeyE') {
          this.player.holdEars = false;
        }
      });
      // Allow repositioning via mouse click for convenience.  Useful when running
      // in environments where keyboard input is unavailable.  The click moves
      // Pappa to the clicked location if it does not collide with a wall.
      this.canvas.addEventListener('click', e => {
        const rect = this.canvas.getBoundingClientRect();
        const px = e.clientX - rect.left - this.player.w / 2;
        const py = e.clientY - rect.top - this.player.h / 2;
        // Clamp into bounds
        const clampedX = clamp(px, 0, Game.WIDTH - this.player.w);
        const clampedY = clamp(py, 0, Game.HEIGHT - this.player.h);
        // Teleport Pappa directly to the clicked location, ignoring furniture
        this.player.x = clampedX;
        this.player.y = clampedY;
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
       * marked in their screenshot.  Therefore we no longer push those
       * obstacles here.  The horizontal walls remain for visual separation
       * but they do not block movement.
       */
      // Horizontal walls at y=200
      obs.push({ x: 0, y: 200, w: 200, h: WT });
      obs.push({ x: 220, y: 200, w: 80, h: WT });
      obs.push({ x: 320, y: 200, w: 280, h: WT });
      // Horizontal walls at y=400
      obs.push({ x: 0, y: 400, w: 200, h: WT });
      obs.push({ x: 220, y: 400, w: 80, h: WT });
      obs.push({ x: 320, y: 400, w: 280, h: WT });
      // Furniture and fixtures (obstacles)
      // Bathroom fixtures
      obs.push({ x: 20, y: 20, w: 160, h: 60, type: 'tub' });
      obs.push({ x: 20, y: 140, w: 40, h: 40, type: 'toilet' });
      obs.push({ x: 100, y: 140, w: 60, h: 40, type: 'sink' });
      // Closet is both an obstacle and interactive (for toapapper quest)
      // Closet removed as an interactive pick‑up; toapapper is now on the
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
      // Stairs: interactive area allowing Pappa to go downstairs.  When the
      // player collides with this region during relevant quests he will
      // temporarily disappear to fetch an item from the lower floor.
      // Represent the entire stairwell between x=200 and x=300, y=0 to 200.
      objs.push({ x: 200, y: 0, w: 100, h: 200, type: 'stairs' });
      // Snacks and toilet paper are fetched via the stairs instead of upstairs.
    }
    assignQuest(child) {
      // Only assign quest if player has no active quest
      if (this.player.activeQuest || child.activeQuest) {
        return;
      }
      // Choose random quest type from child.questPool
      const questType = child.questPool[randInt(0, child.questPool.length - 1)];
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
          quest.description = `${child.name}: Det finns en geting här inne! Få ut den genom ett fönster.`;
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
        // For toapapper quest, Kerstin runs to the bathroom and Pappa
        // must fetch a roll downstairs via the stairs.  Move Kerstin
        // near the toilet.
        const toiletX = 40;
        const toiletY = 140;
        child.x = toiletX + 60;
        child.y = toiletY + 10;
        quest.state = 'need_paper';
      } else if (questType === 'snack') {
        // For snacks, Pappa needs to go downstairs.  Simply set state
        // to need_snack.
        quest.state = 'need_snack';
      } else if (questType === 'lova') {
        // Spawn the cat Lova in Arvid's room.  The cat wanders until
        // Pappa catches it.  Place it roughly in the centre of Arvid's room.
        const catX = 450 + 40;
        const catY = 80 + 40;
        this.cat = new Cat(catX, catY);
        quest.state = 'catch_cat';
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
            // Return to child to complete
            if (rectsIntersect(this.player.x, this.player.y, this.player.w, this.player.h, child.x, child.y, child.w, child.h)) {
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
            if (this.player.carryItem === 'charger' && rectsIntersect(this.player.x, this.player.y, this.player.w, this.player.h, child.x, child.y, child.w, child.h)) {
              this.player.carryItem = null;
              messageLog.add(`${child.name}: Tack för laddsladden!`, 3000);
              this.finishQuest(quest);
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
            // Deliver snack to child
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
            if (child.name === 'Kerstin') {
              // For Kerstin's play quest Pappa must escort her to her room.
              // If Pappa enters Kerstin's room (bottom right quadrant), move
              // Kerstin there and finish the quest.
              if (this.player.x > 300 && this.player.y > 400) {
                // Place Kerstin in her room near her bed
                child.x = 400;
                child.y = 440;
                messageLog.add(`${child.name}: Det var kul!`, 3000);
                this.finishQuest(quest);
              }
            } else {
              // Generic play: stay near child for 5 seconds
              if (rectsIntersect(this.player.x, this.player.y, this.player.w, this.player.h, child.x - 10, child.y - 10, child.w + 20, child.h + 20)) {
                quest.progress += dt;
                if (quest.progress >= 5) {
                  messageLog.add(`${child.name}: Det var kul!`, 3000);
                  this.finishQuest(quest);
                }
              } else {
                if (quest.progress > 0) {
                  quest.progress = Math.max(0, quest.progress - dt * 0.5);
                }
              }
            }
          }
          break;
        }
        case 'toapapper': {
          // Kerstin needs toilet paper.  Pappa must go downstairs to fetch it.
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
            // deliver to child (who is waiting at the toilet)
            if (this.player.carryItem === 'toapapper' && rectsIntersect(this.player.x, this.player.y, this.player.w, this.player.h, child.x, child.y, child.w, child.h)) {
              this.player.carryItem = null;
              messageLog.add(`${child.name}: Äntligen!`, 3000);
              // Move Kerstin back to sofa
              if (child.name === 'Kerstin') {
                child.x = 80;
                child.y = 240;
              }
              this.finishQuest(quest);
            }
          }
          break;
        }
        case 'lova': {
          // Arvid wants Pappa to chase away the cat Lova
          if (quest.state === 'catch_cat') {
            // Cat moves automatically in Game.update; if Pappa touches it, remove it
            if (this.cat && this.player.intersects(this.cat)) {
              // Cat runs away
              this.cat = null;
              messageLog.add('Pappa jagade bort Lova.', 2000);
              quest.state = 'return';
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
      // Reset child's call timer so they wait a bit before next call
      quest.child.callTimer = -2000; // two seconds pause
      // Show a thank you bubble above the child's head for a short time
      quest.child.thankTimer = 2000;
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
      // other updates until he returns.  While downstairs we still update
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

      // Input toggles for resting: if HP below threshold then require rest
      if (this.player.hp < 20 && !this.player.isResting) {
        // Auto instruct to rest
        messageLog.add('Pappa är utmattad! Vila i en säng.', 4000);
        this.player.isResting = false; // don't start resting yet
      }
      // Update player
      this.player.update(dt, this.keys, this.obstacles, this.interactives);
      // Update cat (Lova) if present
      if (this.cat) {
        this.cat.update(dt);
      }
      // Check for rest conditions: if player collides with bed and chooses to rest (press R) or automatically when HP low
      let atBed = false;
      for (const obj of this.obstacles) {
        if (obj.type && obj.type.startsWith('bed') && rectsIntersect(this.player.x, this.player.y, this.player.w, this.player.h, obj.x, obj.y, obj.w, obj.h)) {
          atBed = true;
          break;
        }
      }
      if (this.player.hp < 30 && atBed) {
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
        if (rectsIntersect(this.player.x, this.player.y, this.player.w, this.player.h, child.x, child.y, child.w, child.h)) {
          // Stop calls
          child.isCalling = false;
          child.callTimer = 0;
          child.callElapsed = 0;
          // Only assign new quest if none active
          if (!this.player.activeQuest && !child.activeQuest) {
            // assign quest
            this.assignQuest(child);
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
      // Update HUD
      document.getElementById('hp').textContent = `HP: ${Math.floor(this.player.hp)}`;
      document.getElementById('points').textContent = `Poäng: ${this.player.points}`;
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
      // Draw cat (Lova) if present
      if (this.cat) {
        this.cat.draw(ctx);
      }
      // Draw children
      for (const child of this.children) {
        child.draw(ctx);
      }
      // Draw player
      // When Pappa is downstairs he is hidden; otherwise draw him
      if (!this.player.isDownstairs) {
        this.player.draw(ctx);
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
    }
    drawRooms(ctx) {
      // Fill each room with a subtle background color
      // Bathroom
      ctx.fillStyle = '#e5f0f9';
      ctx.fillRect(0, 0, 200, 200);
      // Stairs/hall top area (non‑walkable – dark to indicate stairs)
      ctx.fillStyle = '#c8ced3';
      ctx.fillRect(200, 0, 100, 200);
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

  // Create and start the game when DOM ready
  window.addEventListener('load', () => {
    const canvas = document.getElementById('gameCanvas');
    const game = new Game(canvas);
    game.setup();
  });
})();