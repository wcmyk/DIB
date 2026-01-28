// ── Main Entry Point ──
// Game loop, state machine, scene management.

import { Input } from './input.js';
import { MapData } from './map-data.js';
import { WorldState } from './world-state.js';
import { Overworld, Camera, IframeParallax } from './overworld.js';
import { EncounterDirector } from './encounter.js';
import { BattleInstance } from './battle.js';
import { Renderer } from './renderer.js';

// ── Game States ──
const STATE = {
  OVERWORLD:        'overworld',
  CHARACTER:        'character',
  TEAMS:            'teams',
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

  // Character screen
  characterCityIndex: 0,

  // Teams screen
  teamsIndex: 0,

  // View zoom
  zoom: 1,

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

    // Init iframe parallax
    const iframe = document.getElementById('map-iframe');
    IframeParallax.init(iframe);
    const container = document.getElementById('game-container');
    if (container) {
      container.style.setProperty('--game-zoom', this.zoom);
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

    console.log('Game started. Use C for Character, T for Teams, +/- to zoom.');
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
    this._updateZoom();
    switch (this.state) {
      case STATE.OVERWORLD:
        this._updateOverworld(dt);
        break;
      case STATE.CHARACTER:
        this._updateCharacter(dt);
        break;
      case STATE.TEAMS:
        this._updateTeams(dt);
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

      case STATE.CHARACTER:
        Renderer.drawOverworld();
        Renderer.drawCharacter(this.characterCityIndex);
        break;

      case STATE.TEAMS:
        Renderer.drawOverworld();
        Renderer.drawTeams(this.teamsIndex);
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

    // Toggle character screen
    if (Input.pressed('KeyC')) {
      this.state = STATE.CHARACTER;
      this.characterCityIndex = 0;
    }

    // Toggle teams screen
    if (Input.pressed('KeyT')) {
      this.state = STATE.TEAMS;
      this.teamsIndex = 0;
    }
  },

  _updateCharacter(dt) {
    const cities = WorldState.unlockedCities;

    if (Input.pressed('KeyC') || Input.pressed('Escape')) {
      this.state = STATE.OVERWORLD;
      return;
    }

    if (cities.length > 0) {
      if (Input.pressed('ArrowUp') || Input.pressed('KeyW')) {
        this.characterCityIndex = (this.characterCityIndex - 1 + cities.length) % cities.length;
      }
      if (Input.pressed('ArrowDown') || Input.pressed('KeyS')) {
        this.characterCityIndex = (this.characterCityIndex + 1) % cities.length;
      }
      if (Input.pressed('Enter')) {
        const cityId = cities[this.characterCityIndex];
        if (cityId) {
          WorldState.teleportToCity(cityId);
          this.state = STATE.OVERWORLD;
        }
      }
    }
  },

  _updateTeams(dt) {
    if (Input.pressed('KeyT') || Input.pressed('Escape')) {
      this.state = STATE.OVERWORLD;
    }
  },

  _updateZoom() {
    const container = document.getElementById('game-container');
    if (!container) return;

    let zoom = this.zoom;
    if (Input.pressed('Equal') || Input.pressed('NumpadAdd')) {
      zoom = Math.min(1.6, zoom + 0.1);
    }
    if (Input.pressed('Minus') || Input.pressed('NumpadSubtract')) {
      zoom = Math.max(0.6, zoom - 0.1);
    }
    if (zoom !== this.zoom) {
      this.zoom = Math.round(zoom * 10) / 10;
      container.style.setProperty('--game-zoom', this.zoom);
    }
  },

  _updateTransitionIn(dt) {
    this.transitionTimer += dt;
    if (this.transitionTimer >= this.transitionDuration) {
      // Hide map for battle
      IframeParallax.hide();
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
      // Show map again
      IframeParallax.show();
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
