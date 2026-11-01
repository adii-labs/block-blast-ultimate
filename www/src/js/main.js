/**
 * Block Blast Ultimate — Application Bootstrapper
 */
(function (global) {
  'use strict';

  async function boot() {
    let audioReady = false;
    const stopMusic = () => global.BBU_AUDIO.stopMusic();
    const resumeMusic = () => {
      if (audioReady && !document.hidden) global.BBU_AUDIO.syncMusic();
    };
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stopMusic();
      else resumeMusic();
    });
    window.addEventListener('pagehide', stopMusic);
    window.addEventListener('pageshow', resumeMusic);

    const appPlugin = global.Capacitor && global.Capacitor.Plugins && global.Capacitor.Plugins.App;
    if (appPlugin && typeof appPlugin.addListener === 'function') {
      appPlugin.addListener('backButton', async () => {
        if (global.BBU_UI.handleBackButton()) return;
        stopMusic();
        await global.BBU_ADS.hideBanner();
        await appPlugin.exitApp();
      }).catch((error) => console.warn('Android back handler unavailable', error));
      appPlugin.addListener('pause', stopMusic)
        .catch((error) => console.warn('Android pause handler unavailable', error));
      appPlugin.addListener('resume', resumeMusic)
        .catch((error) => console.warn('Android resume handler unavailable', error));
    }
    try {
      global.BBU_STORAGE.load();
      global.BBU_AUDIO.init();
      audioReady = true;
      global.BBU_TASKS.ensurePeriodsSynced();
      global.BBU_UI.init();
      await global.BBU_ADS.showStartupInterstitial(2000);
    } catch (error) {
      console.error('App startup failed', error);
    } finally {
      document.body.classList.add('app-ready');
      try {
        await global.BBU_UI.switchScreen('screen-home');
      } catch (error) {
        console.error('Unable to open the home screen', error);
      }
    }
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot);
    } else {
      boot();
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
