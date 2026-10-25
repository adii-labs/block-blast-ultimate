/**
 * Block Blast Ultimate — Application Bootstrapper
 */
(function (global) {
  'use strict';

  function boot() {
    global.BBU_STORAGE.load();
    global.BBU_AUDIO.init();
    global.BBU_TASKS.ensurePeriodsSynced();
    global.BBU_UI.init();
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot);
    } else {
      boot();
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
