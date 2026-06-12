(() => {
    'use strict';

    const biomeNames = {
        volcano: 'Volcano Caldera',
        ice: 'Crystal Icefield'
    };
    const biomeValue = document.getElementById('biomeValue');

    function tick() {
        const active = window.nocturneAbilitiesDebug?.active;
        const biome = active?.customBiome;
        if (biome && biomeNames[biome] && biomeValue) biomeValue.textContent = biomeNames[biome];
        requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
})();
