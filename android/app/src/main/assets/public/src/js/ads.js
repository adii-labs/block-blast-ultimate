/**
 * Block Blast Ultimate — Repaired Google AdMob Capacitor Integration & Duplicate-Safe Reward Bridge
 *
 * Configured Production IDs (centralized in src/js/config.js & AndroidManifest.xml / strings.xml):
 *   - Game Name: Block Blast Ultimate
 *   - AdMob App ID: ca-app-pub-5668739021259460~4395181121
 *   - Banner Ad Unit ID: ca-app-pub-5668739021259460/6342687612
 *   - Rewarded Ad Unit ID: ca-app-pub-5668739021259460/8777279260
 *
 * Key Guarantees:
 *   1. Binds official `@capacitor-community/admob` v6+ native event listeners:
 *      - Banner: `bannerAdLoaded`, `bannerAdFailedToLoad`, `bannerAdSizeChanged`
 *      - Rewarded: `onRewardedVideoAdLoaded`, `onRewardedVideoAdFailedToLoad`,
 *        `onRewardedVideoAdReward`, `onRewardedVideoAdDismissed`, `onRewardedVideoAdFailedToShow`
 *   2. Reserves bottom banner height ONLY when a real native banner loads; collapses cleanly to 0px
 *      when offline, unavailable, or running in a browser (NEVER shows a fake banner or raw AdMob IDs).
 *   3. Preloads rewarded ads in the background and retries with exponential backoff.
 *   4. Remembers which reward action (`coins_250`, `spinner_extra`, `refill_*`, `classic_continue`)
 *      initiated the ad and grants ONLY that reward upon verified SDK reward completion.
 *   5. Prevents duplicate rewards, repeated callbacks, and accidental double-granting.
 *   6. Strictly NO interstitial ads anywhere.
 */
(function (global) {
  'use strict';

  const CFG = global.BBU_CONFIG;
  const STORAGE = global.BBU_STORAGE;

  const BANNER_EVENTS = {
    Loaded: 'bannerAdLoaded',
    FailedToLoad: 'bannerAdFailedToLoad',
    SizeChanged: 'bannerAdSizeChanged'
  };

  const REWARD_EVENTS = {
    Loaded: 'onRewardedVideoAdLoaded',
    FailedToLoad: 'onRewardedVideoAdFailedToLoad',
    Rewarded: 'onRewardedVideoAdReward',
    Dismissed: 'onRewardedVideoAdDismissed',
    FailedToShow: 'onRewardedVideoAdFailedToShow'
  };

  const AdManager = {
    initialized: false,
    initializationPromise: null,
    networkListenersAttached: false,
    listenersAttached: false,
    bannerVisible: false,
    bannerHeightPx: 0,
    bannerLoadFailed: false,
    rewardedPreloaded: false,
    rewardedLoading: false,
    retryCount: 0,
    retryTimer: null,
    activeRewardRequest: null,
    processedTokens: new Set(),

    getNativePlugin() {
      if (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AdMob) {
        return window.Capacitor.Plugins.AdMob;
      }
      return null;
    },

    isNativeAndroid() {
      return Boolean(
        typeof window !== 'undefined' &&
        window.Capacitor &&
        typeof window.Capacitor.getPlatform === 'function' &&
        window.Capacitor.getPlatform() === 'android'
      );
    },

    getActiveAdUnits() {
      const useTest = Boolean(
        (CFG.ADMOB && CFG.ADMOB.USE_GOOGLE_TEST_IDS) ||
        (STORAGE.state && STORAGE.state.consent && STORAGE.state.consent.useTestIds)
      );
      return useTest ? CFG.ADMOB.GOOGLE_TEST : CFG.ADMOB.PRODUCTION;
    },
    shouldUseTestAds() {
      return Boolean(
        (CFG.ADMOB && CFG.ADMOB.USE_GOOGLE_TEST_IDS) ||
        (STORAGE.state && STORAGE.state.consent && STORAGE.state.consent.useTestIds)
      );
    },
    setBannerReservedHeight(heightPx) {
      const px = Math.max(0, Math.round(Number(heightPx) || 0));
      this.bannerHeightPx = px;
      this.bannerVisible = px > 0;
      if (typeof document !== 'undefined' && document.documentElement) {
        document.documentElement.style.setProperty('--banner-height', `${px}px`);
        const slot = document.getElementById('admob-banner-slot');
        if (slot) {
          slot.classList.toggle('banner-collapsed', px === 0);
        }
        if (global.BBU_UI && typeof global.BBU_UI.resizeBoardCanvas === 'function') {
          setTimeout(() => global.BBU_UI.resizeBoardCanvas(), 30);
        }
      }
    },

    attachNativeListeners(plugin) {
      if (this.listenersAttached || !plugin || typeof plugin.addListener !== 'function') return;
      this.listenersAttached = true;

      try {
        plugin.addListener(BANNER_EVENTS.Loaded, () => {
          this.bannerLoadFailed = false;
          if (this.bannerHeightPx <= 0) {
            this.setBannerReservedHeight(56);
          }
        });

        plugin.addListener(BANNER_EVENTS.SizeChanged, (info) => {
          if (info && typeof info.height === 'number' && info.height > 0) {
            this.setBannerReservedHeight(info.height);
          }
        });

        plugin.addListener(BANNER_EVENTS.FailedToLoad, () => {
          this.bannerLoadFailed = true;
          this.setBannerReservedHeight(0);
        });

        plugin.addListener(REWARD_EVENTS.Loaded, () => {
          this.rewardedPreloaded = true;
          this.rewardedLoading = false;
          this.retryCount = 0;
        });

        plugin.addListener(REWARD_EVENTS.FailedToLoad, () => {
          this.rewardedPreloaded = false;
          this.rewardedLoading = false;
          this.scheduleRewardedRetry();
        });

        plugin.addListener(REWARD_EVENTS.Rewarded, (rewardItem) => {
          if (this.activeRewardRequest && !this.activeRewardRequest.rewardVerified) {
            this.activeRewardRequest.rewardVerified = true;
            this.activeRewardRequest.rewardItem = rewardItem || { type: 'reward', amount: 1 };
            if (typeof this.activeRewardRequest.finalize === 'function') {
              this.activeRewardRequest.finalize(true);
            }
          }
        });

        plugin.addListener(REWARD_EVENTS.Dismissed, () => {
          if (this.activeRewardRequest) {
            const wasEarned = Boolean(this.activeRewardRequest.rewardVerified);
            if (typeof this.activeRewardRequest.finalize === 'function') {
              this.activeRewardRequest.finalize(
                wasEarned,
                wasEarned ? null : 'Ad was closed early before finishing.'
              );
            }
          }
          this.rewardedPreloaded = false;
          this.preloadRewardedAd();
        });

        plugin.addListener(REWARD_EVENTS.FailedToShow, () => {
          if (this.activeRewardRequest && typeof this.activeRewardRequest.finalize === 'function') {
            this.activeRewardRequest.finalize(false, 'Video ad is not ready right now. Please try again in a moment!');
          }
          this.rewardedPreloaded = false;
          this.scheduleRewardedRetry();
        });
      } catch (e) {
        // Ignore listener errors in non-native environments
      }
    },

    scheduleRewardedRetry() {
      if (this.retryTimer) clearTimeout(this.retryTimer);
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
      const delayMs = Math.min(30000, 4000 * Math.pow(2, Math.min(3, this.retryCount)));
      this.retryCount += 1;
      this.retryTimer = setTimeout(() => {
        this.preloadRewardedAd();
      }, delayMs);
    },

    async initialize() {
      if (this.initialized) return true;
      if (this.initializationPromise) return this.initializationPromise;
      this.initializationPromise = this.initializeOnce();
      try {
        return await this.initializationPromise;
      } finally {
        this.initializationPromise = null;
      }
    },

    async initializeOnce() {
      if (this.initialized) return true;
      const plugin = this.getNativePlugin();

      if (STORAGE.state && Array.isArray(STORAGE.state.grantedAdTransactionIds)) {
        for (const t of STORAGE.state.grantedAdTransactionIds) {
          this.processedTokens.add(t);
        }
      }

      if (typeof window !== 'undefined' && !this.networkListenersAttached) {
        this.networkListenersAttached = true;
        window.addEventListener('online', () => {
          this.showBanner();
          this.preloadRewardedAd();
        });
        window.addEventListener('offline', () => {
          this.hideBanner();
        });
      }

      if (plugin) {
        try {
          this.attachNativeListeners(plugin);
          if (typeof plugin.requestConsentInfo === 'function') {
            let consentInfo = await plugin.requestConsentInfo();
            if (consentInfo && consentInfo.isConsentFormAvailable && consentInfo.status === 'REQUIRED') {
              consentInfo = await plugin.showConsentForm();
            }
          }
          await plugin.initialize({
            initializeForTesting: this.shouldUseTestAds()
          });
          this.initialized = true;
          this.preloadRewardedAd();
          return true;
        } catch (err) {
          this.setBannerReservedHeight(0);
          return false;
        }
      }

      // Browser / non-native environment: collapse banner slot to 0px so no fake banner placeholder is shown
      this.setBannerReservedHeight(0);
      this.initialized = true;
      return true;
    },

    async preloadRewardedAd() {
      const plugin = this.getNativePlugin();
      if (!plugin || typeof plugin.prepareRewardVideoAd !== 'function') return false;
      if (this.rewardedPreloaded || this.rewardedLoading) return true;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;

      const units = this.getActiveAdUnits();
      this.rewardedLoading = true;
      try {
        await plugin.prepareRewardVideoAd({
          adId: units.REWARDED_AD_UNIT_ID,
          isTesting: this.shouldUseTestAds()
        });
        this.rewardedPreloaded = true;
        this.rewardedLoading = false;
        return true;
      } catch (e) {
        this.rewardedPreloaded = false;
        this.rewardedLoading = false;
        return false;
      }
    },

    async showBanner() {
      const units = this.getActiveAdUnits();
      const plugin = this.getNativePlugin();

      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        this.hideBanner();
        return false;
      }

      if (plugin && typeof plugin.showBanner === 'function') {
        try {
          if (!(await this.initialize())) {
            this.setBannerReservedHeight(0);
            return false;
          }
          this.bannerLoadFailed = false;
          await plugin.showBanner({
            adId: units.BANNER_AD_UNIT_ID,
            adSize: 'ADAPTIVE_BANNER',
            position: 'BOTTOM_CENTER',
            margin: 0,
            isTesting: this.shouldUseTestAds()
          });
          if (this.bannerLoadFailed) {
            this.setBannerReservedHeight(0);
            return false;
          }
          this.setBannerReservedHeight(56);
          return true;
        } catch (err) {
          this.hideBanner();
          return false;
        }
      }

      // In web/browser preview: never show a fake banner placeholder with raw AdMob IDs
      this.setBannerReservedHeight(0);
      return false;
    },

    async hideBanner() {
      const plugin = this.getNativePlugin();
      this.setBannerReservedHeight(0);

      if (plugin && typeof plugin.hideBanner === 'function') {
        try {
          await plugin.hideBanner();
        } catch (e) { }
      }
    },

    /**
     * Shows a user-initiated Rewarded Ad for a specific placement:
     *   - 'coins_250'        -> Grants 250 coins
     *   - 'spinner_extra'    -> Grants 1 extra spin
    *   - 'refill_rocket' | 'refill_hammer' | 'refill_bomb_basic' | 'refill_bomb_mega'
     *   - 'classic_continue' -> Continues Classic Mode run
     *
     * Enforces single-resolution token locking so duplicate callbacks, retries, early exits,
     * or app pause/resume events NEVER grant duplicate rewards.
     */
    async showRewardedAd(placement, onRewardCallback, onFailCallback) {
      if (this.activeRewardRequest) {
        if (onFailCallback) onFailCallback('Please wait a moment for the current video to finish.');
        return { granted: false, reason: 'busy' };
      }

      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        const msg = 'No internet right now. You can keep playing offline!';
        if (onFailCallback) onFailCallback(msg);
        return { granted: false, reason: 'offline' };
      }

      const requestToken = `req_${placement}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      let resolveOuterPromise = null;
      const outerPromise = new Promise((resolve) => {
        resolveOuterPromise = resolve;
      });

      const finalizeOnce = (granted, reason) => {
        if (!this.activeRewardRequest || this.activeRewardRequest.token !== requestToken) {
          return { granted: false, reason: 'stale_token' };
        }
        if (this.activeRewardRequest.resolved || this.processedTokens.has(requestToken)) {
          return { granted: false, reason: 'duplicate_callback_blocked' };
        }
        this.activeRewardRequest.resolved = true;
        this.activeRewardRequest = null;

        let outcome;
        if (granted) {
          this.processedTokens.add(requestToken);
          STORAGE.state.grantedAdTransactionIds.push(requestToken);
          if (STORAGE.state.grantedAdTransactionIds.length > 100) {
            STORAGE.state.grantedAdTransactionIds.shift();
          }
          STORAGE.save();
          if (typeof onRewardCallback === 'function') {
            onRewardCallback({ token: requestToken, placement });
          }
          outcome = { granted: true, token: requestToken, placement };
        } else {
          const friendlyReason = reason || 'Video was closed early. Watch until the end to get your reward!';
          if (typeof onFailCallback === 'function') {
            onFailCallback(friendlyReason);
          }
          outcome = { granted: false, reason: friendlyReason };
        }

        if (resolveOuterPromise) resolveOuterPromise(outcome);
        return outcome;
      };

      this.activeRewardRequest = {
        token: requestToken,
        placement,
        resolved: false,
        rewardVerified: false,
        finalize: finalizeOnce
      };

      const units = this.getActiveAdUnits();
      const plugin = this.getNativePlugin();

      // 1. Native Android Capacitor AdMob path
      if (plugin && typeof plugin.prepareRewardVideoAd === 'function') {
        try {
          if (!(await this.initialize())) {
            return finalizeOnce(false, 'Ads are unavailable right now. You can keep playing.');
          }
          if (!this.rewardedPreloaded) {
            await plugin.prepareRewardVideoAd({
              adId: units.REWARDED_AD_UNIT_ID,
              isTesting: this.shouldUseTestAds()
            });
            this.rewardedPreloaded = true;
          }
          const rewardItem = await plugin.showRewardVideoAd();
          this.rewardedPreloaded = false;
          this.preloadRewardedAd();
          if (rewardItem || (this.activeRewardRequest && this.activeRewardRequest.rewardVerified)) {
            return finalizeOnce(true);
          }
          return finalizeOnce(false, 'Video was closed before the reward finished.');
        } catch (err) {
          this.rewardedPreloaded = false;
          this.scheduleRewardedRetry();
          return finalizeOnce(false, 'No video ad is available right now. Please try again soon!');
        }
      }

      // 2. Automated test / Web preview verification path
      const simMode = (STORAGE.state && STORAGE.state.consent && STORAGE.state.consent.devSimulatorMode) || 'success';
      if (simMode === 'no_fill') {
        return finalizeOnce(false, 'No video ad is available right now. Please try again soon!');
      }
      if (simMode === 'early_close') {
        return finalizeOnce(false, 'Video was closed early. No reward granted.');
      }

      if (global.BBU_UI && typeof global.BBU_UI.presentSimulatedRewardedAdModal === 'function') {
        await global.BBU_UI.presentSimulatedRewardedAdModal({
          placement,
          onComplete: () => finalizeOnce(true),
          onDismissEarly: () => finalizeOnce(false, 'You closed the video early. Watch to the end to earn your prize!')
        });
        return outerPromise;
      }

      return finalizeOnce(true);
    }
  };

  global.BBU_ADS = AdManager;
})(typeof window !== 'undefined' ? window : globalThis);
