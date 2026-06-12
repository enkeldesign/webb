(() => {
    'use strict';

    const TARGET_POLLEN = 40;
    const START_HEALTH = 3;
    const PLAYER_RADIUS = 24;
    const HAZARD_RADIUS = 26;
    const POLLEN_RADIUS = 13;
    const VIEW_ZOOM = 1.24;
    const MAX_PARTICLES = 220;
    const MAX_RINGS = 18;

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
        backgroundColor: 0x050712,
        antialias: true,
        autoDensity: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2)
    });

    canvasMount.appendChild(app.view);

    const backgroundLayer = new PIXI.Container();
    const bloomLayer = new PIXI.Container();
    const world = new PIXI.Container();
    const trailLayer = new PIXI.Container();
    const pollenLayer = new PIXI.Container();
    const hazardLayer = new PIXI.Container();
    const effectLayer = new PIXI.Container();
    const playerLayer = new PIXI.Container();
    const foregroundLayer = new PIXI.Container();

    app.stage.addChild(backgroundLayer, bloomLayer, world, foregroundLayer);
    world.addChild(trailLayer, pollenLayer, hazardLayer, effectLayer, playerLayer);
    world.scale.set(VIEW_ZOOM);

    const blurFilter = new PIXI.BlurFilter(18, 4);
    blurFilter.padding = 80;
    bloomLayer.filters = [blurFilter];
    bloomLayer.blendMode = PIXI.BLEND_MODES.ADD;

    const keys = new Set();
    const pollenItems = [];
    const hazards = [];
    const particles = [];
    const rings = [];
    const spores = [];
    const blooms = [];

    let backgroundTexture = null;

    const camera = {
        x: 0,
        y: 0,
        targetX: 0,
        targetY: 0
    };

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

    function lerp(current, target, amount) {
        return current + (target - current) * amount;
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

    function getArena() {
        const worldWidth = app.screen.width / VIEW_ZOOM;
        const worldHeight = app.screen.height / VIEW_ZOOM;
        const marginX = Math.min(96 / VIEW_ZOOM, worldWidth * 0.13);
        const top = Math.min(108 / VIEW_ZOOM, worldHeight * 0.2);
        const bottomMargin = Math.min(64 / VIEW_ZOOM, worldHeight * 0.13);
        return {
            left: marginX,
            right: worldWidth - marginX,
            top,
            bottom: worldHeight - bottomMargin,
            width: worldWidth - marginX * 2,
            height: worldHeight - top - bottomMargin,
            centerX: worldWidth / 2,
            centerY: (top + worldHeight - bottomMargin) / 2
        };
    }

    function screenToWorld(screenX, screenY) {
        return {
            x: (screenX - world.x) / VIEW_ZOOM,
            y: (screenY - world.y) / VIEW_ZOOM
        };
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

    function createGradientTexture(width, height) {
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(2, Math.floor(width));
        canvas.height = Math.max(2, Math.floor(height));
        const ctx = canvas.getContext('2d');

        const linear = ctx.createLinearGradient(0, 0, width, height);
        linear.addColorStop(0, '#07102b');
        linear.addColorStop(0.32, '#161052');
        linear.addColorStop(0.66, '#062b3d');
        linear.addColorStop(1, '#120620');
        ctx.fillStyle = linear;
        ctx.fillRect(0, 0, width, height);

        const cyan = ctx.createRadialGradient(width * 0.2, height * 0.22, 0, width * 0.2, height * 0.22, width * 0.42);
        cyan.addColorStop(0, 'rgba(86, 245, 255, 0.38)');
        cyan.addColorStop(0.42, 'rgba(34, 132, 184, 0.13)');
        cyan.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = cyan;
        ctx.fillRect(0, 0, width, height);

        const magenta = ctx.createRadialGradient(width * 0.78, height * 0.32, 0, width * 0.78, height * 0.32, width * 0.45);
        magenta.addColorStop(0, 'rgba(255, 82, 190, 0.28)');
        magenta.addColorStop(0.45, 'rgba(145, 75, 255, 0.14)');
        magenta.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = magenta;
        ctx.fillRect(0, 0, width, height);

        const gold = ctx.createRadialGradient(width * 0.52, height * 0.78, 0, width * 0.52, height * 0.78, width * 0.36);
        gold.addColorStop(0, 'rgba(255, 216, 107, 0.16)');
        gold.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gold;
        ctx.fillRect(0, 0, width, height);

        return PIXI.Texture.from(canvas);
    }

    function drawArenaFrame() {
        foregroundLayer.removeChildren().forEach((child) => child.destroy({ children: true }));
        const arena = getArena();
        const x = arena.left * VIEW_ZOOM;
        const y = arena.top * VIEW_ZOOM;
        const width = arena.width * VIEW_ZOOM;
        const height = arena.height * VIEW_ZOOM;

        const shadow = new PIXI.Graphics();
        shadow.lineStyle(16, 0x7af7ff, 0.035);
        shadow.drawRoundedRect(x, y, width, height, 24);
        shadow.filters = [new PIXI.BlurFilter(10, 2)];
        shadow.blendMode = PIXI.BLEND_MODES.ADD;

        const frame = new PIXI.Graphics();
        frame.lineStyle(1.5, 0x7af7ff, 0.3);
        frame.drawRoundedRect(x, y, width, height, 24);
        frame.lineStyle(1, 0xffd66b, 0.16);
        frame.drawRoundedRect(x + 5, y + 5, width - 10, height - 10, 18);

        const vignette = new PIXI.Graphics();
        vignette.beginFill(0x02030a, 0.2);
        vignette.drawRect(0, 0, app.screen.width, y);
        vignette.drawRect(0, y + height, app.screen.width, app.screen.height - y - height);
        vignette.drawRect(0, y, x, height);
        vignette.drawRect(x + width, y, app.screen.width - x - width, height);
        vignette.endFill();

        foregroundLayer.addChild(vignette, shadow, frame);
    }

    function createBackground() {
        backgroundLayer.removeChildren().forEach((child) => child.destroy({ children: true }));
        bloomLayer.removeChildren().forEach((child) => child.destroy({ children: true }));
        spores.length = 0;
        blooms.length = 0;

        if (backgroundTexture) {
            backgroundTexture.destroy(true);
        }

        const w = app.screen.width;
        const h = app.screen.height;
        backgroundTexture = createGradientTexture(w, h);

        const gradient = new PIXI.Sprite(backgroundTexture);
        gradient.width = w;
        gradient.height = h;
        backgroundLayer.addChild(gradient);

        for (let i = 0; i < 150; i += 1) {
            const spore = new PIXI.Graphics();
            const tint = Math.random() > 0.76 ? 0xffd66b : Math.random() > 0.48 ? 0x7af7ff : 0xff72cf;
            const radius = randomBetween(0.8, 3.6);
            spore.beginFill(tint, randomBetween(0.32, 0.9));
            spore.drawCircle(0, 0, radius);
            spore.endFill();
            spore.x = randomBetween(0, w);
            spore.y = randomBetween(0, h);
            spore.speed = randomBetween(12, 48);
            spore.drift = randomBetween(-12, 12);
            spore.pulse = randomBetween(0, Math.PI * 2);
            spore.blendMode = PIXI.BLEND_MODES.ADD;
            backgroundLayer.addChild(spore);
            spores.push(spore);
        }

        for (let i = 0; i < 16; i += 1) {
            const bloom = new PIXI.Graphics();
            const color = i % 3 === 0 ? 0x7af7ff : i % 3 === 1 ? 0xff72cf : 0xffd66b;
            bloom.beginFill(color, randomBetween(0.08, 0.18));
            bloom.drawCircle(0, 0, randomBetween(50, 150));
            bloom.endFill();
            bloom.x = randomBetween(-40, w + 40);
            bloom.y = randomBetween(-30, h + 30);
            bloom.speed = randomBetween(3, 14);
            bloom.phase = randomBetween(0, Math.PI * 2);
            bloomLayer.addChild(bloom);
            blooms.push(bloom);
        }

        drawArenaFrame();
    }

    function makeCircle(radius, color, alpha) {
        const circle = new PIXI.Graphics();
        circle.beginFill(color, alpha);
        circle.drawCircle(0, 0, radius);
        circle.endFill();
        return circle;
    }

    function createMonarchButterfly() {
        const butterfly = new PIXI.Container();
        butterfly.radius = PLAYER_RADIUS;

        const outerGlow = makeCircle(56, 0xff7d4b, 0.12);
        outerGlow.blendMode = PIXI.BLEND_MODES.ADD;
        outerGlow.filters = [new PIXI.BlurFilter(8, 2)];

        const glow = makeCircle(38, 0xffd66b, 0.16);
        glow.blendMode = PIXI.BLEND_MODES.ADD;
        butterfly.addChild(outerGlow, glow);
        butterfly.glow = glow;
        butterfly.outerGlow = outerGlow;

        const leftWing = new PIXI.Graphics();
        leftWing.lineStyle(3, 0x150814, 0.98);
        leftWing.beginFill(0xff7a1a, 1);
        leftWing.drawEllipse(-20, -15, 19, 25);
        leftWing.endFill();
        leftWing.beginFill(0xffc94a, 1);
        leftWing.drawEllipse(-18, 15, 16, 19);
        leftWing.endFill();
        leftWing.beginFill(0xfff0a8, 0.8);
        leftWing.drawCircle(-28, -21, 3);
        leftWing.drawCircle(-32, -9, 2.5);
        leftWing.drawCircle(-25, 23, 2.5);
        leftWing.endFill();
        leftWing.lineStyle(2, 0x20101f, 0.9);
        leftWing.moveTo(-4, -2);
        leftWing.lineTo(-31, -29);
        leftWing.moveTo(-5, 2);
        leftWing.lineTo(-33, 16);
        leftWing.moveTo(-8, 7);
        leftWing.lineTo(-25, 31);

        const rightWing = new PIXI.Graphics();
        rightWing.lineStyle(3, 0x150814, 0.98);
        rightWing.beginFill(0xff7a1a, 1);
        rightWing.drawEllipse(20, -15, 19, 25);
        rightWing.endFill();
        rightWing.beginFill(0xffc94a, 1);
        rightWing.drawEllipse(18, 15, 16, 19);
        rightWing.endFill();
        rightWing.beginFill(0xfff0a8, 0.8);
        rightWing.drawCircle(28, -21, 3);
        rightWing.drawCircle(32, -9, 2.5);
        rightWing.drawCircle(25, 23, 2.5);
        rightWing.endFill();
        rightWing.lineStyle(2, 0x20101f, 0.9);
        rightWing.moveTo(4, -2);
        rightWing.lineTo(31, -29);
        rightWing.moveTo(5, 2);
        rightWing.lineTo(33, 16);
        rightWing.moveTo(8, 7);
        rightWing.lineTo(25, 31);

        const body = new PIXI.Graphics();
        body.beginFill(0x17101e, 1);
        body.drawEllipse(0, 2, 6, 25);
        body.endFill();
        body.beginFill(0xfff4b4, 1);
        body.drawCircle(0, -21, 6);
        body.endFill();
        body.lineStyle(2, 0xffd66b, 0.9);
        body.moveTo(-2, -24);
        body.lineTo(-12, -36);
        body.moveTo(2, -24);
        body.lineTo(12, -36);

        butterfly.addChild(leftWing, rightWing, body);
        butterfly.leftWing = leftWing;
        butterfly.rightWing = rightWing;
        butterfly.body = body;

        const arena = getArena();
        butterfly.x = arena.left + arena.width * 0.26;
        butterfly.y = arena.centerY;

        return butterfly;
    }

    function createPollen(x, y) {
        const pollen = new PIXI.Container();
        pollen.radius = POLLEN_RADIUS;
        pollen.speed = randomBetween(134, 178);

        const aura = makeCircle(28, 0xffd66b, 0.22);
        aura.blendMode = PIXI.BLEND_MODES.ADD;
        aura.filters = [new PIXI.BlurFilter(5, 2)];

        const halo = makeCircle(16, 0xff7d67, 0.22);
        halo.blendMode = PIXI.BLEND_MODES.ADD;

        const core = new PIXI.Graphics();
        core.beginFill(0xfff0a3, 1);
        core.drawCircle(0, 0, 8.5);
        core.endFill();
        core.beginFill(0xff8f5c, 0.92);
        core.drawCircle(3, -3, 3);
        core.endFill();

        pollen.addChild(aura, halo, core);
        pollen.x = x;
        pollen.y = y;
        pollen.phase = randomBetween(0, Math.PI * 2);
        pollen.blendMode = PIXI.BLEND_MODES.ADD;
        pollenLayer.addChild(pollen);
        pollenItems.push(pollen);
    }

    function createHazard(x, y) {
        const hazard = new PIXI.Container();
        hazard.radius = HAZARD_RADIUS;
        hazard.speed = randomBetween(162, 222) + state.time * 2.5;
        hazard.rotationSpeed = randomBetween(-1.9, 1.9);

        const warning = makeCircle(39, 0xff4fbd, 0.18);
        warning.blendMode = PIXI.BLEND_MODES.ADD;
        warning.filters = [new PIXI.BlurFilter(5, 2)];

        const rim = new PIXI.Graphics();
        rim.lineStyle(2, 0xff65c8, 0.52);
        rim.drawCircle(0, 0, 30);
        rim.blendMode = PIXI.BLEND_MODES.ADD;

        const thorn = new PIXI.Graphics();
        thorn.lineStyle(2, 0xff9ad8, 0.78);
        thorn.beginFill(0x190724, 1);
        thorn.moveTo(0, -33);
        thorn.lineTo(24, -3);
        thorn.lineTo(9, 30);
        thorn.lineTo(-18, 23);
        thorn.lineTo(-26, -9);
        thorn.closePath();
        thorn.endFill();
        thorn.beginFill(0x3a0d4b, 0.86);
        thorn.drawCircle(0, 0, 8);
        thorn.endFill();

        hazard.addChild(warning, rim, thorn);
        hazard.warning = warning;
        hazard.rim = rim;
        hazard.x = x;
        hazard.y = y;
        hazardLayer.addChild(hazard);
        hazards.push(hazard);
    }

    function createParticle(x, y, color, size, speedX, speedY, life, alpha = 0.82) {
        if (particles.length >= MAX_PARTICLES) {
            const old = particles.shift();
            old.destroy();
        }

        const particle = makeCircle(size, color, alpha);
        particle.x = x;
        particle.y = y;
        particle.vx = speedX;
        particle.vy = speedY;
        particle.life = life;
        particle.maxLife = life;
        particle.baseScale = randomBetween(0.75, 1.25);
        particle.blendMode = PIXI.BLEND_MODES.ADD;
        effectLayer.addChild(particle);
        particles.push(particle);
    }

    function createRing(x, y, color, life, maxRadius) {
        if (rings.length >= MAX_RINGS) {
            const old = rings.shift();
            old.destroy();
        }

        const ring = new PIXI.Graphics();
        ring.x = x;
        ring.y = y;
        ring.color = color;
        ring.life = life;
        ring.maxLife = life;
        ring.maxRadius = maxRadius;
        ring.blendMode = PIXI.BLEND_MODES.ADD;
        effectLayer.addChild(ring);
        rings.push(ring);
    }

    function burst(x, y, color, count) {
        for (let i = 0; i < count; i += 1) {
            const angle = randomBetween(0, Math.PI * 2);
            const speed = randomBetween(95, 260);
            createParticle(x, y, color, randomBetween(2, 5.5), Math.cos(angle) * speed, Math.sin(angle) * speed, randomBetween(0.35, 0.82));
        }
    }

    function clearRunObjects() {
        pollenItems.splice(0).forEach((item) => item.destroy({ children: true }));
        hazards.splice(0).forEach((hazard) => hazard.destroy({ children: true }));
        particles.splice(0).forEach((particle) => particle.destroy());
        rings.splice(0).forEach((ring) => ring.destroy());
        pollenLayer.removeChildren();
        hazardLayer.removeChildren();
        effectLayer.removeChildren();
        trailLayer.removeChildren();
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
        state.hazardTimer = 1.05;
        state.particleTimer = 0;
        camera.x = 0;
        camera.y = 0;
        camera.targetX = 0;
        camera.targetY = 0;
        mouse.active = false;
        updateHud();
        updateCamera(1, true);
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
            ? 'The monarch gathered enough pollen to finish this Phase B route.'
            : 'A shadow thorn took the last health. Try a wider glide and watch the warning glows.';
        finalScore.textContent = String(state.score);
        finalPollen.textContent = String(state.pollen);
        showPanel('gameOver');
    }

    function spawnPollenCluster() {
        const arena = getArena();
        const baseY = randomBetween(arena.top + 22, arena.bottom - 22);
        const cluster = Math.random() > 0.55 ? 4 : 3;
        for (let i = 0; i < cluster; i += 1) {
            createPollen(arena.right + 34 + 34 * i, baseY + Math.sin(i * 1.2) * 27);
        }
    }

    function updateCamera(dt, immediate = false) {
        if (state.player) {
            const arena = getArena();
            camera.targetX = clamp((arena.centerX - state.player.x) * 0.13, -22, 22);
            camera.targetY = clamp((arena.centerY - state.player.y) * 0.1, -15, 15);
        }

        const ease = immediate ? 1 : 1 - Math.pow(0.0008, dt);
        camera.x = lerp(camera.x, camera.targetX, ease);
        camera.y = lerp(camera.y, camera.targetY, ease);
        world.scale.set(VIEW_ZOOM);
        world.x = camera.x * VIEW_ZOOM;
        world.y = camera.y * VIEW_ZOOM;
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
            const arena = getArena();
            const targetX = clamp(mouse.x, arena.left, arena.right);
            const targetY = clamp(mouse.y, arena.top, arena.bottom);
            const dx = targetX - player.x;
            const dy = targetY - player.y;
            const length = Math.hypot(dx, dy) || 1;
            const pull = clamp(length / 180, 0, 1);
            ax += (dx / length) * pull * 1.25;
            ay += (dy / length) * pull * 1.25;
        }

        const inputLength = Math.hypot(ax, ay);
        if (inputLength > 1) {
            ax /= inputLength;
            ay /= inputLength;
        }

        const acceleration = 1160;
        const drag = 0.9;
        const maxSpeed = 650;

        state.velocity.x += ax * acceleration * dt;
        state.velocity.y += ay * acceleration * dt;
        state.velocity.x *= Math.pow(drag, dt * 60);
        state.velocity.y *= Math.pow(drag, dt * 60);

        const speed = Math.hypot(state.velocity.x, state.velocity.y);
        if (speed > maxSpeed) {
            state.velocity.x = (state.velocity.x / speed) * maxSpeed;
            state.velocity.y = (state.velocity.y / speed) * maxSpeed;
        }

        const arena = getArena();
        player.x += state.velocity.x * dt;
        player.y += state.velocity.y * dt;
        player.x = clamp(player.x, arena.left + 30, arena.right - 30);
        player.y = clamp(player.y, arena.top + 30, arena.bottom - 30);

        const flutter = Math.sin(state.time * 22) * (0.18 + speed / 3200);
        player.leftWing.scale.x = 1 + flutter;
        player.rightWing.scale.x = 1 + flutter;
        player.scale.set(1 + Math.sin(state.time * 4.4) * 0.018);
        player.rotation = clamp(state.velocity.x / 1050, -0.28, 0.28);
        player.glow.alpha = state.invulnerable > 0 ? 0.34 + Math.sin(state.time * 36) * 0.16 : 0.19 + speed / 5200;
        player.outerGlow.alpha = 0.78 + Math.sin(state.time * 6) * 0.16;

        state.particleTimer -= dt;
        if (state.particleTimer <= 0) {
            state.particleTimer = 0.036;
            const trailColor = Math.random() > 0.5 ? 0xffb24a : 0x7af7ff;
            createParticle(
                player.x - 20 + randomBetween(-6, 5),
                player.y + randomBetween(-15, 18),
                trailColor,
                randomBetween(1.6, 4.2),
                randomBetween(-150, -70) - Math.abs(state.velocity.x) * 0.08,
                randomBetween(-42, 42),
                randomBetween(0.38, 0.68),
                0.68
            );
        }
    }

    function updatePollen(dt) {
        const arena = getArena();
        state.pollenTimer -= dt;
        if (state.pollenTimer <= 0) {
            state.pollenTimer = randomBetween(0.68, 1.05);
            spawnPollenCluster();
        }

        for (let i = pollenItems.length - 1; i >= 0; i -= 1) {
            const pollen = pollenItems[i];
            pollen.phase += dt * 5;
            pollen.x -= pollen.speed * dt;
            pollen.y += Math.sin(pollen.phase) * 21 * dt;
            pollen.scale.set(1 + Math.sin(pollen.phase * 1.7) * 0.1);
            pollen.rotation += dt * 1.8;

            if (state.player && isColliding(state.player, pollen, PLAYER_RADIUS, POLLEN_RADIUS)) {
                state.score += 10;
                state.pollen += 1;
                updateHud();
                burst(pollen.x, pollen.y, 0xffd66b, 12);
                createRing(pollen.x, pollen.y, 0xffd66b, 0.42, 46);
                pollen.destroy({ children: true });
                pollenItems.splice(i, 1);
                if (state.pollen >= TARGET_POLLEN) {
                    finishRun(true);
                }
                continue;
            }

            if (pollen.x < arena.left - 110) {
                pollen.destroy({ children: true });
                pollenItems.splice(i, 1);
            }
        }
    }

    function updateHazards(dt) {
        const arena = getArena();
        state.hazardTimer -= dt;
        if (state.hazardTimer <= 0) {
            state.hazardTimer = randomBetween(0.95, 1.45);
            createHazard(arena.right + 64, randomBetween(arena.top + 24, arena.bottom - 24));
        }

        if (state.invulnerable > 0) {
            state.invulnerable -= dt;
        }

        for (let i = hazards.length - 1; i >= 0; i -= 1) {
            const hazard = hazards[i];
            hazard.x -= hazard.speed * dt;
            hazard.rotation += hazard.rotationSpeed * dt;
            hazard.alpha = hazard.x > arena.right - 74 ? 0.52 : 1;
            const pulse = 1 + Math.sin(state.time * 8 + hazard.x * 0.02) * 0.08;
            hazard.warning.scale.set(pulse);
            hazard.rim.alpha = 0.42 + Math.sin(state.time * 7) * 0.14;

            if (state.player && state.invulnerable <= 0 && isColliding(state.player, hazard, PLAYER_RADIUS, HAZARD_RADIUS)) {
                state.health -= 1;
                state.invulnerable = 1.05;
                updateHud();
                burst(hazard.x, hazard.y, 0xff4fbd, 18);
                createRing(hazard.x, hazard.y, 0xff4fbd, 0.5, 64);
                hazard.destroy({ children: true });
                hazards.splice(i, 1);

                if (state.health <= 0) {
                    finishRun(false);
                }
                continue;
            }

            if (hazard.x < arena.left - 120) {
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
            particle.vx *= Math.pow(0.93, dt * 60);
            particle.vy *= Math.pow(0.93, dt * 60);
            const progress = Math.max(0, particle.life / particle.maxLife);
            particle.alpha = progress;
            particle.scale.set(particle.baseScale * (0.45 + progress * 0.85));

            if (particle.life <= 0) {
                particle.destroy();
                particles.splice(i, 1);
            }
        }

        for (let i = rings.length - 1; i >= 0; i -= 1) {
            const ring = rings[i];
            ring.life -= dt;
            const progress = 1 - Math.max(0, ring.life / ring.maxLife);
            ring.clear();
            ring.lineStyle(2.5, ring.color, Math.max(0, 1 - progress));
            ring.drawCircle(0, 0, ring.maxRadius * progress);

            if (ring.life <= 0) {
                ring.destroy();
                rings.splice(i, 1);
            }
        }
    }

    function updateBackground(dt) {
        const w = app.screen.width;
        const h = app.screen.height;
        for (const spore of spores) {
            spore.x -= spore.speed * dt;
            spore.y += Math.sin(spore.pulse) * spore.drift * dt;
            spore.pulse += dt * 2;
            spore.alpha = 0.45 + Math.sin(spore.pulse) * 0.28;
            if (spore.x < -12) {
                spore.x = w + 12;
                spore.y = randomBetween(0, h);
            }
        }

        for (const bloom of blooms) {
            bloom.phase += dt;
            bloom.x -= bloom.speed * dt;
            bloom.scale.set(1 + Math.sin(bloom.phase) * 0.06);
            if (bloom.x < -180) {
                bloom.x = w + 180;
                bloom.y = randomBetween(-20, h + 20);
            }
        }
    }

    function tick() {
        const dt = Math.min(app.ticker.elapsedMS / 1000, 0.033);
        updateBackground(dt);
        updateCamera(dt);

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
        const screenX = ((event.clientX - rect.left) / rect.width) * app.screen.width;
        const screenY = ((event.clientY - rect.top) / rect.height) * app.screen.height;
        const point = screenToWorld(screenX, screenY);
        mouse.x = point.x;
        mouse.y = point.y;
        mouse.active = true;
        mouse.lastMove = performance.now();
    });

    app.view.addEventListener('pointerleave', () => {
        mouse.active = false;
    });

    window.addEventListener('resize', () => {
        createBackground();
        if (state.player) {
            const arena = getArena();
            state.player.x = clamp(state.player.x, arena.left + 30, arena.right - 30);
            state.player.y = clamp(state.player.y, arena.top + 30, arena.bottom - 30);
        }
        updateCamera(1, true);
    });

    window.nocturneWingsDebug = {
        get fps() {
            return app.ticker.FPS;
        },
        counts() {
            return {
                pollen: pollenItems.length,
                hazards: hazards.length,
                particles: particles.length,
                rings: rings.length
            };
        },
        state
    };

    createBackground();
    updateHud();
    showPanel('start');
    app.ticker.add(tick);
})();
