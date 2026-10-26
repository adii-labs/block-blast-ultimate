/**
 * Block Blast Ultimate — Core Board Logic, Predictive Line Glow, Line Clears, Combos & Power-up Execution
 * Guarantees simultaneous row+column clears never double-count the intersection cell.
 */
(function (global) {
  'use strict';

  const PIECES = global.BBU_PIECES;

  function createEmptyGrid(size) {
    const n = Number(size) || 8;
    const grid = [];
    for (let r = 0; r < n; r++) {
      const row = [];
      for (let c = 0; c < n; c++) {
        row.push(null);
      }
      grid.push(row);
    }
    return grid;
  }

  function cloneGrid(grid) {
    return grid.map(row => row.map(cell => (cell ? Object.assign({}, cell) : null)));
  }

  function canPlacePieceAt(grid, piece, targetRow, targetCol) {
    if (!grid || !piece || piece.placed) return false;
    const size = grid.length;
    if (targetRow < 0 || targetCol < 0) return false;
    if (targetRow + piece.rows > size || targetCol + piece.cols > size) return false;

    for (let r = 0; r < piece.rows; r++) {
      for (let c = 0; c < piece.cols; c++) {
        if (piece.matrix[r][c]) {
          if (grid[targetRow + r][targetCol + c] !== null) {
            return false;
          }
        }
      }
    }
    return true;
  }

  /**
   * Computes which rows and columns WOULD be completed if `piece` were placed at `(targetRow, targetCol)`.
   * Used by the canvas renderer to draw a golden predictive glow on about-to-clear rows & columns while dragging.
   */
  function getPredictiveClears(grid, piece, targetRow, targetCol) {
    if (!canPlacePieceAt(grid, piece, targetRow, targetCol)) {
      return { valid: false, rows: [], cols: [], cellKeys: new Set() };
    }
    const size = grid.length;
    const occupied = new Set();
    for (let pr = 0; pr < piece.rows; pr++) {
      for (let pc = 0; pc < piece.cols; pc++) {
        if (piece.matrix[pr][pc]) {
          occupied.add(`${targetRow + pr},${targetCol + pc}`);
        }
      }
    }

    const rows = [];
    const cols = [];
    const cellKeys = new Set();

    for (let r = 0; r < size; r++) {
      let full = true;
      for (let c = 0; c < size; c++) {
        if (grid[r][c] === null && !occupied.has(`${r},${c}`)) {
          full = false;
          break;
        }
      }
      if (full) {
        rows.push(r);
        for (let c = 0; c < size; c++) cellKeys.add(`${r},${c}`);
      }
    }

    for (let c = 0; c < size; c++) {
      let full = true;
      for (let r = 0; r < size; r++) {
        if (grid[r][c] === null && !occupied.has(`${r},${c}`)) {
          full = false;
          break;
        }
      }
      if (full) {
        cols.push(c);
        for (let r = 0; r < size; r++) cellKeys.add(`${r},${c}`);
      }
    }

    return { valid: true, rows, cols, cellKeys };
  }

  /**
   * Places a piece on the board, detects all full rows & full columns simultaneously,
   * clears unique cells without double-counting intersections, and computes combo & multi-line bonuses.
   */
  function placePieceAndResolve(grid, piece, targetRow, targetCol, currentComboStreak = 0) {
    if (!canPlacePieceAt(grid, piece, targetRow, targetCol)) {
      return { valid: false };
    }

    const size = grid.length;
    const nextGrid = cloneGrid(grid);
    const placedCoords = [];

    for (let r = 0; r < piece.rows; r++) {
      for (let c = 0; c < piece.cols; c++) {
        if (piece.matrix[r][c]) {
          nextGrid[targetRow + r][targetCol + c] = {
            colorIdx: piece.colorIdx,
            gem: Boolean(piece.hasGem && r === 0 && c === 0),
            bombTimer: null
          };
          placedCoords.push({ r: targetRow + r, c: targetCol + c, colorIdx: piece.colorIdx });
        }
      }
    }

    // Check full rows and full columns simultaneously BEFORE clearing any cell
    const clearedRows = [];
    const clearedCols = [];

    for (let r = 0; r < size; r++) {
      let rowFull = true;
      for (let c = 0; c < size; c++) {
        if (nextGrid[r][c] === null) {
          rowFull = false;
          break;
        }
      }
      if (rowFull) clearedRows.push(r);
    }

    for (let c = 0; c < size; c++) {
      let colFull = true;
      for (let r = 0; r < size; r++) {
        if (nextGrid[r][c] === null) {
          colFull = false;
          break;
        }
      }
      if (colFull) clearedCols.push(c);
    }

    // Collect unique cleared cells using a coordinate key set so row+col intersections are counted ONCE
    const uniqueCellMap = new Map();
    for (const r of clearedRows) {
      for (let c = 0; c < size; c++) {
        const key = `${r},${c}`;
        if (!uniqueCellMap.has(key) && nextGrid[r][c] !== null) {
          uniqueCellMap.set(key, { r, c, cell: Object.assign({}, nextGrid[r][c]) });
        }
      }
    }
    for (const c of clearedCols) {
      for (let r = 0; r < size; r++) {
        const key = `${r},${c}`;
        if (!uniqueCellMap.has(key) && nextGrid[r][c] !== null) {
          uniqueCellMap.set(key, { r, c, cell: Object.assign({}, nextGrid[r][c]) });
        }
      }
    }

    const clearedCells = Array.from(uniqueCellMap.values());
    let gemsCollected = 0;
    let bombsDefused = 0;

    for (const item of clearedCells) {
      if (item.cell.gem) gemsCollected++;
      if (typeof item.cell.bombTimer === 'number') bombsDefused++;
      nextGrid[item.r][item.c] = null;
    }

    const totalLinesCleared = clearedRows.length + clearedCols.length;
    const nextComboStreak = totalLinesCleared > 0 ? currentComboStreak + 1 : 0;
    const comboMultiplier = totalLinesCleared > 0 ? Math.min(8, nextComboStreak) : 1;

    // Scoring formula:
    // +10 per placed block cell
    // +100 per cleared line, scaled by multi-line bonus (1 line=100, 2=250, 3=450, 4=700, 5+=1050)
    // Multiplied by combo multiplier
    const placementPoints = placedCoords.length * 10;
    const lineBonusTable = [0, 100, 250, 450, 700, 1050, 1500];
    const baseLineScore = totalLinesCleared < lineBonusTable.length
      ? lineBonusTable[totalLinesCleared]
      : totalLinesCleared * 260;
    const clearPoints = baseLineScore * comboMultiplier;

    // Check if the entire board was wiped clean (All-Clear Bonus = +300)
    let remainingOccupied = 0;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (nextGrid[r][c] !== null) remainingOccupied++;
      }
    }
    const boardCleanBonus = (totalLinesCleared > 0 && remainingOccupied === 0) ? 300 : 0;
    const pointsEarned = placementPoints + clearPoints + boardCleanBonus;

    return {
      valid: true,
      grid: nextGrid,
      placedCoords,
      clearedRows,
      clearedCols,
      totalLinesCleared,
      clearedCells,
      uniqueCellsClearedCount: clearedCells.length,
      comboStreak: nextComboStreak,
      comboMultiplier,
      pointsEarned,
      boardCleanBonus,
      gemsCollected,
      bombsDefused
    };
  }

  function hasAnyValidMove(grid, trayPieces) {
    if (!grid || !Array.isArray(trayPieces)) return false;
    const available = trayPieces.filter(p => p && !p.placed);
    if (available.length === 0) return true;
    for (const p of available) {
      if (PIECES.canPieceFitBoard(grid, p)) {
        return true;
      }
    }
    return false;
  }

  function getRocketPath(size, startRow, startCol, axis, direction) {
    if (
      !Number.isInteger(startRow) || !Number.isInteger(startCol) ||
      startRow < 0 || startRow >= size || startCol < 0 || startCol >= size ||
      !['row', 'col'].includes(axis) || ![-1, 1].includes(direction)
    ) return [];

    const path = [];
    let row = startRow;
    let col = startCol;
    while (row >= 0 && row < size && col >= 0 && col < size) {
      path.push({ r: row, c: col });
      if (axis === 'row') col += direction;
      else row += direction;
    }
    return path;
  }

  function applyRocketPath(grid, startRow, startCol, axis, direction) {
    const path = getRocketPath(grid.length, startRow, startCol, axis, direction);
    if (path.length === 0) return { valid: false };

    const nextGrid = cloneGrid(grid);
    const clearedCells = [];
    let gemsCollected = 0;
    let bombsDefused = 0;

    for (const { r, c } of path) {
      if (nextGrid[r][c] === null) continue;
      if (nextGrid[r][c].gem) gemsCollected++;
      if (typeof nextGrid[r][c].bombTimer === 'number') bombsDefused++;
      clearedCells.push({ r, c, cell: Object.assign({}, nextGrid[r][c]) });
      nextGrid[r][c] = null;
    }

    return {
      valid: true,
      grid: nextGrid,
      path,
      clearedCells,
      pointsEarned: Math.max(80, clearedCells.length * 20),
      gemsCollected,
      bombsDefused
    };
  }

  /**
   * Power-up: Hammer removes exactly ONE occupied cell.
   * Requires target cell to be occupied; otherwise returns { valid: false } so no charge is consumed.
   */
  function applyHammer(grid, targetRow, targetCol) {
    const size = grid.length;
    if (targetRow < 0 || targetRow >= size || targetCol < 0 || targetCol >= size) {
      return { valid: false, reason: 'Tap inside the board!' };
    }
    if (grid[targetRow][targetCol] === null) {
      return { valid: false, reason: 'Tap a block on the board to smash it!' };
    }
    const nextGrid = cloneGrid(grid);
    const cell = Object.assign({}, nextGrid[targetRow][targetCol]);
    nextGrid[targetRow][targetCol] = null;

    return {
      valid: true,
      grid: nextGrid,
      clearedCells: [{ r: targetRow, c: targetCol, cell }],
      pointsEarned: 30,
      gemsCollected: cell.gem ? 1 : 0,
      bombsDefused: typeof cell.bombTimer === 'number' ? 1 : 0
    };
  }

  /**
   * Computes affected coordinates for Basic Bomb (3x3 square) or Mega Bomb (5x5 diamond + 3x3 core).
   */
  function getBombAffectedCoords(size, centerRow, centerCol, bombType) {
    const coords = [];
    if (centerRow < 0 || centerRow >= size || centerCol < 0 || centerCol >= size) return coords;

    if (bombType === 'bomb_mega') {
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const r = centerRow + dr;
          const c = centerCol + dc;
          if (r >= 0 && r < size && c >= 0 && c < size) {
            if ((Math.abs(dr) <= 1 && Math.abs(dc) <= 1) || (Math.abs(dr) + Math.abs(dc) <= 2)) {
              coords.push({ r, c });
            }
          }
        }
      }
    } else {
      // Basic bomb: 3x3 square (radius 1)
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const r = centerRow + dr;
          const c = centerCol + dc;
          if (r >= 0 && r < size && c >= 0 && c < size) {
            coords.push({ r, c });
          }
        }
      }
    }
    return coords;
  }

  /**
   * Power-up: Basic Bomb (3x3) or Mega Bomb (5x5 diamond/core).
   */
  function applyBomb(grid, centerRow, centerCol, bombType) {
    const size = grid.length;
    const coords = getBombAffectedCoords(size, centerRow, centerCol, bombType);
    if (coords.length === 0) return { valid: false };

    const nextGrid = cloneGrid(grid);
    const clearedCells = [];
    let gemsCollected = 0;
    let bombsDefused = 0;

    for (const { r, c } of coords) {
      if (nextGrid[r][c] !== null) {
        const cell = Object.assign({}, nextGrid[r][c]);
        if (cell.gem) gemsCollected++;
        if (typeof cell.bombTimer === 'number') bombsDefused++;
        clearedCells.push({ r, c, cell });
        nextGrid[r][c] = null;
      }
    }

    if (clearedCells.length === 0) {
      return { valid: false, reason: 'Tap near blocks so the bomb can blast them!' };
    }

    return {
      valid: true,
      grid: nextGrid,
      affectedArea: coords,
      clearedCells,
      pointsEarned: clearedCells.length * 25,
      gemsCollected,
      bombsDefused
    };
  }

  global.BBU_BOARD = {
    createEmptyGrid,
    cloneGrid,
    canPlacePieceAt,
    getPredictiveClears,
    placePieceAndResolve,
    hasAnyValidMove,
    getRocketPath,
    applyRocketPath,
    applyHammer,
    getBombAffectedCoords,
    applyBomb
  };
})(typeof window !== 'undefined' ? window : globalThis);
