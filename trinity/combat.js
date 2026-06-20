import {
  Application,
  Container,
  Graphics,
  Text
} from "pixi.js";
import {
  MAX_QUEUE,
  PARTY_COLORS,
  PARTY_GLYPHS,
  ABILITIES,
  ENEMY_MOVES,
  ENCOUNTERS,
  clamp,
  randomInt,
  distance
} from "./data.js";
import { installCombatRenderer } from "./combat-render.js";

export class CombatScene {
  constructor(host, callbacks) {
    this.host = host;
    this.callbacks = callbacks;
    this.app = new Application();
    this.ready = false;
    this.active = false;
    this.party = [];
    this.enemies = [];
    this.wave = 1;
    this.activeActorId = null;
    this.menuOpen = false;
    this.gesture = null;
    this.actorHitboxes = [];
    this.targetHitboxes = [];
    this.abilityHitboxes = [];
    this.queueHitboxes = [];
    this.lastDraw = 0;
    this.finishState = null;
    this.init();
  }

  async init() {
    await this.app.init({
      resizeTo: this.host,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      powerPreference: "high-performance"
    });
    this.app.canvas.setAttribute("aria-label", "Fantasy combat battlefield");
    this.app.canvas.style.touchAction = "none";
    this.host.append(this.app.canvas);

    this.worldLayer = new Container();
    this.intentLayer = new Container();
    this.actorLayer = new Container();
    this.effectLayer = new Container();
    this.menuLayer = new Container();
    this.app.stage.addChild(this.worldLayer, this.intentLayer, this.actorLayer, this.effectLayer, this.menuLayer);

    this.bindInput();
    this.app.ticker.add(ticker => this.tick(ticker.deltaMS));
    this.ready = true;
    this.draw(performance.now());
  }

  bindInput() {
    this.app.canvas.addEventListener("pointerdown", event => this.pointerDown(event));
    this.app.canvas.addEventListener("pointermove", event => this.pointerMove(event));
    this.app.canvas.addEventListener("pointerup", event => this.pointerUp(event));
    this.app.canvas.addEventListener("pointercancel", () => this.cancelGesture());
  }

  pointFromEvent(event) {
    const rect = this.app.canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (this.app.screen.width / rect.width),
      y: (event.clientY - rect.top) * (this.app.screen.height / rect.height)
    };
  }

  hitAt(collection, point) {
    return collection.find(item => distance(item, point) <= item.radius) || null;
  }

  pointerDown(event) {
    if (!this.active || this.finishState) return;
    const point = this.pointFromEvent(event);
    const queueHit = this.hitAt(this.queueHitboxes, point);
    if (queueHit) {
      const actor = this.party.find(member => member.id === queueHit.actorId);
      if (actor?.queue[queueHit.index]) {
        const [removed] = actor.queue.splice(queueHit.index, 1);
        this.callbacks.onStatus(`${this.abilityById(actor.role, removed.abilityId).name} removed from ${actor.name}'s queue.`);
        this.draw(performance.now());
      }
      return;
    }

    const abilityHit = this.hitAt(this.abilityHitboxes, point);
    if (abilityHit && this.menuOpen) {
      const actor = this.party.find(member => member.id === this.activeActorId);
      if (!actor) return;
      if (!this.abilityAvailable(actor, abilityHit.ability)) {
        this.callbacks.onStatus(`${abilityHit.ability.name} is not ready.`);
        return;
      }
      this.gesture = {
        mode: "ability",
        actor,
        ability: abilityHit.ability,
        start: point,
        point,
        moved: false,
        pointerId: event.pointerId
      };
      this.app.canvas.setPointerCapture(event.pointerId);
      this.draw(performance.now());
      return;
    }

    const actorHit = this.hitAt(this.actorHitboxes.filter(item => item.side === "party"), point);
    if (actorHit) {
      const actor = this.party.find(member => member.id === actorHit.actorId);
      if (!actor?.alive) return;
      this.activeActorId = actor.id;
      this.menuOpen = true;
      this.gesture = {
        mode: "actor",
        actor,
        ability: null,
        start: point,
        point,
        moved: false,
        pointerId: event.pointerId
      };
      this.app.canvas.setPointerCapture(event.pointerId);
      this.draw(performance.now());
      return;
    }

    this.menuOpen = false;
    this.activeActorId = null;
    this.draw(performance.now());
  }

  pointerMove(event) {
    if (!this.gesture || event.pointerId !== this.gesture.pointerId) return;
    const point = this.pointFromEvent(event);
    this.gesture.point = point;
    this.gesture.moved ||= distance(this.gesture.start, point) > 7;

    if (this.gesture.mode === "actor") {
      const abilityHit = this.hitAt(this.abilityHitboxes, point);
      if (abilityHit && this.abilityAvailable(this.gesture.actor, abilityHit.ability)) {
        this.gesture.mode = "ability";
        this.gesture.ability = abilityHit.ability;
        this.callbacks.onStatus(`Drag ${abilityHit.ability.name} onto a valid target.`);
      }
    }

    this.draw(performance.now());
  }

  pointerUp(event) {
    if (!this.gesture || event.pointerId !== this.gesture.pointerId) return;
    const point = this.pointFromEvent(event);
    const gesture = this.gesture;

    if (gesture.mode === "ability" && gesture.ability) {
      let target = null;
      if (!gesture.moved && gesture.ability.clickTarget === "self") {
        target = gesture.actor;
      } else {
        target = this.findValidTarget(gesture.actor, gesture.ability, point);
      }

      if (target) {
        this.queueAction(gesture.actor, gesture.ability, target);
      } else {
        this.callbacks.onStatus(`${gesture.ability.name} needs a valid target.`);
      }
    }

    if (this.app.canvas.hasPointerCapture(event.pointerId)) {
      this.app.canvas.releasePointerCapture(event.pointerId);
    }
    this.gesture = null;
    this.draw(performance.now());
  }

  cancelGesture() {
    this.gesture = null;
    this.draw(performance.now());
  }

  abilityById(role, abilityId) {
    return ABILITIES[role].find(ability => ability.id === abilityId);
  }

  abilityAvailable(actor, ability) {
    const now = performance.now();
    if (!actor.alive || actor.queue.length >= MAX_QUEUE) return false;
    if ((actor.cooldowns[ability.id] || 0) > now) return false;
    if (ability.uniqueInQueue && actor.queue.some(action => action.abilityId === ability.id)) return false;
    return true;
  }

  findValidTarget(actor, ability, point) {
    const hit = this.hitAt(this.targetHitboxes, point);
    if (!hit) return null;
    const target = hit.side === "party"
      ? this.party.find(member => member.id === hit.actorId)
      : this.enemies.find(enemy => enemy.id === hit.actorId);
    if (!target?.alive) return null;

    if (ability.target === "enemy" && hit.side !== "enemy") return null;
    if (ability.target === "ally" && hit.side !== "party") return null;
    if (ability.target === "ally-other" && (hit.side !== "party" || target.id === actor.id)) return null;
    return target;
  }

  queueAction(actor, ability, target) {
    if (!this.abilityAvailable(actor, ability)) return;
    actor.queue.push({ abilityId: ability.id, targetId: target.id });
    this.callbacks.onStatus(`${actor.name}: ${ability.name} → ${target.name}.`);
    this.menuOpen = false;
    this.activeActorId = null;
    this.callbacks.onPartyChange(this.party);
  }

  startEncounter(party, wave, reward) {
    this.party = party;
    this.wave = wave;
    this.finishState = null;
    this.active = true;
    this.menuOpen = false;
    this.activeActorId = null;
    this.gesture = null;
    const now = performance.now();

    this.party.forEach((member, index) => {
      member.alive = member.hp > 0;
      member.readyAt = now + 900 + index * 250;
      member.threat = member.role === "tank" ? 42 : member.role === "healer" ? 12 : 18;
      member.intercept = null;
      member.queue = [];
    });

    this.applyReward(reward, now);
    this.enemies = this.createEnemies(wave, now);
    this.enemies.forEach(enemy => this.planEnemyIntent(enemy, now));
    this.callbacks.onPartyChange(this.party);
    this.callbacks.onStatus("Drag from a hero through an action, then release on its target.");
    this.draw(now);
  }

  applyReward(reward, now) {
    if (reward === "moonwell") {
      this.party.forEach(member => {
        member.hp = Math.min(member.maxHp, member.hp + Math.ceil(member.maxHp * 0.2));
        member.ward += 8;
      });
      this.party.find(member => member.role === "healer").cooldowns.mend = now;
    } else if (reward === "warcamp") {
      const tank = this.party.find(member => member.role === "tank");
      const ranger = this.party.find(member => member.role === "ranger");
      tank.guard += 28;
      ranger.cooldowns["binding-shot"] = now;
    }
  }

  createEnemies(wave, now) {
    const template = ENCOUNTERS[(wave - 1) % ENCOUNTERS.length];
    const cycle = Math.floor((wave - 1) / ENCOUNTERS.length);
    return template.map((entry, index) => ({
      ...entry,
      id: `enemy-${wave}-${index}`,
      hp: Math.round(entry.maxHp * (1 + cycle * 0.22)),
      maxHp: Math.round(entry.maxHp * (1 + cycle * 0.22)),
      alive: true,
      readyAt: now + 2200 + index * 620,
      moveIndex: index % entry.moves.length,
      intent: null,
      forcedTargetId: null,
      forcedActions: 0,
      stunnedUntil: 0,
      waveScale: 1 + (wave - 1) * 0.055
    }));
  }

  tick() {
    if (!this.ready) return;
    const now = performance.now();
    if (this.active && !this.finishState) this.updateCombat(now);
    if (now - this.lastDraw >= 50) {
      this.draw(now);
      this.lastDraw = now;
    }
  }

  updateCombat(now) {
    this.party.forEach(actor => {
      if (!actor.alive || now < actor.readyAt) return;
      const action = actor.queue[0];
      if (!action) {
        actor.readyAt = now + 260;
        return;
      }
      const ability = this.abilityById(actor.role, action.abilityId);
      const cooldownEnds = actor.cooldowns[ability.id] || 0;
      if (cooldownEnds > now) {
        actor.readyAt = Math.min(cooldownEnds, now + 260);
        return;
      }
      actor.queue.shift();
      this.executePartyAction(actor, action, now);
    });

    this.enemies.forEach(enemy => {
      if (!enemy.alive || now < enemy.readyAt || now < enemy.stunnedUntil) return;
      this.executeEnemyIntent(enemy, now);
    });

    if (this.enemies.every(enemy => !enemy.alive)) {
      this.finishState = "victory";
      this.active = false;
      this.callbacks.onFinish("victory", this.party, this.wave);
    } else if (this.party.every(member => !member.alive)) {
      this.finishState = "defeat";
      this.active = false;
      this.callbacks.onFinish("defeat", this.party, this.wave);
    }
  }

  resolveTarget(action, ability) {
    const collection = ability.target.startsWith("ally") ? this.party : this.enemies;
    let target = collection.find(item => item.id === action.targetId && item.alive);
    if (!target) target = collection.find(item => item.alive);
    return target || null;
  }

  executePartyAction(actor, action, now) {
    const ability = this.abilityById(actor.role, action.abilityId);
    const target = this.resolveTarget(action, ability);
    actor.cooldowns[ability.id] = now + ability.cooldown;
    actor.readyAt = now + actor.speed;
    if (!target) return;

    switch (ability.id) {
      case "taunt":
        target.forcedTargetId = actor.id;
        target.forcedActions = 2;
        target.intent.targetId = actor.id;
        this.dealEnemyDamage(target, 8 + randomInt(0, 4), actor.name);
        actor.threat += 50;
        this.callbacks.onStatus(`${actor.name} taunts ${target.name}. Its intent snaps to the tank.`);
        break;
      case "intercept":
        target.intercept = { byId: actor.id, expiresAt: now + 14000 };
        actor.guard += 8;
        actor.threat += 20;
        this.callbacks.onStatus(`${actor.name} will intercept the next hit against ${target.name}.`);
        break;
      case "mend":
        this.heal(target, 34 + randomInt(0, 8));
        actor.threat += 16;
        this.callbacks.onStatus(`${actor.name} mends ${target.name}.`);
        break;
      case "ward":
        target.ward += 30;
        actor.threat += 11;
        this.callbacks.onStatus(`${target.name} gains a radiant ward.`);
        break;
      case "arc-shot":
        this.dealEnemyDamage(target, 29 + randomInt(0, 7), actor.name);
        actor.threat += 15;
        this.callbacks.onStatus(`${actor.name}'s arrow strikes ${target.name}.`);
        break;
      case "binding-shot":
        this.dealEnemyDamage(target, 12 + randomInt(0, 4), actor.name);
        target.stunnedUntil = Math.max(target.stunnedUntil, now + 4300);
        target.readyAt = Math.max(target.readyAt, target.stunnedUntil + 300);
        actor.threat += 10;
        this.callbacks.onStatus(`${target.name} is bound and crowd-controlled.`);
        break;
      default:
        break;
    }

    this.callbacks.onPartyChange(this.party);
  }

  planEnemyIntent(enemy, now) {
    if (!enemy.alive) return;
    const moveId = enemy.moves[enemy.moveIndex % enemy.moves.length];
    const move = ENEMY_MOVES[moveId];
    const target = move.kind === "party" || move.kind === "volley"
      ? null
      : this.chooseEnemyTarget(enemy);
    enemy.intent = { moveId, targetId: target?.id || null };
    enemy.moveIndex = (enemy.moveIndex + 1) % enemy.moves.length;
    if (enemy.readyAt < now) enemy.readyAt = now + enemy.speed;
  }

  chooseEnemyTarget(enemy) {
    const living = this.party.filter(member => member.alive);
    if (!living.length) return null;
    if (enemy.forcedActions > 0 && enemy.forcedTargetId) {
      const forced = living.find(member => member.id === enemy.forcedTargetId);
      if (forced) return forced;
    }

    if (enemy.type === "cultist" && Math.random() < 0.34) {
      const backline = living.filter(member => member.role !== "tank");
      if (backline.length) return backline[randomInt(0, backline.length - 1)];
    }

    return living
      .map(member => ({ member, score: member.threat + randomInt(0, 18) }))
      .sort((a, b) => b.score - a.score)[0].member;
  }

  executeEnemyIntent(enemy, now) {
    const intent = enemy.intent;
    const move = ENEMY_MOVES[intent.moveId];
    const scale = enemy.waveScale;

    if (move.kind === "party") {
      this.party.filter(member => member.alive).forEach(member => {
        this.dealPartyDamage(member, Math.round((move.base + randomInt(0, 4)) * scale), enemy.name, false);
      });
      this.callbacks.onStatus(`${enemy.name} unleashes ${move.name} across the party.`);
    } else if (move.kind === "volley") {
      const living = this.party.filter(member => member.alive);
      for (let index = 0; index < 3 && living.length; index += 1) {
        const target = living[randomInt(0, living.length - 1)];
        this.dealPartyDamage(target, Math.round((move.base + randomInt(0, 3)) * scale), enemy.name, false);
      }
      this.callbacks.onStatus(`${enemy.name} launches ${move.name}.`);
    } else {
      let target = this.party.find(member => member.id === intent.targetId && member.alive);
      if (!target) target = this.chooseEnemyTarget(enemy);
      if (target) {
        const amount = Math.round((move.base + randomInt(0, 6)) * scale);
        const dealt = this.dealPartyDamage(target, amount, enemy.name, true);
        if (move.kind === "drain") this.heal(enemy, Math.ceil(dealt * 0.62));
        this.callbacks.onStatus(`${enemy.name}: ${move.name} → ${target.name}.`);
      }
    }

    if (enemy.forcedActions > 0) {
      enemy.forcedActions -= 1;
      if (enemy.forcedActions <= 0) enemy.forcedTargetId = null;
    }

    enemy.readyAt = now + enemy.speed;
    this.planEnemyIntent(enemy, now);
    this.callbacks.onPartyChange(this.party);
  }

  dealEnemyDamage(enemy, amount) {
    if (!enemy.alive) return 0;
    const dealt = Math.min(enemy.hp, Math.max(0, Math.round(amount)));
    enemy.hp -= dealt;
    enemy.flashUntil = performance.now() + 180;
    if (enemy.hp <= 0) {
      enemy.hp = 0;
      enemy.alive = false;
      enemy.intent = null;
      this.callbacks.onStatus(`${enemy.name} is defeated.`);
    }
    return dealt;
  }

  dealPartyDamage(target, amount, sourceName, interceptable) {
    if (!target.alive) return 0;
    let recipient = target;
    let incoming = amount;

    if (
      interceptable &&
      target.intercept &&
      target.intercept.expiresAt > performance.now()
    ) {
      const tank = this.party.find(member => member.id === target.intercept.byId && member.alive);
      if (tank && tank.id !== target.id) {
        recipient = tank;
        incoming = Math.ceil(incoming * 0.64);
        target.intercept = null;
        tank.guard += 5;
        this.callbacks.onStatus(`${tank.name} intercepts the hit meant for ${target.name}.`);
      }
    }

    if (recipient.guard > 0) {
      const absorbed = Math.min(recipient.guard, incoming);
      recipient.guard -= absorbed;
      incoming -= absorbed;
    }

    if (recipient.ward > 0 && incoming > 0) {
      const absorbed = Math.min(recipient.ward, incoming);
      recipient.ward -= absorbed;
      incoming -= absorbed;
    }

    const dealt = Math.min(recipient.hp, Math.max(0, Math.round(incoming)));
    recipient.hp -= dealt;
    recipient.flashUntil = performance.now() + 180;
    if (recipient.hp <= 0) {
      recipient.hp = 0;
      recipient.alive = false;
      recipient.queue = [];
      recipient.intercept = null;
      this.callbacks.onStatus(`${recipient.name} falls to ${sourceName}.`);
    }
    return dealt;
  }

  heal(target, amount) {
    if (!target.alive) return 0;
    const before = target.hp;
    target.hp = Math.min(target.maxHp, target.hp + Math.round(amount));
    target.healUntil = performance.now() + 280;
    return target.hp - before;
  }

  setActive(active) {
    this.active = active;
  }
}

installCombatRenderer(CombatScene);
