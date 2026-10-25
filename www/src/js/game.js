/**
 * Block Blast Ultimate — Game Controller & Mode Rules Engine
 * Coordinates Classic, Adventure Levels, Timed Blitz, and Bomb Defuse modes,
 * including undo history stack, power-up targeting, combo tracking, and continues.
 */
(function (global) {
  'use strict';

  const CFG = global.BBU_CONFIG;
  const STORAGE = global.BBU_STORAGE;
  const PIECES = global.BBU_PIECES;
  const BOARD = global.BBU_BOARD;
  const LEVELS = global.BBU_LEVELS;
  const TASKS = global.BBU_TASKS;
  const AUDIO = global.BBU_AUDIO;

  const GameController = {
    run: null,
    timerInterval: null,
    selectedTrayIndex: null,
    activePowerupMode: null, // null | { type: 'rocket'|'hammer'|'bomb_basic'|'bomb_mega', rocketAxis: 'row'|'col' }

    startNewGame(modeId, options = {}) {
      this.stopTimer();
      this.selectedTrayIndex = null;
      this.activePowerupMode = null;

      const modeCfg = CFG.MODES[modeId] || CFG.MODES.classic;
      let boardSize = modeCfg.boardSize || 8;
      let levelConfig = null;
      let moveLimit = null;
      let timeRemaining = null;

      if (modeId === 'levels') {
        const lvlNum = Number(options.levelNumber) || STORAGE.state.levels.unlockedLevel || 1;
        levelConfig = LEVELS.generateLevelConfig(lvlNum);
        boardSize = levelConfig.boardSize;
        moveLimit = levelConfig.moveLimit;
      } else if (modeId === 'timed') {
        timeRemaining = modeCfg.timeLimitSeconds || 90;
      }

      const grid = BOARD.createEmptyGrid(boardSize);

      if (levelConfig && Array.isArray(levelConfig.initialCells)) {
        for (const cell of levelConfig.initialCells) {
          if (cell.r >= 0 && cell.r < boardSize && cell.c >= 0 && cell.c < boardSize) {
            grid[cell.r][cell.c] = {
              colorIdx: cell.colorIdx,
              gem: Boolean(cell.gem),
              bombTimer: null
            };
          }
        }
      }

      const tray = PIECES.generateTray(grid, levelConfig ? levelConfig.difficultyFactor : 0.25);
      // If Level requires gems and board has fewer gems than target, attach gems to tray pieces occasionally
      this.decorateTrayForLevel(tray, levelConfig, grid);

      this.run = {
        modeId,
        boardSize,
        grid,
        tray,
        score: 0,
        linesCleared: 0,
        combosTriggered: 0,
        comboStreak: 0,
        movesMade: 0,
        movesRemaining: moveLimit,
        timeRemaining,
        gemsCollected: 0,
        bombsDefused: 0,
        continuesUsed: 0,
        levelConfig,
        status: 'playing', // 'playing' | 'paused' | 'won' | 'gameover'
        gameOverReason: null,
        undoStack: []
      };

      STORAGE.state.stats.gamesPlayed = (STORAGE.state.stats.gamesPlayed || 0) + 1;
      this.persistActiveRun();

      if (modeId === 'timed') {
        this.startTimer();
      }

      return this.run;
    },

    decorateTrayForLevel(tray, levelConfig, grid) {
      if (!levelConfig || !Array.isArray(levelConfig.objectives)) return;
      const gemObj = levelConfig.objectives.find(o => o.kind === 'gems');
      if (!gemObj) return;
      for (const p of tray) {
        if (p && !p.placed && Math.random() < 0.45) {
          p.hasGem = true;
        }
      }
    },

    resumeSavedRun() {
      const saved = STORAGE.state.activeRun;
      if (!saved || saved.status !== 'playing' || !Array.isArray(saved.grid)) {
        return null;
      }
      this.run = JSON.parse(JSON.stringify(saved));
      this.selectedTrayIndex = null;
      this.activePowerupMode = null;
      if (this.run.modeId === 'timed') {
        this.startTimer();
      }
      return this.run;
    },

    persistActiveRun() {
      if (this.run && this.run.status === 'playing') {
        STORAGE.state.activeRun = JSON.parse(JSON.stringify(this.run));
      } else {
        STORAGE.state.activeRun = null;
      }
      STORAGE.save();
    },

    startTimer() {
      this.stopTimer();
      this.timerInterval = setInterval(() => {
        if (!this.run || this.run.status !== 'playing' || this.run.modeId !== 'timed') return;
        this.run.timeRemaining = Math.max(0, (this.run.timeRemaining || 0) - 1);
        if (global.BBU_UI && typeof global.BBU_UI.updateHud === 'function') {
          global.BBU_UI.updateHud();
        }
        if (this.run.timeRemaining <= 0) {
          this.triggerGameOver('Time Up! Your 90-second blitz timer expired.');
        }
      }, 1000);
    },

    stopTimer() {
      if (this.timerInterval) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
      }
    },

    pushUndoSnapshot() {
      if (!this.run) return;
      const snapshot = {
        grid: BOARD.cloneGrid(this.run.grid),
        tray: JSON.parse(JSON.stringify(this.run.tray)),
        score: this.run.score,
        linesCleared: this.run.linesCleared,
        combosTriggered: this.run.combosTriggered,
        comboStreak: this.run.comboStreak,
        movesMade: this.run.movesMade,
        movesRemaining: this.run.movesRemaining,
        gemsCollected: this.run.gemsCollected,
        bombsDefused: this.run.bombsDefused
      };
      this.run.undoStack.push(snapshot);
      if (this.run.undoStack.length > 5) {
        this.run.undoStack.shift();
      }
    },

    attemptPlaceTrayPiece(trayIndex, targetRow, targetCol) {
      if (!this.run || this.run.status !== 'playing') {
        return { valid: false, reason: 'Game is not active' };
      }
      const piece = this.run.tray[trayIndex];
      if (!piece || piece.placed) {
        return { valid: false, reason: 'Piece unavailable' };
      }

      if (!BOARD.canPlacePieceAt(this.run.grid, piece, targetRow, targetCol)) {
        AUDIO.haptic('error');
        return { valid: false, reason: 'Invalid placement' };
      }

      // Save undo snapshot before mutating state
      this.pushUndoSnapshot();

      const res = BOARD.placePieceAndResolve(
        this.run.grid,
        piece,
        targetRow,
        targetCol,
        this.run.comboStreak
      );

      if (!res.valid) return { valid: false };

      piece.placed = true;
      this.selectedTrayIndex = null;
      this.run.grid = res.grid;
      this.run.score += res.pointsEarned;
      this.run.linesCleared += res.totalLinesCleared;
      this.run.comboStreak = res.comboStreak;
      this.run.movesMade += 1;
      this.run.gemsCollected += res.gemsCollected;
      this.run.bombsDefused += res.bombsDefused;

      if (res.totalLinesCleared > 0 && res.comboStreak >= 2) {
        this.run.combosTriggered += 1;
      }

      if (typeof this.run.movesRemaining === 'number') {
        this.run.movesRemaining = Math.max(0, this.run.movesRemaining - 1);
      }

      // Timed Blitz bonus time for clearing lines
      if (this.run.modeId === 'timed' && res.totalLinesCleared > 0) {
        const bonusSec = res.totalLinesCleared * (CFG.MODES.timed.lineClearTimeBonus || 4);
        this.run.timeRemaining += bonusSec;
      }

      // Update global lifetime statistics & task metrics
      STORAGE.state.lifetimeScore += res.pointsEarned;
      STORAGE.state.stats.totalBlocksPlaced += 1;
      STORAGE.state.stats.totalLinesCleared += res.totalLinesCleared;
      if (res.comboStreak > (STORAGE.state.stats.maxComboReached || 0)) {
        STORAGE.state.stats.maxComboReached = res.comboStreak;
      }
      if (this.run.score > (STORAGE.state.bestScores[this.run.modeId] || 0)) {
        STORAGE.state.bestScores[this.run.modeId] = this.run.score;
      }
      if (this.run.modeId === 'classic' && this.run.score > (STORAGE.state.stats.bestScoreClassic || 0)) {
        STORAGE.state.stats.bestScoreClassic = this.run.score;
      }

      // Award gameplay milestone coins on line clears & combos
      let bonusCoins = 0;
      if (res.totalLinesCleared > 0) {
        bonusCoins += res.totalLinesCleared * CFG.ECONOMY.LINE_CLEAR_COIN_BONUS;
        if (res.comboStreak >= 2) {
          bonusCoins += (res.comboStreak - 1) * CFG.ECONOMY.COMBO_COIN_BONUS;
        }
        STORAGE.addCoins(bonusCoins);
      }

      TASKS.recordEvent('blocksPlaced', 1);
      TASKS.recordEvent('scoreEarned', res.pointsEarned);
      if (res.totalLinesCleared > 0) {
        TASKS.recordEvent('linesCleared', res.totalLinesCleared);
      }
      if (res.totalLinesCleared > 0 && res.comboStreak >= 2) {
        TASKS.recordEvent('combosTriggered', 1);
      }

      // Audio & Haptic feedback
      if (res.totalLinesCleared > 0) {
        if (res.comboStreak >= 2 || res.totalLinesCleared >= 2) {
          AUDIO.play('combo');
          AUDIO.haptic('combo');
        } else {
          AUDIO.play('clear');
          AUDIO.haptic('clear');
        }
      } else {
        AUDIO.play('place');
        AUDIO.haptic('place');
      }

      // Bomb Defuse Mode: decrement bomb timers and spawn new bombs every N moves
      let bombExploded = false;
      if (this.run.modeId === 'bomb') {
        bombExploded = this.stepBombMode();
      }

      // Refill tray if all 3 pieces are placed
      const allPlaced = this.run.tray.every(p => p.placed);
      if (allPlaced) {
        const diff = Math.min(0.85, 0.25 + (this.run.movesMade / 80));
        this.run.tray = PIECES.generateTray(this.run.grid, diff);
        this.decorateTrayForLevel(this.run.tray, this.run.levelConfig, this.run.grid);
      }

      // Check Level Win / Fail or Mode Game Over
      if (bombExploded) {
        this.triggerGameOver('A ticking bomb reached 0 before its line was cleared!');
      } else if (this.run.modeId === 'levels') {
        this.evaluateLevelState();
      } else if (!BOARD.hasAnyValidMove(this.run.grid, this.run.tray)) {
        this.triggerGameOver('No space left on the board for the remaining pieces.');
      } else {
        this.persistActiveRun();
      }

      return Object.assign({}, res, { bonusCoins, runStatus: this.run.status });
    },

    stepBombMode() {
      const g = this.run.grid;
      const size = g.length;
      let exploded = false;

      // Decrement existing bombs
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (g[r][c] && typeof g[r][c].bombTimer === 'number') {
            g[r][c].bombTimer -= 1;
            if (g[r][c].bombTimer <= 0) {
              exploded = true;
            }
          }
        }
      }

      if (exploded) return true;

      // Spawn a new ticking bomb on a random occupied cell every N moves
      const interval = CFG.MODES.bomb.bombSpawnIntervalMoves || 5;
      if (this.run.movesMade % interval === 0) {
        const candidates = [];
        for (let r = 0; r < size; r++) {
          for (let c = 0; c < size; c++) {
            if (g[r][c] && g[r][c].bombTimer === null) {
              candidates.push({ r, c });
            }
          }
        }
        if (candidates.length > 0) {
          const pick = candidates[Math.floor(Math.random() * candidates.length)];
          g[pick.r][pick.c].bombTimer = CFG.MODES.bomb.bombCountdownTurns || 9;
        }
      }
      return false;
    },

    evaluateLevelState() {
      const cfg = this.run.levelConfig;
      if (!cfg) return;

      const allMet = cfg.objectives.every(obj => {
        if (obj.kind === 'score') return this.run.score >= obj.target;
        if (obj.kind === 'lines') return this.run.linesCleared >= obj.target;
        if (obj.kind === 'gems') return this.run.gemsCollected >= obj.target;
        if (obj.kind === 'combos') return this.run.combosTriggered >= obj.target;
        return false;
      });

      if (allMet) {
        this.run.status = 'won';
        this.stopTimer();
        const stars = LEVELS.calculateStars(cfg, this.run.movesRemaining || 0, this.run.score);
        this.run.starsEarned = stars;

        const lvlKey = String(cfg.levelNumber);
        const prevStars = STORAGE.state.levels.starsByLevel[lvlKey] || 0;
        if (stars > prevStars) {
          STORAGE.state.levels.starsByLevel[lvlKey] = stars;
        }
        if (cfg.levelNumber >= STORAGE.state.levels.unlockedLevel) {
          STORAGE.state.levels.unlockedLevel = cfg.levelNumber + 1;
        }
        STORAGE.state.stats.levelsCompleted = (STORAGE.state.stats.levelsCompleted || 0) + 1;

        const rewardCoins = CFG.ECONOMY.LEVEL_WIN_BASE_COINS + stars * CFG.ECONOMY.STAR_BONUS_COINS;
        this.run.levelRewardCoins = rewardCoins;
        STORAGE.addCoins(rewardCoins);
        TASKS.recordEvent('levelsWon', 1);
        this.persistActiveRun();

        AUDIO.play('win');
        if (global.BBU_UI && typeof global.BBU_UI.showLevelCompleteModal === 'function') {
          global.BBU_UI.showLevelCompleteModal(this.run);
        }
        return;
      }

      if (this.run.movesRemaining <= 0) {
        this.triggerGameOver('Out of Moves! Complete all level objectives before moves run out.');
        return;
      }

      if (!BOARD.hasAnyValidMove(this.run.grid, this.run.tray)) {
        this.triggerGameOver('No valid moves left on the board! Try again.');
        return;
      }

      this.persistActiveRun();
    },

    triggerGameOver(reason) {
      if (!this.run) return;
      this.stopTimer();
      this.run.status = 'gameover';
      this.run.gameOverReason = reason || 'No valid moves remaining.';
      this.persistActiveRun();
      AUDIO.play('fail');
      AUDIO.haptic('error');
      if (global.BBU_UI && typeof global.BBU_UI.showGameOverModal === 'function') {
        global.BBU_UI.showGameOverModal(this.run);
      }
    },

    /**
     * Continues a Classic Mode run after Game Over (using Coins or Rewarded Ad).
     * Clears the central 4x4 region of the board and generates a fresh fitting tray.
     * Note: Failed Adventure Levels NEVER allow continues (retry only, per Master Prompt Section 6).
     */
    continueClassicRun() {
      if (!this.run || this.run.modeId !== 'classic') {
        return { success: false, reason: 'Continues are only available in Classic Mode.' };
      }
      if (this.run.continuesUsed >= CFG.ECONOMY.CLASSIC_CONTINUE_MAX) {
        return { success: false, reason: 'Maximum continues reached for this run.' };
      }

      const size = this.run.boardSize;
      const start = Math.floor((size - 4) / 2);
      for (let r = start; r < start + 4; r++) {
        for (let c = start; c < start + 4; c++) {
          if (r >= 0 && r < size && c >= 0 && c < size) {
            this.run.grid[r][c] = null;
          }
        }
      }

      this.run.continuesUsed += 1;
      this.run.status = 'playing';
      this.run.gameOverReason = null;
      this.run.tray = PIECES.generateTray(this.run.grid, 0.2);
      this.persistActiveRun();
      AUDIO.play('reward');
      return { success: true };
    },

    /**
     * Executes Undo power-up: restores previous valid board state, tray, and score,
     * consuming 1 Undo attempt only after successful restoration.
     */
    useUndoPowerup() {
      if (!this.run || this.run.status !== 'playing') {
        return { success: false, reason: 'Game is not active' };
      }
      if (!this.run.undoStack || this.run.undoStack.length === 0) {
        return { success: false, reason: 'Nothing to undo yet! Place a block first.' };
      }
      if ((STORAGE.state.inventory.undo || 0) <= 0) {
        return { success: false, noInventory: true, powerupId: 'undo' };
      }

      const prev = this.run.undoStack.pop();
      this.run.grid = prev.grid;
      this.run.tray = prev.tray;
      this.run.score = prev.score;
      this.run.linesCleared = prev.linesCleared;
      this.run.combosTriggered = prev.combosTriggered;
      this.run.comboStreak = prev.comboStreak;
      this.run.movesMade = prev.movesMade;
      this.run.movesRemaining = prev.movesRemaining;
      this.run.gemsCollected = prev.gemsCollected;
      this.run.bombsDefused = prev.bombsDefused;

      STORAGE.state.inventory.undo -= 1;
      STORAGE.state.stats.powerupsUsed = (STORAGE.state.stats.powerupsUsed || 0) + 1;
      TASKS.recordEvent('powerupsUsed', 1);
      this.persistActiveRun();
      AUDIO.play('menu');
      AUDIO.haptic('tap');
      return { success: true };
    },

    /**
     * Executes targeted board power-up (Rocket, Hammer, Basic Bomb, Mega Bomb).
     * Consumes inventory ONLY if the action is valid and affects the board.
     */
    executeBoardPowerup(powerupId, targetRow, targetCol, rocketAxis = 'row') {
      if (!this.run || this.run.status !== 'playing') {
        return { success: false, reason: 'Game is not active' };
      }
      const count = STORAGE.state.inventory[powerupId] || 0;
      if (count <= 0) {
        return { success: false, noInventory: true, powerupId };
      }

      let result = null;
      if (powerupId === 'rocket') {
        const index = rocketAxis === 'col' ? targetCol : targetRow;
        result = BOARD.applyRocket(this.run.grid, rocketAxis, index);
        if (result.valid && result.clearedCells.length === 0) {
          return { success: false, reason: 'Selected line is already empty! Choose a row or column with blocks.' };
        }
      } else if (powerupId === 'hammer') {
        result = BOARD.applyHammer(this.run.grid, targetRow, targetCol);
      } else if (powerupId === 'bomb_basic' || powerupId === 'bomb_mega') {
        result = BOARD.applyBomb(this.run.grid, targetRow, targetCol, powerupId);
      } else {
        return { success: false, reason: 'Unknown power-up' };
      }

      if (!result || !result.valid) {
        AUDIO.haptic('error');
        return { success: false, reason: (result && result.reason) || 'Invalid target cell' };
      }

      this.pushUndoSnapshot();
      this.run.grid = result.grid;
      this.run.score += result.pointsEarned;
      this.run.gemsCollected += (result.gemsCollected || 0);
      this.run.bombsDefused += (result.bombsDefused || 0);

      // Consume 1 attempt ONLY after valid execution
      STORAGE.state.inventory[powerupId] -= 1;
      STORAGE.state.stats.powerupsUsed = (STORAGE.state.stats.powerupsUsed || 0) + 1;
      TASKS.recordEvent('powerupsUsed', 1);
      TASKS.recordEvent('scoreEarned', result.pointsEarned);

      this.activePowerupMode = null;

      if (powerupId === 'rocket') AUDIO.play('rocket');
      else if (powerupId === 'hammer') AUDIO.play('hammer');
      else AUDIO.play('bomb');
      AUDIO.haptic('explosion');

      if (this.run.modeId === 'levels') {
        this.evaluateLevelState();
      } else {
        this.persistActiveRun();
      }

      return {
        success: true,
        powerupId,
        rocketAxis,
        targetRow,
        targetCol,
        clearedCells: result.clearedCells,
        pointsEarned: result.pointsEarned
      };
    }
  };

  global.BBU_GAME = GameController;
})(typeof window !== 'undefined' ? window : globalThis);
