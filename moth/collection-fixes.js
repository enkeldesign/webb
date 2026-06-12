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
        const key = selectedKey();
        const name = SPECIES[key];
        if (name) {
            const selectedValue = document.getElementById('selectedValue');
            if (selectedValue) selectedValue.textContent = name;
        }
        requestAnimationFrame(syncSpeciesLabels);
    }

    requestAnimationFrame(syncSpeciesLabels);
})();
