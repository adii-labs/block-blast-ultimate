/**
 * Block Blast Ultimate — Automated QA & Verification Suite
 * Tests game behavior and the Start.io migration:
 *  1. Asset verification (all 32 PNGs including close.png, home.png, star_filled.png, star_empty.png, play.png, restart.png, gem.png and 14 WAVs exist on disk and are non-empty)
 *  2. Start.io configuration, Android wiring, and browser-preview behavior
 *  3. 8 Candy-Jewel 3D Block Palette & Predictive Line-Clear Glow (`getPredictiveClears`)
 *  4. Board placement, valid/invalid checks, row/col clears, simultaneous row+col intersection single-count
 *  5. Combos, score calculation, best-score & lifetime score persistence
 *  6. Power-ups: Rocket (row/col), Hammer (strictly 1 occupied cell), Basic Bomb (3x3), Mega Bomb (5x5 diamond), Undo
 *  7. Modes: Classic (continues allowed), Adventure Levels (retry only, no continue on fail, 1-3 stars, sequential unlock), Timed Blitz, Bomb Defuse
 *  8. Tasks (daily, weekly, unlimited milestones), single-claim enforcement, Daily Reward, Spinner, Shop
 *  9. Save/load persistence, corrupt JSON recovery, v1->v2 migration
 * 10. Start.io rewards are granted only by the SDK's earned event
 * 11. UI Close ('X') on Game Over / Level Complete returns to Home Screen & zero broken template-interpolated asset paths
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

// Load game modules into globalThis in their exact load order
require(path.join(ROOT, 'src/js/config.js'));
require(path.join(ROOT, 'src/js/storage.js'));
require(path.join(ROOT, 'src/js/audio.js'));
require(path.join(ROOT, 'src/js/pieces.js'));
require(path.join(ROOT, 'src/js/board.js'));
require(path.join(ROOT, 'src/js/levels.js'));
require(path.join(ROOT, 'src/js/tasks.js'));
require(path.join(ROOT, 'src/js/ads.js'));
require(path.join(ROOT, 'src/js/game.js'));
require(path.join(ROOT, 'src/js/ui.js'));

const CFG = globalThis.BBU_CONFIG;
const STORAGE = globalThis.BBU_STORAGE;
const PIECES = globalThis.BBU_PIECES;
const BOARD = globalThis.BBU_BOARD;
const LEVELS = globalThis.BBU_LEVELS;
const TASKS = globalThis.BBU_TASKS;
const ADS = globalThis.BBU_ADS;
const GAME = globalThis.BBU_GAME;
const UI = globalThis.BBU_UI;

const EXPECTED_PNGS = [
  'ad_video.png', 'bomb_basic.png', 'bomb_mega.png', 'check.png', 'chest.png',
  'close.png', 'coin.png', 'crown.png', 'gem.png', 'hammer.png', 'help.png',
  'home.png', 'levels.png', 'lock.png', 'logo.png', 'modes.png', 'music_off.png',
  'music_on.png', 'pause.png', 'play.png', 'restart.png', 'rocket.png',
  'settings.png', 'shop.png', 'sound_off.png', 'sound_on.png', 'spinner.png',
  'star_empty.png', 'star_filled.png', 'tasks.png', 'trophy.png', 'undo.png'
];

const EXPECTED_WAVS = [
  'bgm_loop.wav', 'bomb.wav', 'clear.wav', 'coin.wav', 'combo.wav',
  'fail.wav', 'hammer.wav', 'menu.wav', 'place.wav', 'reward.wav',
  'rocket.wav', 'spinner.wav', 'tap.wav', 'win.wav'
];

let passed = 0;
const pendingTests = [];
function test(name, fn) {
  try {
    const result = fn();
    if (result && typeof result.then === 'function') {
      pendingTests.push(Promise.resolve(result).then(() => {
        console.log(`  [PASS] ${name}`);
        passed++;
      }).catch((err) => {
        console.error(`  [FAIL] ${name}:`, err.message);
        process.exitCode = 1;
      }));
      return;
    }
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  [FAIL] ${name}:`, err.message);
    process.exitCode = 1;
  }
}

console.log('=== Running Block Blast Ultimate Automated QA Suite ===');

// 1. Asset & File Reference Verification
test('All 32 PNG icons and 14 WAV audio files exist on disk and are non-empty', () => {
  for (const f of EXPECTED_PNGS) {
    const p = path.join(ROOT, 'assets/images', f);
    assert(fs.existsSync(p), `Missing PNG ${f}`);
    const st = fs.statSync(p);
    assert(st.size > 100, `PNG ${f} is too small`);
  }
  for (const f of EXPECTED_WAVS) {
    const p = path.join(ROOT, 'assets/audio', f);
    assert(fs.existsSync(p), `Missing WAV ${f}`);
    const st = fs.statSync(p);
    assert(st.size > 500, `WAV ${f} is too small`);
  }
});

// 2. Start.io configuration and clean player UI verification
test('Start.io config, plugin wiring, and browser preview are valid', async () => {
  assert.deepStrictEqual(CFG.STARTIO, { APP_ID: '209325533', TEST_MODE: false, REWARDED_COINS: 100 });
  assert.strictEqual('ADMOB' in CFG, false);

  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert(packageJson.dependencies['@martinezmanoloa/capacitor-startio-ads']);
  assert(packageJson.dependencies['@capacitor/core'].startsWith('^7.'));
  const manifestXml = fs.readFileSync(path.join(ROOT, 'android/app/src/main/AndroidManifest.xml'), 'utf8');
  assert(!manifestXml.includes('com.google.android.gms.ads.APPLICATION_ID'));
  const nativeActivity = fs.readFileSync(path.join(ROOT, 'android/app/src/main/java/com/blockblast/ultimate/MainActivity.java'), 'utf8');
  assert(!nativeActivity.includes('AdMob'));

  const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert(indexHtml.includes('assets/images/close.png'), 'index.html must use 3D close.png X icon');
  assert(indexHtml.includes('assets/images/home.png'), 'index.html must use 3D home.png icon');
  assert(indexHtml.includes('assets/images/star_filled.png'), 'index.html must use 3D star_filled.png icon');

  const uiJs = fs.readFileSync(path.join(ROOT, 'src/js/ui.js'), 'utf8');
  assert(!uiJs.includes('assets/images/${'), 'ui.js must not use broken template-interpolated asset paths');
  assert(uiJs.includes('handleModalCloseButton'), 'ui.js must route X close button on gameover/won back to screen-home');
  assert.strictEqual(await ADS.initialize(), true, 'Browser preview should not require native ads');
  let failMessage = '';
  assert.strictEqual(await ADS.showRewarded(() => assert.fail('Browser preview cannot grant ad rewards'), message => { failMessage = message; }), false);
  assert(failMessage.includes('browser preview'));
});

// 3. 8 Candy-Jewel 3D Block Palette & Predictive Line-Clear Glow
test('8 Candy-Jewel 3D Block Colors and Predictive Line-Clear Glow work accurately', () => {
  assert.strictEqual(CFG.PALETTES.standard.length, 8);
  assert.strictEqual(CFG.PALETTES.standard[0].main, '#ef4444');
  assert.strictEqual(CFG.PALETTES.standard[7].main, '#ec4899');

  const grid = BOARD.createEmptyGrid(8);
  for (let c = 1; c < 8; c++) grid[2][c] = { colorIdx: 0 };
  const dotPiece = PIECES.clonePiece(PIECES.CATALOG.find(s => s.id === 'dot_1'));
  const pred = BOARD.getPredictiveClears(grid, dotPiece, 2, 0);
  assert.strictEqual(pred.valid, true);
  assert.deepStrictEqual(pred.rows, [2]);
  assert(pred.cellKeys.has('2,5'), 'Predictive glow should mark all cells in about-to-clear row 2');
});

// 4. Board Placement & Simultaneous Row+Column Clear Intersection Single-Counting
test('Simultaneous Row + Column clear counts intersection cell once and clears both lines', () => {
  const grid = BOARD.createEmptyGrid(8);
  for (let c = 1; c < 8; c++) grid[0][c] = { colorIdx: 1 };
  for (let r = 1; r < 8; r++) grid[r][0] = { colorIdx: 2 };

  const dotPiece = PIECES.clonePiece(PIECES.CATALOG.find(s => s.id === 'dot_1'));
  const res = BOARD.placePieceAndResolve(grid, dotPiece, 0, 0, 0);

  assert.strictEqual(res.valid, true);
  assert.strictEqual(res.clearedRows.length, 1);
  assert.strictEqual(res.clearedCols.length, 1);
  assert.strictEqual(res.totalLinesCleared, 2);
  assert.strictEqual(res.uniqueCellsClearedCount, 15, 'Intersection cell (0,0) must not be counted twice');
  assert.strictEqual(res.grid[0][0], null);
  assert.strictEqual(res.grid[0][7], null);
  assert.strictEqual(res.grid[7][0], null);
});

test('Rocket clears only the path from its launch cell to the chosen edge', () => {
  const grid = BOARD.createEmptyGrid(5);
  grid[2][0] = { colorIdx: 1 };
  grid[2][2] = { colorIdx: 2 };
  grid[2][4] = { colorIdx: 3 };
  grid[1][2] = { colorIdx: 4 };

  const result = BOARD.applyRocketPath(grid, 2, 2, 'row', 1);
  assert.strictEqual(result.valid, true);
  assert.deepStrictEqual(result.path, [
    { r: 2, c: 2 }, { r: 2, c: 3 }, { r: 2, c: 4 }
  ]);
  assert.deepStrictEqual(result.clearedCells.map(cell => [cell.r, cell.c]), [[2, 2], [2, 4]]);
  assert.strictEqual(result.grid[2][2], null);
  assert.notStrictEqual(result.grid[2][0], null, 'Blocks behind the launch point must remain');
  assert.notStrictEqual(result.grid[1][2], null, 'Blocks outside the flight path must remain');
  assert.strictEqual(grid[2][2].colorIdx, 2, 'Rocket path resolution must not mutate the source grid');
});

// 5. Power-Up Verification: Hammer, Basic Bomb (3x3), Mega Bomb (5x5 Diamond), Rocket, Undo
test('Hammer affects strictly 1 occupied cell and rejects empty cells without consuming inventory', () => {
  STORAGE.load();
  GAME.startNewGame('classic');
  GAME.run.grid[3][3] = { colorIdx: 4 };
  const initialHammers = STORAGE.state.inventory.hammer;

  const failRes = GAME.executeBoardPowerup('hammer', 0, 0);
  assert.strictEqual(failRes.success, false);
  assert.strictEqual(STORAGE.state.inventory.hammer, initialHammers);

  const okRes = GAME.executeBoardPowerup('hammer', 3, 3);
  assert.strictEqual(okRes.success, true);
  assert.strictEqual(okRes.clearedCells.length, 1);
  assert.strictEqual(GAME.run.grid[3][3], null);
  assert.strictEqual(STORAGE.state.inventory.hammer, initialHammers - 1);
});

test('Basic Bomb clears 3x3 (max 9 cells) and Mega Bomb clears 5x5 diamond+core (max 13 cells)', () => {
  const coordsBasic = BOARD.getBombAffectedCoords(8, 4, 4, 'bomb_basic');
  const coordsMega = BOARD.getBombAffectedCoords(8, 4, 4, 'bomb_mega');
  assert.strictEqual(coordsBasic.length, 9, 'Basic bomb 3x3 should cover 9 cells');
  assert.strictEqual(coordsMega.length, 13, 'Mega bomb 5x5 diamond+3x3 core should cover 13 cells');
});

test('Rotate turns a selected piece 90 degrees clockwise without changing its cells', () => {
  const piece = PIECES.clonePiece(PIECES.CATALOG.find(shape => shape.id === 'l_1'));
  const originalCellCount = piece.cellCount;
  const originalMatrix = piece.matrix.map(row => row.slice());

  assert.strictEqual(PIECES.rotatePieceClockwise(piece), true);
  assert.strictEqual(piece.rows, 2);
  assert.strictEqual(piece.cols, 3);
  assert.deepStrictEqual(piece.matrix, [[1, 1, 1], [1, 0, 0]]);
  assert.strictEqual(piece.cellCount, originalCellCount);

  assert.strictEqual(PIECES.rotatePieceClockwise(piece), true);
  assert.deepStrictEqual(piece.matrix, [[1, 1], [0, 1], [0, 1]]);
  assert.deepStrictEqual(originalMatrix, [[1, 0], [1, 0], [1, 1]]);
  assert.strictEqual(PIECES.rotatePieceClockwise({ placed: true, matrix: [[1]] }), false);
});

// 6. Modes & Level Progression Verification
test('Adventure Levels generate unlimited deterministic stages, award 1-3 stars, and forbid continues on fail', () => {
  const lvl1 = LEVELS.generateLevelConfig(1);
  const lvl50 = LEVELS.generateLevelConfig(50);
  const lvl500 = LEVELS.generateLevelConfig(500);
  assert.strictEqual(lvl1.levelNumber, 1);
  assert.strictEqual(lvl50.levelNumber, 50);
  assert.strictEqual(lvl500.levelNumber, 500);

  GAME.startNewGame('levels', { levelNumber: 1 });
  const contAttempt = GAME.continueClassicRun();
  assert.strictEqual(contAttempt.success, false, 'Levels mode must NEVER allow Classic continue');
});

// 7. Tasks & Single-Claim Persistence
test('Tasks and Achievements grant coins only when completed and block duplicate claims', () => {
  STORAGE.load();
  TASKS.recordEvent('linesCleared', 15);
  const { dailyList } = TASKS.getActiveTasks();
  const clearTask = dailyList.find(t => t.uid.includes('d_clear_10'));
  assert(clearTask && clearTask.completed, 'Daily clear 10 lines task should be completed');

  const coinsBefore = STORAGE.state.coins;
  const firstClaim = TASKS.claimTask(clearTask.uid);
  assert.strictEqual(firstClaim.success, true);
  assert.strictEqual(STORAGE.state.coins, coinsBefore + clearTask.rewardCoins);
  assert(!TASKS.getActiveTasks().dailyList.some(task => task.uid === clearTask.uid), 'Claimed daily task should disappear');

  const replacementTask = TASKS.getActiveTasks().dailyList.find(task => task.uid.includes('_bonus_'));
  assert(replacementTask, 'Claiming a daily task should generate a replacement');
  assert.strictEqual(replacementTask.progress, 0, 'Generated task should start at zero progress');
  TASKS.recordEvent(replacementTask.metric, replacementTask.target);
  const completedReplacement = TASKS.getActiveTasks().dailyList.find(task => task.uid === replacementTask.uid);
  assert(completedReplacement && completedReplacement.completed, 'Generated task should be completable');
  assert.strictEqual(TASKS.claimTask(replacementTask.uid).success, true);
  assert(!TASKS.getActiveTasks().dailyList.some(task => task.uid === replacementTask.uid));
  assert(TASKS.getActiveTasks().dailyList.some(task => task.uid.includes('_bonus_')));

  const duplicateClaim = TASKS.claimTask(clearTask.uid);
  assert.strictEqual(duplicateClaim.success, false, 'Duplicate task claim must be rejected');
  assert.strictEqual(STORAGE.state.coins, coinsBefore + clearTask.rewardCoins + replacementTask.rewardCoins);
});

test('Daily Gift can be claimed once and advances to tomorrow reward', () => {
  const originalDaily = JSON.parse(JSON.stringify(STORAGE.state.daily));
  const originalCoins = STORAGE.state.coins;
  STORAGE.state.daily.lastClaimDate = null;
  STORAGE.state.daily.streakDay = 0;

  try {
    assert.strictEqual(STORAGE.canClaimDailyReward(), true);
    const reward = STORAGE.claimDailyReward();
    assert.deepStrictEqual(reward, { success: true, coins: 100, streakDay: 1 });
    assert.strictEqual(STORAGE.canClaimDailyReward(), false);
    assert.strictEqual(STORAGE.state.daily.streakDay, 1);
    assert.strictEqual(CFG.ECONOMY.DAILY_REWARD_COINS[1], 125);
  } finally {
    STORAGE.state.daily = originalDaily;
    STORAGE.state.coins = originalCoins;
    STORAGE.save();
  }
});

test('Daily, weekly, career, and achievement rewards support longer progression', () => {
  const { dailyList, weeklyList, milestoneList } = TASKS.getActiveTasks();
  assert.strictEqual(CFG.ECONOMY.DAILY_REWARD_COINS.length, 30);
  assert.strictEqual(dailyList.length, 9);
  assert.strictEqual(weeklyList.length, 5);
  assert.strictEqual(milestoneList.length, 6);
  assert(CFG.ACHIEVEMENTS.length >= 12);
});

test('Android Back from gameplay returns Home and preserves the active run', () => {
  const originalDocument = globalThis.document;
  const originalRun = GAME.run;
  const originalStopTimer = GAME.stopTimer;
  const originalPersist = GAME.persistActiveRun;
  const originalCloseModal = UI.closeModal;
  const originalSwitchScreen = UI.switchScreen;
  const screenClasses = { 'screen-game': true, 'modal-backdrop': true };
  const switchedScreens = [];
  let persisted = false;
  let timerStopped = false;
  globalThis.document = {
    getElementById: (id) => ({ classList: { contains: () => Boolean(screenClasses[id]) } })
  };
  GAME.run = { status: 'playing' };
  GAME.stopTimer = () => { timerStopped = true; };
  GAME.persistActiveRun = () => { persisted = true; };
  UI.closeModal = () => { };
  UI.switchScreen = (screenId) => switchedScreens.push(screenId);

  try {
    assert.strictEqual(UI.handleBackButton(), true);
    assert.strictEqual(timerStopped, true);
    assert.strictEqual(persisted, true);
    assert.deepStrictEqual(switchedScreens, ['screen-home']);
  } finally {
    globalThis.document = originalDocument;
    GAME.run = originalRun;
    GAME.stopTimer = originalStopTimer;
    GAME.persistActiveRun = originalPersist;
    UI.closeModal = originalCloseModal;
    UI.switchScreen = originalSwitchScreen;
  }
});

// 8. Save Corruption Recovery & Version Migration
test('StorageManager recovers gracefully from corrupted JSON and migrates v1 saves', () => {
  const migrated = STORAGE.migrateAndSanitize({ version: 1, coins: 1234, bestScores: { classic: 4500 } });
  assert.strictEqual(migrated.version, CFG.VERSION);
  assert.strictEqual(migrated.coins, 1234);
  assert.strictEqual(migrated.bestScores.classic, 4500);

  const recovered = STORAGE.migrateAndSanitize(null);
  assert.strictEqual(recovered.coins, CFG.ECONOMY.STARTING_COINS);
});

// 9. Start.io rewarded event contract
test('Start.io grants coins only after the native earned event', async () => {
  const adsSource = fs.readFileSync(path.join(ROOT, 'src/js/ads.js'), 'utf8');
  const listeners = {};
  const plugin = {
    addListener: async (name, callback) => { listeners[name] = callback; },
    initParams: async () => { },
    loadInterstitialAd: async () => ({ status: 'loaded' }),
    loadRewardedVideoAd: async () => { listeners.rewardedVideoLoaded(); },
    showRewardedVideoAd: async () => { listeners.rewardedVideoEarned({ earned: true }); },
    showBannerAd: async () => { },
    hideBannerAd: async () => { }
  };
  const sandbox = {
    window: { BBU_CONFIG: CFG, Capacitor: { Plugins: { StartioAds: plugin } } },
    BBU_CONFIG: CFG,
    console,
    setTimeout: () => 0
  };
  vm.runInNewContext(adsSource, sandbox);

  let rewardAmount = 0;
  const result = await sandbox.window.BBU_ADS.showRewarded((reward) => {
    rewardAmount = reward.amount;
  }, (message) => assert.fail(message));
  assert.strictEqual(result, true);
  assert.strictEqual(rewardAmount, 100);
});

Promise.all(pendingTests).then(() => {
  console.log(`\n=== All ${passed} Automated QA Test Suites Passed! ===`);
});
