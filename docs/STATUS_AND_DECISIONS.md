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

## Still OPEN / NOT VERIFIED

- Locate the final release APK built by Android Studio's signed wizard; independently verify apksigner signature/certificate SHA-256, package ID, versionCode/versionName and target SDK.
- Install exactly that release APK on real Android device; test a full game offline, theme/sound/vibration, app resume, background timer, Android Back and long session.
- Decide final public app name and logo. No approved alternative chosen yet.
- Replace/verify launcher and store graphics in all variants; screenshots must reflect actual shipped build.
- Prepare accurate store metadata, privacy statement and support contact; check live Bazaar/Myket rules.
- Upload to Bazaar and Myket, monitor review feedback; no publication/acceptance confirmed.
- Evaluate automated end-to-end UI tests and more robust data migration/word addition validation as future engineering work.

## Release identity and baseline snapshot

- Current display label: پانتومین.
- Current Android appId/package ID: ir.aminvost.pantomime.
- Owner-created signing alias: pantomime; actual keystore/private passwords unknown to Codex and must remain private.
- Generated app target/compile SDK from Capacitor baseline: 35; verify exact value in compiled manifest.
- App version in mobile/package.json: 1.0.0 (not proof of compiled versionCode).
- Game word/subject baseline: 33 categories / 771 words on Android; 25 / 600 source web JSON.
- User's local Android installation requires JVM 21 and regional Aliyun mirror when remote Google Maven is unreachable.

## Active next-step order (unless the user changes priority)

1. Verify signed APK and release metadata without exposing signing secrets. Have user run apksigner or inspect the APK in Android Studio; never treat build success as signature confirmation.
2. One real-device offline release smoke test; record deviations/bugs.
3. User chooses name and logo direction. Codex works on task-specific UI/branding changes, only after approval.
4. New game/product changes in small, validated commits with mobile build/regression checks.
5. Regenerate fresh signed release after final brand/content changes.
6. Upload the final artifact, not the earlier test build, to relevant stores.

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
