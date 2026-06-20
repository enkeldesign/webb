(() => {
  "use strict";

  const MAX_QUEUE = 3;
  const PARTY_ORDER = ["tank", "healer", "ranger"];
  const CLASS_COLORS = {
    tank: "var(--tank)",
    healer: "var(--healer)",
    ranger: "var(--ranger)"
  };

  const abilityBook = {
    tank: [
      {
        id: "shield-slam",
        name: "Shield Slam",
        icon: "◆",
        description: "Damage the front enemy and gain threat.",
        execute(actor) {
          const target = firstLivingEnemy();
          if (!target) return;
          dealDamage(target, 18 + randomInt(0, 5), actor.name);
          actor.threat += 24;
          actor.guard = Math.max(actor.guard, 4);
          addLog(`${actor.name} slams ${target.name}.`);
        }
      },
      {
        id: "bulwark",
        name: "Bulwark",
        icon: "⬟",
        description: "Protect the party and reduce incoming damage.",
        execute(actor) {
          actor.guard += 24;
          actor.threat += 18;
          state.party.forEach(member => {
            if (member.alive && member.id !== actor.id) member.ward += 7;
          });
          addLog(`${actor.name} raises a protective bulwark.`);
          showBattleMessage("Bulwark: incoming damage reduced");
        }
      }
    ],
    healer: [
      {
        id: "mend",
        name: "Mend",
        icon: "+",
        description: "Heal the most injured party member.",
        execute(actor) {
          const target = livingParty()
            .sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];
          if (!target) return;
          heal(target, 24 + randomInt(0, 7), actor.name);
          addLog(`${actor.name} mends ${target.name}.`);
        }
      },
      {
        id: "radiant-wave",
        name: "Radiant Wave",
        icon: "✦",
        description: "Heal all allies and scorch every enemy.",
        execute(actor) {
          livingParty().forEach(member => heal(member, 10 + randomInt(0, 4), actor.name));
          livingEnemies().forEach(enemy => dealDamage(enemy, 6 + randomInt(0, 3), actor.name));
          addLog(`${actor.name} releases a radiant wave.`);
        }
      }
    ],
    ranger: [
      {
        id: "quick-shot",
        name: "Quick Shot",
        icon: "➶",
        description: "Fast, reliable damage to the front enemy.",
        execute(actor) {
          const target = firstLivingEnemy();
          if (!target) return;
          dealDamage(target, 22 + randomInt(0, 6), actor.name);
          actor.threat += 8;
          addLog(`${actor.name} fires at ${target.name}.`);
        }
      },
      {
        id: "piercing-volley",
        name: "Piercing Volley",
        icon: "⇢",
        description: "Damage every enemy. Stronger against wounded foes.",
        execute(actor) {
          livingEnemies().forEach(enemy => {
            const bonus = enemy.hp / enemy.maxHp < 0.5 ? 6 : 0;
            dealDamage(enemy, 12 + bonus + randomInt(0, 4), actor.name);
          });
          actor.threat += 12;
          addLog(`${actor.name} looses a piercing volley.`);
        }
      }
    ]
  };

  const enemyMoves = {
    claw: {
      name: "Claw",
      icon: "爪",
      execute(enemy) {
        const target = chooseEnemyTarget(enemy);
        if (!target) return;
        dealDamage(target, scaleEnemyDamage(enemy, 13, 5), enemy.name);
        addLog(`${enemy.name} claws ${target.name}.`);
      }
    },
    crush: {
      name: "Crush",
      icon: "⬇",
      execute(enemy) {
        const target = chooseEnemyTarget(enemy);
        if (!target) return;
        dealDamage(target, scaleEnemyDamage(enemy, 21, 6), enemy.name);
        target.readyAt += 480;
        addLog(`${enemy.name} crushes ${target.name}, delaying their action.`);
      }
    },
    howl: {
      name: "Dread Howl",
      icon: "◉",
      execute(enemy) {
        livingParty().forEach(member => dealDamage(member, scaleEnemyDamage(enemy, 8, 3), enemy.name));
        addLog(`${enemy.name}'s howl hits the whole party.`);
        showBattleMessage("Dread Howl: party-wide damage");
      }
    },
    siphon: {
      name: "Siphon",
      icon: "◌",
      execute(enemy) {
        const target = chooseEnemyTarget(enemy);
        if (!target) return;
        const amount = dealDamage(target, scaleEnemyDamage(enemy, 11, 4), enemy.name);
        heal(enemy, Math.ceil(amount * 0.7), enemy.name);
        addLog(`${enemy.name} siphons life from ${target.name}.`);
      }
    },
    barrage: {
      name: "Barrage",
      icon: "✣",
      execute(enemy) {
        const targets = livingParty();
        if (!targets.length) return;
        for (let i = 0; i < 3; i += 1) {
          const target = targets[randomInt(0, targets.length - 1)];
          dealDamage(target, scaleEnemyDamage(enemy, 6, 3), enemy.name);
        }
        addLog(`${enemy.name} launches a chaotic barrage.`);
      }
    }
  };

  const waveTemplates = [
    [
      { type: "brute", name: "Mire Brute", icon: "♜", maxHp: 110, speed: 3400, moves: ["claw", "crush"] }
    ],
    [
      { type: "stalker", name: "Ash Stalker", icon: "♞", maxHp: 72, speed: 2750, moves: ["claw", "siphon"] },
      { type: "caller", name: "Dusk Caller", icon: "♝", maxHp: 66, speed: 3600, moves: ["howl", "claw"] }
    ],
    [
      { type: "brute", name: "Iron Brute", icon: "♜", maxHp: 126, speed: 3350, moves: ["crush", "claw"] },
      { type: "stalker", name: "Cinder Imp", icon: "♟", maxHp: 54, speed: 2450, moves: ["barrage", "claw"] }
    ],
    [
      { type: "boss", name: "The Hollow King", icon: "♛", maxHp: 205, speed: 3300, moves: ["howl", "crush", "siphon", "barrage"] }
    ]
  ];

  const state = {
    selectedClass: "tank",
    wave: 1,
    paused: false,
    ended: false,
    party: [],
    enemies: [],
    lastFrame: performance.now(),
    result: null,
    dirty: true,
    effects: []
  };

  const elements = {
    partyLine: document.querySelector("#party-line"),
    enemyLine: document.querySelector("#enemy-line"),
    abilityGrid: document.querySelector("#ability-grid"),
    commandQueue: document.querySelector("#command-queue"),
    clearQueue: document.querySelector("#clear-queue"),
    selectedClassName: document.querySelector("#selected-class-name"),
    selectedReady: document.querySelector("#selected-ready"),
    classControls: document.querySelector("#class-controls"),
    battleMessage: document.querySelector("#battle-message"),
    combatLog: document.querySelector("#combat-log"),
    waveNumber: document.querySelector("#wave-number"),
    resultDialog: document.querySelector("#result-dialog"),
    dialogIcon: document.querySelector("#dialog-icon"),
    dialogTitle: document.querySelector("#dialog-title"),
    dialogCopy: document.querySelector("#dialog-copy"),
    dialogAction: document.querySelector("#dialog-action")
  };

  function createParty() {
    const now = performance.now();
    state.party = [
      createCombatant({ id: "tank", name: "Bastion", className: "tank", icon: "◆", maxHp: 150, speed: 2800, readyAt: now + 1000, threat: 55 }),
      createCombatant({ id: "healer", name: "Lumen", className: "healer", icon: "✦", maxHp: 95, speed: 3200, readyAt: now + 1500, threat: 16 }),
      createCombatant({ id: "ranger", name: "Vesper", className: "ranger", icon: "➶", maxHp: 105, speed: 2400, readyAt: now + 1200, threat: 22 })
    ];
  }

  function createCombatant(config) {
    return {
      ...config,
      hp: config.maxHp,
      alive: true,
      queue: [],
      ward: 0,
      guard: 0,
      actingUntil: 0,
      element: null
    };
  }

  function createWave(waveNumber) {
    const now = performance.now();
    const template = waveTemplates[(waveNumber - 1) % waveTemplates.length];
    const cycle = Math.floor((waveNumber - 1) / waveTemplates.length);
    state.enemies = template.map((enemy, index) => {
      const hpScale = 1 + cycle * 0.24;
      return createCombatant({
        ...enemy,
        id: `enemy-${waveNumber}-${index}`,
        className: "enemy",
        maxHp: Math.round(enemy.maxHp * hpScale),
        readyAt: now + 1750 + (index * 520),
        moveIndex: randomInt(0, enemy.moves.length - 1),
        waveScale: 1 + (waveNumber - 1) * 0.06
      });
    });
  }

  function resetGame() {
    state.wave = 1;
    state.ended = false;
    state.paused = false;
    state.result = null;
    state.selectedClass = "tank";
    state.lastFrame = performance.now();
    state.effects = [];
    state.dirty = true;
    createParty();
    createWave(state.wave);
    seedQueues();
    elements.combatLog.innerHTML = "";
    addLog("The party enters the breach.");
    renderAll();
    showBattleMessage("Queue abilities. Your party acts automatically.");
  }

  function seedQueues() {
    state.party.find(member => member.id === "tank").queue.push("bulwark", "shield-slam");
    state.party.find(member => member.id === "healer").queue.push("mend", "radiant-wave");
    state.party.find(member => member.id === "ranger").queue.push("quick-shot", "piercing-volley");
  }

  function startNextWave() {
    state.wave += 1;
    state.paused = false;
    state.result = null;
    state.dirty = true;
    elements.waveNumber.textContent = state.wave;

    state.party.forEach(member => {
      member.hp = Math.min(member.maxHp, member.hp + Math.ceil(member.maxHp * 0.22));
      member.alive = member.hp > 0;
      member.guard = 0;
      member.ward = 0;
      member.threat = member.id === "tank" ? 55 : member.id === "healer" ? 16 : 22;
      member.readyAt = performance.now() + 900 + randomInt(0, 550);
      if (member.queue.length === 0) {
        member.queue.push(abilityBook[member.id][0].id);
      }
    });

    createWave(state.wave);
    addLog(`Wave ${state.wave} approaches.`);
    renderAll();
    showBattleMessage(`Wave ${state.wave}: hold the line`);
  }

  function abilityById(className, id) {
    return abilityBook[className].find(ability => ability.id === id);
  }

  function livingParty() {
    return state.party.filter(member => member.alive);
  }

  function livingEnemies() {
    return state.enemies.filter(enemy => enemy.alive);
  }

  function firstLivingEnemy() {
    return livingEnemies()[0] || null;
  }

  function chooseEnemyTarget(enemy) {
    const party = livingParty();
    if (!party.length) return null;

    if (enemy.type === "stalker" && Math.random() < 0.36) {
      const backline = party.filter(member => member.id !== "tank");
      if (backline.length) return backline[randomInt(0, backline.length - 1)];
    }

    return party
      .map(member => ({ member, score: member.threat + randomInt(0, 18) }))
      .sort((a, b) => b.score - a.score)[0].member;
  }

  function scaleEnemyDamage(enemy, base, variance) {
    return Math.round((base + randomInt(0, variance)) * enemy.waveScale);
  }

  function dealDamage(target, rawAmount, sourceName) {
    if (!target?.alive) return 0;
    let amount = rawAmount;

    if (target.guard > 0) {
      const absorbed = Math.min(target.guard, amount);
      target.guard -= absorbed;
      amount -= absorbed;
    }

    if (target.ward > 0 && amount > 0) {
      const absorbed = Math.min(target.ward, amount);
      target.ward -= absorbed;
      amount -= absorbed;
    }

    amount = Math.max(0, Math.round(amount));
    target.hp = Math.max(0, target.hp - amount);
    showFloatingNumber(target, amount === 0 ? "Blocked" : `−${amount}`, "damage-pop");

    if (target.hp === 0) {
      target.alive = false;
      target.queue = [];
      addLog(`${target.name} falls.`);
      if (sourceName) showBattleMessage(`${sourceName} defeats ${target.name}`);
    }

    return amount;
  }

  function heal(target, rawAmount) {
    if (!target?.alive) return 0;
    const before = target.hp;
    target.hp = Math.min(target.maxHp, target.hp + Math.round(rawAmount));
    const actual = target.hp - before;
    if (actual > 0) showFloatingNumber(target, `+${actual}`, "heal-pop");
    return actual;
  }

  function showFloatingNumber(target, text, className) {
    state.effects.push({ targetId: target.id, text, className });
  }

  function flushEffects() {
    const effects = state.effects.splice(0);
    effects.forEach(effect => {
      const target = [...state.party, ...state.enemies].find(item => item.id === effect.targetId);
      if (!target?.element) return;
      const pop = document.createElement("span");
      pop.className = effect.className;
      pop.textContent = effect.text;
      target.element.append(pop);
      window.setTimeout(() => pop.remove(), 850);
    });
  }

  function executePartyAction(member, now) {
    if (!member.alive) return;
    const abilityId = member.queue.shift();

    if (!abilityId) {
      member.readyAt = now + 450;
      return;
    }

    const ability = abilityById(member.id, abilityId);
    if (!ability) return;
    member.actingUntil = now + 260;
    ability.execute(member);
    member.readyAt = now + member.speed;
    member.threat = Math.max(member.id === "tank" ? 32 : 8, Math.round(member.threat * 0.94));
    state.dirty = true;
  }

  function executeEnemyAction(enemy, now) {
    if (!enemy.alive) return;
    const moveId = enemy.moves[enemy.moveIndex];
    const move = enemyMoves[moveId];
    enemy.actingUntil = now + 300;
    move.execute(enemy);
    enemy.moveIndex = (enemy.moveIndex + 1) % enemy.moves.length;
    if (Math.random() < 0.18 && enemy.moves.length > 2) {
      enemy.moveIndex = randomInt(0, enemy.moves.length - 1);
    }
    enemy.readyAt = now + enemy.speed;
    state.dirty = true;
  }

  function update(now) {
    if (state.paused || state.ended) return;

    state.party.forEach(member => {
      if (member.alive && now >= member.readyAt) executePartyAction(member, now);
    });

    state.enemies.forEach(enemy => {
      if (enemy.alive && now >= enemy.readyAt) executeEnemyAction(enemy, now);
    });

    if (livingEnemies().length === 0) {
      finishWave(true);
    } else if (livingParty().length === 0) {
      finishWave(false);
    }
  }

  function finishWave(victory) {
    state.paused = true;
    state.result = victory ? "victory" : "defeat";

    if (victory) {
      elements.dialogIcon.textContent = "✦";
      elements.dialogTitle.textContent = "Wave cleared";
      elements.dialogCopy.textContent = `The party survived wave ${state.wave}. Everyone recovers 22% health before the next fight.`;
      elements.dialogAction.textContent = "Next wave";
    } else {
      state.ended = true;
      elements.dialogIcon.textContent = "◆";
      elements.dialogTitle.textContent = "Party defeated";
      elements.dialogCopy.textContent = `You reached wave ${state.wave}. Try keeping Bulwark and Mend ready for enemy telegraphs.`;
      elements.dialogAction.textContent = "Restart run";
    }

    if (!elements.resultDialog.open) elements.resultDialog.showModal();
  }

  function renderAll(now = performance.now()) {
    renderCombatants(now);
    renderTabs();
    renderSelectedControls(now);
    elements.waveNumber.textContent = state.wave;
    flushEffects();
    state.dirty = false;
  }

  function renderCombatants(now) {
    elements.partyLine.innerHTML = "";
    state.party.forEach(member => {
      const card = createCombatantCard(member, false, now);
      member.element = card;
      elements.partyLine.append(card);
    });

    elements.enemyLine.innerHTML = "";
    const livingLayout = state.enemies;
    const appendSpacer = () => {
      const spacer = document.createElement("div");
      spacer.setAttribute("aria-hidden", "true");
      elements.enemyLine.append(spacer);
    };

    if (livingLayout.length === 1) appendSpacer();
    livingLayout.forEach((enemy, index) => {
      const card = createCombatantCard(enemy, true, now);
      enemy.element = card;
      elements.enemyLine.append(card);
      if (livingLayout.length === 2 && index === 0) appendSpacer();
    });
    if (livingLayout.length === 1) appendSpacer();
  }

  function createCombatantCard(combatant, isEnemy, now) {
    const card = document.createElement("article");
    card.className = `combatant ${combatant.className}`;
    card.dataset.id = combatant.id;
    card.dataset.state = !combatant.alive ? "defeated" : now < combatant.actingUntil ? "acting" : "idle";

    const hpPercent = Math.max(0, (combatant.hp / combatant.maxHp) * 100);
    const actionPercent = combatant.alive
      ? Math.max(0, Math.min(100, 100 - (((combatant.readyAt - now) / combatant.speed) * 100)))
      : 0;

    const queueMarkup = isEnemy
      ? `<div class="enemy-intent" title="Next move">${enemyMoves[combatant.moves[combatant.moveIndex]].icon} ${enemyMoves[combatant.moves[combatant.moveIndex]].name}</div>`
      : `<div class="mini-queue" aria-label="Queued abilities">${[0, 1, 2].map(index => {
          const abilityId = combatant.queue[index];
          const ability = abilityId ? abilityById(combatant.id, abilityId) : null;
          return `<span title="${ability ? ability.name : "Empty queue slot"}">${ability ? ability.icon : ""}</span>`;
        }).join("")}</div>`;

    card.innerHTML = `
      <div class="combatant-portrait" aria-hidden="true">${combatant.icon}</div>
      <div class="combatant-name">${combatant.name}</div>
      <div class="health-row">
        <div class="health-bar" aria-hidden="true"><span style="width:${hpPercent}%"></span></div>
        <span class="health-value">${Math.ceil(combatant.hp)}/${combatant.maxHp}</span>
      </div>
      <div class="action-bar" aria-hidden="true"><span style="width:${actionPercent}%"></span></div>
      ${queueMarkup}
    `;

    const status = isEnemy
      ? `${combatant.name}, ${Math.ceil(combatant.hp)} of ${combatant.maxHp} health. Next move: ${enemyMoves[combatant.moves[combatant.moveIndex]].name}.`
      : `${combatant.name}, ${Math.ceil(combatant.hp)} of ${combatant.maxHp} health. ${combatant.queue.length} abilities queued.`;
    card.setAttribute("aria-label", status);

    return card;
  }

  function renderTimers(now) {
    [...state.party, ...state.enemies].forEach(combatant => {
      const card = combatant.element;
      if (!card) return;
      card.dataset.state = !combatant.alive ? "defeated" : now < combatant.actingUntil ? "acting" : "idle";
      const bar = card.querySelector(".action-bar > span");
      if (bar) {
        const percent = combatant.alive
          ? Math.max(0, Math.min(100, 100 - (((combatant.readyAt - now) / combatant.speed) * 100)))
          : 0;
        bar.style.width = `${percent}%`;
      }
    });

    const selected = state.party.find(item => item.id === state.selectedClass);
    elements.selectedReady.textContent = selected.alive
      ? `${Math.max(0, (selected.readyAt - now) / 1000).toFixed(1)}s`
      : "Down";
  }

  function renderTabs() {
    document.querySelectorAll(".class-tab").forEach(tab => {
      const className = tab.dataset.class;
      const member = state.party.find(item => item.id === className);
      const selected = className === state.selectedClass;
      const hpPercent = Math.max(0, Math.round((member.hp / member.maxHp) * 100));
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      tab.disabled = false;
      document.querySelector(`#tab-${className}-hp`).textContent = hpPercent;
      document.querySelector(`#tab-${className}-health-fill`).style.width = `${hpPercent}%`;
    });
  }

  function renderSelectedControls(now) {
    const member = state.party.find(item => item.id === state.selectedClass);
    const selectedTab = document.querySelector(`#tab-${state.selectedClass}`);
    elements.classControls.setAttribute("aria-labelledby", selectedTab.id);
    elements.selectedClassName.textContent = capitalize(state.selectedClass);
    elements.selectedClassName.style.color = CLASS_COLORS[state.selectedClass];
    elements.selectedReady.textContent = member.alive
      ? `${Math.max(0, (member.readyAt - now) / 1000).toFixed(1)}s`
      : "Down";

    elements.abilityGrid.style.setProperty("--class-color", CLASS_COLORS[state.selectedClass]);
    elements.commandQueue.style.setProperty("--class-color", CLASS_COLORS[state.selectedClass]);
    elements.abilityGrid.innerHTML = "";

    abilityBook[state.selectedClass].forEach(ability => {
      const button = document.createElement("button");
      button.className = "ability-button";
      button.type = "button";
      button.disabled = !member.alive || member.queue.length >= MAX_QUEUE || state.ended;
      button.dataset.ability = ability.id;
      button.innerHTML = `
        <span class="ability-icon" aria-hidden="true">${ability.icon}</span>
        <span class="ability-copy">
          <strong>${ability.name}</strong>
          <span>${ability.description}</span>
        </span>
      `;
      button.addEventListener("click", () => queueAbility(state.selectedClass, ability.id));
      elements.abilityGrid.append(button);
    });

    elements.commandQueue.innerHTML = [0, 1, 2].map(index => {
      const abilityId = member.queue[index];
      const ability = abilityId ? abilityById(member.id, abilityId) : null;
      return `
        <div class="queue-slot ${ability ? "filled" : ""}">
          <span class="queue-slot-index">${index + 1}</span>
          <span class="queue-slot-name">${ability ? `${ability.icon} ${ability.name}` : "Empty"}</span>
        </div>
      `;
    }).join("");

    elements.clearQueue.disabled = member.queue.length === 0 || state.ended;
  }

  function queueAbility(className, abilityId) {
    const member = state.party.find(item => item.id === className);
    if (!member?.alive || member.queue.length >= MAX_QUEUE || state.ended) return;
    member.queue.push(abilityId);
    const ability = abilityById(className, abilityId);
    addLog(`${ability.name} queued for ${member.name}.`);
    renderAll();
  }

  function clearSelectedQueue() {
    const member = state.party.find(item => item.id === state.selectedClass);
    if (!member || member.queue.length === 0) return;
    member.queue = [];
    addLog(`${member.name}'s queue cleared.`);
    renderAll();
  }

  function selectClass(className, focus = false) {
    if (!PARTY_ORDER.includes(className)) return;
    state.selectedClass = className;
    renderTabs();
    renderSelectedControls(performance.now());
    if (focus) document.querySelector(`#tab-${className}`).focus();
  }

  function addLog(message) {
    const item = document.createElement("li");
    item.textContent = message;
    elements.combatLog.append(item);
    while (elements.combatLog.children.length > 3) {
      elements.combatLog.firstElementChild.remove();
    }
  }

  function showBattleMessage(message) {
    elements.battleMessage.textContent = message;
  }

  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function capitalize(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function bindEvents() {
    document.querySelectorAll(".class-tab").forEach(tab => {
      tab.addEventListener("click", () => selectClass(tab.dataset.class));
      tab.addEventListener("keydown", event => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const currentIndex = PARTY_ORDER.indexOf(state.selectedClass);
        let nextIndex = currentIndex;
        if (event.key === "ArrowLeft") nextIndex = (currentIndex + PARTY_ORDER.length - 1) % PARTY_ORDER.length;
        if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % PARTY_ORDER.length;
        if (event.key === "Home") nextIndex = 0;
        if (event.key === "End") nextIndex = PARTY_ORDER.length - 1;
        selectClass(PARTY_ORDER[nextIndex], true);
      });
    });

    elements.clearQueue.addEventListener("click", clearSelectedQueue);
    elements.dialogAction.addEventListener("click", () => {
      elements.resultDialog.close();
      if (state.result === "victory") startNextWave();
      else resetGame();
    });

    elements.resultDialog.addEventListener("cancel", event => event.preventDefault());
  }

  function gameLoop(now) {
    update(now);
    if (state.dirty) renderAll(now);
    renderTimers(now);
    state.lastFrame = now;
    window.requestAnimationFrame(gameLoop);
  }

  bindEvents();
  resetGame();
  window.requestAnimationFrame(gameLoop);
})();
