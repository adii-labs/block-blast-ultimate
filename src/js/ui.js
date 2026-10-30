/**
 * Block Blast Ultimate — Child-Friendly 3D Toy & Jewel UI, Canvas Renderer, Drag-and-Drop & Modals
 * Implements:
 *   - Deep 3D extruded toy-jewel blocks (`drawBeveledBlock`) with 3D bottom ledge, 4-bevel jewel facets, and glossy specular cap on rounded 3D recessed grid cells
 *   - 3-piece dock tray at `0.58x` scale (dimmed to `0.35` alpha when unplaceable)
 *   - Smooth touch-and-drag at `0.92x` scale with `-1.15 * cellSize` vertical finger-lift offset
 *   - Translucent ghost preview (`0.48` alpha) + Golden Predictive Line-Clear Glow (`#fde047`)
 *   - 12 radial gravity particles per cleared cell, expanding golden shockwaves, damped screen bounce, and floating praise text
 *   - Icon-first child-friendly UI with 3D `close.png` (X), `home.png`, `star_filled.png`, `star_empty.png`, `play.png`, `restart.png`, and `gem.png`
 *   - Automatic return to Home Screen when closing a Game Over or Level Complete modal via X button
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
  const ADS = global.BBU_ADS;
  const GAME = global.BBU_GAME;

  function roundRect(ctx, x, y, w, h, r) {
    const rad = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.lineTo(x + w - rad, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
    ctx.lineTo(x + w, y + h - rad);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
    ctx.lineTo(x + rad, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
    ctx.lineTo(x, y + rad);
    ctx.quadraticCurveTo(x, y, x + rad, y);
    ctx.closePath();
  }

  const UIManager = {
    canvas: null,
    ctx: null,
    ghostCanvas: null,
    ghostCtx: null,
    cellPx: 40,
    boardPixelSize: 320,
    hoverCell: null, // { r, c }
    dragState: null, // { trayIndex, piece, startX, startY, moved }
    particles: [],
    shockwaves: [],
    floatingTexts: [],
    screenShake: 0,
    rocketAnim: null,
    rocketLaunch: null,
    rocketDebris: [],
    rocketSprite: null,
    animFrameId: null,
    spinnerSpinning: false,
    spinnerAngle: 0,

    init() {
      this.canvas = document.getElementById('board-canvas');
      this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
      this.ghostCanvas = document.getElementById('drag-ghost-canvas');
      this.ghostCtx = this.ghostCanvas ? this.ghostCanvas.getContext('2d') : null;
      this.rocketSprite = new Image();
      this.rocketSprite.src = 'assets/images/rocket.png';

      this.applySettingsAndTheme();
      this.bindEvents();
      this.resizeBoardCanvas();
      window.addEventListener('resize', () => this.resizeBoardCanvas());

      this.updateTopBar();
      this.updateHomeBadges();
      this.startRenderLoop();
    },

    applySettingsAndTheme() {
      const s = STORAGE.state.settings;
      const eqThemeId = STORAGE.state.shop.equippedTheme || 'theme_midnight';
      const themeObj = CFG.SHOP_ITEMS.themes.find(t => t.id === eqThemeId) || CFG.SHOP_ITEMS.themes[0];

      const root = document.documentElement;
      root.style.setProperty('--bg-top', themeObj.bgTop || '#1e1b4b');
      root.style.setProperty('--bg-primary', themeObj.bgPrimary);
      root.style.setProperty('--bg-secondary', themeObj.bgSecondary);
      const themeBackgroundImage = themeObj.backgroundImage
        ? `url("${new URL(themeObj.backgroundImage, document.baseURI).href}")`
        : 'none';
      root.style.setProperty('--theme-bg-image', themeBackgroundImage);
      root.style.setProperty('--home-classic-gradient', themeObj.homeClassicGradient || 'linear-gradient(180deg, #4ade80 0%, #22c55e 52%, #15803d 100%)');
      root.style.setProperty('--home-classic-shadow', themeObj.homeClassicShadow || '#14532d');
      root.style.setProperty('--home-levels-gradient', themeObj.homeLevelsGradient || 'linear-gradient(180deg, #fb923c 0%, #f97316 52%, #c2410c 100%)');
      root.style.setProperty('--home-levels-shadow', themeObj.homeLevelsShadow || '#7c2d12');
      root.style.setProperty('--board-bg', themeObj.boardBg || '#090d1f');
      root.style.setProperty('--cell-a', themeObj.cellA || '#131c38');
      root.style.setProperty('--cell-b', themeObj.cellB || '#162040');
      root.style.setProperty('--board-frame-gradient', themeObj.boardFrameGradient || 'linear-gradient(180deg, #3b82f6 0%, #1d4ed8 55%, #1e3a8a 100%)');
      root.style.setProperty('--board-frame-border', themeObj.boardFrameBorder || '#93c5fd');
      root.style.setProperty('--board-frame-shadow', themeObj.boardFrameShadow || '#090d1f');
      root.style.setProperty('--accent', themeObj.accent);

      document.body.classList.toggle('theme-light', Boolean(themeObj.isLight));
      document.body.classList.toggle('text-scale-large', s.textScale === 'large');

      const soundImg = document.getElementById('top-sound-img');
      if (soundImg) {
        soundImg.src = s.soundEnabled ? 'assets/images/sound_on.png' : 'assets/images/sound_off.png';
      }
    },

    showToast(message) {
      const container = document.getElementById('toast-container');
      if (!container) return;
      const el = document.createElement('div');
      el.className = 'toast-msg';
      el.textContent = message;
      container.appendChild(el);
      setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 2300);
    },

    updateTopBar() {
      const coinText = document.getElementById('top-coin-count');
      if (coinText) {
        coinText.textContent = (STORAGE.state.coins || 0).toLocaleString();
      }
    },

    updateHomeBadges() {
      const canDaily = STORAGE.canClaimDailyReward();
      const canSpin = STORAGE.canUseFreeSpin();
      const { dailyList, weeklyList, milestoneList } = TASKS.getActiveTasks();
      const anyTaskClaimable = [...dailyList, ...weeklyList, ...milestoneList].some(t => t.completed && !t.claimed);
      const anyAchClaimable = TASKS.getAchievementsStatus().some(a => a.completed && !a.claimed);

      const dailyDot = document.getElementById('badge-daily');
      if (dailyDot) dailyDot.style.display = canDaily ? 'block' : 'none';

      const spinDot = document.getElementById('badge-spinner');
      if (spinDot) spinDot.style.display = canSpin ? 'block' : 'none';

      const tasksDot = document.getElementById('badge-tasks');
      if (tasksDot) tasksDot.style.display = anyTaskClaimable ? 'block' : 'none';

      const achDot = document.getElementById('badge-achievements');
      if (achDot) achDot.style.display = anyAchClaimable ? 'block' : 'none';

      const moreDot = document.getElementById('badge-more');
      if (moreDot) {
        moreDot.style.display = (anyTaskClaimable || anyAchClaimable) ? 'block' : 'none';
      }

      const bestClassicEl = document.getElementById('home-best-classic');
      if (bestClassicEl) {
        bestClassicEl.textContent = (STORAGE.state.bestScores.classic || 0).toLocaleString();
      }
      const curLevelEl = document.getElementById('home-current-level');
      if (curLevelEl) {
        const totalStars = Object.values(STORAGE.state.levels.starsByLevel || {}).reduce((a, b) => a + Number(b || 0), 0);
        curLevelEl.textContent = `Stage ${STORAGE.state.levels.unlockedLevel || 1} (${totalStars})`;
      }
    },

    async switchScreen(screenId) {
      document.querySelectorAll('.screen').forEach(el => {
        el.classList.toggle('active', el.id === screenId);
      });
      const pauseBtn = document.getElementById('btn-top-pause');
      const homeBtn = document.getElementById('btn-top-home');
      const homeAdBtn = document.getElementById('btn-home-watch-ad');
      if (homeAdBtn) homeAdBtn.style.display = screenId === 'screen-home' ? 'inline-flex' : 'none';
      if (screenId === 'screen-game') {
        if (pauseBtn) pauseBtn.style.display = 'inline-flex';
        if (homeBtn) homeBtn.style.display = 'inline-flex';
        this.resizeBoardCanvas();
        this.renderTray();
        this.updateHud();
        this.updatePowerupBar();
      } else {
        if (pauseBtn) pauseBtn.style.display = 'none';
        if (homeBtn) homeBtn.style.display = 'none';
        this.updateHomeBadges();
        this.updateTopBar();
      }
      if (screenId === 'screen-game') {
        await ADS.hideBanner();
        await ADS.showBanner('TOP');
      } else if (screenId === 'screen-home') {
        await ADS.hideBanner();
        await ADS.showBanner('BOTTOM');
      }
    },

    resizeBoardCanvas() {
      if (!this.canvas) return;
      const stage = document.querySelector('.board-stage');
      const n = (GAME.run && GAME.run.boardSize) || 8;
      const availW = stage ? Math.max(250, stage.clientWidth - 22) : 320;
      const availH = stage ? Math.max(250, stage.clientHeight - 22) : 320;
      const side = Math.min(availW, availH, 396);
      this.cellPx = Math.floor(side / n);
      this.boardPixelSize = this.cellPx * n;
      this.canvas.width = this.boardPixelSize;
      this.canvas.height = this.boardPixelSize;
      if (GAME.run) {
        this.renderTray();
      }
    },

    getPalette() {
      const cb = STORAGE.state.settings.colorblindMode;
      return cb ? CFG.PALETTES.colorblind : CFG.PALETTES.standard;
    },

    /**
     * Deep 3D Extruded Toy-Jewel Block Renderer (`drawBeveledBlock`):
     *   1. 3D Extruded Bottom/Right Base Ledge (`pal.dark`) for tangible 3D block height
     *   2. Main Rounded Squircle Toy Body (`pal.main`, `radius = bs * 0.2`)
     *   3. 4-Sided 3D Jewel Facet Bevels (top/left bright, right/bottom shaded)
     *   4. Raised Inner Pillow Face + Specular Gloss Dome Reflection
     *   5. Optional Golden Predictive Line-Clear Highlight (`shadowColor: '#fde047'`, `#fef08a` border)
     */
    drawBeveledBlock(ctx, x, y, size, colorIdx, alpha = 1.0, highlight = false, extra = {}) {
      const palette = this.getPalette();
      const pal = palette[(colorIdx || 0) % palette.length];
      const skin = STORAGE.state.shop.equippedSkin || 'skin_glossy';
      const pad = 1.4;
      const depth = Math.max(2.5, size * 0.095);
      const bx = x + pad;
      const by = y + pad;
      const bs = size - pad * 2;
      const faceH = bs - depth * 0.65;
      const r = Math.max(4, bs * 0.2);

      ctx.save();
      ctx.globalAlpha = alpha;

      if (highlight) {
        ctx.shadowColor = '#fde047';
        ctx.shadowBlur = 14;
      }

      // 1. 3D Extruded Bottom Shadow Ledge (makes block stand out in 3D!)
      ctx.fillStyle = skin === 'skin_neon' ? pal.dark : '#050814';
      roundRect(ctx, bx + 0.5, by + depth * 0.75, bs, faceH, r);
      ctx.fill();

      ctx.fillStyle = pal.dark;
      roundRect(ctx, bx, by + depth * 0.55, bs, faceH, r);
      ctx.fill();

      // 2. Main Elevated 3D Toy Block Face
      ctx.fillStyle = pal.main || pal.fill;
      roundRect(ctx, bx, by, bs, faceH, r);
      ctx.fill();

      const bev = Math.max(3, bs * 0.16);

      // 3a. Top 3D Bevel Highlight
      ctx.fillStyle = pal.light;
      ctx.beginPath();
      ctx.moveTo(bx + r * 0.6, by);
      ctx.lineTo(bx + bs - r * 0.6, by);
      ctx.lineTo(bx + bs - bev, by + bev);
      ctx.lineTo(bx + bev, by + bev);
      ctx.closePath();
      ctx.fill();

      // 3b. Left 3D Side Highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.beginPath();
      ctx.moveTo(bx, by + r * 0.6);
      ctx.lineTo(bx + bev, by + bev);
      ctx.lineTo(bx + bev, by + faceH - bev);
      ctx.lineTo(bx, by + faceH - r * 0.6);
      ctx.closePath();
      ctx.fill();

      // 3c. Right 3D Side Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
      ctx.beginPath();
      ctx.moveTo(bx + bs, by + r * 0.6);
      ctx.lineTo(bx + bs, by + faceH - r * 0.6);
      ctx.lineTo(bx + bs - bev, by + faceH - bev);
      ctx.lineTo(bx + bs - bev, by + bev);
      ctx.closePath();
      ctx.fill();

      // 3d. Bottom 3D Bevel Rim
      ctx.fillStyle = pal.dark;
      ctx.beginPath();
      ctx.moveTo(bx + bev, by + faceH - bev);
      ctx.lineTo(bx + bs - bev, by + faceH - bev);
      ctx.lineTo(bx + bs - r * 0.6, by + faceH);
      ctx.lineTo(bx + r * 0.6, by + faceH);
      ctx.closePath();
      ctx.fill();

      // 4. Raised Inner Jewel Pillow + Top Specular Shine Dome
      const inX = bx + bs * 0.14;
      const inY = by + faceH * 0.14;
      const inW = bs * 0.72;
      const inH = faceH * 0.72;
      const grad = ctx.createLinearGradient(inX, inY, inX, inY + inH);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.42)');
      grad.addColorStop(0.45, 'rgba(255, 255, 255, 0.08)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0.22)');
      ctx.fillStyle = grad;
      roundRect(ctx, inX, inY, inW, inH, r * 0.55);
      ctx.fill();

      // Crisp 3D specular gloss pill on top-left
      ctx.fillStyle = 'rgba(255, 255, 255, 0.52)';
      roundRect(ctx, inX + inW * 0.1, inY + inH * 0.08, inW * 0.48, Math.max(2, inH * 0.2), 99);
      ctx.fill();

      if (skin === 'skin_neon') {
        const neonFace = ctx.createLinearGradient(inX, inY, inX + inW, inY + inH);
        neonFace.addColorStop(0, pal.light);
        neonFace.addColorStop(0.48, pal.main || pal.fill);
        neonFace.addColorStop(1, pal.dark);
        ctx.globalAlpha = alpha * 0.88;
        ctx.fillStyle = neonFace;
        roundRect(ctx, inX + 1, inY + 1, inW - 2, inH - 2, r * 0.5);
        ctx.fill();
        ctx.globalAlpha = alpha;
        ctx.shadowColor = pal.glow;
        ctx.shadowBlur = Math.min(12, bs * 0.16);
        ctx.strokeStyle = pal.light;
        ctx.lineWidth = Math.max(1.5, bs * 0.045);
        roundRect(ctx, bx + bev * 0.48, by + bev * 0.48, bs - bev * 0.96, faceH - bev * 0.96, r * 0.52);
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else if (skin === 'skin_wood') {
        const cushionGradient = ctx.createLinearGradient(inX, inY, inX, inY + inH);
        cushionGradient.addColorStop(0, pal.light);
        cushionGradient.addColorStop(0.5, pal.main || pal.fill);
        cushionGradient.addColorStop(1, pal.dark);
        ctx.fillStyle = cushionGradient;
        roundRect(ctx, inX + 1, inY + 1, inW - 2, inH - 2, r * 0.58);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.58)';
        ctx.lineWidth = Math.max(1.5, bs * 0.035);
        roundRect(ctx, inX + 2, inY + 2, inW - 4, inH - 4, r * 0.56);
        ctx.stroke();
        ctx.setLineDash([Math.max(1, bs * 0.035), Math.max(2, bs * 0.07)]);
        ctx.strokeStyle = 'rgba(61, 35, 75, 0.62)';
        ctx.lineWidth = Math.max(1, bs * 0.022);
        roundRect(ctx, inX + bs * 0.1, inY + bs * 0.1, inW - bs * 0.2, inH - bs * 0.2, r * 0.42);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (skin === 'skin_crystal') {
        ctx.globalAlpha = alpha * 0.42;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(inX + inW * 0.5, inY + inH * 0.12);
        ctx.lineTo(inX + inW * 0.88, inY + inH * 0.46);
        ctx.lineTo(inX + inW * 0.5, inY + inH * 0.88);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(inX + inW * 0.5, inY + inH * 0.12);
        ctx.lineTo(inX + inW * 0.12, inY + inH * 0.46);
        ctx.lineTo(inX + inW * 0.5, inY + inH * 0.88);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.lineWidth = 1.3;
        ctx.strokeRect(inX + 2, inY + 2, inW - 4, inH - 4);
      }

      if (highlight) {
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 2.5;
        roundRect(ctx, bx, by, bs, faceH, r);
        ctx.stroke();
      }

      // 3D Star / Gem Emblem for Adventure Levels
      if (extra && extra.gem) {
        const cx = x + size / 2;
        const cy = y + faceH / 2 + 1;
        const gr = size * 0.27;
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const ang = -Math.PI / 2 + (i * Math.PI) / 5;
          const rad = i % 2 === 0 ? gr : gr * 0.46;
          const px = cx + Math.cos(ang) * rad;
          const py = cy + Math.sin(ang) * rad;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }

      // Ticking Bomb Timer overlay for Bomb Defuse Mode
      if (extra && typeof extra.bombTimer === 'number') {
        const cx = x + size / 2;
        const cy = y + faceH / 2 + 1;
        ctx.fillStyle = extra.bombTimer <= 3 ? '#ef4444' : '#0f172a';
        ctx.beginPath();
        ctx.arc(cx, cy, size * 0.34, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.font = `900 ${Math.floor(size * 0.42)}px Fredoka, Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(extra.bombTimer), cx, cy + 1);
      }

      ctx.restore();
    },

    // Alias preserved for compatibility
    drawBlockCell(ctx, x, y, size, colorIdx, alpha = 1.0, extra = {}) {
      const highlight = Boolean(extra && extra.highlight);
      this.drawBeveledBlock(ctx, x, y, size, colorIdx, alpha, highlight, extra);
    },

    startRenderLoop() {
      const render = () => {
        this.drawBoard();
        this.animFrameId = requestAnimationFrame(render);
      };
      this.animFrameId = requestAnimationFrame(render);
    },

    drawBoard() {
      if (!this.ctx || !GAME.run) return;
      const ctx = this.ctx;
      const run = GAME.run;
      const n = run.boardSize;
      const cell = this.cellPx;

      ctx.save();
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      // Apply damped screen bounce/shake when lines clear (if reduced motion is OFF)
      if (!STORAGE.state.settings.reducedMotion && this.screenShake > 0.25) {
        const dx = (Math.random() - 0.5) * this.screenShake;
        const dy = (Math.random() - 0.5) * this.screenShake;
        ctx.translate(dx, dy);
        this.screenShake *= 0.85;
      } else {
        this.screenShake = 0;
      }

      // Compute Predictive Line-Clear Glow if dragging or previewing a valid placement
      const activePieceIdx = this.dragState ? this.dragState.trayIndex : GAME.selectedTrayIndex;
      let predictive = { valid: false, cellKeys: new Set() };
      if (
        activePieceIdx !== null &&
        run.tray[activePieceIdx] &&
        !run.tray[activePieceIdx].placed &&
        this.hoverCell &&
        typeof BOARD.getPredictiveClears === 'function'
      ) {
        predictive = BOARD.getPredictiveClears(
          run.grid,
          run.tray[activePieceIdx],
          this.hoverCell.r,
          this.hoverCell.c
        );
      }

      const eqThemeId = STORAGE.state.shop.equippedTheme || 'theme_midnight';
      const themeObj = CFG.SHOP_ITEMS.themes.find(t => t.id === eqThemeId) || CFG.SHOP_ITEMS.themes[0];
      const cellA = themeObj.cellA || '#131c38';
      const cellB = themeObj.cellB || '#162040';

      // 1. Draw 3D recessed checkerboard empty grid sockets + placed 3D blocks
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          const x = c * cell;
          const y = r * cell;
          // Recessed 3D inner socket shadow
          ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
          roundRect(ctx, x + 1.5, y + 1.5, cell - 3, cell - 3, 7);
          ctx.fill();
          // Socket floor
          ctx.fillStyle = (r + c) % 2 === 0 ? cellA : cellB;
          roundRect(ctx, x + 2, y + 3, cell - 4, cell - 4.5, 6);
          ctx.fill();

          const item = run.grid[r][c];
          if (item) {
            const isAboutToClear = predictive.valid && predictive.cellKeys.has(`${r},${c}`);
            this.drawBeveledBlock(ctx, x, y, cell, item.colorIdx, 1.0, isAboutToClear, item);
          }
        }
      }

      // 2. Draw semi-transparent Ghost Preview (`alpha: 0.48`) or soft red invalid indicator
      if (activePieceIdx !== null && run.tray[activePieceIdx] && !run.tray[activePieceIdx].placed && this.hoverCell) {
        const piece = run.tray[activePieceIdx];
        const { r: hr, c: hc } = this.hoverCell;
        const canFit = BOARD.canPlacePieceAt(run.grid, piece, hr, hc);

        for (let pr = 0; pr < piece.rows; pr++) {
          for (let pc = 0; pc < piece.cols; pc++) {
            if (!piece.matrix[pr][pc]) continue;
            const tr = hr + pr;
            const tc = hc + pc;
            if (tr >= 0 && tr < n && tc >= 0 && tc < n) {
              if (canFit) {
                const willClear = predictive.valid && predictive.cellKeys.has(`${tr},${tc}`);
                this.drawBeveledBlock(
                  ctx,
                  tc * cell,
                  tr * cell,
                  cell,
                  piece.colorIdx,
                  0.48,
                  willClear,
                  { gem: piece.hasGem && pr === 0 && pc === 0 }
                );
              } else {
                ctx.save();
                ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
                roundRect(ctx, tc * cell + 2, tr * cell + 2, cell - 4, cell - 4, 6);
                ctx.fill();
                ctx.restore();
              }
            }
          }
        }
      }

      // 3. Draw Power-Up Targeting Preview.
      if (GAME.activePowerupMode && this.hoverCell) {
        const pm = GAME.activePowerupMode;
        const { r: hr, c: hc } = this.hoverCell;
        ctx.save();
        if (pm.type === 'rocket' && this.rocketLaunch) {
          const launch = this.rocketLaunch;
          const path = BOARD.getRocketPath(n, launch.startRow, launch.startCol, launch.axis, launch.direction);
          for (const point of path) {
            ctx.fillStyle = 'rgba(56, 189, 248, 0.3)';
            ctx.strokeStyle = point.r === launch.startRow && point.c === launch.startCol
              ? '#fde047'
              : 'rgba(191, 234, 255, 0.78)';
            ctx.lineWidth = point.r === launch.startRow && point.c === launch.startCol ? 3 : 1.5;
            roundRect(ctx, point.c * cell + 2, point.r * cell + 2, cell - 4, cell - 4, 7);
            ctx.fill();
            ctx.stroke();
          }
        } else if (pm.type === 'hammer') {
          ctx.strokeStyle = '#fde047';
          ctx.lineWidth = 3;
          roundRect(ctx, hc * cell + 2, hr * cell + 2, cell - 4, cell - 4, 8);
          ctx.stroke();
        } else if (pm.type === 'bomb_basic' || pm.type === 'bomb_mega') {
          const coords = BOARD.getBombAffectedCoords(n, hr, hc, pm.type);
          ctx.fillStyle = 'rgba(249, 115, 22, 0.34)';
          ctx.strokeStyle = '#fde047';
          ctx.lineWidth = 2;
          for (const pt of coords) {
            roundRect(ctx, pt.c * cell + 2, pt.r * cell + 2, cell - 4, cell - 4, 6);
            ctx.fill();
            ctx.stroke();
          }
        }
        ctx.restore();
      }

      // 4. Draw the rocket flying from its launch point toward the board edge.
      if (this.rocketAnim) {
        const anim = this.rocketAnim;
        anim.progress = Math.min(1, anim.progress + 0.12);
        const travel = anim.pathLength * anim.progress;
        const x = (anim.startCol + 0.5 + (anim.axis === 'row' ? anim.direction * travel : 0)) * cell;
        const y = (anim.startRow + 0.5 + (anim.axis === 'col' ? anim.direction * travel : 0)) * cell;
        const angle = anim.axis === 'row'
          ? (anim.direction > 0 ? Math.PI / 2 : -Math.PI / 2)
          : (anim.direction > 0 ? Math.PI : 0);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.strokeStyle = 'rgba(255, 181, 66, 0.95)';
        ctx.lineWidth = Math.max(3, cell * 0.15);
        ctx.lineCap = 'round';
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(0, cell * 0.25);
        ctx.lineTo(0, cell * 0.95);
        ctx.stroke();
        ctx.shadowBlur = 0;
        if (this.rocketSprite && this.rocketSprite.complete && this.rocketSprite.naturalWidth > 0) {
          ctx.drawImage(this.rocketSprite, -cell * 0.42, -cell * 0.42, cell * 0.84, cell * 0.84);
        } else {
          ctx.fillStyle = '#fde047';
          ctx.beginPath();
          ctx.arc(0, 0, cell * 0.32, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        if (anim.progress >= 1) this.rocketAnim = null;
      }

      // 5. Show cleared blocks flying away as the rocket passes.
      for (let i = this.rocketDebris.length - 1; i >= 0; i--) {
        const debris = this.rocketDebris[i];
        if (this.rocketAnim && debris.triggerProgress > this.rocketAnim.progress) continue;
        debris.x += debris.vx;
        debris.y += debris.vy;
        debris.vy += 0.12;
        debris.rotation += debris.spin;
        debris.life -= 0.025;
        if (debris.life <= 0) {
          this.rocketDebris.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.globalAlpha = debris.life;
        ctx.translate(debris.x, debris.y);
        ctx.rotate(debris.rotation);
        this.drawBeveledBlock(ctx, -debris.size / 2, -debris.size / 2, debris.size, debris.colorIdx, 1, false, debris.extra);
        ctx.restore();
      }

      // 6. Update & draw expanding golden shockwaves + 12 radial gravity particles per cleared cell
      if (!STORAGE.state.settings.reducedMotion) {
        for (let i = this.shockwaves.length - 1; i >= 0; i--) {
          const sw = this.shockwaves[i];
          sw.radius += sw.speed;
          sw.life -= 0.04;
          if (sw.life <= 0) {
            this.shockwaves.splice(i, 1);
            continue;
          }
          ctx.save();
          ctx.globalAlpha = Math.max(0, sw.life);
          ctx.strokeStyle = sw.color || '#fde047';
          ctx.lineWidth = 3.2;
          ctx.beginPath();
          ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        for (let i = this.particles.length - 1; i >= 0; i--) {
          const p = this.particles[i];
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.22; // Gravity
          p.life -= 0.032;
          if (p.life <= 0) {
            this.particles.splice(i, 1);
            continue;
          }
          ctx.save();
          ctx.globalAlpha = Math.max(0, p.life);
          ctx.fillStyle = p.color;
          roundRect(ctx, p.x - p.size / 2, p.y - p.size / 2, p.size, p.size, 2.5);
          ctx.fill();
          ctx.restore();
        }
      } else {
        this.particles.length = 0;
        this.shockwaves.length = 0;
      }

      // 6. Kid-Friendly Floating Praise Text (`NICE!`, `GREAT!`, `SUPER BLAST!`, `COMBO x3!`, `ALL CLEAR!`)
      for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
        const ft = this.floatingTexts[i];
        ft.y -= 1.25;
        ft.life -= 0.022;
        if (ft.life <= 0) {
          this.floatingTexts.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.globalAlpha = Math.max(0, ft.life);
        ctx.font = '900 22px Fredoka, Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#090d1f';
        ctx.strokeText(ft.text, ft.x, ft.y);
        ctx.fillStyle = ft.color || '#fde047';
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();
      }

      ctx.restore();
    },

    spawnClearEffects(clearedCells, comboStreak, totalLines, boardCleanBonus = 0) {
      if (!clearedCells || clearedCells.length === 0) return;
      const palette = this.getPalette();
      const fx = STORAGE.state.shop.equippedEffect || 'fx_sparks';

      if (!STORAGE.state.settings.reducedMotion) {
        this.screenShake = Math.min(10, Math.max(3, totalLines * 3.2));

        let sumX = 0;
        let sumY = 0;
        for (const item of clearedCells) {
          const cx = (item.c + 0.5) * this.cellPx;
          const cy = (item.r + 0.5) * this.cellPx;
          sumX += cx;
          sumY += cy;
          const palObj = palette[(item.cell.colorIdx || 0) % palette.length];
          const baseCol = palObj.main || palObj.fill;

          // Spawn 12 radial gravity particles per cleared cell
          const count = 12;
          for (let i = 0; i < count; i++) {
            const ang = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.35;
            const spd = 1.6 + Math.random() * 3.8;
            const col = fx === 'fx_prism'
              ? (palette[(i + item.r) % palette.length].main || baseCol)
              : (i % 3 === 0 ? palObj.light : baseCol);
            this.particles.push({
              x: cx,
              y: cy,
              vx: Math.cos(ang) * spd,
              vy: Math.sin(ang) * spd - 1.6,
              size: 4.5 + Math.random() * 4.5,
              life: 1.0,
              color: col
            });
          }
        }

        const centerX = sumX / clearedCells.length;
        const centerY = sumY / clearedCells.length;
        if (totalLines >= 1 || fx === 'fx_rings') {
          this.shockwaves.push({
            x: centerX,
            y: centerY,
            radius: 10,
            speed: 4.8,
            life: 1.0,
            color: '#fde047'
          });
        }
      }

      // Kid-friendly floating praise banner
      let praise = '';
      if (boardCleanBonus > 0) {
        praise = 'ALL CLEAR! +300';
      } else if (comboStreak >= 2) {
        praise = `COMBO x${comboStreak}!`;
      } else if (totalLines >= 3) {
        praise = 'MEGA BLAST!';
      } else if (totalLines === 2) {
        praise = 'SUPER BLAST!';
      } else if (totalLines === 1) {
        const words = CFG.PRAISE_WORDS || ['NICE!', 'GREAT!', 'SUPER!'];
        praise = words[Math.floor(Math.random() * words.length)];
      }

      if (praise) {
        this.floatingTexts.push({
          x: this.boardPixelSize / 2,
          y: this.boardPixelSize / 2,
          text: praise,
          color: comboStreak >= 2 ? '#67e8f9' : '#fde047',
          life: 1.0
        });
      }
    },

    /**
     * Renders the 3-piece dock tray at `0.58x` cell scale, dimming pieces to `0.35` alpha if they cannot currently fit.
     */
    renderTray() {
      const container = document.getElementById('tray-container');
      if (!container || !GAME.run) return;
      container.innerHTML = '';

      const dockCell = Math.max(14, Math.min(22, Math.round(this.cellPx * 0.58)));

      GAME.run.tray.forEach((piece, idx) => {
        const slot = document.createElement('div');
        const canFitSomewhere = !piece.placed && PIECES.canPieceFitBoard(GAME.run.grid, piece);
        slot.className = 'tray-slot' + (piece.placed ? ' empty' : '') + (GAME.selectedTrayIndex === idx ? ' selected' : '');
        slot.dataset.trayIndex = String(idx);

        if (!piece.placed) {
          const miniCanvas = document.createElement('canvas');
          const maxDim = Math.max(piece.cols, piece.rows);
          const fitCell = maxDim >= 4 ? Math.min(dockCell, 16) : dockCell;
          miniCanvas.width = piece.cols * fitCell;
          miniCanvas.height = piece.rows * fitCell;
          const mctx = miniCanvas.getContext('2d');
          const pieceAlpha = canFitSomewhere ? 1.0 : 0.35;

          for (let r = 0; r < piece.rows; r++) {
            for (let c = 0; c < piece.cols; c++) {
              if (piece.matrix[r][c]) {
                this.drawBeveledBlock(mctx, c * fitCell, r * fitCell, fitCell, piece.colorIdx, pieceAlpha, false, {
                  gem: piece.hasGem && r === 0 && c === 0
                });
              }
            }
          }
          slot.appendChild(miniCanvas);

          slot.addEventListener('pointerdown', (ev) => {
            ev.preventDefault();
            this.startPieceInteraction(idx, ev);
          });
        }

        container.appendChild(slot);
      });
    },

    startPieceInteraction(trayIndex, ev) {
      if (!GAME.run || GAME.run.status !== 'playing') return;
      const piece = GAME.run.tray[trayIndex];
      if (!piece || piece.placed) return;

      GAME.activePowerupMode = null;
      this.updatePowerupHint();
      GAME.selectedTrayIndex = trayIndex;
      AUDIO.play('tap');
      this.renderTray();
      this.updatePowerupBar();

      // Render dragged piece at 0.92x cell size on floating ghost canvas
      if (this.ghostCanvas && this.ghostCtx) {
        const gCell = Math.round(this.cellPx * 0.92);
        this.ghostCanvas.width = piece.cols * gCell;
        this.ghostCanvas.height = piece.rows * gCell;
        this.ghostCtx.clearRect(0, 0, this.ghostCanvas.width, this.ghostCanvas.height);
        for (let r = 0; r < piece.rows; r++) {
          for (let c = 0; c < piece.cols; c++) {
            if (piece.matrix[r][c]) {
              this.drawBeveledBlock(this.ghostCtx, c * gCell, r * gCell, gCell, piece.colorIdx, 0.95, false, {
                gem: piece.hasGem && r === 0 && c === 0
              });
            }
          }
        }
      }

      this.dragState = {
        trayIndex,
        piece,
        startX: ev.clientX,
        startY: ev.clientY,
        moved: false
      };
      this.updateDragGhostPosition(ev.clientX, ev.clientY);
    },

    updateDragGhostPosition(clientX, clientY) {
      if (!this.dragState || !this.ghostCanvas || !this.canvas) return;
      const piece = this.dragState.piece;
      const gCell = Math.round(this.cellPx * 0.92);
      const gW = piece.cols * gCell;
      const gH = piece.rows * gCell;
      // Vertical finger-lift offset: -1.15 * cellSize so a child's finger never covers the block
      const liftY = Math.round(1.15 * this.cellPx);
      const left = clientX - gW / 2;
      const top = clientY - gH / 2 - liftY;

      this.ghostCanvas.style.display = 'block';
      this.ghostCanvas.style.left = `${left}px`;
      this.ghostCanvas.style.top = `${top}px`;

      const rect = this.canvas.getBoundingClientRect();
      const col = Math.round((left - rect.left) / this.cellPx);
      const row = Math.round((top - rect.top) / this.cellPx);

      if (row >= -1 && row < GAME.run.boardSize && col >= -1 && col < GAME.run.boardSize) {
        this.hoverCell = {
          r: Math.max(0, Math.min(GAME.run.boardSize - piece.rows, row)),
          c: Math.max(0, Math.min(GAME.run.boardSize - piece.cols, col))
        };
      } else {
        this.hoverCell = null;
      }
    },

    getRocketAim(launch, clientX, clientY) {
      const deltaX = clientX - launch.startX;
      const deltaY = clientY - launch.startY;
      if (Math.hypot(deltaX, deltaY) > 12) {
        return Math.abs(deltaX) >= Math.abs(deltaY)
          ? { axis: 'row', direction: deltaX >= 0 ? 1 : -1 }
          : { axis: 'col', direction: deltaY >= 0 ? 1 : -1 };
      }

      const candidates = [
        { axis: 'row', direction: 1 },
        { axis: 'row', direction: -1 },
        { axis: 'col', direction: 1 },
        { axis: 'col', direction: -1 }
      ];
      let best = candidates[0];
      let bestBlocks = -1;
      for (const candidate of candidates) {
        const path = BOARD.getRocketPath(
          GAME.run.boardSize,
          launch.startRow,
          launch.startCol,
          candidate.axis,
          candidate.direction
        );
        const blocks = path.reduce((total, point) => total + (GAME.run.grid[point.r][point.c] ? 1 : 0), 0);
        if (blocks > bestBlocks) {
          best = candidate;
          bestBlocks = blocks;
        }
      }
      return best;
    },

    updateRocketLaunchAim(clientX, clientY) {
      if (!this.rocketLaunch || !this.canvas) return;
      const launch = this.rocketLaunch;
      const aim = this.getRocketAim(launch, clientX, clientY);
      launch.axis = aim.axis;
      launch.direction = aim.direction;
      const rect = this.canvas.getBoundingClientRect();
      this.hoverCell = {
        r: Math.max(0, Math.min(GAME.run.boardSize - 1, Math.floor((clientY - rect.top) / this.cellPx))),
        c: Math.max(0, Math.min(GAME.run.boardSize - 1, Math.floor((clientX - rect.left) / this.cellPx)))
      };
    },

    spawnRocketDebris(clearedCells, axis, direction, startRow, startCol, pathLength) {
      for (const item of clearedCells) {
        const along = direction * (2.4 + Math.random() * 2.8);
        const across = (Math.random() - 0.5) * 5.2;
        const travelSteps = Math.abs(item.r - startRow) + Math.abs(item.c - startCol);
        this.rocketDebris.push({
          x: (item.c + 0.5) * this.cellPx,
          y: (item.r + 0.5) * this.cellPx,
          vx: axis === 'row' ? along : across,
          vy: axis === 'col' ? along : across - 1.5,
          rotation: Math.random() * Math.PI,
          spin: (Math.random() - 0.5) * 0.24,
          triggerProgress: travelSteps / Math.max(1, pathLength),
          size: this.cellPx * (0.58 + Math.random() * 0.16),
          life: 1,
          colorIdx: item.cell.colorIdx,
          extra: { gem: Boolean(item.cell.gem), bombTimer: item.cell.bombTimer }
        });
      }
    },

    finishRocketLaunch(clientX, clientY) {
      if (!this.rocketLaunch) return;
      this.updateRocketLaunchAim(clientX, clientY);
      const launch = this.rocketLaunch;
      this.rocketLaunch = null;
      this.hoverCell = null;

      const result = GAME.executeBoardPowerup(
        'rocket',
        launch.startRow,
        launch.startCol,
        launch.axis,
        launch.direction
      );
      if (!result.success) {
        this.showToast(result.reason || 'Choose a launch path with blocks.');
        this.updatePowerupHint();
        return;
      }

      this.rocketAnim = {
        startRow: launch.startRow,
        startCol: launch.startCol,
        axis: launch.axis,
        direction: launch.direction,
        pathLength: result.rocketPath.length,
        progress: 0
      };
      this.spawnRocketDebris(
        result.clearedCells,
        launch.axis,
        launch.direction,
        launch.startRow,
        launch.startCol,
        result.rocketPath.length
      );
      this.spawnClearEffects(result.clearedCells, 1, 1, 0);
      this.updatePowerupHint();
      this.renderTray();
      this.updateHud();
      this.updateTopBar();
      this.updatePowerupBar();
    },

    finishPieceDrag() {
      if (!this.dragState) return;
      const { trayIndex, moved } = this.dragState;
      this.dragState = null;
      if (this.ghostCanvas) {
        this.ghostCanvas.style.display = 'none';
      }

      if (moved && this.hoverCell) {
        const res = GAME.attemptPlaceTrayPiece(trayIndex, this.hoverCell.r, this.hoverCell.c);
        this.hoverCell = null;
        if (res && res.valid) {
          this.spawnClearEffects(res.clearedCells, res.comboStreak, res.totalLinesCleared, res.boardCleanBonus);
          this.renderTray();
          this.updateHud();
          this.updateTopBar();
          this.updatePowerupBar();
        }
      } else {
        this.hoverCell = null;
      }
    },

    handleBoardTapOrMove(ev, isCommitTap) {
      if (!this.canvas || !GAME.run || GAME.run.status !== 'playing') return;
      const rect = this.canvas.getBoundingClientRect();
      const c = Math.floor((ev.clientX - rect.left) / this.cellPx);
      const r = Math.floor((ev.clientY - rect.top) / this.cellPx);
      if (r < 0 || r >= GAME.run.boardSize || c < 0 || c >= GAME.run.boardSize) {
        this.hoverCell = null;
        return;
      }

      this.hoverCell = { r, c };

      if (!isCommitTap) return;

      // 1. Power-up execution if a booster is armed
      if (GAME.activePowerupMode) {
        const pm = GAME.activePowerupMode;
        if (pm.type === 'rocket') {
          this.rocketLaunch = {
            startRow: r,
            startCol: c,
            startX: ev.clientX,
            startY: ev.clientY,
            axis: 'row',
            direction: 1
          };
          this.updateRocketLaunchAim(ev.clientX, ev.clientY);
          return;
        }

        const out = GAME.executeBoardPowerup(pm.type, r, c);
        if (!out.success) {
          if (out.noInventory) {
            this.showPowerupRefillModal(pm.type);
          } else {
            this.showToast(out.reason || 'Tap a block on the board!');
          }
          return;
        }
        this.spawnClearEffects(out.clearedCells, 1, 2, 0);
        this.updatePowerupHint();
        this.renderTray();
        this.updateHud();
        this.updateTopBar();
        this.updatePowerupBar();
        return;
      }

      // 2. Tap-to-Select + Tap-to-Place support
      if (GAME.selectedTrayIndex !== null) {
        const res = GAME.attemptPlaceTrayPiece(GAME.selectedTrayIndex, r, c);
        if (res && res.valid) {
          this.spawnClearEffects(res.clearedCells, res.comboStreak, res.totalLinesCleared, res.boardCleanBonus);
          this.renderTray();
          this.updateHud();
          this.updateTopBar();
          this.updatePowerupBar();
        } else if (res && res.reason) {
          this.showToast('That block does not fit there!');
        }
      }
    },

    updateHud() {
      if (!GAME.run) return;
      const run = GAME.run;
      const scoreEl = document.getElementById('hud-score');
      const bestEl = document.getElementById('hud-best');
      const extraLabelEl = document.getElementById('hud-extra-label');
      const extraValEl = document.getElementById('hud-extra-val');
      const objStrip = document.getElementById('objectives-strip');

      if (scoreEl) scoreEl.textContent = run.score.toLocaleString();
      const bestVal = Math.max(run.score, STORAGE.state.bestScores[run.modeId] || 0);
      if (bestEl) bestEl.textContent = bestVal.toLocaleString();

      if (run.modeId === 'levels' && run.levelConfig) {
        if (extraLabelEl) extraLabelEl.textContent = 'MOVES';
        if (extraValEl) extraValEl.textContent = String(run.movesRemaining);
        if (objStrip) {
          objStrip.style.display = 'flex';
          objStrip.innerHTML = run.levelConfig.objectives.map(obj => {
            let cur = 0;
            let iconSrc = 'assets/images/star_filled.png';
            if (obj.kind === 'score') { cur = run.score; iconSrc = 'assets/images/star_filled.png'; }
            else if (obj.kind === 'lines') { cur = run.linesCleared; iconSrc = 'assets/images/rocket.png'; }
            else if (obj.kind === 'gems') { cur = run.gemsCollected; iconSrc = 'assets/images/gem.png'; }
            else if (obj.kind === 'combos') { cur = run.combosTriggered; iconSrc = 'assets/images/crown.png'; }
            const done = cur >= obj.target;
            const statusIcon = done ? 'assets/images/check.png' : iconSrc;
            return `<span style="display:inline-flex;align-items:center;gap:4px;"><img src="${statusIcon}" style="width:18px;height:18px;" alt="Goal"> <strong>${Math.min(cur, obj.target)}/${obj.target}</strong></span>`;
          }).join(' ');
        }
      } else if (run.modeId === 'timed') {
        if (extraLabelEl) extraLabelEl.textContent = 'TIME';
        if (extraValEl) extraValEl.textContent = `${run.timeRemaining}s`;
        if (objStrip) {
          objStrip.style.display = 'flex';
          objStrip.innerHTML = `<span style="display:inline-flex;align-items:center;gap:5px;"><img src="assets/images/rocket.png" style="width:18px;height:18px;" alt="Bonus"> +4s / Line</span><span style="display:inline-flex;align-items:center;gap:4px;"><img src="assets/images/star_filled.png" style="width:18px;height:18px;" alt="Combo"> <strong>x${Math.max(1, run.comboStreak)}</strong></span>`;
        }
      } else if (run.modeId === 'bomb') {
        if (extraLabelEl) extraLabelEl.textContent = 'SAVED';
        if (extraValEl) extraValEl.textContent = String(run.bombsDefused);
        if (objStrip) {
          objStrip.style.display = 'flex';
          objStrip.innerHTML = `<span style="display:inline-flex;align-items:center;gap:5px;"><img src="assets/images/bomb_basic.png" style="width:18px;height:18px;" alt="Bomb"> Clear Bomb Lines!</span>`;
        }
      } else {
        if (extraLabelEl) extraLabelEl.textContent = 'COMBO';
        if (extraValEl) extraValEl.textContent = `x${Math.max(1, run.comboStreak)}`;
        if (objStrip) {
          objStrip.style.display = 'none';
        }
      }
    },

    updatePowerupBar() {
      const ids = ['rocket', 'hammer', 'bomb_basic', 'bomb_mega'];
      for (const id of ids) {
        const countEl = document.getElementById(`pw-count-${id}`);
        const btnEl = document.getElementById(`pw-btn-${id}`);
        const count = STORAGE.state.inventory[id] || 0;
        if (countEl) {
          countEl.textContent = count > 0 ? String(count) : '+';
          countEl.classList.toggle('zero', count <= 0);
        }
        if (btnEl) {
          const isActive = Boolean(GAME.activePowerupMode && GAME.activePowerupMode.type === id);
          btnEl.classList.toggle('active', isActive);
        }
      }
      const rotateBtn = document.getElementById('pw-btn-rotate');
      if (rotateBtn) {
        const piece = GAME.run && GAME.selectedTrayIndex !== null
          ? GAME.run.tray[GAME.selectedTrayIndex]
          : null;
        rotateBtn.classList.toggle('active', Boolean(piece && !piece.placed));
      }
    },

    updatePowerupHint() {
      const hintEl = document.getElementById('powerup-hint-banner');
      if (!hintEl) return;
      const pm = GAME.activePowerupMode;
      if (!pm) {
        hintEl.style.display = 'none';
        this.updatePowerupBar();
        return;
      }
      hintEl.style.display = 'flex';
      const cfg = CFG.POWERUPS[pm.type];
      if (pm.type === 'rocket') {
        hintEl.innerHTML = `
          <img src="assets/images/rocket.png" style="width:22px;height:22px;" alt="Rocket">
          <span>Tap a launch point, then drag to aim</span>
          <button type="button" class="btn-close-x" id="btn-cancel-pw" style="width:28px;height:28px;"><img src="assets/images/close.png" style="width:26px;height:26px;" alt="X"></button>
        `;
      } else {
        hintEl.innerHTML = `
          <img src="${cfg.icon}" style="width:22px;height:22px;" alt="${cfg.name}">
          <span>Tap board!</span>
          <button type="button" class="btn-close-x" id="btn-cancel-pw" style="width:28px;height:28px;"><img src="assets/images/close.png" style="width:26px;height:26px;" alt="X"></button>
        `;
      }
      const cancelBtn = document.getElementById('btn-cancel-pw');
      if (cancelBtn) {
        cancelBtn.onclick = (e) => {
          e.stopPropagation();
          GAME.activePowerupMode = null;
          this.updatePowerupHint();
        };
      }
      this.updatePowerupBar();
    },

    handlePowerupButtonClick(powerupId) {
      if (!GAME.run || GAME.run.status !== 'playing') return;
      if (powerupId === 'rotate') {
        const piece = GAME.selectedTrayIndex !== null ? GAME.run.tray[GAME.selectedTrayIndex] : null;
        if (!PIECES.rotatePieceClockwise(piece)) {
          this.showToast('Tap a block in the tray first.');
          return;
        }
        GAME.activePowerupMode = null;
        this.updatePowerupHint();
        this.renderTray();
        this.updatePowerupBar();
        this.showToast('Rotated 90° clockwise.');
        return;
      }
      const count = STORAGE.state.inventory[powerupId] || 0;
      if (count <= 0) {
        this.showPowerupRefillModal(powerupId);
        return;
      }

      if (GAME.activePowerupMode && GAME.activePowerupMode.type === powerupId) {
        GAME.activePowerupMode = null;
      } else {
        GAME.activePowerupMode = { type: powerupId, rocketAxis: 'row' };
      }
      this.updatePowerupHint();
    },

    openModal(title, iconPath, bodyHtml) {
      const backdrop = document.getElementById('modal-backdrop');
      const titleEl = document.getElementById('modal-title-text');
      const iconEl = document.getElementById('modal-title-icon');
      const bodyEl = document.getElementById('modal-body');
      if (!backdrop || !bodyEl) return;

      if (titleEl) titleEl.textContent = title;
      if (iconEl) iconEl.src = iconPath || 'assets/images/crown.png';
      bodyEl.innerHTML = bodyHtml;
      backdrop.classList.add('open');
    },

    closeModal() {
      const backdrop = document.getElementById('modal-backdrop');
      if (backdrop) backdrop.classList.remove('open');
      this.updateTopBar();
      this.updateHomeBadges();
    },

    /**
     * When the player taps the top-right 'X' button (#btn-modal-close):
     * Close the modal, AND if the active game has ended ('gameover' or 'won'),
     * automatically return the player to the Home Screen so they are never stuck on a finished board.
     */
    handleModalCloseButton() {
      const shouldReturnHome = Boolean(
        GAME.run &&
        (GAME.run.status === 'gameover' || GAME.run.status === 'won') &&
        document.getElementById('screen-game') &&
        document.getElementById('screen-game').classList.contains('active')
      );
      this.closeModal();
      if (shouldReturnHome) {
        GAME.stopTimer();
        this.switchScreen('screen-home');
      }
    },

    handleBackButton() {
      const gameScreen = document.getElementById('screen-game');
      const modalBackdrop = document.getElementById('modal-backdrop');
      const gameIsActive = Boolean(gameScreen && gameScreen.classList.contains('active'));
      const modalIsOpen = Boolean(modalBackdrop && modalBackdrop.classList.contains('open'));

      if (gameIsActive) {
        GAME.stopTimer();
        GAME.persistActiveRun();
        this.closeModal();
        this.switchScreen('screen-home');
        return true;
      }

      if (modalIsOpen) {
        this.closeModal();
        return true;
      }

      return false;
    },

    /**
     * Power-Up Refill Modal with clear Coin Confirmation & Rewarded Ad Option.
     */
    showPowerupRefillModal(powerupId) {
      const pw = CFG.POWERUPS[powerupId];
      if (!pw) return;
      const html = `
        <div class="list-item-card">
          <div style="display:flex;align-items:center;gap:12px;">
            <img src="${pw.icon}" alt="${pw.name}" style="width:48px;height:48px;">
            <div>
              <div style="font-weight:900;font-size:1.05rem;">+1 ${pw.name}</div>
              <div style="font-size:0.8rem;color:var(--text-muted);">${pw.description}</div>
            </div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;margin-top:4px;">
          <button type="button" class="btn btn-gold" id="btn-buy-pw-coins">
            <img src="assets/images/coin.png" alt="Coins"> ${pw.coinCost}
          </button>
          <button type="button" class="btn btn-success" id="btn-buy-pw-ad">
            <img src="assets/images/ad_video.png" alt="Watch Ad"> FREE (+${pw.adRefillAmount})
          </button>
        </div>
      `;
      this.openModal(pw.name, pw.icon, html);

      document.getElementById('btn-buy-pw-coins').onclick = () => {
        this.showConfirmActionModal(
          `+1 ${pw.name}`,
          `Spend ${pw.coinCost} Coins?`,
          () => {
            if (!STORAGE.spendCoins(pw.coinCost)) {
              this.showToast('Need more coins!');
              return;
            }
            STORAGE.state.inventory[powerupId] = (STORAGE.state.inventory[powerupId] || 0) + 1;
            STORAGE.save();
            AUDIO.play('coin');
            this.updateTopBar();
            this.updatePowerupBar();
            this.closeModal();
            this.showToast(`+1 ${pw.name}!`);
          }
        );
      };

      document.getElementById('btn-buy-pw-ad').onclick = () => {
        ADS.showRewarded(
          () => {
            STORAGE.state.inventory[powerupId] = (STORAGE.state.inventory[powerupId] || 0) + pw.adRefillAmount;
            STORAGE.save();
            AUDIO.play('reward');
            this.updatePowerupBar();
            this.closeModal();
            this.showToast(`+${pw.adRefillAmount} ${pw.name}!`);
          },
          (errReason) => this.showToast(errReason)
        );
      };
    },

    showLevelSelectModal() {
      const unlocked = STORAGE.state.levels.unlockedLevel || 1;
      const maxDisplay = Math.max(12, unlocked + 4);
      const starFilledSrc = 'assets/images/star_filled.png';
      const starEmptySrc = 'assets/images/star_empty.png';
      let gridHtml = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">';

      for (let lvl = 1; lvl <= maxDisplay; lvl++) {
        const isUnlocked = lvl <= unlocked;
        const stars = STORAGE.state.levels.starsByLevel[String(lvl)] || 0;
        const starsHtml = [1, 2, 3].map(s =>
          `<img src="${s <= stars ? starFilledSrc : starEmptySrc}" style="width:20px;height:20px;" alt="star">`
        ).join('');

        gridHtml += `
          <button type="button" class="feature-tile btn-lvl-pick" data-level="${lvl}" ${isUnlocked ? '' : 'disabled'} style="opacity:${isUnlocked ? 1 : 0.48};padding:12px 6px;">
            <div style="font-weight:900;font-size:1.15rem;">${lvl}</div>
            <div style="display:flex;gap:3px;margin-top:4px;align-items:center;justify-content:center;">
              ${isUnlocked ? starsHtml : '<img src="assets/images/lock.png" style="width:22px;height:22px;" alt="Locked">'}
            </div>
          </button>
        `;
      }
      gridHtml += '</div>';

      this.openModal('Levels', 'assets/images/levels.png', gridHtml);

      document.querySelectorAll('.btn-lvl-pick').forEach(btn => {
        btn.onclick = () => {
          const lvl = Number(btn.dataset.level);
          this.closeModal();
          this.showLevelBriefingModal(lvl);
        };
      });
    },

    showLevelBriefingModal(lvlNum) {
      const cfg = LEVELS.generateLevelConfig(lvlNum);
      const stars = STORAGE.state.levels.starsByLevel[String(lvlNum)] || 0;
      const starFilledSrc = 'assets/images/star_filled.png';
      const starEmptySrc = 'assets/images/star_empty.png';

      const starsRow = [1, 2, 3].map(s =>
        `<img src="${s <= stars ? starFilledSrc : starEmptySrc}" style="width:32px;height:32px;" alt="Star">`
      ).join('');

      const objHtml = cfg.objectives.map(o => {
        let iconSrc = 'assets/images/star_filled.png';
        if (o.kind === 'lines') iconSrc = 'assets/images/rocket.png';
        else if (o.kind === 'gems') iconSrc = 'assets/images/gem.png';
        else if (o.kind === 'combos') iconSrc = 'assets/images/crown.png';
        return `
          <div class="list-item-card">
            <div style="display:flex;align-items:center;gap:10px;">
              <img src="${iconSrc}" style="width:28px;height:28px;" alt="Goal">
              <span style="font-weight:900;font-size:0.95rem;">${o.label}</span>
            </div>
            <img src="assets/images/star_filled.png" style="width:24px;height:24px;" alt="Star">
          </div>
        `;
      }).join('');

      this.openModal(`Stage ${lvlNum}`, 'assets/images/levels.png', `
        <div style="display:flex;justify-content:center;gap:8px;">${starsRow}</div>
        <div style="text-align:center;font-size:0.92rem;color:var(--gold);font-weight:900;">${cfg.moveLimit} Moves</div>
        <div class="card-list">${objHtml}</div>
        <button type="button" class="btn btn-success" id="btn-start-level-now" style="font-size:1.1rem;padding:13px;">
          <img src="assets/images/play.png" alt="Play"> PLAY
        </button>
      `);

      document.getElementById('btn-start-level-now').onclick = () => {
        this.closeModal();
        GAME.startNewGame('levels', { levelNumber: lvlNum });
        this.switchScreen('screen-game');
      };
    },

    /**
     * Modes & Prizes Submenu: Icon-rich grid for Timed Blitz, Bomb Rescue, Missions, Trophies,
    * Watch Ad (+100 Coins), and Visual How-to-Play.
     */
    showModesModal() {
      const { dailyList, weeklyList, milestoneList } = TASKS.getActiveTasks();
      const claimableTasks = [...dailyList, ...weeklyList, ...milestoneList].filter(t => t.completed && !t.claimed).length;
      const claimableAch = TASKS.getAchievementsStatus().filter(a => a.completed && !a.claimed).length;

      this.openModal('Modes & Prizes', 'assets/images/modes.png', `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <button type="button" class="feature-tile" id="sub-btn-timed" style="padding:14px 8px;">
            <img src="assets/images/rocket.png" alt="Blitz">
            <span style="font-size:0.92rem;">Blitz 90s</span>
          </button>
          <button type="button" class="feature-tile" id="sub-btn-bomb" style="padding:14px 8px;">
            <img src="assets/images/bomb_basic.png" alt="Bombs">
            <span style="font-size:0.92rem;">Bomb Mode</span>
          </button>
          <button type="button" class="feature-tile" id="sub-btn-tasks" style="padding:14px 8px;">
            ${claimableTasks > 0 ? '<span class="badge-dot"></span>' : ''}
            <img src="assets/images/tasks.png" alt="Missions">
            <span style="font-size:0.92rem;">Missions</span>
          </button>
          <button type="button" class="feature-tile" id="sub-btn-trophies" style="padding:14px 8px;">
            ${claimableAch > 0 ? '<span class="badge-dot"></span>' : ''}
            <img src="assets/images/trophy.png" alt="Trophies">
            <span style="font-size:0.92rem;">Trophies</span>
          </button>
        </div>
        <button type="button" class="btn btn-success" id="sub-btn-watch-100" style="width:100%;margin-top:4px;">
          <img src="assets/images/ad_video.png" alt="Video"> Watch Ad +100 <img src="assets/images/coin.png" alt="Coins" style="width:22px;height:22px;">
        </button>
        <button type="button" class="btn btn-secondary" id="sub-btn-help" style="width:100%;">
          <img src="assets/images/help.png" alt="Help"> Guide
        </button>
      `);

      document.getElementById('sub-btn-timed').onclick = () => {
        this.closeModal();
        GAME.startNewGame('timed');
        this.switchScreen('screen-game');
      };
      document.getElementById('sub-btn-bomb').onclick = () => {
        this.closeModal();
        GAME.startNewGame('bomb');
        this.switchScreen('screen-game');
      };
      document.getElementById('sub-btn-tasks').onclick = () => {
        this.showTasksModal();
      };
      document.getElementById('sub-btn-trophies').onclick = () => {
        this.showAchievementsModal();
      };
      document.getElementById('sub-btn-watch-100').onclick = () => {
        this.triggerWatchAdFor100Coins();
      };
      document.getElementById('sub-btn-help').onclick = () => {
        this.showHelpModal();
      };
    },

    showDailyRewardModal() {
      const canClaim = STORAGE.canClaimDailyReward();
      const rewards = CFG.ECONOMY.DAILY_REWARD_COINS;
      const streak = STORAGE.state.daily.streakDay % rewards.length;
      const currentDay = canClaim ? streak : (streak + rewards.length - 1) % rewards.length;
      const checkImg = 'assets/images/check.png';
      const coinImg = 'assets/images/coin.png';

      const daysHtml = rewards.map((amt, idx) => {
        const isCurrent = idx === currentDay;
        const isPast = idx < currentDay;
        return `
          <div class="list-item-card" style="border-color:${isCurrent ? 'var(--gold)' : 'rgba(255,255,255,0.14)'};">
            <div style="display:flex;align-items:center;gap:8px;">
              <img src="${isPast ? checkImg : coinImg}" style="width:26px;height:26px;" alt="Day">
              <strong>Day ${idx + 1}</strong>
            </div>
            <span style="color:var(--gold);font-weight:900;display:inline-flex;align-items:center;gap:4px;">+${amt} <img src="assets/images/coin.png" style="width:18px;height:18px;" alt="Coins"></span>
          </div>
        `;
      }).join('');

      this.openModal('Daily Gift', 'assets/images/chest.png', `
        <div class="card-list">${daysHtml}</div>
        <div class="list-item-card" style="justify-content:center;text-align:center;font-weight:900;color:var(--gold);">
          ${canClaim
          ? `Day ${streak + 1} reward is ready: +${rewards[streak]} coins.`
          : `Today's Day ${currentDay + 1} gift is collected. Tomorrow: +${rewards[(streak + 1) % rewards.length]} coins.`}
        </div>
        <button type="button" class="btn ${canClaim ? 'btn-gold' : 'btn-secondary'}" id="btn-claim-daily-now" ${canClaim ? '' : 'disabled'}>
          <img src="assets/images/chest.png" alt="Gift">
          ${canClaim ? `CLAIM DAY ${streak + 1}` : 'COLLECTED TODAY'}
        </button>
      `);

      const btn = document.getElementById('btn-claim-daily-now');
      if (btn && canClaim) {
        btn.onclick = () => {
          const res = STORAGE.claimDailyReward();
          if (res.success) {
            AUDIO.play('reward');
            this.showToast(`+${res.coins} Coins!`);
            this.showDailyRewardModal();
            this.updateTopBar();
            this.updateHomeBadges();
          }
        };
      }
    },

    showSpinnerModal() {
      const canFree = STORAGE.canUseFreeSpin();
      const slots = CFG.SPINNER_SLOTS;

      this.openModal('Lucky Spin', 'assets/images/spinner.png', `
        <div style="display:flex;flex-direction:column;align-items:center;gap:10px;">
          <canvas id="spinner-wheel-canvas" width="224" height="224"></canvas>
          <div id="spinner-result-msg" style="font-family:var(--font-display);font-weight:900;color:var(--gold);font-size:1rem;min-height:24px;">Spin &amp; Win!</div>
          <div style="display:flex;flex-direction:column;width:100%;gap:8px;">
            <button type="button" class="btn btn-primary" id="btn-spin-free" ${canFree ? '' : 'style="display:none;"'}>
              <img src="assets/images/spinner.png" alt="Spin"> FREE SPIN
            </button>
            <button type="button" class="btn btn-success" id="btn-spin-ad">
              <img src="assets/images/ad_video.png" alt="Ad"> FREE SPIN (VIDEO)
            </button>
            <button type="button" class="btn btn-gold" id="btn-spin-watch-ad">
              <img src="assets/images/ad_video.png" alt="Video"> Watch Ad +100 Coins
            </button>
            <button type="button" class="btn btn-gold" id="btn-spin-coins">
              <img src="assets/images/coin.png" alt="Coin"> ${CFG.ECONOMY.SPINNER_COIN_COST}
            </button>
          </div>
        </div>
      `);

      this.drawSpinnerWheel(this.spinnerAngle);

      const triggerWheelSpin = () => {
        if (this.spinnerSpinning) return;
        this.spinnerSpinning = true;

        const totalWeight = slots.reduce((acc, s) => acc + s.weight, 0);
        let r = Math.random() * totalWeight;
        let chosenIndex = 0;
        for (let i = 0; i < slots.length; i++) {
          r -= slots[i].weight;
          if (r <= 0) {
            chosenIndex = i;
            break;
          }
        }

        const sliceRad = (Math.PI * 2) / slots.length;
        const targetAngle = (Math.PI * 2 * 5) + (Math.PI * 1.5 - (chosenIndex + 0.5) * sliceRad);
        const startAngle = this.spinnerAngle % (Math.PI * 2);
        const startTime = performance.now();
        const duration = 2200;

        AUDIO.play('spinner');

        const step = (now) => {
          const t = Math.min(1, (now - startTime) / duration);
          const easeOut = 1 - Math.pow(1 - t, 3);
          this.spinnerAngle = startAngle + (targetAngle - startAngle) * easeOut;
          this.drawSpinnerWheel(this.spinnerAngle);

          if (t < 1) {
            requestAnimationFrame(step);
          } else {
            this.spinnerSpinning = false;
            const prize = slots[chosenIndex];
            if (prize.type === 'coins') {
              STORAGE.addCoins(prize.amount);
            } else if (prize.type === 'powerup') {
              STORAGE.state.inventory[prize.item] = (STORAGE.state.inventory[prize.item] || 0) + prize.amount;
              STORAGE.save();
            }
            AUDIO.play('reward');
            this.updateTopBar();
            this.updateHomeBadges();
            const msgEl = document.getElementById('spinner-result-msg');
            if (msgEl) msgEl.textContent = `+${prize.label}!`;
            this.showToast(`Won: ${prize.label}!`);
          }
        };
        requestAnimationFrame(step);
      };

      const freeBtn = document.getElementById('btn-spin-free');
      if (freeBtn) {
        freeBtn.onclick = () => {
          if (this.spinnerSpinning || !STORAGE.canUseFreeSpin()) return;
          STORAGE.markFreeSpinUsed();
          freeBtn.style.display = 'none';
          triggerWheelSpin();
        };
      }

      const adBtn = document.getElementById('btn-spin-ad');
      if (adBtn) {
        adBtn.onclick = () => {
          if (this.spinnerSpinning) return;
          ADS.showRewarded(
            () => triggerWheelSpin(),
            (err) => this.showToast(err)
          );
        };
      }

      const coinAdBtn = document.getElementById('btn-spin-watch-ad');
      if (coinAdBtn) coinAdBtn.onclick = () => this.triggerWatchAdFor100Coins();

      const coinBtn = document.getElementById('btn-spin-coins');
      if (coinBtn) {
        coinBtn.onclick = () => {
          if (this.spinnerSpinning) return;
          this.showConfirmActionModal(
            'Spin Wheel?',
            `Spend ${CFG.ECONOMY.SPINNER_COIN_COST} Coins?`,
            () => {
              if (!STORAGE.spendCoins(CFG.ECONOMY.SPINNER_COIN_COST)) {
                this.showToast('Not enough coins!');
                return;
              }
              this.updateTopBar();
              this.showSpinnerModal();
              triggerWheelSpin();
            }
          );
        };
      }
    },

    drawSpinnerWheel(angleRad) {
      const c = document.getElementById('spinner-wheel-canvas');
      if (!c) return;
      const ctx = c.getContext('2d');
      const slots = CFG.SPINNER_SLOTS;
      const cx = c.width / 2;
      const cy = c.height / 2;
      const rad = cx - 12;
      const slice = (Math.PI * 2) / slots.length;

      ctx.clearRect(0, 0, c.width, c.height);

      slots.forEach((slot, i) => {
        const a0 = angleRad + i * slice;
        const a1 = a0 + slice;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, rad, a0, a1);
        ctx.closePath();
        ctx.fillStyle = slot.color;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(a0 + slice / 2);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 12px Fredoka, Inter, sans-serif';
        ctx.fillText(slot.label, rad - 12, 4);
        ctx.restore();
      });

      ctx.beginPath();
      ctx.arc(cx, cy, 18, 0, Math.PI * 2);
      ctx.fillStyle = '#fde047';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Top pointer
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.moveTo(cx - 11, 2);
      ctx.lineTo(cx + 11, 2);
      ctx.lineTo(cx, 22);
      ctx.closePath();
      ctx.fill();
    },

    showTasksModal() {
      const { dailyList, weeklyList, milestoneList } = TASKS.getActiveTasks();
      const renderList = (items) => items.map(t => {
        const pct = Math.min(100, Math.round((t.progress / t.target) * 100));
        return `
          <div class="list-item-card" style="flex-direction:column;align-items:stretch;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <strong style="font-size:0.9rem;">${t.title}</strong>
              <span style="color:var(--gold);font-weight:900;font-size:0.88rem;display:inline-flex;align-items:center;gap:4px;">+${t.rewardCoins} <img src="assets/images/coin.png" style="width:18px;height:18px;" alt="Coins"></span>
            </div>
            <div class="progress-bar-track"><div class="progress-bar-fill" style="width:${pct}%;"></div></div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;">
              <span style="font-size:0.78rem;color:var(--text-muted);">${t.progress} / ${t.target}</span>
              ${t.claimed
            ? '<img src="assets/images/check.png" style="width:22px;height:22px;" alt="Done">'
            : `<button type="button" class="btn ${t.completed ? 'btn-gold' : 'btn-secondary'} btn-claim-task" data-uid="${t.uid}" style="padding:5px 12px;font-size:0.78rem;" ${t.completed ? '' : 'disabled'}>Claim</button>`
          }
            </div>
          </div>
        `;
      }).join('');

      this.openModal('Missions', 'assets/images/tasks.png', `
        <div style="font-weight:900;color:var(--gold);display:flex;align-items:center;gap:6px;"><img src="assets/images/star_filled.png" style="width:20px;height:20px;" alt="Daily"> Daily</div>
        <div class="card-list">${renderList(dailyList)}</div>
        <div style="font-weight:900;color:var(--accent);margin-top:6px;display:flex;align-items:center;gap:6px;"><img src="assets/images/crown.png" style="width:20px;height:20px;" alt="Weekly"> Weekly</div>
        <div class="card-list">${renderList(weeklyList)}</div>
        <div style="font-weight:900;color:var(--accent);margin-top:6px;display:flex;align-items:center;gap:6px;"><img src="assets/images/trophy.png" style="width:20px;height:20px;" alt="Big"> Milestones</div>
        <div class="card-list">${renderList(milestoneList)}</div>
      `);

      document.querySelectorAll('.btn-claim-task').forEach(btn => {
        btn.onclick = () => {
          const res = TASKS.claimTask(btn.dataset.uid);
          if (res.success) {
            AUDIO.play('reward');
            this.showToast(`+${res.rewardCoins} Coins!`);
            this.updateTopBar();
            this.showTasksModal();
          }
        };
      });
    },

    showAchievementsModal() {
      const list = TASKS.getAchievementsStatus();
      const html = list.map(a => {
        const pct = Math.min(100, Math.round((a.progress / a.target) * 100));
        return `
          <div class="list-item-card" style="flex-direction:column;align-items:stretch;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <strong style="display:inline-flex;align-items:center;gap:6px;"><img src="assets/images/trophy.png" style="width:20px;height:20px;" alt="Trophy"> ${a.title}</strong>
              <span style="color:var(--gold);font-weight:900;display:inline-flex;align-items:center;gap:4px;">+${a.rewardCoins} <img src="assets/images/coin.png" style="width:18px;height:18px;" alt="Coins"></span>
            </div>
            <div style="font-size:0.8rem;color:var(--text-muted);">${a.desc}</div>
            <div class="progress-bar-track"><div class="progress-bar-fill" style="width:${pct}%;"></div></div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;">
              <span style="font-size:0.78rem;color:var(--text-muted);">${a.progress} / ${a.target}</span>
              ${a.claimed
            ? '<img src="assets/images/check.png" style="width:22px;height:22px;" alt="Done">'
            : `<button type="button" class="btn ${a.completed ? 'btn-gold' : 'btn-secondary'} btn-claim-ach" data-id="${a.id}" style="padding:5px 12px;font-size:0.78rem;" ${a.completed ? '' : 'disabled'}>Claim</button>`
          }
            </div>
          </div>
        `;
      }).join('');

      this.openModal('Trophies', 'assets/images/trophy.png', `<div class="card-list">${html}</div>`);

      document.querySelectorAll('.btn-claim-ach').forEach(btn => {
        btn.onclick = () => {
          const res = TASKS.claimAchievement(btn.dataset.id);
          if (res.success) {
            AUDIO.play('reward');
            this.showToast(`+${res.rewardCoins} Coins!`);
            this.updateTopBar();
            this.showAchievementsModal();
          }
        };
      });
    },

    showShopModal(activeTab = 'powerups') {
      const tabsHtml = `
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;">
          <button type="button" class="btn ${activeTab === 'powerups' ? 'btn-primary' : 'btn-secondary'} shop-tab-btn" data-tab="powerups" style="padding:7px;font-size:0.76rem;">Boosts</button>
          <button type="button" class="btn ${activeTab === 'themes' ? 'btn-primary' : 'btn-secondary'} shop-tab-btn" data-tab="themes" style="padding:7px;font-size:0.76rem;">Themes</button>
          <button type="button" class="btn ${activeTab === 'skins' ? 'btn-primary' : 'btn-secondary'} shop-tab-btn" data-tab="skins" style="padding:7px;font-size:0.76rem;">Blocks</button>
          <button type="button" class="btn ${activeTab === 'effects' ? 'btn-primary' : 'btn-secondary'} shop-tab-btn" data-tab="effects" style="padding:7px;font-size:0.76rem;">FX</button>
        </div>
      `;

      let contentHtml = '';
      if (activeTab === 'powerups') {
        contentHtml = Object.values(CFG.POWERUPS).map(pw => `
          <div class="list-item-card">
            <div style="display:flex;align-items:center;gap:10px;">
              <img src="${pw.icon}" style="width:40px;height:40px;" alt="${pw.name}">
              <div>
                <div style="font-weight:900;">${pw.name} (x${STORAGE.state.inventory[pw.id] || 0})</div>
                <div style="font-size:0.74rem;color:var(--text-muted);">${pw.description}</div>
              </div>
            </div>
            <button type="button" class="btn btn-gold btn-buy-shop-pw" data-id="${pw.id}" style="padding:7px 11px;font-size:0.8rem;white-space:nowrap;">
              <img src="assets/images/coin.png" style="width:18px;height:18px;" alt="Coins"> ${pw.coinCost}
            </button>
          </div>
        `).join('');
      } else {
        const mapKey = {
          themes: { list: CFG.SHOP_ITEMS.themes, ownedArr: STORAGE.state.shop.ownedThemes, eqKey: 'equippedTheme' },
          skins: { list: CFG.SHOP_ITEMS.skins, ownedArr: STORAGE.state.shop.ownedSkins, eqKey: 'equippedSkin' },
          effects: { list: CFG.SHOP_ITEMS.effects, ownedArr: STORAGE.state.shop.ownedEffects, eqKey: 'equippedEffect' }
        }[activeTab];

        contentHtml = mapKey.list.map(item => {
          const owned = mapKey.ownedArr.includes(item.id);
          const equipped = STORAGE.state.shop[mapKey.eqKey] === item.id;
          return `
            <div class="list-item-card">
              <div>
                <div style="font-weight:900;">${item.name}</div>
                <div style="font-size:0.74rem;color:var(--text-muted);">${item.desc}</div>
              </div>
              <button type="button" class="btn ${equipped ? 'btn-success' : (owned ? 'btn-primary' : 'btn-gold')} btn-shop-cosmetic" data-cat="${activeTab}" data-id="${item.id}" style="padding:7px 12px;font-size:0.78rem;white-space:nowrap;">
                ${equipped ? '<img src="assets/images/check.png" style="width:18px;height:18px;" alt="On">' : (owned ? 'Use' : `<img src="assets/images/coin.png" style="width:18px;height:18px;" alt="Coins"> ${item.price}`)}
              </button>
            </div>
          `;
        }).join('');
      }

      this.openModal('Shop', 'assets/images/shop.png', `
        ${tabsHtml}
        <div class="card-list">${contentHtml}</div>
        <button type="button" class="btn btn-success" id="btn-shop-watch-ad">
          <img src="assets/images/ad_video.png" alt="Ad"> Watch Ad +100 <img src="assets/images/coin.png" style="width:20px;height:20px;" alt="Coins">
        </button>
      `);

      document.querySelectorAll('.shop-tab-btn').forEach(b => {
        b.onclick = () => this.showShopModal(b.dataset.tab);
      });

      document.querySelectorAll('.btn-buy-shop-pw').forEach(b => {
        b.onclick = () => {
          const pw = CFG.POWERUPS[b.dataset.id];
          this.showConfirmActionModal(
            `+1 ${pw.name}`,
            `Spend ${pw.coinCost} Coins?`,
            () => {
              if (!STORAGE.spendCoins(pw.coinCost)) {
                this.showToast('Not enough coins!');
                return;
              }
              STORAGE.state.inventory[pw.id] = (STORAGE.state.inventory[pw.id] || 0) + 1;
              STORAGE.save();
              AUDIO.play('coin');
              this.updateTopBar();
              this.updatePowerupBar();
              this.showShopModal('powerups');
              this.showToast(`+1 ${pw.name}!`);
            }
          );
        };
      });

      document.querySelectorAll('.btn-shop-cosmetic').forEach(b => {
        b.onclick = () => {
          const cat = b.dataset.cat;
          const id = b.dataset.id;
          const mapKey = {
            themes: { list: CFG.SHOP_ITEMS.themes, ownedKey: 'ownedThemes', eqKey: 'equippedTheme' },
            skins: { list: CFG.SHOP_ITEMS.skins, ownedKey: 'ownedSkins', eqKey: 'equippedSkin' },
            effects: { list: CFG.SHOP_ITEMS.effects, ownedKey: 'ownedEffects', eqKey: 'equippedEffect' }
          }[cat];
          const item = mapKey.list.find(x => x.id === id);
          if (!item) return;

          const ownedArr = STORAGE.state.shop[mapKey.ownedKey];
          if (!ownedArr.includes(id)) {
            this.showConfirmActionModal(
              item.name,
              `Spend ${item.price} Coins?`,
              () => {
                if (!STORAGE.spendCoins(item.price)) {
                  this.showToast('Not enough coins!');
                  return;
                }
                ownedArr.push(id);
                STORAGE.state.shop[mapKey.eqKey] = id;
                STORAGE.save();
                AUDIO.play('coin');
                this.applySettingsAndTheme();
                this.updateTopBar();
                this.showShopModal(cat);
              }
            );
            return;
          }

          STORAGE.state.shop[mapKey.eqKey] = id;
          STORAGE.save();
          this.applySettingsAndTheme();
          this.updateTopBar();
          this.showShopModal(cat);
        };
      });

      const adBtn = document.getElementById('btn-shop-watch-ad');
      if (adBtn) {
        adBtn.onclick = () => this.triggerWatchAdFor100Coins();
      }
    },

    triggerWatchAdFor100Coins() {
      ADS.showRewarded(
        (reward) => {
          STORAGE.addCoins(reward.amount);
          AUDIO.play('reward');
          this.updateTopBar();
          this.showToast(`You earned ${reward.amount} coins!`);
        },
        (msg) => this.showToast(msg)
      );
    },

    /** Player-friendly Settings Modal. */
    showSettingsModal() {
      const s = STORAGE.state.settings;
      const sfxPct = Math.round((Number(s.sfxVolume) || 0.85) * 100);
      const bgmPct = Math.round((Number(s.musicVolume) || 0.45) * 100);
      const sfxImg = s.soundEnabled ? 'assets/images/sound_on.png' : 'assets/images/sound_off.png';
      const bgmImg = s.musicEnabled ? 'assets/images/music_on.png' : 'assets/images/music_off.png';

      this.openModal('Settings', 'assets/images/settings.png', `
        <div class="card-list">
          <div class="list-item-card" style="flex-direction:column;align-items:stretch;gap:6px;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-weight:900;display:inline-flex;align-items:center;gap:8px;"><img src="${sfxImg}" style="width:24px;height:24px;" alt="Sound"> Sound</span>
              <button type="button" class="btn ${s.soundEnabled ? 'btn-success' : 'btn-secondary'}" id="tog-sfx" style="padding:6px 14px;">${s.soundEnabled ? 'ON' : 'OFF'}</button>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;font-size:0.78rem;color:var(--text-muted);">
              <span><strong id="lbl-sfx-vol">${sfxPct}%</strong></span>
              <input type="range" min="10" max="100" step="5" value="${sfxPct}" class="volume-slider" id="rng-sfx-vol">
            </div>
          </div>

          <div class="list-item-card" style="flex-direction:column;align-items:stretch;gap:6px;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-weight:900;display:inline-flex;align-items:center;gap:8px;"><img src="${bgmImg}" style="width:24px;height:24px;" alt="Music"> Music</span>
              <button type="button" class="btn ${s.musicEnabled ? 'btn-success' : 'btn-secondary'}" id="tog-bgm" style="padding:6px 14px;">${s.musicEnabled ? 'ON' : 'OFF'}</button>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;font-size:0.78rem;color:var(--text-muted);">
              <span><strong id="lbl-bgm-vol">${bgmPct}%</strong></span>
              <input type="range" min="10" max="100" step="5" value="${bgmPct}" class="volume-slider" id="rng-bgm-vol">
            </div>
          </div>

          <div class="list-item-card">
            <span style="font-weight:900;">Haptics</span>
            <button type="button" class="btn ${s.hapticsEnabled ? 'btn-success' : 'btn-secondary'}" id="tog-hap" style="padding:6px 14px;">${s.hapticsEnabled ? 'ON' : 'OFF'}</button>
          </div>

          <div class="list-item-card">
            <span style="font-weight:900;">Reduced Motion</span>
            <button type="button" class="btn ${s.reducedMotion ? 'btn-primary' : 'btn-secondary'}" id="tog-motion" style="padding:6px 14px;">${s.reducedMotion ? 'ON' : 'OFF'}</button>
          </div>

          <div class="list-item-card">
            <span style="font-weight:900;">Color-Friendly</span>
            <button type="button" class="btn ${s.colorblindMode ? 'btn-primary' : 'btn-secondary'}" id="tog-cb" style="padding:6px 14px;">${s.colorblindMode ? 'ON' : 'OFF'}</button>
          </div>

          <div class="list-item-card">
            <span style="font-weight:900;">Big Text</span>
            <button type="button" class="btn ${s.textScale === 'large' ? 'btn-primary' : 'btn-secondary'}" id="tog-scale" style="padding:6px 14px;">${s.textScale === 'large' ? 'ON' : 'OFF'}</button>
          </div>

          <div class="list-item-card">
            <span style="font-weight:900;">Theme</span>
            <button type="button" class="btn btn-secondary" id="tog-theme-quick" style="padding:6px 14px;">Switch</button>
          </div>

        </div>
      `);

      document.getElementById('tog-sfx').onclick = () => {
        s.soundEnabled = !s.soundEnabled;
        STORAGE.save();
        this.applySettingsAndTheme();
        this.showSettingsModal();
      };

      const sfxSlider = document.getElementById('rng-sfx-vol');
      if (sfxSlider) {
        sfxSlider.oninput = (ev) => {
          const val = Number(ev.target.value) || 80;
          s.sfxVolume = val / 100;
          const lbl = document.getElementById('lbl-sfx-vol');
          if (lbl) lbl.textContent = `${val}%`;
          STORAGE.save();
        };
      }

      document.getElementById('tog-bgm').onclick = () => {
        s.musicEnabled = !s.musicEnabled;
        STORAGE.save();
        AUDIO.syncMusic();
        this.showSettingsModal();
      };

      const bgmSlider = document.getElementById('rng-bgm-vol');
      if (bgmSlider) {
        bgmSlider.oninput = (ev) => {
          const val = Number(ev.target.value) || 45;
          s.musicVolume = val / 100;
          const lbl = document.getElementById('lbl-bgm-vol');
          if (lbl) lbl.textContent = `${val}%`;
          STORAGE.save();
          AUDIO.syncMusic();
        };
      }

      document.getElementById('tog-hap').onclick = () => {
        s.hapticsEnabled = !s.hapticsEnabled;
        STORAGE.save();
        this.showSettingsModal();
      };
      document.getElementById('tog-motion').onclick = () => {
        s.reducedMotion = !s.reducedMotion;
        STORAGE.save();
        this.showSettingsModal();
      };
      document.getElementById('tog-cb').onclick = () => {
        s.colorblindMode = !s.colorblindMode;
        STORAGE.save();
        this.renderTray();
        this.showSettingsModal();
      };
      document.getElementById('tog-scale').onclick = () => {
        s.textScale = s.textScale === 'large' ? 'normal' : 'large';
        STORAGE.save();
        this.applySettingsAndTheme();
        this.showSettingsModal();
      };
      document.getElementById('tog-theme-quick').onclick = () => {
        STORAGE.state.shop.equippedTheme = STORAGE.state.shop.equippedTheme === 'theme_daylight' ? 'theme_midnight' : 'theme_daylight';
        STORAGE.save();
        this.applySettingsAndTheme();
        this.showSettingsModal();
      };
    },

    showHelpModal() {
      this.openModal('How to Play', 'assets/images/help.png', `
        <div class="card-list" style="font-size:0.9rem;">
          <div class="list-item-card">
            <img src="assets/images/logo.png" style="width:36px;height:36px;" alt="Drag">
            <div><strong>Drag 3D Blocks</strong> onto the board!</div>
          </div>
          <div class="list-item-card">
            <img src="assets/images/star_filled.png" style="width:36px;height:36px;" alt="Blast">
            <div><strong>Fill a Row or Column</strong> to blast it!</div>
          </div>
          <div class="list-item-card">
            <img src="assets/images/rocket.png" style="width:36px;height:36px;" alt="Boost">
            <div><strong>Tap Boosters</strong> anytime for help!</div>
          </div>
        </div>
      `);
    },

    showPauseModal() {
      if (!GAME.run) return;
      const s = STORAGE.state.settings;
      const sfxImg = s.soundEnabled ? 'assets/images/sound_on.png' : 'assets/images/sound_off.png';
      const bgmImg = s.musicEnabled ? 'assets/images/music_on.png' : 'assets/images/music_off.png';

      this.openModal('Paused', 'assets/images/pause.png', `
        <div style="display:flex;flex-direction:column;gap:10px;">
          <button type="button" class="btn btn-success" id="btn-pause-resume" style="font-size:1.08rem;padding:13px;">
            <img src="assets/images/play.png" alt="Play"> PLAY
          </button>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <button type="button" class="btn btn-secondary" id="btn-pause-sfx">
              <img src="${sfxImg}" alt="Sound"> ${s.soundEnabled ? 'ON' : 'OFF'}
            </button>
            <button type="button" class="btn btn-secondary" id="btn-pause-bgm">
              <img src="${bgmImg}" alt="Music"> ${s.musicEnabled ? 'ON' : 'OFF'}
            </button>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <button type="button" class="btn btn-primary" id="btn-pause-restart">
              <img src="assets/images/restart.png" alt="Replay"> RETRY
            </button>
            <button type="button" class="btn btn-gold" id="btn-pause-home">
              <img src="assets/images/home.png" alt="Home"> HOME
            </button>
          </div>
        </div>
      `);

      document.getElementById('btn-pause-resume').onclick = () => this.closeModal();
      document.getElementById('btn-pause-sfx').onclick = () => {
        s.soundEnabled = !s.soundEnabled;
        STORAGE.save();
        this.applySettingsAndTheme();
        this.showPauseModal();
      };
      document.getElementById('btn-pause-bgm').onclick = () => {
        s.musicEnabled = !s.musicEnabled;
        STORAGE.save();
        AUDIO.syncMusic();
        this.showPauseModal();
      };
      document.getElementById('btn-pause-restart').onclick = () => {
        this.showConfirmActionModal('Retry?', 'Start a fresh board?', () => {
          const modeId = GAME.run.modeId;
          const lvlNum = GAME.run.levelConfig ? GAME.run.levelConfig.levelNumber : undefined;
          GAME.startNewGame(modeId, { levelNumber: lvlNum });
          this.closeModal();
          this.switchScreen('screen-game');
        });
      };
      document.getElementById('btn-pause-home').onclick = () => {
        GAME.stopTimer();
        this.closeModal();
        this.switchScreen('screen-home');
      };
    },

    showConfirmActionModal(title, message, onConfirm) {
      this.openModal(title, 'assets/images/help.png', `
        <p style="margin:0;color:var(--text-muted);text-align:center;font-size:0.95rem;font-weight:800;">${message}</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px;">
          <button type="button" class="btn btn-danger" id="btn-conf-cancel">
            <img src="assets/images/close.png" alt="No"> NO
          </button>
          <button type="button" class="btn btn-success" id="btn-conf-yes">
            <img src="assets/images/check.png" alt="Yes"> YES
          </button>
        </div>
      `);
      document.getElementById('btn-conf-cancel').onclick = () => this.closeModal();
      document.getElementById('btn-conf-yes').onclick = () => onConfirm();
    },

    showLevelCompleteModal(run) {
      ADS.showInterstitial();
      const cfg = run.levelConfig;
      const stars = run.starsEarned || 1;
      const starFilledSrc = 'assets/images/star_filled.png';
      const starEmptySrc = 'assets/images/star_empty.png';
      const starsHtml = [1, 2, 3].map(i =>
        `<img src="${i <= stars ? starFilledSrc : starEmptySrc}" style="width:48px;height:48px;" alt="Star">`
      ).join('');

      this.openModal(`Stage ${cfg.levelNumber} Won!`, 'assets/images/crown.png', `
        <div style="display:flex;justify-content:center;gap:10px;margin:6px 0;">${starsHtml}</div>
        <div style="text-align:center;font-size:1.3rem;font-weight:900;">${run.score.toLocaleString()}</div>
        <div style="text-align:center;color:var(--gold);font-weight:900;font-size:1.1rem;display:flex;align-items:center;justify-content:center;gap:6px;">
          <img src="assets/images/coin.png" style="width:24px;height:24px;" alt="Coin"> +${run.levelRewardCoins || 85}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px;">
          <button type="button" class="btn btn-secondary" id="btn-lvl-home">
            <img src="assets/images/home.png" alt="Home"> HOME
          </button>
          <button type="button" class="btn btn-success" id="btn-next-level">
            <img src="assets/images/play.png" alt="Next"> NEXT
          </button>
        </div>
      `);

      document.getElementById('btn-next-level').onclick = () => {
        this.closeModal();
        GAME.startNewGame('levels', { levelNumber: cfg.levelNumber + 1 });
        this.switchScreen('screen-game');
      };
      document.getElementById('btn-lvl-home').onclick = () => {
        this.closeModal();
        this.switchScreen('screen-home');
      };
    },

    showGameOverModal(run) {
      const canContinue = (
        run.modeId === 'classic' &&
        run.continuesUsed < CFG.ECONOMY.CLASSIC_CONTINUE_MAX
      );
      const continueCoinCost = CFG.ECONOMY.CLASSIC_CONTINUE_COINS[run.continuesUsed] || 500;
      const starFilledSrc = 'assets/images/star_filled.png';
      const starEmptySrc = 'assets/images/star_empty.png';

      const continueHtml = canContinue ? `
        <div style="padding:12px;border-radius:18px;background:rgba(34,197,94,0.16);border:2px solid rgba(34,197,94,0.45);display:flex;flex-direction:column;gap:8px;">
          <div style="font-weight:900;font-size:0.9rem;text-align:center;">Continue? (${CFG.ECONOMY.CLASSIC_CONTINUE_MAX - run.continuesUsed} left)</div>
          <button type="button" class="btn btn-success" id="btn-continue-ad">
            <img src="assets/images/ad_video.png" alt="Ad"> FREE CONTINUE
          </button>
          <button type="button" class="btn btn-gold" id="btn-continue-coins">
            <img src="assets/images/coin.png" alt="Coins"> ${continueCoinCost}
          </button>
        </div>
      ` : '';

      const starsRow = `
        <div style="display:flex;justify-content:center;gap:8px;margin:2px 0;">
          <img src="${run.score >= 200 ? starFilledSrc : starEmptySrc}" style="width:36px;height:36px;" alt="Star">
          <img src="${run.score >= 600 ? starFilledSrc : starEmptySrc}" style="width:36px;height:36px;" alt="Star">
          <img src="${run.score >= 1200 ? starFilledSrc : starEmptySrc}" style="width:36px;height:36px;" alt="Star">
        </div>
      `;

      this.openModal(run.modeId === 'levels' ? 'Try Again!' : 'No Moves!', 'assets/images/bomb_basic.png', `
        ${starsRow}
        <div style="text-align:center;font-family:var(--font-display);font-size:1.55rem;font-weight:900;margin:2px 0;color:var(--gold);">${run.score.toLocaleString()}</div>
        ${continueHtml}
        <button type="button" class="btn btn-gold" id="btn-gameover-watch-ad">
          <img src="assets/images/ad_video.png" alt="Video"> Watch Ad +100 Coins
        </button>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:4px;">
          <button type="button" class="btn btn-secondary" id="btn-go-home">
            <img src="assets/images/home.png" alt="Home"> HOME
          </button>
          <button type="button" class="btn btn-primary" id="btn-go-retry">
            <img src="assets/images/restart.png" alt="Retry"> RETRY
          </button>
        </div>
      `);

      const adContBtn = document.getElementById('btn-continue-ad');
      if (adContBtn) {
        adContBtn.onclick = () => {
          ADS.showRewarded(
            () => {
              GAME.continueClassicRun();
              this.closeModal();
              this.renderTray();
              this.updateHud();
              this.showToast('Board cleared! Keep going!');
            },
            (msg) => this.showToast(msg)
          );
        };
      }

      document.getElementById('btn-gameover-watch-ad').onclick = () => this.triggerWatchAdFor100Coins();

      const coinContBtn = document.getElementById('btn-continue-coins');
      if (coinContBtn) {
        coinContBtn.onclick = () => {
          this.showConfirmActionModal(
            'Continue?',
            `Spend ${continueCoinCost} Coins?`,
            () => {
              if (!STORAGE.spendCoins(continueCoinCost)) {
                this.showToast('Not enough coins!');
                return;
              }
              GAME.continueClassicRun();
              this.updateTopBar();
              this.closeModal();
              this.renderTray();
              this.updateHud();
              this.showToast('Board cleared! Keep going!');
            }
          );
        };
      }

      document.getElementById('btn-go-retry').onclick = () => {
        const modeId = run.modeId;
        const lvlNum = run.levelConfig ? run.levelConfig.levelNumber : undefined;
        this.closeModal();
        GAME.startNewGame(modeId, { levelNumber: lvlNum });
        this.switchScreen('screen-game');
      };

      document.getElementById('btn-go-home').onclick = () => {
        GAME.stopTimer();
        this.closeModal();
        this.switchScreen('screen-home');
      };
    },

    bindEvents() {
      document.addEventListener('click', (ev) => {
        const target = ev.target instanceof Element ? ev.target : null;
        if (target && target.closest('button, [role="button"]')) {
          AUDIO.play('tap');
        }
      }, true);
      window.addEventListener('pointermove', (ev) => {
        if (this.rocketLaunch) {
          this.updateRocketLaunchAim(ev.clientX, ev.clientY);
        } else if (this.dragState) {
          const dist = Math.hypot(ev.clientX - this.dragState.startX, ev.clientY - this.dragState.startY);
          if (dist > 5) this.dragState.moved = true;
          this.updateDragGhostPosition(ev.clientX, ev.clientY);
        } else if (this.canvas && ev.target === this.canvas) {
          this.handleBoardTapOrMove(ev, false);
        }
      });

      window.addEventListener('pointerup', (ev) => {
        if (this.dragState) {
          this.finishPieceDrag(ev);
        } else if (this.rocketLaunch) {
          this.finishRocketLaunch(ev.clientX, ev.clientY);
        }
      });

      if (this.canvas) {
        this.canvas.addEventListener('pointerdown', (ev) => {
          this.handleBoardTapOrMove(ev, true);
        });
      }

      const bindClick = (id, fn) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', fn);
      };

      bindClick('coin-pill-btn', () => this.showShopModal('powerups'));
      bindClick('btn-top-home', () => {
        GAME.stopTimer();
        this.closeModal();
        this.switchScreen('screen-home');
      });
      bindClick('btn-top-sound', () => {
        STORAGE.state.settings.soundEnabled = !STORAGE.state.settings.soundEnabled;
        STORAGE.save();
        this.applySettingsAndTheme();
      });
      bindClick('btn-top-pause', () => this.showPauseModal());
      bindClick('btn-top-settings', () => this.showSettingsModal());
      bindClick('btn-modal-close', () => this.handleModalCloseButton());

      bindClick('btn-play-classic', () => {
        GAME.startNewGame('classic');
        this.switchScreen('screen-game');
      });
      bindClick('btn-play-levels', () => this.showLevelSelectModal());
      bindClick('btn-play-modes', () => this.showModesModal());
      bindClick('btn-watch-ad-100', () => this.triggerWatchAdFor100Coins());
      bindClick('btn-home-watch-ad', () => this.triggerWatchAdFor100Coins());

      bindClick('tile-daily', () => this.showDailyRewardModal());
      bindClick('tile-spinner', () => this.showSpinnerModal());
      bindClick('tile-tasks', () => this.showTasksModal());
      bindClick('tile-shop', () => this.showShopModal('powerups'));
      bindClick('tile-achievements', () => this.showAchievementsModal());
      bindClick('tile-help', () => this.showHelpModal());

      bindClick('pw-btn-rocket', () => this.handlePowerupButtonClick('rocket'));
      bindClick('pw-btn-hammer', () => this.handlePowerupButtonClick('hammer'));
      bindClick('pw-btn-bomb_basic', () => this.handlePowerupButtonClick('bomb_basic'));
      bindClick('pw-btn-bomb_mega', () => this.handlePowerupButtonClick('bomb_mega'));
      bindClick('pw-btn-rotate', () => this.handlePowerupButtonClick('rotate'));
    }
  };

  global.BBU_UI = UIManager;
})(typeof window !== 'undefined' ? window : globalThis);
