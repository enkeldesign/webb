(() => {
    'use strict';

    const VIEW_ZOOM = 1.28;
    const ABILITIES = {
        monarch: { name: 'Shield', cooldown: 30, duration: 5 },
        cabbage: { name: 'Evasive', cooldown: 10, duration: 0.44 },
        rosy: { name: 'Dream Drift', cooldown: 20, duration: 1.45 }
    };
    const EXTRA_BIOMES = {
        volcano: { name: 'Volcano Caldera', hazard: 'lava beams' },
        ice: { name: 'Crystal Icefield', hazard: 'ice spikes' }
    };

    const shell = document.getElementById('gameShell');
    const abilityValue = document.getElementById('abilityValue');
    const biomeValue = document.getElementById('biomeValue');
    const healthValue = document.getElementById('healthValue');
    const adminStatus = document.getElementById('adminStatus');
    const resetAbilityCooldownButton = document.getElementById('resetAbilityCooldownButton');
    const gameOverScreen = document.getElementById('gameOverScreen');
    const pauseScreen = document.getElementById('pauseScreen');
    const startScreen = document.getElementById('startScreen');
    const resultEyebrow = document.getElementById('resultEyebrow');
    const resultTitle = document.getElementById('resultTitle');
    const resultSummary = document.getElementById('resultSummary');
    const finalScore = document.getElementById('finalScore');
    const finalPollen = document.getElementById('finalPollen');
    const finalBank = document.getElementById('finalBank');

    let abilityLayer = null;
    let biomeLayer = null;
    let hazardLayer = null;
    let abilityGraphics = null;
    let biomeGraphics = null;
    let hazardGraphics = null;
    let cooldown = 0;
    let shieldTime = 0;
    let evasiveTime = 0;
    let evasiveTarget = null;
    let rosyTime = 0;
    let rosyDirection = 1;
    let customBiome = null;
    let forcedExtraBiome = null;
    let runClock = 0;
    let lastMode = 'title';
    let lastSegment = -1;
    let spawnTimer = 1.2;
    let lastNow = performance.now();
    const afterimages = [];
    const customHazards = [];
    const creaturePhases = new WeakMap();

    function pixiApp() { return window.nocturnePixiApp; }
    function debug() { return window.nocturneWingsDebug; }
    function gameState() { return debug()?.state; }
    function player() { return gameState()?.player || null; }

    function setAdminStatus(text) {
        if (adminStatus) adminStatus.textContent = text;
    }

    function currentSpecies() {
        return player()?.species || debug()?.save?.().selected || 'monarch';
    }

    function abilityForSpecies(species) {
        return ABILITIES[species] || ABILITIES.monarch;
    }

    function ensureLayers() {
        const app = pixiApp();
        if (!app || !window.PIXI) return false;
        if (!biomeLayer) {
            biomeLayer = new PIXI.Container();
            biomeLayer.visible = false;
            biomeLayer.eventMode = 'none';
            biomeGraphics = new PIXI.Graphics();
            biomeLayer.addChild(biomeGraphics);
            app.stage.addChildAt(biomeLayer, Math.min(1, app.stage.children.length));
        }
        if (!hazardLayer) {
            hazardLayer = new PIXI.Container();
            hazardLayer.visible = false;
            hazardLayer.eventMode = 'none';
            hazardGraphics = new PIXI.Graphics();
            hazardLayer.addChild(hazardGraphics);
            app.stage.addChild(hazardLayer);
        }
        if (!abilityLayer) {
            abilityLayer = new PIXI.Container();
            abilityLayer.eventMode = 'none';
            abilityGraphics = new PIXI.Graphics();
            abilityLayer.addChild(abilityGraphics);
            app.stage.addChild(abilityLayer);
        }
        return true;
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function lerp(current, target, amount) {
        return current + (target - current) * amount;
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

    function screenPointFromWorld(x, y) {
        const ply = player();
        const world = ply?.parent?.parent;
        return { x: (world?.x || 0) + x * VIEW_ZOOM, y: (world?.y || 0) + y * VIEW_ZOOM };
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

    function collectOriginalHazardPoints() {
        const ply = player();
        const world = ply?.parent?.parent;
        if (!world?.children) return [];
        const layers = [world.children[1], world.children[2]].filter(Boolean);
        const points = [];
        for (const layer of layers) {
            walk(layer, (node) => {
                if (!node.visible || !node.getBounds) return;
                let bounds;
                try { bounds = node.getBounds(); } catch (error) { return; }
                if (!Number.isFinite(bounds.x) || bounds.width < 5 || bounds.height < 5 || bounds.width > 760 || bounds.height > 260) return;
                points.push(worldPointFromScreen(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2));
            });
        }
        return points;
    }

    function collectCustomHazardPoints() {
        return customHazards.map((hazard) => {
            if (hazard.type === 'lava') return worldPointFromScreen(hazard.x, hazard.height / 2);
            if (hazard.type === 'ice') {
                const y = hazard.side === 'top' ? hazard.height * 0.28 : hazard.height * 0.72;
                return worldPointFromScreen(hazard.x, y);
            }
            return null;
        }).filter(Boolean);
    }

    function chooseSafeSpot() {
        const ply = player();
        const arena = getArena();
        const hazards = collectOriginalHazardPoints().concat(collectCustomHazardPoints());
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
            const score = nearestHazard * 1.9 + edgeComfort * 0.5 - Math.abs(fromPlayer - 220) * 0.4;
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

    function spawnRing(color, radius, life) {
        const p = screenPointFor(player());
        if (!p) return;
        afterimages.push({ x: p.x, y: p.y, color, radius, life, maxLife: life, ring: true });
    }

    function spawnAfterimage(colorA, colorB, scale = 1) {
        const ply = player();
        const p = screenPointFor(ply);
        if (!p) return;
        afterimages.push({
            x: p.x,
            y: p.y,
            colorA,
            colorB,
            scale,
            life: 0.72,
            maxLife: 0.72,
            ring: false
        });
        while (afterimages.length > 26) afterimages.shift();
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
        cooldown = ability.cooldown;
        if (species === 'monarch') {
            shieldTime = ability.duration;
            spawnRing(0xffa24a, 76, 0.9);
            setAdminStatus('Monarch shield active.');
        } else if (species === 'cabbage') {
            evasiveTime = ability.duration;
            evasiveTarget = chooseSafeSpot();
            s.invulnerable = Math.max(s.invulnerable, evasiveTime + 0.22);
            spawnRing(0xdff8ff, 64, 0.62);
            setAdminStatus('Cabbage evasive used.');
        } else if (species === 'rosy') {
            rosyTime = ability.duration;
            rosyDirection = Math.random() > 0.5 ? 1 : -1;
            s.invulnerable = Math.max(s.invulnerable, rosyTime + 0.25);
            spawnRing(0xff9ac9, 82, 0.86);
            setAdminStatus('Rosy dream drift active.');
        }
        updateAbilityHud();
    }

    function smoothCreatureMotion(now) {
        const app = pixiApp();
        if (!app?.stage) return;
        walk(app.stage, (node) => {
            if (!node?.leftWing || !node?.rightWing || !node.species) return;
            if (!creaturePhases.has(node)) creaturePhases.set(node, Math.random() * Math.PI * 2);
            const phase = creaturePhases.get(node);
            const species = node.species;
            const isMoth = species === 'rosy';
            const speed = node === player()
                ? Math.hypot(gameState()?.velocity?.x || 0, gameState()?.velocity?.y || 0)
                : Math.hypot(node.vx || 0, node.vy || 0);
            const baseRate = isMoth ? 1.15 : 1.55;
            const flap = Math.sin(now * baseRate + phase) * (isMoth ? 0.085 : 0.105) + Math.sin(now * 0.62 + phase) * 0.035;
            const breath = Math.sin(now * 0.82 + phase) * 0.016;
            node.leftWing.scale.x = 1 - flap;
            node.rightWing.scale.x = 1 + flap;
            node.leftWing.scale.y = 1 + Math.abs(flap) * 0.055;
            node.rightWing.scale.y = 1 + Math.abs(flap) * 0.055;
            node.leftWing.rotation = -0.045 - flap * 0.06;
            node.rightWing.rotation = 0.045 - flap * 0.06;
            if (node.body) node.body.rotation = Math.sin(now * 1.05 + phase) * 0.022;
            if (node.shimmer) node.shimmer.alpha = 0.12 + Math.abs(flap) * 0.9 + Math.min(speed / 6500, 0.08);
            if (node !== player()) {
                node.y += Math.sin(now * 0.74 + phase) * 0.06;
                const baseX = Math.abs(node.scale.x) || 1;
                const baseY = Math.abs(node.scale.y) || 1;
                node.scale.x = baseX * (1 + breath * 0.12);
                node.scale.y = baseY * (1 - breath * 0.1);
            }
        });
    }

    function updateActiveAbilities(dt) {
        const s = gameState();
        const ply = player();
        if (!s || s.mode !== 'playing' || !ply) return;
        if (shieldTime > 0) {
            shieldTime = Math.max(0, shieldTime - dt);
            s.invulnerable = Math.max(s.invulnerable, shieldTime + 0.08);
            if (Math.random() < 0.3) spawnAfterimage(0xffa24a, 0xffd66b, 0.72);
        }
        if (evasiveTime > 0 && evasiveTarget) {
            evasiveTime = Math.max(0, evasiveTime - dt);
            const ease = 1 - Math.pow(0.00001, dt);
            const dx = evasiveTarget.x - ply.x;
            const dy = evasiveTarget.y - ply.y;
            ply.x += dx * ease;
            ply.y += dy * ease;
            s.velocity.x = dx * 4.8;
            s.velocity.y = dy * 4.8;
            s.invulnerable = Math.max(s.invulnerable, evasiveTime + 0.14);
            if (Math.random() < 0.7) spawnAfterimage(0xdff8ff, 0xffffff, 0.84);
        }
        if (rosyTime > 0) {
            rosyTime = Math.max(0, rosyTime - dt);
            const progress = 1 - rosyTime / ABILITIES.rosy.duration;
            s.velocity.x += rosyDirection * (340 - progress * 130) * dt;
            s.velocity.y += Math.sin(performance.now() / 260) * 430 * dt - 38 * dt;
            s.invulnerable = Math.max(s.invulnerable, rosyTime + 0.16);
            if (Math.random() < 0.82) spawnAfterimage(0xff9ac9, 0xffe57a, 1.02);
        }
    }

    function drawAbilityEffects(dt) {
        if (!ensureLayers() || !abilityGraphics) return;
        abilityGraphics.clear();
        const p = screenPointFor(player());
        if (p && shieldTime > 0) {
            const pulse = 1 + Math.sin(performance.now() / 260) * 0.045;
            abilityGraphics.lineStyle(3, 0xffa24a, 0.58);
            abilityGraphics.beginFill(0xff8a2a, 0.14);
            abilityGraphics.drawCircle(p.x, p.y, 68 * pulse);
            abilityGraphics.endFill();
            abilityGraphics.lineStyle(1.5, 0xffe0a0, 0.4);
            abilityGraphics.drawCircle(p.x, p.y, 76 * pulse);
        }
        if (p && rosyTime > 0) {
            const pulse = 1 + Math.sin(performance.now() / 210) * 0.08;
            abilityGraphics.beginFill(0xff9ac9, 0.16);
            abilityGraphics.drawCircle(p.x - 14, p.y + 5, 50 * pulse);
            abilityGraphics.endFill();
            abilityGraphics.beginFill(0xffe57a, 0.14);
            abilityGraphics.drawCircle(p.x + 16, p.y - 4, 42 / pulse);
            abilityGraphics.endFill();
        }
        for (let i = afterimages.length - 1; i >= 0; i -= 1) {
            const ghost = afterimages[i];
            ghost.life -= dt;
            const t = Math.max(0, ghost.life / ghost.maxLife);
            if (ghost.ring) {
                abilityGraphics.lineStyle(2, ghost.color, t * 0.62);
                abilityGraphics.drawCircle(ghost.x, ghost.y, ghost.radius * (1.2 - t * 0.2));
            } else {
                abilityGraphics.lineStyle(1, ghost.colorB, t * 0.16);
                abilityGraphics.beginFill(ghost.colorA, t * 0.1);
                abilityGraphics.drawEllipse(ghost.x - 18 * ghost.scale, ghost.y, 28 * ghost.scale, 10 * ghost.scale);
                abilityGraphics.drawEllipse(ghost.x + 18 * ghost.scale, ghost.y, 28 * ghost.scale, 10 * ghost.scale);
                abilityGraphics.endFill();
                abilityGraphics.beginFill(ghost.colorB, t * 0.075);
                abilityGraphics.drawEllipse(ghost.x, ghost.y + 8, 18 * ghost.scale, 26 * ghost.scale);
                abilityGraphics.endFill();
            }
            if (ghost.life <= 0) afterimages.splice(i, 1);
        }
    }

    function setCustomBiome(name, forced = false) {
        if (!ensureLayers() || !EXTRA_BIOMES[name]) return;
        customBiome = name;
        if (forced) forcedExtraBiome = name;
        spawnTimer = name === 'volcano' ? 1.2 : 1.0;
        customHazards.length = 0;
        biomeLayer.visible = true;
        hazardLayer.visible = true;
        shell.dataset.extraBiome = name;
        if (biomeValue) biomeValue.textContent = EXTRA_BIOMES[name].name;
        setAdminStatus(`${EXTRA_BIOMES[name].name} active.`);
    }

    function clearCustomBiome() {
        if (!customBiome) return;
        customBiome = null;
        customHazards.length = 0;
        if (biomeLayer) biomeLayer.visible = false;
        if (hazardLayer) hazardLayer.visible = false;
        if (biomeGraphics) biomeGraphics.clear();
        if (hazardGraphics) hazardGraphics.clear();
        delete shell.dataset.extraBiome;
    }

    function drawVolcanoBackground(g, w, h, time) {
        g.beginFill(0x16070a, 0.96); g.drawRect(0, 0, w, h); g.endFill();
        g.beginFill(0x391416, 0.75); g.drawPolygon([0, h, w * 0.18, h * 0.54, w * 0.36, h, w * 0.56, h * 0.5, w * 0.82, h, w, h * 0.58, w, h]); g.endFill();
        g.beginFill(0x1f1a1b, 0.82);
        for (let i = 0; i < 10; i += 1) {
            const x = (i * 137) % w;
            const y = h * (0.2 + (i % 4) * 0.14);
            g.drawEllipse(x, y, 58 + (i % 3) * 20, 18 + (i % 2) * 10);
        }
        g.endFill();
        const pulse = 0.45 + Math.sin(time * 1.4) * 0.14;
        g.beginFill(0xff5b21, 0.26 + pulse * 0.12); g.drawEllipse(w * 0.5, h * 0.88, w * 0.42, h * 0.16); g.endFill();
        g.beginFill(0xffb347, 0.18 + pulse * 0.1); g.drawEllipse(w * 0.5, h * 0.9, w * 0.24, h * 0.08); g.endFill();
        for (let i = 0; i < 7; i += 1) {
            g.lineStyle(5 + (i % 3), i % 2 ? 0xffa02e : 0xff4222, 0.26);
            const x = (i * 211 + time * 24) % (w + 180) - 90;
            g.moveTo(x, h);
            g.lineTo(x + 70, h * 0.62 + Math.sin(time + i) * 24);
        }
    }

    function drawIceBackground(g, w, h, time) {
        g.beginFill(0x07182f, 0.98); g.drawRect(0, 0, w, h); g.endFill();
        g.beginFill(0x83d7ff, 0.09); g.drawEllipse(w * 0.24, h * 0.22, w * 0.28, h * 0.18); g.drawEllipse(w * 0.78, h * 0.66, w * 0.32, h * 0.2); g.endFill();
        for (let i = 0; i < 16; i += 1) {
            const x = (i * 97) % w;
            const y = (i * 53 + Math.sin(time + i) * 20) % h;
            g.lineStyle(1, i % 2 ? 0xbff6ff : 0xffffff, 0.18);
            g.moveTo(x - 50, y + 20);
            g.lineTo(x + 80, y - 24);
        }
        g.beginFill(0xc8f8ff, 0.11);
        g.drawPolygon([0, h, w * 0.18, h * 0.78, w * 0.36, h, w * 0.56, h * 0.74, w * 0.75, h, w, h * 0.76, w, h]);
        g.endFill();
    }

    function drawCustomBackground(time) {
        if (!customBiome || !biomeGraphics || !pixiApp()) return;
        const { width, height } = pixiApp().screen;
        biomeGraphics.clear();
        if (customBiome === 'volcano') drawVolcanoBackground(biomeGraphics, width, height, time);
        if (customBiome === 'ice') drawIceBackground(biomeGraphics, width, height, time);
    }

    function spawnLavaBeam() {
        const app = pixiApp();
        if (!app) return;
        customHazards.push({
            type: 'lava',
            x: 130 + Math.random() * Math.max(240, app.screen.width - 260),
            width: 90 + Math.random() * 50,
            height: app.screen.height,
            time: 0,
            warning: 5,
            attack: 1.05
        });
    }

    function spawnIceSpike() {
        const app = pixiApp();
        if (!app) return;
        const side = Math.random() > 0.5 ? 'top' : 'bottom';
        customHazards.push({
            type: 'ice',
            side,
            x: 80 + Math.random() * Math.max(180, app.screen.width - 160),
            width: 95 + Math.random() * 55,
            height: 150 + Math.random() * 90,
            time: 0,
            warning: 3,
            attack: 0.62,
            hold: 0.72
        });
    }

    function drawTriangle(g, x, baseY, width, height, side, color, alpha) {
        g.beginFill(color, alpha);
        if (side === 'top') g.drawPolygon([x - width / 2, 0, x + width / 2, 0, x, height]);
        else g.drawPolygon([x - width / 2, baseY, x + width / 2, baseY, x, baseY - height]);
        g.endFill();
    }

    function pointInTriangle(px, py, ax, ay, bx, by, cx, cy) {
        const v0x = cx - ax, v0y = cy - ay;
        const v1x = bx - ax, v1y = by - ay;
        const v2x = px - ax, v2y = py - ay;
        const dot00 = v0x * v0x + v0y * v0y;
        const dot01 = v0x * v1x + v0y * v1y;
        const dot02 = v0x * v2x + v0y * v2y;
        const dot11 = v1x * v1x + v1y * v1y;
        const dot12 = v1x * v2x + v1y * v2y;
        const invDenom = 1 / (dot00 * dot11 - dot01 * dot01 || 1);
        const u = (dot11 * dot02 - dot01 * dot12) * invDenom;
        const v = (dot00 * dot12 - dot01 * dot02) * invDenom;
        return u >= 0 && v >= 0 && u + v < 1;
    }

    function damagePlayer(color) {
        const s = gameState();
        if (!s || s.mode !== 'playing' || s.invulnerable > 0) return;
        s.health -= 1;
        s.invulnerable = 1.05;
        if (healthValue) healthValue.textContent = String(Math.max(0, s.health));
        spawnRing(color, 78, 0.62);
        if (s.health <= 0) finishExternalRun();
    }

    function finishExternalRun() {
        const s = gameState();
        if (!s) return;
        s.mode = 'gameOver';
        if (resultEyebrow) resultEyebrow.textContent = 'Run Ended';
        if (resultTitle) resultTitle.textContent = 'Game Over';
        if (resultSummary) resultSummary.textContent = 'The butterfly lost its last health. Your collected pollen has been saved.';
        if (finalScore) finalScore.textContent = String(s.score || 0);
        if (finalPollen) finalPollen.textContent = String(s.runPollen || 0);
        const bank = debug()?.save?.().pollen || 0;
        if (finalBank) finalBank.textContent = bank >= 999999999 ? 'Infinite' : String(bank);
        if (startScreen) startScreen.hidden = true;
        if (pauseScreen) pauseScreen.hidden = true;
        if (gameOverScreen) gameOverScreen.hidden = false;
        clearCustomBiome();
    }

    function updateCustomHazards(dt) {
        if (!customBiome || !hazardGraphics || !pixiApp()) return;
        const s = gameState();
        if (s) s.hazardTimer = 999;
        const app = pixiApp();
        const p = screenPointFor(player());
        spawnTimer -= dt;
        if (spawnTimer <= 0) {
            if (customBiome === 'volcano') {
                spawnLavaBeam();
                spawnTimer = 2.7 + Math.random() * 1.2;
            } else if (customBiome === 'ice') {
                spawnIceSpike();
                spawnTimer = 1.9 + Math.random() * 0.9;
            }
        }
        hazardGraphics.clear();
        for (let i = customHazards.length - 1; i >= 0; i -= 1) {
            const hazard = customHazards[i];
            hazard.time += dt;
            if (hazard.type === 'lava') {
                const warning = hazard.time < hazard.warning;
                if (warning) {
                    const pulse = 0.28 + Math.sin(performance.now() / 180) * 0.08;
                    hazardGraphics.beginFill(0xff2b1f, pulse);
                    hazardGraphics.drawRoundedRect(hazard.x - hazard.width / 2, 0, hazard.width, app.screen.height, 22);
                    hazardGraphics.endFill();
                    hazardGraphics.lineStyle(3, 0xffc06a, 0.42);
                    hazardGraphics.moveTo(hazard.x, 0);
                    hazardGraphics.lineTo(hazard.x, app.screen.height);
                } else {
                    const t = clamp((hazard.time - hazard.warning) / hazard.attack, 0, 1);
                    const beamHeight = app.screen.height * Math.min(1, t * 1.6);
                    const top = app.screen.height - beamHeight;
                    hazardGraphics.beginFill(0xff3b1f, 0.84);
                    hazardGraphics.drawRoundedRect(hazard.x - hazard.width / 2, top, hazard.width, beamHeight, 24);
                    hazardGraphics.endFill();
                    hazardGraphics.beginFill(0xffd166, 0.52);
                    hazardGraphics.drawRoundedRect(hazard.x - hazard.width * 0.22, top, hazard.width * 0.44, beamHeight, 18);
                    hazardGraphics.endFill();
                    if (p && Math.abs(p.x - hazard.x) <= hazard.width / 2 && p.y >= top) damagePlayer(0xff5b21);
                    if (hazard.time > hazard.warning + hazard.attack + 0.35) customHazards.splice(i, 1);
                }
            } else if (hazard.type === 'ice') {
                const warning = hazard.time < hazard.warning;
                const baseY = hazard.side === 'top' ? 0 : app.screen.height;
                if (warning) {
                    drawTriangle(hazardGraphics, hazard.x, app.screen.height, hazard.width, hazard.height, hazard.side, 0x9beaff, 0.23 + Math.sin(performance.now() / 220) * 0.06);
                    hazardGraphics.lineStyle(2, 0xe4fbff, 0.48);
                    if (hazard.side === 'top') hazardGraphics.drawPolygon([hazard.x - hazard.width / 2, 0, hazard.x + hazard.width / 2, 0, hazard.x, hazard.height]);
                    else hazardGraphics.drawPolygon([hazard.x - hazard.width / 2, app.screen.height, hazard.x + hazard.width / 2, app.screen.height, hazard.x, app.screen.height - hazard.height]);
                } else {
                    const t = clamp((hazard.time - hazard.warning) / hazard.attack, 0, 1);
                    const activeHeight = hazard.height * (t * t * (3 - 2 * t));
                    drawTriangle(hazardGraphics, hazard.x, baseY, hazard.width, activeHeight, hazard.side, 0xbff6ff, 0.9);
                    hazardGraphics.lineStyle(2, 0xffffff, 0.7);
                    if (hazard.side === 'top') hazardGraphics.drawPolygon([hazard.x - hazard.width / 2, 0, hazard.x + hazard.width / 2, 0, hazard.x, activeHeight]);
                    else hazardGraphics.drawPolygon([hazard.x - hazard.width / 2, app.screen.height, hazard.x + hazard.width / 2, app.screen.height, hazard.x, app.screen.height - activeHeight]);
                    if (p && activeHeight > hazard.height * 0.65) {
                        const hit = hazard.side === 'top'
                            ? pointInTriangle(p.x, p.y, hazard.x - hazard.width / 2, 0, hazard.x + hazard.width / 2, 0, hazard.x, activeHeight)
                            : pointInTriangle(p.x, p.y, hazard.x - hazard.width / 2, app.screen.height, hazard.x + hazard.width / 2, app.screen.height, hazard.x, app.screen.height - activeHeight);
                        if (hit) damagePlayer(0xbff6ff);
                    }
                    if (hazard.time > hazard.warning + hazard.attack + hazard.hold) customHazards.splice(i, 1);
                }
            }
        }
    }

    function updateBiomeCycle(dt) {
        const s = gameState();
        if (!s) return;
        if (lastMode !== s.mode) {
            if (s.mode === 'playing') {
                runClock = 0;
                lastSegment = -1;
                forcedExtraBiome = null;
                clearCustomBiome();
            }
            lastMode = s.mode;
        }
        if (s.mode !== 'playing') return;
        runClock += dt;
        if (forcedExtraBiome) {
            if (customBiome !== forcedExtraBiome) setCustomBiome(forcedExtraBiome, true);
            return;
        }
        const segment = Math.floor(runClock / 30) % 5;
        if (segment === lastSegment) return;
        lastSegment = segment;
        if (segment === 3) setCustomBiome('volcano', false);
        else if (segment === 4) setCustomBiome('ice', false);
        else {
            clearCustomBiome();
            debug()?.forceBiome?.(segment);
        }
    }

    function forceExtraBiome(name) {
        if (!EXTRA_BIOMES[name]) return;
        const s = gameState();
        if (!s || s.mode !== 'playing') debug()?.forceBiome?.(0);
        forcedExtraBiome = name;
        setCustomBiome(name, true);
    }

    function clearForcedExtra() {
        forcedExtraBiome = null;
        clearCustomBiome();
    }

    function loop(now) {
        const dt = Math.min((now - lastNow) / 1000, 0.05);
        lastNow = now;
        cooldown = Math.max(0, cooldown - dt);
        ensureLayers();
        smoothCreatureMotion(now / 1000);
        updateActiveAbilities(dt);
        updateBiomeCycle(dt);
        drawCustomBackground(now / 1000);
        updateCustomHazards(dt);
        drawAbilityEffects(dt);
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
    document.querySelectorAll('[data-extra-biome]').forEach((button) => {
        button.addEventListener('click', () => forceExtraBiome(button.dataset.extraBiome));
    });
    document.querySelectorAll('[data-biome-index]').forEach((button) => {
        button.addEventListener('click', clearForcedExtra);
    });

    window.nocturneAbilitiesDebug = {
        useAbility,
        resetCooldown,
        forceExtraBiome,
        clearForcedExtra,
        get cooldown() { return cooldown; },
        setCooldown(value) { cooldown = Math.max(0, Number(value) || 0); updateAbilityHud(); },
        get active() { return { shieldTime, evasiveTime, rosyTime, customBiome, forcedExtraBiome, hazards: customHazards.length }; }
    };

    requestAnimationFrame(loop);
})();
