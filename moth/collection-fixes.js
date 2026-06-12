(() => {
    'use strict';

    const SAVE_KEY = 'nocturneWingsSaveV2';
    const COLLECTION_KEY = 'nocturneCollectionV1';
    const SPECIES = {
        monarch: { name: 'Monarch' },
        cabbage: { name: 'Cabbage White' },
        peacock: { name: 'Peacock Butterfly', wingA: 0x9b451c, wingB: 0xd88c28, rim: 0x1b1020, glow: 0x2f7dff, body: 0x171018, accent: 0x86f2ff, kind: 'butterfly' },
        redAdmiral: { name: 'Red Admiral', wingA: 0x191421, wingB: 0x2a2033, rim: 0xff3349, glow: 0xff5262, body: 0x151018, accent: 0xfff2d0, kind: 'butterfly' },
        rosy: { name: 'Rosy Maple Moth' },
        silverY: { name: 'Silver Y Moth', wingA: 0x706f7c, wingB: 0xb9bcc8, rim: 0xeef8ff, glow: 0xcfe9ff, body: 0x282633, accent: 0xffffff, kind: 'moth' },
        atlas: { name: 'Atlas Moth', wingA: 0xb86b31, wingB: 0xffb25d, rim: 0x5a2218, glow: 0xffd48a, body: 0x2b1710, accent: 0xfff0bc, kind: 'moth' }
    };
    const EXTRA_KEYS = ['peacock', 'silverY', 'redAdmiral', 'atlas'];

    const originalSetItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = (key, value) => {
        const stringValue = String(value);
        if ((key === SAVE_KEY || key === COLLECTION_KEY) && localStorage.getItem(key) === stringValue) return;
        originalSetItem(key, stringValue);
    };

    let preferredSelected = null;
    let setPollenWrapped = false;
    let resetHooked = false;
    let extraLayer = null;
    let extraKey = '';
    let lastNow = performance.now();

    function app() { return window.nocturnePixiApp; }
    function pixi() { return window.PIXI; }

    function storedCollection() {
        try {
            return JSON.parse(localStorage.getItem(COLLECTION_KEY) || 'null') || null;
        } catch (error) {
            return null;
        }
    }

    function saveStoredCollection(collection) {
        const next = collection || storedCollection() || {};
        next.unlocked = Array.isArray(next.unlocked) ? [...new Set(next.unlocked.filter((key) => SPECIES[key]))] : ['monarch'];
        if (!next.unlocked.includes('monarch')) next.unlocked.unshift('monarch');
        next.selected = SPECIES[next.selected] ? next.selected : 'monarch';
        next.pending = next.pending || null;
        next.highScore = Math.max(0, Math.floor(Number(next.highScore) || 0));
        next.discoveredBiomes = Array.isArray(next.discoveredBiomes) ? next.discoveredBiomes : ['moonleaf'];
        originalSetItem(COLLECTION_KEY, JSON.stringify(next));
        return next;
    }

    function applyPreferredSelection() {
        const debug = window.nocturneWingsDebug;
        const save = debug?.save?.();
        const collection = storedCollection();
        if (!save || !collection) return;
        const unlocked = Array.isArray(collection.unlocked) ? collection.unlocked.filter((key) => SPECIES[key]) : ['monarch'];
        if (!unlocked.includes('monarch')) unlocked.unshift('monarch');
        for (const key of unlocked) {
            if (!save.unlocked.includes(key)) save.unlocked.push(key);
        }
        if (SPECIES[collection.selected] && unlocked.includes(collection.selected)) {
            preferredSelected = collection.selected;
            save.selected = collection.selected;
        }
    }

    function hardResetProgress() {
        const resetSave = { pollen: 0, unlocked: ['monarch'], selected: 'monarch', summon: null };
        const resetCollection = { unlocked: ['monarch'], selected: 'monarch', pending: null, highScore: 0, discoveredBiomes: ['moonleaf'] };
        const liveSave = window.nocturneWingsDebug?.save?.();
        if (liveSave) {
            liveSave.pollen = 0;
            liveSave.unlocked = ['monarch'];
            liveSave.selected = 'monarch';
            liveSave.summon = null;
        }
        preferredSelected = 'monarch';
        originalSetItem(SAVE_KEY, JSON.stringify(resetSave));
        originalSetItem(COLLECTION_KEY, JSON.stringify(resetCollection));
        window.setTimeout(() => window.location.reload(), 100);
    }

    function installResetOverride() {
        const debug = window.nocturneCollectionDebug;
        if (debug && debug.resetProgress !== hardResetProgress) debug.resetProgress = hardResetProgress;
        const resetButton = document.getElementById('resetProgressButton');
        if (!resetButton || resetHooked) return;
        resetHooked = true;
        resetButton.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopImmediatePropagation();
            hardResetProgress();
        }, true);
    }

    function wrapSetPollen() {
        const debug = window.nocturneWingsDebug;
        if (!debug?.setPollen || setPollenWrapped) return;
        const original = debug.setPollen.bind(debug);
        let lastValue = null;
        debug.setPollen = (value) => {
            if (value === lastValue) return;
            lastValue = value;
            original(value);
        };
        setPollenWrapped = true;
    }

    function selectedKey() {
        const save = window.nocturneWingsDebug?.save?.();
        const collection = window.nocturneCollectionDebug?.collection;
        return save?.selected || preferredSelected || collection?.selected || 'monarch';
    }

    function setSelectedSpecies(key) {
        if (!SPECIES[key]) return;
        preferredSelected = key;
        const save = window.nocturneWingsDebug?.save?.();
        if (save) {
            if (!save.unlocked.includes(key)) save.unlocked.push(key);
            save.selected = key;
            originalSetItem(SAVE_KEY, JSON.stringify(save));
        }
        const liveCollection = window.nocturneCollectionDebug?.collection;
        if (liveCollection) {
            if (!liveCollection.unlocked.includes(key)) liveCollection.unlocked.push(key);
            liveCollection.selected = key;
            saveStoredCollection(liveCollection);
        } else {
            const stored = storedCollection() || { unlocked: ['monarch'], pending: null, highScore: 0, discoveredBiomes: ['moonleaf'] };
            if (!stored.unlocked.includes(key)) stored.unlocked.push(key);
            stored.selected = key;
            saveStoredCollection(stored);
        }
        updateSpeciesLabels();
        updateExtraSelectionRings();
    }

    function updateSpeciesLabels() {
        const key = selectedKey();
        const name = SPECIES[key]?.name;
        if (!name) return;
        const selectedValue = document.getElementById('selectedValue');
        if (selectedValue) selectedValue.textContent = name;
    }

    function ensureExtraLayer() {
        if (extraLayer || !app() || !pixi()) return !!extraLayer;
        extraLayer = new PIXI.Container();
        extraLayer.eventMode = 'passive';
        extraLayer.zIndex = 30;
        app().stage.sortableChildren = true;
        app().stage.addChild(extraLayer);
        return true;
    }

    function unlockedExtras() {
        const live = window.nocturneCollectionDebug?.collection;
        const stored = storedCollection();
        const unlocked = live?.unlocked || stored?.unlocked || [];
        return EXTRA_KEYS.filter((key) => unlocked.includes(key));
    }

    function makeWing(data, side) {
        const wing = new PIXI.Container();
        const g = new PIXI.Graphics();
        const moth = data.kind === 'moth';
        g.beginFill(data.wingA, 0.92);
        g.lineStyle(2, data.rim, 0.78);
        g.drawEllipse(side * 24, moth ? -2 : -9, moth ? 34 : 30, moth ? 35 : 42);
        g.endFill();
        g.beginFill(data.wingB, 0.62);
        g.drawEllipse(side * 18, moth ? 16 : 18, moth ? 26 : 21, moth ? 23 : 28);
        g.endFill();
        g.lineStyle(1.4, data.accent, 0.45);
        for (let i = 0; i < 4; i += 1) {
            const y = -24 + i * 15;
            g.moveTo(0, 0);
            g.quadraticCurveTo(side * 18, y * 0.4, side * (moth ? 47 : 42), y);
        }
        if (data === SPECIES.peacock) {
            g.beginFill(0x2f7dff, 0.42); g.drawCircle(side * 31, -12, 10); g.endFill();
            g.beginFill(0x0b1028, 0.86); g.drawCircle(side * 31, -12, 5); g.endFill();
            g.beginFill(0x86f2ff, 0.95); g.drawCircle(side * 31, -12, 2); g.endFill();
        } else if (data === SPECIES.redAdmiral) {
            g.lineStyle(6, 0xff3349, 0.88); g.moveTo(side * 9, -25); g.lineTo(side * 40, 4);
        } else if (data === SPECIES.silverY) {
            g.lineStyle(4, 0xf4fbff, 0.9); g.moveTo(side * 14, -17); g.lineTo(side * 24, -2); g.lineTo(side * 35, -17); g.moveTo(side * 24, -2); g.lineTo(side * 26, 16);
        } else if (data === SPECIES.atlas) {
            g.beginFill(0xfff0bc, 0.28); g.drawEllipse(side * 33, -18, 12, 9); g.endFill();
            g.lineStyle(3, 0x5a2218, 0.7); g.drawEllipse(side * 26, 2, 36, 34);
        }
        wing.addChild(g);
        return wing;
    }

    function makeExtraFlyer(key, index, total) {
        const data = SPECIES[key];
        const container = new PIXI.Container();
        container.species = key;
        container.eventMode = 'static';
        container.cursor = 'pointer';
        container.hitArea = new PIXI.Circle(0, 0, 70);
        container.phase = Math.random() * Math.PI * 2;
        container.vx = (index % 2 === 0 ? 1 : -1) * (28 + Math.random() * 24);
        container.vy = (index % 3 === 0 ? -1 : 1) * (16 + Math.random() * 18);
        const w = app().screen.width;
        const h = app().screen.height;
        const spacing = w / Math.max(total + 1, 2);
        container.x = spacing * (index + 1) + (Math.random() - 0.5) * 40;
        container.y = 120 + (index % 2) * 82 + Math.random() * Math.max(80, h * 0.26);

        const glow = new PIXI.Graphics();
        glow.beginFill(data.glow, 0.12); glow.drawCircle(0, 0, 66); glow.endFill();
        glow.blendMode = PIXI.BLEND_MODES.ADD;
        const ring = new PIXI.Graphics();
        ring.lineStyle(3, 0xffd66b, 0.85); ring.drawCircle(0, 0, 55);
        const leftWing = makeWing(data, -1);
        const rightWing = makeWing(data, 1);
        const body = new PIXI.Graphics();
        body.beginFill(data.body, 1); body.drawEllipse(0, 9, data.kind === 'moth' ? 7 : 5, 25); body.endFill();
        body.beginFill(data.accent, data.kind === 'moth' ? 0.36 : 0.22); body.drawEllipse(0, -9, 9, 13); body.endFill();
        body.beginFill(data.body, 1); body.drawCircle(0, -27, 7); body.endFill();
        body.lineStyle(1.7, data.accent, 0.7);
        body.moveTo(-3, -32); body.bezierCurveTo(-12, -45, -20, -38, -19, -31);
        body.moveTo(3, -32); body.bezierCurveTo(12, -45, 20, -38, 19, -31);
        container.addChild(glow, ring, leftWing, rightWing, body);
        container.glow = glow;
        container.ring = ring;
        container.leftWing = leftWing;
        container.rightWing = rightWing;
        container.body = body;
        container.scale.set(0.82);
        container.on('pointertap', () => setSelectedSpecies(key));
        return container;
    }

    function rebuildExtraLobby(keys) {
        if (!ensureExtraLayer()) return;
        extraLayer.removeChildren().forEach((child) => child.destroy({ children: true }));
        keys.forEach((key, index) => extraLayer.addChild(makeExtraFlyer(key, index, keys.length)));
        updateExtraSelectionRings();
    }

    function updateExtraSelectionRings() {
        if (!extraLayer) return;
        const selected = selectedKey();
        for (const child of extraLayer.children) {
            if (child.ring) child.ring.visible = child.species === selected;
        }
    }

    function updateExtraLobby(dt, now) {
        if (!ensureExtraLayer()) return;
        const mode = window.nocturneWingsDebug?.state?.mode;
        extraLayer.visible = mode === 'lobby';
        if (!extraLayer.visible) return;
        const keys = unlockedExtras();
        const key = `${keys.join(',')}|${selectedKey()}|${Math.round(app().screen.width)}x${Math.round(app().screen.height)}`;
        if (key !== extraKey) {
            extraKey = key;
            rebuildExtraLobby(keys);
        }
        const w = app().screen.width;
        const h = app().screen.height;
        for (const flyer of extraLayer.children) {
            flyer.phase += dt;
            flyer.x += flyer.vx * dt;
            flyer.y += flyer.vy * dt + Math.sin(flyer.phase * 1.35) * 8 * dt;
            if (flyer.x < 80 || flyer.x > w - 80) flyer.vx *= -1;
            if (flyer.y < 92 || flyer.y > h - 230) flyer.vy *= -1;
            const speed = Math.hypot(flyer.vx, flyer.vy);
            const target = Math.atan2(flyer.vy, flyer.vx) + Math.PI / 2;
            flyer.rotation += ((((target - flyer.rotation + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * 0.07);
            const flap = Math.sin(now * 3.4 + flyer.phase) * (flyer.species === 'silverY' || flyer.species === 'atlas' ? 0.11 : 0.15);
            flyer.leftWing.scale.x = 1 - flap;
            flyer.rightWing.scale.x = 1 + flap;
            flyer.leftWing.rotation = -0.06 - flap * 0.14;
            flyer.rightWing.rotation = 0.06 - flap * 0.14;
            flyer.body.rotation = Math.sin(now * 2.2 + flyer.phase) * 0.025;
            flyer.glow.alpha = 0.75 + Math.sin(now * 2 + flyer.phase) * 0.18;
            flyer.scale.set(0.82 + Math.sin(now * 1.5 + flyer.phase) * 0.018);
        }
        updateExtraSelectionRings();
    }

    function syncSpeciesLabels() {
        wrapSetPollen();
        applyPreferredSelection();
        installResetOverride();
        updateSpeciesLabels();
        const now = performance.now();
        updateExtraLobby(Math.min((now - lastNow) / 1000, 0.05), now / 1000);
        lastNow = now;
        requestAnimationFrame(syncSpeciesLabels);
    }

    window.nocturneLobbyExtrasDebug = {
        get count() { return extraLayer?.children?.length || 0; },
        get keys() { return extraLayer?.children?.map((child) => child.species) || []; },
        get positions() { return extraLayer?.children?.map((child) => ({ key: child.species, x: child.x, y: child.y })) || []; },
        select: setSelectedSpecies
    };

    wrapSetPollen();
    applyPreferredSelection();
    installResetOverride();
    requestAnimationFrame(syncSpeciesLabels);
})();
