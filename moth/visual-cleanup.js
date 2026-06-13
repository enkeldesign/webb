(() => {
    'use strict';

    const CURRENT_KEYS = new Set(['monarch', 'cabbage', 'rosy']);
    const SUPPRESSED = '__nocturne_suppressed__';

    function app() { return window.nocturnePixiApp; }

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
        node.alpha = 0.001;
    }

    function isHidden(node) {
        return node?.worldVisible === false || node?.visible === false || node?.parent?.visible === false;
    }

    function cleanup() {
        const application = app();
        if (!application) { requestAnimationFrame(cleanup); return; }

        walk(application.stage, (node) => {
            const species = actualSpecies(node);
            if (!CURRENT_KEYS.has(species)) return;
            if (isHidden(node)) suppress(node);
            else restore(node);
        });

        requestAnimationFrame(cleanup);
    }

    requestAnimationFrame(cleanup);
})();
