# Project status, confirmed decisions and next handoff

Purpose: the NEXT Codex task should continue where work stopped without reconstructing chat history. This document records grounded evidence and unresolved decisions. Update with actual results, not assumptions.

Date of snapshot: 2026-10-16.
Branch: feat/android-offline-pantomime, remote AminVost/pantomime.
Default web branch: main (untouched by Android implementation in this workflow).

## Android UX and personal content update — 2026-10-16

- REVEAL now starts with a privacy cover; the word is absent from DOM/accessibility until «نمایش کلمه». Resuming a local timed turn returns through the same cover and «ادامه زمان».
- Every game screen has Home access. Explicit Home/Android Back pauses local gameplay with exact remaining milliseconds, preserving turn ID, scores, choices and queue. SETUP drafts are saved separately. New game replacement requires confirmation. Backgrounding without using Home still uses the original wall-clock deadline.
- Snapshot key/version remain `pantomin-active-game-v1` / 1. Optional `pausedRemainingMs` and `resolutionReason` recover paused turns and interrupted result animations; old v1 snapshots remain supported.
- Android-only «کلمات من» adds personal topics and words in existing/new topics, bulk newline entry, 2/4/6 difficulty, duplicate validation, word editing, deletion confirmations and search/pagination. Negative monotonic IDs cannot collide with packaged IDs. Active saved games lock editing/deletion; additions remain allowed. Storage is private localStorage, without server/sync; uninstall/clear-data deletes it.
- Android settings omit runtime/offline/server copy. `mobile/src/mobile.css` keeps primary actions and modal close controls visible while only middle content scrolls. Shared game/Modal changes also reach web; Android-only library/layout are injected from mobile main. Online web deadlines are not paused.
- Native startup theme now references the approved Adazi splash and adaptive launcher resources instead of Capacitor's template splash. No package, native version, signing configuration or keystore change. Final splash appearance still needs a phone check.
- Browser verification passed: all game screens/resumes, exact timer/turn preservation, reload during result feedback, replacement/fault scoring, normal timeout, risk30 success/failure, expired legacy v1 restore, eight-team draft, personal CRUD/duplicates/persistence/queue exhaustion, dark settings, simulated native Back, and fixed actions at 320×568 and 360×640. Zero page errors or `/api/` requests in the reusable tour (`mobile/tests/game-flow.browser.js`). A separate three-round game also completed. These are browser tests, not physical Android tests.
- Scoreboard UI corrected: compact 78px rows, explicit round/active-team summary, rank badges and score pills remove the stretched blank cards seen on the phone screenshot. Verified at 390×844 and in the full browser tour.
- Branding update verification: `npm test` now passes 15 tests, including exact source-PNG hashes/transparency, proportional UI exports, square opaque icons, adaptive foreground padding, Adazi metadata and preserved package/storage IDs. `npm run build` passes and the browser tour passes with zero page errors/API calls. `npm run android:sync` completes the web build but the Capacitor CLI currently fails in this environment at `uv_os_get_passwd / ENOMEM`; the durable `node scripts/configure-android.mjs` step succeeds with Aliyun and writes Adazi labels, mipmap densities, adaptive icon and splash resources. The previous local Gradle APKs are stale pre-brand artifacts; no new branded APK is claimed until the sync/Gradle environment issue is cleared. These checks do not replace device/store readiness.
- Still required: physical-device splash, keyboard/safe-area/Back, haptics/audio, background/process lifecycle and upgrade of the final APK with the existing signing key. No device was attached (`adb devices` empty). No new store submission or signature verification is claimed.

## Confirmed product requirements

1. Keep original polished web design, Persian RTL, animations and core flow; optimize responsibly where needed.
2. Android app must operate offline without MySQL/backend at this stage.
3. Add more entertaining words/topics; present mobile baseline 33 categories / 771 words.
4. Publish Android release to Café Bazaar and Myket.
5. Developer will do future changes using Codex in VS Code; AGENTS and topic docs must let sessions work without re-tracing entire project.
6. **Brand approved 2026-10-16:** «ادازی» / Adazi; use the owner's two supplied PNGs exactly, with proportional sizing/padding only. See BRANDING_AND_CONTENT.
7. Prioritize real performance, smoothness, reliability, and safe updates over architectural novelty.

## Chronology of verified outcomes

- Android edition created on feature branch (Capacitor 7 + React/Vite, offline-only build adapter).
- Local-only words/topics expanded; static catalog tests pass.
- GitHub Actions produced Android debug APK, unsigned release artifacts and standalone Android ZIP with successful build runs (prior to documentation updates).
- On Windows, npm test passed and npm run android:init succeeded after mobile/postcss.config.mjs prevented Vite from loading parent Next.js PostCSS config.
- Android Studio old installation could not support AGP 8.7.2; user installed Android Studio Rabbit 1.
- Google Maven was inaccessible on user's network (404 for artifacts). Aliyun mirror reachable (200); scripts updated for root and all Capacitor Gradle buildscript repositories. Gradle Sync subsequently succeeded.
- SDK 35 not initially installed; official Platform 35 rev 2 ZIP installed manually, verified by Android Studio showing Android 15 API 35 installed.
- User created a release keystore and chose alias "pantomime" (secrets not stored in repo/docs).
- **Latest user screenshot**: Android Studio Release Build Output says "BUILD SUCCESSFUL in 2m 34s", 141 actionable tasks (141 executed). This confirms local release assembly succeeded.

- **Owner-confirmed release APK verification (2026-10-16):** Android Studio produced app/release/app-release.apk (3,370,247 bytes). apksigner reported "Verifies", v1=true and v2=true, one signer. Missing v3/v4 is not a blocker. No keystore or password was shared.
- **Owner-confirmed APK metadata:** package ir.aminvost.pantomime; versionCode=1; versionName=1.0; compileSdk=35; targetSdk=35; minSdk=23; launcher ir.aminvost.pantomime.MainActivity.
- **Owner-reported real Android device smoke tests PASSED:** APK installed with correct Persian label and icon; airplane-mode/offline launch; team setup and selecting topic/points; timer/correct answer/scoring; complete game through scoreboard and winner; close/relaunch/resume. These checks were reported by the owner, not independently automated. Device model and Android version not yet recorded.

## Still OPEN / NOT VERIFIED

- Signed APK, package/version SDK metadata and six real-device smoke cases are now confirmed by user. They should not be repeatedly re-traced on this same APK.
- Extra physical-device edge cases remain: 30-point forfeit, continuous word queue/exhaustion, fault/change-word, sound/vibration, themes, Android Back and modal behavior, background timer expiry, update/migration behavior, different device sizes. Several now have browser regression coverage above; that does not replace device evidence.
- Brand is selected: Adazi and the two supplied PNGs. Verify the final branded APK on physical Android before publication.
- Adaptive launcher/store exports are generated from the approved art; physical launcher/splash checks and genuine phone screenshots are still required.
- Prepare accurate store/privacy/support listing details, validate current Bazaar/Myket requirements, upload and obtain review acceptance.
- Test the NEW final signed APK after all future branding/content/UI changes; this current smoke test doesn't transfer automatically to changed binaries.

## Release identity and baseline snapshot

- Current display label: ادازی.
- Current Android appId/package ID: ir.aminvost.pantomime.
- Owner-created signing alias: pantomime; actual keystore/private passwords unknown to Codex and must remain private.
- Verified current release APK compileSdk/targetSdk=35, minSdk=23.
- Verified current release APK versionCode=1, versionName=1.0; mobile/package.json=1.0.0 is separate from native version. Bump versionCode on updates.
- Game word/subject baseline: 33 categories / 771 words on Android; 25 / 600 source web JSON.
- User's local Android installation requires JVM 21 and regional Aliyun mirror when remote Google Maven is unreachable.

## Active next-step order (unless user changes priority)

1. Packaging milestone complete: user verified signed APK, actual Android manifest details and six essential real-phone test cases.
2. Apply/verify the approved Adazi brand across source assets, Android and PWA; package ID and signing key remain unchanged. See the latest branding update and STORE_LISTING.md.
3. Use Codex for approved content/UX/performance changes in focused commits, with mobile tests and builds.
4. Before actual publication, finish edge-case QA and real-device run with final assets; record device/OS and results.
5. Build a fresh signed release with SAME keystore, independently verify signature, versionCode, package and SDK again.
6. Finish Bazaar/Myket listing with accurate screenshots/privacy/support fields, then submit the final APK.

## Decision log format to maintain later

    YYYY-MM-DD — Decision / change:
    Approved by:
    Files changed:
    Evidence (test/device/store):
    Migration/update implications:
    Next unresolved item:

Never write signing passwords, private API keys, personal identification data, store account IDs or unpublished confidential information into this file.

## When user asks Codex to continue

First open AGENTS.md, mobile/AGENTS.md, this status and **only the relevant topic doc**. Explain that docs are a snapshot: inspect touched source before modifying and update status only with confirmed new outcomes.
