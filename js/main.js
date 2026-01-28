// ── Main Entry Point ──
// Game loop, state machine, scene management.

import { Input } from './input.js';
import { MapData } from './map-data.js';
import { WorldState } from './world-state.js';
import { Overworld, Camera } from './overworld.js';
import { EncounterDirector } from './encounter.js';
import { BattleInstance } from './battle.js';
import { Renderer } from './renderer.js';

// ── Game States ──
const STATE = {
  OVERWORLD:        'overworld',
  INVENTORY:        'inventory',
  TRANSITION_IN:    'transition_in',   // overworld → battle
  BATTLE:           'battle',
  TRANSITION_OUT:   'transition_out',  // battle → overworld
};

// ── Game Singleton ──
const Game = {
  state: STATE.OVERWORLD,
  battle: null,
  transitionTimer: 0,
  transitionDuration: 0.6, // seconds
  pendingEncounter: null,

  // Inventory screen
  inventoryIndex: 0,

  // Timing
  lastTime: 0,
  running: false,

  /** Initialize and start the game */
  start() {
    const canvas = document.getElementById('game-canvas');
    if (!canvas) {
      console.error('Canvas element #game-canvas not found');
      return;
    }

    // Init systems
    Input.init();
    Renderer.init(canvas);
    MapData.generate(42);
    WorldState.init();
    EncounterDirector.reset();

    // Start loop
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this._loop(t));

    console.log('Game started. Use WASD to move, Shift to sprint.');
  },

  /** Main game loop */
  _loop(timestamp) {
    if (!this.running) return;

    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1); // cap at 100ms
    this.lastTime = timestamp;

    this._update(dt);
    this._render();

    Input.endFrame();
    requestAnimationFrame((t) => this._loop(t));
  },

  /** Update game state */
  _update(dt) {
    switch (this.state) {
      case STATE.OVERWORLD:
        this._updateOverworld(dt);
        break;
      case STATE.INVENTORY:
        this._updateInventory(dt);
        break;
      case STATE.TRANSITION_IN:
        this._updateTransitionIn(dt);
        break;
      case STATE.BATTLE:
        this._updateBattle(dt);
        break;
      case STATE.TRANSITION_OUT:
        this._updateTransitionOut(dt);
        break;
    }
  },

  /** Render current state */
  _render() {
    switch (this.state) {
      case STATE.OVERWORLD:
        Renderer.drawOverworld();
        break;

      case STATE.INVENTORY:
        Renderer.drawOverworld();
        Renderer.drawInventory(this.inventoryIndex);
        break;

      case STATE.TRANSITION_IN:
        Renderer.drawOverworld();
        Renderer.drawFade(this.transitionTimer / this.transitionDuration);
        break;

      case STATE.BATTLE:
        if (this.battle) {
          Renderer.drawBattle(this.battle.renderData);
        }
        break;

      case STATE.TRANSITION_OUT:
        Renderer.drawOverworld();
        Renderer.drawFade(1 - this.transitionTimer / this.transitionDuration);
        break;
    }
  },

  // ── State update handlers ──

  _updateOverworld(dt) {
    Overworld.update(dt);
    Overworld.checkVillageHeal();

    // Check for encounters
    const encounter = EncounterDirector.check(dt);
    if (encounter) {
      this.pendingEncounter = encounter;
      this.state = STATE.TRANSITION_IN;
      this.transitionTimer = 0;
      return;
    }

    // Toggle inventory
    if (Input.pressed('KeyI') || Input.pressed('Tab')) {
      this.state = STATE.INVENTORY;
      this.inventoryIndex = 0;
    }
  },

  _updateInventory(dt) {
    const inv = WorldState.player.inventory;

    if (Input.pressed('KeyI') || Input.pressed('Tab') || Input.pressed('Escape')) {
      this.state = STATE.OVERWORLD;
      return;
    }

    if (inv.length > 0) {
      if (Input.pressed('ArrowUp') || Input.pressed('KeyW')) {
        this.inventoryIndex = (this.inventoryIndex - 1 + inv.length) % inv.length;
      }
      if (Input.pressed('ArrowDown') || Input.pressed('KeyS')) {
        this.inventoryIndex = (this.inventoryIndex + 1) % inv.length;
      }
    }
  },

  _updateTransitionIn(dt) {
    this.transitionTimer += dt;
    if (this.transitionTimer >= this.transitionDuration) {
      // Create battle instance
      this.battle = new BattleInstance(this.pendingEncounter);
      this.pendingEncounter = null;
      this.state = STATE.BATTLE;
    }
  },

  _updateBattle(dt) {
    if (!this.battle) return;

    this.battle.update(dt);

    if (this.battle.isDone) {
      const result = this.battle.getResult();
      // Apply result to overworld
      WorldState.applyBattleResult(result);
      // Begin transition out
      this.battle = null;
      this.state = STATE.TRANSITION_OUT;
      this.transitionTimer = 0;
    }
  },

  _updateTransitionOut(dt) {
    this.transitionTimer += dt;
    if (this.transitionTimer >= this.transitionDuration) {
      this.state = STATE.OVERWORLD;
      EncounterDirector.reset();
    }
  },
};

// ── Boot ──
window.addEventListener('DOMContentLoaded', () => {
  Game.start();
});
