# Android-specific AGENTS.md (inherits ../AGENTS.md)

These are authoritative instructions when Codex is working on mobile/**. Start with ../AGENTS.md and read docs/ANDROID_RELEASE.md if packaging, dependencies, signing, SDK, app metadata, or publication is involved.

## Fast mental model
- mobile/ is a **Vite + React 19 + Capacitor 7** packaged version of the Next.js UI; not React Native.
- Files in ../components/game, ../components/ui, ../app/globals.css, ../types/game are canonical shared inputs.
- mobile/scripts/prepare.mjs creates **mobile/generated/**, local **mobile/public/data/catalog.json**, copies icons, and text-transforms GameApp for offline only.
- mobile/src/main.tsx mounts the generated GameApp; mobile/src/native-back.ts connects Android Back with custom events.
- mobile/src/offline/catalog-client.ts loads bundled /data/catalog.json; mobile/src/offline/client-sync.ts blocks server APIs.
- mobile/capacitor.config.ts sets appId, appName, webDir, colors. mobile/scripts/configure-android.mjs applies native edits idempotently after cap sync.
- .gitignore excludes android/, generated/, dist/, public/, assets/; edits inside those paths alone won't survive clean clone.
- mobile/postcss.config.mjs deliberately prevents inherited root Next.js PostCSS settings from breaking Vite.

## Non-negotiables
- No server/MySQL in mobile gameplay. No introducing internet access requirement to start/play/resume.
- Keep portrait-oriented UX, Persian RTL, Vazirmatn loaded locally, dark/light/system themes and fluid transitions.
- Don't bypass scoring or tamper with word IDs/used selections. Preserve existing save format or migrate.
- Don't commit .jks/.keystore/signing passwords/SDK paths/local.properties.
- Don't regenerate the Android native project with android:init if android/ exists; use android:sync.
- Do not write hard-coded absolute user machine paths into tracked source.
- Use root document topics for rule changes / branding / QA.

## Normal Windows workflow (run from mobile/)
    npm install
    npm test
    npm run build
    npm run android:sync
    npm run android:open

First-time only:
    npm run android:init

If Aliyun is needed in a location where Google's Maven is unavailable:
    $env:PANTOMIME_MAVEN_MIRROR = "aliyun"
    npm run android:configure

Then, in mobile/android/ on Windows:
    .\gradlew.bat assembleDebug
    .\gradlew.bat assembleRelease

Android Studio manual signed-release wizard with the **already created** release keystore is the preferred first-publish process. CI release artifacts are not signed unless valid secrets were installed.

## Special caveats for future tasks
- The source GameApp still has online branches: the offline adaptation must always be regenerated and exercised after shared UI edits.
- The Android Back adapter dispatches "pantomime:native-back", while the generated GameApp listens for it. Verify modal/back/exit interactions on real Android.
- Catalog expansion is deterministic: current baseline is 33 categories and 771 offline words on the mobile build, 25 and 600 in web's static pack (as of this documented commit). Counts can legitimately change after word tasks; update docs and tests.
- Updating application branding requires consistent changes to web icon sources and Capacitor appName. Launcher may be cached in phone settings; always test a clean install.
- Brand: «ادازی» / Adazi, approved by the owner on 2026-10-16. Masters are branding/source/*.png; generate-brand.mjs resizes/pads without altering the supplied artwork. Android uses mipmap/adazi_launcher (legacy densities + adaptive foreground/background) and a separately padded splash. Verify actual launcher masks and splash timing on phones before store launch.
- For changing Gradle repositories, Gradle :capacitor-android defines its **own** buildscript; root configuration alone does not cover it. The configure script knows about this.
- Toolchain used in successful CI: Node 22, JDK 21, Gradle/AGP 8.11.1/8.7.2, Android compile/target SDK 35; actual installed versions and supported Android Studio should be checked before changes.
- Every significant change must preserve ability to regenerate native assets from a clean clone, not only from one developer's installed SDK.
