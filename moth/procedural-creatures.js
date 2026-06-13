(() => {
    'use strict';

    const MANIFEST_URL = 'assets/insects/manifest.json';
    const TAU = Math.PI * 2;
    const state = {
        manifest: null,
        basePath: 'assets/insects/',
        errors: [],
        textureCache: new Map(),
        appliedGenome: null,
        appliedCreature: null,
        appliedLayer: null,
        appliedTarget: null,
        lastNow: performance.now(),
        lastPlayerVelocity: { x: 0, y: 0 }
    };

    const PALETTES = {
        butterfly: [
            { primary: 0xff7a24, secondary: 0xffc447, dark: 0x241321, highlight: 0xfff0b8, glow: 0xff984d },
            { primary: 0x92f5ff, secondary: 0xeefcff, dark: 0x24324a, highlight: 0xffffff, glow: 0x9af6ff },
            { primary: 0x3478ff, secondary: 0x75f2ff, dark: 0x121d49, highlight: 0xe4fbff, glow: 0x5dbdff },
            { primary: 0xff577c, secondary: 0xffb36b, dark: 0x2a1224, highlight: 0xfff0da, glow: 0xff6f96 }
        ],
        moth: [
            { primary: 0xff91c8, secondary: 0xffe57a, dark: 0x6e2f57, highlight: 0xfff5c8, glow: 0xff9ac9 },
            { primary: 0xc9c2ff, secondary: 0x9ce8ff, dark: 0x24213d, highlight: 0xffffff, glow: 0xbba7ff },
            { primary: 0xb86b31, secondary: 0xffb25d, dark: 0x3b1912, highlight: 0xfff0bc, glow: 0xffd48a },
            { primary: 0x8f96a6, secondary: 0xdce7f3, dark: 0x282936, highlight: 0xf8fbff, glow: 0xcfe9ff }
        ]
    };

    function app() { return window.nocturnePixiApp; }
    function debug() { return window.nocturneWingsDebug; }
    function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
    function lerp(a, b, t) { return a + (b - a) * t; }
    function angleLerp(a, b, t) {
        let d = b - a;
        while (d > Math.PI) d -= TAU;
        while (d < -Math.PI) d += TAU;
        return a + d * t;
    }
    function hashSeed(input) {
        const text = String(input ?? Date.now());
        let h = 2166136261;
        for (let i = 0; i < text.length; i += 1) {
            h ^= text.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        return h >>> 0;
    }
    function rng(seedInput) {
        let a = hashSeed(seedInput) || 1;
        return () => {
            a |= 0;
            a = (a + 0x6D2B79F5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }
    function indexById(list) {
        const map = new Map();
        for (const item of list || []) map.set(item.id, item);
        return map;
    }
    function weighted(list, random) {
        const total = list.reduce((sum, item) => sum + (Number(item.weight) || 1), 0) || 1;
        let roll = random() * total;
        for (const item of list) {
            roll -= Number(item.weight) || 1;
            if (roll <= 0) return item;
        }
        return list[list.length - 1];
    }
    function compatibleKind(item, kind) { return item && (item.kind === kind || item.kind === 'any'); }

    function validateManifest(manifest) {
        const errors = [];
        if (!manifest || !manifest.assets) errors.push('Manifest has no assets object.');
        const groups = ['upperWings', 'lowerWings', 'bodies', 'antennae', 'patterns'];
        for (const group of groups) {
            if (!Array.isArray(manifest?.assets?.[group]) || manifest.assets[group].length === 0) errors.push(`${group} is empty.`);
            for (const item of manifest?.assets?.[group] || []) {
                if (!item.id) errors.push(`${group} item is missing id.`);
                if (!item.file) errors.push(`${item.id || group} is missing file.`);
                if (!item.part) errors.push(`${item.id || group} is missing part.`);
                if (!item.anchor || !Number.isFinite(item.anchor.x) || !Number.isFinite(item.anchor.y)) errors.push(`${item.id || group} has invalid anchor.`);
            }
        }
        const lowerIds = new Set((manifest?.assets?.lowerWings || []).map((item) => item.id));
        for (const upper of manifest?.assets?.upperWings || []) {
            const compatible = Array.isArray(upper.compatibleWith) ? upper.compatibleWith : [];
            if (!compatible.some((id) => lowerIds.has(id))) errors.push(`${upper.id} has no valid lower-wing compatibility.`);
        }
        return errors;
    }

    async function loadManifest() {
        if (state.manifest) return state.manifest;
        try {
            const response = await fetch(MANIFEST_URL, { cache: 'force-cache' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const manifest = await response.json();
            state.errors = validateManifest(manifest);
            state.manifest = manifest;
            state.basePath = manifest.basePath || state.basePath;
        } catch (error) {
            state.errors = [`Could not load insect manifest: ${error.message}`];
            state.manifest = null;
        }
        return state.manifest;
    }

    function lists() {
        const assets = state.manifest?.assets || {};
        return {
            upper: assets.upperWings || [],
            lower: assets.lowerWings || [],
            bodies: assets.bodies || [],
            antennae: assets.antennae || [],
            patterns: assets.patterns || []
        };
    }

    function createGenome(seedInput = Date.now()) {
        const seed = hashSeed(seedInput);
        const random = rng(seed);
        const available = lists();
        const kind = random() > 0.48 ? 'butterfly' : 'moth';
        const upper = weighted(available.upper.filter((item) => compatibleKind(item, kind)), random) || available.upper[0];
        const lowerChoices = available.lower.filter((item) => compatibleKind(item, kind) && (!upper?.compatibleWith || upper.compatibleWith.includes(item.id)));
        const lower = weighted(lowerChoices.length ? lowerChoices : available.lower.filter((item) => compatibleKind(item, kind)), random) || available.lower[0];
        const body = weighted(available.bodies.filter((item) => compatibleKind(item, kind)), random) || available.bodies[0];
        const antennae = weighted(available.antennae.filter((item) => compatibleKind(item, kind)), random) || available.antennae[0];
        const patternChoices = available.patterns.filter((item) => compatibleKind(item, kind));
        const patternCount = 1 + Math.floor(random() * 3);
        const patterns = [];
        for (let i = 0; i < patternCount && patternChoices.length; i += 1) {
            const pick = weighted(patternChoices, random);
            if (pick && !patterns.includes(pick.id) && random() > 0.18) patterns.push(pick.id);
        }
        if (!patterns.includes('veins') && random() > 0.25) patterns.unshift('veins');
        const palette = { ...(weighted(PALETTES[kind], random) || PALETTES.butterfly[0]) };
        const proportions = {
            upperScaleX: 0.94 + random() * 0.16,
            upperScaleY: 0.92 + random() * 0.18,
            lowerScaleX: 0.9 + random() * 0.2,
            lowerScaleY: 0.92 + random() * 0.22,
            bodyScale: 0.92 + random() * 0.18,
            wingScale: kind === 'moth' ? 0.205 + random() * 0.035 : 0.2 + random() * 0.04
        };
        const motion = {
            idleFrequency: kind === 'moth' ? 1.45 + random() * 0.5 : 1.7 + random() * 0.55,
            flightFrequency: kind === 'moth' ? 4.0 + random() * 1.2 : 4.8 + random() * 1.5,
            bankStrength: 0.12 + random() * 0.08,
            bobAmount: kind === 'moth' ? 2.2 + random() * 1.3 : 1.4 + random() * 1.1
        };
        return { seed, kind, upperWing: upper?.id, lowerWing: lower?.id, body: body?.id, antennae: antennae?.id, patterns, palette, proportions, motion };
    }

    async function textureFor(entry) {
        if (!entry?.file || !window.PIXI?.Assets) throw new Error(`Missing asset file for ${entry?.id || 'unknown'}`);
        const url = state.basePath + entry.file;
        if (state.textureCache.has(url)) return state.textureCache.get(url);
        const texture = await PIXI.Assets.load(url);
        state.textureCache.set(url, texture);
        return texture;
    }

    function anchor(sprite, entry) {
        sprite.anchor.set((entry.anchor?.x || 256) / 512, (entry.anchor?.y || 256) / 512);
    }

    async function spritePart(entry, tint, alpha, scale) {
        const sprite = new PIXI.Sprite(await textureFor(entry));
        anchor(sprite, entry);
        sprite.tint = tint;
        sprite.alpha = alpha;
        sprite.scale.set(scale);
        return sprite;
    }

    async function wingArtwork(wingEntry, genome, isUpper) {
        const group = new PIXI.Container();
        const baseScale = genome.proportions.wingScale;
        const base = await spritePart(wingEntry, isUpper ? genome.palette.primary : genome.palette.secondary, 0.94, baseScale);
        group.addChild(base);
        const shade = await spritePart(wingEntry, genome.palette.dark, 0.16, baseScale);
        shade.blendMode = PIXI.BLEND_MODES.MULTIPLY;
        group.addChild(shade);
        const patternMap = indexById(lists().patterns);
        for (const patternId of genome.patterns || []) {
            const patternEntry = patternMap.get(patternId);
            if (!patternEntry) continue;
            const mask = await spritePart(wingEntry, 0xffffff, 0.01, baseScale);
            const pattern = await spritePart(patternEntry, patternId === 'veins' ? genome.palette.dark : genome.palette.highlight, patternId === 'veins' ? 0.36 : 0.62, baseScale);
            pattern.mask = mask;
            if (patternId !== 'veins') pattern.blendMode = PIXI.BLEND_MODES.ADD;
            group.addChild(mask, pattern);
        }
        const rim = await spritePart(wingEntry, genome.palette.highlight, 0.18, baseScale * 1.012);
        rim.blendMode = PIXI.BLEND_MODES.ADD;
        group.addChild(rim);
        return group;
    }

    function fallbackCreature(genome) {
        const root = new PIXI.Container();
        const visualRoot = new PIXI.Container();
        const gameplayRoot = new PIXI.Container();
        const glow = new PIXI.Graphics();
        const wings = new PIXI.Graphics();
        const body = new PIXI.Graphics();
        glow.beginFill(genome.palette?.glow || 0xff984d, 0.18); glow.drawCircle(0, 0, 64); glow.endFill();
        wings.beginFill(genome.palette?.primary || 0xff7a24, 0.86); wings.drawEllipse(-34, 0, 48, 26); wings.drawEllipse(34, 0, 48, 26); wings.endFill();
        body.beginFill(genome.palette?.dark || 0x241321, 1); body.drawEllipse(0, 0, 8, 36); body.endFill();
        visualRoot.addChild(glow, wings, body);
        root.addChild(gameplayRoot, visualRoot);
        root.__procedural = { genome, fallback: true, visualRoot, joints: {}, phase: 0, bank: 0, bob: 0, wingOpen: 1 };
        return root;
    }

    async function createCreature(genome, options = {}) {
        await loadManifest();
        if (!state.manifest || state.errors.length) return fallbackCreature(genome);
        const available = lists();
        const upperMap = indexById(available.upper);
        const lowerMap = indexById(available.lower);
        const bodyMap = indexById(available.bodies);
        const antennaMap = indexById(available.antennae);
        const upper = upperMap.get(genome.upperWing);
        const lower = lowerMap.get(genome.lowerWing);
        const bodyEntry = bodyMap.get(genome.body);
        const antennaEntry = antennaMap.get(genome.antennae);
        if (!upper || !lower || !bodyEntry || !antennaEntry) return fallbackCreature(genome);
        try {
            const root = new PIXI.Container();
            root.eventMode = 'none';
            const gameplayRoot = new PIXI.Container();
            const visualRoot = new PIXI.Container();
            const glow = new PIXI.Graphics();
            glow.beginFill(genome.palette.glow, 0.16); glow.drawCircle(0, 0, 78); glow.endFill();
            glow.blendMode = PIXI.BLEND_MODES.ADD;
            const leftUpper = new PIXI.Container(), leftLower = new PIXI.Container(), rightUpper = new PIXI.Container(), rightLower = new PIXI.Container();
            const body = await spritePart(bodyEntry, genome.palette.dark, 1, 0.185 * genome.proportions.bodyScale);
            const bodyGlow = await spritePart(bodyEntry, genome.palette.highlight, 0.18, 0.188 * genome.proportions.bodyScale);
            bodyGlow.blendMode = PIXI.BLEND_MODES.ADD;
            const antennae = await spritePart(antennaEntry, genome.palette.highlight, 0.9, 0.17);
            antennae.y = -46;
            const ru = await wingArtwork(upper, genome, true);
            const lu = await wingArtwork(upper, genome, true);
            const rl = await wingArtwork(lower, genome, false);
            const ll = await wingArtwork(lower, genome, false);
            rightUpper.addChild(ru); leftUpper.addChild(lu); rightLower.addChild(rl); leftLower.addChild(ll);
            rightUpper.y = -3; leftUpper.y = -3; rightLower.y = 8; leftLower.y = 8;
            visualRoot.addChild(glow, leftUpper, leftLower, rightUpper, rightLower, bodyGlow, body, antennae);
            root.addChild(gameplayRoot, visualRoot);
            root.scale.set(options.scale || 1);
            root.__procedural = { genome, fallback: false, visualRoot, glow, body, bodyGlow, antennae, joints: { leftUpper, leftLower, rightUpper, rightLower }, phase: 0, bank: 0, bob: 0, turn: 0, thrust: 0, lastRotation: 0 };
            return root;
        } catch (error) {
            state.errors.push(`Could not build creature: ${error.message}`);
            return fallbackCreature(genome);
        }
    }

    function updateCreature(creature, dt, motion = {}) {
        const proc = creature?.__procedural;
        if (!proc) return;
        const genome = proc.genome;
        const velocity = motion.velocity || { x: 0, y: 0 };
        const speed = Math.hypot(velocity.x || 0, velocity.y || 0);
        const accel = Math.hypot((motion.acceleration?.x || 0), (motion.acceleration?.y || 0));
        const thrustTarget = clamp((motion.thrust ?? accel / 900), 0, 1);
        proc.thrust = lerp(proc.thrust || 0, thrustTarget, 1 - Math.pow(0.02, dt));
        const glide = speed > 260 && proc.thrust < 0.16 ? 0.45 : 1;
        const freq = lerp(genome.motion.idleFrequency, genome.motion.flightFrequency, proc.thrust) * glide;
        proc.phase += dt * freq * TAU;
        const upperWave = (Math.sin(proc.phase) + 1) * 0.5;
        const lowerWave = (Math.sin(proc.phase - 0.42) + 1) * 0.5;
        const openUpper = 0.42 + upperWave * 0.58;
        const openLower = 0.5 + lowerWave * 0.5;
        const targetTurn = clamp(motion.turn || 0, -1, 1);
        proc.turn = lerp(proc.turn || 0, targetTurn, 1 - Math.pow(0.015, dt));
        proc.bank = angleLerp(proc.bank || 0, proc.turn * genome.motion.bankStrength, 1 - Math.pow(0.02, dt));
        proc.bob = lerp(proc.bob || 0, Math.sin(proc.phase * 0.5) * genome.motion.bobAmount, 1 - Math.pow(0.04, dt));
        const steerDiff = proc.turn * 0.055;
        const p = genome.proportions;
        const ju = proc.joints;
        if (ju.rightUpper) {
            ju.rightUpper.scale.set(openUpper * p.upperScaleX * (1 - steerDiff), p.upperScaleY);
            ju.leftUpper.scale.set(-openUpper * p.upperScaleX * (1 + steerDiff), p.upperScaleY);
            ju.rightLower.scale.set(openLower * p.lowerScaleX * (1 - steerDiff * 0.6), p.lowerScaleY);
            ju.leftLower.scale.set(-openLower * p.lowerScaleX * (1 + steerDiff * 0.6), p.lowerScaleY);
            ju.rightUpper.rotation = -0.07 + proc.bank * 0.45;
            ju.leftUpper.rotation = 0.07 + proc.bank * 0.45;
            ju.rightLower.rotation = 0.06 + proc.bank * 0.3;
            ju.leftLower.rotation = -0.06 + proc.bank * 0.3;
        }
        if (proc.visualRoot) proc.visualRoot.y = proc.bob;
        if (proc.body) proc.body.rotation = angleLerp(proc.body.rotation || 0, proc.bank * 0.8, 1 - Math.pow(0.04, dt));
        if (proc.bodyGlow) proc.bodyGlow.rotation = proc.body.rotation;
        if (proc.antennae) proc.antennae.rotation = angleLerp(proc.antennae.rotation || 0, -proc.bank * 0.55, 1 - Math.pow(0.08, dt));
        if (proc.glow) proc.glow.alpha = 0.48 + proc.thrust * 0.3 + Math.sin(proc.phase * 0.35) * 0.08;
    }

    function ensureAppliedLayer() {
        if (state.appliedLayer || !app() || !window.PIXI) return !!state.appliedLayer;
        state.appliedLayer = new PIXI.Container();
        state.appliedLayer.eventMode = 'none';
        state.appliedLayer.zIndex = 1800;
        app().stage.sortableChildren = true;
        app().stage.addChild(state.appliedLayer);
        return true;
    }

    async function applyGenomeToPlayer(genome) {
        state.appliedGenome = genome;
        if (!ensureAppliedLayer()) return { ok: false, reason: 'Pixi app is not ready.' };
        if (state.appliedCreature) state.appliedCreature.destroy({ children: true });
        const creature = await createCreature(genome);
        if (creature.__procedural?.fallback) {
            state.appliedCreature = null;
            return { ok: false, reason: 'Procedural assets unavailable; existing artwork was kept.' };
        }
        state.appliedCreature = creature;
        state.appliedLayer.addChild(creature);
        return { ok: true, genome };
    }

    function restoreTarget() {
        if (state.appliedTarget) {
            state.appliedTarget.visible = true;
            state.appliedTarget.__nocturneProceduralActive = false;
            state.appliedTarget = null;
        }
    }

    function followApplied(dt) {
        const creature = state.appliedCreature;
        if (!creature || !debug()?.state) return;
        const s = debug().state;
        const target = s.mode === 'playing' ? s.player : null;
        if (!target?.getGlobalPosition) {
            restoreTarget();
            creature.visible = false;
            return;
        }
        if (state.appliedTarget && state.appliedTarget !== target) restoreTarget();
        state.appliedTarget = target;
        target.__nocturneProceduralActive = true;
        target.visible = false;
        creature.visible = true;
        const point = target.getGlobalPosition();
        creature.position.set(point.x, point.y);
        creature.rotation = target.rotation || 0;
        const scale = Math.max(0.48, Math.min(1.6, Math.hypot(target.worldTransform.a, target.worldTransform.b)));
        creature.scale.set(scale);
        const velocity = s.velocity || { x: 0, y: 0 };
        const accel = { x: (velocity.x - state.lastPlayerVelocity.x) / Math.max(dt, 0.001), y: (velocity.y - state.lastPlayerVelocity.y) / Math.max(dt, 0.001) };
        state.lastPlayerVelocity = { x: velocity.x, y: velocity.y };
        const turn = clamp(((target.rotation || 0) - (creature.__procedural.lastRotation || 0)) / Math.max(dt, 0.001), -4, 4) / 4;
        creature.__procedural.lastRotation = target.rotation || 0;
        updateCreature(creature, dt, { velocity, acceleration: accel, thrust: Math.min(1, Math.hypot(accel.x, accel.y) / 1200), turn });
    }

    function loop(nowMs) {
        const dt = Math.min((nowMs - state.lastNow) / 1000, 0.05);
        state.lastNow = nowMs;
        followApplied(dt);
        requestAnimationFrame(loop);
    }

    const ready = loadManifest();
    window.nocturneProcedural = {
        ready,
        loadManifest,
        validateManifest,
        createGenome,
        createCreature,
        updateCreature,
        applyGenomeToPlayer,
        clearPlayerAppearance() { restoreTarget(); if (state.appliedCreature) state.appliedCreature.visible = false; state.appliedGenome = null; },
        isAppliedTarget(target) { return !!target?.__nocturneProceduralActive; },
        get errors() { return state.errors.slice(); },
        get manifest() { return state.manifest; },
        get appliedGenome() { return state.appliedGenome; }
    };
    requestAnimationFrame(loop);
})();
