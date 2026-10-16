# Project status, confirmed decisions and next handoff

Purpose: the NEXT Codex task should continue where work stopped without reconstructing chat history. This document records grounded evidence and unresolved decisions. Update with actual results, not assumptions.

Date of snapshot: 2026-10-16.
Branch: feat/android-offline-pantomime, remote AminVost/pantomime.
Default web branch: main (untouched by Android implementation in this workflow).

## Confirmed product requirements

1. Keep original polished web design, Persian RTL, animations and core flow; optimize responsibly where needed.
2. Android app must operate offline without MySQL/backend at this stage.
3. Add more entertaining words/topics; present mobile baseline 33 categories / 771 words.
4. Publish Android release to Café Bazaar and Myket.
5. Developer will do future changes using Codex in VS Code; AGENTS and topic docs must let sessions work without re-tracing entire project.
6. **Future decision pending:** product name re-evaluation and unique/professional logo; do not silently rename or replace source assets before user approval.
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
- Extra device edge cases remain: 30-point forfeit, continuous word queue/exhaustion, fault/change-word, sound/vibration, themes, Android Back and modal behavior, background timer expiry, update/migration behavior, different device sizes.
- Decide final public app name and distinct professional logo. None selected yet.
- Complete adaptive launcher/store graphics and capture genuine screenshots of final build.
- Prepare accurate store/privacy/support listing details, validate current Bazaar/Myket requirements, upload and obtain review acceptance.
- Test the NEW final signed APK after all future branding/content/UI changes; this current smoke test doesn't transfer automatically to changed binaries.

## Release identity and baseline snapshot

- Current display label: پانتومین.
- Current Android appId/package ID: ir.aminvost.pantomime.
- Owner-created signing alias: pantomime; actual keystore/private passwords unknown to Codex and must remain private.
- Verified current release APK compileSdk/targetSdk=35, minSdk=23.
- Verified current release APK versionCode=1, versionName=1.0; mobile/package.json=1.0.0 is separate from native version. Bump versionCode on updates.
- Game word/subject baseline: 33 categories / 771 words on Android; 25 / 600 source web JSON.
- User's local Android installation requires JVM 21 and regional Aliyun mirror when remote Google Maven is unreachable.

## Active next-step order (unless user changes priority)

1. Packaging milestone complete: user verified signed APK, actual Android manifest details and six essential real-phone test cases.
2. Review name and logo directions with user, then make the chosen brand consistent across source assets, Android and PWA. Do not change package ID or key casually.
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
