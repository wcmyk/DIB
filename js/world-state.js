// ── Persistent World State ──
// Single source of truth for all overworld data.
// Survives across battle instances.

import {
  TILE_SIZE, REGIONS, ENEMY_DEFS,
  RESPAWN_COOLDOWN, ENEMY_WANDER_SPEED,
  xpForLevel, playerStatsForLevel,
} from './config.js';
import { uid, pick, createRNG, clone } from './utils.js';
import { MapData } from './map-data.js';

// ── The World State singleton ──
export const WorldState = {
  player: null,
  enemies: [],    // active enemies on the overworld
  time: 0,        // world clock in seconds
  worldFlags: {}, // quest/camp cleared flags
  unlockedCities: [],
  cameraTarget: null,
  _respawnTimers: [], // { regionId, enemyType, respawnAt }

  /** Initialize fresh game state */
  init() {
    const startRegion = REGIONS.find(r => r.id === 'mondstadt');
    const startX = (startRegion.x + startRegion.w / 2) * TILE_SIZE;
    const startY = (startRegion.y + startRegion.h / 2) * TILE_SIZE;

    const baseStats = playerStatsForLevel(1);

    this.player = {
      x: startX,
      y: startY,
      vx: 0,
      vy: 0,
      level: 1,
      xp: 0,
      xpToNext: xpForLevel(2),
      hp: baseStats.maxHp,
      maxHp: baseStats.maxHp,
      stamina: baseStats.maxStamina,
      maxStamina: baseStats.maxStamina,
      atk: baseStats.atk,
      def: baseStats.def,
      gold: 50,
      inventory: [
        { itemId: 'potion_small', qty: 3 },
      ],
      // Grace period timer (seconds remaining)
      graceTimer: 0,
      // Facing direction for sprite
      facing: 'down',
    };

    this.enemies = [];
    this.time = 0;
    this.worldFlags = {};
    this.unlockedCities = [];
    this.cameraTarget = { x: startX, y: startY };
    this._respawnTimers = [];

    this.unlockCity(startRegion);

    // Spawn initial enemies in all regions
    this._spawnInitialEnemies();
  },

  /** Spawn enemies in each region up to maxEnemies */
  _spawnInitialEnemies() {
    const rng = createRNG(123);
    for (const region of REGIONS) {
      if (region.maxEnemies <= 0 || region.enemies.length === 0) continue;
      for (let i = 0; i < region.maxEnemies; i++) {
        const typeId = pick(region.enemies, rng);
        const pos = MapData.randomPositionInRegion(region, rng);
        this._spawnEnemy(typeId, pos.x, pos.y, region.id);
      }
    }
  },

  /** Spawn a single enemy entity */
  _spawnEnemy(typeId, x, y, regionId) {
    const def = ENEMY_DEFS[typeId];
    if (!def) return null;
    const enemy = {
      id: uid(),
      typeId,
      regionId,
      x, y,
      hp: def.hp,
      // Wander AI state
      wanderDx: 0,
      wanderDy: 0,
      wanderTimer: 0,
      alive: true,
    };
    this.enemies.push(enemy);
    return enemy;
  },

  /** Update world (called every frame during overworld) */
  update(dt) {
    this.time += dt;

    // Update grace period
    if (this.player.graceTimer > 0) {
      this.player.graceTimer -= dt;
      if (this.player.graceTimer < 0) this.player.graceTimer = 0;
    }

    // Update enemy wander AI
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      this._updateEnemyWander(enemy, dt);
    }

    // Process respawn timers
    for (let i = this._respawnTimers.length - 1; i >= 0; i--) {
      const timer = this._respawnTimers[i];
      if (this.time >= timer.respawnAt) {
        const region = MapData.regionById(timer.regionId);
        if (region) {
          const pos = MapData.randomPositionInRegion(region);
          this._spawnEnemy(timer.enemyType, pos.x, pos.y, timer.regionId);
        }
        this._respawnTimers.splice(i, 1);
      }
    }
  },

  /** Unlock a city region for teleport */
  unlockCity(region) {
    if (!region?.city) return false;
    if (this.unlockedCities.includes(region.id)) return false;
    this.unlockedCities.push(region.id);
    return true;
  },

  /** Unlock city at player position if applicable */
  unlockCityAtPlayer() {
    const region = MapData.regionAt(this.player.x, this.player.y);
    if (region) {
      this.unlockCity(region);
    }
    return region;
  },

  /** Teleport player to a city center */
  teleportToCity(regionId) {
    const region = MapData.regionById(regionId);
    if (!region) return;
    this.player.x = (region.x + region.w / 2) * TILE_SIZE;
    this.player.y = (region.y + region.h / 2) * TILE_SIZE;
    this.cameraTarget = { x: this.player.x, y: this.player.y };
  },

  /** Simple wander AI for an enemy */
  _updateEnemyWander(enemy, dt) {
    enemy.wanderTimer -= dt;
    if (enemy.wanderTimer <= 0) {
      // Pick new direction or idle
      const rng = Math.random;
      if (rng() < 0.4) {
        // Idle
        enemy.wanderDx = 0;
        enemy.wanderDy = 0;
        enemy.wanderTimer = 1 + rng() * 2;
      } else {
        const angle = rng() * Math.PI * 2;
        enemy.wanderDx = Math.cos(angle);
        enemy.wanderDy = Math.sin(angle);
        enemy.wanderTimer = 0.5 + rng() * 1.5;
      }
    }

    // Move
    const speed = ENEMY_WANDER_SPEED;
    const nx = enemy.x + enemy.wanderDx * speed * dt;
    const ny = enemy.y + enemy.wanderDy * speed * dt;

    // Stay on walkable terrain
    if (MapData.isWalkable(nx, ny)) {
      enemy.x = nx;
      enemy.y = ny;
    } else {
      // Reverse direction
      enemy.wanderDx = -enemy.wanderDx;
      enemy.wanderDy = -enemy.wanderDy;
      enemy.wanderTimer = 0.3;
    }
  },

  /** Remove defeated enemies and schedule respawn */
  removeEnemy(enemyId) {
    const idx = this.enemies.findIndex(e => e.id === enemyId);
    if (idx === -1) return;
    const enemy = this.enemies[idx];
    this._respawnTimers.push({
      regionId: enemy.regionId,
      enemyType: enemy.typeId,
      respawnAt: this.time + RESPAWN_COOLDOWN,
    });
    this.enemies.splice(idx, 1);
  },

  /** Apply battle result back to overworld */
  applyBattleResult(result) {
    const p = this.player;

    // Apply HP change
    p.hp = Math.max(0, Math.min(p.maxHp, p.hp + result.playerDelta.hp));
    p.stamina = Math.max(0, Math.min(p.maxStamina, p.stamina + result.playerDelta.stamina));

    // Add XP
    if (result.xp > 0) {
      p.xp += result.xp;
      // Level up check
      while (p.xp >= p.xpToNext) {
        p.xp -= p.xpToNext;
        p.level++;
        const stats = playerStatsForLevel(p.level);
        p.maxHp = stats.maxHp;
        p.maxStamina = stats.maxStamina;
        p.atk = stats.atk;
        p.def = stats.def;
        // Full heal on level up
        p.hp = p.maxHp;
        p.stamina = p.maxStamina;
        p.xpToNext = xpForLevel(p.level + 1);
      }
    }

    // Add gold
    if (result.gold) p.gold += result.gold;

    // Add loot items
    for (const lootItem of result.loot) {
      this.addItem(lootItem.itemId, lootItem.qty);
    }

    // Remove defeated enemies from overworld
    for (const eid of result.defeatedEnemies) {
      this.removeEnemy(eid);
    }

    // Remove items used during battle
    if (result.itemsUsed) {
      for (const used of result.itemsUsed) {
        this.removeItem(used.itemId, used.qty);
      }
    }

    // Apply world flags
    if (result.worldFlags) {
      Object.assign(this.worldFlags, result.worldFlags);
    }

    // Set grace period
    p.graceTimer = 2.0;

    // If player died, respawn at village
    if (p.hp <= 0) {
      this._respawnPlayer();
    }
  },

  /** Respawn player at village after defeat */
  _respawnPlayer() {
    const startRegion = REGIONS.find(r => r.id === 'mondstadt');
    this.player.x = (startRegion.x + startRegion.w / 2) * TILE_SIZE;
    this.player.y = (startRegion.y + startRegion.h / 2) * TILE_SIZE;
    this.player.hp = Math.floor(this.player.maxHp * 0.5);
    this.player.stamina = this.player.maxStamina;
    // Lose some gold
    this.player.gold = Math.max(0, this.player.gold - Math.floor(this.player.gold * 0.1));
  },

  /** Add item to player inventory */
  addItem(itemId, qty = 1) {
    const existing = this.player.inventory.find(i => i.itemId === itemId);
    if (existing) {
      existing.qty += qty;
    } else {
      this.player.inventory.push({ itemId, qty });
    }
  },

  /** Remove item from inventory. Returns true if successful. */
  removeItem(itemId, qty = 1) {
    const existing = this.player.inventory.find(i => i.itemId === itemId);
    if (!existing || existing.qty < qty) return false;
    existing.qty -= qty;
    if (existing.qty <= 0) {
      const idx = this.player.inventory.indexOf(existing);
      this.player.inventory.splice(idx, 1);
    }
    return true;
  },

  /** Get item count in inventory */
  itemCount(itemId) {
    const existing = this.player.inventory.find(i => i.itemId === itemId);
    return existing ? existing.qty : 0;
  },

  /** Create a snapshot of player stats for battle */
  playerSnapshot() {
    const p = this.player;
    return {
      hp: p.hp,
      maxHp: p.maxHp,
      atk: p.atk,
      def: p.def,
      level: p.level,
      inventory: clone(p.inventory),
    };
  },
};
