/**
 * Block Blast Ultimate — Central Configuration Module
 * Centralizes AdMob IDs, Economy, Power-ups, Modes, Shop, Spinner, Achievements & 8 Candy-Jewel 3D Palettes.
 */
(function (global) {
  'use strict';

  const ADMOB_CONFIG = {
    // Production IDs supplied in the Master Prompt:
    PRODUCTION: {
      APP_ID: 'ca-app-pub-5668739021259460~4395181121',
      BANNER_AD_UNIT_ID: 'ca-app-pub-5668739021259460/6342687612',
      REWARDED_AD_UNIT_ID: 'ca-app-pub-5668739021259460/8777279260'
    },
    // Official Google Sample Test IDs for safe development/testing:
    GOOGLE_TEST: {
      APP_ID: 'ca-app-pub-3940256099942544~3347511713',
      BANNER_AD_UNIT_ID: 'ca-app-pub-3940256099942544/6300978111',
      REWARDED_AD_UNIT_ID: 'ca-app-pub-3940256099942544/5224354917'
    },
    // Default to false in release so the supplied Production IDs are active.
    // Note: AdMob IDs and SDK details are kept strictly in configuration/code and NEVER shown in player-facing UI.
    USE_GOOGLE_TEST_IDS: true,
    DEV_SIMULATOR_ENABLED: false,
    // Strictly NO interstitial ads anywhere:
    INTERSTITIAL_ADS_ENABLED: false
  };

  const ECONOMY_CONFIG = {
    STARTING_COINS: 500,
    WATCH_AD_COIN_REWARD: 250,
    DAILY_REWARD_COINS: [100, 150, 200, 250, 300, 400, 600],
    SPINNER_COIN_COST: 150,
    CLASSIC_CONTINUE_MAX: 3,
    CLASSIC_CONTINUE_COINS: [200, 350, 500],
    LINE_CLEAR_COIN_BONUS: 5,
    COMBO_COIN_BONUS: 8,
    LEVEL_WIN_BASE_COINS: 60,
    STAR_BONUS_COINS: 25
  };

  const POWERUPS_CONFIG = {
    rocket: {
      id: 'rocket',
      name: 'Rocket',
      fullName: 'Rocket Line Clear',
      icon: 'assets/images/rocket.png',
      svgIcon: 'icon-rocket',
      startingCount: 2,
      coinCost: 180,
      adRefillAmount: 1,
      description: 'Tap any row or column to launch a rocket and blast the whole line!'
    },
    hammer: {
      id: 'hammer',
      name: 'Hammer',
      fullName: 'Magic Hammer',
      icon: 'assets/images/hammer.png',
      svgIcon: 'icon-hammer',
      startingCount: 3,
      coinCost: 140,
      adRefillAmount: 1,
      description: 'Tap any single block on the board to smash it away!'
    },
    bomb_basic: {
      id: 'bomb_basic',
      name: 'Bomb',
      fullName: 'Blast Bomb (3x3)',
      icon: 'assets/images/bomb_basic.png',
      svgIcon: 'icon-bomb',
      startingCount: 2,
      coinCost: 200,
      adRefillAmount: 1,
      radius: 1,
      pattern: 'square3x3',
      description: 'Clears a 3x3 square of blocks around the spot you tap!'
    },
    bomb_mega: {
      id: 'bomb_mega',
      name: 'Mega Bomb',
      fullName: 'Mega Star Bomb',
      icon: 'assets/images/bomb_mega.png',
      svgIcon: 'icon-megabomb',
      startingCount: 1,
      coinCost: 320,
      adRefillAmount: 1,
      radius: 2,
      pattern: 'diamond5x5',
      description: 'Super blast! Clears a huge 5x5 star zone on the board!'
    }
  };

  const MODES_CONFIG = {
    classic: {
      id: 'classic',
      name: 'Classic Mode',
      badge: 'Endless Fun',
      boardSize: 8,
      icon: 'assets/images/crown.png',
      svgIcon: 'icon-crown',
      allowContinues: true,
      description: 'Place colorful toy blocks, clear lines, and beat your best score!'
    },
    levels: {
      id: 'levels',
      name: 'Adventure Levels',
      badge: 'Collect Stars',
      boardSize: 8,
      icon: 'assets/images/levels.png',
      svgIcon: 'icon-star',
      allowContinues: false,
      description: 'Complete fun stage goals to earn 3 shiny stars and unlock new levels!'
    },
    timed: {
      id: 'timed',
      name: 'Timed Blitz',
      badge: '90s Speed Run',
      boardSize: 8,
      timeLimitSeconds: 90,
      lineClearTimeBonus: 4,
      icon: 'assets/images/rocket.png',
      svgIcon: 'icon-rocket',
      allowContinues: false,
      description: 'Score fast in 90 seconds! Every cleared line adds +4 extra seconds!'
    },
    bomb: {
      id: 'bomb',
      name: 'Bomb Defuse',
      badge: '9x9 Rescue',
      boardSize: 9,
      bombSpawnIntervalMoves: 5,
      bombCountdownTurns: 9,
      icon: 'assets/images/bomb_basic.png',
      svgIcon: 'icon-bomb',
      allowContinues: false,
      description: 'Clear the line holding a ticking bomb before its countdown reaches zero!'
    }
  };

  const SPINNER_SLOTS = [
    { id: 'coins_75', label: '75 Coins', type: 'coins', amount: 75, weight: 28, color: '#ef4444', icon: 'assets/images/coin.png' },
    { id: 'hammer_1', label: '1x Hammer', type: 'powerup', item: 'hammer', amount: 1, weight: 18, color: '#a855f7', icon: 'assets/images/hammer.png' },
    { id: 'coins_150', label: '150 Coins', type: 'coins', amount: 150, weight: 22, color: '#eab308', icon: 'assets/images/coin.png' },
    { id: 'rocket_1', label: '1x Rocket', type: 'powerup', item: 'rocket', amount: 1, weight: 14, color: '#3b82f6', icon: 'assets/images/rocket.png' },
    { id: 'bomb_basic_1', label: '1x Bomb', type: 'powerup', item: 'bomb_basic', amount: 1, weight: 10, color: '#f97316', icon: 'assets/images/bomb_basic.png' },
    { id: 'jackpot_400', label: '400 Coins!', type: 'coins', amount: 400, weight: 5, color: '#22c55e', icon: 'assets/images/chest.png' },
    { id: 'bomb_mega_1', label: '1x Mega Bomb', type: 'powerup', item: 'bomb_mega', amount: 1, weight: 3, color: '#ec4899', icon: 'assets/images/bomb_mega.png' }
  ];

  const SHOP_ITEMS = {
    themes: [
      { id: 'theme_midnight', name: 'Royal Starry Blue', price: 0, defaultOwned: true, bgPrimary: '#0f172a', bgSecondary: '#172554', bgTop: '#1e1b4b', boardBg: '#090d1f', cellA: '#131c38', cellB: '#162040', accent: '#38bdf8', backgroundImage: 'assets/images/royal_starry.png', homeClassicGradient: 'linear-gradient(180deg, #4ade80 0%, #22c55e 52%, #15803d 100%)', homeClassicShadow: '#14532d', homeLevelsGradient: 'linear-gradient(180deg, #fb923c 0%, #f97316 52%, #c2410c 100%)', homeLevelsShadow: '#7c2d12', desc: 'Cheerful starry indigo and royal blue toy theme.' },
      { id: 'theme_daylight', name: 'Sunny Sky Cloud', price: 0, defaultOwned: true, bgPrimary: '#eaf5ff', bgSecondary: '#f8fcff', bgTop: '#c9e8ff', boardBg: '#123b5d', cellA: '#194d73', cellB: '#205b82', accent: '#1478c9', backgroundImage: 'assets/images/sunny_sky.png', boardFrameGradient: 'linear-gradient(145deg, #72c6ff 0%, #318ed0 54%, #1765a4 100%)', boardFrameBorder: '#b9e4ff', boardFrameShadow: '#164c76', homeClassicGradient: 'linear-gradient(180deg, #378de0 0%, #176fbd 55%, #105895 100%)', homeClassicShadow: '#0c4c83', homeLevelsGradient: 'linear-gradient(180deg, #ff9b78 0%, #ed654f 55%, #bd4138 100%)', homeLevelsShadow: '#94332f', isLight: true, desc: 'Bright, cheerful sky-blue daylight look.' },
      { id: 'theme_emerald', name: 'Candy Jungle', price: 450, defaultOwned: false, bgPrimary: '#062c24', bgSecondary: '#0d4438', bgTop: '#064e3b', boardBg: '#041e19', cellA: '#0b2e26', cellB: '#0f382e', accent: '#34d399', backgroundImage: 'assets/images/candy_jungle.png', homeClassicGradient: 'linear-gradient(180deg, #2dd4bf 0%, #0d9488 52%, #115e59 100%)', homeClassicShadow: '#134e4a', homeLevelsGradient: 'linear-gradient(180deg, #fb923c 0%, #ea580c 52%, #9a3412 100%)', homeLevelsShadow: '#7c2d12', desc: 'Playful emerald mint and forest tones.' },
      { id: 'theme_sunset', name: 'Berry Dream', price: 650, defaultOwned: false, bgPrimary: '#2a122e', bgSecondary: '#421c46', bgTop: '#4a044e', boardBg: '#1b0b1e', cellA: '#2d1433', cellB: '#36183d', accent: '#f472b6', backgroundImage: 'assets/images/berry_dream.png', homeClassicGradient: 'linear-gradient(180deg, #60a5fa 0%, #2563eb 52%, #1e40af 100%)', homeClassicShadow: '#1e3a8a', homeLevelsGradient: 'linear-gradient(180deg, #fb7185 0%, #e11d48 52%, #9f1239 100%)', homeLevelsShadow: '#881337', desc: 'Sweet berry purple and pink sunset glow.' }
    ],
    skins: [
      { id: 'skin_glossy', name: '3D Toy Bricks', price: 0, defaultOwned: true, style: 'glossy', desc: '3D beveled candy-jewel toy blocks with glossy shine.' },
      { id: 'skin_crystal', name: 'Sparkle Jewels', price: 500, defaultOwned: false, style: 'crystal', desc: 'Faceted gem blocks with inner diamond shine.' },
      { id: 'skin_neon', name: 'Glow Pop Blocks', price: 700, defaultOwned: false, style: 'neon', desc: 'Bright glowing neon outlines with candy centers.' },
      { id: 'skin_wood', name: 'Cozy Toy Cushions', price: 550, defaultOwned: false, style: 'wood', desc: 'Soft rounded blocks with warm stitched inner rims.' }
    ],
    effects: [
      { id: 'fx_sparks', name: 'Candy Pop Sparks', price: 0, defaultOwned: true, desc: 'Colorful radial gravity sparkles on every blast.' },
      { id: 'fx_rings', name: 'Golden Shockwaves', price: 400, defaultOwned: false, desc: 'Expanding golden shockwave rings on every clear.' },
      { id: 'fx_prism', name: 'Rainbow Confetti', price: 600, defaultOwned: false, desc: 'Multi-color party confetti bursts on combos.' }
    ]
  };

  const ACHIEVEMENTS_CONFIG = [
    { id: 'ach_first_clear', title: 'First Blast!', desc: 'Clear your very first row or column.', metric: 'totalLinesCleared', target: 1, rewardCoins: 50 },
    { id: 'ach_lines_50', title: 'Line Champion', desc: 'Clear 50 rows or columns across any mode.', metric: 'totalLinesCleared', target: 50, rewardCoins: 150 },
    { id: 'ach_combo_3', title: 'Combo Star', desc: 'Reach a x3 or higher Combo Streak.', metric: 'maxComboReached', target: 3, rewardCoins: 120 },
    { id: 'ach_score_2000', title: 'Score Hero', desc: 'Score 2,000 points in a Classic game.', metric: 'bestScoreClassic', target: 2000, rewardCoins: 200 },
    { id: 'ach_levels_5', title: 'Adventure Explorer', desc: 'Beat 5 Adventure Levels.', metric: 'levelsCompleted', target: 5, rewardCoins: 180 },
    { id: 'ach_power_5', title: 'Power Blaster', desc: 'Use any power-up 5 times.', metric: 'powerupsUsed', target: 5, rewardCoins: 125 }
  ];

  // 8 Candy-Jewel 3D Block Colors (main, light top-left bevel, dark bottom-right bevel, glow)
  const BLOCK_PALETTES = {
    standard: [
      { name: 'Strawberry Ruby', main: '#ef4444', fill: '#ef4444', light: '#fca5a5', dark: '#991b1b', glow: 'rgba(239,68,68,0.5)' },
      { name: 'Tangerine Pop', main: '#f97316', fill: '#f97316', light: '#fdba74', dark: '#9a3412', glow: 'rgba(249,115,22,0.5)' },
      { name: 'Sunny Lemon', main: '#eab308', fill: '#eab308', light: '#fde047', dark: '#854d0e', glow: 'rgba(234,179,8,0.5)' },
      { name: 'Candy Apple Green', main: '#22c55e', fill: '#22c55e', light: '#86efac', dark: '#166534', glow: 'rgba(34,197,94,0.5)' },
      { name: 'Sky Bubblegum Cyan', main: '#06b6d4', fill: '#06b6d4', light: '#67e8f9', dark: '#155e75', glow: 'rgba(6,182,212,0.5)' },
      { name: 'Blueberry Splash', main: '#3b82f6', fill: '#3b82f6', light: '#93c5fd', dark: '#1e40af', glow: 'rgba(59,130,246,0.5)' },
      { name: 'Grape Jelly Purple', main: '#a855f7', fill: '#a855f7', light: '#d8b4fe', dark: '#6b21a8', glow: 'rgba(168,85,247,0.5)' },
      { name: 'Cotton Candy Pink', main: '#ec4899', fill: '#ec4899', light: '#f9a8d4', dark: '#9d174d', glow: 'rgba(236,72,153,0.5)' }
    ],
    colorblind: [
      // Okabe-Ito high-contrast accessible 3D palette
      { name: 'Amber Gold', main: '#E69F00', fill: '#E69F00', light: '#FDE047', dark: '#92400E', glow: 'rgba(230,159,0,0.5)' },
      { name: 'Sky Azure', main: '#56B4E9', fill: '#56B4E9', light: '#BAE6FD', dark: '#075985', glow: 'rgba(86,180,233,0.5)' },
      { name: 'Jade Teal', main: '#009E73', fill: '#009E73', light: '#6EE7B7', dark: '#065F46', glow: 'rgba(0,158,115,0.5)' },
      { name: 'Bright Lemon', main: '#F0E442', fill: '#F0E442', light: '#FEF9C3', dark: '#854D0E', glow: 'rgba(240,228,66,0.5)' },
      { name: 'Deep Cobalt', main: '#0072B2', fill: '#0072B2', light: '#93C5FD', dark: '#1E3A8A', glow: 'rgba(0,114,178,0.5)' },
      { name: 'Coral Vermilion', main: '#D55E00', fill: '#D55E00', light: '#FDBA74', dark: '#7C2D12', glow: 'rgba(213,94,0,0.5)' },
      { name: 'Orchid Rose', main: '#CC79A7', fill: '#CC79A7', light: '#F9A8D4', dark: '#831843', glow: 'rgba(204,121,167,0.5)' },
      { name: 'Silver Pearl', main: '#94A3B8', fill: '#94A3B8', light: '#E2E8F0', dark: '#334155', glow: 'rgba(148,163,184,0.5)' }
    ]
  };

  const PRAISE_WORDS = [
    'NICE!',
    'GREAT!',
    'SUPER!',
    'AWESOME!',
    'SUPER BLAST!',
    'AMAZING!'
  ];

  global.BBU_CONFIG = {
    VERSION: 1,
    STORAGE_KEY: 'block_blast_ultimate_save_v1',
    ADMOB: ADMOB_CONFIG,
    ECONOMY: ECONOMY_CONFIG,
    POWERUPS: POWERUPS_CONFIG,
    MODES: MODES_CONFIG,
    SPINNER_SLOTS: SPINNER_SLOTS,
    SHOP_ITEMS: SHOP_ITEMS,
    ACHIEVEMENTS: ACHIEVEMENTS_CONFIG,
    PALETTES: BLOCK_PALETTES,
    PRAISE_WORDS: PRAISE_WORDS
  };
})(typeof window !== 'undefined' ? window : globalThis);
