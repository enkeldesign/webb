(() => {
    'use strict';

    const VIEW_ZOOM = 1.28;
    const ABILITIES = {
        monarch: { name: 'Shield', cooldown: 30, duration: 5, primary: 0xff9a2f, secondary: 0xffdf8f },
        cabbage: { name: 'Evasive', cooldown: 10, duration: 0.48, primary: 0xdff8ff, secondary: 0xffffff },
        rosy: { name: 'Dream Drift', cooldown: 20, duration: 1.55, primary: 0xff9ac9, secondary: 0xffe57a }
    };
    const SPECIES_KEYS = new Set(Object.keys(ABILITIES));

    const abilityValue = document.getElementById('abilityValue');
    const adminStatus = document.getElementById('adminStatus');
    const resetAbilityCooldownButton = document.getElementById('resetAbilityCooldownButton');

    let abilityLayer = null;
    let abilityGraphics = null;
    let cooldown = 0;
    let shieldTime = 0;
    let evasiveTime = 0;
    let evasiveTarget = null;
    let rosyTime = 0;
    let rosyDirection = 1;
    let lastNow = performance.now();
    let trailTimer = 0;
    let audioContext = null;
    let audioMaster = null;
    const particles = [];
    const afterimages = [];
    const creaturePhases = new WeakMap();
    const lastPositions = new WeakMap();

    function pixiApp() { return window.nocturnePixiApp; }
    function debug() { return window.nocturneWingsDebug; }
    function gameState() { return debug()?.state; }
    function player() { return gameState()?.player || null; }

    function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
    function lerp(current, target, amount) { return current + (target - current) * amount; }

    function setAdminStatus(text) {
        if (adminStatus) adminStatus.textContent = text;
    }

    function currentSpecies() {
        const selected = player()?.species || debug()?.save?.().selected || 'monarch';
        return SPECIES_KEYS.has(selected) ? selected : 'monarch';
    }

    function abilityForSpecies(species) {
        return ABILITIES[species] || ABILITIES.monarch;
    }

    function ensureLayers() {
        const app = pixiApp();
        if (!app || !window.PIXI) return false;
        if (!abilityLayer) {
            abilityLayer = new PIXI.Container();
            abilityLayer.eventMode = 'none';
            abilityLayer.zIndex = 1500;
            abilityGraphics = new PIXI.Graphics();
            abilityLayer.addChild(abilityGraphics);
            app.stage.sortableChildren = true;
            app.stage.addChild(abilityLayer);
        }
        return true;
    }

    function screenPointFor(displayObject) {
        if (!displayObject?.getGlobalPosition) return null;
        const point = displayObject.getGlobalPosition();
        return { x: point.x, y: point.y };
    }

    function worldPointFromScreen(x, y) {
        const ply = player();
        const world = ply?.parent?.parent;
        return { x: (x - (world?.x || 0)) / VIEW_ZOOM, y: (y - (world?.y || 0)) / VIEW_ZOOM };
    }

    function getArena() {
        const app = pixiApp();
        const worldWidth = (app?.screen.width || 1280) / VIEW_ZOOM;
        const worldHeight = (app?.screen.height || 720) / VIEW_ZOOM;
        const marginX = Math.min(84 / VIEW_ZOOM, worldWidth * 0.115);
        const top = Math.min(104 / VIEW_ZOOM, worldHeight * 0.18);
        const bottomMargin = Math.min(58 / VIEW_ZOOM, worldHeight * 0.12);
        return {
            left: marginX,
            right: worldWidth - marginX,
            top,
            bottom: worldHeight - bottomMargin,
            centerX: worldWidth / 2,
            centerY: (top + worldHeight - bottomMargin) / 2
        };
    }

    function walk(container, visitor) {
        if (!container?.children) return;
        for (const child of container.children) {
            visitor(child);
            if (child.children) walk(child, visitor);
        }
    }

    function ensureAudio() {
        if (audioContext || (!window.AudioContext && !window.webkitAudioContext)) return !!audioContext;
        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            audioContext = new AudioContextClass();
            audioMaster = audioContext.createGain();
            audioMaster.gain.value = 0.45;
            audioMaster.connect(audioContext.destination);
            return true;
        } catch (error) {
            audioContext = null;
            audioMaster = null;
            return false;
        }
    }

    function playTone(frequency, duration, type, gain, sweep = 0, delay = 0) {
        if (!ensureAudio() || !audioMaster) return;
        const now = audioContext.currentTime + delay;
        const osc = audioContext.createOscillator();
        const env = audioContext.createGain();
        const filter = audioContext.createBiquadFilter();
        osc.type = type;
        osc.frequency.setValueAtTime(frequency, now);
        if (sweep !== 0) osc.frequency.exponentialRampToValueAtTime(Math.max(40, frequency + sweep), now + duration);
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1800, now);
        env.gain.setValueAtTime(0.0001, now);
        env.gain.exponentialRampToValueAtTime(gain, now + 0.018);
        env.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        osc.connect(filter);
        filter.connect(env);
        env.connect(audioMaster);
        osc.start(now);
        osc.stop(now + duration + 0.05);
    }

    function playAbilitySound(species) {
        if (species === 'monarch') {
            playTone(220, 0.22, 'sine', 0.035, 90);
            playTone(440, 0.34, 'triangle', 0.025, 180, 0.04);
        } else if (species === 'cabbage') {
            playTone(560, 0.12, 'triangle', 0.03, 380);
            playTone(900, 0.16, 'sine', 0.022, -160, 0.03);
        } else if (species === 'rosy') {
            playTone(330, 0.28, 'sine', 0.03, 120);
            playTone(660, 0.38, 'triangle', 0.024, 220, 0.05);
            playTone(990, 0.42, 'sine', 0.014, -90, 0.08);
        }
    }

    function spawnRing(x, y, color, radius, life, width = 2.5) {
        particles.push({ type: 'ring', x, y, color, radius, width, life, maxLife: life });
    }

    function spawnMote(x, y, color, size, vx, vy, life, alpha = 0.85) {
        particles.push({ type: 'mote', x, y, color, size, vx, vy, life, maxLife: life, alpha });
        while (particles.length > 180) particles.shift();
    }

    function spawnAfterimage(colorA, colorB, scale = 1, stretch = 1) {
        const ply = player();
        const p = screenPointFor(ply);
        if (!p) return;
        afterimages.push({
            x: p.x,
            y: p.y,
            rotation: ply.rotation || 0,
            colorA,
            colorB,
            scale,
            stretch,
            life: 0.72,
            maxLife: 0.72
        });
        while (afterimages.length > 34) afterimages.shift();
    }

    function collectHazardPoints() {
        const ply = player();
        const world = ply?.parent?.parent;
        if (!world?.children) return [];
        const points = [];
        for (const layer of world.children) {
            walk(layer, (node) => {
                if (!node.visible || !node.getBounds || node === ply) return;
                let bounds;
                try { bounds = node.getBounds(); } catch (error) { return; }
                if (!Number.isFinite(bounds.x) || bounds.width < 12 || bounds.height < 12 || bounds.width > 720 || bounds.height > 240) return;
                points.push(worldPointFromScreen(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2));
            });
        }
        return points.slice(0, 36);
    }

    function chooseSafeSpot() {
        const ply = player();
        const arena = getArena();
        const hazards = collectHazardPoints();
        const candidates = [];
        for (let row = 0; row < 4; row += 1) {
            for (let col = 0; col < 5; col += 1) {
                candidates.push({
                    x: arena.left + (arena.right - arena.left) * ((col + 0.5) / 5),
                    y: arena.top + (arena.bottom - arena.top) * ((row + 0.5) / 4)
                });
            }
        }
        if (!ply) return { x: arena.centerX, y: arena.centerY };
        let best = candidates[0];
        let bestScore = -Infinity;
        for (const candidate of candidates) {
            const nearestHazard = hazards.length
                ? Math.min(...hazards.map((hazard) => Math.hypot(candidate.x - hazard.x, candidate.y - hazard.y)))
                : 460;
            const fromPlayer = Math.hypot(candidate.x - ply.x, candidate.y - ply.y);
            const edgeComfort = Math.min(candidate.x - arena.left, arena.right - candidate.x, candidate.y - arena.top, arena.bottom - candidate.y);
            const score = nearestHazard * 1.8 + edgeComfort * 0.55 - Math.abs(fromPlayer - 230) * 0.32;
            if (score > bestScore) {
                bestScore = score;
                best = candidate;
            }
        }
        return best;
    }

    function setAbilityReadyStyle(ready) {
        if (!abilityValue) return;
        abilityValue.dataset.ready = ready ? 'true' : 'false';
        abilityValue.style.color = ready ? 'var(--gold)' : '#a9b3c8';
        abilityValue.style.textShadow = ready ? '0 0 20px rgba(255, 214, 107, 0.48)' : 'none';
    }

    function updateAbilityHud() {
        if (!abilityValue) return;
        const ability = abilityForSpecies(currentSpecies());
        if (shieldTime > 0) abilityValue.textContent = `Shield ${Math.ceil(shieldTime)}s`;
        else if (evasiveTime > 0) abilityValue.textContent = 'Evading';
        else if (rosyTime > 0) abilityValue.textContent = 'Drifting';
        else if (cooldown > 0) abilityValue.textContent = `${Math.ceil(cooldown)}s`;
        else abilityValue.textContent = ability.name;
        setAbilityReadyStyle(cooldown <= 0);
    }

    function resetCooldown() {
        cooldown = 0;
        updateAbilityHud();
        setAdminStatus('Ability cooldown removed.');
    }

    function useAbility() {
        const s = gameState();
        const ply = player();
        if (!s || s.mode !== 'playing' || !ply) return;
        if (cooldown > 0) {
            setAdminStatus(`Ability ready in ${Math.ceil(cooldown)}s.`);
            return;
        }
        const species = currentSpecies();
        const ability = abilityForSpecies(species);
        const p = screenPointFor(ply);
        cooldown = ability.cooldown;
        playAbilitySound(species);
        if (species === 'monarch') {
            shieldTime = ability.duration;
            s.invulnerable = Math.max(s.invulnerable, shieldTime + 0.08);
            if (p) {
                spawnRing(p.x, p.y, ability.primary, 78, 0.9, 4);
                spawnRing(p.x, p.y, ability.secondary, 108, 1.15, 2);
            }
            setAdminStatus('Monarch shield active.');
        } else if (species === 'cabbage') {
            evasiveTime = ability.duration;
            evasiveTarget = chooseSafeSpot();
            s.invulnerable = Math.max(s.invulnerable, evasiveTime + 0.26);
            if (p) {
                spawnRing(p.x, p.y, ability.primary, 64, 0.62, 3);
                for (let i = 0; i < 18; i += 1) {
                    const angle = Math.random() * Math.PI * 2;
                    const speed = 80 + Math.random() * 260;
                    spawnMote(p.x, p.y, ability.secondary, 2 + Math.random() * 3, Math.cos(angle) * speed, Math.sin(angle) * speed, 0.45 + Math.random() * 0.35, 0.78);
                }
            }
            setAdminStatus('Cabbage evasive used.');
        } else if (species === 'rosy') {
            rosyTime = ability.duration;
            rosyDirection = Math.random() > 0.5 ? 1 : -1;
            s.invulnerable = Math.max(s.invulnerable, rosyTime + 0.26);
            if (p) {
                spawnRing(p.x, p.y, ability.primary, 92, 1.02, 3);
                spawnRing(p.x, p.y, ability.secondary, 124, 1.24, 2);
            }
            setAdminStatus('Rosy dream drift active.');
        }
        updateAbilityHud();
    }

    function smoothCreatureMotion(now) {
        const app = pixiApp();
        if (!app?.stage) return;
        const ply = player();
        walk(app.stage, (node) => {
            if (!node?.leftWing || !node?.rightWing || !node.species || !SPECIES_KEYS.has(node.species)) return;
            if (!creaturePhases.has(node)) creaturePhases.set(node, Math.random() * Math.PI * 2);
            const phase = creaturePhases.get(node);
            const last = lastPositions.get(node) || { x: node.x, y: node.y };
            const derivedSpeed = Math.hypot(node.x - last.x, node.y - last.y) * 60;
            lastPositions.set(node, { x: node.x, y: node.y });
            const speed = node === ply
                ? Math.hypot(gameState()?.velocity?.x || 0, gameState()?.velocity?.y || 0)
                : Math.max(derivedSpeed, Math.hypot(node.vx || 0, node.vy || 0));
            node.flightSpeed = lerp(node.flightSpeed || 0, speed, 0.18);
            node.flightTilt = lerp(node.flightTilt || 0, clamp(speed / 820, 0, 1), 0.12);
            const isMoth = node.species === 'rosy';
            const baseRate = isMoth ? 1.6 : 2.15;
            const speedRate = clamp(node.flightSpeed / 520, 0, 1.25);
            const flap = Math.sin(now * (baseRate + speedRate * 2.3) + phase) * (isMoth ? 0.13 : 0.16);
            const float = Math.sin(now * 0.92 + phase) * 0.018;
            node.flutterAmount = Math.abs(flap);
            node.leftWing.scale.x = 1 - flap;
            node.rightWing.scale.x = 1 + flap;
            node.leftWing.scale.y = 1 + Math.abs(flap) * 0.08;
            node.rightWing.scale.y = 1 + Math.abs(flap) * 0.08;
            node.leftWing.rotation = -0.05 - flap * 0.12;
            node.rightWing.rotation = 0.05 - flap * 0.12;
            if (node.body) node.body.rotation = Math.sin(now * 1.15 + phase) * 0.024;
            if (node.shimmer) node.shimmer.alpha = 0.14 + Math.abs(flap) * 0.72 + Math.min(node.flightSpeed / 5800, 0.12);
            if (node !== ply) {
                node.y += Math.sin(now * 0.8 + phase) * 0.045;
                node.scale.x *= 1 + float * 0.04;
                node.scale.y *= 1 - float * 0.035;
            }
        });
    }

    function spawnFlightTrail(dt) {
        const s = gameState();
        const ply = player();
        if (!s || s.mode !== 'playing' || !ply) return;
        const speed = Math.hypot(s.velocity?.x || 0, s.velocity?.y || 0);
        trailTimer -= dt;
        if (speed < 24 || trailTimer > 0) return;
        trailTimer = speed > 520 ? 0.018 : 0.034;
        const p = screenPointFor(ply);
        if (!p) return;
        const ability = abilityForSpecies(currentSpecies());
        const angle = (ply.rotation || 0) + Math.PI / 2;
        const offset = 20 + Math.random() * 16;
        const x = p.x + Math.cos(angle) * offset + (Math.random() - 0.5) * 16;
        const y = p.y + Math.sin(angle) * offset + (Math.random() - 0.5) * 16;
        spawnMote(x, y, Math.random() > 0.45 ? ability.primary : ability.secondary, 1.8 + Math.random() * 4.8, -s.velocity.x * 0.12 + (Math.random() - 0.5) * 46, -s.velocity.y * 0.12 + (Math.random() - 0.5) * 46, 0.42 + Math.random() * 0.38, 0.62);
        if (speed > 420 && Math.random() < 0.26) spawnAfterimage(ability.primary, ability.secondary, 0.78 + speed / 1600, 1.15);
    }

    function updateActiveAbilities(dt) {
        const s = gameState();
        const ply = player();
        if (!s || s.mode !== 'playing' || !ply) return;
        const species = currentSpecies();
        if (shieldTime > 0) {
            shieldTime = Math.max(0, shieldTime - dt);
            s.invulnerable = Math.max(s.invulnerable, shieldTime + 0.08);
            if (Math.random() < 0.34) spawnAfterimage(0xffa24a, 0xffd66b, 0.8, 1.05);
        }
        if (evasiveTime > 0 && evasiveTarget) {
            evasiveTime = Math.max(0, evasiveTime - dt);
            const ease = 1 - Math.pow(0.000006, dt);
            const dx = evasiveTarget.x - ply.x;
            const dy = evasiveTarget.y - ply.y;
            ply.x += dx * ease;
            ply.y += dy * ease;
            s.velocity.x = lerp(s.velocity.x, dx * 5.2, 0.45);
            s.velocity.y = lerp(s.velocity.y, dy * 5.2, 0.45);
            s.invulnerable = Math.max(s.invulnerable, evasiveTime + 0.16);
            if (Math.random() < 0.82) spawnAfterimage(0xdff8ff, 0xffffff, 0.9, 1.35);
        }
        if (rosyTime > 0) {
            rosyTime = Math.max(0, rosyTime - dt);
            const progress = 1 - rosyTime / ABILITIES.rosy.duration;
            s.velocity.x += rosyDirection * (330 - progress * 130) * dt;
            s.velocity.y += Math.sin(performance.now() / 260) * 420 * dt - 36 * dt;
            s.invulnerable = Math.max(s.invulnerable, rosyTime + 0.18);
            if (Math.random() < 0.92) spawnAfterimage(0xff9ac9, 0xffe57a, 1.08, 1.28);
        }
        if (species === 'monarch' && shieldTime <= 0) shieldTime = 0;
    }

    function drawWingGhost(ghost, alpha) {
        abilityGraphics.save?.();
        abilityGraphics.beginFill(ghost.colorA, alpha * 0.11);
        abilityGraphics.drawEllipse(ghost.x - 24 * ghost.scale, ghost.y, 34 * ghost.scale * ghost.stretch, 12 * ghost.scale);
        abilityGraphics.drawEllipse(ghost.x + 24 * ghost.scale, ghost.y, 34 * ghost.scale * ghost.stretch, 12 * ghost.scale);
        abilityGraphics.endFill();
        abilityGraphics.beginFill(ghost.colorB, alpha * 0.08);
        abilityGraphics.drawEllipse(ghost.x, ghost.y + 8, 18 * ghost.scale, 30 * ghost.scale);
        abilityGraphics.endFill();
    }

    function drawEffects(dt, now) {
        if (!ensureLayers() || !abilityGraphics) return;
        abilityGraphics.clear();
        const p = screenPointFor(player());
        if (p && shieldTime > 0) {
            const pulse = 1 + Math.sin(now * 5.6) * 0.055;
            abilityGraphics.lineStyle(3.5, 0xffa24a, 0.62);
            abilityGraphics.beginFill(0xff8a2a, 0.15);
            abilityGraphics.drawCircle(p.x, p.y, 68 * pulse);
            abilityGraphics.endFill();
            abilityGraphics.lineStyle(1.6, 0xffe0a0, 0.42);
            abilityGraphics.drawCircle(p.x, p.y, 80 * pulse);
            for (let i = 0; i < 5; i += 1) {
                const a = now * 1.4 + i * Math.PI * 0.4;
                abilityGraphics.beginFill(0xffd66b, 0.32);
                abilityGraphics.drawCircle(p.x + Math.cos(a) * 74 * pulse, p.y + Math.sin(a) * 74 * pulse, 3.2);
                abilityGraphics.endFill();
            }
        }
        if (p && evasiveTime > 0 && evasiveTarget) {
            const target = screenPointFromWorld(evasiveTarget.x, evasiveTarget.y);
            abilityGraphics.lineStyle(4, 0xdff8ff, 0.22);
            abilityGraphics.moveTo(p.x, p.y);
            abilityGraphics.bezierCurveTo((p.x + target.x) / 2, p.y - 80, (p.x + target.x) / 2, target.y + 80, target.x, target.y);
            abilityGraphics.beginFill(0xffffff, 0.18);
            abilityGraphics.drawCircle(target.x, target.y, 34 + Math.sin(now * 18) * 4);
            abilityGraphics.endFill();
        }
        if (p && rosyTime > 0) {
            const pulse = 1 + Math.sin(now * 5.1) * 0.08;
            abilityGraphics.beginFill(0xff9ac9, 0.17);
            abilityGraphics.drawCircle(p.x - 16, p.y + 5, 54 * pulse);
            abilityGraphics.endFill();
            abilityGraphics.beginFill(0xffe57a, 0.15);
            abilityGraphics.drawCircle(p.x + 18, p.y - 5, 46 / pulse);
            abilityGraphics.endFill();
            abilityGraphics.lineStyle(2, 0xffffff, 0.26);
            abilityGraphics.drawEllipse(p.x, p.y, 86 * pulse, 40 / pulse);
        }
        for (let i = afterimages.length - 1; i >= 0; i -= 1) {
            const ghost = afterimages[i];
            ghost.life -= dt;
            const t = Math.max(0, ghost.life / ghost.maxLife);
            drawWingGhost(ghost, t);
            if (ghost.life <= 0) afterimages.splice(i, 1);
        }
        for (let i = particles.length - 1; i >= 0; i -= 1) {
            const particle = particles[i];
            particle.life -= dt;
            const t = Math.max(0, particle.life / particle.maxLife);
            if (particle.type === 'ring') {
                const radius = particle.radius * (1.18 - t * 0.18);
                abilityGraphics.lineStyle(particle.width, particle.color, t * 0.62);
                abilityGraphics.drawCircle(particle.x, particle.y, radius);
            } else {
                particle.x += particle.vx * dt;
                particle.y += particle.vy * dt;
                particle.vx *= Math.pow(0.9, dt * 60);
                particle.vy *= Math.pow(0.9, dt * 60);
                abilityGraphics.beginFill(particle.color, particle.alpha * t);
                abilityGraphics.drawCircle(particle.x, particle.y, particle.size * (0.55 + t * 0.65));
                abilityGraphics.endFill();
            }
            if (particle.life <= 0) particles.splice(i, 1);
        }
    }

    function screenPointFromWorld(x, y) {
        const ply = player();
        const world = ply?.parent?.parent;
        return { x: (world?.x || 0) + x * VIEW_ZOOM, y: (world?.y || 0) + y * VIEW_ZOOM };
    }

    function removeOldExtraBiomeButtons() {
        document.querySelectorAll('[data-extra-biome]').forEach((button) => button.remove());
    }

    function loop(nowMs) {
        const dt = Math.min((nowMs - lastNow) / 1000, 0.05);
        const now = nowMs / 1000;
        lastNow = nowMs;
        cooldown = Math.max(0, cooldown - dt);
        ensureLayers();
        removeOldExtraBiomeButtons();
        smoothCreatureMotion(now);
        spawnFlightTrail(dt);
        updateActiveAbilities(dt);
        drawEffects(dt, now);
        updateAbilityHud();
        requestAnimationFrame(loop);
    }

    window.addEventListener('keydown', (event) => {
        if (event.key.toLowerCase() !== 'r' || event.repeat) return;
        const tag = document.activeElement?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        event.preventDefault();
        useAbility();
    });

    resetAbilityCooldownButton?.addEventListener('click', resetCooldown);

    window.nocturneAbilitiesDebug = {
        useAbility,
        resetCooldown,
        get cooldown() { return cooldown; },
        setCooldown(value) { cooldown = Math.max(0, Number(value) || 0); updateAbilityHud(); },
        get active() { return { shieldTime, evasiveTime, rosyTime, particles: particles.length, afterimages: afterimages.length }; }
    };

    requestAnimationFrame(loop);
})();
