(() => {
    'use strict';

    const SPECIES = {
        monarch: 'Monarch',
        cabbage: 'Cabbage White',
        peacock: 'Peacock Butterfly',
        redAdmiral: 'Red Admiral',
        rosy: 'Rosy Maple Moth',
        silverY: 'Silver Y Moth',
        atlas: 'Atlas Moth'
    };

    function selectedKey() {
        const save = window.nocturneWingsDebug?.save?.();
        const collection = window.nocturneCollectionDebug?.collection;
        return save?.selected || collection?.selected || 'monarch';
    }

    function syncSpeciesLabels() {
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
