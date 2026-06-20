import { Container, Graphics, Text } from "pixi.js";
import { MAX_QUEUE, PARTY_COLORS, PARTY_GLYPHS, ABILITIES, ENEMY_MOVES, clamp } from "./data.js";

export function installCombatRenderer(CombatScene) {
  Object.assign(CombatScene.prototype, {
    draw(now) {
      if (!this.ready) return;
      const width = this.app.screen.width;
      const height = this.app.screen.height;
      this.actorHitboxes = [];
      this.targetHitboxes = [];
      this.abilityHitboxes = [];
      this.queueHitboxes = [];

      this.clearLayer(this.worldLayer);
      this.clearLayer(this.intentLayer);
      this.clearLayer(this.actorLayer);
      this.clearLayer(this.effectLayer);
      this.clearLayer(this.menuLayer);

      this.drawWorld(width, height, now);
      if (!this.party.length) return;

      const enemyPositions = this.enemyPositions(width, height);
      const partyPositions = this.partyPositions(width, height);

      this.drawEnemyIntentLines(enemyPositions, partyPositions, now);

      this.enemies.forEach((enemy, index) => {
        const position = enemyPositions[index];
        if (!position) return;
        this.drawActor(enemy, position, "enemy", now);
      });

      this.party.forEach((member, index) => {
        const position = partyPositions[index];
        this.drawActor(member, position, "party", now);
      });

      if (this.menuOpen && this.activeActorId) {
        const actor = this.party.find(member => member.id === this.activeActorId);
        const position = partyPositions[this.party.indexOf(actor)];
        if (actor && position) this.drawActionMenu(actor, position, now);
      }

      if (this.gesture?.mode === "ability" && this.gesture.ability) {
        this.drawTargeting(this.gesture.actor, this.gesture.ability, this.gesture.point, partyPositions, enemyPositions);
      }
    },

    clearLayer(layer) {
      const removed = layer.removeChildren();
      removed.forEach(child => child.destroy({ children: true }));
    },

    drawWorld(width, height, now) {
      const background = new Graphics();
      background.rect(0, 0, width, height).fill(0x11100f);
      background.ellipse(width * 0.5, height * 0.48, width * 0.72, height * 0.38).fill({ color: 0x37251a, alpha: 0.72 });
      background.ellipse(width * 0.5, height * 0.48, width * 0.56, height * 0.29).stroke({ color: 0x8b6a35, alpha: 0.28, width: 2 });

      for (let index = 0; index < 3; index += 1) {
        const radius = width * (0.16 + index * 0.12);
        background.circle(width * 0.5, height * 0.48, radius).stroke({
          color: index === 1 ? 0x8d6331 : 0x5f4728,
          alpha: 0.12 + index * 0.03,
          width: 1.2
        });
      }

      const runeRotation = now * 0.00008;
      const rune = new Graphics();
      rune.position.set(width * 0.5, height * 0.48);
      rune.rotation = runeRotation;
      for (let index = 0; index < 8; index += 1) {
        const angle = index * Math.PI / 4;
        const x = Math.cos(angle) * width * 0.22;
        const y = Math.sin(angle) * width * 0.22;
        rune.moveTo(x - 6, y).lineTo(x + 6, y).stroke({ color: 0xd0a454, alpha: 0.2, width: 2 });
      }
      this.worldLayer.addChild(background, rune);
    },

    partyPositions(width, height) {
      const y = clamp(height * 0.69, height - 260, height - 205);
      return [
        { x: width * 0.2, y },
        { x: width * 0.5, y: y + 16 },
        { x: width * 0.8, y }
      ];
    },

    enemyPositions(width, height) {
      const y = clamp(height * 0.29, 190, 270);
      if (this.enemies.length === 1) return [{ x: width * 0.5, y }];
      if (this.enemies.length === 2) return [{ x: width * 0.31, y }, { x: width * 0.69, y: y + 8 }];
      return this.enemies.map((_, index) => ({ x: width * (0.18 + index * 0.32), y: y + (index % 2) * 8 }));
    },

    drawEnemyIntentLines(enemyPositions, partyPositions, now) {
      this.enemies.forEach((enemy, enemyIndex) => {
        if (!enemy.alive || !enemy.intent?.targetId) return;
        const targetIndex = this.party.findIndex(member => member.id === enemy.intent.targetId);
        const target = this.party[targetIndex];
        if (!target?.alive) return;
        const from = enemyPositions[enemyIndex];
        const to = partyPositions[targetIndex];
        const pulse = 0.25 + Math.sin(now * 0.008 + enemyIndex) * 0.08;
        const line = new Graphics();
        line.moveTo(from.x, from.y + 36)
          .lineTo(to.x, to.y - 46)
          .stroke({ color: 0xff5b5b, alpha: pulse, width: 2 });
        line.circle(to.x, to.y, 48 + Math.sin(now * 0.006) * 3)
          .stroke({ color: 0xff6868, alpha: 0.45, width: 2 });
        this.intentLayer.addChild(line);
      });
    },

    drawActor(actor, position, side, now) {
      const root = new Container();
      root.position.set(position.x, position.y + Math.sin(now * 0.0025 + position.x) * 3);
      root.alpha = actor.alive ? 1 : 0.28;

      const targetRadius = side === "party" ? 54 : 50;
      this.actorHitboxes.push({ x: position.x, y: position.y, radius: targetRadius, actorId: actor.id, side });
      this.targetHitboxes.push({ x: position.x, y: position.y, radius: targetRadius + 8, actorId: actor.id, side });

      const shadow = new Graphics();
      shadow.ellipse(0, 42, side === "party" ? 40 : 36, 12).fill({ color: 0x000000, alpha: 0.45 });
      root.addChild(shadow);

      const selected = this.activeActorId === actor.id && this.menuOpen;
      if (selected) {
        const selection = new Graphics();
        selection.circle(0, 0, 55 + Math.sin(now * 0.008) * 3)
          .stroke({ color: PARTY_COLORS[actor.role], alpha: 0.8, width: 3 });
        root.addChild(selection);
      }

      const frame = new Graphics();
      frame.circle(0, 0, 45).fill({ color: 0x100b06, alpha: 0.97 });
      frame.circle(0, 0, 45).stroke({ color: 0xb68a43, width: 4 });
      frame.circle(0, 0, 39).stroke({ color: side === "party" ? (PARTY_COLORS[actor.role] || 0xffffff) : 0x9d4b3f, alpha: 0.82, width: 2 });
      root.addChild(frame);

      if (side === "party") this.drawHeroArt(root, actor, now);
      else this.drawEnemyArt(root, actor, now);

      if (actor.flashUntil > now) {
        const flash = new Graphics();
        flash.circle(0, 0, 39).fill({ color: 0xfff3d6, alpha: 0.42 });
        root.addChild(flash);
      }
      if (actor.healUntil > now) {
        const heal = new Graphics();
        heal.circle(0, 0, 45 + (actor.healUntil - now) * 0.04)
          .stroke({ color: 0x7dffb4, alpha: 0.75, width: 4 });
        root.addChild(heal);
      }

      const name = this.makeText(actor.name, 12, 0xfff0cf, 700);
      name.anchor.set(0.5);
      name.position.set(0, 59);
      root.addChild(name);

      this.drawHealthBar(root, actor, side);
      this.drawStatusBadges(root, actor, side, now);
      if (side === "party") this.drawQueue(root, actor, position);
      else this.drawEnemyIntent(root, actor, now);

      this.actorLayer.addChild(root);
    },

    drawHeroArt(root, actor, now) {
      const art = new Graphics();
      const classColor = PARTY_COLORS[actor.role];

      if (actor.role === "tank") {
        art.roundRect(-22, -12, 44, 45, 12).fill(0x34485b).stroke({ color: classColor, alpha: 0.7, width: 2 });
        art.circle(0, -21, 15).fill(0xc6a781);
        art.moveTo(-15, -27).lineTo(0, -37).lineTo(15, -27).lineTo(11, -17).lineTo(-11, -17).closePath().fill(0x677d8d);
        art.roundRect(-39, -4, 25, 42, 10).fill(0x2e5f8b).stroke({ color: 0x91d0ff, width: 2 });
        art.moveTo(-36, 5).lineTo(-17, 17).moveTo(-36, 29).lineTo(-17, 17).stroke({ color: 0xd2ebff, alpha: 0.7, width: 2 });
        art.rect(19, -2, 5, 42).fill(0xb9995e);
      } else if (actor.role === "healer") {
        art.moveTo(-27, 34).lineTo(-17, -7).lineTo(0, -22).lineTo(18, -7).lineTo(28, 34).closePath().fill(0x37644d).stroke({ color: classColor, width: 2 });
        art.circle(0, -22, 14).fill(0xd8b58d);
        art.moveTo(-14, -28).lineTo(0, -39).lineTo(14, -28).lineTo(10, -17).lineTo(-10, -17).closePath().fill(0xd4c9ad);
        art.rect(27, -16, 4, 52).fill(0xa98245);
        art.circle(29, -21, 8 + Math.sin(now * 0.006) * 1.2).fill({ color: 0xf3df76, alpha: 0.92 });
        art.circle(29, -21, 13).stroke({ color: 0xfff0a0, alpha: 0.45, width: 2 });
      } else {
        art.moveTo(-23, 34).lineTo(-18, -8).lineTo(0, -27).lineTo(19, -8).lineTo(24, 34).closePath().fill(0x49352a).stroke({ color: classColor, width: 2 });
        art.circle(0, -18, 13).fill(0xb58b6d);
        art.moveTo(-18, -14).quadraticCurveTo(0, -48, 18, -14).lineTo(10, -3).lineTo(-10, -3).closePath().fill(0x542f34);
        art.moveTo(25, -25).quadraticCurveTo(43, 0, 25, 28).stroke({ color: 0xb78a47, width: 4 });
        art.moveTo(26, -24).lineTo(26, 28).stroke({ color: 0xf4dfaf, alpha: 0.75, width: 1 });
        art.moveTo(14, 0).lineTo(40, 0).stroke({ color: 0xe3c27a, width: 2 });
      }

      root.addChild(art);
    },

    drawEnemyArt(root, actor, now) {
      const art = new Graphics();
      const pulse = Math.sin(now * 0.005 + actor.maxHp) * 1.5;

      if (actor.type === "beast") {
        art.ellipse(0, 5, 31, 27).fill(0x503c34).stroke({ color: 0x9a5e4e, width: 2 });
        art.circle(0, -19, 22).fill(0x62473c);
        art.moveTo(-19, -27).lineTo(-28, -42).lineTo(-8, -35).closePath().fill(0x4c342f);
        art.moveTo(19, -27).lineTo(28, -42).lineTo(8, -35).closePath().fill(0x4c342f);
        art.circle(-7, -20, 3 + pulse * 0.1).fill(0xff6b55);
        art.circle(7, -20, 3 + pulse * 0.1).fill(0xff6b55);
        art.moveTo(-8, -8).lineTo(0, -3).lineTo(8, -8).stroke({ color: 0xe4d2bc, width: 2 });
      } else if (actor.type === "cultist") {
        art.moveTo(-28, 34).lineTo(-20, -9).lineTo(0, -35).lineTo(20, -9).lineTo(28, 34).closePath().fill(0x43244d).stroke({ color: 0xb268ba, width: 2 });
        art.circle(0, -16, 12).fill(0x9d806e);
        art.circle(-5, -17, 2.5).fill(0xc174ff);
        art.circle(5, -17, 2.5).fill(0xc174ff);
        art.rect(28, -11, 4, 48).fill(0x715a42);
        art.circle(30, -16, 7 + pulse * 0.2).fill({ color: 0x9d5fc8, alpha: 0.9 });
      } else {
        art.roundRect(-28, -8, 56, 45, 12).fill(0x4e403b).stroke({ color: 0x9a6351, width: 3 });
        art.circle(0, -23, actor.type === "boss" ? 23 : 18).fill(0x69524b);
        art.moveTo(-17, -32).lineTo(-30, -45).lineTo(-7, -39).closePath().fill(0x3d302c);
        art.moveTo(17, -32).lineTo(30, -45).lineTo(7, -39).closePath().fill(0x3d302c);
        art.circle(-7, -23, 3).fill(0xff694d);
        art.circle(7, -23, 3).fill(0xff694d);
        art.rect(-37, 2, 11, 36).fill(0x665245);
        art.rect(26, 2, 11, 36).fill(0x665245);
      }

      root.addChild(art);
    },

    drawHealthBar(root, actor, side) {
      const width = side === "party" ? 92 : 86;
      const y = 72;
      const ratio = clamp(actor.hp / actor.maxHp, 0, 1);
      const background = new Graphics();
      background.roundRect(-width / 2, y, width, 10, 3).fill(0x120c08).stroke({ color: 0x7c5b2d, width: 1 });
      background.roundRect(-width / 2 + 2, y + 2, Math.max(0, (width - 4) * ratio), 6, 2).fill(side === "party" ? PARTY_COLORS[actor.role] : 0xc84e46);
      root.addChild(background);

      const hpText = this.makeText(`${Math.ceil(actor.hp)}/${actor.maxHp}`, 8, 0xffecd0, 700);
      hpText.anchor.set(0.5);
      hpText.position.set(0, y + 5);
      root.addChild(hpText);
    },

    drawStatusBadges(root, actor, side, now) {
      const badges = [];
      if (actor.guard > 0) badges.push({ glyph: "◆", value: actor.guard, color: 0x5cb4ff });
      if (actor.ward > 0) badges.push({ glyph: "✦", value: actor.ward, color: 0xf2db6b });
      if (actor.intercept && actor.intercept.expiresAt > now) badges.push({ glyph: "↶", value: "", color: 0x79bfff });
      if (side === "enemy" && actor.stunnedUntil > now) badges.push({ glyph: "⌁", value: Math.ceil((actor.stunnedUntil - now) / 1000), color: 0x8ed8ff });

      badges.forEach((badge, index) => {
        const x = -((badges.length - 1) * 13) + index * 26;
        const icon = new Graphics();
        icon.circle(x, -54, 10).fill(0x120c08).stroke({ color: badge.color, width: 1.5 });
        root.addChild(icon);
        const text = this.makeText(`${badge.glyph}${badge.value}`, 8, badge.color, 800);
        text.anchor.set(0.5);
        text.position.set(x, -54);
        root.addChild(text);
      });
    },

    drawQueue(root, actor, worldPosition) {
      const y = 89;
      const slotSize = 25;
      const gap = 5;
      const total = slotSize * 3 + gap * 2;
      for (let index = 0; index < MAX_QUEUE; index += 1) {
        const x = -total / 2 + slotSize / 2 + index * (slotSize + gap);
        const action = actor.queue[index];
        const slot = new Graphics();
        slot.roundRect(x - slotSize / 2, y, slotSize, slotSize, 4)
          .fill({ color: action ? 0x2e2213 : 0x100c08, alpha: 0.94 })
          .stroke({ color: action ? 0xc5994f : 0x50432d, width: 1.3, alpha: action ? 0.9 : 0.55 });
        root.addChild(slot);

        if (action) {
          const ability = this.abilityById(actor.role, action.abilityId);
          const target = [...this.party, ...this.enemies].find(item => item.id === action.targetId);
          const glyph = this.makeText(ability.glyph, 14, ability.color, 800);
          glyph.anchor.set(0.5);
          glyph.position.set(x, y + 10);
          root.addChild(glyph);
          const targetText = this.makeText(target ? target.name.charAt(0) : "?", 7, 0xe9d8b6, 800);
          targetText.anchor.set(0.5);
          targetText.position.set(x + 8, y + 20);
          root.addChild(targetText);
          this.queueHitboxes.push({
            x: worldPosition.x + x,
            y: worldPosition.y + y + slotSize / 2,
            radius: 15,
            actorId: actor.id,
            index
          });
        } else {
          const number = this.makeText(String(index + 1), 9, 0x77664a, 700);
          number.anchor.set(0.5);
          number.position.set(x, y + slotSize / 2);
          root.addChild(number);
        }
      }
    },

    drawEnemyIntent(root, enemy, now) {
      if (!enemy.alive || !enemy.intent) return;
      const move = ENEMY_MOVES[enemy.intent.moveId];
      const remaining = Math.max(0, enemy.readyAt - now);
      const progress = clamp(1 - remaining / enemy.speed, 0, 1);
      const target = this.party.find(member => member.id === enemy.intent.targetId);

      const panel = new Graphics();
      panel.roundRect(-48, 88, 96, 30, 5).fill({ color: 0x1b0d0a, alpha: 0.95 }).stroke({ color: 0x9b4a3f, width: 1.5 });
      panel.roundRect(-45, 113, 90 * progress, 3, 2).fill(0xff6c59);
      root.addChild(panel);

      const intentText = this.makeText(`${move.glyph} ${move.name}`, 9, 0xffc5b9, 700);
      intentText.anchor.set(0.5);
      intentText.position.set(0, 97);
      root.addChild(intentText);

      const targetText = this.makeText(target ? `→ ${target.name}` : "→ Party", 8, 0xcaa796, 600);
      targetText.anchor.set(0.5);
      targetText.position.set(0, 108);
      root.addChild(targetText);
    },

    drawActionMenu(actor, actorPosition, now) {
      const menuY = actorPosition.y - 126;
      const menuX = actorPosition.x;
      const center = new Graphics();
      center.circle(menuX, menuY, 34).fill({ color: 0x160f08, alpha: 0.97 }).stroke({ color: 0xd1a651, width: 3 });
      center.circle(menuX, menuY, 27).stroke({ color: PARTY_COLORS[actor.role], alpha: 0.65, width: 1.5 });
      this.menuLayer.addChild(center);

      const actorGlyph = this.makeText(PARTY_GLYPHS[actor.role], 20, PARTY_COLORS[actor.role], 800);
      actorGlyph.anchor.set(0.5);
      actorGlyph.position.set(menuX, menuY);
      this.menuLayer.addChild(actorGlyph);

      const positions = [
        { x: menuX - 62, y: menuY + 8 },
        { x: menuX + 62, y: menuY + 8 }
      ];

      ABILITIES[actor.role].forEach((ability, index) => {
        const position = positions[index];
        const available = this.abilityAvailable(actor, ability);
        const remaining = Math.max(0, (actor.cooldowns[ability.id] || 0) - now);
        const selected = this.gesture?.ability?.id === ability.id;
        const button = new Graphics();
        button.circle(position.x, position.y, selected ? 35 : 32)
          .fill({ color: available ? 0x24180d : 0x17120d, alpha: 0.98 })
          .stroke({ color: available ? ability.color : 0x5c5141, width: selected ? 4 : 2.5 });
        button.circle(position.x, position.y, 25).stroke({ color: 0xe6c678, alpha: available ? 0.3 : 0.12, width: 1 });
        this.menuLayer.addChild(button);

        const glyph = this.makeText(ability.glyph, 22, available ? ability.color : 0x6e6657, 800);
        glyph.anchor.set(0.5);
        glyph.position.set(position.x, position.y - 3);
        this.menuLayer.addChild(glyph);

        const name = this.makeText(ability.name, 8, available ? 0xffedc6 : 0x756c5e, 700);
        name.anchor.set(0.5);
        name.position.set(position.x, position.y + 24);
        this.menuLayer.addChild(name);

        if (remaining > 0) {
          const cooldown = this.makeText(`${(remaining / 1000).toFixed(1)}s`, 9, 0xffb9a9, 800);
          cooldown.anchor.set(0.5);
          cooldown.position.set(position.x, position.y + 7);
          this.menuLayer.addChild(cooldown);
        }

        this.abilityHitboxes.push({
          x: position.x,
          y: position.y,
          radius: 36,
          ability
        });
      });

      const title = this.makeText(`${actor.name} · ${actor.queue.length}/${MAX_QUEUE} queued`, 9, 0xe8d4a9, 700);
      title.anchor.set(0.5);
      title.position.set(menuX, menuY - 47);
      this.menuLayer.addChild(title);
    },

    drawTargeting(actor, ability, point, partyPositions, enemyPositions) {
      const actorIndex = this.party.indexOf(actor);
      const from = partyPositions[actorIndex];
      if (!from) return;

      const line = new Graphics();
      line.moveTo(from.x, from.y - 35)
        .quadraticCurveTo((from.x + point.x) / 2, Math.min(from.y, point.y) - 45, point.x, point.y)
        .stroke({ color: ability.color, alpha: 0.9, width: 4 });
      line.circle(point.x, point.y, 13).stroke({ color: ability.color, alpha: 0.95, width: 3 });
      this.effectLayer.addChild(line);

      const targets = ability.target === "enemy"
        ? this.enemies.map((target, index) => ({ target, position: enemyPositions[index] }))
        : this.party.map((target, index) => ({ target, position: partyPositions[index] }));

      targets.forEach(({ target, position }) => {
        if (!target.alive) return;
        if (ability.target === "ally-other" && target.id === actor.id) return;
        const highlight = new Graphics();
        highlight.circle(position.x, position.y, 58)
          .stroke({ color: ability.color, alpha: 0.72, width: 3 });
        this.effectLayer.addChild(highlight);
      });
    },

    makeText(text, size, color, weight = 600) {
      return new Text({
        text,
        style: {
          fontFamily: "Georgia, Times New Roman, serif",
          fontSize: size,
          fill: color,
          fontWeight: weight,
          dropShadow: {
            color: 0x000000,
            alpha: 0.75,
            blur: 2,
            angle: Math.PI / 2,
            distance: 1
          }
        }
      });
    }
  });
}
