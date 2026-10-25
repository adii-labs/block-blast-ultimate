/**
 * Block Blast Ultimate — Unlimited Procedural Level & Template Architecture
 * Uses deterministic seeded templates so Level 1 to Level ∞ can be played sequentially,
 * with mixed objectives (Score, Line Clears, Gems/Crates, Combo Targets), move limits,
 * pre-placed obstacle patterns, and 1-3 star performance thresholds.
 */
(function (global) {
  'use strict';

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      let t = (a += 0x6D2B79F5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const LEVEL_ARCHETYPES = [
    {
      type: 'score_rush',
      titlePrefix: 'Starlight Score',
      buildObjectives(lvl, rng) {
        const targetScore = 400 + lvl * 180;
        return [{ kind: 'score', target: targetScore, label: `Reach ${targetScore.toLocaleString()} Points` }];
      }
    },
    {
      type: 'line_sweep',
      titlePrefix: 'Line Breaker',
      buildObjectives(lvl, rng) {
        const lines = Math.min(18, 3 + Math.floor(lvl * 0.75));
        return [{ kind: 'lines', target: lines, label: `Clear ${lines} Rows or Columns` }];
      }
    },
    {
      type: 'gem_harvest',
      titlePrefix: 'Crystal Harvest',
      buildObjectives(lvl, rng) {
        const gems = Math.min(14, 3 + Math.floor(lvl * 0.6));
        return [
          { kind: 'gems', target: gems, label: `Collect ${gems} Embedded Star Gems` },
          { kind: 'score', target: 300 + lvl * 120, label: `Score ${300 + lvl * 120} Points` }
        ];
      }
    },
    {
      type: 'hybrid_master',
      titlePrefix: 'Grand Tactical',
      buildObjectives(lvl, rng) {
        const lines = Math.min(15, 3 + Math.floor(lvl * 0.55));
        const combos = Math.min(5, 1 + Math.floor(lvl / 4));
        return [
          { kind: 'lines', target: lines, label: `Clear ${lines} Lines` },
          { kind: 'combos', target: combos, label: `Trigger ${combos} Combo Streak(s)` }
        ];
      }
    }
  ];

  function generateLevelConfig(levelNumber) {
    const lvl = Math.max(1, Math.floor(Number(levelNumber) || 1));
    const rng = mulberry32(lvl * 98765 + 1337);
    const archetype = LEVEL_ARCHETYPES[(lvl - 1) % LEVEL_ARCHETYPES.length];
    const boardSize = (lvl % 5 === 0) ? 9 : 8;
    const moveLimit = Math.max(14, 24 - Math.floor(lvl / 12) + (boardSize === 9 ? 4 : 0));
    const objectives = archetype.buildObjectives(lvl, rng);

    // Pre-populate board pattern symmetrically for visual polish & gem embedding
    const initialCells = [];
    const numPairs = Math.min(10, 2 + Math.floor(lvl / 2));
    const needGems = objectives.find(o => o.kind === 'gems');
    let gemsToPlace = needGems ? needGems.target : 0;

    const used = new Set();
    for (let i = 0; i < numPairs; i++) {
      const r = Math.floor(rng() * boardSize);
      const c = Math.floor(rng() * Math.ceil(boardSize / 2));
      const mirrorC = boardSize - 1 - c;
      const colorIdx = Math.floor(rng() * 8);

      for (const col of [c, mirrorC]) {
        const key = `${r},${col}`;
        if (!used.has(key)) {
          used.add(key);
          const hasGem = gemsToPlace > 0;
          if (hasGem) gemsToPlace--;
          initialCells.push({ r, c: col, colorIdx, gem: hasGem });
        }
      }
    }

    // Ensure if gems are still needed, mark existing cells or add remaining
    while (gemsToPlace > 0) {
      for (let r = 0; r < boardSize && gemsToPlace > 0; r++) {
        for (let c = 0; c < boardSize && gemsToPlace > 0; c++) {
          const key = `${r},${c}`;
          if (!used.has(key)) {
            used.add(key);
            initialCells.push({ r, c, colorIdx: (r + c) % 8, gem: true });
            gemsToPlace--;
          }
        }
      }
    }

    return {
      levelNumber: lvl,
      name: `Level ${lvl}: ${archetype.titlePrefix}`,
      boardSize,
      moveLimit,
      objectives,
      initialCells,
      difficultyFactor: Math.min(0.85, 0.15 + lvl * 0.025),
      starThresholds: {
        oneStarMovesRemaining: 0,
        twoStarMovesRemaining: Math.max(2, Math.floor(moveLimit * 0.2)),
        threeStarMovesRemaining: Math.max(5, Math.floor(moveLimit * 0.4))
      }
    };
  }

  function calculateStars(levelConfig, movesRemaining, score) {
    if (movesRemaining >= levelConfig.starThresholds.threeStarMovesRemaining) return 3;
    if (movesRemaining >= levelConfig.starThresholds.twoStarMovesRemaining) return 2;
    return 1;
  }

  global.BBU_LEVELS = {
    generateLevelConfig,
    calculateStars
  };
})(typeof window !== 'undefined' ? window : globalThis);
