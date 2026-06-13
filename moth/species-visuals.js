(() => {
    'use strict';

    const SPECIES = {
        monarch: {
            name: 'Monarch', kind: 'butterfly', wingA: 0xff7a1f, wingB: 0xffbd39,
            rim: 0x171018, vein: 0x23131a, body: 0x161016, thorax: 0x2a1720,
            glow: 0xffa24a, accent: 0xfff2bd, shadow: 0x7a2d13
        },
        cabbage: {
            name: 'Cabbage White', kind: 'butterfly', wingA: 0xfbfdff, wingB: 0xdcefff,
            rim: 0x636a76, vein: 0x9aaec2, body: 0x2f3442, thorax: 0x5d6577,
            glow: 0xdff8ff, accent: 0x2f3543, shadow: 0xbfd6e7
        },
        rosy: {
            name: 'Rosy Maple Moth', kind: 'moth', wingA: 0xff8fc8, wingB: 0xffe57a,
            rim: 0x7b3558, vein: 0xffc0dd, body: 0xffd86f, thorax: 0xffa2cf,
            glow: 0xff9ac9, accent: 0xfff6bc, shadow: 0xff6fae
        }
    };

    const SUPPRESSED = '__nocturne_suppressed__';
    let layer = null;
    let lastCount = 0;

    function app() { return window.nocturnePixiApp; }
    function debug() { return window.nocturneWingsDebug; }
    function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

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
        const selected = debug()?.save?.().selected;
        return SPECIES[selected] ? selected : 'monarch';
    }

    function drawWing(data, side, upper) {
        const wing = new PIXI.Graphics();
        const moth = data.kind === 'moth';
        const fill = upper ? data.wingA : data.wingB;
        wing.lineStyle(upper ? 2.3 : 1.9, data.rim, moth ? 0.72 : 0.86);
        wing.beginFill(fill, upper ? 0.92 : 0.84);
        if (upper) {
            if (moth) {
                wing.moveTo(side * 3, -5);
                wing.bezierCurveTo(side * 23, -50, side * 68, -46, side * 73, -8);
                wing.bezierCurveTo(side * 69, 22, side * 30, 29, side * 6, 6);
                wing.bezierCurveTo(side * 1, 1, side * 1, -2, side * 3, -5);
            } else {
                wing.moveTo(side * 3, -6);
                wing.bezierCurveTo(side * 16, -50, side * 59, -56, side * 66, -10);
                wing.bezierCurveTo(side * 64, 16, side * 27, 23, side * 6, 5);
                wing.bezierCurveTo(side * 0, 1, side * 0, -2, side * 3, -6);
            }
        } else {
            wing.moveTo(side * 5, 4);
            wing.bezierCurveTo(side * 24, moth ? 4 : 9, side * 49, moth ? 27 : 24, side * 39, moth ? 56 : 48);
            wing.bezierCurveTo(side * 20, moth ? 67 : 60, side * 3, 37, side * 2, 10);
            wing.bezierCurveTo(side * 2, 7, side * 3, 5, side * 5, 4);
        }
        wing.endFill();

        wing.beginFill(0xffffff, upper ? 0.12 : 0.075);
        wing.drawEllipse(side * (upper ? 35 : 21), upper ? -19 : 27, upper ? 15 : 9, upper ? 27 : 17);
        wing.endFill();

        wing.lineStyle(1.12, data.vein, moth ? 0.45 : 0.52);
        const reach = moth ? 63 : 56;
        if (upper) {
            wing.moveTo(side * 6, -2); wing.bezierCurveTo(side * 20, -22, side * 36, -37, side * reach, -35);
            wing.moveTo(side * 7, 1); wing.bezierCurveTo(side * 26, -7, side * 41, -1, side * (reach - 2), -8);
            wing.moveTo(side * 8, 4); wing.bezierCurveTo(side * 25, 11, side * 42, 13, side * (reach - 4), 8);
        } else {
            wing.moveTo(side * 5, 8); wing.bezierCurveTo(side * 18, 21, side * 27, 36, side * 34, 50);
            wing.moveTo(side * 4, 8); wing.bezierCurveTo(side * 11, 23, side * 13, 40, side * 10, 51);
        }

        drawMarkings(wing, data, side, upper);
        return wing;
    }

    function drawMarkings(g, data, side, upper) {
        if (data.name === 'Monarch') {
            g.lineStyle(1.8, data.rim, 0.42);
            if (upper) {
                g.moveTo(side * 14, -34); g.bezierCurveTo(side * 26, -22, side * 39, -12, side * 58, -12);
                g.moveTo(side * 12, 2); g.bezierCurveTo(side * 29, 3, side * 44, 9, side * 56, 3);
            }
            g.beginFill(data.accent, 0.8);
            if (upper) { g.drawCircle(side * 43, -29, 3); g.drawCircle(side * 54, -13, 2.5); g.drawCircle(side * 45, 7, 2.4); }
            else { g.drawCircle(side * 24, 38, 2.8); g.drawCircle(side * 11, 24, 2); }
            g.endFill();
            return;
        }
        if (data.name === 'Cabbage White') {
            g.beginFill(data.accent, upper ? 0.46 : 0.28);
            if (upper) g.drawCircle(side * 43, -6, 4.2);
            else g.drawCircle(side * 24, 28, 2.6);
            g.endFill();
            g.beginFill(0xffffff, 0.22);
            g.drawEllipse(side * (upper ? 31 : 18), upper ? -22 : 31, upper ? 16 : 8, upper ? 20 : 12);
            g.endFill();
            return;
        }
        g.beginFill(data.accent, 0.46);
        if (upper) {
            g.drawEllipse(side * 39, -12, 6, 10);
            g.drawCircle(side * 52, 2, 2.7);
        } else {
            g.drawCircle(side * 23, 28, 3.4);
        }
        g.endFill();
        g.lineStyle(2.2, data.shadow, 0.26);
        g.moveTo(side * 12, upper ? -31 : 16);
        g.bezierCurveTo(side * 28, upper ? -9 : 26, side * 42, upper ? 1 : 44, side * (upper ? 61 : 34), upper ? -4 : 49);
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
        art.addChild(glow, dust, ring, leftUpper, rightUpper, leftLower, rightLower, body);
        art.parts = { glow, dust, ring, leftUpper, rightUpper, leftLower, rightLower, body, key: null };
        return art;
    }

    function rebuildArt(art, key) {
        const data = SPECIES[key] || SPECIES.monarch;
        const p = art.parts;
        for (const part of [p.glow, p.dust, p.ring, p.body]) part.clear();
        for (const part of [p.leftUpper, p.rightUpper, p.leftLower, p.rightLower]) part.removeChildren().forEach((child) => child.destroy());

        p.glow.beginFill(data.glow, data.kind === 'moth' ? 0.12 : 0.105);
        p.glow.drawCircle(0, 0, data.kind === 'moth' ? 68 : 62);
        p.glow.endFill();
        p.glow.blendMode = PIXI.BLEND_MODES.ADD;

        p.dust.beginFill(data.glow, 0.09);
        p.dust.drawEllipse(0, 0, 46, data.kind === 'moth' ? 62 : 56);
        p.dust.endFill();
        p.dust.blendMode = PIXI.BLEND_MODES.ADD;

        p.leftUpper.addChild(drawWing(data, -1, true));
        p.rightUpper.addChild(drawWing(data, 1, true));
        p.leftLower.addChild(drawWing(data, -1, false));
        p.rightLower.addChild(drawWing(data, 1, false));

        p.body.beginFill(data.body, 1);
        p.body.drawEllipse(0, 10, data.kind === 'moth' ? 6.8 : 5.1, data.kind === 'moth' ? 26 : 24);
        p.body.endFill();
        p.body.lineStyle(1.1, data.accent, data.kind === 'moth' ? 0.34 : 0.28);
        for (let y = -7; y <= 25; y += 7) p.body.drawEllipse(0, y, data.kind === 'moth' ? 5.4 : 4.3, 1.6);
        p.body.beginFill(data.thorax, 1);
        p.body.drawEllipse(0, -9, data.kind === 'moth' ? 10.5 : 8.4, 12.8);
        p.body.endFill();
        p.body.beginFill(data.body, 1);
        p.body.drawCircle(0, -26, 7.3);
        p.body.endFill();
        p.body.beginFill(0xffffff, 0.78);
        p.body.drawCircle(-2.8, -27, 1.35);
        p.body.drawCircle(2.8, -27, 1.35);
        p.body.endFill();
        p.body.beginFill(0x050409, 0.92);
        p.body.drawCircle(-2.8, -27, 0.7);
        p.body.drawCircle(2.8, -27, 0.7);
        p.body.endFill();
        p.body.lineStyle(1.45, data.accent, 0.72);
        p.body.moveTo(-3, -32); p.body.bezierCurveTo(-11, -44, -19, -38, -18, -31);
        p.body.moveTo(3, -32); p.body.bezierCurveTo(11, -44, 19, -38, 18, -31);
        p.key = key;
    }

    function updateArt(art, source, index, now) {
        const key = source.species || 'monarch';
        if (art.parts.key !== key) rebuildArt(art, key);
        const pos = source.getGlobalPosition();
        const wt = source.worldTransform;
        const sourceScale = clamp(Math.hypot(wt.a, wt.b), 0.46, 1.7);
        const data = SPECIES[key] || SPECIES.monarch;
        const speed = source.flightSpeed ?? Math.max(Math.hypot(source.vx || 0, source.vy || 0), 0);
        const speedRatio = clamp(speed / 620, 0, 1.3);
        const breathe = 1 + Math.sin(now * 0.82 + index * 0.61) * 0.018;
        const drift = Math.sin(now * 0.9 + index * 0.7) * (data.kind === 'moth' ? 2.4 : 1.8);

        art.position.set(pos.x, pos.y + drift);
        art.rotation = source.rotation || 0;
        art.scale.set(sourceScale * breathe);

        const selected = debug()?.state?.mode === 'lobby' && key === selectedKey();
        art.parts.ring.clear();
        if (selected) {
            const pulse = 1 + Math.sin(now * 2.1) * 0.035;
            art.parts.ring.lineStyle(2.4 / sourceScale, 0xffd66b, 0.82);
            art.parts.ring.drawCircle(0, 0, 54 * pulse);
            art.parts.ring.lineStyle(1.2 / sourceScale, data.glow, 0.48);
            art.parts.ring.drawCircle(0, 0, 62 * pulse);
        }

        const moth = data.kind === 'moth';
        const phase = now * (moth ? 1.85 + speedRatio * 2.25 : 2.35 + speedRatio * 3.05) + index * 0.73 + (source.flutterPhase || 0);
        const upperAmp = (moth ? 0.09 : 0.11) + speedRatio * (moth ? 0.055 : 0.075);
        const lowerAmp = upperAmp * (moth ? 0.62 : 0.74);
        const flap = Math.sin(phase) * upperAmp;
        const lower = Math.sin(phase + 0.45) * lowerAmp;
        const lift = Math.cos(phase) * (0.016 + speedRatio * 0.012);

        art.parts.leftUpper.scale.x = 1 - flap;
        art.parts.rightUpper.scale.x = 1 + flap;
        art.parts.leftLower.scale.x = 1 - lower;
        art.parts.rightLower.scale.x = 1 + lower;
        art.parts.leftUpper.scale.y = 1 + Math.abs(flap) * 0.1 + lift;
        art.parts.rightUpper.scale.y = 1 + Math.abs(flap) * 0.1 + lift;
        art.parts.leftLower.scale.y = 1 + Math.abs(lower) * 0.07;
        art.parts.rightLower.scale.y = 1 + Math.abs(lower) * 0.07;
        art.parts.leftUpper.rotation = -0.075 - flap * 0.18;
        art.parts.rightUpper.rotation = 0.075 - flap * 0.18;
        art.parts.leftLower.rotation = -0.02 - lower * 0.12;
        art.parts.rightLower.rotation = 0.02 - lower * 0.12;
        art.parts.body.rotation = Math.sin(now * 0.94 + index) * 0.023 + (source.flightTilt || 0) * 0.016;
        art.parts.glow.alpha = 0.58 + Math.sin(now * 1.08 + index) * 0.15 + speedRatio * 0.1;
        art.parts.dust.alpha = 0.48 + Math.sin(now * 1.32 + index) * 0.16 + speedRatio * 0.16;

        source.alpha = 0.001;
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
