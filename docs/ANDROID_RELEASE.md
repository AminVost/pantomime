# Android build, signing, SDK and marketplace release guide

Verified against source and user setup through 2026-10-16. Read this file when touching native build, Gradle, signing, app IDs, permissions, Android Studio, CI or stores.

## A. Runtime and authoritative build inputs

Android: Capacitor 7 shell bundling React/Vite; NOT React Native, NOT a remote-hosted website. UI, words and Vazirmatn fonts are packaged locally, and app gameplay requires no MySQL or API.

- mobile/capacitor.config.ts: appId ir.aminvost.pantomime, appName ادازی, webDir dist, colors and androidScheme.
- mobile/scripts/prepare.mjs: copies canonical UI and icons, generates offline catalog, composes mobile/generated.
- mobile/scripts/configure-android.mjs: edits generated AndroidManifest (portrait/keyboard/backup/vibrate), icon, optional signing, optional regional Maven mirrors.
- mobile/package.json: android:init, android:configure, android:sync, android:open.
- .github/workflows/android.yml: debug/release APK and AAB build. Release is SIGNED only if valid keystore secrets have been supplied.

Android folder is untracked/ignored by Git; changes inside it alone will not survive a clean clone or full regeneration.

## B. Reproduced Windows environment

The user cloned this branch to a custom C:\wamp64\www path. Node 22.13.0; latest installed Android Studio Rabbit 1; JDK 21 selected for Gradle. Capacitor template uses Android Gradle Plugin 8.7.2, Gradle 8.11.1 and Android compile/target SDK API 35.

A previous IDE supported only AGP 8.2.2 and failed to import. The user installed a newer Android Studio. Do not lower AGP just to work around an obsolete IDE.

User's SDK was missing Android SDK Platform 35. Access to Google's SDK metadata feeds was problematic. The official Platform 35 rev 2 ZIP was fetched, validated (source.properties reports ApiLevel=35 and android.jar is present) and put into AppData\Local\Android\Sdk\platforms\android-35. Android Studio subsequently showed Android 15 API 35 installed. User screenshot: BUILD SUCCESSFUL for local release build (~2m34s).

**Important distinctions:**
- This proves Android compiles on their machine, not that the APK's signature has been verified, installed on a real phone, or accepted by an app store.
- Android SDK package feeds differ from Gradle/Maven dependency feeds.
- Warnings about flatDir, SDK XML versions, or minor Gradle upgrades were nonblocking during that successful build.

## C. Google Maven blocked: opt-in Aliyun patch

On user's network, Google Maven artifact GET returned 404 whereas the corresponding Aliyun URL returned 200.

From mobile/ in PowerShell:

    $env:PANTOMIME_MAVEN_MIRROR = "aliyun"
    npm run android:configure

The source script patches all relevant repositories, with Aliyun before google():
1. mobile/android/build.gradle: root project buildscript + allprojects.
2. mobile/node_modules/@capacitor/android/capacitor/build.gradle: OWN module buildscript and repositories.
3. mobile/android/capacitor-cordova-android-plugins/build.gradle.
4. node_modules/@capacitor/app/android/build.gradle if matching sections exist.

Adding the mirror only to app/build.gradle or even the root project did not fix :capacitor-android: it declares an independent buildscript repository list. The script is idempotent but touches ignored/generated files and node_modules. Re-run after npm install or Capacitor sync, especially on a new machine. CI uses official repositories, smoke-tests mirror configuration separately and restores originals.

Never introduce runtime internet access to solve a build-time Maven issue; never change dependency versions until actual compatibility requires it.

## D. First clean build and later edits

From the repository root:

    git switch feat/android-offline-pantomime
    cd mobile
    npm install
    npm test
    npm run android:init           # only if mobile/android is absent
    npm run android:open

After game/UI/words/native-source changes:

    cd mobile
    npm run android:sync           # build + cap sync + configure Android
    npm run android:open

When regional mirror is required, set the environment variable first and run android:configure. On Windows in mobile/android:

    .\gradlew.bat assembleDebug
    .\gradlew.bat assembleRelease

Typical paths (verify actual file):
- Debug APK: mobile/android/app/build/outputs/apk/debug/app-debug.apk.
- Release unsigned APK: mobile/android/app/build/outputs/apk/release/.
- Android Studio signed APK: Wizard-selected Destination Folder, often mobile/android/app/release/.
- Release AAB: mobile/android/app/build/outputs/bundle/release/.

Do not run npm run android:init when android/ already exists. Do not replace an Android Studio-signed release with an unsigned CLI/CI binary.

## E. Private signing identity

Owner has created an Android keystore in Android Studio and selected alias pantomime. NEVER request or publish keystore bytes or passwords; use exactly that keystore for subsequent updates. Keep backups in safe, separate locations.

First publication procedure:
1. Android Studio > Build > Generate Signed App Bundle / APK.
2. Choose APK for initial Bazaar/Myket distribution, or AAB only when store procedures require it.
3. Choose EXISTING keystore (after first creation); enter secrets locally, not into Git/chat.
4. Select RELEASE build variant and destination.
5. Generate and wait for BUILD SUCCESSFUL.
6. Verify the final artifact's signing, package and version before sending it to stores.

Optional environment-based release signing uses four env variables configured by mobile/scripts/configure-android.mjs:
PANTOMIME_KEYSTORE_PATH, PANTOMIME_KEYSTORE_PASSWORD, PANTOMIME_KEY_ALIAS, PANTOMIME_KEY_PASSWORD.

GitHub Actions can use PANTOMIME_KEYSTORE_BASE64 plus the three password/alias secrets, but normally unsigned artifacts are safer until publication keys are deliberately configured.

Never change signing certificate or appId for future app updates without an explicit documented distribution/migration plan.

## F. Validate the exact APK

1. Locate APK generated by the SIGNED release wizard; note its size/path/time.
2. Run Android SDK Build Tools' apksigner verify --verbose --print-certs with the actual APK path. Confirm verification success and certificate SHA-256. No keystore password needs to be exposed in reports.
3. Android Studio Build > Analyze APK (or installed aapt/apkanalyzer): verify Android package ID ir.aminvost.pantomime, versionCode, versionName, minSdk and targetSdk 35 from the real built APK.
4. Install THAT APK on a physical Android device, fully offline; play a complete match, resume mid-turn, test device back, RTL, haptics, sound and light/dark.
5. A debug build often has a different certificate and cannot be updated in place to a signed release. Uninstalling debug erases its local game data.
6. Only after actual device QA/upload eligibility is confirmed, submit a signed APK or AAB per the respective store's current dashboard policy.
7. Record non-secret release evidence: git SHA, package ID, versionCode/versionName, cert SHA-256, APK SHA-256, targetSdk, test phones/Android versions, test date and store upload status.

Check current Bazaar and Myket documentation at publication time for APK/AAB format, age rating, screenshots, privacy/support disclosures, fees, target SDK requirements and possible AAB supplemental signing. A green Gradle build is not a store approval.

## G. Error-resolution cheat sheet

| Symptom | Established cause/strategy |
| --- | --- |
| Vite cannot find @tailwindcss/postcss imported by parent root config | Mobile has its own mobile/postcss.config.mjs. Pull branch and rebuild. |
| AGP 8.7.2, google-services 4.4.2 cannot resolve | Google's Maven unavailable; use optional Aliyun patch. |
| :capacitor-android cannot resolve AGP, even after root mirror | Also patch independent Capacitor module buildscript via configure-android. |
| Android Studio supports only AGP <= 8.2.2 | Upgrade Android Studio, do not downgrade template AGP. |
| Gradle JVM incompatible | Select JVM 21. |
| Failed to find Platform SDK platforms;android-35 | Install complete Platform 35; inspect android.jar and source.properties at android-35 root. |
| Android Studio package status "Installed (Obsolete)" | Metadata feed may be stale. Evaluate actual platform contents and build before deletion. |
| Minor Gradle version available, flatDir warning | Not necessarily build failures; leave existing working toolchain during release. |
| No Devices | Can still compile; physical QA awaits a connected phone or manual APK transfer. |
| Successful build but market rejects | Inspect signature, versionCode, target SDK, permissions, app ID, listing and current store rules. |

## H. Before asking Codex to change native project

- Prefer editing durable mobile/scripts/configure-android.mjs rather than ignored android/ outputs.
- Don't introduce permissions or telemetry without explicit feature and privacy review.
- Re-run npm test, npm run build, npm run android:sync and Gradle release after native changes.
- The compiled APK must be re-created after game/icon/catalog changes. Do not upload a stale artifact.
- Check whether branding changes are display-only or affect irreversible store identity.

## I. Current release stage (2026-10-16)

Owner verification for the previous APK includes a valid signature, package/version/SDK metadata and six physical-phone smoke cases; see STATUS_AND_DECISIONS. Subsequent UX/personal-library changes require a fresh signed APK and device regression. Current debug/release assembly uses existing JDK 21 and Aliyun cache; Java 25 bundled with the newer Android Studio is not compatible with this Gradle version (major version 69). Do not downgrade AGP to address that; use the installed JDK 21.

Launch resources are reproducibly configured by `configure-android.mjs`: `AppTheme.NoActionBarLaunch` uses `Theme.SplashScreen`, solid app background, existing `@drawable/pantomime_icon` and `postSplashScreenTheme`. Capacitor's template `@drawable/splash` is no longer referenced by the launch theme. Test the actual startup on pre-12 and Android 12+ phones; compiling resources does not prove masking/timing/appearance. No Package ID, native version, keystore or signing identity was changed in this UX update.
