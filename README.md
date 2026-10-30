# Block Blast Ultimate — Child-Friendly 3D Toy & Jewel Edition (HTML5 + Capacitor Android + Start.io)

**Block Blast Ultimate** is an offline-first, child-friendly 3D block puzzle game built with modular HTML5, CSS3, and JavaScript, packaged for Android via Capacitor 7 and Start.io.

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
4. **Start.io Ads:**
   - Android-only ads through `@martinezmanoloa/capacitor-startio-ads`.
   - Shows banners on Home and gameplay with explicit hide-before-switch behavior; interstitials are requested only at startup and after a level win.
   - Grants rewarded coins only when the plugin emits `rewardedVideoEarned`. Browser preview remains playable and does not simulate ad rewards.

---

## 2. Start.io Configuration

The Start.io app ID and rewarded coin amount are configured in `src/js/config.js`. Set `TEST_MODE` to `true` for development and back to `false` for production. The native plugin currently requires Capacitor 7 and supplies its Start.io Android SDK dependency.

---

## 3. Step-by-Step Instructions: How to Build a Debug APK & Signed AAB

1. Install **Node.js 20+**, **JDK 21**, and **Android Studio** (with Android SDK Platform 34 or later).
2. Extract `Block_Blast_Ultimate_Project.zip`, open a terminal in the project folder, and run:
   ```bash
   npm install
   npm run build
   npx cap sync android
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
