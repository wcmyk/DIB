// ── Overworld Scene ──
// Handles player movement, camera, iframe parallax, and overworld logic.

import {
  TILE_SIZE, MAP_WIDTH, MAP_HEIGHT,
  PLAYER_SPEED, PLAYER_SPRINT_SPEED,
  STAMINA_DRAIN, STAMINA_REGEN, PLAYER_RADIUS,
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

/** Manages the background map iframe parallax effect */
export const IframeParallax = {
  _iframe: null,
  _interactive: false,

  /** Store reference to the iframe element */
  init(iframe) {
    this._iframe = iframe;
    this._interactive = iframe?.dataset?.interactive === 'true';
    if (this._interactive && this._iframe) {
      this._iframe.style.transform = 'translate(0, 0)';
    }
  },

  /** Update iframe CSS transform to create parallax as player moves */
  update() {
    if (!this._iframe) return;
    if (this._interactive) return;
    const p = WorldState.player;

    // Normalize player position to -0.5 … +0.5 range
    const nx = (p.x / MAP_WIDTH) - 0.5;
    const ny = (p.y / MAP_HEIGHT) - 0.5;

    // Shift the iframe: player at center → no offset, at edges → full offset
    // The iframe is 300% of viewport, positioned at -100%,-100%.
    // We can shift up to ±100% of viewport before revealing the edge.
    // Using 80% of that range for smoother feel.
    const shiftX = -nx * 80; // percentage of viewport width
    const shiftY = -ny * 80;

    this._iframe.style.transform = `translate(${shiftX}%, ${shiftY}%)`;
  },

  /** Show the iframe (overworld mode) */
  show() {
    if (this._iframe) this._iframe.classList.remove('hidden');
  },

  /** Hide the iframe (battle mode) */
  hide() {
    if (this._iframe) this._iframe.classList.add('hidden');
  },
};

export const Overworld = {
  /** Update overworld (player movement, world state) */
  update(dt) {
    this._movePlayer(dt);
    WorldState.update(dt);
    IframeParallax.update();
  },

  /** Handle player movement */
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

    // Collision: bounds check only (all terrain is walkable with iframe map)
    const r = PLAYER_RADIUS;
    if (dir.x !== 0) {
      const testX = nx + (dir.x > 0 ? r : -r);
      if (MapData.isWalkable(testX, p.y)) {
        p.x = nx;
      }
    }
    if (dir.y !== 0) {
      const testY = ny + (dir.y > 0 ? r : -r);
      if (MapData.isWalkable(p.x, testY)) {
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
        p.hp = Math.min(p.maxHp, p.hp + 0.5);
      }
    }
  },
};
