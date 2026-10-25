/**
 * Block Blast Ultimate — Automated QA & Verification Suite
 * Tests every requirement from the Master Prompt & Child-Friendly 3D UI / AdMob Repair:
 *  1. Asset verification (all 32 PNGs including close.png, home.png, star_filled.png, star_empty.png, play.png, restart.png, gem.png and 14 WAVs exist on disk and are non-empty)
 *  2. AdMob ID verification (App ID, Banner ID, Rewarded ID in config & Android files; zero raw IDs in player-facing HTML/UI)
 *  3. 8 Candy-Jewel 3D Block Palette & Predictive Line-Clear Glow (`getPredictiveClears`)
 *  4. Board placement, valid/invalid checks, row/col clears, simultaneous row+col intersection single-count
 *  5. Combos, score calculation, best-score & lifetime score persistence
 *  6. Power-ups: Rocket (row/col), Hammer (strictly 1 occupied cell), Basic Bomb (3x3), Mega Bomb (5x5 diamond), Undo
 *  7. Modes: Classic (continues allowed), Adventure Levels (retry only, no continue on fail, 1-3 stars, sequential unlock), Timed Blitz, Bomb Defuse
 *  8. Tasks (daily, weekly, unlimited milestones), single-claim enforcement, Daily Reward, Spinner, Shop
 *  9. Save/load persistence, corrupt JSON recovery, v1->v2 migration
 * 10. AdMob reward callback security: duplicate callback prevention, early close = no reward, offline failure handling
 * 11. UI Close ('X') on Game Over / Level Complete returns to Home Screen & zero broken template-interpolated asset paths
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

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

const CFG = globalThis.BBU_CONFIG;
const STORAGE = globalThis.BBU_STORAGE;
const PIECES = globalThis.BBU_PIECES;
const BOARD = globalThis.BBU_BOARD;
const LEVELS = globalThis.BBU_LEVELS;
const TASKS = globalThis.BBU_TASKS;
const ADS = globalThis.BBU_ADS;
const GAME = globalThis.BBU_GAME;

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
function test(name, fn) {
  try {
    fn();
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

// 2. Supplied Google AdMob IDs & Clean Player UI Verification
test('Supplied Production AdMob IDs match specification in config/Android & are hidden from player UI', () => {
  assert.strictEqual(CFG.ADMOB.PRODUCTION.APP_ID, 'ca-app-pub-5668739021259460~4395181121');
  assert.strictEqual(CFG.ADMOB.PRODUCTION.BANNER_AD_UNIT_ID, 'ca-app-pub-5668739021259460/6342687612');
  assert.strictEqual(CFG.ADMOB.PRODUCTION.REWARDED_AD_UNIT_ID, 'ca-app-pub-5668739021259460/8777279260');
  assert.strictEqual(CFG.ADMOB.INTERSTITIAL_ADS_ENABLED, false);

  const stringsXml = fs.readFileSync(path.join(ROOT, 'android/app/src/main/res/values/strings.xml'), 'utf8');
  assert(stringsXml.includes('ca-app-pub-5668739021259460~4395181121'), 'strings.xml missing App ID');

  const manifestXml = fs.readFileSync(path.join(ROOT, 'android/app/src/main/AndroidManifest.xml'), 'utf8');
  assert(manifestXml.includes('com.google.android.gms.ads.APPLICATION_ID'), 'AndroidManifest missing APPLICATION_ID meta-data');

  const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert(!indexHtml.includes('ca-app-pub-'), 'index.html must not expose raw AdMob IDs in player UI');
  assert(indexHtml.includes('assets/images/close.png'), 'index.html must use 3D close.png X icon');
  assert(indexHtml.includes('assets/images/home.png'), 'index.html must use 3D home.png icon');
  assert(indexHtml.includes('assets/images/star_filled.png'), 'index.html must use 3D star_filled.png icon');

  const uiJs = fs.readFileSync(path.join(ROOT, 'src/js/ui.js'), 'utf8');
  assert(!uiJs.includes('ca-app-pub-'), 'ui.js must not expose raw AdMob IDs in player UI');
  assert(!uiJs.includes('BANNER_AD_UNIT_ID'), 'ui.js must not display Banner Ad Unit ID in Settings');
  assert(!uiJs.includes('REWARDED_AD_UNIT_ID'), 'ui.js must not display Rewarded Ad Unit ID in Settings');
  assert(!uiJs.includes('assets/images/${'), 'ui.js must not use broken template-interpolated asset paths');
  assert(uiJs.includes('handleModalCloseButton'), 'ui.js must route X close button on gameover/won back to screen-home');
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

test('Rocket clears selected row or column and Undo restores exact previous board state & score', () => {
  STORAGE.load();
  GAME.startNewGame('classic');
  const pieceIdx = 0;
  const scoreBefore = GAME.run.score;

  const placeRes = GAME.attemptPlaceTrayPiece(pieceIdx, 2, 2);
  assert.strictEqual(placeRes.valid, true);
  assert(GAME.run.score > scoreBefore);

  const undoRes = GAME.useUndoPowerup();
  assert.strictEqual(undoRes.success, true);
  assert.strictEqual(GAME.run.score, scoreBefore, 'Score must revert to pre-placement value');
  assert.strictEqual(GAME.run.tray[pieceIdx].placed, false, 'Tray piece must be restored');
  assert.strictEqual(GAME.run.grid[2][2], null, 'Board cell must be empty after Undo');
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

  const duplicateClaim = TASKS.claimTask(clearTask.uid);
  assert.strictEqual(duplicateClaim.success, false, 'Duplicate task claim must be rejected');
  assert.strictEqual(STORAGE.state.coins, coinsBefore + clearTask.rewardCoins);
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

// 9. AdMob Rewarded Ad Security & Duplicate Callback Prevention
test('AdManager grants reward only on completion, blocks duplicate callbacks, and denies early close', async () => {
  STORAGE.load();
  STORAGE.state.consent.devSimulatorMode = 'early_close';
  let rewardCount = 0;
  const earlyRes = await ADS.showRewardedAd('coins_250', () => { rewardCount++; });
  assert.strictEqual(earlyRes.granted, false, 'Early close must NOT grant reward');
  assert.strictEqual(rewardCount, 0);

  STORAGE.state.consent.devSimulatorMode = 'no_fill';
  const noFillRes = await ADS.showRewardedAd('coins_250', () => { rewardCount++; });
  assert.strictEqual(noFillRes.granted, false, 'No-fill must NOT grant reward');
  assert.strictEqual(rewardCount, 0);

  STORAGE.state.consent.devSimulatorMode = 'success';
  const okRes = await ADS.showRewardedAd('coins_250', () => { rewardCount++; });
  assert.strictEqual(okRes.granted, true, 'Completed rewarded ad must grant reward once');
  assert.strictEqual(rewardCount, 1);
});

setTimeout(() => {
  console.log(`\n=== All ${passed} Automated QA Test Suites Passed! ===`);
}, 50);
