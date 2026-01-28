// ── Map Generation & Region Data ──
// Procedurally generates a tile map with defined regions.

import {
  TILE_SIZE, MAP_COLS, MAP_ROWS,
  TERRAIN, REGIONS,
} from './config.js';
import { createRNG } from './utils.js';

/** The 2D tile grid: map[row][col] = terrain type */
let _tiles = null;

/** Lookup: for a given tile, which region (if any) */
let _regionMap = null;

export const MapData = {
  get tiles() { return _tiles; },
  get regionMap() { return _regionMap; },

  /** Generate the world map */
  generate(seed = 42) {
    const rng = createRNG(seed);

    _tiles = [];
    _regionMap = [];
    for (let r = 0; r < MAP_ROWS; r++) {
      _tiles[r] = new Uint8Array(MAP_COLS);
      _regionMap[r] = new Array(MAP_COLS).fill(null);
      // Default: water
      _tiles[r].fill(TERRAIN.WATER);
    }

    // 1) Fill land mass (roughly oval island)
    const cx = MAP_COLS / 2;
    const cy = MAP_ROWS / 2;
    const rx = MAP_COLS * 0.46;
    const ry = MAP_ROWS * 0.46;

    for (let r = 0; r < MAP_ROWS; r++) {
      for (let c = 0; c < MAP_COLS; c++) {
        const dx = (c - cx) / rx;
        const dy = (r - cy) / ry;
        const d = dx * dx + dy * dy;
        // Add noise to edge
        const noise = (rng() - 0.5) * 0.15;
        if (d + noise < 1.0) {
          _tiles[r][c] = TERRAIN.PLAINS; // default land
        }
      }
    }

    // 2) Paint regions onto the land
    for (const region of REGIONS) {
      const { x, y, w, h, terrain } = region;
      for (let r = y; r < y + h && r < MAP_ROWS; r++) {
        for (let c = x; c < x + w && c < MAP_COLS; c++) {
          if (_tiles[r][c] !== TERRAIN.WATER) {
            _tiles[r][c] = terrain;
            _regionMap[r][c] = region.id;
          }
        }
      }
    }

    // 3) Add some scattered trees in forest edges (decoration)
    // and roughen mountain borders
    for (let r = 1; r < MAP_ROWS - 1; r++) {
      for (let c = 1; c < MAP_COLS - 1; c++) {
        if (_tiles[r][c] === TERRAIN.PLAINS) {
          // Chance to become forest if near forest
          const neighbors = [
            _tiles[r - 1][c], _tiles[r + 1][c],
            _tiles[r][c - 1], _tiles[r][c + 1],
          ];
          const forestNeighbors = neighbors.filter(t => t === TERRAIN.FOREST).length;
          if (forestNeighbors >= 1 && rng() < 0.25) {
            _tiles[r][c] = TERRAIN.FOREST;
          }
          // Chance for mountain fringe
          const mtNeighbors = neighbors.filter(t => t === TERRAIN.MOUNTAIN).length;
          if (mtNeighbors >= 1 && rng() < 0.2) {
            _tiles[r][c] = TERRAIN.MOUNTAIN;
          }
        }
      }
    }

    // 4) Carve paths connecting village to nearby regions
    this._carvePath(60, 52, 60, 70, TERRAIN.PATH); // south
    this._carvePath(60, 38, 60, 20, TERRAIN.PATH); // north
    this._carvePath(50, 45, 30, 45, TERRAIN.PATH); // west
    this._carvePath(70, 45, 90, 45, TERRAIN.PATH); // east

    // 5) Add village buildings (small blocked tiles within village)
    this._addVillageDetails(rng);
  },

  /** Carve a straight-ish path between two points */
  _carvePath(x1, y1, x2, y2, terrain) {
    let cx = x1, cy = y1;
    while (cx !== x2 || cy !== y2) {
      if (_tiles[cy] && _tiles[cy][cx] !== undefined && _tiles[cy][cx] !== TERRAIN.WATER) {
        _tiles[cy][cx] = terrain;
      }
      // also widen path by 1
      if (cx + 1 < MAP_COLS && _tiles[cy][cx + 1] !== TERRAIN.WATER) {
        _tiles[cy][cx + 1] = terrain;
      }
      if (cx !== x2) cx += cx < x2 ? 1 : -1;
      else if (cy !== y2) cy += cy < y2 ? 1 : -1;
    }
  },

  /** Add some structure to the village */
  _addVillageDetails(rng) {
    const region = REGIONS.find(r => r.id === 'village_start');
    if (!region) return;
    // Place a few "building" tiles (using mountain as impassable for simplicity)
    const buildings = [
      { x: region.x + 3,  y: region.y + 3,  w: 3, h: 2 }, // Inn
      { x: region.x + 10, y: region.y + 3,  w: 3, h: 2 }, // Shop
      { x: region.x + 6,  y: region.y + 9,  w: 4, h: 2 }, // Guild
      { x: region.x + 14, y: region.y + 8,  w: 3, h: 2 }, // Blacksmith
    ];
    for (const b of buildings) {
      for (let r = b.y; r < b.y + b.h; r++) {
        for (let c = b.x; c < b.x + b.w; c++) {
          if (r >= 0 && r < MAP_ROWS && c >= 0 && c < MAP_COLS) {
            // We keep terrain as VILLAGE but mark as non-walkable via a special flag
            _tiles[r][c] = TERRAIN.MOUNTAIN; // reuse mountain as "solid"
          }
        }
      }
    }
  },

  /** Get terrain at pixel position */
  terrainAt(px, py) {
    const col = Math.floor(px / TILE_SIZE);
    const row = Math.floor(py / TILE_SIZE);
    if (row < 0 || row >= MAP_ROWS || col < 0 || col >= MAP_COLS) return TERRAIN.WATER;
    return _tiles[row][col];
  },

  /** Check if pixel position is walkable */
  isWalkable(px, py) {
    const terrain = this.terrainAt(px, py);
    return !!({
      [TERRAIN.PLAINS]: true,
      [TERRAIN.FOREST]: true,
      [TERRAIN.DESERT]: true,
      [TERRAIN.SWAMP]: true,
      [TERRAIN.VILLAGE]: true,
      [TERRAIN.PATH]: true,
    })[terrain];
  },

  /** Get region at pixel position (or null) */
  regionAt(px, py) {
    const col = Math.floor(px / TILE_SIZE);
    const row = Math.floor(py / TILE_SIZE);
    if (row < 0 || row >= MAP_ROWS || col < 0 || col >= MAP_COLS) return null;
    const id = _regionMap[row][col];
    if (!id) return null;
    return REGIONS.find(r => r.id === id) || null;
  },

  /** Get region by ID */
  regionById(id) {
    return REGIONS.find(r => r.id === id) || null;
  },

  /** Get a random walkable position within a region */
  randomPositionInRegion(region, rng = Math.random) {
    for (let attempts = 0; attempts < 200; attempts++) {
      const col = region.x + Math.floor(rng() * region.w);
      const row = region.y + Math.floor(rng() * region.h);
      if (row >= 0 && row < MAP_ROWS && col >= 0 && col < MAP_COLS) {
        const px = col * TILE_SIZE + TILE_SIZE / 2;
        const py = row * TILE_SIZE + TILE_SIZE / 2;
        if (this.isWalkable(px, py)) {
          return { x: px, y: py };
        }
      }
    }
    // Fallback: center of region
    return {
      x: (region.x + region.w / 2) * TILE_SIZE,
      y: (region.y + region.h / 2) * TILE_SIZE,
    };
  },
};
