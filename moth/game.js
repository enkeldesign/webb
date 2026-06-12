(() => {
    'use strict';

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
    const SUMMON_COST = 2000;
    const SUMMON_TIME = 60 * 1000;
    const SAVE_KEY = 'nocturneWingsSaveV2';

    const SPECIES = {
        monarch: {
            name: 'Monarch', kind: 'butterfly', body: 0x100a17, thorax: 0x1b1221,
            wingA: 0xff7a1a, wingB: 0xffc94a, spot: 0xfff0a8, glow: 0xffa24a
        },
        cabbage: {
            name: 'Cabbage White', kind: 'butterfly', body: 0x2d3140, thorax: 0x4c5264,
            wingA: 0xf8fbff, wingB: 0xdcecff, spot: 0x2e3444, glow: 0xdff8ff
        },
        rosy: {
            name: 'Rosy Maple Moth', kind: 'moth', body: 0xffe37a, thorax: 0xff9ac9,
            wingA: 0xff8fc3, wingB: 0xffe875, spot: 0xfff5b8, glow: 0xff9ac9
        }
    };

    const SUMMON_POOL = ['cabbage', 'rosy'];

    const BIOMES = [
        {
            key: 'moonleaf', name: 'Moonleaf Grove', hazard: 'thorn',
            colors: ['#061028', '#171352', '#063342', '#120720'],
            glows: [[0x5df5ff, 0.2, 0.22, 170], [0xff72cf, 0.78, 0.3, 185], [0xffd66b, 0.52, 0.78, 130]],
            foliage: [0x0d5a5a, 0x168175, 0x1a3a6b, 0x34235f], accent: 0x7af7ff, pollen: 0xffd66b, hazardColor: 0xff4fbd
        },
        {
            key: 'amber', name: 'Amber Fern Canopy', hazard: 'wasp',
            colors: ['#071809', '#1f3b16', '#40200d', '#170714'],
            glows: [[0xffbe50, 0.22, 0.24, 175], [0x54ffb8, 0.78, 0.28, 165], [0xff5b70, 0.55, 0.78, 145]],
            foliage: [0x285f20, 0x478f2e, 0x73621c, 0x205b4b], accent: 0xffd66b, pollen: 0xffe08a, hazardColor: 0xff3148
        },
        {
            key: 'sky', name: 'Cloudbreak Sky', hazard: 'rain',
            colors: ['#82c9ff', '#4f8fd6', '#a9d9ff', '#f3d6ff'],
            glows: [[0xffffff, 0.28, 0.22, 150], [0x9ef4ff, 0.72, 0.35, 170], [0xfff1b8, 0.56, 0.78, 120]],
            foliage: [0xffffff, 0xd9f4ff, 0xc7dcff, 0xf8edff], accent: 0xffffff, pollen: 0xffd66b, hazardColor: 0x5bbcff
        }
    ];

    const shell = document.getElementById('gameShell');
    const canvasMount = document.getElementById('gameCanvas');
    const hud = document.getElementById('hud');
    const lobbyHud = document.getElementById('lobbyHud');
    const startScreen = document.getElementById('startScreen');
    const gameOverScreen = document.getElementById('gameOverScreen');
    const pauseScreen = document.getElementById('pauseScreen');
    const biomeToast = document.getElementById('biomeToast');
    const summonButton = document.getElementById('summonButton');
    const summonStatus = document.getElementById('summonStatus');
    const startButton = document.getElementById('startButton');
    const playButton = document.getElementById('playButton');
    const restartButton = document.getElementById('restartButton');
    const lobbyButton = document.getElementById('lobbyButton');
    const resumeButton = document.getElementById('resumeButton');
    const scoreValue = document.getElementById('scoreValue');
    const pollenValue = document.getElementById('pollenValue');
    const bankValue = document.getElementById('bankValue');
    const lobbyPollenValue = document.getElementById('lobbyPollenValue');
    const selectedValue = document.getElementById('selectedValue');
    const healthValue = document.getElementById('healthValue');
    const biomeValue = document.getElementById('biomeValue');
    const dashValue = document.getElementById('dashValue');
    const resultEyebrow = document.getElementById('resultEyebrow');
    const resultTitle = document.getElementById('resultTitle');
    const resultSummary = document.getElementById('resultSummary');
    const finalScore = document.getElementById('finalScore');
    const finalPollen = document.getElementById('finalPollen');
    const finalBank = document.getElementById('finalBank');

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
    app.stage.eventMode = 'static';
    app.stage.hitArea = app.screen;

    const backgroundLayer = new PIXI.Container();
    const farLayer = new PIXI.Container();
    const midLayer = new PIXI.Container();
    const bloomLayer = new PIXI.Container();
    const lobbyLayer = new PIXI.Container();
    const world = new PIXI.Container();
    const pollenLayer = new PIXI.Container();
    const warningLayer = new PIXI.Container();
    const hazardLayer = new PIXI.Container();
    const effectLayer = new PIXI.Container();
    const playerLayer = new PIXI.Container();
    const nearLayer = new PIXI.Container();
    const foregroundLayer = new PIXI.Container();

    app.stage.addChild(backgroundLayer, farLayer, midLayer, bloomLayer, lobbyLayer, world, nearLayer, foregroundLayer);
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
    const lobbyFlyers = [];

    let backgroundTexture = null;
    let particleTexture = null;
    let biomeToastTimer = 0;
    let lobbyBuiltFor = '';
    let caterpillar = null;
    let pupae = null;

    const camera = { x: 0, y: 0, targetX: 0, targetY: 0 };
    const mouse = { x: 0, y: 0, active: false, lastMove: 0 };
    const audio = { context: null, master: null, musicGain: null, oscA: null, oscB: null };

    const state = {
        mode: 'title', score: 0, runPollen: 0, health: START_HEALTH, time: 0, invulnerable: 0,
        pollenTimer: 0, hazardTimer: 0, particleTimer: 0, dashCooldown: 0, dashTime: 0, biomeIndex: 0,
        player: null, velocity: { x: 0, y: 0 }, facing: 0
    };

    let save = loadSave();

    function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
    function lerp(current, target, amount) { return current + (target - current) * amount; }
    function randomBetween(min, max) { return min + Math.random() * (max - min); }
    function pick(list) { return list[Math.floor(Math.random() * list.length)]; }
    function hasSpecies(key) { return !!SPECIES[key]; }
    function speciesName(key) { return SPECIES[key]?.name || 'Unknown'; }

    function angleLerp(current, target, amount) {
        let diff = target - current;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        return current + diff * amount;
    }

    function isColliding(a, b, radiusA, radiusB) {
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const range = radiusA + radiusB;
        return dx * dx + dy * dy <= range * range;
    }

    function loadSave() {
        const fallback = { pollen: 0, unlocked: ['monarch'], selected: 'monarch', summon: null };
        try {
            const parsed = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null') || fallback;
            const unlocked = Array.isArray(parsed.unlocked) ? parsed.unlocked.filter(hasSpecies) : ['monarch'];
            if (!unlocked.includes('monarch')) unlocked.unshift('monarch');
            const selected = unlocked.includes(parsed.selected) ? parsed.selected : 'monarch';
            return {
                pollen: Math.max(0, Math.floor(Number(parsed.pollen) || 0)),
                unlocked: [...new Set(unlocked)],
                selected,
                summon: parsed.summon && hasSpecies(parsed.summon.species) ? parsed.summon : null
            };
        } catch (error) {
            return fallback;
        }
    }

    function saveGame() {
        localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    }

    function maybeHatchSummon() {
        if (!save.summon || Date.now() < save.summon.hatchAt) return false;
        const species = save.summon.species;
        if (!save.unlocked.includes(species)) save.unlocked.push(species);
        save.summon = null;
        saveGame();
        setSummonStatus(`${speciesName(species)} hatched! Click it to select it.`, true);
        rebuildLobby();
        return true;
    }

    function getBiome() { return BIOMES[state.biomeIndex] || BIOMES[0]; }

    function getArena() {
        const worldWidth = app.screen.width / VIEW_ZOOM;
        const worldHeight = app.screen.height / VIEW_ZOOM;
        const marginX = Math.min(84 / VIEW_ZOOM, worldWidth * 0.115);
        const top = Math.min(104 / VIEW_ZOOM, worldHeight * 0.18);
        const bottomMargin = Math.min(58 / VIEW_ZOOM, worldHeight * 0.12);
        return {
            left: marginX, right: worldWidth - marginX, top, bottom: worldHeight - bottomMargin,
            width: worldWidth - marginX * 2, height: worldHeight - top - bottomMargin,
            centerX: worldWidth / 2, centerY: (top + worldHeight - bottomMargin) / 2
        };
    }

    function screenToWorld(screenX, screenY) {
        return { x: (screenX - world.x) / VIEW_ZOOM, y: (screenY - world.y) / VIEW_ZOOM };
    }

    function updateHud() {
        scoreValue.textContent = String(state.score);
        pollenValue.textContent = String(state.runPollen);
        bankValue.textContent = String(save.pollen);
        lobbyPollenValue.textContent = String(save.pollen);
        selectedValue.textContent = speciesName(save.selected);
        healthValue.textContent = String(state.health);
        biomeValue.textContent = getBiome().name;
        dashValue.textContent = state.dashCooldown <= 0 ? 'Ready' : `${Math.ceil(state.dashCooldown * 10) / 10}s`;
        dashValue.dataset.ready = state.dashCooldown <= 0 ? 'true' : 'false';
    }

    function showPanel(panel) {
        startScreen.hidden = panel !== 'start';
        gameOverScreen.hidden = panel !== 'gameOver';
        pauseScreen.hidden = panel !== 'pause';
    }

    function setHudMode(mode) {
        hud.hidden = mode !== 'game';
        lobbyHud.hidden = mode !== 'lobby';
        if (mode !== 'lobby') {
            summonButton.hidden = true;
            summonStatus.hidden = true;
        }
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
            master.gain.value = 0.48;
            musicGain.gain.value = 0.012;
            filter.type = 'lowpass';
            filter.frequency.value = 820;
            oscA.type = 'sine';
            oscB.type = 'triangle';
            oscA.frequency.value = 110;
            oscB.frequency.value = 165;
            oscA.connect(filter); oscB.connect(filter); filter.connect(musicGain); musicGain.connect(master); master.connect(context.destination);
            oscA.start(); oscB.start();
            audio.context = context; audio.master = master; audio.musicGain = musicGain; audio.oscA = oscA; audio.oscB = oscB;
        } catch (error) { audio.context = null; }
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
        osc.connect(env); env.connect(audio.master); osc.start(now); osc.stop(now + duration + 0.04);
    }

    function playCollectSound() { playTone(760, 0.08, 'triangle', 0.035, 250); }
    function playDashSound() { playTone(240, 0.12, 'sawtooth', 0.03, 500); }
    function playHitSound() { playTone(150, 0.18, 'sawtooth', 0.05, -70); }
    function playBiomeSound() { playTone(330, 0.2, 'sine', 0.03, 220); }
    function playSummonSound() { playTone(440, 0.18, 'triangle', 0.035, 300); }

    function createParticleTexture() {
        if (particleTexture) return;
        const g = new PIXI.Graphics();
        g.beginFill(0xffffff, 1); g.drawCircle(8, 8, 8); g.endFill();
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
        g.moveTo(0, -32 * scale); g.lineTo(0, 42 * scale);
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
        frame.lineStyle(2, accent, 0.28); frame.drawRoundedRect(x, y, width, height, 24);
        frame.lineStyle(1, 0xffd66b, 0.16); frame.drawRoundedRect(x + 5, y + 5, width - 10, height - 10, 18);
        foregroundLayer.addChild(vignette, frame);
    }

    function clearBackgroundLayers() {
        for (const layer of [backgroundLayer, farLayer, midLayer, bloomLayer, nearLayer]) {
            layer.removeChildren().forEach((child) => child.destroy({ children: true }));
        }
        backgroundObjects.length = 0;
        glows.length = 0;
        if (backgroundTexture) { backgroundTexture.destroy(true); backgroundTexture = null; }
    }

    function createMovingBackground(biome, withFrame) {
        clearBackgroundLayers();
        const w = app.screen.width;
        const h = app.screen.height;
        backgroundTexture = createGradientTexture(w, h, biome);
        const gradient = new PIXI.Sprite(backgroundTexture);
        gradient.width = w; gradient.height = h;
        backgroundLayer.addChild(gradient);

        for (const glow of biome.glows) {
            const g = new PIXI.Graphics();
            g.beginFill(glow[0], 0.14); g.drawCircle(0, 0, glow[3]); g.endFill();
            g.x = w * glow[1]; g.y = h * glow[2]; g.speed = randomBetween(2, 7); g.phase = randomBetween(0, Math.PI * 2);
            bloomLayer.addChild(g); glows.push(g);
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
                object.x = randomBetween(-160, w + 220); object.y = randomBetween(-80, h + 100);
                object.rotation = sky ? randomBetween(-0.1, 0.1) : randomBetween(-1.8, 1.8);
                object.speed = randomBetween(config.speed[0], config.speed[1]); object.drift = randomBetween(-9, 9); object.phase = randomBetween(0, Math.PI * 2);
                if (config.blur > 0) object.filters = [new PIXI.BlurFilter(config.blur, 1)];
                config.layer.addChild(object); backgroundObjects.push(object);
            }
        }

        const sporeCount = sky ? 72 : 130;
        for (let i = 0; i < sporeCount; i += 1) {
            const spore = new PIXI.Sprite(particleTexture);
            spore.anchor.set(0.5); spore.tint = sky ? 0xffffff : pick([biome.accent, biome.pollen, 0xff72cf, 0xb891ff]);
            spore.alpha = randomBetween(0.25, sky ? 0.55 : 0.85); spore.scale.set(randomBetween(0.12, sky ? 0.26 : 0.34));
            spore.x = randomBetween(0, w); spore.y = randomBetween(0, h); spore.speed = randomBetween(10, sky ? 30 : 52);
            spore.drift = randomBetween(-12, 12); spore.phase = randomBetween(0, Math.PI * 2); spore.blendMode = PIXI.BLEND_MODES.ADD;
            backgroundLayer.addChild(spore); backgroundObjects.push(spore);
        }

        if (withFrame) drawArenaFrame();
        else foregroundLayer.removeChildren().forEach((child) => child.destroy({ children: true }));
    }

    function createGameBackground() { createMovingBackground(getBiome(), true); }

    function createLobbyBackground() {
        shell.dataset.biome = 'lobby';
        createMovingBackground(BIOMES[0], false);
    }

    function applyBiome(index, announce = false) {
        state.biomeIndex = index % BIOMES.length;
        shell.dataset.biome = getBiome().key;
        createGameBackground();
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
        circle.beginFill(color, alpha); circle.drawCircle(0, 0, radius); circle.endFill();
        return circle;
    }

    function createCharacter(speciesKey, scale = 1, interactive = false) {
        const data = SPECIES[speciesKey] || SPECIES.monarch;
        const character = new PIXI.Container();
        character.species = speciesKey;
        character.radius = PLAYER_RADIUS * scale;

        const outerGlow = makeCircle(62 * scale, data.glow, 0.13);
        outerGlow.blendMode = PIXI.BLEND_MODES.ADD;
        const glow = makeCircle(40 * scale, data.glow, 0.18);
        glow.blendMode = PIXI.BLEND_MODES.ADD;
        character.addChild(outerGlow, glow);
        character.glow = glow;
        character.outerGlow = outerGlow;

        const wingSize = data.kind === 'moth' ? { top: [23, 24], bottom: [22, 19] } : { top: [19, 25], bottom: [16, 19] };

        function wing(side) {
            const g = new PIXI.Graphics();
            g.lineStyle(3 * scale, 0x150814, 0.98);
            g.beginFill(data.wingA, 1);
            g.drawEllipse(side * 20 * scale, -15 * scale, wingSize.top[0] * scale, wingSize.top[1] * scale);
            g.endFill();
            g.beginFill(data.wingB, 1);
            g.drawEllipse(side * 18 * scale, 15 * scale, wingSize.bottom[0] * scale, wingSize.bottom[1] * scale);
            g.endFill();
            g.beginFill(data.spot, 0.82);
            if (data.kind === 'moth') {
                g.drawCircle(side * 24 * scale, -4 * scale, 3.2 * scale);
                g.drawCircle(side * 24 * scale, 18 * scale, 2.8 * scale);
            } else {
                g.drawCircle(side * 28 * scale, -21 * scale, 3 * scale);
                g.drawCircle(side * 32 * scale, -9 * scale, 2.5 * scale);
                g.drawCircle(side * 25 * scale, 23 * scale, 2.5 * scale);
            }
            g.endFill();
            g.lineStyle(2 * scale, 0x20101f, 0.85);
            g.moveTo(side * 4 * scale, -2 * scale); g.lineTo(side * 31 * scale, -29 * scale);
            g.moveTo(side * 5 * scale, 2 * scale); g.lineTo(side * 33 * scale, 16 * scale);
            g.moveTo(side * 8 * scale, 7 * scale); g.lineTo(side * 25 * scale, 31 * scale);
            return g;
        }

        const leftWing = wing(-1);
        const rightWing = wing(1);

        const body = new PIXI.Container();
        const abdomen = new PIXI.Graphics();
        abdomen.beginFill(data.body, 1); abdomen.drawEllipse(0, 9 * scale, 5.5 * scale, 21 * scale); abdomen.endFill();
        abdomen.lineStyle(1.2 * scale, data.spot, 0.46);
        for (let y = -4; y <= 22; y += 7) {
            abdomen.moveTo(-4.5 * scale, y * scale);
            abdomen.quadraticCurveTo(0, (y + 3) * scale, 4.5 * scale, y * scale);
        }
        const thorax = new PIXI.Graphics();
        thorax.beginFill(data.thorax, 1); thorax.drawEllipse(0, -9 * scale, 7.5 * scale, 11 * scale); thorax.endFill();
        thorax.beginFill(data.kind === 'moth' ? 0xffe5a8 : 0x3a2638, 0.5); thorax.drawEllipse(0, -11 * scale, 3.8 * scale, 6 * scale); thorax.endFill();
        const head = new PIXI.Graphics();
        head.beginFill(data.body, 1); head.drawCircle(0, -24 * scale, 7 * scale); head.endFill();
        head.beginFill(data.spot, 0.78); head.drawCircle(-3 * scale, -25 * scale, 1.6 * scale); head.drawCircle(3 * scale, -25 * scale, 1.6 * scale); head.endFill();
        head.lineStyle(1.8 * scale, data.spot, 0.86);
        head.moveTo(-3 * scale, -29 * scale); head.quadraticCurveTo(-12 * scale, -36 * scale, -17 * scale, -32 * scale);
        head.moveTo(3 * scale, -29 * scale); head.quadraticCurveTo(12 * scale, -36 * scale, 17 * scale, -32 * scale);
        body.addChild(abdomen, thorax, head);
        character.addChild(leftWing, rightWing, body);
        character.leftWing = leftWing; character.rightWing = rightWing; character.body = body;

        if (interactive) {
            character.eventMode = 'static';
            character.cursor = 'pointer';
            character.on('pointertap', () => selectSpecies(speciesKey));
        }
        return character;
    }

    function selectSpecies(speciesKey) {
        if (!save.unlocked.includes(speciesKey)) return;
        save.selected = speciesKey;
        saveGame();
        updateHud();
        for (const flyer of lobbyFlyers) flyer.ring.visible = flyer.species === speciesKey;
        setSummonStatus(`${speciesName(speciesKey)} selected.`, true);
    }

    function createCaterpillar() {
        const c = new PIXI.Container();
        const bodyColors = [0x8bff7a, 0x74e56f, 0x5fd56a, 0x48bc5f, 0x36a452];
        for (let i = 0; i < 6; i += 1) {
            const segment = new PIXI.Graphics();
            segment.beginFill(bodyColors[i % bodyColors.length], 1);
            segment.drawCircle((i - 2.5) * 25, 0, 27 - Math.abs(i - 2.5) * 1.6);
            segment.endFill();
            segment.lineStyle(2, 0x12401f, 0.45);
            segment.drawCircle((i - 2.5) * 25, 0, 27 - Math.abs(i - 2.5) * 1.6);
            c.addChild(segment);
        }
        const face = new PIXI.Graphics();
        face.beginFill(0x102018, 1); face.drawCircle(-73, -8, 3); face.drawCircle(-61, -8, 3); face.endFill();
        face.lineStyle(2, 0x102018, 0.9); face.moveTo(-72, 7); face.quadraticCurveTo(-66, 12, -58, 7);
        c.addChild(face);
        const crown = new PIXI.Graphics();
        crown.beginFill(0xffd66b, 1);
        crown.moveTo(-22, -37); crown.lineTo(-12, -62); crown.lineTo(0, -40); crown.lineTo(12, -62); crown.lineTo(22, -37); crown.closePath();
        crown.endFill(); crown.lineStyle(2, 0x7a4b10, 0.75); crown.drawPolygon([-22, -37, -12, -62, 0, -40, 12, -62, 22, -37]);
        c.addChild(crown);
        c.eventMode = 'static'; c.cursor = 'pointer'; c.on('pointertap', showSummonControls);
        c.scale.set(1.28);
        return c;
    }

    function createPupae() {
        const p = new PIXI.Container();
        const glow = makeCircle(48, 0xffd66b, 0.18); glow.blendMode = PIXI.BLEND_MODES.ADD;
        const shellShape = new PIXI.Graphics();
        shellShape.beginFill(0x9fe58a, 1); shellShape.drawEllipse(0, 0, 28, 48); shellShape.endFill();
        shellShape.beginFill(0xffd66b, 0.32); shellShape.drawEllipse(6, -10, 10, 24); shellShape.endFill();
        shellShape.lineStyle(2, 0x285f20, 0.5); shellShape.moveTo(-15, -28); shellShape.quadraticCurveTo(2, -18, 16, -30);
        shellShape.moveTo(-18, 2); shellShape.quadraticCurveTo(0, 12, 18, 0);
        p.addChild(glow, shellShape);
        return p;
    }

    function setSummonStatus(text, persist = false) {
        summonStatus.textContent = text;
        summonStatus.hidden = false;
        if (!persist) window.setTimeout(() => { if (state.mode === 'lobby') summonStatus.hidden = true; }, 2600);
    }

    function showSummonControls() {
        if (state.mode !== 'lobby') return;
        summonButton.hidden = false;
        updateSummonStatus();
    }

    function updateSummonStatus() {
        if (state.mode !== 'lobby') return;
        maybeHatchSummon();
        if (save.summon) {
            const remaining = Math.max(0, save.summon.hatchAt - Date.now());
            const seconds = Math.ceil(remaining / 1000);
            setSummonStatus(`Pupae hatches in ${seconds}s.`, true);
        } else if (SUMMON_POOL.every((key) => save.unlocked.includes(key))) {
            setSummonStatus('All current summon species have hatched.', true);
        } else {
            setSummonStatus(`Summon costs ${SUMMON_COST} pollen.`, true);
        }
    }

    function startSummon() {
        maybeHatchSummon();
        if (save.summon) { updateSummonStatus(); return; }
        const candidates = SUMMON_POOL.filter((key) => !save.unlocked.includes(key));
        if (candidates.length === 0) { setSummonStatus('All current summon species have hatched.', true); return; }
        if (save.pollen < SUMMON_COST) {
            setSummonStatus(`Need ${SUMMON_COST - save.pollen} more pollen.`, false);
            return;
        }
        const species = pick(candidates);
        save.pollen -= SUMMON_COST;
        save.summon = { species, hatchAt: Date.now() + SUMMON_TIME };
        saveGame();
        playSummonSound();
        updateHud();
        rebuildLobby();
        summonButton.hidden = false;
        updateSummonStatus();
    }

    function rebuildLobby() {
        lobbyBuiltFor = '';
        createLobbyObjects();
    }

    function createLobbyObjects() {
        const key = `${save.unlocked.join(',')}|${save.selected}|${save.summon ? save.summon.species + save.summon.hatchAt : 'none'}|${app.screen.width}x${app.screen.height}`;
        if (key === lobbyBuiltFor) return;
        lobbyBuiltFor = key;
        lobbyLayer.removeChildren().forEach((child) => child.destroy({ children: true }));
        lobbyFlyers.length = 0;
        caterpillar = createCaterpillar();
        caterpillar.x = app.screen.width / 2;
        caterpillar.y = app.screen.height - 86;
        lobbyLayer.addChild(caterpillar);

        if (save.summon) {
            pupae = createPupae();
            pupae.x = app.screen.width / 2 + 170;
            pupae.y = app.screen.height - 104;
            lobbyLayer.addChild(pupae);
        } else {
            pupae = null;
        }

        save.unlocked.forEach((speciesKey, index) => {
            const flyer = createCharacter(speciesKey, 0.72, true);
            flyer.x = randomBetween(120, Math.max(180, app.screen.width - 120));
            flyer.y = randomBetween(110, Math.max(180, app.screen.height - 210));
            flyer.vx = randomBetween(-42, 42) || 28;
            flyer.vy = randomBetween(-28, 28) || -18;
            flyer.phase = randomBetween(0, Math.PI * 2);
            flyer.species = speciesKey;
            const ring = new PIXI.Graphics();
            ring.lineStyle(3, 0xffd66b, 0.82); ring.drawCircle(0, 0, 48);
            ring.visible = speciesKey === save.selected;
            flyer.addChildAt(ring, 0);
            flyer.ring = ring;
            flyer.x += index * 24;
            lobbyLayer.addChild(flyer);
            lobbyFlyers.push(flyer);
        });
    }

    function enterLobby() {
        state.mode = 'lobby';
        world.visible = false;
        lobbyLayer.visible = true;
        setHudMode('lobby');
        showPanel(null);
        maybeHatchSummon();
        createLobbyBackground();
        createLobbyObjects();
        updateHud();
        setMusic(false);
    }

    function updateLobby(dt) {
        if (save.summon) {
            if (maybeHatchSummon()) updateHud();
            else if (!summonStatus.hidden) updateSummonStatus();
        }
        const w = app.screen.width;
        const h = app.screen.height;
        for (const flyer of lobbyFlyers) {
            flyer.phase += dt;
            flyer.x += flyer.vx * dt;
            flyer.y += flyer.vy * dt;
            if (flyer.x < 70 || flyer.x > w - 70) flyer.vx *= -1;
            if (flyer.y < 80 || flyer.y > h - 205) flyer.vy *= -1;
            const speed = Math.hypot(flyer.vx, flyer.vy);
            const target = speed > 1 ? Math.atan2(flyer.vy, flyer.vx) + Math.PI / 2 : flyer.rotation;
            flyer.rotation = angleLerp(flyer.rotation, target, 0.08);
            const flutter = Math.sin(flyer.phase * 14) * 0.22;
            flyer.leftWing.scale.x = 1 + flutter;
            flyer.rightWing.scale.x = 1 - flutter * 0.4;
            flyer.y += Math.sin(flyer.phase * 1.5) * 7 * dt;
        }
        if (caterpillar) caterpillar.rotation = Math.sin(performance.now() / 700) * 0.018;
        if (pupae) pupae.rotation = Math.sin(performance.now() / 560) * 0.035;
    }

    function createPollen(x, y) {
        const pollen = new PIXI.Container();
        pollen.radius = POLLEN_RADIUS;
        pollen.speed = randomBetween(134, 178);
        const aura = makeCircle(28, getBiome().pollen, 0.2); aura.blendMode = PIXI.BLEND_MODES.ADD;
        const petals = new PIXI.Graphics();
        petals.beginFill(getBiome().pollen, 0.9);
        for (let i = 0; i < 6; i += 1) {
            const angle = (Math.PI * 2 * i) / 6;
            petals.drawEllipse(Math.cos(angle) * 8, Math.sin(angle) * 8, 3.5, 2.1);
        }
        petals.endFill();
        const core = new PIXI.Graphics();
        core.beginFill(0xfff4b4, 1); core.drawCircle(0, 0, 8.5); core.endFill();
        core.beginFill(0xff8f5c, 0.92); core.drawCircle(3, -3, 3); core.endFill();
        pollen.addChild(aura, petals, core);
        pollen.petals = petals;
        pollen.x = x; pollen.y = y; pollen.phase = randomBetween(0, Math.PI * 2); pollen.blendMode = PIXI.BLEND_MODES.ADD;
        pollenLayer.addChild(pollen); pollenItems.push(pollen);
    }

    function createThornHazard() {
        const arena = getArena();
        const hazard = new PIXI.Container();
        const glow = makeCircle(38, 0xff4fbd, 0.17); glow.blendMode = PIXI.BLEND_MODES.ADD;
        const thorn = new PIXI.Graphics();
        thorn.lineStyle(2, 0xff9ad8, 0.78);
        thorn.beginFill(0x190724, 1);
        thorn.moveTo(0, -33); thorn.lineTo(24, -3); thorn.lineTo(9, 30); thorn.lineTo(-18, 23); thorn.lineTo(-26, -9); thorn.closePath();
        thorn.endFill();
        hazard.addChild(glow, thorn);
        hazard.x = arena.right + 70; hazard.y = randomBetween(arena.top + 28, arena.bottom - 28);
        hazardLayer.addChild(hazard);
        hazards.push({ type: 'thorn', container: hazard, x: hazard.x, y: hazard.y, radius: HAZARD_RADIUS, speed: randomBetween(175, 235), rotationSpeed: randomBetween(-1.8, 1.8) });
    }

    function createWaspSprite() {
        const wasp = new PIXI.Container();
        const glow = makeCircle(28, 0xff2d3d, 0.18); glow.blendMode = PIXI.BLEND_MODES.ADD;
        const leftWing = new PIXI.Graphics(); leftWing.beginFill(0xcffaff, 0.42); leftWing.drawEllipse(-9, -12, 8, 16); leftWing.endFill();
        const rightWing = new PIXI.Graphics(); rightWing.beginFill(0xcffaff, 0.42); rightWing.drawEllipse(9, -12, 8, 16); rightWing.endFill();
        const body = new PIXI.Graphics();
        body.beginFill(0x241315, 1); body.drawEllipse(0, 1, 8, 23); body.endFill();
        body.beginFill(0xffcf3a, 1); body.drawRoundedRect(-7, -12, 14, 5, 2); body.drawRoundedRect(-7, 1, 14, 5, 2); body.drawRoundedRect(-6, 13, 12, 4, 2); body.endFill();
        body.beginFill(0xfff1a2, 0.9); body.drawCircle(0, -23, 7); body.endFill();
        body.beginFill(0x14090c, 1); body.drawCircle(-2.8, -24, 1.5); body.drawCircle(2.8, -24, 1.5); body.endFill();
        body.lineStyle(1.7, 0x14090c, 0.9); body.moveTo(-2, -28); body.lineTo(-11, -36); body.moveTo(2, -28); body.lineTo(11, -36); body.moveTo(0, 22); body.lineTo(0, 32);
        wasp.addChild(glow, leftWing, rightWing, body); wasp.leftWing = leftWing; wasp.rightWing = rightWing;
        return wasp;
    }

    function createWaspHazard() {
        const arena = getArena();
        const y = randomBetween(arena.top + 34, arena.bottom - 34);
        const slope = randomBetween(-0.1, 0.1);
        const startX = arena.right + 120, endX = arena.left - 140, startY = y;
        const endY = clamp(y + (endX - startX) * slope, arena.top + 26, arena.bottom - 26);
        const container = new PIXI.Container();
        const warning = new PIXI.Graphics();
        warning.lineStyle(16, 0xff3148, 0.16); warning.moveTo(startX, startY); warning.lineTo(endX, endY);
        warning.lineStyle(2, 0xff8a96, 0.62); warning.moveTo(startX, startY); warning.lineTo(endX, endY);
        warning.blendMode = PIXI.BLEND_MODES.ADD;
        const wasp = createWaspSprite();
        wasp.visible = false; wasp.x = startX; wasp.y = startY; wasp.rotation = Math.atan2(endY - startY, endX - startX) - Math.PI / 2;
        container.addChild(warning, wasp); warningLayer.addChild(container);
        hazards.push({ type: 'wasp', container, warning, wasp, startX, startY, endX, endY, timer: 0, warningTime: 1.75, attackTime: 0.68, phase: 'warning', x: startX, y: startY, radius: HAZARD_RADIUS });
    }

    function createRainHazard() {
        const arena = getArena();
        const drop = new PIXI.Container();
        const trail = new PIXI.Graphics(); trail.lineStyle(5, 0xb9f2ff, 0.3); trail.moveTo(0, -22); trail.lineTo(0, 18);
        const core = new PIXI.Graphics(); core.beginFill(0xd8fbff, 0.95); core.drawEllipse(0, 8, 5, 15); core.endFill();
        drop.addChild(trail, core); drop.x = randomBetween(arena.left + 28, arena.right - 28); drop.y = arena.top - 65;
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
        particle.anchor.set(0.5); particle.tint = color; particle.alpha = alpha; particle.scale.set(size / 8);
        particle.x = x; particle.y = y; particle.vx = speedX; particle.vy = speedY; particle.life = life; particle.maxLife = life; particle.baseScale = size / 8;
        particle.blendMode = PIXI.BLEND_MODES.ADD; effectLayer.addChild(particle); particles.push(particle);
    }

    function createRing(x, y, color, life, maxRadius) {
        if (rings.length >= MAX_RINGS) rings.shift().destroy();
        const ring = new PIXI.Graphics();
        ring.x = x; ring.y = y; ring.color = color; ring.life = life; ring.maxLife = life; ring.maxRadius = maxRadius; ring.blendMode = PIXI.BLEND_MODES.ADD;
        effectLayer.addChild(ring); rings.push(ring);
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
        pollenLayer.removeChildren(); warningLayer.removeChildren(); hazardLayer.removeChildren(); effectLayer.removeChildren(); playerLayer.removeChildren();
    }

    function resetRun() {
        clearRunObjects();
        state.time = 0; state.biomeIndex = 0; state.velocity.x = 0; state.velocity.y = 0; state.score = 0; state.runPollen = 0; state.health = START_HEALTH; state.invulnerable = 0;
        state.pollenTimer = 0.35; state.hazardTimer = 1.2; state.particleTimer = 0; state.dashCooldown = 0; state.dashTime = 0; state.facing = 0;
        applyBiome(0, false);
        state.player = createCharacter(save.selected, 1, false);
        const arena = getArena(); state.player.x = arena.left + arena.width * 0.26; state.player.y = arena.centerY;
        playerLayer.addChild(state.player);
        camera.x = 0; camera.y = 0; camera.targetX = 0; camera.targetY = 0; mouse.active = false;
        updateHud(); updateCamera(1, true);
    }

    function startRun() {
        initAudio();
        if (audio.context && audio.context.state === 'suspended') audio.context.resume();
        lobbyLayer.visible = false; world.visible = true; setHudMode('game'); showPanel(null); summonButton.hidden = true; summonStatus.hidden = true;
        resetRun(); state.mode = 'playing'; setMusic(true); app.view.focus?.();
    }

    function pauseRun() { if (state.mode !== 'playing') return; state.mode = 'paused'; showPanel('pause'); setMusic(false); }
    function resumeRun() { if (state.mode !== 'paused') return; state.mode = 'playing'; showPanel(null); setMusic(true); }

    function finishRun() {
        state.mode = 'gameOver';
        resultEyebrow.textContent = 'Run Ended'; resultTitle.textContent = 'Game Over';
        resultSummary.textContent = 'The butterfly lost its last health. Your collected pollen has been saved.';
        finalScore.textContent = String(state.score); finalPollen.textContent = String(state.runPollen); finalBank.textContent = String(save.pollen);
        setMusic(false); showPanel('gameOver');
    }

    function spawnPollenCluster() {
        const arena = getArena();
        const baseY = randomBetween(arena.top + 24, arena.bottom - 24);
        const cluster = Math.random() > 0.55 ? 4 : 3;
        for (let i = 0; i < cluster; i += 1) createPollen(arena.right + 34 + 34 * i, baseY + Math.sin(i * 1.2) * 27);
    }

    function tryDash() {
        if (state.mode !== 'playing' || state.dashCooldown > 0 || !state.player) return;
        let dx = state.velocity.x, dy = state.velocity.y;
        if (Math.hypot(dx, dy) < 30 && mouse.active) { dx = mouse.x - state.player.x; dy = mouse.y - state.player.y; }
        if (Math.hypot(dx, dy) < 30) { dx = Math.sin(state.facing); dy = -Math.cos(state.facing); }
        const len = Math.hypot(dx, dy) || 1;
        state.velocity.x = (dx / len) * DASH_SPEED; state.velocity.y = (dy / len) * DASH_SPEED; state.dashCooldown = DASH_COOLDOWN; state.dashTime = DASH_DURATION;
        playDashSound(); createRing(state.player.x, state.player.y, getBiome().accent, 0.36, 72); burst(state.player.x, state.player.y, getBiome().accent, 18); updateHud();
    }

    function updateBiome(dt) {
        const targetBiome = Math.floor(state.time / BIOME_LENGTH) % BIOMES.length;
        if (targetBiome !== state.biomeIndex) { clearRunObjects(); applyBiome(targetBiome, true); state.hazardTimer = 1.0; state.player = createCharacter(save.selected, 1, false); const arena = getArena(); state.player.x = arena.left + arena.width * 0.26; state.player.y = arena.centerY; playerLayer.addChild(state.player); }
        if (biomeToast && !biomeToast.hidden) { biomeToastTimer -= dt; if (biomeToastTimer <= 0) biomeToast.hidden = true; }
    }

    function updateCamera(dt, immediate = false) {
        if (state.player) {
            const arena = getArena(); const kick = state.dashTime > 0 ? 1.5 : 1;
            camera.targetX = clamp((arena.centerX - state.player.x) * 0.14 * kick, -28, 28);
            camera.targetY = clamp((arena.centerY - state.player.y) * 0.11 * kick, -18, 18);
        }
        const ease = immediate ? 1 : 1 - Math.pow(0.00065, dt);
        camera.x = lerp(camera.x, camera.targetX, ease); camera.y = lerp(camera.y, camera.targetY, ease);
        world.scale.set(VIEW_ZOOM); world.x = camera.x * VIEW_ZOOM; world.y = camera.y * VIEW_ZOOM;
    }

    function updatePlayer(dt) {
        const player = state.player; if (!player) return;
        state.dashCooldown = Math.max(0, state.dashCooldown - dt); state.dashTime = Math.max(0, state.dashTime - dt);
        let ax = 0, ay = 0;
        const left = keys.has('arrowleft') || keys.has('a'), right = keys.has('arrowright') || keys.has('d'), up = keys.has('arrowup') || keys.has('w'), down = keys.has('arrowdown') || keys.has('s');
        const hasKeyboard = left || right || up || down;
        if (left) ax -= 1; if (right) ax += 1; if (up) ay -= 1; if (down) ay += 1;
        if (mouse.active && performance.now() - mouse.lastMove < 2400) {
            const arena = getArena(); const targetX = clamp(mouse.x, arena.left, arena.right), targetY = clamp(mouse.y, arena.top, arena.bottom);
            const dx = targetX - player.x, dy = targetY - player.y, length = Math.hypot(dx, dy) || 1;
            const pull = clamp(length / 170, 0, 1) * (hasKeyboard ? 0.35 : 1.25);
            ax += (dx / length) * pull; ay += (dy / length) * pull;
        }
        const inputLength = Math.hypot(ax, ay); if (inputLength > 1) { ax /= inputLength; ay /= inputLength; }
        const acceleration = state.dashTime > 0 ? 1900 : 1780, yBoost = 1.32, drag = state.dashTime > 0 ? 0.97 : 0.91, maxSpeed = state.dashTime > 0 ? 1120 : 780;
        state.velocity.x += ax * acceleration * dt; state.velocity.y += ay * acceleration * yBoost * dt;
        state.velocity.x *= Math.pow(drag, dt * 60); state.velocity.y *= Math.pow(drag, dt * 60);
        const speed = Math.hypot(state.velocity.x, state.velocity.y); if (speed > maxSpeed) { state.velocity.x = (state.velocity.x / speed) * maxSpeed; state.velocity.y = (state.velocity.y / speed) * maxSpeed; }
        const arena = getArena(); player.x = clamp(player.x + state.velocity.x * dt, arena.left + 30, arena.right - 30); player.y = clamp(player.y + state.velocity.y * dt, arena.top + 30, arena.bottom - 30);
        const currentSpeed = Math.hypot(state.velocity.x, state.velocity.y);
        if (currentSpeed > 35) state.facing = angleLerp(state.facing, Math.atan2(state.velocity.y, state.velocity.x) + Math.PI / 2, 1 - Math.pow(0.0002, dt));
        const flutter = Math.sin(state.time * (state.dashTime > 0 ? 34 : 24)) * (0.2 + currentSpeed / 3100);
        player.leftWing.scale.x = 1 + flutter; player.rightWing.scale.x = 1 + flutter; player.leftWing.rotation = -0.04 + flutter * 0.1; player.rightWing.rotation = 0.04 - flutter * 0.1;
        player.body.rotation = clamp(state.velocity.x / 1800, -0.08, 0.08); player.scale.set(1 + Math.sin(state.time * 4.8) * 0.018 + (state.dashTime > 0 ? 0.08 : 0)); player.rotation = state.facing;
        player.glow.alpha = state.invulnerable > 0 ? 0.34 + Math.sin(state.time * 36) * 0.16 : 0.19 + currentSpeed / 5000; player.outerGlow.alpha = 0.78 + Math.sin(state.time * 6) * 0.14;
        state.particleTimer -= dt;
        if (state.particleTimer <= 0) {
            state.particleTimer = state.dashTime > 0 ? 0.018 : 0.036;
            createParticle(player.x + randomBetween(-7, 7), player.y + randomBetween(-16, 18), state.dashTime > 0 ? getBiome().accent : (Math.random() > 0.5 ? 0xffb24a : getBiome().accent), randomBetween(2, 5), -state.velocity.x * 0.18 + randomBetween(-60, 60), -state.velocity.y * 0.18 + randomBetween(-60, 60), randomBetween(0.34, 0.68), 0.68);
        }
        updateHud();
    }

    function updatePollen(dt) {
        const arena = getArena(); state.pollenTimer -= dt;
        if (state.pollenTimer <= 0) { state.pollenTimer = randomBetween(0.68, 1.05); spawnPollenCluster(); }
        for (let i = pollenItems.length - 1; i >= 0; i -= 1) {
            const pollen = pollenItems[i]; pollen.phase += dt * 5; pollen.x -= pollen.speed * dt; pollen.y += Math.sin(pollen.phase) * 21 * dt; pollen.scale.set(1 + Math.sin(pollen.phase * 1.7) * 0.1); pollen.rotation += dt * 1.9; pollen.petals.rotation -= dt * 2.8;
            if (state.player && isColliding(state.player, pollen, PLAYER_RADIUS, POLLEN_RADIUS)) {
                state.score += 10; state.runPollen += 1; save.pollen += 1; saveGame(); updateHud(); playCollectSound(); burst(pollen.x, pollen.y, getBiome().pollen, 12); createRing(pollen.x, pollen.y, getBiome().pollen, 0.42, 48);
                pollen.destroy({ children: true }); pollenItems.splice(i, 1); continue;
            }
            if (pollen.x < arena.left - 110) { pollen.destroy({ children: true }); pollenItems.splice(i, 1); }
        }
    }

    function updateHazards(dt) {
        const biome = getBiome(), arena = getArena(); state.hazardTimer -= dt;
        if (state.hazardTimer <= 0) { state.hazardTimer = biome.hazard === 'rain' ? randomBetween(0.52, 0.82) : biome.hazard === 'wasp' ? randomBetween(1.55, 2.15) : randomBetween(1.05, 1.55); spawnHazard(); }
        state.invulnerable = Math.max(0, state.invulnerable - dt);
        for (let i = hazards.length - 1; i >= 0; i -= 1) {
            const hazard = hazards[i];
            if (hazard.type === 'thorn') { hazard.x -= hazard.speed * dt; hazard.container.x = hazard.x; hazard.container.rotation += hazard.rotationSpeed * dt; hazard.container.alpha = hazard.x > arena.right - 60 ? 0.65 : 1; }
            else if (hazard.type === 'wasp') {
                hazard.timer += dt;
                if (hazard.phase === 'warning') { hazard.warning.alpha = 0.9; if (hazard.timer >= hazard.warningTime) { hazard.phase = 'attack'; hazard.timer = 0; hazard.wasp.visible = true; hazard.warning.alpha = 0.22; warningLayer.removeChild(hazard.container); hazardLayer.addChild(hazard.container); } }
                else { const t = clamp(hazard.timer / hazard.attackTime, 0, 1), ease = t * t * (3 - 2 * t); hazard.x = lerp(hazard.startX, hazard.endX, ease); hazard.y = lerp(hazard.startY, hazard.endY, ease); hazard.wasp.x = hazard.x; hazard.wasp.y = hazard.y; hazard.wasp.leftWing.scale.x = 1 + Math.sin(state.time * 54) * 0.35; hazard.wasp.rightWing.scale.x = 1 + Math.sin(state.time * 54 + Math.PI) * 0.35; if (t >= 1) hazard.done = true; }
            } else if (hazard.type === 'rain') { hazard.x += hazard.drift * dt; hazard.y += hazard.speed * dt; hazard.container.x = hazard.x; hazard.container.y = hazard.y; hazard.container.rotation = hazard.drift * 0.002; if (hazard.y > arena.bottom + 90) hazard.done = true; }
            if (!hazard.done && state.player && state.invulnerable <= 0 && isColliding(state.player, hazard, PLAYER_RADIUS, hazard.radius)) {
                if (hazard.type !== 'wasp' || hazard.phase === 'attack') {
                    state.health -= 1; state.invulnerable = 1.05; updateHud(); playHitSound(); burst(hazard.x, hazard.y, biome.hazardColor, 20); createRing(hazard.x, hazard.y, biome.hazardColor, 0.5, 68); hazard.done = true; if (state.health <= 0) finishRun();
                }
            }
            if (hazard.type === 'thorn' && hazard.x < arena.left - 120) hazard.done = true;
            if (hazard.done) { hazard.container.destroy({ children: true }); hazards.splice(i, 1); }
        }
    }

    function updateParticles(dt) {
        for (let i = particles.length - 1; i >= 0; i -= 1) {
            const particle = particles[i]; particle.life -= dt; particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.vx *= Math.pow(0.93, dt * 60); particle.vy *= Math.pow(0.93, dt * 60);
            const progress = Math.max(0, particle.life / particle.maxLife); particle.alpha = progress; particle.scale.set(particle.baseScale * (0.45 + progress * 0.85));
            if (particle.life <= 0) { particle.destroy(); particles.splice(i, 1); }
        }
        for (let i = rings.length - 1; i >= 0; i -= 1) {
            const ring = rings[i]; ring.life -= dt; const progress = 1 - Math.max(0, ring.life / ring.maxLife); ring.clear(); ring.lineStyle(2.5, ring.color, Math.max(0, 1 - progress)); ring.drawCircle(0, 0, ring.maxRadius * progress);
            if (ring.life <= 0) { ring.destroy(); rings.splice(i, 1); }
        }
    }

    function updateBackground(dt) {
        const w = app.screen.width, h = app.screen.height;
        for (const object of backgroundObjects) {
            object.phase += dt; object.x -= object.speed * dt; object.y += Math.sin(object.phase) * object.drift * dt;
            if (object.rotation !== undefined && getBiome().key !== 'sky') object.rotation += Math.sin(object.phase * 0.7) * 0.0015;
            if (object.x < -230) { object.x = w + randomBetween(50, 220); object.y = randomBetween(-90, h + 110); }
            if (object.tint !== undefined) object.alpha = clamp(object.alpha + Math.sin(object.phase) * 0.002, 0.18, 0.9);
        }
        for (const glow of glows) { glow.phase += dt; glow.x -= glow.speed * dt; glow.scale.set(1 + Math.sin(glow.phase) * 0.05); if (glow.x < -200) glow.x = w + 200; }
    }

    function tick() {
        const dt = Math.min(app.ticker.elapsedMS / 1000, 0.033);
        updateBackground(dt); updateCamera(dt);
        if (state.mode === 'lobby') updateLobby(dt);
        if (state.mode !== 'playing') return;
        state.time += dt; updateBiome(dt); updatePlayer(dt); updatePollen(dt); updateHazards(dt); updateParticles(dt);
    }

    startButton.addEventListener('click', enterLobby);
    playButton.addEventListener('click', startRun);
    restartButton.addEventListener('click', startRun);
    lobbyButton.addEventListener('click', enterLobby);
    resumeButton.addEventListener('click', resumeRun);
    summonButton.addEventListener('click', startSummon);

    window.addEventListener('keydown', (event) => {
        const key = event.key.toLowerCase();
        if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' ', 'spacebar'].includes(key)) event.preventDefault();
        if (key === 'escape') { if (state.mode === 'playing') pauseRun(); else if (state.mode === 'paused') resumeRun(); return; }
        if ((key === 'enter' || key === ' ') && state.mode === 'title') { enterLobby(); return; }
        if ((key === ' ' || key === 'spacebar') && !event.repeat) { tryDash(); return; }
        keys.add(key);
    });
    window.addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()));

    app.view.addEventListener('pointermove', (event) => {
        const rect = app.view.getBoundingClientRect();
        const screenX = ((event.clientX - rect.left) / rect.width) * app.screen.width;
        const screenY = ((event.clientY - rect.top) / rect.height) * app.screen.height;
        const point = screenToWorld(screenX, screenY);
        mouse.x = point.x; mouse.y = point.y; mouse.active = true; mouse.lastMove = performance.now();
    });
    app.view.addEventListener('pointerleave', () => { mouse.active = false; });

    window.addEventListener('resize', () => {
        if (state.mode === 'lobby') { createLobbyBackground(); rebuildLobby(); }
        else { createGameBackground(); }
        if (state.player) { const arena = getArena(); state.player.x = clamp(state.player.x, arena.left + 30, arena.right - 30); state.player.y = clamp(state.player.y, arena.top + 30, arena.bottom - 30); }
        updateCamera(1, true);
    });

    window.nocturneWingsDebug = {
        get fps() { return app.ticker.FPS; },
        counts() { return { mode: state.mode, pollen: pollenItems.length, hazards: hazards.length, particles: particles.length, rings: rings.length, backgroundObjects: backgroundObjects.length, lobbyFlyers: lobbyFlyers.length, biome: getBiome().name, hazard: getBiome().hazard, selected: save.selected, bank: save.pollen, unlocked: save.unlocked.slice(), summon: save.summon }; },
        state,
        save: () => save,
        setPollen(value) { save.pollen = Math.max(0, Math.floor(value)); saveGame(); updateHud(); },
        forceHatch() { if (save.summon) { save.summon.hatchAt = Date.now() - 1; saveGame(); maybeHatchSummon(); updateHud(); } },
        forceBiome(index = 1) { applyBiome(index, true); }
    };

    createParticleTexture();
    createLobbyBackground();
    world.visible = false;
    lobbyLayer.visible = false;
    setHudMode('none');
    showPanel('start');
    updateHud();
    app.ticker.add(tick);
})();
