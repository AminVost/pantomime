# AGENTS.md — Pantomin / Pantomime repository (Codex operating contract)

> Read this file first. It exists so subsequent Codex sessions can work on the requested feature without re-tracing the whole repository. This is a **working guide**, not a substitute for checking the precise functions being edited.
> Last code-grounded review: 2026-10-16. Read the topic-specific file under docs/ only when that topic is relevant.

## 0. Mission and current priority

- Product: «پانتومین» — Persian/RTL, mobile-first group charades game.
- User wants a polished, very responsive and visually distinctive **offline Android app** for **Café Bazaar and Myket** while retaining the established game flow/design. Improvements, new words and branding work are expected later.
- The web/PWA project stays functional and has optional online/MySQL support. **Do not add API/MySQL/network dependence to the Android edition** unless the user explicitly changes this requirement.
- As of this guide, **name/logo are NOT finalized**. Propose options when asked; do not rename the Android package ID or overwrite branding assets without explicit selection.
- Do not silently reshape core game rules, scoring, animations or navigation. Protect player data across updates.

## 1. Know which product you are changing

| Product | Runtime entry | Data | Build |
| --- | --- | --- | --- |
| Web/PWA | app/page.tsx -> components/game/GameApp.tsx | Local JSON or optional API/MySQL (Prisma) | root npm/Next.js |
| Android offline | mobile/src/main.tsx -> generated/components/game/GameApp.tsx | embedded JSON; device localStorage | mobile npm/Vite -> Capacitor -> Gradle |

The Android project is intentionally **not** a fully independent second implementation. During every mobile build, mobile/scripts/prepare.mjs copies the canonical UI/components/styles into mobile/generated/ and modifies a few explicit runtime-mode expressions to force "local". The generated code, dist, public assets, and native Android directory are ignored by mobile/.gitignore.

**Authoritative files, not generated outputs:**
1. Gameplay or screen UI: components/game/GameApp.tsx.
2. Styling/design tokens: app/globals.css and shared components/game/*, components/ui/*.
3. Local offline word selection: mobile/src/offline/catalog-client.ts.
4. Local offline networking stubs: mobile/src/offline/client-sync.ts.
5. Android-specific forced-offline transforms, extra categories, asset copying: mobile/scripts/prepare.mjs.
6. Android branding/manifest/Gradle/signed-release plumbing: mobile/capacitor.config.ts, mobile/scripts/configure-android.mjs.
7. Web server behavior only: app/api/**, lib/game/**, prisma/**.
8. Source PWA data for web: public/data/catalog.json; Android augmented output: mobile/public/data/catalog.json (**generated**).

**Never treat mobile/generated/** or mobile/android/** as durable source when working in the Git branch. These folders are created locally. Edit their controlling files and regenerate. If a native fix is necessary, add a reproducible change to mobile/scripts/configure-android.mjs (or deliberately adopt a tracked native-project strategy with approval).**

## 2. Read by task, NOT the entire repository

- Gameplay, scoring, lifecycle, resume, navigation: docs/GAME_FLOW.md; then examine relevant functions in GameApp.tsx.
- Architecture, ownership, mobile-vs-web: docs/PROJECT_MAP.md.
- Android build, SDK, signing, release, Iranian Maven routing: docs/ANDROID_RELEASE.md.
- Name/logo/icon/Persian typography or words: docs/BRANDING_AND_CONTENT.md.
- Regression criteria, verification, task workflow and known watchpoints: docs/QA_AND_WORKFLOW.md.
- Latest user-confirmed device results and release stage: docs/STATUS_AND_DECISIONS.md.

When the task is clear, open its specific files only. Do not perform an unrequested whole-repository audit every task. If source or this guide disagrees, **source wins**: report the discrepancy and update the guide after verification.

## 3. Hard requirements / invariants

1. RTL Persian layout, Vazirmatn, responsive small phones, light/dark/system support, visual quality. Keep established gradient, mascot and motions unless redesign is requested.
2. Existing screen journey: HOME -> SETUP -> READY -> CATEGORY -> REVEAL -> PLAYING -> ROUND_RESULT -> SCOREBOARD -> READY or WINNER. Modals are independent.
3. Team size 2..8; rounds 1..20; standard durations 30/45/60/90/120, custom 15..300 seconds (verify any future UX validation).
4. Standard levels 2/4/6; special risk 30; SINGLE and CONTINUOUS modes; correct/skip/fault/word-change semantics must remain stable. See GAME_FLOW.md for exact rules.
5. Per-team category + points choice uniqueness; word IDs must not repeat in a game; same-device resume persists in localStorage.
6. Keep timer drift-resistant using end timestamp, not accumulated intervals. Test background/foreground and expiration.
7. Android is 100% offline gameplay with **no MySQL requirement**; fetch("/data/catalog.json") reads packaged WebView assets, NOT an external server. Do not add INTERNET permission or telemetry by default.
8. Keep package ID ir.aminvost.pantomime and signing identity stable **once published**. Changing display name and store graphics is distinct from changing package ID.
9. Keystore, key passwords, signing secrets, passwords, .env, private credentials: NEVER request their values in chat/output, log, commit, screenshots or PRs.
10. Keep changes small, preserve backwards compatibility for existing localStorage state and previously installed user versions when feasible.

## 4. Build commands and source-of-truth workflow

On Windows, at repository root:
- Web: npm install; npm run dev / npm run build (web build may need environment; MySQL is for online mode).
- Mobile: cd mobile; npm install; npm test; npm run build.
- **Only first time**: npm run android:init (creates mobile/android with cap add).
- After edits: cd mobile; npm run android:sync (re-generates UI bundle and native configuration); then npm run android:open.
- Windows Gradle: cd mobile/android; .\gradlew.bat assembleDebug or .\gradlew.bat assembleRelease.
- To generate signed release, use Android Studio > Build > Generate Signed App Bundle / APK > existing keystore > release; never conflate this with an automatically signed debug build.
- Regional mirror for restricted Google Maven access (PowerShell): $env:PANTOMIME_MAVEN_MIRROR="aliyun"; npm run android:configure. The configure script patches root and Capacitor subproject Gradle repositories and is **re-run after npm install or cap sync**.
- Android SDK API 35 and JDK 21 were needed on the owner's Windows environment. Do not downgrade AGP or alter targetSdk as a first response to environment/network errors. See docs/ANDROID_RELEASE.md.

The separate CI workflow .github/workflows/android.yml builds on the Android feature branch. Passing CI is not evidence of successful manual signing, install on a real device, or store approval.

## 5. How to implement a feature (follow this sequence)

1. Translate the user request into affected screens/game rules and acceptance criteria.
2. Read AGENTS + **one** relevant topic doc; inspect only the directly related source functions, tests and styles.
3. State likely impact on **both** web and Android. If Android-only, prefer appropriate mobile source/config rather than altering web unnecessarily.
4. Implement a focused diff; do not refactor unrelated code or run broad beautifiers.
5. Run the minimum relevant checks, plus cd mobile && npm test && npm run build for any shared UI, game logic, mobile, words, style or packaging change.
6. For release-related changes, validate Gradle assembleRelease / signing and installed behavior when device/tooling is available.
7. Summarize actual files changed, verified results, known limitations, and potential upgrade/data/market risks. Never say "tested on device" without real device evidence.
8. Update relevant topic docs + STATUS_AND_DECISIONS.md when architecture, rules, brand, release identity, or procedure actually changes; avoid rewriting documents for cosmetic code-only changes.

### Task response format expected from Codex
- Scope/acceptance criteria (one short paragraph)
- Files and why
- What was changed
- Verification commands + pass/fail/not run
- Outstanding issues/risks
- Documentation updates if needed

## 6. High-risk edits

- GameApp.tsx contains dense stateful code; avoid breaking its literal anchors used in mobile/scripts/prepare.mjs. After changing it, run the mobile build: prepare will fail intentionally when anchors move. For larger structural changes, migrate away from text patching only as a planned refactor with matching tests.
- Android assets are regenerated. To change the icon, update public/icons/icon-192.png, icon-512.png, icon-maskable-512.png (and web Apple icon as appropriate), and the asset generation pipeline. mobile/assets/icon.png and the Android drawable come from public/icons/icon-512.png.
- Adding words: use mobile/scripts/prepare.mjs "additions"/"extras" for mobile-only, or consciously update web catalog and Prisma seed if web should change too. Do NOT hand-edit mobile/public/data/catalog.json. Preserve category/word IDs and duplicate rules.
- Changing persisted storage key or schema requires migration and upgrade regression tests, NOT silent reset.
- Renaming: display copy, PWA metadata, mobile/index.html, capacitor.config.ts, and launcher graphics are separate concerns. The package ID and signing keystore must be handled as immutable release identity once published.

## 7. Verification matrix (minimum)

| Changed area | Required checks |
| --- | --- |
| React game/UI/style | Mobile npm test + npm run build; targeted walkthrough HOME through WINNER, RTL/dark/small-screen |
| Local catalog | Counts/unique IDs/slugs/word titles/points, selections/used-word behavior, 30-point path |
| Native Android/build | Android Sync, Gradle APK build, permission/manifest, launcher, Android back |
| Branding | App label + launcher icon + store icon + dark/light + splash if applicable, no clipping |
| Publishing | Signed *release* artifact; verify signature/package/version/target SDK; real-device offline run |
| Web or API | Root build/test relevant route; avoid unexpected DB dependency in mobile |

Reference docs are **baseline knowledge**, not authorization to assume a future task is complete.
