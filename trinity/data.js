const MAX_QUEUE = 3;
const PARTY_COLORS = {
  tank: 0x4ea8ff,
  healer: 0x7fe39a,
  ranger: 0xe76363
};

const PARTY_GLYPHS = {
  tank: "◆",
  healer: "✦",
  ranger: "➶"
};

const ABILITIES = {
  tank: [
    {
      id: "taunt",
      name: "Taunt",
      glyph: "!",
      color: 0x438ed8,
      target: "enemy",
      description: "Force one enemy to attack the tank for its next two actions.",
      cooldown: 4200
    },
    {
      id: "intercept",
      name: "Intercept",
      glyph: "◆",
      color: 0x62b9ff,
      target: "ally-other",
      description: "Take the next targeted hit for an ally at reduced damage.",
      cooldown: 6800
    }
  ],
  healer: [
    {
      id: "mend",
      name: "Mend",
      glyph: "+",
      color: 0x72df8f,
      target: "ally",
      clickTarget: "self",
      description: "Heal an ally. Tap the action instead of dragging to heal self.",
      cooldown: 1800
    },
    {
      id: "ward",
      name: "Radiant Ward",
      glyph: "✦",
      color: 0xf0dc73,
      target: "ally",
      description: "Shield an ally from the next 30 damage.",
      cooldown: 5200
    }
  ],
  ranger: [
    {
      id: "arc-shot",
      name: "Arc Shot",
      glyph: "➶",
      color: 0xd66a47,
      target: "enemy",
      description: "A fast ranged attack against one enemy.",
      cooldown: 1300
    },
    {
      id: "binding-shot",
      name: "Binding Shot",
      glyph: "⌁",
      color: 0x8dc7e8,
      target: "enemy",
      description: "Interrupt and crowd-control an enemy. Long cooldown.",
      cooldown: 14000,
      uniqueInQueue: true
    }
  ]
};

const ENEMY_MOVES = {
  maul: { name: "Maul", glyph: "爪", kind: "single", base: 22 },
  crush: { name: "Crushing Blow", glyph: "⬇", kind: "single", base: 29 },
  bolt: { name: "Shadow Bolt", glyph: "✧", kind: "single", base: 18 },
  howl: { name: "Dread Howl", glyph: "◉", kind: "party", base: 10 },
  volley: { name: "Bone Volley", glyph: "✣", kind: "volley", base: 9 },
  drain: { name: "Life Drain", glyph: "◌", kind: "drain", base: 16 }
};

const ENCOUNTERS = [
  [
    { name: "Mirefang", type: "beast", glyph: "♞", maxHp: 128, speed: 3600, moves: ["maul", "howl"] }
  ],
  [
    { name: "Ashbound", type: "cultist", glyph: "♝", maxHp: 88, speed: 3300, moves: ["bolt", "drain"] },
    { name: "Rotscale", type: "beast", glyph: "♞", maxHp: 96, speed: 3100, moves: ["maul", "volley"] }
  ],
  [
    { name: "Grave Warden", type: "brute", glyph: "♜", maxHp: 148, speed: 3900, moves: ["crush", "maul"] },
    { name: "Hexweaver", type: "cultist", glyph: "♝", maxHp: 86, speed: 3250, moves: ["bolt", "howl", "drain"] }
  ],
  [
    { name: "The Hollow Regent", type: "boss", glyph: "♛", maxHp: 260, speed: 3500, moves: ["howl", "crush", "drain", "volley"] }
  ]
];

const dom = {
  stage: document.querySelector("#stage"),
  travelCanvas: document.querySelector("#travel-canvas"),
  combatHost: document.querySelector("#combat-host"),
  travelHud: document.querySelector("#travel-hud"),
  combatHud: document.querySelector("#combat-hud"),
  phaseLabel: document.querySelector("#phase-label"),
  waveLabel: document.querySelector("#wave-label"),
  travelTitle: document.querySelector("#travel-title"),
  travelCopy: document.querySelector("#travel-copy"),
  routeResult: document.querySelector("#route-result"),
  routeResultIcon: document.querySelector("#route-result-icon"),
  routeResultTitle: document.querySelector("#route-result-title"),
  routeResultCopy: document.querySelector("#route-result-copy"),
  travelStep: document.querySelector("#travel-step"),
  enterCombat: document.querySelector("#enter-combat"),
  combatFeed: document.querySelector("#combat-feed"),
  partyStrip: document.querySelector("#party-strip"),
  resultDialog: document.querySelector("#result-dialog"),
  resultIcon: document.querySelector("#result-icon"),
  resultEyebrow: document.querySelector("#result-eyebrow"),
  resultTitle: document.querySelector("#result-title"),
  resultCopy: document.querySelector("#result-copy"),
  resultAction: document.querySelector("#result-action")
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, amount) {
  return a + (b - a) * amount;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function createParty() {
  const now = performance.now();
  return [
    {
      id: "tank",
      role: "tank",
      name: "Bastion",
      maxHp: 185,
      hp: 185,
      speed: 2700,
      readyAt: now + 1100,
      alive: true,
      threat: 42,
      guard: 0,
      ward: 0,
      intercept: null,
      queue: [],
      cooldowns: {}
    },
    {
      id: "healer",
      role: "healer",
      name: "Lumen",
      maxHp: 112,
      hp: 112,
      speed: 3100,
      readyAt: now + 1350,
      alive: true,
      threat: 12,
      guard: 0,
      ward: 0,
      intercept: null,
      queue: [],
      cooldowns: {}
    },
    {
      id: "ranger",
      role: "ranger",
      name: "Vesper",
      maxHp: 124,
      hp: 124,
      speed: 2350,
      readyAt: now + 1200,
      alive: true,
      threat: 18,
      guard: 0,
      ward: 0,
      intercept: null,
      queue: [],
      cooldowns: {}
    }
  ];
}

export {
  MAX_QUEUE,
  PARTY_COLORS,
  PARTY_GLYPHS,
  ABILITIES,
  ENEMY_MOVES,
  ENCOUNTERS,
  dom,
  clamp,
  lerp,
  randomInt,
  distance,
  createParty
};
