(() => {
    'use strict';

    const TARGET_POLLEN = 40;
    const START_HEALTH = 3;
    const PLAYER_RADIUS = 23;
    const POLLEN_RADIUS = 13;
    const HAZARD_RADIUS = 25;
    const VIEW_ZOOM = 1.28;
    const BIOME_LENGTH = 30;
    const MAX_PARTICLES = 220;
    const MAX_RINGS = 18;
    const MAX_HAZARDS = 8;
    const DASH_SPEED = 1120;
    const DASH_COOLDOWN = 1.0;
    const DASH_DURATION = 0.16;

    const BIOMES = [
        {
            key: 'moonleaf',
            name: 'Moonleaf Grove',
            hazard: 'thorn',
            colors: ['#061028', '#171352', '#063342', '#120720'],
            glows: [[0x5df5ff, 0.2, 0.22, 170], [0xff72cf, 0.78, 0.3, 185], [0xffd66b, 0.52, 0.78, 130]],
            foliage: [0x0d5a5a, 0x168175, 0x1a3a6b, 0x34235f],
            accent: 0x7af7ff,
            pollen: 0xffd66b,
            hazardColor: 0xff4fbd
        },
        {
            key: 'amber',
            name: 'Amber Fern Canopy',
            hazard: 'wasp',
            colors: ['#071809', '#1f3b16', '#40200d', '#170714'],
            glows: [[0xffbe50, 0.22, 0.24, 175], [0x54ffb8, 0.78, 0.28, 165], [0xff5b70, 0.55, 0.78, 145]],
            foliage: [0x285f20, 0x478f2e, 0x73621c, 0x205b4b],
            accent: 0xffd66b,
            pollen: 0xffe08a,
            hazardColor: 0xff3148
        },
        {
            key: 'sky',
            name: 'Cloudbreak Sky',
            hazard: 'rain',
            colors: ['#82c9ff', '#4f8fd6', '#a9d9ff', '#f3d6ff'],
            glows: [[0xffffff, 0.28, 0.22, 150], [0x9ef4ff, 0.72, 0.35, 170], [0xfff1b8, 0.56, 0.78, 120]],
            foliage: [0xffffff, 0xd9f4ff, 0xc7dcff, 0xf8edff],
            accent: 0xffffff,
            pollen: 0xffd66b,
            hazardColor: 0x5bbcff
        }
    ];

    const shell = document.getElementById('gameShell');
    const canvasMount = document.getElementById('gameCanvas');
    const startScreen = document.getElementById('startScreen');
    const gameOverScreen = document.getElementById('gameOverScreen');
    const pauseScreen = document.getElementById('pauseScreen');
    const biomeToast = document.getElementById('biomeToast');
    const startButton = document.getElementById('startButton');
    const restartButton = document.getElementById('restartButton');
    const resumeButton = document.getElementById('resumeButton');
    const scoreValue = document.getElementById('scoreValue');
    const pollenValue = document.getElementById('pollenValue');
    const healthValue = document.getElementById('healthValue');
    const goalValue = document.getElementById('goalValue');
    const biomeValue = document.getElementById('biomeValue');
    const dashValue = document.getElementById('dashValue');
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
        backgroundColor: 0x071026,
        antialias: true,
        autoDensity: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2)
    });

    canvasMount.appendChild(app.view);

    const backgroundLayer = new PIXI.Container();
    const farLayer = new PIXI.Container();
    const midLayer = new PIXI.Container();
    const bloomLayer = new PIXI.Container();
    const world = new PIXI.Container();
    const pollenLayer = new PIXI.Container();
    const warningLayer = new PIXI.Container();
    const hazardLayer = new PIXI.Container();
    const effectLayer = new PIXI.Container();
    const playerLayer = new PIXI.Container();
    const nearLayer = new PIXI.Container();
    const foregroundLayer = new PIXI.Container();

    app.stage.addChild(backgroundLayer, farLayer, midLayer, bloomLayer, world, nearLayer, foregroundLayer);
    world.addChild(pollenLayer, warningLayer, hazardLayer, effectLayer, playerLayer);
    world.scale.set(VIEW_ZOOM);

    const bloomBlur = new PIXI.BlurFilter(14, 3);
    bloomBlur.padding = 64;
    bloomLayer.filters = [bloomBlur];
    bloomLayer.blendMode = PIXI.BLEND_MODES.ADD;

    const keys = new Set();
    const pollenItems = [];
    const hazards = [];
    const particles = [];
    const rings = [];
    const backgroundObjects = [];
    const glows = [];

    let backgroundTexture = null;
    let particleTexture = null;
    let biomeToastTimer = 0;

    const camera = { x: 0, y: 0, targetX: 0, targetY: 0 };
    const mouse = { x: 0, y: 0, active: false, lastMove: 0 };
    const audio = { context: null, master: null, musicGain: null, oscA: null, oscB: null };

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
        dashCooldown: 0,
        dashTime: 0,
        biomeIndex: 0,
        player: null,
        velocity: { x: 0, y: 0 },
        facing: 0
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

    function pick(list) {
        return list[Math.floor(Math.random() * list.length)];
    }

    function angleLerp(current, target, amount) {
        let diff = target - current;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        return current + diff * amount;
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

    function getBiome() {
        return BIOMES[state.biomeIndex] || BIOMES[0];
    }

    function getArena() {
        const worldWidth = app.screen.width / VIEW_ZOOM;
        const worldHeight = app.screen.height / VIEW_ZOOM;
        const marginX = Math.min(84 / VIEW_ZOOM, worldWidth * 0.115);
        const top = Math.min(104 / VIEW_ZOOM, worldHeight * 0.18);
        const bottomMargin = Math.min(58 / VIEW_ZOOM, worldHeight * 0.12);
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
        if (biomeValue) biomeValue.textContent = getBiome().name;
        if (dashValue) {
            dashValue.textContent = state.dashCooldown <= 0 ? 'Ready' : `${Math.ceil(state.dashCooldown * 10) / 10}s`;
            dashValue.dataset.ready = state.dashCooldown <= 0 ? 'true' : 'false';
        }
    }

    function showPanel(panel) {
        startScreen.hidden = panel !== 'start';
        gameOverScreen.hidden = panel !== 'gameOver';
        pauseScreen.hidden = panel !== 'pause';
    }

    function initAudio() {
        if (audio.context || (!window.AudioContext && !window.webkitAudioContext)) return;
        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            const context = new AudioContextClass();
            const master = context.createGain();
            const musicGain = context.createGain();
            const filter = context.createBiquadFilter();
            const oscA = context.createOscillator();
            const oscB = context.createOscillator();
            master.gain.value = 0.5;
            musicGain.gain.value = 0.012;
            filter.type = 'lowpass';
            filter.frequency.value = 820;
            oscA.type = 'sine';
            oscB.type = 'triangle';
            oscA.frequency.value = 110;
            oscB.frequency.value = 165;
            oscA.connect(filter);
            oscB.connect(filter);
            filter.connect(musicGain);
            musicGain.connect(master);
            master.connect(context.destination);
            oscA.start();
            oscB.start();
            audio.context = context;
            audio.master = master;
            audio.musicGain = musicGain;
            audio.oscA = oscA;
            audio.oscB = oscB;
        } catch (error) {
            audio.context = null;
        }
    }

    function setMusic(active) {
        if (!audio.context || !audio.musicGain) return;
        audio.musicGain.gain.setTargetAtTime(active ? 0.03 : 0.01, audio.context.currentTime, 0.25);
    }

    function playTone(frequency, duration, type = 'sine', gain = 0.04, sweep = 0) {
        if (!audio.context || !audio.master) return;
        const now = audio.context.currentTime;
        const osc = audio.context.createOscillator();
        const env = audio.context.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(frequency, now);
        if (sweep !== 0) osc.frequency.exponentialRampToValueAtTime(Math.max(30, frequency + sweep), now + duration);
        env.gain.setValueAtTime(0.0001, now);
        env.gain.exponentialRampToValueAtTime(gain, now + 0.012);
        env.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        osc.connect(env);
        env.connect(audio.master);
        osc.start(now);
        osc.stop(now + duration + 0.04);
    }

    function playCollectSound() { playTone(760, 0.08, 'triangle', 0.035, 250); }
    function playDashSound() { playTone(240, 0.12, 'sawtooth', 0.03, 500); }
    function playHitSound() { playTone(150, 0.18, 'sawtooth', 0.05, -70); }
    function playBiomeSound() { playTone(330, 0.2, 'sine', 0.03, 220); }

    function createParticleTexture() {
        if (particleTexture) return;
        const g = new PIXI.Graphics();
        g.beginFill(0xffffff, 1);
        g.drawCircle(8, 8, 8);
        g.endFill();
        particleTexture = app.renderer.generateTexture(g);
        g.destroy();
    }

    function createGradientTexture(width, height, biome) {
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(2, Math.floor(width));
        canvas.height = Math.max(2, Math.floor(height));
        const ctx = canvas.getContext('2d');
        const linear = ctx.createLinearGradient(0, 0, width, height);
        linear.addColorStop(0, biome.colors[0]);
        linear.addColorStop(0.35, biome.colors[1]);
        linear.addColorStop(0.7, biome.colors[2]);
        linear.addColorStop(1, biome.colors[3]);
        ctx.fillStyle = linear;
        ctx.fillRect(0, 0, width, height);
        return PIXI.Texture.from(canvas);
    }

    function drawLeafShape(color, vein, alpha, scale) {
        const leaf = new PIXI.Container();
        const g = new PIXI.Graphics();
        g.beginFill(color, alpha);
        g.lineStyle(1, vein, alpha * 0.34);
        g.moveTo(0, -42 * scale);
        g.bezierCurveTo(38 * scale, -30 * scale, 50 * scale, 18 * scale, 0, 50 * scale);
        g.bezierCurveTo(-50 * scale, 18 * scale, -38 * scale, -30 * scale, 0, -42 * scale);
        g.endFill();
        g.lineStyle(1, vein, alpha * 0.5);
        g.moveTo(0, -32 * scale);
        g.lineTo(0, 42 * scale);
        leaf.addChild(g);
        return leaf;
    }

    function drawCloudShape(color, alpha, scale) {
        const cloud = new PIXI.Container();
        const g = new PIXI.Graphics();
        g.beginFill(color, alpha);
        g.drawEllipse(-42 * scale, 8 * scale, 34 * scale, 18 * scale);
        g.drawEllipse(-12 * scale, -6 * scale, 40 * scale, 24 * scale);
        g.drawEllipse(28 * scale, 5 * scale, 38 * scale, 20 * scale);
        g.drawRoundedRect(-70 * scale, 6 * scale, 140 * scale, 26 * scale, 16 * scale);
        g.endFill();
        cloud.addChild(g);
        return cloud;
    }

    function drawArenaFrame() {
        foregroundLayer.removeChildren().forEach((child) => child.destroy({ children: true }));
        const arena = getArena();
        const x = arena.left * VIEW_ZOOM;
        const y = arena.top * VIEW_ZOOM;
        const width = arena.width * VIEW_ZOOM;
        const height = arena.height * VIEW_ZOOM;
        const accent = getBiome().accent;

        const vignette = new PIXI.Graphics();
        vignette.beginFill(0x02030a, getBiome().key === 'sky' ? 0.08 : 0.2);
        vignette.drawRect(0, 0, app.screen.width, y);
        vignette.drawRect(0, y + height, app.screen.width, app.screen.height - y - height);
        vignette.drawRect(0, y, x, height);
        vignette.drawRect(x + width, y, app.screen.width - x - width, height);
        vignette.endFill();

        const frame = new PIXI.Graphics();
        frame.lineStyle(2, accent, 0.28);
        frame.drawRoundedRect(x, y, width, height, 24);
        frame.lineStyle(1, 0xffd66b, 0.16);
        frame.drawRoundedRect(x + 5, y + 5, width - 10, height - 10, 18);
        foregroundLayer.addChild(vignette, frame);
    }

    function clearBackgroundLayers() {
        for (const layer of [backgroundLayer, farLayer, midLayer, bloomLayer, nearLayer]) {
            layer.removeChildren().forEach((child) => child.destroy({ children: true }));
        }
        backgroundObjects.length = 0;
        glows.length = 0;
        if (backgroundTexture) {
            backgroundTexture.destroy(true);
            backgroundTexture = null;
        }
    }

    function createBackground() {
        clearBackgroundLayers();
        const biome = getBiome();
        const w = app.screen.width;
        const h = app.screen.height;
        backgroundTexture = createGradientTexture(w, h, biome);
        const gradient = new PIXI.Sprite(backgroundTexture);
        gradient.width = w;
        gradient.height = h;
        backgroundLayer.addChild(gradient);

        for (const glow of biome.glows) {
            const g = new PIXI.Graphics();
            g.beginFill(glow[0], 0.14);
            g.drawCircle(0, 0, glow[3]);
            g.endFill();
            g.x = w * glow[1];
            g.y = h * glow[2];
            g.speed = randomBetween(2, 7);
            g.phase = randomBetween(0, Math.PI * 2);
            bloomLayer.addChild(g);
            glows.push(g);
        }

        const sky = biome.key === 'sky';
        const configs = sky
            ? [
                { layer: farLayer, count: 12, min: 0.55, max: 1.1, alpha: 0.2, speed: [8, 20], blur: 2 },
                { layer: midLayer, count: 13, min: 0.65, max: 1.35, alpha: 0.34, speed: [18, 36], blur: 0 },
                { layer: nearLayer, count: 5, min: 1.25, max: 2.0, alpha: 0.22, speed: [32, 54], blur: 3 }
            ]
            : [
                { layer: farLayer, count: 16, min: 0.62, max: 1.1, alpha: 0.14, speed: [8, 18], blur: 2 },
                { layer: midLayer, count: 22, min: 0.78, max: 1.55, alpha: 0.2, speed: [18, 36], blur: 0 },
                { layer: nearLayer, count: 8, min: 1.5, max: 2.35, alpha: 0.15, speed: [30, 52], blur: 3 }
            ];

        for (const config of configs) {
            for (let i = 0; i < config.count; i += 1) {
                const scale = randomBetween(config.min, config.max);
                const object = sky
                    ? drawCloudShape(pick(biome.foliage), randomBetween(config.alpha * 0.75, config.alpha * 1.2), scale)
                    : drawLeafShape(pick(biome.foliage), biome.accent, randomBetween(config.alpha * 0.7, config.alpha * 1.2), scale);
                object.x = randomBetween(-160, w + 220);
                object.y = randomBetween(-80, h + 100);
                object.rotation = sky ? randomBetween(-0.1, 0.1) : randomBetween(-1.8, 1.8);
                object.speed = randomBetween(config.speed[0], config.speed[1]);
                object.drift = randomBetween(-9, 9);
                object.phase = randomBetween(0, Math.PI * 2);
                if (config.blur > 0) object.filters = [new PIXI.BlurFilter(config.blur, 1)];
                config.layer.addChild(object);
                backgroundObjects.push(object);
            }
        }

        const sporeCount = sky ? 72 : 130;
        for (let i = 0; i < sporeCount; i += 1) {
            const spore = new PIXI.Sprite(particleTexture);
            spore.anchor.set(0.5);
            spore.tint = sky ? 0xffffff : pick([biome.accent, biome.pollen, 0xff72cf, 0xb891ff]);
            spore.alpha = randomBetween(0.25, sky ? 0.55 : 0.85);
            spore.scale.set(randomBetween(0.12, sky ? 0.26 : 0.34));
            spore.x = randomBetween(0, w);
            spore.y = randomBetween(0, h);
            spore.speed = randomBetween(10, sky ? 30 : 52);
            spore.drift = randomBetween(-12, 12);
            spore.phase = randomBetween(0, Math.PI * 2);
            spore.blendMode = PIXI.BLEND_MODES.ADD;
            backgroundLayer.addChild(spore);
            backgroundObjects.push(spore);
        }

        drawArenaFrame();
    }

    function applyBiome(index, announce = false) {
        state.biomeIndex = index % BIOMES.length;
        shell.dataset.biome = getBiome().key;
        createBackground();
        updateHud();
        if (announce && biomeToast) {
            biomeToast.textContent = getBiome().name;
            biomeToast.hidden = false;
            biomeToastTimer = 2.2;
            playBiomeSound();
            const arena = getArena();
            createRing(arena.centerX, arena.centerY, getBiome().accent, 0.9, 170);
        }
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

        const outerGlow = makeCircle(62, 0xff7d4b, 0.13);
        outerGlow.blendMode = PIXI.BLEND_MODES.ADD;
        const glow = makeCircle(40, 0xffd66b, 0.18);
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

        const body = new PIXI.Container();
        const abdomen = new PIXI.Graphics();
        abdomen.beginFill(0x100a17, 1);
        abdomen.drawEllipse(0, 9, 5.5, 21);
        abdomen.endFill();
        abdomen.lineStyle(1.2, 0xffd66b, 0.48);
        for (let y = -4; y <= 22; y += 7) {
            abdomen.moveTo(-4.5, y);
            abdomen.quadraticCurveTo(0, y + 3, 4.5, y);
        }
        const thorax = new PIXI.Graphics();
        thorax.beginFill(0x1b1221, 1);
        thorax.drawEllipse(0, -9, 7.5, 11);
        thorax.endFill();
        thorax.beginFill(0x3a2638, 0.8);
        thorax.drawEllipse(0, -11, 3.8, 6);
        thorax.endFill();
        const head = new PIXI.Graphics();
        head.beginFill(0x15101c, 1);
        head.drawCircle(0, -24, 7);
        head.endFill();
        head.beginFill(0xfff1ae, 0.78);
        head.drawCircle(-3, -25, 1.6);
        head.drawCircle(3, -25, 1.6);
        head.endFill();
        head.lineStyle(1.8, 0xffd66b, 0.86);
        head.moveTo(-3, -29);
        head.quadraticCurveTo(-12, -36, -17, -32);
        head.moveTo(3, -29);
        head.quadraticCurveTo(12, -36, 17, -32);
        body.addChild(abdomen, thorax, head);

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
        const aura = makeCircle(28, getBiome().pollen, 0.2);
        aura.blendMode = PIXI.BLEND_MODES.ADD;
        const petals = new PIXI.Graphics();
        petals.beginFill(getBiome().pollen, 0.9);
        for (let i = 0; i < 6; i += 1) {
            const angle = (Math.PI * 2 * i) / 6;
            petals.drawEllipse(Math.cos(angle) * 8, Math.sin(angle) * 8, 3.5, 2.1);
        }
        petals.endFill();
        const core = new PIXI.Graphics();
        core.beginFill(0xfff4b4, 1);
        core.drawCircle(0, 0, 8.5);
        core.endFill();
        core.beginFill(0xff8f5c, 0.92);
        core.drawCircle(3, -3, 3);
        core.endFill();
        pollen.addChild(aura, petals, core);
        pollen.petals = petals;
        pollen.x = x;
        pollen.y = y;
        pollen.phase = randomBetween(0, Math.PI * 2);
        pollen.blendMode = PIXI.BLEND_MODES.ADD;
        pollenLayer.addChild(pollen);
        pollenItems.push(pollen);
    }

    function createThornHazard() {
        const arena = getArena();
        const hazard = new PIXI.Container();
        const glow = makeCircle(38, 0xff4fbd, 0.17);
        glow.blendMode = PIXI.BLEND_MODES.ADD;
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
        hazard.addChild(glow, thorn);
        hazard.x = arena.right + 70;
        hazard.y = randomBetween(arena.top + 28, arena.bottom - 28);
        hazardLayer.addChild(hazard);
        hazards.push({ type: 'thorn', container: hazard, x: hazard.x, y: hazard.y, radius: HAZARD_RADIUS, speed: randomBetween(175, 235), rotationSpeed: randomBetween(-1.8, 1.8) });
    }

    function createWaspSprite() {
        const wasp = new PIXI.Container();
        const glow = makeCircle(28, 0xff2d3d, 0.18);
        glow.blendMode = PIXI.BLEND_MODES.ADD;
        const leftWing = new PIXI.Graphics();
        leftWing.beginFill(0xcffaff, 0.42);
        leftWing.drawEllipse(-9, -12, 8, 16);
        leftWing.endFill();
        const rightWing = new PIXI.Graphics();
        rightWing.beginFill(0xcffaff, 0.42);
        rightWing.drawEllipse(9, -12, 8, 16);
        rightWing.endFill();
        const body = new PIXI.Graphics();
        body.beginFill(0x241315, 1);
        body.drawEllipse(0, 1, 8, 23);
        body.endFill();
        body.beginFill(0xffcf3a, 1);
        body.drawRoundedRect(-7, -12, 14, 5, 2);
        body.drawRoundedRect(-7, 1, 14, 5, 2);
        body.drawRoundedRect(-6, 13, 12, 4, 2);
        body.endFill();
        body.beginFill(0xfff1a2, 0.9);
        body.drawCircle(0, -23, 7);
        body.endFill();
        body.beginFill(0x14090c, 1);
        body.drawCircle(-2.8, -24, 1.5);
        body.drawCircle(2.8, -24, 1.5);
        body.endFill();
        body.lineStyle(1.7, 0x14090c, 0.9);
        body.moveTo(-2, -28);
        body.lineTo(-11, -36);
        body.moveTo(2, -28);
        body.lineTo(11, -36);
        body.moveTo(0, 22);
        body.lineTo(0, 32);
        wasp.addChild(glow, leftWing, rightWing, body);
        wasp.leftWing = leftWing;
        wasp.rightWing = rightWing;
        return wasp;
    }

    function createWaspHazard() {
        const arena = getArena();
        const y = randomBetween(arena.top + 34, arena.bottom - 34);
        const slope = randomBetween(-0.1, 0.1);
        const startX = arena.right + 120;
        const endX = arena.left - 140;
        const startY = y;
        const endY = clamp(y + (endX - startX) * slope, arena.top + 26, arena.bottom - 26);
        const container = new PIXI.Container();
        const warning = new PIXI.Graphics();
        warning.lineStyle(16, 0xff3148, 0.16);
        warning.moveTo(startX, startY);
        warning.lineTo(endX, endY);
        warning.lineStyle(2, 0xff8a96, 0.62);
        warning.moveTo(startX, startY);
        warning.lineTo(endX, endY);
        warning.blendMode = PIXI.BLEND_MODES.ADD;
        const wasp = createWaspSprite();
        wasp.visible = false;
        wasp.x = startX;
        wasp.y = startY;
        wasp.rotation = Math.atan2(endY - startY, endX - startX) - Math.PI / 2;
        container.addChild(warning, wasp);
        warningLayer.addChild(container);
        hazards.push({ type: 'wasp', container, warning, wasp, startX, startY, endX, endY, timer: 0, warningTime: 1.75, attackTime: 0.68, phase: 'warning', x: startX, y: startY, radius: HAZARD_RADIUS });
    }

    function createRainHazard() {
        const arena = getArena();
        const drop = new PIXI.Container();
        const trail = new PIXI.Graphics();
        trail.lineStyle(5, 0xb9f2ff, 0.3);
        trail.moveTo(0, -22);
        trail.lineTo(0, 18);
        const core = new PIXI.Graphics();
        core.beginFill(0xd8fbff, 0.95);
        core.drawEllipse(0, 8, 5, 15);
        core.endFill();
        drop.addChild(trail, core);
        drop.x = randomBetween(arena.left + 28, arena.right - 28);
        drop.y = arena.top - 65;
        hazardLayer.addChild(drop);
        hazards.push({ type: 'rain', container: drop, x: drop.x, y: drop.y, radius: 16, speed: randomBetween(360, 465), drift: randomBetween(-22, 22) });
    }

    function spawnHazard() {
        if (hazards.length >= MAX_HAZARDS) return;
        const hazard = getBiome().hazard;
        if (hazard === 'thorn') createThornHazard();
        if (hazard === 'wasp') createWaspHazard();
        if (hazard === 'rain') createRainHazard();
    }

    function createParticle(x, y, color, size, speedX, speedY, life, alpha = 0.82) {
        if (particles.length >= MAX_PARTICLES) particles.shift().destroy();
        const particle = new PIXI.Sprite(particleTexture);
        particle.anchor.set(0.5);
        particle.tint = color;
        particle.alpha = alpha;
        particle.scale.set(size / 8);
        particle.x = x;
        particle.y = y;
        particle.vx = speedX;
        particle.vy = speedY;
        particle.life = life;
        particle.maxLife = life;
        particle.baseScale = size / 8;
        particle.blendMode = PIXI.BLEND_MODES.ADD;
        effectLayer.addChild(particle);
        particles.push(particle);
    }

    function createRing(x, y, color, life, maxRadius) {
        if (rings.length >= MAX_RINGS) rings.shift().destroy();
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
            const speed = randomBetween(95, 280);
            createParticle(x, y, color, randomBetween(2, 5.8), Math.cos(angle) * speed, Math.sin(angle) * speed, randomBetween(0.35, 0.86));
        }
    }

    function clearRunObjects() {
        pollenItems.splice(0).forEach((item) => item.destroy({ children: true }));
        hazards.splice(0).forEach((hazard) => hazard.container.destroy({ children: true }));
        particles.splice(0).forEach((particle) => particle.destroy());
        rings.splice(0).forEach((ring) => ring.destroy());
        pollenLayer.removeChildren();
        warningLayer.removeChildren();
        hazardLayer.removeChildren();
        effectLayer.removeChildren();
    }

    function resetRun() {
        clearRunObjects();
        if (state.player) state.player.destroy({ children: true });
        state.time = 0;
        state.biomeIndex = 0;
        applyBiome(0, false);
        state.player = createMonarchButterfly();
        playerLayer.addChild(state.player);
        state.velocity.x = 0;
        state.velocity.y = 0;
        state.score = 0;
        state.pollen = 0;
        state.health = START_HEALTH;
        state.invulnerable = 0;
        state.pollenTimer = 0.35;
        state.hazardTimer = 1.2;
        state.particleTimer = 0;
        state.dashCooldown = 0;
        state.dashTime = 0;
        state.facing = 0;
        camera.x = 0;
        camera.y = 0;
        camera.targetX = 0;
        camera.targetY = 0;
        mouse.active = false;
        updateHud();
        updateCamera(1, true);
    }

    function startRun() {
        initAudio();
        if (audio.context && audio.context.state === 'suspended') audio.context.resume();
        resetRun();
        state.mode = 'playing';
        showPanel(null);
        setMusic(true);
        app.view.focus?.();
    }

    function pauseRun() {
        if (state.mode !== 'playing') return;
        state.mode = 'paused';
        showPanel('pause');
        setMusic(false);
    }

    function resumeRun() {
        if (state.mode !== 'paused') return;
        state.mode = 'playing';
        showPanel(null);
        setMusic(true);
    }

    function finishRun(won) {
        state.mode = 'gameOver';
        resultEyebrow.textContent = won ? 'Goal Reached' : 'Run Ended';
        resultTitle.textContent = won ? 'Garden Cleared' : 'Game Over';
        resultSummary.textContent = won
            ? 'The monarch gathered enough pollen to finish this Phase D route.'
            : 'The last health was lost. Read the biome hazard and dash clear before impact.';
        finalScore.textContent = String(state.score);
        finalPollen.textContent = String(state.pollen);
        setMusic(false);
        showPanel('gameOver');
    }

    function spawnPollenCluster() {
        const arena = getArena();
        const baseY = randomBetween(arena.top + 24, arena.bottom - 24);
        const cluster = Math.random() > 0.55 ? 4 : 3;
        for (let i = 0; i < cluster; i += 1) {
            createPollen(arena.right + 34 + 34 * i, baseY + Math.sin(i * 1.2) * 27);
        }
    }

    function tryDash() {
        if (state.mode !== 'playing' || state.dashCooldown > 0 || !state.player) return;
        let dx = state.velocity.x;
        let dy = state.velocity.y;
        if (Math.hypot(dx, dy) < 30 && mouse.active) {
            dx = mouse.x - state.player.x;
            dy = mouse.y - state.player.y;
        }
        if (Math.hypot(dx, dy) < 30) {
            dx = Math.sin(state.facing);
            dy = -Math.cos(state.facing);
        }
        const len = Math.hypot(dx, dy) || 1;
        state.velocity.x = (dx / len) * DASH_SPEED;
        state.velocity.y = (dy / len) * DASH_SPEED;
        state.dashCooldown = DASH_COOLDOWN;
        state.dashTime = DASH_DURATION;
        playDashSound();
        createRing(state.player.x, state.player.y, getBiome().accent, 0.36, 72);
        burst(state.player.x, state.player.y, getBiome().accent, 18);
        updateHud();
    }

    function updateBiome(dt) {
        const targetBiome = Math.floor(state.time / BIOME_LENGTH) % BIOMES.length;
        if (targetBiome !== state.biomeIndex) {
            clearRunObjects();
            applyBiome(targetBiome, true);
            state.hazardTimer = 1.0;
        }
        if (biomeToast && !biomeToast.hidden) {
            biomeToastTimer -= dt;
            if (biomeToastTimer <= 0) biomeToast.hidden = true;
        }
    }

    function updateCamera(dt, immediate = false) {
        if (state.player) {
            const arena = getArena();
            const kick = state.dashTime > 0 ? 1.5 : 1;
            camera.targetX = clamp((arena.centerX - state.player.x) * 0.14 * kick, -28, 28);
            camera.targetY = clamp((arena.centerY - state.player.y) * 0.11 * kick, -18, 18);
        }
        const ease = immediate ? 1 : 1 - Math.pow(0.00065, dt);
        camera.x = lerp(camera.x, camera.targetX, ease);
        camera.y = lerp(camera.y, camera.targetY, ease);
        world.scale.set(VIEW_ZOOM);
        world.x = camera.x * VIEW_ZOOM;
        world.y = camera.y * VIEW_ZOOM;
    }

    function updatePlayer(dt) {
        const player = state.player;
        if (!player) return;

        state.dashCooldown = Math.max(0, state.dashCooldown - dt);
        state.dashTime = Math.max(0, state.dashTime - dt);

        let ax = 0;
        let ay = 0;
        const left = keys.has('arrowleft') || keys.has('a');
        const right = keys.has('arrowright') || keys.has('d');
        const up = keys.has('arrowup') || keys.has('w');
        const down = keys.has('arrowdown') || keys.has('s');
        const hasKeyboard = left || right || up || down;

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
            const pull = clamp(length / 170, 0, 1) * (hasKeyboard ? 0.35 : 1.25);
            ax += (dx / length) * pull;
            ay += (dy / length) * pull;
        }

        const inputLength = Math.hypot(ax, ay);
        if (inputLength > 1) {
            ax /= inputLength;
            ay /= inputLength;
        }

        const acceleration = state.dashTime > 0 ? 1900 : 1780;
        const yBoost = 1.32;
        const drag = state.dashTime > 0 ? 0.97 : 0.91;
        const maxSpeed = state.dashTime > 0 ? 1120 : 780;

        state.velocity.x += ax * acceleration * dt;
        state.velocity.y += ay * acceleration * yBoost * dt;
        state.velocity.x *= Math.pow(drag, dt * 60);
        state.velocity.y *= Math.pow(drag, dt * 60);

        const speed = Math.hypot(state.velocity.x, state.velocity.y);
        if (speed > maxSpeed) {
            state.velocity.x = (state.velocity.x / speed) * maxSpeed;
            state.velocity.y = (state.velocity.y / speed) * maxSpeed;
        }

        const arena = getArena();
        player.x = clamp(player.x + state.velocity.x * dt, arena.left + 30, arena.right - 30);
        player.y = clamp(player.y + state.velocity.y * dt, arena.top + 30, arena.bottom - 30);

        const currentSpeed = Math.hypot(state.velocity.x, state.velocity.y);
        if (currentSpeed > 35) {
            const targetFacing = Math.atan2(state.velocity.y, state.velocity.x) + Math.PI / 2;
            state.facing = angleLerp(state.facing, targetFacing, 1 - Math.pow(0.0002, dt));
        }

        const flutter = Math.sin(state.time * (state.dashTime > 0 ? 34 : 24)) * (0.2 + currentSpeed / 3100);
        player.leftWing.scale.x = 1 + flutter;
        player.rightWing.scale.x = 1 + flutter;
        player.leftWing.rotation = -0.04 + flutter * 0.1;
        player.rightWing.rotation = 0.04 - flutter * 0.1;
        player.body.rotation = clamp(state.velocity.x / 1800, -0.08, 0.08);
        player.scale.set(1 + Math.sin(state.time * 4.8) * 0.018 + (state.dashTime > 0 ? 0.08 : 0));
        player.rotation = state.facing;
        player.glow.alpha = state.invulnerable > 0 ? 0.34 + Math.sin(state.time * 36) * 0.16 : 0.19 + currentSpeed / 5000;
        player.outerGlow.alpha = 0.78 + Math.sin(state.time * 6) * 0.14;

        state.particleTimer -= dt;
        if (state.particleTimer <= 0) {
            state.particleTimer = state.dashTime > 0 ? 0.018 : 0.036;
            createParticle(
                player.x + randomBetween(-7, 7),
                player.y + randomBetween(-16, 18),
                state.dashTime > 0 ? getBiome().accent : (Math.random() > 0.5 ? 0xffb24a : getBiome().accent),
                randomBetween(2, 5),
                -state.velocity.x * 0.18 + randomBetween(-60, 60),
                -state.velocity.y * 0.18 + randomBetween(-60, 60),
                randomBetween(0.34, 0.68),
                0.68
            );
        }
        updateHud();
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
            pollen.rotation += dt * 1.9;
            pollen.petals.rotation -= dt * 2.8;
            if (state.player && isColliding(state.player, pollen, PLAYER_RADIUS, POLLEN_RADIUS)) {
                state.score += 10;
                state.pollen += 1;
                updateHud();
                playCollectSound();
                burst(pollen.x, pollen.y, getBiome().pollen, 12);
                createRing(pollen.x, pollen.y, getBiome().pollen, 0.42, 48);
                pollen.destroy({ children: true });
                pollenItems.splice(i, 1);
                if (state.pollen >= TARGET_POLLEN) finishRun(true);
                continue;
            }
            if (pollen.x < arena.left - 110) {
                pollen.destroy({ children: true });
                pollenItems.splice(i, 1);
            }
        }
    }

    function updateHazards(dt) {
        const biome = getBiome();
        const arena = getArena();
        state.hazardTimer -= dt;
        if (state.hazardTimer <= 0) {
            state.hazardTimer = biome.hazard === 'rain' ? randomBetween(0.52, 0.82) : biome.hazard === 'wasp' ? randomBetween(1.55, 2.15) : randomBetween(1.05, 1.55);
            spawnHazard();
        }
        state.invulnerable = Math.max(0, state.invulnerable - dt);

        for (let i = hazards.length - 1; i >= 0; i -= 1) {
            const hazard = hazards[i];
            if (hazard.type === 'thorn') {
                hazard.x -= hazard.speed * dt;
                hazard.container.x = hazard.x;
                hazard.container.rotation += hazard.rotationSpeed * dt;
                hazard.container.alpha = hazard.x > arena.right - 60 ? 0.65 : 1;
            } else if (hazard.type === 'wasp') {
                hazard.timer += dt;
                if (hazard.phase === 'warning') {
                    hazard.warning.alpha = 0.9;
                    if (hazard.timer >= hazard.warningTime) {
                        hazard.phase = 'attack';
                        hazard.timer = 0;
                        hazard.wasp.visible = true;
                        hazard.warning.alpha = 0.22;
                        warningLayer.removeChild(hazard.container);
                        hazardLayer.addChild(hazard.container);
                    }
                } else {
                    const t = clamp(hazard.timer / hazard.attackTime, 0, 1);
                    const ease = t * t * (3 - 2 * t);
                    hazard.x = lerp(hazard.startX, hazard.endX, ease);
                    hazard.y = lerp(hazard.startY, hazard.endY, ease);
                    hazard.wasp.x = hazard.x;
                    hazard.wasp.y = hazard.y;
                    hazard.wasp.leftWing.scale.x = 1 + Math.sin(state.time * 54) * 0.35;
                    hazard.wasp.rightWing.scale.x = 1 + Math.sin(state.time * 54 + Math.PI) * 0.35;
                    if (t >= 1) hazard.done = true;
                }
            } else if (hazard.type === 'rain') {
                hazard.x += hazard.drift * dt;
                hazard.y += hazard.speed * dt;
                hazard.container.x = hazard.x;
                hazard.container.y = hazard.y;
                hazard.container.rotation = hazard.drift * 0.002;
                if (hazard.y > arena.bottom + 90) hazard.done = true;
            }

            if (!hazard.done && state.player && state.invulnerable <= 0 && hazard.type !== 'wasp-warning' && isColliding(state.player, hazard, PLAYER_RADIUS, hazard.radius)) {
                if (hazard.type !== 'wasp' || hazard.phase === 'attack') {
                    state.health -= 1;
                    state.invulnerable = 1.05;
                    updateHud();
                    playHitSound();
                    burst(hazard.x, hazard.y, biome.hazardColor, 20);
                    createRing(hazard.x, hazard.y, biome.hazardColor, 0.5, 68);
                    hazard.done = true;
                    if (state.health <= 0) finishRun(false);
                }
            }

            if (hazard.type === 'thorn' && hazard.x < arena.left - 120) hazard.done = true;
            if (hazard.done) {
                hazard.container.destroy({ children: true });
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
        for (const object of backgroundObjects) {
            object.phase += dt;
            object.x -= object.speed * dt;
            object.y += Math.sin(object.phase) * object.drift * dt;
            if (object.rotation !== undefined && getBiome().key !== 'sky') object.rotation += Math.sin(object.phase * 0.7) * 0.0015;
            if (object.x < -230) {
                object.x = w + randomBetween(50, 220);
                object.y = randomBetween(-90, h + 110);
            }
            if (object.tint !== undefined) object.alpha = clamp(object.alpha + Math.sin(object.phase) * 0.002, 0.18, 0.9);
        }
        for (const glow of glows) {
            glow.phase += dt;
            glow.x -= glow.speed * dt;
            glow.scale.set(1 + Math.sin(glow.phase) * 0.05);
            if (glow.x < -200) glow.x = w + 200;
        }
    }

    function tick() {
        const dt = Math.min(app.ticker.elapsedMS / 1000, 0.033);
        updateBackground(dt);
        updateCamera(dt);
        if (state.mode !== 'playing') return;
        state.time += dt;
        updateBiome(dt);
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
        if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' ', 'spacebar'].includes(key)) event.preventDefault();
        if (key === 'escape') {
            if (state.mode === 'playing') pauseRun();
            else if (state.mode === 'paused') resumeRun();
            return;
        }
        if ((key === 'enter' || key === ' ') && state.mode === 'menu') {
            startRun();
            return;
        }
        if ((key === ' ' || key === 'spacebar') && !event.repeat) {
            tryDash();
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
        get fps() { return app.ticker.FPS; },
        counts() {
            return {
                pollen: pollenItems.length,
                hazards: hazards.length,
                particles: particles.length,
                rings: rings.length,
                backgroundObjects: backgroundObjects.length,
                biome: getBiome().name,
                hazard: getBiome().hazard,
                dashCooldown: state.dashCooldown,
                facing: state.facing
            };
        },
        state,
        forceBiome(index = 1) { applyBiome(index, true); }
    };

    createParticleTexture();
    applyBiome(0, false);
    updateHud();
    showPanel('start');
    app.ticker.add(tick);
})();
