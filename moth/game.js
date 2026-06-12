(() => {
    'use strict';

    const TARGET_POLLEN = 40;
    const START_HEALTH = 3;
    const PLAYER_RADIUS = 24;
    const HAZARD_RADIUS = 26;
    const POLLEN_RADIUS = 13;

    const shell = document.getElementById('gameShell');
    const canvasMount = document.getElementById('gameCanvas');
    const startScreen = document.getElementById('startScreen');
    const gameOverScreen = document.getElementById('gameOverScreen');
    const pauseScreen = document.getElementById('pauseScreen');
    const startButton = document.getElementById('startButton');
    const restartButton = document.getElementById('restartButton');
    const resumeButton = document.getElementById('resumeButton');
    const scoreValue = document.getElementById('scoreValue');
    const pollenValue = document.getElementById('pollenValue');
    const healthValue = document.getElementById('healthValue');
    const goalValue = document.getElementById('goalValue');
    const resultEyebrow = document.getElementById('resultEyebrow');
    const resultTitle = document.getElementById('resultTitle');
    const resultSummary = document.getElementById('resultSummary');
    const finalScore = document.getElementById('finalScore');
    const finalPollen = document.getElementById('finalPollen');

    goalValue.textContent = String(TARGET_POLLEN);

    if (!window.PIXI) {
        startScreen.querySelector('.summary').textContent = 'PixiJS could not load. Check your network connection, then refresh the page.';
        startButton.disabled = true;
        return;
    }

    const app = new PIXI.Application({
        resizeTo: shell,
        backgroundColor: 0x070815,
        antialias: true,
        autoDensity: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2)
    });

    canvasMount.appendChild(app.view);

    const world = new PIXI.Container();
    const backgroundLayer = new PIXI.Container();
    const pollenLayer = new PIXI.Container();
    const hazardLayer = new PIXI.Container();
    const effectLayer = new PIXI.Container();
    const playerLayer = new PIXI.Container();

    app.stage.addChild(backgroundLayer, world);
    world.addChild(pollenLayer, hazardLayer, effectLayer, playerLayer);

    const keys = new Set();
    const pollenItems = [];
    const hazards = [];
    const particles = [];
    const stars = [];

    const mouse = {
        x: 0,
        y: 0,
        active: false,
        lastMove: 0
    };

    const state = {
        mode: 'menu',
        score: 0,
        pollen: 0,
        health: START_HEALTH,
        time: 0,
        invulnerable: 0,
        pollenTimer: 0,
        hazardTimer: 0,
        particleTimer: 0,
        player: null,
        velocity: { x: 0, y: 0 }
    };

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function randomBetween(min, max) {
        return min + Math.random() * (max - min);
    }

    function distanceSquared(a, b) {
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        return dx * dx + dy * dy;
    }

    function isColliding(a, b, radiusA, radiusB) {
        const range = radiusA + radiusB;
        return distanceSquared(a, b) <= range * range;
    }

    function updateHud() {
        scoreValue.textContent = String(state.score);
        pollenValue.textContent = String(state.pollen);
        healthValue.textContent = String(state.health);
    }

    function showPanel(panel) {
        startScreen.hidden = panel !== 'start';
        gameOverScreen.hidden = panel !== 'gameOver';
        pauseScreen.hidden = panel !== 'pause';
    }

    function createBackground() {
        backgroundLayer.removeChildren();
        stars.length = 0;

        const w = app.screen.width;
        const h = app.screen.height;

        const mist = new PIXI.Graphics();
        mist.beginFill(0x111b38, 0.66);
        mist.drawRect(0, 0, w, h);
        mist.endFill();
        backgroundLayer.addChild(mist);

        for (let i = 0; i < 90; i += 1) {
            const star = new PIXI.Graphics();
            const tint = Math.random() > 0.7 ? 0xffd66b : Math.random() > 0.45 ? 0x7af7ff : 0xb891ff;
            const radius = randomBetween(1, 3.8);
            star.beginFill(tint, randomBetween(0.35, 0.95));
            star.drawCircle(0, 0, radius);
            star.endFill();
            star.x = randomBetween(0, w);
            star.y = randomBetween(0, h);
            star.speed = randomBetween(8, 34);
            star.pulse = randomBetween(0, Math.PI * 2);
            backgroundLayer.addChild(star);
            stars.push(star);
        }

        for (let i = 0; i < 10; i += 1) {
            const bloom = new PIXI.Graphics();
            bloom.beginFill(i % 2 === 0 ? 0x264f63 : 0x3a255f, 0.15);
            bloom.drawCircle(0, 0, randomBetween(80, 170));
            bloom.endFill();
            bloom.x = randomBetween(0, w);
            bloom.y = randomBetween(0, h);
            backgroundLayer.addChild(bloom);
        }
    }

    function createMonarchButterfly() {
        const butterfly = new PIXI.Container();
        butterfly.radius = PLAYER_RADIUS;

        const glow = new PIXI.Graphics();
        glow.beginFill(0xffb04d, 0.18);
        glow.drawCircle(0, 0, 42);
        glow.endFill();
        butterfly.addChild(glow);
        butterfly.glow = glow;

        const leftWing = new PIXI.Graphics();
        leftWing.lineStyle(3, 0x21101b, 0.95);
        leftWing.beginFill(0xff8a1c, 1);
        leftWing.drawEllipse(-19, -14, 18, 24);
        leftWing.endFill();
        leftWing.beginFill(0xffc247, 1);
        leftWing.drawEllipse(-17, 15, 15, 18);
        leftWing.endFill();
        leftWing.lineStyle(2, 0x24101c, 0.9);
        leftWing.moveTo(-4, -2);
        leftWing.lineTo(-30, -28);
        leftWing.moveTo(-5, 2);
        leftWing.lineTo(-31, 18);
        leftWing.moveTo(-9, 5);
        leftWing.lineTo(-24, 31);

        const rightWing = new PIXI.Graphics();
        rightWing.lineStyle(3, 0x21101b, 0.95);
        rightWing.beginFill(0xff8a1c, 1);
        rightWing.drawEllipse(19, -14, 18, 24);
        rightWing.endFill();
        rightWing.beginFill(0xffc247, 1);
        rightWing.drawEllipse(17, 15, 15, 18);
        rightWing.endFill();
        rightWing.lineStyle(2, 0x24101c, 0.9);
        rightWing.moveTo(4, -2);
        rightWing.lineTo(30, -28);
        rightWing.moveTo(5, 2);
        rightWing.lineTo(31, 18);
        rightWing.moveTo(9, 5);
        rightWing.lineTo(24, 31);

        const body = new PIXI.Graphics();
        body.beginFill(0x191221, 1);
        body.drawEllipse(0, 2, 6, 25);
        body.endFill();
        body.beginFill(0xfff2a8, 1);
        body.drawCircle(0, -21, 6);
        body.endFill();
        body.lineStyle(2, 0xffd66b, 0.8);
        body.moveTo(-2, -24);
        body.lineTo(-11, -35);
        body.moveTo(2, -24);
        body.lineTo(11, -35);

        butterfly.addChild(leftWing, rightWing, body);
        butterfly.leftWing = leftWing;
        butterfly.rightWing = rightWing;
        butterfly.body = body;
        butterfly.x = app.screen.width * 0.28;
        butterfly.y = app.screen.height * 0.5;

        return butterfly;
    }

    function createPollen(x, y) {
        const pollen = new PIXI.Container();
        pollen.radius = POLLEN_RADIUS;
        pollen.speed = randomBetween(132, 176);

        const glow = new PIXI.Graphics();
        glow.beginFill(0xffd66b, 0.2);
        glow.drawCircle(0, 0, 24);
        glow.endFill();

        const core = new PIXI.Graphics();
        core.beginFill(0xffed99, 1);
        core.drawCircle(0, 0, 9);
        core.endFill();
        core.beginFill(0xff8f5c, 0.9);
        core.drawCircle(3, -3, 3);
        core.endFill();

        pollen.addChild(glow, core);
        pollen.x = x;
        pollen.y = y;
        pollen.phase = randomBetween(0, Math.PI * 2);
        pollenLayer.addChild(pollen);
        pollenItems.push(pollen);
    }

    function createHazard(x, y) {
        const hazard = new PIXI.Container();
        hazard.radius = HAZARD_RADIUS;
        hazard.speed = randomBetween(165, 225) + state.time * 2.5;
        hazard.rotationSpeed = randomBetween(-1.8, 1.8);

        const warning = new PIXI.Graphics();
        warning.beginFill(0xff4f92, 0.15);
        warning.drawCircle(0, 0, 36);
        warning.endFill();

        const thorn = new PIXI.Graphics();
        thorn.lineStyle(2, 0xff7dba, 0.65);
        thorn.beginFill(0x170d25, 1);
        thorn.moveTo(0, -32);
        thorn.lineTo(23, -3);
        thorn.lineTo(9, 29);
        thorn.lineTo(-17, 22);
        thorn.lineTo(-25, -8);
        thorn.closePath();
        thorn.endFill();

        hazard.addChild(warning, thorn);
        hazard.x = x;
        hazard.y = y;
        hazardLayer.addChild(hazard);
        hazards.push(hazard);
    }

    function createParticle(x, y, color, size, speedX, speedY, life) {
        const particle = new PIXI.Graphics();
        particle.beginFill(color, 0.78);
        particle.drawCircle(0, 0, size);
        particle.endFill();
        particle.x = x;
        particle.y = y;
        particle.vx = speedX;
        particle.vy = speedY;
        particle.life = life;
        particle.maxLife = life;
        effectLayer.addChild(particle);
        particles.push(particle);
    }

    function burst(x, y, color, count) {
        for (let i = 0; i < count; i += 1) {
            const angle = randomBetween(0, Math.PI * 2);
            const speed = randomBetween(70, 190);
            createParticle(x, y, color, randomBetween(2, 5), Math.cos(angle) * speed, Math.sin(angle) * speed, randomBetween(0.35, 0.7));
        }
    }

    function clearRunObjects() {
        pollenItems.splice(0).forEach((item) => item.destroy({ children: true }));
        hazards.splice(0).forEach((hazard) => hazard.destroy({ children: true }));
        particles.splice(0).forEach((particle) => particle.destroy());
        pollenLayer.removeChildren();
        hazardLayer.removeChildren();
        effectLayer.removeChildren();
    }

    function resetRun() {
        clearRunObjects();
        if (state.player) {
            state.player.destroy({ children: true });
        }

        state.player = createMonarchButterfly();
        playerLayer.addChild(state.player);
        state.velocity.x = 0;
        state.velocity.y = 0;
        state.score = 0;
        state.pollen = 0;
        state.health = START_HEALTH;
        state.time = 0;
        state.invulnerable = 0;
        state.pollenTimer = 0.35;
        state.hazardTimer = 1.1;
        state.particleTimer = 0;
        mouse.active = false;
        updateHud();
    }

    function startRun() {
        resetRun();
        state.mode = 'playing';
        showPanel(null);
        app.view.focus?.();
    }

    function pauseRun() {
        if (state.mode !== 'playing') {
            return;
        }
        state.mode = 'paused';
        showPanel('pause');
    }

    function resumeRun() {
        if (state.mode !== 'paused') {
            return;
        }
        state.mode = 'playing';
        showPanel(null);
    }

    function finishRun(won) {
        state.mode = 'gameOver';
        resultEyebrow.textContent = won ? 'Goal Reached' : 'Run Ended';
        resultTitle.textContent = won ? 'Garden Cleared' : 'Game Over';
        resultSummary.textContent = won
            ? 'The monarch gathered enough pollen to finish this Phase A route.'
            : 'A shadow thorn took the last health. Try a wider glide and watch the warning glows.';
        finalScore.textContent = String(state.score);
        finalPollen.textContent = String(state.pollen);
        showPanel('gameOver');
    }

    function spawnPollenCluster() {
        const h = app.screen.height;
        const baseY = randomBetween(110, h - 90);
        const cluster = Math.random() > 0.55 ? 4 : 3;
        for (let i = 0; i < cluster; i += 1) {
            createPollen(app.screen.width + 34 * i, baseY + Math.sin(i * 1.2) * 34);
        }
    }

    function updatePlayer(dt) {
        const player = state.player;
        if (!player) {
            return;
        }

        let ax = 0;
        let ay = 0;
        const left = keys.has('arrowleft') || keys.has('a');
        const right = keys.has('arrowright') || keys.has('d');
        const up = keys.has('arrowup') || keys.has('w');
        const down = keys.has('arrowdown') || keys.has('s');

        if (left) ax -= 1;
        if (right) ax += 1;
        if (up) ay -= 1;
        if (down) ay += 1;

        if (mouse.active && performance.now() - mouse.lastMove < 2400) {
            const dx = mouse.x - player.x;
            const dy = mouse.y - player.y;
            const length = Math.hypot(dx, dy) || 1;
            const pull = clamp(length / 260, 0, 1);
            ax += (dx / length) * pull * 0.9;
            ay += (dy / length) * pull * 0.9;
        }

        const inputLength = Math.hypot(ax, ay);
        if (inputLength > 1) {
            ax /= inputLength;
            ay /= inputLength;
        }

        const acceleration = 760;
        const drag = 0.88;
        const maxSpeed = 430;

        state.velocity.x += ax * acceleration * dt;
        state.velocity.y += ay * acceleration * dt;
        state.velocity.x *= Math.pow(drag, dt * 60);
        state.velocity.y *= Math.pow(drag, dt * 60);

        const speed = Math.hypot(state.velocity.x, state.velocity.y);
        if (speed > maxSpeed) {
            state.velocity.x = (state.velocity.x / speed) * maxSpeed;
            state.velocity.y = (state.velocity.y / speed) * maxSpeed;
        }

        player.x += state.velocity.x * dt;
        player.y += state.velocity.y * dt;
        player.x = clamp(player.x, 46, app.screen.width - 46);
        player.y = clamp(player.y, 72, app.screen.height - 46);

        const flutter = Math.sin(state.time * 18) * (0.16 + speed / 3600);
        player.leftWing.scale.x = 1 + flutter;
        player.rightWing.scale.x = 1 + flutter;
        player.rotation = clamp(state.velocity.x / 1200, -0.22, 0.22);
        player.glow.alpha = state.invulnerable > 0 ? 0.32 + Math.sin(state.time * 34) * 0.14 : 0.18;

        state.particleTimer -= dt;
        if (state.particleTimer <= 0) {
            state.particleTimer = 0.055;
            createParticle(player.x - 18, player.y + randomBetween(-12, 16), 0xffb24a, randomBetween(1.5, 3.5), randomBetween(-80, -35), randomBetween(-28, 28), 0.45);
        }
    }

    function updatePollen(dt) {
        state.pollenTimer -= dt;
        if (state.pollenTimer <= 0) {
            state.pollenTimer = randomBetween(0.68, 1.05);
            spawnPollenCluster();
        }

        for (let i = pollenItems.length - 1; i >= 0; i -= 1) {
            const pollen = pollenItems[i];
            pollen.phase += dt * 5;
            pollen.x -= pollen.speed * dt;
            pollen.y += Math.sin(pollen.phase) * 22 * dt;
            pollen.scale.set(1 + Math.sin(pollen.phase * 1.7) * 0.08);

            if (state.player && isColliding(state.player, pollen, PLAYER_RADIUS, POLLEN_RADIUS)) {
                state.score += 10;
                state.pollen += 1;
                updateHud();
                burst(pollen.x, pollen.y, 0xffd66b, 8);
                pollen.destroy({ children: true });
                pollenItems.splice(i, 1);
                if (state.pollen >= TARGET_POLLEN) {
                    finishRun(true);
                }
                continue;
            }

            if (pollen.x < -60) {
                pollen.destroy({ children: true });
                pollenItems.splice(i, 1);
            }
        }
    }

    function updateHazards(dt) {
        state.hazardTimer -= dt;
        if (state.hazardTimer <= 0) {
            state.hazardTimer = randomBetween(0.95, 1.45);
            createHazard(app.screen.width + 56, randomBetween(100, app.screen.height - 70));
        }

        if (state.invulnerable > 0) {
            state.invulnerable -= dt;
        }

        for (let i = hazards.length - 1; i >= 0; i -= 1) {
            const hazard = hazards[i];
            hazard.x -= hazard.speed * dt;
            hazard.rotation += hazard.rotationSpeed * dt;
            hazard.alpha = hazard.x > app.screen.width - 140 ? 0.55 : 1;

            if (state.player && state.invulnerable <= 0 && isColliding(state.player, hazard, PLAYER_RADIUS, HAZARD_RADIUS)) {
                state.health -= 1;
                state.invulnerable = 1.05;
                updateHud();
                burst(hazard.x, hazard.y, 0xff4f92, 14);
                hazard.destroy({ children: true });
                hazards.splice(i, 1);

                if (state.health <= 0) {
                    finishRun(false);
                }
                continue;
            }

            if (hazard.x < -80) {
                hazard.destroy({ children: true });
                hazards.splice(i, 1);
            }
        }
    }

    function updateParticles(dt) {
        for (let i = particles.length - 1; i >= 0; i -= 1) {
            const particle = particles[i];
            particle.life -= dt;
            particle.x += particle.vx * dt;
            particle.y += particle.vy * dt;
            particle.vx *= Math.pow(0.94, dt * 60);
            particle.vy *= Math.pow(0.94, dt * 60);
            particle.alpha = Math.max(0, particle.life / particle.maxLife);
            particle.scale.set(0.6 + particle.alpha * 0.6);

            if (particle.life <= 0) {
                particle.destroy();
                particles.splice(i, 1);
            }
        }
    }

    function updateBackground(dt) {
        const w = app.screen.width;
        const h = app.screen.height;
        for (const star of stars) {
            star.x -= star.speed * dt;
            star.pulse += dt * 2;
            star.alpha = 0.45 + Math.sin(star.pulse) * 0.25;
            if (star.x < -12) {
                star.x = w + 12;
                star.y = randomBetween(0, h);
            }
        }
    }

    function tick() {
        const dt = Math.min(app.ticker.elapsedMS / 1000, 0.033);
        updateBackground(dt);

        if (state.mode !== 'playing') {
            return;
        }

        state.time += dt;
        updatePlayer(dt);
        updatePollen(dt);
        updateHazards(dt);
        updateParticles(dt);
    }

    startButton.addEventListener('click', startRun);
    restartButton.addEventListener('click', startRun);
    resumeButton.addEventListener('click', resumeRun);

    window.addEventListener('keydown', (event) => {
        const key = event.key.toLowerCase();
        if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' ', 'spacebar'].includes(key)) {
            event.preventDefault();
        }

        if (key === 'escape') {
            if (state.mode === 'playing') {
                pauseRun();
            } else if (state.mode === 'paused') {
                resumeRun();
            }
            return;
        }

        if ((key === 'enter' || key === ' ') && state.mode === 'menu') {
            startRun();
            return;
        }

        keys.add(key);
    });

    window.addEventListener('keyup', (event) => {
        keys.delete(event.key.toLowerCase());
    });

    app.view.addEventListener('pointermove', (event) => {
        const rect = app.view.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * app.screen.width;
        mouse.y = ((event.clientY - rect.top) / rect.height) * app.screen.height;
        mouse.active = true;
        mouse.lastMove = performance.now();
    });

    app.view.addEventListener('pointerleave', () => {
        mouse.active = false;
    });

    window.addEventListener('resize', () => {
        createBackground();
        if (state.player) {
            state.player.x = clamp(state.player.x, 46, app.screen.width - 46);
            state.player.y = clamp(state.player.y, 72, app.screen.height - 46);
        }
    });

    createBackground();
    updateHud();
    showPanel('start');
    app.ticker.add(tick);
})();
