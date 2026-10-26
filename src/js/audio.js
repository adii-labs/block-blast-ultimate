/**
 * Block Blast Ultimate — Audio & Haptics Manager
 * Supports local WAV audio files (`assets/audio/*.wav`) AND automatic Web Audio API synthesizer fallback,
 * unlocking cleanly after the first user gesture on mobile WebViews.
 */
(function (global) {
  'use strict';

  const SOUND_FILES = {
    place: 'assets/audio/place.wav',
    tap: 'assets/audio/tap.wav',
    clear: 'assets/audio/clear.wav',
    combo: 'assets/audio/combo.wav',
    coin: 'assets/audio/coin.wav',
    rocket: 'assets/audio/rocket.wav',
    hammer: 'assets/audio/hammer.wav',
    bomb: 'assets/audio/bomb.wav',
    spinner: 'assets/audio/spinner.wav',
    reward: 'assets/audio/reward.wav',
    win: 'assets/audio/win.wav',
    fail: 'assets/audio/fail.wav',
    menu: 'assets/audio/menu.wav',
    bgm: 'assets/audio/bgm_loop.wav'
  };

  const AudioManager = {
    ctx: null,
    unlocked: false,
    audioElements: {},
    bgmElement: null,
    bgmSynthTimer: null,

    init() {
      if (typeof window === 'undefined') return;
      for (const [key, src] of Object.entries(SOUND_FILES)) {
        try {
          const el = new Audio(src);
          el.preload = 'auto';
          if (key === 'bgm') {
            el.loop = true;
            this.bgmElement = el;
          } else {
            this.audioElements[key] = el;
          }
        } catch (e) {
          // Ignore in headless/Node environments
        }
      }

      const unlockHandler = () => {
        this.unlock();
      };
      window.addEventListener('pointerdown', unlockHandler, { once: true, passive: true });
      window.addEventListener('touchstart', unlockHandler, { once: true, passive: true });
      window.addEventListener('keydown', unlockHandler, { once: true, passive: true });
    },

    unlock() {
      if (this.unlocked) return;
      this.unlocked = true;
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx && !this.ctx) {
          this.ctx = new AudioCtx();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume();
        }
      } catch (e) { }
      this.syncMusic();
    },

    getSettings() {
      return (global.BBU_STORAGE && global.BBU_STORAGE.state && global.BBU_STORAGE.state.settings) || {
        soundEnabled: true,
        musicEnabled: true,
        sfxVolume: 1.0,
        musicVolume: 1.0,
        hapticsEnabled: true,
        hapticsIntensity: 'medium'
      };
    },

    play(name) {
      const s = this.getSettings();
      if (!s.soundEnabled) return;
      this.unlock();

      const sliderVolume = Number.isFinite(Number(s.sfxVolume))
        ? Math.max(0, Math.min(1, Number(s.sfxVolume)))
        : 1;
      const vol = sliderVolume * 1.5;
      const el = this.audioElements[name];
      if (el && typeof el.play === 'function') {
        try {
          const clone = el.cloneNode();
          let routedThroughGain = false;
          if (this.ctx && typeof this.ctx.createMediaElementSource === 'function') {
            try {
              const source = this.ctx.createMediaElementSource(clone);
              const gain = this.ctx.createGain();
              gain.gain.value = vol;
              source.connect(gain);
              gain.connect(this.ctx.destination);
              clone.addEventListener('ended', () => {
                source.disconnect();
                gain.disconnect();
              }, { once: true });
              routedThroughGain = true;
            } catch (e) { }
          }
          if (!routedThroughGain) clone.volume = Math.min(1, vol);
          const playPromise = clone.play();
          if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch(() => this.playSynthFallback(name, vol));
          }
          return;
        } catch (e) {
          this.playSynthFallback(name, vol);
          return;
        }
      }
      this.playSynthFallback(name, vol);
    },

    playSynthFallback(name, vol) {
      if (!this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);

        const presets = {
          tap: { type: 'sine', f1: 520, f2: 660, dur: 0.05 },
          place: { type: 'triangle', f1: 300, f2: 460, dur: 0.08 },
          clear: { type: 'triangle', f1: 523, f2: 1046, dur: 0.22 },
          combo: { type: 'triangle', f1: 587, f2: 1174, dur: 0.28 },
          coin: { type: 'sine', f1: 987, f2: 1318, dur: 0.18 },
          rocket: { type: 'sawtooth', f1: 220, f2: 880, dur: 0.32 },
          hammer: { type: 'square', f1: 190, f2: 75, dur: 0.14 },
          bomb: { type: 'sawtooth', f1: 140, f2: 42, dur: 0.38 },
          spinner: { type: 'triangle', f1: 640, f2: 880, dur: 0.07 },
          reward: { type: 'triangle', f1: 523, f2: 1046, dur: 0.26 },
          win: { type: 'triangle', f1: 523, f2: 1318, dur: 0.35 },
          fail: { type: 'sawtooth', f1: 360, f2: 190, dur: 0.32 },
          menu: { type: 'sine', f1: 440, f2: 587, dur: 0.07 }
        };
        const p = presets[name] || presets.tap;
        osc.type = p.type;
        osc.frequency.setValueAtTime(p.f1, now);
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, p.f2), now + p.dur);
        gain.gain.setValueAtTime(vol * 0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + p.dur);
        osc.start(now);
        osc.stop(now + p.dur);
      } catch (e) { }
    },

    syncMusic() {
      const s = this.getSettings();
      const sliderVolume = Number.isFinite(Number(s.musicVolume))
        ? Math.max(0, Math.min(1, Number(s.musicVolume)))
        : 1;
      const vol = sliderVolume * 0.25;
      if (this.bgmElement) {
        this.bgmElement.volume = vol;
        if (s.musicEnabled && this.unlocked) {
          const p = this.bgmElement.play();
          if (p && typeof p.catch === 'function') {
            p.catch(() => this.startSynthBgm(vol));
          }
        } else {
          try { this.bgmElement.pause(); } catch (e) { }
          this.stopSynthBgm();
        }
      } else if (s.musicEnabled && this.unlocked) {
        this.startSynthBgm(vol);
      } else {
        this.stopSynthBgm();
      }
    },

    startSynthBgm(vol) {
      this.stopSynthBgm();
      const notes = [261.63, 329.63, 392.00, 493.88, 392.00, 329.63, 293.66, 349.23, 440.00, 523.25];
      let idx = 0;
      this.bgmSynthTimer = setInterval(() => {
        const s = this.getSettings();
        if (!s.musicEnabled || !this.ctx) return;
        try {
          const now = this.ctx.currentTime;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(notes[idx % notes.length], now);
          gain.gain.setValueAtTime(this.getBgmOutputVolume(s) * 0.08, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(now);
          osc.stop(now + 0.4);
          idx++;
        } catch (e) { }
      }, 420);
    },

    stopSynthBgm() {
      if (this.bgmSynthTimer) {
        clearInterval(this.bgmSynthTimer);
        this.bgmSynthTimer = null;
      }
    },

    getBgmOutputVolume(settings = this.getSettings()) {
      const volume = Number(settings.musicVolume);
      return (Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 1) * 0.25;
    },

    haptic(type) {
      const s = this.getSettings();
      if (!s.hapticsEnabled) return;
      const scale = s.hapticsIntensity === 'light' ? 0.5 : (s.hapticsIntensity === 'strong' ? 1.5 : 1.0);
      const durations = {
        tap: Math.round(10 * scale),
        place: Math.round(16 * scale),
        clear: Math.round(35 * scale),
        combo: [Math.round(25 * scale), 30, Math.round(45 * scale)],
        explosion: [Math.round(40 * scale), 25, Math.round(65 * scale)],
        error: [Math.round(20 * scale), 40, Math.round(20 * scale)]
      };
      const pattern = durations[type] || durations.tap;
      try {
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
          navigator.vibrate(pattern);
        }
      } catch (e) { }
    }
  };

  global.BBU_AUDIO = AudioManager;
})(typeof window !== 'undefined' ? window : globalThis);
