// ── Game Configuration & Data Definitions ──

export const TILE_SIZE = 32;
export const MAP_COLS = 120;
export const MAP_ROWS = 90;
export const MAP_WIDTH = MAP_COLS * TILE_SIZE;
export const MAP_HEIGHT = MAP_ROWS * TILE_SIZE;
export const GRID_SIZE = TILE_SIZE * 4;
export const OVERWORLD_MOVEMENT_ENABLED = false;

export const PLAYER_SPEED = 160; // pixels per second
export const PLAYER_SPRINT_SPEED = 260;
export const STAMINA_DRAIN = 20; // per second while sprinting
export const STAMINA_REGEN = 12; // per second while not sprinting
export const PLAYER_RADIUS = 12;

export const ENEMY_WANDER_SPEED = 0;
export const ENEMY_DETECTION_RADIUS = 28;
export const RESPAWN_COOLDOWN = 30; // seconds before defeated enemy respawns

export const GRACE_PERIOD = 2.0; // seconds of i-frames after battle
export const RANDOM_ENCOUNTER_INTERVAL = 4.0; // seconds between random checks

// ── Terrain Types ──
export const TERRAIN = {
  WATER:    0,
  PLAINS:   1,
  FOREST:   2,
  MOUNTAIN: 3,
  DESERT:   4,
  SWAMP:    5,
  VILLAGE:  6,
  PATH:     7,
};

export const TERRAIN_COLORS = {
  [TERRAIN.WATER]:    '#3b6ea5',
  [TERRAIN.PLAINS]:   '#7ec850',
  [TERRAIN.FOREST]:   '#3a7d32',
  [TERRAIN.MOUNTAIN]: '#8a8a8a',
  [TERRAIN.DESERT]:   '#d4b86a',
  [TERRAIN.SWAMP]:    '#4a6b5a',
  [TERRAIN.VILLAGE]:  '#c4a66a',
  [TERRAIN.PATH]:     '#b8a070',
};

export const TERRAIN_WALKABLE = {
  [TERRAIN.WATER]:    false,
  [TERRAIN.PLAINS]:   true,
  [TERRAIN.FOREST]:   true,
  [TERRAIN.MOUNTAIN]: false,
  [TERRAIN.DESERT]:   true,
  [TERRAIN.SWAMP]:    true,
  [TERRAIN.VILLAGE]:  true,
  [TERRAIN.PATH]:     true,
};

// ── Region Definitions ──
// Each region is a rectangular area on the map with properties
export const REGIONS = [
  {
    id: 'mondstadt',
    name: 'Mondstadt',
    terrain: TERRAIN.VILLAGE,
    x: 50, y: 38, w: 20, h: 14,
    dangerLevel: 0,
    randomEncounterChance: 0,
    enemies: [],
    maxEnemies: 0,
    safe: true,
    city: true,
  },
  {
    id: 'liyue_harbor',
    name: 'Liyue Harbor',
    terrain: TERRAIN.VILLAGE,
    x: 85, y: 42, w: 16, h: 12,
    dangerLevel: 0,
    randomEncounterChance: 0,
    enemies: [],
    maxEnemies: 0,
    safe: true,
    city: true,
  },
  {
    id: 'plains_south',
    name: 'Southern Plains',
    terrain: TERRAIN.PLAINS,
    x: 10, y: 55, w: 50, h: 25,
    dangerLevel: 1,
    randomEncounterChance: 0.05,
    enemies: ['slime', 'slime', 'goblin'],
    maxEnemies: 8,
  },
  {
    id: 'plains_north',
    name: 'Northern Plains',
    terrain: TERRAIN.PLAINS,
    x: 10, y: 10, w: 50, h: 25,
    dangerLevel: 2,
    randomEncounterChance: 0.08,
    enemies: ['goblin', 'goblin', 'wolf'],
    maxEnemies: 8,
  },
  {
    id: 'forest_east',
    name: 'Eastern Forest',
    terrain: TERRAIN.FOREST,
    x: 70, y: 10, w: 40, h: 35,
    dangerLevel: 3,
    randomEncounterChance: 0.12,
    enemies: ['wolf', 'wolf', 'treant'],
    maxEnemies: 10,
  },
  {
    id: 'desert_west',
    name: 'Western Desert',
    terrain: TERRAIN.DESERT,
    x: 0, y: 38, w: 40, h: 20,
    dangerLevel: 2,
    randomEncounterChance: 0.10,
    enemies: ['bandit', 'scorpion'],
    maxEnemies: 7,
  },
  {
    id: 'swamp_south',
    name: 'Southern Swamp',
    terrain: TERRAIN.SWAMP,
    x: 70, y: 55, w: 40, h: 30,
    dangerLevel: 4,
    randomEncounterChance: 0.18,
    enemies: ['drake', 'swamp_horror'],
    maxEnemies: 6,
  },
  {
    id: 'mountain_peak',
    name: 'Mountain Pass',
    terrain: TERRAIN.MOUNTAIN,
    x: 45, y: 0, w: 20, h: 12,
    dangerLevel: 5,
    randomEncounterChance: 0.15,
    enemies: ['golem', 'drake'],
    maxEnemies: 5,
  },
];

// ── Enemy Definitions ──
export const ENEMY_DEFS = {
  slime: {
    id: 'slime',
    name: 'Slime',
    hp: 20, atk: 5, def: 2,
    xpReward: 10,
    goldReward: 5,
    color: '#44cc44',
    size: 20,
    loot: [{ item: 'potion_small', chance: 0.3 }],
    sprite: 'O',
  },
  goblin: {
    id: 'goblin',
    name: 'Goblin',
    hp: 35, atk: 10, def: 4,
    xpReward: 20,
    goldReward: 12,
    color: '#88aa33',
    size: 22,
    loot: [
      { item: 'potion_small', chance: 0.2 },
      { item: 'herb', chance: 0.4 },
    ],
    sprite: 'g',
  },
  wolf: {
    id: 'wolf',
    name: 'Wild Wolf',
    hp: 45, atk: 14, def: 5,
    xpReward: 30,
    goldReward: 8,
    color: '#777777',
    size: 24,
    loot: [{ item: 'wolf_pelt', chance: 0.5 }],
    sprite: 'w',
  },
  bandit: {
    id: 'bandit',
    name: 'Bandit',
    hp: 50, atk: 16, def: 8,
    xpReward: 40,
    goldReward: 25,
    color: '#aa5533',
    size: 24,
    loot: [
      { item: 'potion_medium', chance: 0.2 },
      { item: 'gold_pouch', chance: 0.3 },
    ],
    sprite: 'B',
  },
  scorpion: {
    id: 'scorpion',
    name: 'Sand Scorpion',
    hp: 40, atk: 18, def: 10,
    xpReward: 35,
    goldReward: 15,
    color: '#cc8833',
    size: 22,
    loot: [{ item: 'antidote', chance: 0.4 }],
    sprite: 'S',
  },
  treant: {
    id: 'treant',
    name: 'Treant',
    hp: 80, atk: 12, def: 15,
    xpReward: 50,
    goldReward: 20,
    color: '#336622',
    size: 28,
    loot: [{ item: 'wood_essence', chance: 0.5 }],
    sprite: 'T',
  },
  drake: {
    id: 'drake',
    name: 'Drake',
    hp: 100, atk: 22, def: 12,
    xpReward: 80,
    goldReward: 50,
    color: '#cc3333',
    size: 30,
    loot: [
      { item: 'drake_scale', chance: 0.3 },
      { item: 'potion_large', chance: 0.2 },
    ],
    sprite: 'D',
  },
  swamp_horror: {
    id: 'swamp_horror',
    name: 'Swamp Horror',
    hp: 70, atk: 20, def: 8,
    xpReward: 60,
    goldReward: 30,
    color: '#335544',
    size: 26,
    loot: [{ item: 'toxic_gland', chance: 0.4 }],
    sprite: 'H',
  },
  golem: {
    id: 'golem',
    name: 'Stone Golem',
    hp: 150, atk: 25, def: 20,
    xpReward: 120,
    goldReward: 80,
    color: '#666655',
    size: 32,
    loot: [
      { item: 'stone_heart', chance: 0.2 },
      { item: 'potion_large', chance: 0.3 },
    ],
    sprite: 'G',
  },
};

// ── Item Definitions ──
export const ITEM_DEFS = {
  potion_small:  { id: 'potion_small',  name: 'Small Potion',    type: 'consumable', effect: 'heal', value: 25,  buyPrice: 20,  desc: 'Restores 25 HP' },
  potion_medium: { id: 'potion_medium', name: 'Medium Potion',   type: 'consumable', effect: 'heal', value: 60,  buyPrice: 50,  desc: 'Restores 60 HP' },
  potion_large:  { id: 'potion_large',  name: 'Large Potion',    type: 'consumable', effect: 'heal', value: 120, buyPrice: 120, desc: 'Restores 120 HP' },
  antidote:      { id: 'antidote',      name: 'Antidote',        type: 'consumable', effect: 'cure', value: 0,   buyPrice: 15,  desc: 'Cures poison' },
  herb:          { id: 'herb',          name: 'Herb',            type: 'material',   effect: null,   value: 0,   buyPrice: 5,   desc: 'A common herb' },
  wolf_pelt:     { id: 'wolf_pelt',     name: 'Wolf Pelt',       type: 'material',   effect: null,   value: 0,   buyPrice: 0,   desc: 'Fur from a wild wolf' },
  gold_pouch:    { id: 'gold_pouch',    name: 'Gold Pouch',      type: 'currency',   effect: 'gold', value: 50,  buyPrice: 0,   desc: 'Contains 50 gold' },
  drake_scale:   { id: 'drake_scale',   name: 'Drake Scale',     type: 'material',   effect: null,   value: 0,   buyPrice: 0,   desc: 'A shimmering scale' },
  toxic_gland:   { id: 'toxic_gland',   name: 'Toxic Gland',     type: 'material',   effect: null,   value: 0,   buyPrice: 0,   desc: 'A poisonous organ' },
  wood_essence:  { id: 'wood_essence',  name: 'Wood Essence',    type: 'material',   effect: null,   value: 0,   buyPrice: 0,   desc: 'Essence of an ancient tree' },
  stone_heart:   { id: 'stone_heart',   name: 'Stone Heart',     type: 'material',   effect: null,   value: 0,   buyPrice: 0,   desc: 'Core of a stone golem' },
};

// ── Player level curve ──
export function xpForLevel(level) {
  return Math.floor(50 * Math.pow(level, 1.8));
}

// ── Player base stats per level ──
export function playerStatsForLevel(level) {
  return {
    maxHp: 80 + level * 20,
    maxStamina: 100 + level * 5,
    atk: 10 + level * 3,
    def: 5 + level * 2,
  };
}
