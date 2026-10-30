/**
 * Block Blast Ultimate — Application Bootstrapper
 */
(function (global) {
  'use strict';

  async function boot() {
    global.BBU_STORAGE.load();
    global.BBU_AUDIO.init();
    global.BBU_TASKS.ensurePeriodsSynced();
    global.BBU_UI.init();
    const appPlugin = global.Capacitor && global.Capacitor.Plugins && global.Capacitor.Plugins.App;
    if (appPlugin && typeof appPlugin.addListener === 'function') {
      appPlugin.addListener('backButton', async () => {
        if (global.BBU_UI.handleBackButton()) return;
        global.BBU_AUDIO.stopMusic();
        await global.BBU_ADS.hideBanner();
        await appPlugin.exitApp();
      }).catch((error) => console.warn('Android back handler unavailable', error));
      appPlugin.addListener('pause', () => global.BBU_AUDIO.stopMusic());
      appPlugin.addListener('resume', () => global.BBU_AUDIO.syncMusic());
    }
    await global.BBU_ADS.initialize();
    global.BBU_ADS.showInterstitial();
    global.BBU_ADS.showBanner('BOTTOM');
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot);
    } else {
      boot();
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
