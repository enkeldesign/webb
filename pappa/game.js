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
      } else {
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
        // Check collision with obstacles; if collision, revert movement on that axis
        const newRectX = { x: newX, y: this.y, w: this.w, h: this.h };
        const newRectY = { x: this.x, y: newY, w: this.w, h: this.h };
        // If hitting any obstacle horizontally, don't move horizontally
        let collideX = false;
        for (const obs of obstacles) {
          if (rectsIntersect(newRectX.x, newRectX.y, newRectX.w, newRectX.h, obs.x, obs.y, obs.w, obs.h)) {
            collideX = true;
            break;
          }
        }
        if (!collideX) {
          this.x = newX;
        }
        let collideY = false;
        for (const obs of obstacles) {
          if (rectsIntersect(newRectY.x, newRectY.y, newRectY.w, newRectY.h, obs.x, obs.y, obs.w, obs.h)) {
            collideY = true;
            break;
          }
        }
        if (!collideY) {
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
      this.callInterval = 1000; // ms per call
      this.activeQuest = null;
      this.yellCooldown = 0; // time since last yell for message display
      this.color = name === 'Arvid' ? '#e05d5d' : '#d68fce';
      // Running call state: used to decide when to apply HP penalty
      this.callElapsed = 0;
    }
    update(dt, player) {
      if (this.activeQuest) {
        // If the player is performing this child's quest, no calls
        this.isCalling = false;
        this.callTimer = 0;
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
            // Add message with child's name calling
            messageLog.add(`${this.name}: "Pappa!"`, 1200);
          }
      } else {
          this.isCalling = false;
          this.callTimer = 0;
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
      // Draw exclamation mark if this child has a quest available (but no active quest yet)
      if (!this.activeQuest && this.isCalling) {
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
      this.children.push(new Child('Arvid', arvidStart.x, arvidStart.y, ['wasp', 'charger', 'help_computer', 'play']));
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
        // Check potential collision
        const tempRect = { x: clampedX, y: clampedY, w: this.player.w, h: this.player.h };
        let collides = false;
        for (const obs of this.obstacles) {
          if (rectsIntersect(tempRect.x, tempRect.y, tempRect.w, tempRect.h, obs.x, obs.y, obs.w, obs.h)) {
            collides = true;
            break;
          }
        }
        if (!collides) {
          this.player.x = clampedX;
          this.player.y = clampedY;
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
      // Vertical walls at x=200
      // segments defined: (x,y,w,h)
      obs.push({ x: 200, y: 0, w: WT, h: 60 });
      obs.push({ x: 200, y: 160, w: WT, h: 40 });
      obs.push({ x: 200, y: 200, w: WT, h: 40 });
      obs.push({ x: 200, y: 300, w: WT, h: 100 });
      obs.push({ x: 200, y: 400, w: WT, h: 60 });
      obs.push({ x: 200, y: 520, w: WT, h: 80 });
      // Vertical walls at x=300
      obs.push({ x: 300, y: 0, w: WT, h: 80 });
      obs.push({ x: 300, y: 120, w: WT, h: 80 });
      obs.push({ x: 300, y: 200, w: WT, h: 80 });
      obs.push({ x: 300, y: 340, w: WT, h: 60 });
      obs.push({ x: 300, y: 400, w: WT, h: 60 });
      obs.push({ x: 300, y: 520, w: WT, h: 80 });
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
      obs.push({ x: 160, y: 140, w: 40, h: 40, type: 'closet' });
      objs.push({ x: 160, y: 140, w: 40, h: 40, type: 'closet', collected: false });
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
      // Snack: interactive object at table (for quest), not obstacle
      objs.push({ x: 90, y: 280, w: 20, h: 20, type: 'snack', collected: false });
      // Toilet paper: we'll spawn when toapapper quest begins
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
        // Move child to bathroom near toilet
        const toiletX = 40;
        const toiletY = 140;
        child.x = toiletX + 60;
        child.y = toiletY + 10;
        // Create toilet paper interactive at bathroom closet
        const closet = this.interactives.find(o => o.type === 'closet');
        if (!closet) {
          // create one at closet position defined earlier (160,140)
          this.interactives.push({ x: 160, y: 140, w: 40, h: 40, type: 'closet', collected: false });
        }
        quest.state = 'get_paper';
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
        case 'snack':
          if (quest.state === 'init') quest.state = 'get_snack';
          if (quest.state === 'get_snack') {
            const snack = this.interactives.find(o => o.type === 'snack' && !o.collected);
            if (snack && rectsIntersect(this.player.x, this.player.y, this.player.w, this.player.h, snack.x, snack.y, snack.w, snack.h)) {
              snack.collected = true;
              this.player.carryItem = 'snack';
              messageLog.add('Pappa hämtade kvällsfika.', 2000);
              quest.state = 'deliver_snack';
            }
          } else if (quest.state === 'deliver_snack') {
            if (this.player.carryItem === 'snack' && rectsIntersect(this.player.x, this.player.y, this.player.w, this.player.h, child.x, child.y, child.w, child.h)) {
              this.player.carryItem = null;
              messageLog.add(`${child.name}: Mums! Tack pappa!`, 3000);
              this.finishQuest(quest);
            }
          }
          break;
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
        case 'play':
          if (quest.state === 'init') quest.state = 'play_with_child';
          if (quest.state === 'play_with_child') {
            if (rectsIntersect(this.player.x, this.player.y, this.player.w, this.player.h, child.x - 10, child.y - 10, child.w + 20, child.h + 20)) {
              quest.progress += dt;
              if (quest.progress >= 5) {
                messageLog.add(`${child.name}: Det var kul!`, 3000);
                this.finishQuest(quest);
              }
            } else {
              if (quest.progress > 0) {
                // if player moves away, slowly decay progress
                quest.progress = Math.max(0, quest.progress - dt * 0.5);
              }
            }
          }
          break;
        case 'toapapper':
          if (quest.state === 'get_paper') {
            // find closet interactive object
            const closet = this.interactives.find(o => o.type === 'closet');
            if (closet && !closet.collected && rectsIntersect(this.player.x, this.player.y, this.player.w, this.player.h, closet.x, closet.y, closet.w, closet.h)) {
              closet.collected = true;
              this.player.carryItem = 'toapapper';
              messageLog.add('Pappa tog en rulle toapapper.', 2000);
              quest.state = 'deliver_paper';
            }
          } else if (quest.state === 'deliver_paper') {
            // deliver to child at toilet location
            if (this.player.carryItem === 'toapapper' && rectsIntersect(this.player.x, this.player.y, this.player.w, this.player.h, child.x, child.y, child.w, child.h)) {
              this.player.carryItem = null;
              messageLog.add(`${child.name}: Äntligen! Tack!`, 3000);
              // Move child back to sofa
              if (child.name === 'Kerstin') {
                child.x = 80;
                child.y = 240;
              }
              this.finishQuest(quest);
            }
          }
          break;
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
    }
    loop(now) {
      const dt = (now - this.lastTime) / 1000;
      this.update(dt);
      this.draw();
      this.lastTime = now;
      requestAnimationFrame(this.loop.bind(this));
    }
    update(dt) {
      // Input toggles for resting: if HP below threshold then require rest
      if (this.player.hp < 20 && !this.player.isResting) {
        // Auto instruct to rest
        messageLog.add('Pappa är utmattad! Vila i en säng.', 4000);
        this.player.isResting = false; // don't start resting yet
      }
      // Update player
      this.player.update(dt, this.keys, this.obstacles, this.interactives);
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
      // Draw children
      for (const child of this.children) {
        child.draw(ctx);
      }
      // Draw player
      this.player.draw(ctx);
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