(() => {
    'use strict';

    const LAB_ID = 'proceduralLab';
    let lab = null;
    let previewApp = null;
    let selectedGenome = null;
    let selectedCreature = null;
    let examples = [];
    let renderSerial = 0;
    let lastNow = performance.now();

    function api() { return window.nocturneProcedural; }
    function byId(id) { return document.getElementById(id); }
    function randomSeed() { return Math.floor(Math.random() * 0xffffffff).toString(36); }

    function injectStyles() {
        if (byId('proceduralLabStyles')) return;
        const style = document.createElement('style');
        style.id = 'proceduralLabStyles';
        style.textContent = `
            .procedural-lab { position:absolute; z-index:12; inset:50% auto auto 50%; transform:translate(-50%,-50%); width:min(920px,calc(100vw - 28px)); max-height:min(760px,calc(100vh - 28px)); display:grid; grid-template-columns:minmax(280px,1fr) 280px; gap:14px; padding:14px; border:1px solid rgba(122,247,255,.24); border-radius:8px; background:linear-gradient(180deg,rgba(10,14,32,.92),rgba(5,7,19,.86)); box-shadow:0 28px 90px rgba(0,0,0,.58),0 0 54px rgba(122,247,255,.12); backdrop-filter:blur(18px) saturate(145%); }
            .procedural-lab[hidden] { display:none !important; }
            .procedural-preview { min-height:440px; border:1px solid rgba(255,255,255,.14); border-radius:8px; background:radial-gradient(circle at 50% 42%,rgba(122,247,255,.13),transparent 44%),rgba(255,255,255,.045); overflow:hidden; }
            .procedural-preview canvas { display:block; width:100%; height:100%; }
            .procedural-side { display:grid; grid-template-rows:auto auto auto 1fr auto; gap:10px; min-width:0; }
            .procedural-side h2 { margin:0; font-size:1.2rem; letter-spacing:0; }
            .procedural-seed-row { display:grid; gap:6px; }
            .procedural-seed-row label, .procedural-meta-title { color:var(--teal); font-size:.75rem; font-weight:900; letter-spacing:.12em; text-transform:uppercase; }
            .procedural-seed-row input { width:100%; min-width:0; padding:9px 10px; border:1px solid rgba(255,255,255,.17); border-radius:8px; background:rgba(255,255,255,.08); color:var(--ink); }
            .procedural-actions { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
            .procedural-actions button, .procedural-close { min-height:38px; border:0; border-radius:8px; background:linear-gradient(135deg,var(--gold),var(--coral)); color:#1e1020; font-weight:900; }
            .procedural-close { position:absolute; top:10px; right:10px; width:42px; padding:0; background:rgba(255,255,255,.12); color:var(--ink); border:1px solid rgba(255,255,255,.18); font-size:0; box-shadow:0 10px 28px rgba(0,0,0,.28); }
            .procedural-close::before { content:'X'; font-size:1rem; }
            .procedural-actions button:focus-visible, .procedural-close:focus-visible, .procedural-seed-row input:focus-visible { outline:3px solid var(--teal); outline-offset:3px; }
            .procedural-meta { overflow:auto; padding:10px; border:1px solid rgba(255,255,255,.14); border-radius:8px; background:rgba(255,255,255,.055); color:var(--muted); font-size:.82rem; line-height:1.45; }
            .procedural-meta code { color:var(--gold); }
            .procedural-status { min-height:1.2rem; margin:0; color:var(--muted); font-size:.82rem; line-height:1.35; }
            @media (max-width:760px){ .procedural-lab{ grid-template-columns:1fr; overflow:auto; } .procedural-preview{ min-height:340px; } .procedural-side{ grid-template-rows:auto; } }
        `;
        document.head.appendChild(style);
    }

    function ensureButton() {
        const controls = byId('adminControls');
        if (!controls || byId('proceduralLabButton')) return;
        const button = document.createElement('button');
        button.id = 'proceduralLabButton';
        button.type = 'button';
        button.textContent = 'Procedural Lab';
        button.addEventListener('click', openLab);
        controls.insertBefore(button, byId('adminStatus'));
    }

    function ensureLab() {
        if (lab) return lab;
        injectStyles();
        lab = document.createElement('section');
        lab.id = LAB_ID;
        lab.className = 'procedural-lab';
        lab.hidden = true;
        lab.setAttribute('aria-label', 'Procedural insect laboratory');
        lab.innerHTML = `
            <div id='proceduralPreview' class='procedural-preview' aria-hidden='true'></div>
            <div class='procedural-side'>
                <div>
                    <p class='procedural-meta-title'>Development preview</p>
                    <h2>Procedural Lab</h2>
                </div>
                <div class='procedural-seed-row'>
                    <label for='proceduralSeedInput'>Seed</label>
                    <input id='proceduralSeedInput' type='text' autocomplete='off' spellcheck='false'>
                </div>
                <div class='procedural-actions'>
                    <button id='proceduralNewButton' type='button'>New insect</button>
                    <button id='proceduralUseButton' type='button'>Use this insect</button>
                </div>
                <div id='proceduralMeta' class='procedural-meta' aria-live='polite'></div>
                <p id='proceduralStatus' class='procedural-status' aria-live='polite'></p>
                <button id='proceduralCloseButton' class='procedural-close' type='button'>Close</button>
            </div>
        `;
        byId('gameShell')?.appendChild(lab);
        byId('proceduralNewButton').addEventListener('click', () => renderSeed(randomSeed()));
        byId('proceduralUseButton').addEventListener('click', useSelected);
        byId('proceduralCloseButton').addEventListener('click', closeLab);
        byId('proceduralSeedInput').addEventListener('change', (event) => renderSeed(event.target.value || randomSeed()));
        return lab;
    }

    function ensurePreviewApp() {
        if (previewApp) return previewApp;
        const mount = byId('proceduralPreview');
        if (!mount || !window.PIXI) return null;
        const gameApp = window.nocturnePixiApp;
        previewApp = new PIXI.Application({ resizeTo: mount, backgroundAlpha: 0, antialias: true, autoDensity: true, resolution: Math.min(window.devicePixelRatio || 1, 2) });
        window.nocturnePixiApp = gameApp;
        mount.appendChild(previewApp.view);
        previewApp.ticker.add(tickPreview);
        return previewApp;
    }

    function setStatus(text) {
        const status = byId('proceduralStatus');
        if (status) status.textContent = text;
    }

    function metaHtml(genome) {
        const parts = [
            ['Kind', genome.kind],
            ['Upper wing', genome.upperWing],
            ['Lower wing', genome.lowerWing],
            ['Body', genome.body],
            ['Antennae', genome.antennae],
            ['Patterns', genome.patterns.join(', ') || 'none']
        ];
        return `<div><strong>Seed</strong> <code>${genome.seed}</code></div>` + parts.map(([label, value]) => `<div><strong>${label}</strong> <code>${value}</code></div>`).join('');
    }

    async function renderSeed(seedValue) {
        const procedural = api();
        if (!procedural) { setStatus('Procedural system is not loaded yet.'); return; }
        await procedural.ready;
        const input = byId('proceduralSeedInput');
        if (input) input.value = String(seedValue);
        const genome = procedural.createGenome(seedValue);
        selectedGenome = genome;
        const meta = byId('proceduralMeta');
        if (meta) meta.innerHTML = metaHtml(genome);
        const drawn = await drawPreview(genome);
        if (!drawn) return;
        const errors = procedural.errors;
        setStatus(errors.length ? `Fallback available. ${errors[0]}` : 'Generated insect ready. Same seed will recreate this genome.');
    }

    async function drawPreview(genome) {
        const serial = ++renderSerial;
        const papp = ensurePreviewApp();
        const procedural = api();
        if (!papp || !procedural) return false;
        const oldChildren = papp.stage.removeChildren();
        selectedCreature = null;
        examples = [];
        oldChildren.forEach((child) => child.destroy({ children: true }));
        const mainCreature = await procedural.createCreature(genome, { scale: 2.45 });
        if (serial !== renderSerial) { mainCreature.destroy({ children: true }); return false; }
        selectedCreature = mainCreature;
        selectedCreature.x = papp.screen.width * 0.5;
        selectedCreature.y = papp.screen.height * 0.44;
        papp.stage.addChild(selectedCreature);
        const seeds = [genome.seed + 101, genome.seed + 202, genome.seed + 303, genome.seed + 404];
        for (let i = 0; i < seeds.length; i += 1) {
            const smallGenome = procedural.createGenome(seeds[i]);
            const creature = await procedural.createCreature(smallGenome, { scale: 1.0 });
            if (serial !== renderSerial) { creature.destroy({ children: true }); return false; }
            creature.x = papp.screen.width * (0.18 + i * 0.215);
            creature.y = papp.screen.height * 0.82;
            creature.__labVelocity = { x: 120 + i * 30, y: 20 };
            papp.stage.addChild(creature);
            examples.push(creature);
        }
        return true;
    }

    async function openLab() {
        ensureLab();
        lab.hidden = false;
        await renderSeed(byId('proceduralSeedInput')?.value || randomSeed());
        byId('proceduralSeedInput')?.focus();
    }

    function closeLab() {
        if (lab) lab.hidden = true;
    }

    async function useSelected() {
        if (!selectedGenome || !api()) return;
        const result = await api().applyGenomeToPlayer(selectedGenome);
        setStatus(result.ok ? 'Applied to the current player appearance for this session. Start a run to see it in motion.' : result.reason);
    }

    function tickPreview() {
        const procedural = api();
        if (!procedural || !previewApp) return;
        const now = performance.now();
        const dt = Math.min((now - lastNow) / 1000, 0.05);
        lastNow = now;
        if (selectedCreature) {
            selectedCreature.rotation = Math.sin(now / 1300) * 0.16;
            procedural.updateCreature(selectedCreature, dt, { velocity: { x: 170, y: 20 }, acceleration: { x: 420, y: 80 }, thrust: 0.58, turn: Math.sin(now / 900) * 0.55 });
        }
        for (let i = 0; i < examples.length; i += 1) {
            const creature = examples[i];
            creature.rotation = Math.sin(now / (1000 + i * 160)) * 0.22;
            procedural.updateCreature(creature, dt, { velocity: creature.__labVelocity, acceleration: { x: 180, y: 30 }, thrust: 0.35 + i * 0.08, turn: Math.sin(now / 700 + i) * 0.7 });
        }
    }

    window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && lab && !lab.hidden) {
            event.preventDefault();
            closeLab();
        }
    });

    function boot() {
        ensureButton();
        ensureLab();
        requestAnimationFrame(boot);
    }

    window.nocturneProceduralLabDebug = {
        open: openLab,
        close: closeLab,
        renderSeed,
        get genome() { return selectedGenome; },
        get exampleCount() { return examples.length; }
    };
    requestAnimationFrame(boot);
})();
