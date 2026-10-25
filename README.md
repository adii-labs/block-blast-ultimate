# Block Blast Ultimate — Child-Friendly 3D Toy & Jewel Edition (HTML5 + Capacitor Android + AdMob)

**Block Blast Ultimate** is a complete, offline-first, child-friendly 3D toy-and-jewel mobile block puzzle game built with modular HTML5, CSS3, and JavaScript, packaged for Android via **Capacitor** and **`@capacitor-community/admob`**.

---

## 1. What Was Upgraded & Repaired

1. **Child-Friendly 3D Toy & Jewel Visual Redesign (`index.html`, `src/styles/main.css`, `src/js/ui.js`, `src/js/config.js`):**
   - **Starry Indigo-to-Royal-Blue Phone Shell:** Centered mobile frame (`max-width: 440px`, `height: 100dvh`, `#1e1b4b` -> `#172554` -> `#0f172a`) with frosted glass panels, rounded playful typography (`Fredoka` + rounded system fallback), and bouncy spring button physics (`cubic-bezier(0.34, 1.56, 0.64, 1)`).
   - **8 Candy-Jewel 3D Block Colors & 4-Layer Bevel Renderer (`drawBeveledBlock`):** Strawberry Ruby (`#ef4444`), Tangerine Pop (`#f97316`), Sunny Lemon (`#eab308`), Candy Apple Green (`#22c55e`), Sky Bubblegum Cyan (`#06b6d4`), Blueberry Splash (`#3b82f6`), Grape Jelly Purple (`#a855f7`), and Cotton Candy Pink (`#ec4899`) rendered with squircle corners, top-left light highlight, bottom-right dark bevel, and inner glossy shine on rounded checkerboard cells (`#131c38` / `#162040`).
   - **Zero Emojis:** 100% custom embedded 3D gradient SVG `<symbol>` definitions + 28 local high-contrast PNG icons.
2. **Simplified Child-Friendly Home Screen:**
   - Displays only the essential controls: Game Logo & Title (**Block Blast Ultimate**), Coin Balance Pill, a large green **PLAY CLASSIC** button, a large orange **LEVELS** button, and a clean 4-button bottom dock (**Daily Gift**, **Shop**, **Spin**, and **More Fun** submenu for Timed Blitz, Bomb Rescue, Missions, Trophies, Watch Ad +250 Coins, and How to Play).
3. **Improved Gameplay Feel, Finger-Offset Drag & Predictive Golden Line Glow (`src/js/board.js`, `src/js/ui.js`):**
   - **3-Piece Dock Tray:** Renders pieces at `0.58x` scale and automatically dims pieces (`0.35` alpha) that cannot currently fit on the board.
   - **Finger-Lift Offset:** Scales the dragged block to `0.92x` and lifts it `-1.15 * cellSize` above the touch point so a child's finger never covers the block.
   - **Predictive Line-Clear Highlight (`getPredictiveClears`):** While dragging over a valid spot, any row or column that will be completed glows gold (`#fde047` shadow + `#fef08a` border) before you drop the piece.
   - **Juicy Line Clears:** Spawns 12 radial gravity particles per cleared cell, expanding golden shockwave rings, damped screen bounce (`screenShake *= 0.85`), and brief kid-friendly praise banners (`NICE!`, `GREAT!`, `SUPER BLAST!`, `COMBO x3!`, `ALL CLEAR! +300`).
4. **Removed All Technical AdMob Info from Player UI:**
   - Removed AdMob App ID, Banner Ad Unit ID, Rewarded Ad Unit ID, SDK diagnostics, test/sim mode buttons, and fake banner placeholders from the Home Screen, Settings modal, bottom banner bar, and reward overlays.
   - Player-facing **Settings** contains only friendly controls: Sound Effects ON/OFF + Volume slider, Music ON/OFF + Volume slider, Vibration (Haptics) ON/OFF, Reduced Animations ON/OFF, High-Contrast Colors ON/OFF, Bigger Text ON/OFF, Sky/Starry Theme switcher, and Privacy & Ad Preferences.
5. **Repaired Native Android AdMob Integration (`src/js/ads.js`, `android/*`, `capacitor.config.json`):**
   - Binds official `@capacitor-community/admob` v6+ native event listeners (`bannerAdLoaded`, `bannerAdFailedToLoad`, `bannerAdSizeChanged`, `onRewardedVideoAdLoaded`, `onRewardedVideoAdFailedToLoad`, `onRewardedVideoAdReward`, `onRewardedVideoAdDismissed`, `onRewardedVideoAdFailedToShow`).
   - Dynamically reserves bottom banner height only when a real native adaptive banner loads and collapses to `0px` when offline or in browser preview.
   - Preloads rewarded ads with exponential backoff retry and grants rewards strictly upon verified SDK completion with single-token duplicate protection.

---

## 2. Google AdMob ID Configuration Reference (Code-Only, Hidden from Players)

| AdMob Identifier Type | Supplied Production ID | Exact File Location(s) | Purpose |
| :--- | :--- | :--- | :--- |
| **AdMob App ID** | `ca-app-pub-5668739021259460~4395181121` | 1. `android/app/src/main/res/values/strings.xml` (`admob_app_id`)<br>2. `android/app/src/main/AndroidManifest.xml` (`com.google.android.gms.ads.APPLICATION_ID`)<br>3. `capacitor.config.json` (`plugins.AdMob.appIdAndroid`)<br>4. `src/js/config.js` (`ADMOB_CONFIG.PRODUCTION.APP_ID`) | Initializes the native Android Google Mobile Ads SDK |
| **Banner Ad Unit ID** | `ca-app-pub-5668739021259460/6342687612` | `src/js/config.js` (`ADMOB_CONFIG.PRODUCTION.BANNER_AD_UNIT_ID`) consumed by `src/js/ads.js` (`AdManager.showBanner()`) | Anchored bottom adaptive banner on Android |
| **Rewarded Ad Unit ID** | `ca-app-pub-5668739021259460/8777279260` | `src/js/config.js` (`ADMOB_CONFIG.PRODUCTION.REWARDED_AD_UNIT_ID`) consumed by `src/js/ads.js` (`AdManager.showRewardedAd()`) | User-initiated rewarded ads for:<ul><li>**Watch Ad — Get 250 Coins** (`coins_250`)</li><li>**Spinner Extra Spin** (`spinner_extra`)</li><li>**Power-Up Refills** (`refill_rocket`, `refill_hammer`, `refill_bomb_basic`, `refill_bomb_mega`, `refill_undo`)</li><li>**Classic Mode Continue** (`classic_continue`)</li></ul> |
| **Interstitial Ads** | *None (Strictly Disabled)* | `src/js/config.js` (`INTERSTITIAL_ADS_ENABLED: false`) | No interstitial or forced full-screen ads anywhere |

> **Development Test Ads Note:** During Android Studio development testing, you can temporarily set `USE_GOOGLE_TEST_IDS: true` in `src/js/config.js` to test with Google's sample test ad units, and keep `USE_GOOGLE_TEST_IDS: false` for production builds.

---

## 3. Step-by-Step Instructions: How to Build a Debug APK & Signed AAB

1. Install **Node.js (v18/v20 LTS)** and **Android Studio** (with Android SDK Platform 34).
2. Extract `Block_Blast_Ultimate_Project.zip`, open a terminal in the project folder, and run:
   ```bash
   npm install
   npm run cap:sync
   ```
3. Open the Android project in Android Studio:
   ```bash
   npx cap open android
   ```
4. **Build Debug APK:** Click **Build -> Build Bundle(s) / APK(s) -> Build APK(s)**. Output: `android/app/build/outputs/apk/debug/app-debug.apk`.
5. **Build Signed Release AAB for Google Play:** Click **Build -> Generate Signed Bundle / APK...** -> select **Android App Bundle** -> choose/create your upload keystore -> select **release**. Output: `android/app/build/outputs/bundle/release/app-release.aab`.

## 4. Build a Debug APK with GitHub Actions

The workflow in `.github/workflows/android-apk.yml` builds a **debug APK** when code is pushed to the `main` or `master` branch. It can also be started manually from the repository's **Actions** tab using **Build Android APK -> Run workflow**. After it finishes, download `block-blast-ultimate-debug-apk` from the run's **Artifacts** section.

GitHub Actions automates the Android build; it does not convert the project automatically just because it is pushed. The repository must first be pushed to GitHub. This workflow creates a debug APK for testing, not a signed Play Store release.
