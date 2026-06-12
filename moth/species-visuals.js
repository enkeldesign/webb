(() => {
    'use strict';

    const SPECIES = {
        monarch: { name: 'Monarch', kind: 'butterfly', wingA: 0xff7a1f, wingB: 0xffbd39, rim: 0x171018, vein: 0x23131a, body: 0x161016, thorax: 0x2a1720, glow: 0xffa24a, accent: 0xfff2bd },
        cabbage: { name: 'Cabbage White', kind: 'butterfly', wingA: 0xfbfdff, wingB: 0xdcefff, rim: 0x636a76, vein: 0x9aaec2, body: 0x2f3442, thorax: 0x5d6577, glow: 0xdff8ff, accent: 0x2f3543 },
        rosy: { name: 'Rosy Maple Moth', kind: 'moth', wingA: 0xff8fc8, wingB: 0xffe57a, rim: 0x7b3558, vein: 0xffc0dd, body: 0xffd86f, thorax: 0xffa2cf, glow: 0xff9ac9, accent: 0xfff6bc },
        peacock: { name: 'Peacock Butterfly', kind: 'butterfly', wingA: 0xc45624, wingB: 0x8e381e, rim: 0x15101d, vein: 0x261525, body: 0x171018, thorax: 0x2b1a22, glow: 0x4da5ff, accent: 0x82ecff },
        redAdmiral: { name: 'Red Admiral', kind: 'butterfly', wingA: 0x17131d, wingB: 0x262031, rim: 0xff3549, vein: 0x4a2634, body: 0x151018, thorax: 0x2b1b25, glow: 0xff5369, accent: 0xffead1 },
        silverY: { name: 'Silver Y Moth', kind: 'moth', wingA: 0x777888, wingB: 0xbcc1ce, rim: 0x3f4150, vein: 0xdce8f7, body: 0x2a2936, thorax: 0x5b5d6d, glow: 0xcfe9ff, accent: 0xf4fbff },
        atlas: { name: 'Atlas Moth', kind: 'moth', wingA: 0xb86b31, wingB: 0xffb25d, rim: 0x4d1e16, vein: 0xffd48a, body: 0x2b1710, thorax: 0x6f3821, glow: 0xffd48a, accent: 0xfff0bc }
    };

    const EXTRA_KEYS = ['peacock', 'silverY', 'redAdmiral', 'atlas'];
    const SUPPRESSED = '__nocturne_suppressed__';
    let layer = null;
    let lastCount = 0;

    function app() { return window.nocturnePixiApp; }
    function debug() { return window.nocturneWingsDebug; }

    function ensureLayer() {
        if (layer || !app() || !window.PIXI) return !!layer;
        layer = new PIXI.Container();
        layer.eventMode = 'none';
        layer.zIndex = 1000;
        app().stage.sortableChildren = true;
        app().stage.addChild(layer);
        return true;
    }

    function visibleForArt(node) {
        return node
            && node.species !== SUPPRESSED
            && node.worldVisible !== false
            && node.visible !== false
            && node.parent?.visible !== false;
    }

    function walk(container, out) {
        if (!container?.children || container.visible === false || container.worldVisible === false) return;
        for (const child of container.children) {
            if (child !== layer && visibleForArt(child) && child.species && SPECIES[child.species]) out.push(child);
            if (child !== layer && visibleForArt(child) && child.children) walk(child, out);
        }
    }

    function selectedKey() {
        return debug()?.save?.().selected || window.nocturneCollectionDebug?.collection?.selected || 'monarch';
    }

    function buildWing(data, side, upper) {
        const wing = new PIXI.Graphics();
        const moth = data.kind === 'moth';
        const fill = upper ? data.wingA : data.wingB;
        wing.lineStyle((upper ? 2.2 : 1.8), data.rim, 0.85);
        wing.beginFill(fill, upper ? 0.96 : 0.88);
        if (upper) {
            if (moth) {
                wing.moveTo(side * 3, -5);
                wing.bezierCurveTo(side * 22, -48, side * 66, -44, side * 70, -7);
                wing.bezierCurveTo(side * 68, 22, side * 30, 28, side * 6, 6);
                wing.bezierCurveTo(side * 1, 1, side * 1, -2, side * 3, -5);
            } else {
                wing.moveTo(side * 3, -6);
                wing.bezierCurveTo(side * 15, -48, side * 57, -53, side * 64, -9);
                wing.bezierCurveTo(side * 63, 16, side * 26, 23, side * 6, 5);
                wing.bezierCurveTo(side * 0, 1, side * 0, -2, side * 3, -6);
            }
        } else {
            wing.moveTo(side * 5, 4);
            wing.bezierCurveTo(side * 24, moth ? 4 : 9, side * 48, moth ? 26 : 24, side * 38, moth ? 54 : 47);
            wing.bezierCurveTo(side * 20, moth ? 66 : 60, side * 3, 37, side * 2, 10);
            wing.bezierCurveTo(side * 2, 7, side * 3, 5, side * 5, 4);
        }
        wing.endFill();

        wing.lineStyle(1.15, data.vein, 0.52);
        const veinReach = moth ? 63 : 56;
        if (upper) {
            wing.moveTo(side * 6, -2); wing.bezierCurveTo(side * 20, -22, side * 36, -36, side * veinReach, -34);
            wing.moveTo(side * 7, 1); wing.bezierCurveTo(side * 26, -7, side * 41, -1, side * (veinReach - 2), -8);
            wing.moveTo(side * 8, 4); wing.bezierCurveTo(side * 25, 11, side * 42, 13, side * (veinReach - 4), 8);
        } else {
            wing.moveTo(side * 5, 8); wing.bezierCurveTo(side * 18, 21, side * 27, 36, side * 34, 49);
            wing.moveTo(side * 4, 8); wing.bezierCurveTo(side * 11, 23, side * 13, 40, side * 10, 51);
        }

        wing.beginFill(0xffffff, upper ? 0.09 : 0.06);
        wing.drawEllipse(side * (upper ? 34 : 20), upper ? -18 : 27, upper ? 14 : 9, upper ? 25 : 17);
        wing.endFill();

        drawMarkings(wing, data, side, upper);
        return wing;
    }

    function drawMarkings(g, data, side, upper) {
        if (data.name === 'Monarch') {
            g.beginFill(data.accent, 0.78);
            if (upper) { g.drawCircle(side * 42, -28, 3); g.drawCircle(side * 53, -12, 2.5); g.drawCircle(side * 44, 7, 2.3); }
            else { g.drawCircle(side * 24, 37, 2.7); g.drawCircle(side * 11, 24, 2); }
            g.endFill();
        } else if (data.name === 'Cabbage White') {
            g.beginFill(data.accent, 0.48);
            if (upper) g.drawCircle(side * 43, -6, 4.1); else g.drawCircle(side * 24, 28, 2.6);
            g.endFill();
        } else if (data.name === 'Rosy Maple Moth') {
            g.beginFill(data.accent, 0.5);
            if (upper) g.drawEllipse(side * 39, -10, 5, 8); else g.drawCircle(side * 22, 27, 3.2);
            g.endFill();
        } else if (data.name === 'Peacock Butterfly') {
            if (upper) {
                g.beginFill(0x244bd6, 0.5); g.drawEllipse(side * 42, -18, 12, 15); g.endFill();
                g.beginFill(0x15101d, 0.86); g.drawEllipse(side * 42, -18, 6.5, 7.5); g.endFill();
                g.beginFill(0x8fffff, 0.9); g.drawCircle(side * 40, -20, 2.2); g.endFill();
            }
            g.lineStyle(4, 0xffc44f, 0.42); g.moveTo(side * 12, upper ? -32 : 16); g.lineTo(side * (upper ? 58 : 34), upper ? -9 : 42);
        } else if (data.name === 'Red Admiral') {
            g.lineStyle(6, 0xff3448, 0.88);
            if (upper) { g.moveTo(side * 9, -30); g.lineTo(side * 53, 1); }
            else { g.moveTo(side * 9, 12); g.lineTo(side * 32, 40); }
            g.beginFill(data.accent, 0.88);
            if (upper) { g.drawCircle(side * 51, -28, 2.8); g.drawCircle(side * 57, -15, 2.2); }
            g.endFill();
        } else if (data.name === 'Silver Y Moth') {
            g.lineStyle(3, data.accent, 0.78);
            if (upper) {
                g.moveTo(side * 26, -20); g.bezierCurveTo(side * 33, -12, side * 31, -3, side * 25, 8);
                g.moveTo(side * 31, -12); g.bezierCurveTo(side * 40, -14, side * 43, -21, side * 47, -27);
            }
            g.beginFill(0xffffff, 0.18); g.drawEllipse(side * (upper ? 44 : 24), upper ? -3 : 32, upper ? 8 : 5, upper ? 18 : 10); g.endFill();
        } else if (data.name === 'Atlas Moth') {
            g.lineStyle(3, data.accent, 0.5); g.drawEllipse(side * (upper ? 36 : 23), upper ? -10 : 29, upper ? 19 : 11, upper ? 24 : 15);
            if (upper) { g.beginFill(0xfff4c8, 0.28); g.drawEllipse(side * 47, -27, 9, 7); g.endFill(); }
        }
    }

    function buildArt() {
        const art = new PIXI.Container();
        art.eventMode = 'none';
        const glow = new PIXI.Graphics();
        const ring = new PIXI.Graphics();
        const leftUpper = new PIXI.Container();
        const rightUpper = new PIXI.Container();
        const leftLower = new PIXI.Container();
        const rightLower = new PIXI.Container();
        const body = new PIXI.Graphics();
        const dust = new PIXI.Graphics();
        art.addChild(glow, ring, leftUpper, rightUpper, leftLower, rightLower, body, dust);
        art.parts = { glow, ring, leftUpper, rightUpper, leftLower, rightLower, body, dust, key: null };
        return art;
    }

    function rebuildArt(art, key) {
        const data = SPECIES[key] || SPECIES.monarch;
        const p = art.parts;
        for (const part of [p.glow, p.ring, p.body, p.dust]) part.clear();
        for (const part of [p.leftUpper, p.rightUpper, p.leftLower, p.rightLower]) part.removeChildren().forEach((child) => child.destroy());
        p.glow.beginFill(data.glow, 0.13); p.glow.drawCircle(0, 0, 62); p.glow.endFill();
        p.glow.blendMode = PIXI.BLEND_MODES.ADD;
        p.leftUpper.addChild(buildWing(data, -1, true));
        p.rightUpper.addChild(buildWing(data, 1, true));
        p.leftLower.addChild(buildWing(data, -1, false));
        p.rightLower.addChild(buildWing(data, 1, false));
        p.body.beginFill(data.body, 1); p.body.drawEllipse(0, 10, data.kind === 'moth' ? 6.7 : 5.2, 25); p.body.endFill();
        p.body.lineStyle(1.1, data.accent, 0.32);
        for (let y = -6; y <= 24; y += 7) { p.body.moveTo(-4.2, y); p.body.quadraticCurveTo(0, y + 3, 4.2, y); }
        p.body.beginFill(data.thorax, 1); p.body.drawEllipse(0, -9, data.kind === 'moth' ? 10 : 8.3, 12.5); p.body.endFill();
        p.body.beginFill(data.body, 1); p.body.drawCircle(0, -26, 7.3); p.body.endFill();
        p.body.beginFill(0xffffff, 0.78); p.body.drawCircle(-2.7, -27, 1.4); p.body.drawCircle(2.7, -27, 1.4); p.body.endFill();
        p.body.beginFill(0x050409, 0.92); p.body.drawCircle(-2.7, -27, 0.7); p.body.drawCircle(2.7, -27, 0.7); p.body.endFill();
        p.body.lineStyle(1.55, data.accent, 0.78);
        p.body.moveTo(-3, -32); p.body.bezierCurveTo(-11, -44, -19, -38, -18, -31);
        p.body.moveTo(3, -32); p.body.bezierCurveTo(11, -44, 19, -38, 18, -31);
        p.dust.beginFill(data.glow, 0.1); p.dust.drawEllipse(0, 0, 42, 58); p.dust.endFill();
        p.dust.blendMode = PIXI.BLEND_MODES.ADD;
        p.key = key;
    }

    function updateArt(art, source, index, now) {
        const key = source.species || 'monarch';
        if (art.parts.key !== key) rebuildArt(art, key);
        const pos = source.getGlobalPosition();
        const wt = source.worldTransform;
        const scale = Math.max(0.5, Math.min(1.55, Math.hypot(wt.a, wt.b)));
        const breath = 1 + Math.sin(now * 1.15 + index * 0.61) * 0.014;
        art.position.set(pos.x, pos.y + Math.sin(now * 1.25 + index * 0.7) * 1.7);
        art.rotation = source.rotation || 0;
        art.scale.set(scale * breath);
        const data = SPECIES[key] || SPECIES.monarch;
        const selected = key === selectedKey();
        art.parts.ring.clear();
        if (debug()?.state?.mode === 'lobby' && selected) {
            art.parts.ring.lineStyle(2.5 / scale, 0xffd66b, 0.82); art.parts.ring.drawCircle(0, 0, 52);
        }
        const moth = data.kind === 'moth';
        const phase = now * (moth ? 1.85 : 2.2) + index * 0.73 + (source.flutterPhase || 0);
        const flap = Math.sin(phase) * (moth ? 0.105 : 0.135);
        const lower = Math.sin(phase + 0.45) * (moth ? 0.07 : 0.09);
        art.parts.leftUpper.scale.x = 1 - flap; art.parts.rightUpper.scale.x = 1 + flap;
        art.parts.leftLower.scale.x = 1 - lower; art.parts.rightLower.scale.x = 1 + lower;
        art.parts.leftUpper.rotation = -0.08 - flap * 0.18; art.parts.rightUpper.rotation = 0.08 - flap * 0.18;
        art.parts.leftLower.rotation = -0.02 - lower * 0.12; art.parts.rightLower.rotation = 0.02 - lower * 0.12;
        art.parts.body.rotation = Math.sin(now * 1.25 + index) * 0.022;
        art.parts.glow.alpha = 0.72 + Math.sin(now * 1.25 + index) * 0.16;
        art.parts.dust.alpha = 0.72 + Math.sin(now * 1.65 + index) * 0.18;
        source.alpha = 0.015;
    }

    function loop(nowMs) {
        if (!ensureLayer()) { requestAnimationFrame(loop); return; }
        const sources = [];
        walk(app().stage, sources);
        const now = nowMs / 1000;
        while (layer.children.length < sources.length) layer.addChild(buildArt());
        while (layer.children.length > sources.length) layer.removeChildAt(layer.children.length - 1).destroy({ children: true });
        sources.forEach((source, index) => updateArt(layer.children[index], source, index, now));
        lastCount = sources.length;
        requestAnimationFrame(loop);
    }

    window.nocturneSpeciesVisualsDebug = { get count() { return lastCount; } };
    requestAnimationFrame(loop);
})();
