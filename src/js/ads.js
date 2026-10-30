(function (global) {
  'use strict';

  const CFG = global.BBU_CONFIG;
  const StartioAds = (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.Plugins)
    ? window.Capacitor.Plugins.StartioAds
    : null;

  let initialized = false;
  let initializationPromise = null;
  let interstitialReady = false;
  let interstitialLoadPromise = null;
  let rewardedReady = false;
  let rewardedLoadPromise = null;
  let activeReward = null;
  let listenersAttached = false;

  function finishReward(earned, message) {
    if (!activeReward) return;
    const request = activeReward;
    activeReward = null;
    if (earned) {
      request.onReward({ amount: CFG.STARTIO.REWARDED_COINS });
    } else {
      request.onFail(message || 'Video ad not available right now.');
    }
    setTimeout(loadRewarded, 3000);
  }

  async function attachListeners() {
    if (listenersAttached || !StartioAds || typeof StartioAds.addListener !== 'function') return;
    listenersAttached = true;
    await StartioAds.addListener('rewardedVideoLoaded', () => {
      rewardedReady = true;
    });
    await StartioAds.addListener('rewardedVideoFailed', (info) => {
      rewardedReady = false;
      if (activeReward) finishReward(false, (info && info.error) || 'Video ad not available right now.');
    });
    await StartioAds.addListener('rewardedVideoEarned', () => {
      finishReward(true);
    });
    await StartioAds.addListener('rewardedVideoClosed', () => {
      if (activeReward) finishReward(false, 'Video was closed before the reward finished.');
    });
  }

  async function initialize() {
    if (initialized) return true;
    if (initializationPromise) return initializationPromise;
    if (!StartioAds) {
      initialized = true;
      return true;
    }

    initializationPromise = (async () => {
      try {
        await attachListeners();
        await StartioAds.initParams({
          appId: CFG.STARTIO.APP_ID,
          enableTest: CFG.STARTIO.TEST_MODE
        });
        initialized = true;
        loadInterstitial();
        loadRewarded();
        return true;
      } catch (error) {
        console.error('Start.io init failed', error);
        return false;
      } finally {
        initializationPromise = null;
      }
    })();
    return initializationPromise;
  }

  async function showBanner(position) {
    if (!StartioAds || !(await initialize())) return false;
    try {
      await StartioAds.hideBannerAd();
      await StartioAds.showBannerAd({ position: position === 'TOP' ? 'TOP' : 'BOTTOM' });
      return true;
    } catch (error) {
      return false;
    }
  }

  async function hideBanner() {
    if (!StartioAds) return;
    try {
      await StartioAds.hideBannerAd();
    } catch (error) {
      // The plugin may not have created a banner yet.
    }
  }

  async function loadInterstitial() {
    if (!StartioAds) return false;
    if (interstitialReady) return true;
    if (interstitialLoadPromise) return interstitialLoadPromise;
    interstitialLoadPromise = StartioAds.loadInterstitialAd()
      .then(() => {
        interstitialReady = true;
        return true;
      })
      .catch(() => {
        interstitialReady = false;
        return false;
      })
      .finally(() => {
        interstitialLoadPromise = null;
      });
    return interstitialLoadPromise;
  }

  async function showInterstitial() {
    if (!StartioAds || !(await initialize())) return false;
    if (!interstitialReady && !(await loadInterstitial())) return false;
    try {
      await StartioAds.showInterstitialAd();
      interstitialReady = false;
      setTimeout(loadInterstitial, 3000);
      return true;
    } catch (error) {
      interstitialReady = false;
      loadInterstitial();
      return false;
    }
  }

  async function loadRewarded() {
    if (!StartioAds) return false;
    if (rewardedReady) return true;
    if (rewardedLoadPromise) return rewardedLoadPromise;
    rewardedLoadPromise = StartioAds.loadRewardedVideoAd()
      .then(() => {
        rewardedReady = true;
        return true;
      })
      .catch(() => {
        rewardedReady = false;
        return false;
      })
      .finally(() => {
        rewardedLoadPromise = null;
      });
    return rewardedLoadPromise;
  }

  async function showRewarded(onReward, onFail) {
    const fail = typeof onFail === 'function' ? onFail : function () { };
    const reward = typeof onReward === 'function' ? onReward : function () { };
    if (!StartioAds) {
      fail('Ads are not available in browser preview.');
      return false;
    }
    if (activeReward) {
      fail('Please wait for the current video to finish.');
      return false;
    }
    if (!(await initialize())) {
      fail('Ads are not available right now.');
      return false;
    }
    if (!rewardedReady && !(await loadRewarded())) {
      fail('Video ad not available right now.');
      return false;
    }

    const result = new Promise((resolve) => {
      activeReward = {
        onReward: (value) => {
          reward(value);
          resolve(true);
        },
        onFail: (message) => {
          fail(message);
          resolve(false);
        }
      };
    });
    rewardedReady = false;
    try {
      await StartioAds.showRewardedVideoAd();
      return result;
    } catch (error) {
      finishReward(false, 'Video ad not available right now.');
      return false;
    }
  }

  global.BBU_ADS = {
    initialize: initialize,
    showBanner: showBanner,
    hideBanner: hideBanner,
    showInterstitial: showInterstitial,
    loadInterstitial: loadInterstitial,
    showRewarded: showRewarded,
    loadRewarded: loadRewarded
  };
})(typeof window !== 'undefined' ? window : globalThis);
