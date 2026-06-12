(() => {
    'use strict';

    const EXTRA_KEYS = new Set(['peacock', 'silverY', 'redAdmiral', 'atlas']);
    const SUPPRESSED = '__nocturne_suppressed__';

    function app() { return window.nocturnePixiApp; }
    function mode() { return window.nocturneWingsDebug?.state?.mode; }

    function walk(container, visitor) {
        if (!container?.children) return;
        for (const child of container.children) {
            visitor(child);
            if (child.children) walk(child, visitor);
        }
    }

    function actualSpecies(node) {
        return node?._nocturneOriginalSpecies || node?.species;
    }

    function restore(node) {
        if (node?._nocturneOriginalSpecies) {
            node.species = node._nocturneOriginalSpecies;
            node._nocturneOriginalSpecies = null;
        }
    }

    function suppress(node) {
        if (!node || node.species === SUPPRESSED) return;
        node._nocturneOriginalSpecies = node.species;
        node.species = SUPPRESSED;
        node.alpha = 0.01;
    }

    function cleanup() {
        const application = app();
        if (!application) { requestAnimationFrame(cleanup); return; }
        const currentMode = mode();
        const nodes = [];
        walk(application.stage, (node) => {
            const species = actualSpecies(node);
            if (EXTRA_KEYS.has(species)) nodes.push(node);
        });

        if (currentMode === 'lobby') {
            const lobbyExtras = new Set(nodes.filter((node) => !node.radius).map(actualSpecies));
            for (const node of nodes) {
                const species = actualSpecies(node);
                if (!node.radius) restore(node);
                else if (lobbyExtras.has(species)) suppress(node);
                else restore(node);
            }
        } else {
            for (const node of nodes) {
                if (!node.radius) suppress(node);
                else restore(node);
            }
        }

        requestAnimationFrame(cleanup);
    }

    requestAnimationFrame(cleanup);
})();
