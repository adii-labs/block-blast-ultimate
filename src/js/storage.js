/**
 * Block Blast Ultimate — Versioned Local Persistence & Migration Module
 * Handles safe load, validation, schema migration, corruption recovery, and daily date checks.
 */
(function (global) {
  'use strict';

  const CFG = global.BBU_CONFIG;

  function getLocalDateKey(dateObj) {
    const d = dateObj || new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function getLocalWeekKey(dateObj) {
    const d = new Date((dateObj || new Date()).getTime());
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const week1 = new Date(d.getFullYear(), 0, 4);
    const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
    return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
  }

  function createDefaultState() {
    return {
      version: CFG.VERSION,
      coins: CFG.ECONOMY.STARTING_COINS,
      lifetimeScore: 0,
      bestScores: {
        classic: 0,
        timed: 0,
        bomb: 0,
        levels: 0
      },
      stats: {
        totalLinesCleared: 0,
        maxComboReached: 0,
        bestScoreClassic: 0,
        levelsCompleted: 0,
        powerupsUsed: 0,
        gamesPlayed: 0,
        totalBlocksPlaced: 0
      },
      inventory: {
        rocket: CFG.POWERUPS.rocket.startingCount,
        hammer: CFG.POWERUPS.hammer.startingCount,
        bomb_basic: CFG.POWERUPS.bomb_basic.startingCount,
        bomb_mega: CFG.POWERUPS.bomb_mega.startingCount,
        undo: CFG.POWERUPS.undo.startingCount
      },
      levels: {
        unlockedLevel: 1,
        starsByLevel: {} // { "1": 3, "2": 2 }
      },
      shop: {
        ownedThemes: ['theme_midnight', 'theme_daylight'],
        ownedSkins: ['skin_glossy'],
        ownedEffects: ['fx_sparks'],
        equippedTheme: 'theme_midnight',
        equippedSkin: 'skin_glossy',
        equippedEffect: 'fx_sparks'
      },
      daily: {
        lastClaimDate: null,
        streakDay: 0,
        lastFreeSpinDate: null,
        lastKnownTimestamp: Date.now()
      },
      tasks: {
        dailyDateKey: null,
        weeklyKey: null,
        dailyProgress: {},
        weeklyProgress: {},
        claimedTaskIds: {},
        milestoneTierByTemplate: {}
      },
      achievements: {
        claimed: {}
      },
      consent: {
        decided: false,
        personalizedAds: true,
        useTestIds: CFG.ADMOB.USE_GOOGLE_TEST_IDS,
        devSimulatorMode: 'success' // 'success' | 'no_fill' | 'early_close'
      },
      settings: {
        soundEnabled: true,
        musicEnabled: false,
        sfxVolume: 0.85,
        musicVolume: 0.45,
        hapticsEnabled: true,
        hapticsIntensity: 'medium', // 'light' | 'medium' | 'strong'
        textScale: 'normal',        // 'normal' | 'large'
        colorblindMode: false,
        reducedMotion: false
      },
      activeRun: null,
      grantedAdTransactionIds: []
    };
  }

  function migrateAndSanitize(raw) {
    const def = createDefaultState();
    if (!raw || typeof raw !== 'object') {
      return def;
    }

    const out = Object.assign({}, def);
    out.version = CFG.VERSION;
    out.coins = Number.isFinite(raw.coins) && raw.coins >= 0 ? Math.floor(raw.coins) : def.coins;
    out.lifetimeScore = Number.isFinite(raw.lifetimeScore) && raw.lifetimeScore >= 0 ? Math.floor(raw.lifetimeScore) : 0;

    if (raw.bestScores && typeof raw.bestScores === 'object') {
      for (const k of Object.keys(def.bestScores)) {
        const v = Number(raw.bestScores[k]);
        out.bestScores[k] = Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
      }
    }

    if (raw.stats && typeof raw.stats === 'object') {
      for (const k of Object.keys(def.stats)) {
        const v = Number(raw.stats[k]);
        out.stats[k] = Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
      }
    }

    if (raw.inventory && typeof raw.inventory === 'object') {
      for (const k of Object.keys(def.inventory)) {
        const v = Number(raw.inventory[k]);
        out.inventory[k] = Number.isFinite(v) && v >= 0 ? Math.floor(v) : def.inventory[k];
      }
    }

    if (raw.levels && typeof raw.levels === 'object') {
      const ul = Number(raw.levels.unlockedLevel);
      out.levels.unlockedLevel = Number.isFinite(ul) && ul >= 1 ? Math.floor(ul) : 1;
      if (raw.levels.starsByLevel && typeof raw.levels.starsByLevel === 'object') {
        out.levels.starsByLevel = {};
        for (const [lvl, stars] of Object.entries(raw.levels.starsByLevel)) {
          const s = Number(stars);
          if (Number.isFinite(s) && s >= 1 && s <= 3) {
            out.levels.starsByLevel[lvl] = Math.floor(s);
          }
        }
      }
    }

    if (raw.shop && typeof raw.shop === 'object') {
      out.shop.ownedThemes = Array.isArray(raw.shop.ownedThemes) ? Array.from(new Set([...def.shop.ownedThemes, ...raw.shop.ownedThemes])) : def.shop.ownedThemes;
      out.shop.ownedSkins = Array.isArray(raw.shop.ownedSkins) ? Array.from(new Set([...def.shop.ownedSkins, ...raw.shop.ownedSkins])) : def.shop.ownedSkins;
      out.shop.ownedEffects = Array.isArray(raw.shop.ownedEffects) ? Array.from(new Set([...def.shop.ownedEffects, ...raw.shop.ownedEffects])) : def.shop.ownedEffects;
      out.shop.equippedTheme = out.shop.ownedThemes.includes(raw.shop.equippedTheme) ? raw.shop.equippedTheme : def.shop.equippedTheme;
      out.shop.equippedSkin = out.shop.ownedSkins.includes(raw.shop.equippedSkin) ? raw.shop.equippedSkin : def.shop.equippedSkin;
      out.shop.equippedEffect = out.shop.ownedEffects.includes(raw.shop.equippedEffect) ? raw.shop.equippedEffect : def.shop.equippedEffect;
    }

    if (raw.daily && typeof raw.daily === 'object') {
      out.daily.lastClaimDate = typeof raw.daily.lastClaimDate === 'string' ? raw.daily.lastClaimDate : null;
      out.daily.streakDay = Number.isFinite(raw.daily.streakDay) && raw.daily.streakDay >= 0 ? Math.floor(raw.daily.streakDay) : 0;
      out.daily.lastFreeSpinDate = typeof raw.daily.lastFreeSpinDate === 'string' ? raw.daily.lastFreeSpinDate : null;
      out.daily.lastKnownTimestamp = Number.isFinite(raw.daily.lastKnownTimestamp) ? raw.daily.lastKnownTimestamp : Date.now();
    }

    if (raw.tasks && typeof raw.tasks === 'object') {
      out.tasks.dailyDateKey = typeof raw.tasks.dailyDateKey === 'string' ? raw.tasks.dailyDateKey : null;
      out.tasks.weeklyKey = typeof raw.tasks.weeklyKey === 'string' ? raw.tasks.weeklyKey : null;
      out.tasks.dailyProgress = (raw.tasks.dailyProgress && typeof raw.tasks.dailyProgress === 'object') ? Object.assign({}, raw.tasks.dailyProgress) : {};
      out.tasks.weeklyProgress = (raw.tasks.weeklyProgress && typeof raw.tasks.weeklyProgress === 'object') ? Object.assign({}, raw.tasks.weeklyProgress) : {};
      out.tasks.claimedTaskIds = (raw.tasks.claimedTaskIds && typeof raw.tasks.claimedTaskIds === 'object') ? Object.assign({}, raw.tasks.claimedTaskIds) : {};
      out.tasks.milestoneTierByTemplate = (raw.tasks.milestoneTierByTemplate && typeof raw.tasks.milestoneTierByTemplate === 'object') ? Object.assign({}, raw.tasks.milestoneTierByTemplate) : {};
    }

    if (raw.achievements && typeof raw.achievements === 'object' && raw.achievements.claimed) {
      out.achievements.claimed = Object.assign({}, raw.achievements.claimed);
    }

    if (raw.consent && typeof raw.consent === 'object') {
      out.consent = Object.assign({}, def.consent, raw.consent);
    }

    if (raw.settings && typeof raw.settings === 'object') {
      out.settings = Object.assign({}, def.settings, raw.settings);
    }

    if (raw.activeRun && typeof raw.activeRun === 'object' && Array.isArray(raw.activeRun.grid)) {
      out.activeRun = raw.activeRun;
    }

    if (Array.isArray(raw.grantedAdTransactionIds)) {
      out.grantedAdTransactionIds = raw.grantedAdTransactionIds.slice(-100);
    }

    return out;
  }

  const memoryFallback = {};

  const StorageManager = {
    state: createDefaultState(),

    load() {
      try {
        let rawStr = null;
        if (typeof localStorage !== 'undefined') {
          rawStr = localStorage.getItem(CFG.STORAGE_KEY) || localStorage.getItem('block_blast_ultimate_save_v1');
        } else if (memoryFallback[CFG.STORAGE_KEY]) {
          rawStr = memoryFallback[CFG.STORAGE_KEY];
        }
        if (!rawStr) {
          this.state = createDefaultState();
          this.save();
          return this.state;
        }
        const parsed = JSON.parse(rawStr);
        this.state = migrateAndSanitize(parsed);
        this.save();
        return this.state;
      } catch (err) {
        console.warn('[StorageManager] Recovered from corrupt or inaccessible save data:', err);
        this.state = createDefaultState();
        this.save();
        return this.state;
      }
    },

    save() {
      try {
        this.state.daily.lastKnownTimestamp = Math.max(this.state.daily.lastKnownTimestamp || 0, Date.now());
        const serialized = JSON.stringify(this.state);
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(CFG.STORAGE_KEY, serialized);
        } else {
          memoryFallback[CFG.STORAGE_KEY] = serialized;
        }
        return true;
      } catch (err) {
        console.warn('[StorageManager] Save fallback to memory:', err);
        return false;
      }
    },

    addCoins(amount) {
      const delta = Math.floor(Number(amount) || 0);
      if (delta <= 0) return this.state.coins;
      this.state.coins += delta;
      this.save();
      return this.state.coins;
    },

    spendCoins(amount) {
      const cost = Math.floor(Number(amount) || 0);
      if (cost <= 0) return true;
      if (this.state.coins < cost) return false;
      this.state.coins -= cost;
      this.save();
      return true;
    },

    canClaimDailyReward() {
      const today = getLocalDateKey();
      return this.state.daily.lastClaimDate !== today;
    },

    claimDailyReward() {
      if (!this.canClaimDailyReward()) {
        return { success: false, reason: 'Already claimed today' };
      }
      const today = getLocalDateKey();
      const rewards = CFG.ECONOMY.DAILY_REWARD_COINS;
      const dayIdx = this.state.daily.streakDay % rewards.length;
      const rewardCoins = rewards[dayIdx];
      this.state.daily.lastClaimDate = today;
      this.state.daily.streakDay += 1;
      this.addCoins(rewardCoins);
      return { success: true, coins: rewardCoins, streakDay: this.state.daily.streakDay };
    },

    canUseFreeSpin() {
      const today = getLocalDateKey();
      return this.state.daily.lastFreeSpinDate !== today;
    },

    markFreeSpinUsed() {
      this.state.daily.lastFreeSpinDate = getLocalDateKey();
      this.save();
    },

    getLocalDateKey,
    getLocalWeekKey,
    createDefaultState,
    migrateAndSanitize
  };

  global.BBU_STORAGE = StorageManager;
})(typeof window !== 'undefined' ? window : globalThis);
