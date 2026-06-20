import { PARTY_GLYPHS, dom, clamp, createParty } from "./data.js";
import { TravelScene } from "./travel.js";
import { CombatScene } from "./combat.js";

class TrinityGame {
  constructor() {
    this.wave = 1;
    this.party = createParty();
    this.route = null;
    this.result = null;
    this.travel = new TravelScene(dom.travelCanvas, route => this.completeTravel(route));
    this.combat = new CombatScene(dom.combatHost, {
      onStatus: message => this.setCombatStatus(message),
      onPartyChange: party => this.renderPartyStrip(party),
      onFinish: (result, party, wave) => this.finishEncounter(result, party, wave)
    });
    this.bindEvents();
    this.startTravel();
  }

  bindEvents() {
    dom.travelStep.addEventListener("click", () => this.travel.advance());
    dom.enterCombat.addEventListener("click", () => this.enterCombat());
    dom.resultAction.addEventListener("click", () => {
      dom.resultDialog.close();
      if (this.result === "victory") {
        this.wave += 1;
        this.startTravel();
      } else {
        this.wave = 1;
        this.party = createParty();
        this.startTravel();
      }
    });
    dom.resultDialog.addEventListener("cancel", event => event.preventDefault());
  }

  startTravel() {
    this.route = null;
    this.result = null;
    dom.stage.dataset.phase = "travel";
    dom.travelHud.hidden = false;
    dom.combatHud.hidden = true;
    dom.partyStrip.hidden = true;
    dom.routeResult.hidden = true;
    dom.enterCombat.hidden = true;
    dom.travelStep.hidden = false;
    dom.phaseLabel.textContent = "Journey";
    dom.waveLabel.textContent = String(this.wave);
    dom.travelTitle.textContent = `Approach encounter ${this.wave}`;
    dom.travelCopy.textContent = "Drag the party standard along the trail. At the fork, choose the Moonwell or the War Camp.";
    this.travel.setActive(true);
    this.travel.reset(this.wave);
    this.combat.setActive(false);
  }

  completeTravel(route) {
    this.route = route;
    dom.routeResult.hidden = false;
    dom.enterCombat.hidden = false;
    dom.travelStep.hidden = true;

    if (route === "moonwell") {
      dom.routeResultIcon.textContent = "✦";
      dom.routeResultTitle.textContent = "Moonwell blessing";
      dom.routeResultCopy.textContent = "Restore 20% health and grant a small ward to every hero.";
    } else {
      dom.routeResultIcon.textContent = "◆";
      dom.routeResultTitle.textContent = "War Camp preparation";
      dom.routeResultCopy.textContent = "The tank gains guard and Binding Shot begins ready.";
    }
  }

  enterCombat() {
    if (!this.route || !this.combat.ready) {
      if (!this.combat.ready) dom.travelCopy.textContent = "The encounter is still being prepared. Continue moving the party standard.";
      return;
    }
    dom.stage.dataset.phase = "combat";
    dom.travelHud.hidden = true;
    dom.combatHud.hidden = false;
    dom.partyStrip.hidden = false;
    dom.phaseLabel.textContent = "Encounter";
    dom.waveLabel.textContent = String(this.wave);
    this.travel.setActive(false);
    this.combat.startEncounter(this.party, this.wave, this.route);
    this.renderPartyStrip(this.party);
  }

  setCombatStatus(message) {
    dom.combatFeed.textContent = message;
  }

  renderPartyStrip(party) {
    dom.partyStrip.innerHTML = party.map(member => {
      const ratio = clamp(member.hp / member.maxHp, 0, 1) * 100;
      const color = member.role === "tank" ? "var(--tank)" : member.role === "healer" ? "var(--healer)" : "var(--ranger)";
      return `
        <div class="party-strip__member" style="--member-color:${color}">
          <span class="party-strip__icon" aria-hidden="true">${PARTY_GLYPHS[member.role]}</span>
          <span class="party-strip__copy">
            <strong>${member.name} · ${Math.ceil(member.hp)}/${member.maxHp}</strong>
            <span class="party-strip__bar" aria-hidden="true"><span style="width:${ratio}%"></span></span>
          </span>
        </div>
      `;
    }).join("");
  }

  finishEncounter(result, party, wave) {
    this.party = party;
    this.result = result;
    this.renderPartyStrip(party);

    if (result === "victory") {
      dom.resultIcon.textContent = "✦";
      dom.resultEyebrow.textContent = "Encounter complete";
      dom.resultTitle.textContent = "Victory";
      dom.resultCopy.textContent = `Encounter ${wave} is cleared. The party keeps its current health and continues along the map.`;
      dom.resultAction.textContent = "Continue journey";
    } else {
      dom.resultIcon.textContent = "◆";
      dom.resultEyebrow.textContent = "The party has fallen";
      dom.resultTitle.textContent = "Defeat";
      dom.resultCopy.textContent = `You reached encounter ${wave}. Watch enemy target lines and queue Intercept or Binding Shot before the cast completes.`;
      dom.resultAction.textContent = "Restart journey";
    }

    if (!dom.resultDialog.open) dom.resultDialog.showModal();
  }
}

new TrinityGame();
