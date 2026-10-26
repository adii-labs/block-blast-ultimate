/**
 * Block Blast Ultimate — Piece Shapes & Fairness-Aware Tray Generator
 * Supports single cells, horizontal/vertical lines, squares, L/J, T, Z/S, corners, and diagonals.
 * Guarantees at least one generated piece in every 3-piece tray fits on the current board if any valid move exists.
 */
(function (global) {
  'use strict';

  const SHAPE_CATALOG = [
    // Tier 1: Small & versatile shapes
    { id: 'dot_1', tier: 1, colorIdx: 0, matrix: [[1]] },
    { id: 'h_2', tier: 1, colorIdx: 1, matrix: [[1, 1]] },
    { id: 'v_2', tier: 1, colorIdx: 1, matrix: [[1], [1]] },
    { id: 'h_3', tier: 1, colorIdx: 2, matrix: [[1, 1, 1]] },
    { id: 'v_3', tier: 1, colorIdx: 2, matrix: [[1], [1], [1]] },
    { id: 'sq_2x2', tier: 1, colorIdx: 3, matrix: [[1, 1], [1, 1]] },
    { id: 'corner_tl', tier: 1, colorIdx: 4, matrix: [[1, 1], [1, 0]] },
    { id: 'corner_tr', tier: 1, colorIdx: 4, matrix: [[1, 1], [0, 1]] },
    { id: 'corner_bl', tier: 1, colorIdx: 4, matrix: [[1, 0], [1, 1]] },
    { id: 'corner_br', tier: 1, colorIdx: 4, matrix: [[0, 1], [1, 1]] },

    // Tier 2: Standard Tetrominoes (L, J, T, S, Z, 4-lines)
    { id: 'h_4', tier: 2, colorIdx: 5, matrix: [[1, 1, 1, 1]] },
    { id: 'v_4', tier: 2, colorIdx: 5, matrix: [[1], [1], [1], [1]] },
    { id: 't_up', tier: 2, colorIdx: 6, matrix: [[0, 1, 0], [1, 1, 1]] },
    { id: 't_down', tier: 2, colorIdx: 6, matrix: [[1, 1, 1], [0, 1, 0]] },
    { id: 't_left', tier: 2, colorIdx: 6, matrix: [[0, 1], [1, 1], [0, 1]] },
    { id: 't_right', tier: 2, colorIdx: 6, matrix: [[1, 0], [1, 1], [1, 0]] },
    { id: 'l_1', tier: 2, colorIdx: 1, matrix: [[1, 0], [1, 0], [1, 1]] },
    { id: 'l_2', tier: 2, colorIdx: 1, matrix: [[1, 1, 1], [1, 0, 0]] },
    { id: 'j_1', tier: 2, colorIdx: 5, matrix: [[0, 1], [0, 1], [1, 1]] },
    { id: 'j_2', tier: 2, colorIdx: 5, matrix: [[1, 0, 0], [1, 1, 1]] },
    { id: 's_1', tier: 2, colorIdx: 3, matrix: [[0, 1, 1], [1, 1, 0]] },
    { id: 's_2', tier: 2, colorIdx: 3, matrix: [[1, 0], [1, 1], [0, 1]] },
    { id: 'z_1', tier: 2, colorIdx: 0, matrix: [[1, 1, 0], [0, 1, 1]] },
    { id: 'z_2', tier: 2, colorIdx: 0, matrix: [[0, 1], [1, 1], [1, 0]] },

    // Tier 3: Large tactical shapes (5-lines, 3x3 square, Big L corners)
    { id: 'h_5', tier: 3, colorIdx: 7, matrix: [[1, 1, 1, 1, 1]] },
    { id: 'v_5', tier: 3, colorIdx: 7, matrix: [[1], [1], [1], [1], [1]] },
    { id: 'sq_3x3', tier: 3, colorIdx: 2, matrix: [[1, 1, 1], [1, 1, 1], [1, 1, 1]] },
    { id: 'big_l_tl', tier: 3, colorIdx: 4, matrix: [[1, 1, 1], [1, 0, 0], [1, 0, 0]] },
    { id: 'big_l_tr', tier: 3, colorIdx: 4, matrix: [[1, 1, 1], [0, 0, 1], [0, 0, 1]] },
    { id: 'big_l_bl', tier: 3, colorIdx: 4, matrix: [[1, 0, 0], [1, 0, 0], [1, 1, 1]] },
    { id: 'big_l_br', tier: 3, colorIdx: 4, matrix: [[0, 0, 1], [0, 0, 1], [1, 1, 1]] },
    { id: 'diag_2', tier: 2, colorIdx: 7, matrix: [[1, 0], [0, 1]] },
    { id: 'diag_2_rev', tier: 2, colorIdx: 7, matrix: [[0, 1], [1, 0]] }
  ];

  function countCells(matrix) {
    let count = 0;
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (matrix[r][c]) count++;
      }
    }
    return count;
  }

  for (const s of SHAPE_CATALOG) {
    s.rows = s.matrix.length;
    s.cols = s.matrix[0].length;
    s.cellCount = countCells(s.matrix);
  }

  function clonePiece(template, customId) {
    return {
      uid: customId || ('p_' + Math.random().toString(36).slice(2, 9)),
      id: template.id,
      tier: template.tier,
      colorIdx: template.colorIdx,
      rows: template.rows,
      cols: template.cols,
      cellCount: template.cellCount,
      matrix: template.matrix.map(r => r.slice()),
      placed: false
    };
  }

  function rotatePieceClockwise(piece) {
    if (!piece || piece.placed || !Array.isArray(piece.matrix) || !piece.matrix.length) return false;

    const rows = piece.matrix.length;
    const cols = piece.matrix[0].length;
    const rotated = Array.from({ length: cols }, (_, row) =>
      Array.from({ length: rows }, (_, col) => piece.matrix[rows - 1 - col][row])
    );

    piece.matrix = rotated;
    piece.rows = cols;
    piece.cols = rows;
    return true;
  }

  function canPieceFitBoard(grid, piece) {
    if (!grid || !piece || piece.placed) return false;
    const size = grid.length;
    for (let r = 0; r <= size - piece.rows; r++) {
      for (let c = 0; c <= size - piece.cols; c++) {
        let fits = true;
        for (let pr = 0; pr < piece.rows && fits; pr++) {
          for (let pc = 0; pc < piece.cols; pc++) {
            if (piece.matrix[pr][pc] && grid[r + pr][c + pc] !== null) {
              fits = false;
              break;
            }
          }
        }
        if (fits) return true;
      }
    }
    return false;
  }

  /**
   * Generates a balanced tray of 3 pieces.
   * Ensures fairness: if the board has space, at least one generated piece in the tray
   * is guaranteed to fit on the current board (avoiding impossible RNG soft-locks).
   */
  function generateTray(grid, difficultyFactor = 0.3, rngFn = Math.random) {
    const f = Math.max(0, Math.min(1, difficultyFactor));
    const weightedPool = [];

    for (const shape of SHAPE_CATALOG) {
      let weight = 10;
      if (shape.tier === 1) weight = Math.round(16 - f * 5);
      else if (shape.tier === 2) weight = 12;
      else if (shape.tier === 3) weight = Math.round(4 + f * 6);
      for (let i = 0; i < weight; i++) {
        weightedPool.push(shape);
      }
    }

    const pickRandom = (pool) => pool[Math.floor(rngFn() * pool.length)];
    const tray = [
      clonePiece(pickRandom(weightedPool)),
      clonePiece(pickRandom(weightedPool)),
      clonePiece(pickRandom(weightedPool))
    ];

    if (grid && Array.isArray(grid)) {
      const anyFits = tray.some(p => canPieceFitBoard(grid, p));
      if (!anyFits) {
        const fittingShapes = SHAPE_CATALOG.filter(s => canPieceFitBoard(grid, s));
        if (fittingShapes.length > 0) {
          const rescued = fittingShapes[Math.floor(rngFn() * fittingShapes.length)];
          tray[0] = clonePiece(rescued);
        }
      }
    }

    return tray;
  }

  global.BBU_PIECES = {
    CATALOG: SHAPE_CATALOG,
    clonePiece,
    rotatePieceClockwise,
    canPieceFitBoard,
    generateTray
  };
})(typeof window !== 'undefined' ? window : globalThis);
