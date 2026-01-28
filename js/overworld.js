// ── Overworld Scene ──
// Handles player movement, camera, and overworld logic.

import {
  TILE_SIZE, MAP_WIDTH, MAP_HEIGHT,
  PLAYER_SPEED, PLAYER_SPRINT_SPEED,
  STAMINA_DRAIN, STAMINA_REGEN, PLAYER_RADIUS,
  TERRAIN,
} from './config.js';
import { clamp } from './utils.js';
import { Input } from './input.js';
import { MapData } from './map-data.js';
import { WorldState } from './world-state.js';

export const Camera = {
  x: 0,
  y: 0,
  width: 800,
  height: 600,

  /** Follow the player, centered */
  follow(px, py) {
    this.x = px - this.width / 2;
    this.y = py - this.height / 2;
    // Clamp to map bounds
    this.x = clamp(this.x, 0, MAP_WIDTH - this.width);
    this.y = clamp(this.y, 0, MAP_HEIGHT - this.height);
  },

  /** Set viewport size */
  resize(w, h) {
    this.width = w;
    this.height = h;
  },
};

export const Overworld = {
  /** Update overworld (player movement, world state) */
  update(dt) {
    this._movePlayer(dt);
    WorldState.update(dt);
  },

  /** Handle player movement with collision */
  _movePlayer(dt) {
    const p = WorldState.player;
    const dir = Input.direction();

    // Sprint
    const isSprinting = Input.sprinting() && p.stamina > 0 && (dir.x !== 0 || dir.y !== 0);
    const speed = isSprinting ? PLAYER_SPRINT_SPEED : PLAYER_SPEED;

    // Stamina management
    if (isSprinting) {
      p.stamina = Math.max(0, p.stamina - STAMINA_DRAIN * dt);
    } else {
      p.stamina = Math.min(p.maxStamina, p.stamina + STAMINA_REGEN * dt);
    }

    // Calculate desired position
    const nx = p.x + dir.x * speed * dt;
    const ny = p.y + dir.y * speed * dt;

    // Collision check with terrain (check at player radius offsets)
    const r = PLAYER_RADIUS;
    // Try X movement
    if (dir.x !== 0) {
      const testX = nx + (dir.x > 0 ? r : -r);
      if (MapData.isWalkable(testX, p.y - r) && MapData.isWalkable(testX, p.y + r)) {
        p.x = nx;
      }
    }
    // Try Y movement
    if (dir.y !== 0) {
      const testY = ny + (dir.y > 0 ? r : -r);
      if (MapData.isWalkable(p.x - r, testY) && MapData.isWalkable(p.x + r, testY)) {
        p.y = ny;
      }
    }

    // Clamp to map
    p.x = clamp(p.x, r, MAP_WIDTH - r);
    p.y = clamp(p.y, r, MAP_HEIGHT - r);

    // Update facing direction
    if (dir.x !== 0 || dir.y !== 0) {
      if (Math.abs(dir.x) > Math.abs(dir.y)) {
        p.facing = dir.x > 0 ? 'right' : 'left';
      } else {
        p.facing = dir.y > 0 ? 'down' : 'up';
      }
    }

    p.vx = dir.x * speed;
    p.vy = dir.y * speed;

    // Update camera
    Camera.follow(p.x, p.y);
  },

  /** Heal player (e.g., at village inn) */
  checkVillageHeal() {
    const p = WorldState.player;
    const region = MapData.regionAt(p.x, p.y);
    if (region && region.safe) {
      // Slow heal in safe zones
      if (p.hp < p.maxHp) {
        p.hp = Math.min(p.maxHp, p.hp + 0.5); // heal 0.5 HP/frame
      }
    }
  },
};
