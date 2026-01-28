// ── Battle Instance ──
// Temporary battle scene. Created from EncounterRequest, produces BattleResult.
// Turn-based combat with Attack, Skill, Item, Flee actions.

import { ITEM_DEFS, ENEMY_DEFS } from './config.js';
import { createRNG, clamp } from './utils.js';
import { Input } from './input.js';

// Battle phases
const PHASE = {
  INTRO:        'intro',
  PLAYER_TURN:  'player_turn',
  PLAYER_ACT:   'player_act',
  ENEMY_TURN:   'enemy_turn',
  VICTORY:      'victory',
  DEFEAT:       'defeat',
  FLED:         'fled',
  DONE:         'done',
};

export class BattleInstance {
  constructor(encounterRequest) {
    this.request = encounterRequest;
    this.rng = createRNG(encounterRequest.seed);

    // Player battle state (copy from snapshot)
    const snap = encounterRequest.playerSnapshot;
    this.player = {
      hp: snap.hp,
      maxHp: snap.maxHp,
      atk: snap.atk,
      def: snap.def,
      level: snap.level,
      inventory: snap.inventory, // mutable copy
      defending: false,
    };

    // Enemy party (mutable copies)
    this.enemies = encounterRequest.enemyParty.map(e => ({
      ...e,
      alive: true,
      defending: false,
    }));

    this.phase = PHASE.INTRO;
    this.introTimer = 1.5; // seconds
    this.turnIndex = 0; // which enemy is acting
    this.actionTimer = 0;

    // Menu state
    this.menuIndex = 0;
    this.menuItems = ['Attack', 'Skill', 'Item', 'Flee'];
    this.subMenu = null; // 'item' | 'skill' | null
    this.subMenuIndex = 0;
    this.targetIndex = 0; // which enemy to target

    // Battle log (messages shown during combat)
    this.log = [];
    this.logTimer = 0;

    // Result tracking
    this.totalXp = 0;
    this.totalGold = 0;
    this.loot = [];
    this.defeatedIds = [];
    this.itemsUsed = [];
    this.playerDamage = 0; // total damage taken

    // Animation state
    this.shakeTimer = 0;
    this.shakeTarget = null; // 'player' or enemy index
    this.flashTimer = 0;

    // Result
    this.result = null;

    this._addLog(`${encounterRequest.type === 'random' ? 'Ambush! ' : ''}Encountered ${this.enemies.map(e => e.name).join(', ')}!`);
  }

  /** Is the battle finished? */
  get isDone() {
    return this.phase === PHASE.DONE;
  }

  /** Get the BattleResult (only valid after isDone) */
  getResult() {
    return this.result;
  }

  /** Main update */
  update(dt) {
    // Shake animation
    if (this.shakeTimer > 0) this.shakeTimer -= dt;
    if (this.flashTimer > 0) this.flashTimer -= dt;

    switch (this.phase) {
      case PHASE.INTRO:
        this._updateIntro(dt);
        break;
      case PHASE.PLAYER_TURN:
        this._updatePlayerTurn(dt);
        break;
      case PHASE.PLAYER_ACT:
        this._updatePlayerAct(dt);
        break;
      case PHASE.ENEMY_TURN:
        this._updateEnemyTurn(dt);
        break;
      case PHASE.VICTORY:
      case PHASE.DEFEAT:
      case PHASE.FLED:
        this._updateEnd(dt);
        break;
    }
  }

  // ── Phase handlers ──

  _updateIntro(dt) {
    this.introTimer -= dt;
    if (this.introTimer <= 0) {
      this.phase = PHASE.PLAYER_TURN;
      this._addLog('Your turn! Choose an action.');
    }
  }

  _updatePlayerTurn(dt) {
    if (this.subMenu === 'item') {
      this._handleItemMenu();
      return;
    }

    // Navigate main menu
    if (Input.pressed('ArrowUp') || Input.pressed('KeyW')) {
      this.menuIndex = (this.menuIndex - 1 + this.menuItems.length) % this.menuItems.length;
    }
    if (Input.pressed('ArrowDown') || Input.pressed('KeyS')) {
      this.menuIndex = (this.menuIndex + 1) % this.menuItems.length;
    }

    // Target selection (left/right for multiple enemies)
    if (this.enemies.filter(e => e.alive).length > 1) {
      if (Input.pressed('ArrowLeft') || Input.pressed('KeyA')) {
        this._prevTarget();
      }
      if (Input.pressed('ArrowRight') || Input.pressed('KeyD')) {
        this._nextTarget();
      }
    }

    // Confirm action
    if (Input.pressed('Space') || Input.pressed('Enter')) {
      this._executePlayerAction();
    }
  }

  _handleItemMenu() {
    const usable = this.player.inventory.filter(i => {
      const def = ITEM_DEFS[i.itemId];
      return def && def.type === 'consumable' && i.qty > 0;
    });

    if (usable.length === 0) {
      this._addLog('No usable items!');
      this.subMenu = null;
      return;
    }

    if (Input.pressed('ArrowUp') || Input.pressed('KeyW')) {
      this.subMenuIndex = (this.subMenuIndex - 1 + usable.length) % usable.length;
    }
    if (Input.pressed('ArrowDown') || Input.pressed('KeyS')) {
      this.subMenuIndex = (this.subMenuIndex + 1) % usable.length;
    }
    if (Input.pressed('Escape') || Input.pressed('Backspace')) {
      this.subMenu = null;
      return;
    }
    if (Input.pressed('Space') || Input.pressed('Enter')) {
      const item = usable[this.subMenuIndex];
      this._useItem(item);
      this.subMenu = null;
    }
  }

  _executePlayerAction() {
    const action = this.menuItems[this.menuIndex];
    switch (action) {
      case 'Attack':
        this._playerAttack();
        break;
      case 'Skill':
        this._playerSkill();
        break;
      case 'Item':
        this.subMenu = 'item';
        this.subMenuIndex = 0;
        break;
      case 'Flee':
        this._playerFlee();
        break;
    }
  }

  _playerAttack() {
    const target = this._currentTarget();
    if (!target) return;

    const damage = this._calcDamage(this.player.atk, target.def);
    target.hp -= damage;
    this.shakeTarget = this.enemies.indexOf(target);
    this.shakeTimer = 0.3;

    this._addLog(`You attack ${target.name} for ${damage} damage!`);

    if (target.hp <= 0) {
      target.hp = 0;
      target.alive = false;
      this.defeatedIds.push(target.id);
      this.totalXp += target.xpReward;
      this.totalGold += target.goldReward;
      this._rollLoot(target);
      this._addLog(`${target.name} defeated!`);
    }

    this.phase = PHASE.PLAYER_ACT;
    this.actionTimer = 0.6;
  }

  _playerSkill() {
    // Power Strike: 1.5x damage, costs some extra effort
    const target = this._currentTarget();
    if (!target) return;

    const damage = this._calcDamage(Math.floor(this.player.atk * 1.5), target.def);
    target.hp -= damage;
    this.shakeTarget = this.enemies.indexOf(target);
    this.shakeTimer = 0.4;
    this.flashTimer = 0.3;

    this._addLog(`Power Strike on ${target.name} for ${damage} damage!`);

    if (target.hp <= 0) {
      target.hp = 0;
      target.alive = false;
      this.defeatedIds.push(target.id);
      this.totalXp += target.xpReward;
      this.totalGold += target.goldReward;
      this._rollLoot(target);
      this._addLog(`${target.name} defeated!`);
    }

    this.phase = PHASE.PLAYER_ACT;
    this.actionTimer = 0.7;
  }

  _useItem(inventorySlot) {
    const def = ITEM_DEFS[inventorySlot.itemId];
    if (!def) return;

    inventorySlot.qty--;
    this.itemsUsed.push(inventorySlot.itemId);

    if (def.effect === 'heal') {
      const before = this.player.hp;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + def.value);
      const healed = this.player.hp - before;
      this._addLog(`Used ${def.name}. Healed ${healed} HP!`);
    } else if (def.effect === 'cure') {
      this._addLog(`Used ${def.name}. Status cleared!`);
    }

    this.phase = PHASE.PLAYER_ACT;
    this.actionTimer = 0.5;
  }

  _playerFlee() {
    // Flee chance based on player level vs average enemy level
    const fleeChance = 0.5 + this.player.level * 0.05;
    if (this.rng() < fleeChance) {
      this._addLog('You fled successfully!');
      this.phase = PHASE.FLED;
      this.actionTimer = 1.0;
    } else {
      this._addLog('Failed to flee!');
      this.phase = PHASE.PLAYER_ACT;
      this.actionTimer = 0.5;
    }
  }

  _updatePlayerAct(dt) {
    this.actionTimer -= dt;
    if (this.actionTimer <= 0) {
      // Check win condition
      if (this.enemies.every(e => !e.alive)) {
        this.phase = PHASE.VICTORY;
        this._addLog(`Victory! Gained ${this.totalXp} XP and ${this.totalGold} gold.`);
        this.actionTimer = 2.0;
        return;
      }
      // Proceed to enemy turn
      this.phase = PHASE.ENEMY_TURN;
      this.turnIndex = 0;
      this.actionTimer = 0.5;
    }
  }

  _updateEnemyTurn(dt) {
    this.actionTimer -= dt;
    if (this.actionTimer > 0) return;

    // Find next alive enemy
    while (this.turnIndex < this.enemies.length && !this.enemies[this.turnIndex].alive) {
      this.turnIndex++;
    }

    if (this.turnIndex >= this.enemies.length) {
      // All enemies have acted, back to player
      this.player.defending = false;
      this.phase = PHASE.PLAYER_TURN;
      this.menuIndex = 0;
      this._addLog('Your turn!');
      return;
    }

    const enemy = this.enemies[this.turnIndex];
    const damage = this._calcDamage(enemy.atk, this.player.def);
    this.player.hp -= damage;
    this.playerDamage += damage;
    this.shakeTarget = 'player';
    this.shakeTimer = 0.3;

    this._addLog(`${enemy.name} attacks for ${damage} damage!`);

    if (this.player.hp <= 0) {
      this.player.hp = 0;
      this._addLog('You have been defeated...');
      this.phase = PHASE.DEFEAT;
      this.actionTimer = 2.0;
      return;
    }

    this.turnIndex++;
    this.actionTimer = 0.6;
  }

  _updateEnd(dt) {
    this.actionTimer -= dt;
    if (this.actionTimer <= 0) {
      if (Input.pressed('Space') || Input.pressed('Enter') || this.actionTimer < -1.0) {
        this._finalize();
      }
    }
  }

  _finalize() {
    // Build BattleResult
    const snap = this.request.playerSnapshot;
    const hpDelta = this.player.hp - snap.hp;

    // Calculate inventory delta (items used)
    const inventoryDelta = [];
    for (const usedId of this.itemsUsed) {
      const existing = inventoryDelta.find(d => d.itemId === usedId);
      if (existing) existing.qty++;
      else inventoryDelta.push({ itemId: usedId, qty: 1 });
    }

    this.result = {
      playerDelta: {
        hp: hpDelta,
        stamina: -10, // battle tires the player a bit
      },
      loot: this.loot,
      xp: this.totalXp,
      gold: this.totalGold,
      defeatedEnemies: this.defeatedIds.filter(id => id !== -1),
      worldFlags: {},
      fled: this.phase === PHASE.FLED,
      itemsUsed: inventoryDelta,
    };

    this.phase = PHASE.DONE;
  }

  // ── Helpers ──

  _calcDamage(atk, def) {
    const variance = 0.85 + this.rng() * 0.3; // 0.85 to 1.15
    const raw = Math.max(1, Math.floor(atk * variance - def * 0.5));
    return raw;
  }

  _rollLoot(enemy) {
    if (!enemy.loot) return;
    for (const drop of enemy.loot) {
      if (this.rng() < drop.chance) {
        const existing = this.loot.find(l => l.itemId === drop.item);
        if (existing) existing.qty++;
        else this.loot.push({ itemId: drop.item, qty: 1 });
      }
    }
  }

  _currentTarget() {
    const alive = this.enemies.filter(e => e.alive);
    if (alive.length === 0) return null;
    this.targetIndex = clamp(this.targetIndex, 0, alive.length - 1);
    return alive[this.targetIndex];
  }

  _nextTarget() {
    const alive = this.enemies.filter(e => e.alive);
    if (alive.length <= 1) return;
    this.targetIndex = (this.targetIndex + 1) % alive.length;
  }

  _prevTarget() {
    const alive = this.enemies.filter(e => e.alive);
    if (alive.length <= 1) return;
    this.targetIndex = (this.targetIndex - 1 + alive.length) % alive.length;
  }

  _addLog(msg) {
    this.log.push(msg);
    if (this.log.length > 6) this.log.shift();
  }

  // ── Rendering data (consumed by renderer) ──

  get renderData() {
    return {
      phase: this.phase,
      player: this.player,
      enemies: this.enemies,
      menuIndex: this.menuIndex,
      menuItems: this.menuItems,
      subMenu: this.subMenu,
      subMenuIndex: this.subMenuIndex,
      targetIndex: this.targetIndex,
      log: this.log,
      shakeTimer: this.shakeTimer,
      shakeTarget: this.shakeTarget,
      flashTimer: this.flashTimer,
      context: this.request.context,
      totalXp: this.totalXp,
      totalGold: this.totalGold,
      loot: this.loot,
    };
  }
}
