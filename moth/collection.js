(() => {
    'use strict';

    const SAVE_KEY = 'nocturneWingsSaveV2';
    const COLLECTION_KEY = 'nocturneCollectionV1';
    const SUMMON_COST = 2000;
    const SUMMON_TIME = 60 * 1000;
    const VIEW_ZOOM = 1.28;

    const SPECIES = {
        monarch: { name: 'Monarch', kind: 'butterfly', ability: 'Orange shield', cooldown: 30, facts: 'Famous for migration and bright warning colors.' },
        cabbage: { name: 'Cabbage White', kind: 'butterfly', ability: 'Quick evasive', cooldown: 10, facts: 'A nimble pale butterfly often seen fluttering over gardens.' },
        peacock: { name: 'Peacock Butterfly', kind: 'butterfly', ability: 'Eye Flash', cooldown: 30, facts: 'Its wing eyespots can startle predators and look like glowing blue eyes here.' },
        redAdmiral: { name: 'Red Admiral', kind: 'butterfly', ability: 'Red Wind Dash', cooldown: 18, facts: 'A bold dark butterfly with vivid red bands and fast territorial flight.' },
        rosy: { name: 'Rosy Maple Moth', kind: 'moth', ability: 'Dream Drift', cooldown: 20, facts: 'A pastel pink and yellow moth with a soft, plush look.' },
        silverY: { name: 'Silver Y Moth', kind: 'moth', ability: 'Silver Slow', cooldown: 20, facts: 'Named for the silver Y-shaped mark on its wings.' },
        atlas: { name: 'Atlas Moth', kind: 'moth', ability: 'Atlas Wall', cooldown: 35, facts: 'One of the largest moths, with huge patterned wings.' }
    };

    const EXTENDED_POOL = ['peacock', 'silverY', 'redAdmiral', 'atlas'];
    const ALL_BIOMES = {
        moonleaf: { name: 'Moonleaf Grove', hazard: 'Rotating thorn hazards drift across the garden.' },
        amber: { name: 'Amber Fern Canopy', hazard: 'Wasps warn with a red line before a fast charge.' },
        sky: { name: 'Cloudbreak Sky', hazard: 'Raindrops fall from above in light patterns.' },
        volcano: { name: 'Volcano Caldera', hazard: 'Wide lava warnings flash briefly before long lava beams rise.' },
        ice: { name: 'Crystal Icefield', hazard: 'Large triangle warnings become fast ice spikes from top and bottom.' }
    };

    const state = {
        cooldown: 0,
        activeAbility: null,
        abilityTime: 0,
        customBiome: null,
        forcedBiome: null,
        spawnTimer: 1.1,
        lastNow: performance.now(),
        lastMode: 'title',
        runClock: 0,
        segment: -1,
        albumPage: 0,
        selectedInfo: null,
        hazards: [],
        ghosts: [],
        hazardFreeze: 0,
        hazardSlow: 1,
        windTime: 0,
        wallTime: 0,
        wallX: 0,
        wallY: 0,
        wallAngle: 0
    };

    let collection = loadCollection();
    let layer = null;
    let graphics = null;
    let album = null;
    let albumBody = null;
    let albumTitle = null;
    let highHud = null;
    let highLobby = null;
    let highResult = null;
    let summonHooked = false;

    function dbg() { return window.nocturneWingsDebug; }
    function gs() { return dbg()?.state; }
    function app() { return window.nocturnePixiApp; }
    function player() { return gs()?.player || null; }
    function adminStatus() { return document.getElementById('adminStatus'); }

    function loadCollection() {
        try {
            const parsed = JSON.parse(localStorage.getItem(COLLECTION_KEY) || 'null') || {};
            return {
                unlocked: Array.isArray(parsed.unlocked) ? parsed.unlocked : ['monarch'],
                selected: parsed.selected || 'monarch',
                pending: parsed.pending || null,
                highScore: Math.max(0, Math.floor(Number(parsed.highScore) || 0)),
                discoveredBiomes: Array.isArray(parsed.discoveredBiomes) ? parsed.discoveredBiomes : ['moonleaf']
            };
        } catch (error) {
            return { unlocked: ['monarch'], selected: 'monarch', pending: null, highScore: 0, discoveredBiomes: ['moonleaf'] };
        }
    }

    function saveCollection() {
        collection.unlocked = [...new Set(collection.unlocked.filter((key) => SPECIES[key]))];
        if (!collection.unlocked.includes('monarch')) collection.unlocked.unshift('monarch');
        localStorage.setItem(COLLECTION_KEY, JSON.stringify(collection));
    }

    function getCoreSave() { return dbg()?.save?.(); }

    function persistCoreSave() {
        const save = getCoreSave();
        if (!save) return;
        localStorage.setItem(SAVE_KEY, JSON.stringify(save));
        dbg()?.setPollen?.(save.pollen || 0);
    }

    function syncCollectionToCore() {
        const save = getCoreSave();
        if (!save) return;
        for (const key of collection.unlocked) {
            if (!save.unlocked.includes(key)) save.unlocked.push(key);
        }
        if (collection.selected && collection.unlocked.includes(collection.selected)) save.selected = collection.selected;
        persistCoreSave();
    }

    function syncCoreToCollection() {
        const save = getCoreSave();
        if (!save) return;
        for (const key of save.unlocked || []) {
            if (SPECIES[key] && !collection.unlocked.includes(key)) collection.unlocked.push(key);
        }
        if (SPECIES[save.selected]) collection.selected = save.selected;
        saveCollection();
    }

    function setStatus(text) {
        const status = adminStatus();
        if (status) status.textContent = text;
    }

    function addDiscovered(key) {
        if (!collection.discoveredBiomes.includes(key)) {
            collection.discoveredBiomes.push(key);
            saveCollection();
        }
    }

    function ensureLayer() {
        if (layer || !app() || !window.PIXI) return !!layer;
        layer = new PIXI.Container();
        layer.eventMode = 'none';
        graphics = new PIXI.Graphics();
        layer.addChild(graphics);
        app().stage.addChild(layer);
        return true;
    }

    function worldPointFromScreen(x, y) {
        const world = player()?.parent?.parent;
        return { x: (x - (world?.x || 0)) / VIEW_ZOOM, y: (y - (world?.y || 0)) / VIEW_ZOOM };
    }

    function screenPoint(display) {
        if (!display?.getGlobalPosition) return null;
        const point = display.getGlobalPosition();
        return { x: point.x, y: point.y };
    }

    function screenFromWorld(x, y) {
        const world = player()?.parent?.parent;
        return { x: (world?.x || 0) + x * VIEW_ZOOM, y: (world?.y || 0) + y * VIEW_ZOOM };
    }

    function getArena() {
        const width = (app()?.screen.width || 1280) / VIEW_ZOOM;
        const height = (app()?.screen.height || 720) / VIEW_ZOOM;
        const marginX = Math.min(84 / VIEW_ZOOM, width * 0.115);
        const top = Math.min(104 / VIEW_ZOOM, height * 0.18);
        const bottomMargin = Math.min(58 / VIEW_ZOOM, height * 0.12);
        return { left: marginX, right: width - marginX, top, bottom: height - bottomMargin, centerX: width / 2, centerY: (top + height - bottomMargin) / 2 };
    }

    function walk(container, visitor) {
        if (!container?.children) return;
        for (const child of container.children) {
            visitor(child);
            if (child.children) walk(child, visitor);
        }
    }

    function createUi() {
        if (!document.getElementById('albumButton')) {
            const utility = document.getElementById('utilityControls');
            const albumButton = document.createElement('button');
            albumButton.id = 'albumButton';
            albumButton.className = 'utility-button';
            albumButton.type = 'button';
            albumButton.textContent = 'Album';
            albumButton.addEventListener('click', openAlbum);
            utility?.prepend(albumButton);
        }
        if (!document.getElementById('resetProgressButton')) {
            const resetButton = document.createElement('button');
            resetButton.id = 'resetProgressButton';
            resetButton.type = 'button';
            resetButton.textContent = 'Reset progress';
            resetButton.addEventListener('click', resetProgress);
            document.getElementById('adminControls')?.insertBefore(resetButton, adminStatus());
        }
        if (!highHud) {
            highHud = document.createElement('div');
            highHud.className = 'hud-card';
            highHud.innerHTML = 'High score <strong id="highScoreValue">0</strong>';
            document.getElementById('hud')?.appendChild(highHud);
        }
        if (!highLobby) {
            highLobby = document.createElement('div');
            highLobby.className = 'lobby-pill';
            highLobby.innerHTML = 'High score <strong id="lobbyHighScoreValue">0</strong>';
            const lobby = document.getElementById('lobbyHud');
            lobby?.insertBefore(highLobby, document.getElementById('playButton'));
        }
        if (!highResult) {
            highResult = document.createElement('div');
            highResult.innerHTML = '<span>High score</span><strong id="finalHighScore">0</strong>';
            document.querySelector('.result-grid')?.appendChild(highResult);
        }
        createAlbum();
        injectStyles();
    }

    function injectStyles() {
        if (document.getElementById('collectionStyles')) return;
        const style = document.createElement('style');
        style.id = 'collectionStyles';
        style.textContent = `
            .album-panel { position:absolute; z-index:10; inset:50% auto auto 50%; transform:translate(-50%,-50%); width:min(900px,calc(100vw - 34px)); max-height:min(680px,calc(100vh - 34px)); display:grid; grid-template-columns:52px 1fr 52px; gap:12px; align-items:stretch; pointer-events:auto; }
            .album-book { overflow:auto; padding:22px; border:1px solid rgba(255,255,255,.22); border-radius:8px; background:linear-gradient(90deg,rgba(21,14,36,.92),rgba(8,14,34,.9)); box-shadow:0 26px 80px rgba(0,0,0,.58), inset 0 0 70px rgba(255,214,107,.06); backdrop-filter:blur(20px) saturate(145%); }
            .album-book h2 { margin:0 0 14px; font-size:1.35rem; letter-spacing:0; }
            .album-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:10px; }
            .album-item { min-height:98px; padding:12px; border:1px solid rgba(122,247,255,.18); border-radius:8px; background:rgba(255,255,255,.07); color:var(--ink); text-align:left; }
            .album-item strong { display:block; margin-bottom:5px; color:var(--gold); }
            .album-item em { display:block; color:var(--muted); font-style:normal; font-size:.84rem; line-height:1.35; }
            .album-detail { margin-top:14px; padding:12px; border:1px solid rgba(255,214,107,.22); border-radius:8px; background:rgba(255,214,107,.08); color:var(--muted); line-height:1.45; }
            .album-arrow, .album-close { border:0; border-radius:8px; background:rgba(6,10,24,.72); color:var(--ink); font-size:2rem; font-weight:900; box-shadow:0 16px 44px rgba(0,0,0,.36); }
            .album-close { position:absolute; top:10px; right:10px; width:42px; height:42px; font-size:1.2rem; }
            .album-page-label { color:var(--teal); font-size:.78rem; font-weight:900; letter-spacing:.12em; text-transform:uppercase; }
            @media (max-width:760px){ .album-panel{ grid-template-columns:38px 1fr 38px; gap:6px; } .album-book{ padding:16px; } .album-arrow{ font-size:1.3rem; } }
        `;
        document.head.appendChild(style);
    }

    function createAlbum() {
        if (album) return;
        album = document.createElement('section');
        album.className = 'album-panel';
        album.hidden = true;
        album.innerHTML = `
            <button class="album-arrow" type="button" aria-label="Previous page">‹</button>
            <div class="album-book">
                <button class="album-close" type="button" aria-label="Close album">X</button>
                <p class="album-page-label">Album</p>
                <h2 id="albumTitle"></h2>
                <div id="albumBody"></div>
            </div>
            <button class="album-arrow" type="button" aria-label="Next page">›</button>
        `;
        document.getElementById('gameShell')?.appendChild(album);
        albumTitle = album.querySelector('#albumTitle');
        albumBody = album.querySelector('#albumBody');
        const arrows = album.querySelectorAll('.album-arrow');
        arrows[0].addEventListener('click', () => switchAlbumPage(-1));
        arrows[1].addEventListener('click', () => switchAlbumPage(1));
        album.querySelector('.album-close').addEventListener('click', () => { album.hidden = true; });
    }

    function openAlbum() {
        createAlbum();
        state.albumPage = 0;
        state.selectedInfo = null;
        renderAlbum();
        album.hidden = false;
    }

    function switchAlbumPage(delta) {
        state.albumPage = (state.albumPage + delta + 3) % 3;
        state.selectedInfo = null;
        renderAlbum();
    }

    function renderAlbum() {
        const pages = ['Butterflies Collected', 'Moths Collected', 'Discovered Biomes'];
        albumTitle.textContent = pages[state.albumPage];
        let entries;
        if (state.albumPage === 0) entries = collection.unlocked.filter((key) => SPECIES[key]?.kind === 'butterfly');
        else if (state.albumPage === 1) entries = collection.unlocked.filter((key) => SPECIES[key]?.kind === 'moth');
        else entries = collection.discoveredBiomes.filter((key) => ALL_BIOMES[key]);
        albumBody.innerHTML = `<div class="album-grid"></div><div class="album-detail" hidden></div>`;
        const grid = albumBody.querySelector('.album-grid');
        const detail = albumBody.querySelector('.album-detail');
        if (entries.length === 0) {
            grid.innerHTML = '<div class="album-item"><strong>Nothing yet</strong><em>Keep collecting and discovering.</em></div>';
            return;
        }
        for (const key of entries) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'album-item';
            if (state.albumPage < 2) {
                const species = SPECIES[key];
                button.innerHTML = `<strong>${species.name}</strong><em>${species.ability}. Cooldown: ${species.cooldown}s.</em>`;
                button.addEventListener('click', () => {
                    detail.hidden = false;
                    detail.innerHTML = `<strong>${species.name}</strong><br>Ability: ${species.ability}.<br>${species.facts}`;
                });
            } else {
                const biome = ALL_BIOMES[key];
                button.innerHTML = `<strong>${biome.name}</strong><em>${biome.hazard}</em>`;
                button.addEventListener('click', () => {
                    detail.hidden = false;
                    detail.innerHTML = `<strong>${biome.name}</strong><br>Hazards: ${biome.hazard}`;
                });
            }
            grid.appendChild(button);
        }
    }

    function resetProgress() {
        localStorage.setItem(SAVE_KEY, JSON.stringify({ pollen: 0, unlocked: ['monarch'], selected: 'monarch', summon: null }));
        collection = { unlocked: ['monarch'], selected: 'monarch', pending: null, highScore: 0, discoveredBiomes: ['moonleaf'] };
        saveCollection();
        setStatus('Progress reset. Reloading...');
        window.setTimeout(() => window.location.reload(), 250);
    }

    function updateHighScore() {
        const score = Math.floor(gs()?.score || 0);
        if (score > collection.highScore) {
            collection.highScore = score;
            saveCollection();
        }
        const value = String(collection.highScore);
        const ids = ['highScoreValue', 'lobbyHighScoreValue', 'finalHighScore'];
        for (const id of ids) {
            const node = document.getElementById(id);
            if (node) node.textContent = value;
        }
    }

    function coreCandidatesLeft() {
        const unlocked = getCoreSave()?.unlocked || [];
        return ['cabbage', 'rosy'].some((key) => !unlocked.includes(key));
    }

    function extendedCandidates() {
        return EXTENDED_POOL.filter((key) => !collection.unlocked.includes(key));
    }

    function hookSummon() {
        if (summonHooked) return;
        summonHooked = true;
        const summonButton = document.getElementById('summonButton');
        summonButton?.addEventListener('click', (event) => {
            if (coreCandidatesLeft()) return;
            const candidates = extendedCandidates();
            if (collection.pending || candidates.length > 0) {
                event.preventDefault();
                event.stopImmediatePropagation();
                startExtendedSummon();
            }
        }, true);
        const instant = document.getElementById('instantHatchButton');
        instant?.addEventListener('click', () => {
            if (collection.pending || extendedCandidates().length > 0) hatchExtended(true);
        });
        const cooldown = document.getElementById('resetAbilityCooldownButton');
        cooldown?.addEventListener('click', () => {
            state.cooldown = 0;
            window.nocturneAbilitiesDebug?.resetCooldown?.();
            setStatus('Ability cooldown removed.');
        });
    }

    function startExtendedSummon() {
        const save = getCoreSave();
        const status = document.getElementById('summonStatus');
        if (!save) return;
        if (collection.pending) {
            showPendingStatus();
            return;
        }
        const candidates = extendedCandidates();
        if (!candidates.length) {
            if (status) { status.hidden = false; status.textContent = 'All current summon species have hatched.'; }
            return;
        }
        if ((save.pollen || 0) < SUMMON_COST) {
            if (status) { status.hidden = false; status.textContent = `Need ${SUMMON_COST - (save.pollen || 0)} more pollen.`; }
            return;
        }
        const species = candidates[Math.floor(Math.random() * candidates.length)];
        save.pollen -= SUMMON_COST;
        collection.pending = { species, hatchAt: Date.now() + SUMMON_TIME };
        persistCoreSave();
        saveCollection();
        showPendingStatus();
    }

    function showPendingStatus() {
        const status = document.getElementById('summonStatus');
        if (!status || !collection.pending) return;
        const seconds = Math.max(0, Math.ceil((collection.pending.hatchAt - Date.now()) / 1000));
        status.hidden = false;
        status.textContent = `Rare pupae hatches in ${seconds}s.`;
    }

    function hatchExtended(force = false) {
        if (!collection.pending) {
            const candidates = extendedCandidates();
            if (!force || !candidates.length) return false;
            collection.pending = { species: candidates[Math.floor(Math.random() * candidates.length)], hatchAt: Date.now() - 1 };
        }
        if (!force && Date.now() < collection.pending.hatchAt) return false;
        const species = collection.pending.species;
        if (!collection.unlocked.includes(species)) collection.unlocked.push(species);
        collection.pending = null;
        saveCollection();
        syncCollectionToCore();
        const status = document.getElementById('summonStatus');
        if (status) { status.hidden = false; status.textContent = `${SPECIES[species].name} hatched! Re-enter the lobby to see it fly.`; }
        setStatus(`${SPECIES[species].name} hatched.`);
        renderAlbumIfOpen();
        return true;
    }

    function renderAlbumIfOpen() {
        if (album && !album.hidden) renderAlbum();
    }

    function currentSpecies() {
        return player()?.species || getCoreSave()?.selected || collection.selected || 'monarch';
    }

    function abilityFor(key) {
        return SPECIES[key] || SPECIES.monarch;
    }

    function updateAbilityHud() {
        const abilityValue = document.getElementById('abilityValue');
        if (!abilityValue) return;
        const key = currentSpecies();
        if (!EXTENDED_POOL.includes(key)) return;
        if (state.activeAbility === 'peacock' && state.abilityTime > 0) abilityValue.textContent = `Eye ${Math.ceil(state.abilityTime)}s`;
        else if (state.activeAbility === 'silverY' && state.abilityTime > 0) abilityValue.textContent = `Slow ${Math.ceil(state.abilityTime)}s`;
        else if (state.activeAbility === 'redAdmiral' && state.abilityTime > 0) abilityValue.textContent = 'Red dash';
        else if (state.activeAbility === 'atlas' && state.abilityTime > 0) abilityValue.textContent = `Wall ${Math.ceil(state.abilityTime)}s`;
        else if (state.cooldown > 0) abilityValue.textContent = `${Math.ceil(state.cooldown)}s`;
        else abilityValue.textContent = abilityFor(key).ability;
        abilityValue.dataset.ready = state.cooldown <= 0 ? 'true' : 'false';
    }

    function useExtendedAbility(event) {
        const key = currentSpecies();
        if (!EXTENDED_POOL.includes(key)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        const s = gs();
        const ply = player();
        if (!s || s.mode !== 'playing' || !ply) return;
        if (state.cooldown > 0) {
            setStatus(`Ability ready in ${Math.ceil(state.cooldown)}s.`);
            return;
        }
        const data = abilityFor(key);
        state.cooldown = data.cooldown;
        state.activeAbility = key;
        if (key === 'peacock') {
            state.abilityTime = 3;
            state.hazardFreeze = 3;
            s.invulnerable = Math.max(s.invulnerable, 3.1);
            setStatus('Eye Flash froze hazards.');
        } else if (key === 'silverY') {
            state.abilityTime = 5;
            state.hazardSlow = 0.5;
            setStatus('Silver Y slowed hazards.');
        } else if (key === 'redAdmiral') {
            state.abilityTime = 0.62;
            const angle = ply.rotation - Math.PI / 2;
            s.velocity.x = Math.cos(angle) * 1180;
            s.velocity.y = Math.sin(angle) * 1180;
            s.invulnerable = Math.max(s.invulnerable, 0.72);
            state.windTime = 0.78;
            setStatus('Red Admiral wind dash.');
        } else if (key === 'atlas') {
            state.abilityTime = 5;
            state.wallTime = 5;
            state.wallX = ply.x;
            state.wallY = ply.y;
            state.wallAngle = ply.rotation - Math.PI / 2;
            setStatus('Atlas wall created.');
        }
        updateAbilityHud();
    }

    function forceCollectionBiome(name) {
        if (!['volcano', 'ice'].includes(name)) return;
        window.nocturneAbilitiesDebug?.clearForcedExtra?.();
        const s = gs();
        if (!s || s.mode !== 'playing') dbg()?.forceBiome?.(0);
        state.customBiome = name;
        state.forcedBiome = name;
        state.hazards.length = 0;
        state.spawnTimer = name === 'volcano' ? 0.8 : 0.7;
        addDiscovered(name);
        const biomeValue = document.getElementById('biomeValue');
        if (biomeValue) biomeValue.textContent = ALL_BIOMES[name].name;
        setStatus(`${ALL_BIOMES[name].name} active.`);
    }

    function clearCollectionBiome() {
        state.customBiome = null;
        state.forcedBiome = null;
        state.hazards.length = 0;
    }

    function updateBiomeCycle(dt) {
        const s = gs();
        if (!s) return;
        if (state.lastMode !== s.mode) {
            if (s.mode === 'playing') {
                state.runClock = 0;
                state.segment = -1;
                state.forcedBiome = null;
                clearCollectionBiome();
            }
            state.lastMode = s.mode;
        }
        if (s.mode !== 'playing') return;
        state.runClock += dt;
        const oldExtra = window.nocturneAbilitiesDebug?.active?.customBiome;
        if (oldExtra === 'volcano' || oldExtra === 'ice') {
            window.nocturneAbilitiesDebug?.clearForcedExtra?.();
            if (state.customBiome !== oldExtra) forceCollectionBiome(oldExtra);
        }
        if (state.forcedBiome) return;
        const segment = Math.floor(state.runClock / 30) % 5;
        if (segment === state.segment) return;
        state.segment = segment;
        if (segment === 3) forceCollectionBiome('volcano');
        else if (segment === 4) forceCollectionBiome('ice');
        else {
            clearCollectionBiome();
            dbg()?.forceBiome?.(segment);
            const keys = ['moonleaf', 'amber', 'sky'];
            addDiscovered(keys[segment]);
        }
    }

    function spawnLavaBeam() {
        const width = app()?.screen.width || 1280;
        const height = app()?.screen.height || 720;
        state.hazards.push({ type: 'lava', x: 130 + Math.random() * Math.max(240, width - 260), width: 110 + Math.random() * 70, height, time: 0, warning: 2.2, rise: 0.52, hold: 2.4, fade: 0.5 });
    }

    function spawnIceSpike() {
        const width = app()?.screen.width || 1280;
        const height = app()?.screen.height || 720;
        state.hazards.push({ type: 'ice', side: Math.random() > 0.5 ? 'top' : 'bottom', x: 90 + Math.random() * Math.max(180, width - 180), width: 150 + Math.random() * 70, height: 245 + Math.random() * 115, screenHeight: height, time: 0, warning: 3, attack: 0.58, hold: 0.9 });
    }

    function damage(color) {
        const s = gs();
        if (!s || s.mode !== 'playing' || s.invulnerable > 0 || state.wallTime > 0) return;
        s.health -= 1;
        s.invulnerable = 1.05;
        const health = document.getElementById('healthValue');
        if (health) health.textContent = String(Math.max(0, s.health));
        state.ghosts.push({ ring: true, color, life: 0.7, maxLife: 0.7, radius: 80, ...screenPoint(player()) });
        if (s.health <= 0) {
            s.mode = 'gameOver';
            document.getElementById('gameOverScreen').hidden = false;
        }
    }

    function updateCustomHazards(dt) {
        if (!state.customBiome) return;
        addDiscovered(state.customBiome);
        state.spawnTimer -= dt * (state.hazardFreeze > 0 ? 0 : state.hazardSlow);
        if (state.spawnTimer <= 0) {
            if (state.customBiome === 'volcano') {
                spawnLavaBeam();
                state.spawnTimer = 3.0 + Math.random() * 1.0;
            } else {
                spawnIceSpike();
                state.spawnTimer = 1.7 + Math.random() * 0.75;
            }
        }
        const p = screenPoint(player());
        for (let i = state.hazards.length - 1; i >= 0; i -= 1) {
            const hazard = state.hazards[i];
            if (state.hazardFreeze <= 0) hazard.time += dt * state.hazardSlow;
            if (hazard.type === 'lava') {
                const start = hazard.warning;
                const end = hazard.warning + hazard.rise + hazard.hold + hazard.fade;
                if (hazard.time > end) state.hazards.splice(i, 1);
                if (p && hazard.time > start && hazard.time < end - hazard.fade && Math.abs(p.x - hazard.x) < hazard.width / 2 && p.y > 0) damage(0xff5b21);
            } else if (hazard.type === 'ice') {
                const end = hazard.warning + hazard.attack + hazard.hold;
                if (hazard.time > end) state.hazards.splice(i, 1);
                if (p && hazard.time > hazard.warning + hazard.attack * 0.65 && hazard.time < end) {
                    const top = hazard.side === 'top';
                    const activeHeight = hazard.height;
                    const horizontal = Math.abs(p.x - hazard.x) < hazard.width / 2;
                    const vertical = top ? p.y < activeHeight : p.y > hazard.screenHeight - activeHeight;
                    if (horizontal && vertical) damage(0xbff6ff);
                }
            }
        }
    }

    function drawTriangle(g, x, width, height, side, screenHeight, color, alpha) {
        g.beginFill(color, alpha);
        if (side === 'top') g.drawPolygon([x - width / 2, 0, x + width / 2, 0, x, height]);
        else g.drawPolygon([x - width / 2, screenHeight, x + width / 2, screenHeight, x, screenHeight - height]);
        g.endFill();
    }

    function drawCollectionLayer(dt, now) {
        if (!ensureLayer() || !graphics) return;
        const width = app()?.screen.width || 1280;
        const height = app()?.screen.height || 720;
        graphics.clear();
        if (state.customBiome === 'volcano') {
            graphics.beginFill(0x16070a, 0.97); graphics.drawRect(0, 0, width, height); graphics.endFill();
            graphics.beginFill(0x3f1511, 0.78); graphics.drawPolygon([0, height, width * 0.2, height * 0.56, width * 0.42, height, width * 0.62, height * 0.5, width * 0.88, height, width, height * 0.62, width, height]); graphics.endFill();
            graphics.beginFill(0xff5b21, 0.32 + Math.sin(now * 1.3) * 0.08); graphics.drawEllipse(width * 0.5, height * 0.89, width * 0.42, height * 0.15); graphics.endFill();
        } else if (state.customBiome === 'ice') {
            graphics.beginFill(0x07182f, 0.97); graphics.drawRect(0, 0, width, height); graphics.endFill();
            graphics.beginFill(0x8be8ff, 0.12); graphics.drawEllipse(width * 0.25, height * 0.22, width * 0.28, height * 0.18); graphics.drawEllipse(width * 0.75, height * 0.68, width * 0.34, height * 0.22); graphics.endFill();
            for (let i = 0; i < 16; i += 1) { graphics.lineStyle(1, 0xdffcff, 0.18); graphics.moveTo((i * 101) % width - 50, (i * 55) % height + 20); graphics.lineTo((i * 101) % width + 80, (i * 55) % height - 26); }
        }
        for (const hazard of state.hazards) {
            if (hazard.type === 'lava') {
                if (hazard.time < hazard.warning) {
                    graphics.beginFill(0xff2b1f, 0.3 + Math.sin(now * 12) * 0.07); graphics.drawRoundedRect(hazard.x - hazard.width / 2, 0, hazard.width, height, 24); graphics.endFill();
                    graphics.lineStyle(3, 0xffc06a, 0.55); graphics.moveTo(hazard.x, 0); graphics.lineTo(hazard.x, height);
                } else {
                    const t = Math.min(1, (hazard.time - hazard.warning) / hazard.rise);
                    const beamHeight = height * t;
                    const top = height - beamHeight;
                    graphics.beginFill(0xff3b1f, 0.9); graphics.drawRoundedRect(hazard.x - hazard.width / 2, top, hazard.width, beamHeight, 24); graphics.endFill();
                    graphics.beginFill(0xffd166, 0.58); graphics.drawRoundedRect(hazard.x - hazard.width * 0.23, top, hazard.width * 0.46, beamHeight, 18); graphics.endFill();
                }
            } else if (hazard.type === 'ice') {
                if (hazard.time < hazard.warning) drawTriangle(graphics, hazard.x, hazard.width, hazard.height, hazard.side, height, 0x9beaff, 0.24 + Math.sin(now * 9) * 0.06);
                else {
                    const t = Math.min(1, (hazard.time - hazard.warning) / hazard.attack);
                    drawTriangle(graphics, hazard.x, hazard.width, hazard.height * (t * t * (3 - 2 * t)), hazard.side, height, 0xbff6ff, 0.92);
                }
            }
        }
        drawSpeciesOverlays(now);
        drawAbilityEffects(dt, now);
    }

    function drawSpeciesOverlays(now) {
        walk(app()?.stage, (node) => {
            if (!node?.species || !EXTENDED_POOL.includes(node.species)) return;
            const p = screenPoint(node);
            if (!p) return;
            if (node.species === 'peacock') {
                graphics.beginFill(0x2f7dff, 0.18); graphics.drawCircle(p.x - 23, p.y - 4, 17); graphics.drawCircle(p.x + 23, p.y - 4, 17); graphics.endFill();
                graphics.beginFill(0x0a1030, 0.85); graphics.drawCircle(p.x - 23, p.y - 4, 8); graphics.drawCircle(p.x + 23, p.y - 4, 8); graphics.endFill();
                graphics.beginFill(0x85e8ff, 0.9); graphics.drawCircle(p.x - 23, p.y - 4, 3); graphics.drawCircle(p.x + 23, p.y - 4, 3); graphics.endFill();
            } else if (node.species === 'silverY') {
                graphics.lineStyle(4, 0xeef8ff, 0.9); graphics.moveTo(p.x - 10, p.y - 18); graphics.lineTo(p.x, p.y); graphics.lineTo(p.x + 10, p.y - 18); graphics.moveTo(p.x, p.y); graphics.lineTo(p.x, p.y + 16);
            } else if (node.species === 'redAdmiral') {
                graphics.lineStyle(6, 0xff3349, 0.78); graphics.moveTo(p.x - 36, p.y - 12); graphics.lineTo(p.x - 8, p.y + 8); graphics.moveTo(p.x + 36, p.y - 12); graphics.lineTo(p.x + 8, p.y + 8);
            } else if (node.species === 'atlas') {
                graphics.beginFill(0xb86b31, 0.24); graphics.drawEllipse(p.x - 28, p.y, 42, 24); graphics.drawEllipse(p.x + 28, p.y, 42, 24); graphics.endFill();
                graphics.lineStyle(3, 0xffd48a, 0.65); graphics.drawEllipse(p.x - 28, p.y, 42, 24); graphics.drawEllipse(p.x + 28, p.y, 42, 24);
            }
        });
    }

    function drawAbilityEffects(dt, now) {
        const p = screenPoint(player());
        if (!p) return;
        if (state.activeAbility === 'peacock' && state.abilityTime > 0) {
            graphics.beginFill(0x2f7dff, 0.18); graphics.drawCircle(p.x, p.y, 120 + Math.sin(now * 8) * 8); graphics.endFill();
            graphics.beginFill(0x10173f, 0.88); graphics.drawCircle(p.x - 42, p.y, 23); graphics.drawCircle(p.x + 42, p.y, 23); graphics.endFill();
            graphics.beginFill(0x86f2ff, 0.92); graphics.drawCircle(p.x - 42, p.y, 8); graphics.drawCircle(p.x + 42, p.y, 8); graphics.endFill();
        }
        if (state.windTime > 0) {
            graphics.lineStyle(4, 0xff3349, 0.45); graphics.moveTo(p.x, p.y); graphics.lineTo(p.x + Math.cos(player().rotation - Math.PI / 2) * 150, p.y + Math.sin(player().rotation - Math.PI / 2) * 150);
            graphics.lineStyle(2, 0xffffff, 0.35); graphics.drawCircle(p.x + Math.cos(player().rotation - Math.PI / 2) * 90, p.y + Math.sin(player().rotation - Math.PI / 2) * 90, 34);
        }
        if (state.wallTime > 0) {
            const origin = screenFromWorld(state.wallX, state.wallY);
            const x = origin.x + Math.cos(state.wallAngle) * 92;
            const y = origin.y + Math.sin(state.wallAngle) * 92;
            graphics.lineStyle(14, 0xffd48a, 0.55); graphics.moveTo(x - Math.sin(state.wallAngle) * 88, y + Math.cos(state.wallAngle) * 88); graphics.lineTo(x + Math.sin(state.wallAngle) * 88, y - Math.cos(state.wallAngle) * 88);
            graphics.lineStyle(3, 0xffffff, 0.45); graphics.drawCircle(x, y, 76);
        }
        for (let i = state.ghosts.length - 1; i >= 0; i -= 1) {
            const ghost = state.ghosts[i];
            ghost.life -= dt;
            const t = Math.max(0, ghost.life / ghost.maxLife);
            graphics.lineStyle(2, ghost.color, t * 0.65); graphics.drawCircle(ghost.x, ghost.y, ghost.radius * (1.2 - t * 0.2));
            if (ghost.life <= 0) state.ghosts.splice(i, 1);
        }
    }

    function updateExtendedAbilities(dt) {
        state.cooldown = Math.max(0, state.cooldown - dt);
        state.abilityTime = Math.max(0, state.abilityTime - dt);
        state.hazardFreeze = Math.max(0, state.hazardFreeze - dt);
        state.windTime = Math.max(0, state.windTime - dt);
        state.wallTime = Math.max(0, state.wallTime - dt);
        state.hazardSlow = state.activeAbility === 'silverY' && state.abilityTime > 0 ? 0.5 : 1;
        if (state.abilityTime <= 0 && state.activeAbility) state.activeAbility = null;
        if (state.wallTime > 0) gs().invulnerable = Math.max(gs().invulnerable, 0.12);
        if (state.hazardFreeze > 0) gs().invulnerable = Math.max(gs().invulnerable, 0.12);
    }

    function loop(now) {
        const dt = Math.min((now - state.lastNow) / 1000, 0.05);
        state.lastNow = now;
        createUi();
        hookSummon();
        syncCoreToCollection();
        syncCollectionToCore();
        hatchExtended(false);
        if (collection.pending) showPendingStatus();
        updateHighScore();
        updateBiomeCycle(dt);
        updateExtendedAbilities(dt);
        updateCustomHazards(dt);
        drawCollectionLayer(dt, now / 1000);
        updateAbilityHud();
        if (state.customBiome) {
            const biomeValue = document.getElementById('biomeValue');
            if (biomeValue) biomeValue.textContent = ALL_BIOMES[state.customBiome].name;
        }
        requestAnimationFrame(loop);
    }

    window.addEventListener('keydown', (event) => {
        if (event.key.toLowerCase() !== 'r' || event.repeat) return;
        const tag = document.activeElement?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        useExtendedAbility(event);
    }, true);

    document.addEventListener('click', (event) => {
        const extra = event.target?.dataset?.extraBiome;
        if (extra) {
            event.preventDefault();
            event.stopImmediatePropagation();
            forceCollectionBiome(extra);
        }
        if (event.target?.dataset?.biomeIndex !== undefined) clearCollectionBiome();
    }, true);

    window.nocturneCollectionDebug = {
        get collection() { return collection; },
        unlock(key) { if (SPECIES[key] && !collection.unlocked.includes(key)) { collection.unlocked.push(key); saveCollection(); syncCollectionToCore(); } },
        resetProgress,
        forceBiome: forceCollectionBiome,
        get active() { return { customBiome: state.customBiome, hazards: state.hazards.length, cooldown: state.cooldown, ability: state.activeAbility, highScore: collection.highScore }; }
    };

    requestAnimationFrame(loop);
})();
