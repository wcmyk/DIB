// ── Encounter Director ──
// Decides when and how encounters trigger.
// Produces EncounterRequest objects (data contract).

import {
  ENEMY_DEFS, ENEMY_DETECTION_RADIUS, PLAYER_RADIUS,
  RANDOM_ENCOUNTER_INTERVAL,
} from './config.js';
import { dist, randomSeed, pick } from './utils.js';
import { WorldState } from './world-state.js';
import { MapData } from './map-data.js';

// ── Data Contracts ──

/**
 * EncounterRequest: overworld → battle
 * {
 *   type: 'collision' | 'random' | 'ambush',
 *   playerSnapshot: { hp, maxHp, atk, def, level, inventory },
 *   enemyParty: [{ id, typeId, level, hp, atk, def }],
 *   context: { regionId, terrainId, weatherId },
 *   seed: number,
 *   sourceEnemyIds: number[],  // overworld enemy ids involved
 * }
 */

/**
 * BattleResult: battle → overworld
 * {
 *   playerDelta: { hp: number, stamina: number },
 *   loot: [{ itemId, qty }],
 *   xp: number,
 *   gold: number,
 *   defeatedEnemies: number[],   // overworld spawn ids to remove
 *   worldFlags: {},
 *   fled: boolean,
 * }
 */

export const EncounterDirector = {
  _randomTimer: 0,

  /** Reset director state */
  reset() {
    this._randomTimer = 0;
  },

  /**
   * Check for encounters. Called every frame during overworld.
   * Returns an EncounterRequest or null.
   */
  check(dt) {
    const player = WorldState.player;

    // Don't trigger during grace period
    if (player.graceTimer > 0) return null;

    // A) Collision-based encounters
    const collisionResult = this._checkCollision();
    if (collisionResult) return collisionResult;

    // B) Random encounter check
    this._randomTimer += dt;
    if (this._randomTimer >= RANDOM_ENCOUNTER_INTERVAL) {
      this._randomTimer = 0;
      const randomResult = this._checkRandom();
      if (randomResult) return randomResult;
    }

    return null;
  },

  /** Check collision-based encounters (visible enemies) */
  _checkCollision() {
    const p = WorldState.player;
    const triggerDist = PLAYER_RADIUS + ENEMY_DETECTION_RADIUS;

    for (const enemy of WorldState.enemies) {
      if (!enemy.alive) continue;
      const d = dist(p.x, p.y, enemy.x, enemy.y);
      if (d < triggerDist) {
        return this._createCollisionEncounter(enemy);
      }
    }
    return null;
  },

  /** Create an EncounterRequest from colliding with a visible enemy */
  _createCollisionEncounter(enemy) {
    const def = ENEMY_DEFS[enemy.typeId];
    const region = MapData.regionAt(enemy.x, enemy.y);

    // Possibly pull in nearby enemies of same region (pack encounter)
    const pack = [enemy];
    const p = WorldState.player;
    for (const other of WorldState.enemies) {
      if (other.id === enemy.id || !other.alive) continue;
      if (other.regionId === enemy.regionId && dist(enemy.x, enemy.y, other.x, other.y) < 80) {
        pack.push(other);
        if (pack.length >= 3) break; // max 3 per encounter
      }
    }

    const enemyParty = pack.map(e => {
      const d = ENEMY_DEFS[e.typeId];
      return {
        id: e.id,
        typeId: e.typeId,
        name: d.name,
        hp: d.hp,
        maxHp: d.hp,
        atk: d.atk,
        def: d.def,
        xpReward: d.xpReward,
        goldReward: d.goldReward,
        color: d.color,
        sprite: d.sprite,
        loot: d.loot,
      };
    });

    return {
      type: 'collision',
      playerSnapshot: WorldState.playerSnapshot(),
      enemyParty,
      context: {
        regionId: region ? region.id : 'unknown',
        regionName: region ? region.name : 'Unknown',
        terrainId: MapData.terrainAt(p.x, p.y),
      },
      seed: randomSeed(),
      sourceEnemyIds: pack.map(e => e.id),
    };
  },

  /** Check for random encounters based on region danger */
  _checkRandom() {
    const p = WorldState.player;
    const region = MapData.regionAt(p.x, p.y);
    if (!region || region.safe) return null;
    if (region.randomEncounterChance <= 0) return null;

    if (Math.random() > region.randomEncounterChance) return null;

    // Generate a random enemy party from region's enemy pool
    const numEnemies = 1 + Math.floor(Math.random() * Math.min(2, region.dangerLevel));
    const enemyParty = [];
    for (let i = 0; i < numEnemies; i++) {
      const typeId = pick(region.enemies);
      const d = ENEMY_DEFS[typeId];
      enemyParty.push({
        id: -1, // no overworld entity
        typeId,
        name: d.name,
        hp: d.hp,
        maxHp: d.hp,
        atk: d.atk,
        def: d.def,
        xpReward: d.xpReward,
        goldReward: d.goldReward,
        color: d.color,
        sprite: d.sprite,
        loot: d.loot,
      });
    }

    return {
      type: 'random',
      playerSnapshot: WorldState.playerSnapshot(),
      enemyParty,
      context: {
        regionId: region.id,
        regionName: region.name,
        terrainId: MapData.terrainAt(p.x, p.y),
      },
      seed: randomSeed(),
      sourceEnemyIds: [], // random encounters don't map to overworld entities
    };
  },
};
