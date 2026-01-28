// ── Renderer ──
// Handles all canvas drawing for overworld, battle, and UI.

import {
  TILE_SIZE,
  TERRAIN, TERRAIN_COLORS, ENEMY_DEFS,
  ITEM_DEFS, PLAYER_RADIUS, GRID_SIZE,
} from './config.js';
import { MapData } from './map-data.js';
import { WorldState } from './world-state.js';
import { Camera } from './overworld.js';

let _canvas, _ctx;

export const Renderer = {
  /** Initialize with canvas element */
  init(canvas) {
    _canvas = canvas;
    _ctx = canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
  },

  resize() {
    _canvas.width = _canvas.clientWidth;
    _canvas.height = _canvas.clientHeight;
    Camera.resize(_canvas.width, _canvas.height);
  },

  get width() { return _canvas.width; },
  get height() { return _canvas.height; },

  // ═══════════════════════════════════════════
  // OVERWORLD RENDERING
  // ═══════════════════════════════════════════

  drawOverworld() {
    const ctx = _ctx;
    const cam = Camera;

    // Clear to transparent — the Genshin map iframe shows through behind us
    ctx.clearRect(0, 0, _canvas.width, _canvas.height);

    // Draw board-game style grid
    this._drawGrid(ctx, cam);

    // Draw enemies
    for (const enemy of WorldState.enemies) {
      if (!enemy.alive) continue;
      const sx = enemy.x - cam.x;
      const sy = enemy.y - cam.y;
      // Cull offscreen
      if (sx < -40 || sx > cam.width + 40 || sy < -40 || sy > cam.height + 40) continue;

      const def = ENEMY_DEFS[enemy.typeId];
      if (!def) continue;

      // Enemy body
      ctx.fillStyle = def.color;
      ctx.beginPath();
      ctx.arc(sx, sy, def.size / 2, 0, Math.PI * 2);
      ctx.fill();

      // Enemy letter
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(def.sprite, sx, sy);

      // Health bar (if not full)
      if (enemy.hp < def.hp) {
        const bw = def.size + 4;
        const bx = sx - bw / 2;
        const by = sy - def.size / 2 - 8;
        ctx.fillStyle = '#333';
        ctx.fillRect(bx, by, bw, 4);
        ctx.fillStyle = '#e44';
        ctx.fillRect(bx, by, bw * (enemy.hp / def.hp), 4);
      }
    }

    // Draw player
    this._drawPlayer(ctx, cam);

    // Draw HUD
    this._drawHUD(ctx);
  },

  _drawTileDetail(ctx, terrain, sx, sy, col, row) {
    const hash = ((col * 7 + row * 13) & 0xff) / 255;

    switch (terrain) {
      case TERRAIN.FOREST:
        // Draw tree dots
        if (hash > 0.3) {
          ctx.fillStyle = '#2a5e22';
          ctx.beginPath();
          ctx.arc(sx + 16 + hash * 6, sy + 12 + hash * 8, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#4a3020';
          ctx.fillRect(sx + 14 + hash * 6, sy + 18 + hash * 8, 4, 4);
        }
        break;

      case TERRAIN.MOUNTAIN:
        // Draw rocky texture
        ctx.fillStyle = '#7a7a7a';
        ctx.fillRect(sx + 4, sy + 4, 24, 24);
        ctx.fillStyle = '#9a9a8a';
        ctx.fillRect(sx + 8, sy + 2, 16, 8);
        break;

      case TERRAIN.DESERT:
        // Draw sand ripples
        if (hash > 0.5) {
          ctx.strokeStyle = '#c4a85a';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(sx + 4, sy + 16);
          ctx.quadraticCurveTo(sx + 16, sy + 10, sx + 28, sy + 16);
          ctx.stroke();
        }
        break;

      case TERRAIN.SWAMP:
        // Draw murky pools
        if (hash > 0.6) {
          ctx.fillStyle = '#3a5b48';
          ctx.beginPath();
          ctx.ellipse(sx + 16, sy + 16, 8, 5, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        break;

      case TERRAIN.VILLAGE:
        // Draw floor tiles
        ctx.strokeStyle = '#b09050';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(sx + 1, sy + 1, TILE_SIZE - 2, TILE_SIZE - 2);
        break;

      case TERRAIN.PATH:
        // Draw path stones
        ctx.fillStyle = '#a89060';
        ctx.fillRect(sx + 2, sy + 2, 12, 12);
        ctx.fillRect(sx + 18, sy + 18, 12, 12);
        break;
    }
  },

  _drawPlayer(ctx, cam) {
    const p = WorldState.player;
    const sx = p.x - cam.x;
    const sy = p.y - cam.y;

    // Grace period flash
    if (p.graceTimer > 0 && Math.floor(p.graceTimer * 8) % 2 === 0) {
      ctx.globalAlpha = 0.5;
    }

    // Player shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(sx, sy + PLAYER_RADIUS + 2, PLAYER_RADIUS, PLAYER_RADIUS * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Player body
    ctx.fillStyle = '#4488ff';
    ctx.beginPath();
    ctx.arc(sx, sy, PLAYER_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    // Player outline
    ctx.strokeStyle = '#2266cc';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Facing indicator (small triangle)
    ctx.fillStyle = '#fff';
    const facingOffsets = {
      up:    { dx: 0, dy: -PLAYER_RADIUS - 4 },
      down:  { dx: 0, dy: PLAYER_RADIUS + 4 },
      left:  { dx: -PLAYER_RADIUS - 4, dy: 0 },
      right: { dx: PLAYER_RADIUS + 4, dy: 0 },
    };
    const fo = facingOffsets[p.facing] || facingOffsets.down;
    ctx.beginPath();
    ctx.arc(sx + fo.dx, sy + fo.dy, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1;
  },

  _drawHUD(ctx) {
    const p = WorldState.player;
    const region = MapData.regionAt(p.x, p.y);

    // Region label
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(8, 8, 240, 28);
    ctx.fillStyle = '#ccc';
    ctx.font = '13px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(region ? region.name : 'Wilderness', 16, 22);

    // Controls hint (bottom)
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(8, _canvas.height - 30, 360, 24);
    ctx.fillStyle = '#888';
    ctx.font = '11px monospace';
    ctx.fillText('Movement locked  |  C: Character  |  T: Teams  |  +/-: Zoom', 14, _canvas.height - 22);
  },

  // ═══════════════════════════════════════════
  // BATTLE RENDERING
  // ═══════════════════════════════════════════

  drawBattle(battleData) {
    const ctx = _ctx;
    const w = _canvas.width;
    const h = _canvas.height;
    const d = battleData;

    // Background
    this._drawBattleBackground(ctx, w, h, d.context);

    // Enemy sprites
    this._drawBattleEnemies(ctx, w, h, d);

    // Player sprite
    this._drawBattlePlayer(ctx, w, h, d);

    // UI Panel
    this._drawBattleUI(ctx, w, h, d);

    // Battle log
    this._drawBattleLog(ctx, w, h, d);

    // Victory/Defeat overlay
    if (d.phase === 'victory' || d.phase === 'defeat' || d.phase === 'fled') {
      this._drawBattleEndOverlay(ctx, w, h, d);
    }
  },

  _drawBattleBackground(ctx, w, h, context) {
    // Gradient sky
    const grad = ctx.createLinearGradient(0, 0, 0, h * 0.6);
    grad.addColorStop(0, '#1a1a3e');
    grad.addColorStop(1, '#2a3a5e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h * 0.6);

    // Ground
    const terrainColor = TERRAIN_COLORS[context.terrainId] || '#555';
    ctx.fillStyle = terrainColor;
    ctx.fillRect(0, h * 0.55, w, h * 0.45);

    // Ground line
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.55);
    ctx.lineTo(w, h * 0.55);
    ctx.stroke();

    // Region name
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(context.regionName || '', w / 2, 20);
  },

  _drawBattleEnemies(ctx, w, h, d) {
    const enemies = d.enemies;
    const aliveCount = enemies.filter(e => e.alive).length;
    const spacing = Math.min(160, w / (enemies.length + 1));
    const baseX = w / 2 - (enemies.length - 1) * spacing / 2;
    const baseY = h * 0.35;

    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      let ex = baseX + i * spacing;
      let ey = baseY;

      // Shake animation
      if (d.shakeTimer > 0 && d.shakeTarget === i) {
        ex += (Math.random() - 0.5) * 8;
        ey += (Math.random() - 0.5) * 8;
      }

      if (!e.alive) {
        ctx.globalAlpha = 0.2;
      }

      // Is this the current target?
      const aliveEnemies = enemies.filter(en => en.alive);
      const isTarget = d.phase === 'player_turn' && e.alive &&
        aliveEnemies[d.targetIndex] === e;

      if (isTarget) {
        // Target indicator
        ctx.strokeStyle = '#ff0';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(ex, ey, 30, 0, Math.PI * 2);
        ctx.stroke();

        // Arrow above
        ctx.fillStyle = '#ff0';
        ctx.beginPath();
        ctx.moveTo(ex, ey - 40);
        ctx.lineTo(ex - 6, ey - 48);
        ctx.lineTo(ex + 6, ey - 48);
        ctx.closePath();
        ctx.fill();
      }

      // Enemy body
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.arc(ex, ey, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Enemy sprite letter
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 20px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(e.sprite, ex, ey);

      // Enemy name
      ctx.font = '12px monospace';
      ctx.fillStyle = '#ddd';
      ctx.fillText(e.name, ex, ey + 40);

      // HP bar
      const bw = 50;
      ctx.fillStyle = '#333';
      ctx.fillRect(ex - bw / 2, ey + 48, bw, 6);
      const hpRatio = Math.max(0, e.hp / e.maxHp);
      ctx.fillStyle = hpRatio > 0.5 ? '#4c4' : hpRatio > 0.25 ? '#cc4' : '#c44';
      ctx.fillRect(ex - bw / 2, ey + 48, bw * hpRatio, 6);

      // HP text
      ctx.fillStyle = '#ccc';
      ctx.font = '10px monospace';
      ctx.fillText(`${Math.max(0, e.hp)}/${e.maxHp}`, ex, ey + 62);

      ctx.globalAlpha = 1;
    }
  },

  _drawBattlePlayer(ctx, w, h, d) {
    const p = d.player;
    let px = w * 0.15;
    let py = h * 0.65;

    // Shake
    if (d.shakeTimer > 0 && d.shakeTarget === 'player') {
      px += (Math.random() - 0.5) * 10;
      py += (Math.random() - 0.5) * 10;
    }

    // Flash (skill effect)
    if (d.flashTimer > 0) {
      ctx.fillStyle = 'rgba(255, 255, 100, 0.3)';
      ctx.fillRect(0, 0, w, h);
    }

    // Player shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(px, py + 30, 28, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Player body
    ctx.fillStyle = '#4488ff';
    ctx.beginPath();
    ctx.arc(px, py, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2266cc';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Player label
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('P', px, py);

    // Player HP bar
    ctx.fillStyle = '#333';
    ctx.fillRect(px - 30, py + 38, 60, 8);
    const hpRatio = Math.max(0, p.hp / p.maxHp);
    ctx.fillStyle = hpRatio > 0.5 ? '#4c4' : hpRatio > 0.25 ? '#cc4' : '#c44';
    ctx.fillRect(px - 30, py + 38, 60 * hpRatio, 8);

    ctx.fillStyle = '#fff';
    ctx.font = '12px monospace';
    ctx.fillText(`${Math.max(0, Math.ceil(p.hp))}/${p.maxHp}`, px, py + 56);
    ctx.fillText(`Lv.${p.level}`, px, py + 70);
  },

  _drawBattleUI(ctx, w, h, d) {
    // Action menu panel
    const panelH = 120;
    const panelY = h - panelH;

    ctx.fillStyle = 'rgba(10, 10, 30, 0.9)';
    ctx.fillRect(0, panelY, w, panelH);
    ctx.strokeStyle = '#446';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, panelY);
    ctx.lineTo(w, panelY);
    ctx.stroke();

    if (d.phase === 'player_turn') {
      if (d.subMenu === 'item') {
        this._drawItemSubMenu(ctx, w, panelY, d);
      } else {
        this._drawActionMenu(ctx, w, panelY, d);
      }
    } else if (d.phase === 'intro') {
      ctx.fillStyle = '#aaa';
      ctx.font = '16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Battle Start!', w / 2, panelY + 50);
    } else if (d.phase === 'enemy_turn' || d.phase === 'player_act') {
      ctx.fillStyle = '#888';
      ctx.font = '14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('...', w / 2, panelY + 50);
    }
  },

  _drawActionMenu(ctx, w, panelY, d) {
    const menuX = 30;
    const menuY = panelY + 16;

    ctx.font = '16px monospace';
    ctx.textAlign = 'left';

    for (let i = 0; i < d.menuItems.length; i++) {
      const isSelected = i === d.menuIndex;
      ctx.fillStyle = isSelected ? '#ff4' : '#aaa';
      const prefix = isSelected ? '> ' : '  ';
      ctx.fillText(`${prefix}${d.menuItems[i]}`, menuX, menuY + i * 24);
    }

    // Target info (right side)
    const aliveEnemies = d.enemies.filter(e => e.alive);
    if (aliveEnemies.length > 0) {
      const target = aliveEnemies[d.targetIndex];
      if (target) {
        ctx.fillStyle = '#ccc';
        ctx.textAlign = 'right';
        ctx.font = '14px monospace';
        ctx.fillText(`Target: ${target.name}`, w - 30, menuY);
        ctx.fillText(`HP: ${Math.max(0, target.hp)}/${target.maxHp}`, w - 30, menuY + 20);
        if (aliveEnemies.length > 1) {
          ctx.fillStyle = '#888';
          ctx.fillText('< A/D to switch target >', w - 30, menuY + 44);
        }
      }
    }

    // Controls hint
    ctx.fillStyle = '#555';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('W/S: Select  |  Space/Enter: Confirm', w / 2, panelY + 108);
  },

  _drawItemSubMenu(ctx, w, panelY, d) {
    ctx.font = '14px monospace';
    ctx.textAlign = 'left';

    ctx.fillStyle = '#aaa';
    ctx.fillText('Items:', 30, panelY + 16);

    const usable = d.player.inventory.filter(i => {
      const def = ITEM_DEFS[i.itemId];
      return def && def.type === 'consumable' && i.qty > 0;
    });

    if (usable.length === 0) {
      ctx.fillStyle = '#666';
      ctx.fillText('  No items available', 30, panelY + 38);
    } else {
      for (let i = 0; i < usable.length; i++) {
        const item = usable[i];
        const def = ITEM_DEFS[item.itemId];
        const isSelected = i === d.subMenuIndex;
        ctx.fillStyle = isSelected ? '#ff4' : '#aaa';
        const prefix = isSelected ? '> ' : '  ';
        ctx.fillText(`${prefix}${def.name} x${item.qty}`, 30, panelY + 38 + i * 20);

        if (isSelected) {
          ctx.fillStyle = '#888';
          ctx.textAlign = 'right';
          ctx.fillText(def.desc, w - 30, panelY + 38 + i * 20);
          ctx.textAlign = 'left';
        }
      }
    }

    ctx.fillStyle = '#555';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('W/S: Select  |  Space: Use  |  Esc: Back', w / 2, panelY + 108);
  },

  _drawBattleLog(ctx, w, h, d) {
    const logX = w * 0.35;
    const logY = h * 0.55;
    const logW = w * 0.6;

    ctx.font = '13px monospace';
    ctx.textAlign = 'left';

    const visibleLogs = d.log.slice(-4);
    for (let i = 0; i < visibleLogs.length; i++) {
      const alpha = 0.4 + 0.6 * ((i + 1) / visibleLogs.length);
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.fillText(visibleLogs[i], logX, logY + i * 18);
    }
  },

  _drawBattleEndOverlay(ctx, w, h, d) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, w, h);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (d.phase === 'victory') {
      ctx.fillStyle = '#ff4';
      ctx.font = 'bold 36px monospace';
      ctx.fillText('VICTORY!', w / 2, h / 2 - 60);

      ctx.font = '18px monospace';
      ctx.fillStyle = '#ccc';
      ctx.fillText(`XP gained: ${d.totalXp}`, w / 2, h / 2 - 10);
      ctx.fillText(`Gold gained: ${d.totalGold}`, w / 2, h / 2 + 18);

      if (d.loot.length > 0) {
        const lootStr = d.loot.map(l => {
          const def = ITEM_DEFS[l.itemId];
          return `${def ? def.name : l.itemId} x${l.qty}`;
        }).join(', ');
        ctx.fillStyle = '#8f8';
        ctx.fillText(`Loot: ${lootStr}`, w / 2, h / 2 + 46);
      }

      ctx.fillStyle = '#888';
      ctx.font = '14px monospace';
      ctx.fillText('Press Space to continue', w / 2, h / 2 + 80);
    } else if (d.phase === 'defeat') {
      ctx.fillStyle = '#f44';
      ctx.font = 'bold 36px monospace';
      ctx.fillText('DEFEATED', w / 2, h / 2 - 30);
      ctx.font = '16px monospace';
      ctx.fillStyle = '#aaa';
      ctx.fillText('You will respawn at the village...', w / 2, h / 2 + 10);
      ctx.fillStyle = '#888';
      ctx.font = '14px monospace';
      ctx.fillText('Press Space to continue', w / 2, h / 2 + 50);
    } else if (d.phase === 'fled') {
      ctx.fillStyle = '#aaa';
      ctx.font = 'bold 28px monospace';
      ctx.fillText('Escaped!', w / 2, h / 2 - 20);
      ctx.fillStyle = '#888';
      ctx.font = '14px monospace';
      ctx.fillText('Press Space to continue', w / 2, h / 2 + 20);
    }
  },

  // ═══════════════════════════════════════════
  // TRANSITION EFFECT
  // ═══════════════════════════════════════════

  drawTransition(progress, entering) {
    const ctx = _ctx;
    const w = _canvas.width;
    const h = _canvas.height;

    // Radial wipe effect
    const maxRadius = Math.sqrt(w * w + h * h) / 2;
    const radius = entering
      ? maxRadius * (1 - progress) // shrinking circle (entering battle)
      : maxRadius * progress;       // expanding circle (leaving battle)

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, radius, 0, Math.PI * 2);
    ctx.clip();
    // The scene underneath has already been drawn before this call
    ctx.restore();
  },

  /** Draw a full-screen black with alpha */
  drawFade(alpha) {
    const ctx = _ctx;
    ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
    ctx.fillRect(0, 0, _canvas.width, _canvas.height);
  },

  // ═══════════════════════════════════════════
  // CHARACTER SCREEN
  // ═══════════════════════════════════════════

  drawCharacter(selectedCityIndex) {
    const ctx = _ctx;
    const w = _canvas.width;
    const h = _canvas.height;
    const p = WorldState.player;
    const cities = WorldState.unlockedCities.map(id => MapData.regionById(id)).filter(Boolean);

    // Dim background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, w, h);

    // Panel
    const panelW = 400;
    const panelH = 500;
    const px = (w - panelW) / 2;
    const py = (h - panelH) / 2;

    ctx.fillStyle = 'rgba(20, 20, 40, 0.95)';
    ctx.fillRect(px, py, panelW, panelH);
    ctx.strokeStyle = '#668';
    ctx.lineWidth = 2;
    ctx.strokeRect(px, py, panelW, panelH);

    // Title
    ctx.fillStyle = '#ff4';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('CHARACTER', w / 2, py + 28);

    // Stats
    ctx.font = '14px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ccc';
    ctx.fillText(`Level: ${p.level}   ATK: ${p.atk}   DEF: ${p.def}`, px + 20, py + 58);
    ctx.fillText(`HP: ${Math.ceil(p.hp)}/${p.maxHp}   Gold: ${p.gold}`, px + 20, py + 78);

    // Items
    ctx.fillStyle = '#aaa';
    ctx.fillText('Items:', px + 20, py + 110);

    if (p.inventory.length === 0) {
      ctx.fillStyle = '#666';
      ctx.fillText('  (empty)', px + 20, py + 134);
    } else {
      for (let i = 0; i < p.inventory.length; i++) {
        const slot = p.inventory[i];
        const def = ITEM_DEFS[slot.itemId];
        ctx.fillStyle = '#ccc';
        ctx.fillText(`  ${def ? def.name : slot.itemId} x${slot.qty}`, px + 20, py + 134 + i * 22);
      }
    }

    // Teleport cities
    const citiesStartY = py + 220;
    ctx.fillStyle = '#aaa';
    ctx.fillText('Teleport Cities:', px + 20, citiesStartY);

    if (cities.length === 0) {
      ctx.fillStyle = '#666';
      ctx.fillText('  (none unlocked)', px + 20, citiesStartY + 24);
    } else {
      for (let i = 0; i < cities.length; i++) {
        const city = cities[i];
        const isSelected = i === selectedCityIndex;
        ctx.fillStyle = isSelected ? '#6cf' : '#ccc';
        const prefix = isSelected ? '> ' : '  ';
        ctx.fillText(`${prefix}${city.name}`, px + 20, citiesStartY + 24 + i * 20);
      }
    }

    // Controls
    ctx.fillStyle = '#555';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('C or Esc: Close  |  W/S: Select City  |  Enter: Teleport', w / 2, py + panelH - 16);
  },

  // ═══════════════════════════════════════════
  // TEAMS SCREEN
  // ═══════════════════════════════════════════

  drawTeams() {
    const ctx = _ctx;
    const w = _canvas.width;
    const h = _canvas.height;

    // Dim background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, w, h);

    // Panel
    const panelW = 420;
    const panelH = 360;
    const px = (w - panelW) / 2;
    const py = (h - panelH) / 2;

    ctx.fillStyle = 'rgba(20, 20, 40, 0.95)';
    ctx.fillRect(px, py, panelW, panelH);
    ctx.strokeStyle = '#668';
    ctx.lineWidth = 2;
    ctx.strokeRect(px, py, panelW, panelH);

    ctx.fillStyle = '#6cf';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('TEAMS', w / 2, py + 32);

    ctx.fillStyle = '#aaa';
    ctx.font = '14px monospace';
    ctx.fillText('Team management coming soon.', w / 2, py + 90);

    ctx.fillStyle = '#555';
    ctx.font = '12px monospace';
    ctx.fillText('T or Esc: Close', w / 2, py + panelH - 18);
  },

  _drawGrid(ctx, cam) {
    const startX = Math.floor(cam.x / GRID_SIZE) * GRID_SIZE;
    const endX = cam.x + cam.width;
    const startY = Math.floor(cam.y / GRID_SIZE) * GRID_SIZE;
    const endY = cam.y + cam.height;

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;

    for (let x = startX; x <= endX; x += GRID_SIZE) {
      const sx = x - cam.x;
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, cam.height);
      ctx.stroke();
    }

    for (let y = startY; y <= endY; y += GRID_SIZE) {
      const sy = y - cam.y;
      ctx.beginPath();
      ctx.moveTo(0, sy);
      ctx.lineTo(cam.width, sy);
      ctx.stroke();
    }

    ctx.restore();
  },

  _drawGrid(ctx, cam) {
    const startX = Math.floor(cam.x / GRID_SIZE) * GRID_SIZE;
    const endX = cam.x + cam.width;
    const startY = Math.floor(cam.y / GRID_SIZE) * GRID_SIZE;
    const endY = cam.y + cam.height;

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;

    for (let x = startX; x <= endX; x += GRID_SIZE) {
      const sx = x - cam.x;
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, cam.height);
      ctx.stroke();
    }

    for (let y = startY; y <= endY; y += GRID_SIZE) {
      const sy = y - cam.y;
      ctx.beginPath();
      ctx.moveTo(0, sy);
      ctx.lineTo(cam.width, sy);
      ctx.stroke();
    }

    ctx.restore();
  },
};
