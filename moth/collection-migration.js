(() => {
    'use strict';

    const SAVE_KEY = 'nocturneWingsSaveV2';
    const COLLECTION_KEY = 'nocturneCollectionV1';
    const SPECIES = new Set(['monarch', 'cabbage', 'rosy', 'peacock', 'silverY', 'redAdmiral', 'atlas']);

    function read(key) {
        try {
            return JSON.parse(localStorage.getItem(key) || 'null') || {};
        } catch (error) {
            return {};
        }
    }

    function addKnown(target, value) {
        if (Array.isArray(value)) {
            for (const key of value) if (SPECIES.has(key)) target.add(key);
        } else if (SPECIES.has(value)) {
            target.add(value);
        }
    }

    const save = read(SAVE_KEY);
    const collection = read(COLLECTION_KEY);
    const unlocked = new Set(['monarch']);
    addKnown(unlocked, collection.unlocked);
    addKnown(unlocked, collection.owned);
    addKnown(unlocked, save.unlocked);
    addKnown(unlocked, save.owned);
    addKnown(unlocked, save.characters);
    addKnown(unlocked, collection.selected);
    addKnown(unlocked, save.selected);

    const selected = SPECIES.has(collection.selected) && unlocked.has(collection.selected)
        ? collection.selected
        : SPECIES.has(save.selected) && unlocked.has(save.selected)
            ? save.selected
            : 'monarch';

    const migrated = {
        unlocked: [...unlocked],
        selected,
        pending: collection.pending || null,
        highScore: Math.max(0, Math.floor(Number(collection.highScore || save.highScore || save.highestScore) || 0)),
        discoveredBiomes: Array.isArray(collection.discoveredBiomes) && collection.discoveredBiomes.length
            ? collection.discoveredBiomes
            : ['moonleaf']
    };

    localStorage.setItem(COLLECTION_KEY, JSON.stringify(migrated));
})();
