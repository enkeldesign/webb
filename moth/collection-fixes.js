(() => {
    'use strict';

    const SAVE_KEY = 'nocturneWingsSaveV2';
    const COLLECTION_KEY = 'nocturneCollectionV1';
    const SPECIES = {
        monarch: 'Monarch',
        cabbage: 'Cabbage White',
        peacock: 'Peacock Butterfly',
        redAdmiral: 'Red Admiral',
        rosy: 'Rosy Maple Moth',
        silverY: 'Silver Y Moth',
        atlas: 'Atlas Moth'
    };

    const originalSetItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = (key, value) => {
        const stringValue = String(value);
        if ((key === SAVE_KEY || key === COLLECTION_KEY) && localStorage.getItem(key) === stringValue) return;
        originalSetItem(key, stringValue);
    };

    let preferredSelected = null;
    let setPollenWrapped = false;
    let resetHooked = false;

    function storedCollection() {
        try {
            return JSON.parse(localStorage.getItem(COLLECTION_KEY) || 'null') || null;
        } catch (error) {
            return null;
        }
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

    function syncSpeciesLabels() {
        wrapSetPollen();
        applyPreferredSelection();
        installResetOverride();
        const key = selectedKey();
        const name = SPECIES[key];
        if (name) {
            const selectedValue = document.getElementById('selectedValue');
            if (selectedValue) selectedValue.textContent = name;
        }
        requestAnimationFrame(syncSpeciesLabels);
    }

    wrapSetPollen();
    applyPreferredSelection();
    installResetOverride();
    requestAnimationFrame(syncSpeciesLabels);
})();
