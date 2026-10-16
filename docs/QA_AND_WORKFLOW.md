# Codex task workflow, QA matrix and measured-performance checklist

Use this after AGENTS.md for any user task that changes shared UI/game behavior or release-sensitive code. Written for focused coding sessions; it intentionally distinguishes tests already implemented from tests still needed.

## 1. Starting any new Codex session (minimal context)

1. Read root AGENTS.md, then mobile/AGENTS.md if targeting Android.
2. Read only one topic document relevant to the task: PROJECT_MAP, GAME_FLOW, ANDROID_RELEASE, or BRANDING_AND_CONTENT; consult STATUS_AND_DECISIONS for latest milestones/decisions.
3. Identify requested behavior and acceptance criteria. Choose the smallest source files. Inspect the exact functions/JSX styles or affected scripts only.
4. Make a narrow, reversible change. Do not mass-format or re-architect unrequested subsystems. Don't paste whole repo into the conversation.
5. Run relevant checks and report accurate pass/fail/not-run evidence.
6. If a meaningful architecture decision, game rule, release requirement, brand decision, or content baseline changed, update the relevant docs and status document.

### Reusable task-brief template

    Goal:
    Android / Web / both:
    Desired UX and acceptance cases:
    Must remain unchanged:
    Data migration / signing / publication constraints:
    Devices / runtime to test:
    Files suggested by AGENTS (Codex decides final scope):
    Definition of done:
      [ ] Minimal code diff
      [ ] No extra network/API/MySQL in Android
      [ ] Local tests and mobile build
      [ ] Native build if needed
      [ ] Relevant device UX checks (or report untested)
      [ ] Concise report + updated docs if needed

### Response to user after a task

    Outcome: exact behavior changed, not "all fixed".
    Source files: list with short rationale.
    Verification: commands executed; results; what wasn't run.
    Risks: data migration, device-only checks, store identity, missing evidence.
    Next action: one or two concrete steps.

## 2. Where to look first for common requests

| User request | First source files | Docs |
| --- | --- | --- |
| New screen, animation, layout | components/game/GameApp.tsx, app/globals.css | GAME_FLOW, PROJECT_MAP |
| Game rules, teams, score, risk 30 | GameApp.tsx, types/game.ts | GAME_FLOW |
| Timer stability, countdown/feedback | GameApp.tsx, TimerRing.tsx, app/globals.css | GAME_FLOW |
| New words, categories, difficulty | mobile/scripts/prepare.mjs, types/game.ts | BRANDING_AND_CONTENT |
| Offline, restore, no server | mobile/src/offline/*, prepare.mjs, GameApp | PROJECT_MAP, GAME_FLOW |
| Android Back, device lifecycle | mobile/src/native-back.ts, prepare.mjs | ANDROID_RELEASE |
| Icons and app label | public/icons/*, capacitor.config.ts, prepare.mjs, configure-android.mjs | BRANDING_AND_CONTENT |
| Gradle, SDK, store, signature | configure-android.mjs, .github/workflows/android.yml | ANDROID_RELEASE |
| Web MySQL/API | app/api/**, lib/game/**, prisma/** | PROJECT_MAP (out of Android-only scope) |

## 3. Tests CURRENTLY present vs missing

Present:
- mobile/tests/offline.test.mjs is a Node test suite that runs after npm run prepare:assets.
- Validates generated catalog category/word counts, IDs/slugs, difficulty/foreign-key association and per-category count metadata.
- Checks generation forces offline/restore and native back hook existence.
- Checks appId/RTL metadata.
- Checks Aliyun Gradle patch coverage declarations.
- npm run build runs TypeScript noEmit and Vite build for React assets.
- GitHub Actions builds debug and release APK/AAB and packages a standalone project; optional CI signing requires secrets.

Separate browser integration coverage (2026-10-16): `mobile/tests/game-flow.browser.js` is a reusable function accepting an isolated Playwright Page. It is not included in `npm test` and requires a Playwright browser runner. Build with `npm run build`, serve with `node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4173`, then pass that file to the Playwright runner (`browser_run_code_unsafe` supports `filename`). It clears the supplied test page's app storage; use a dedicated test profile, never a player's production session.

Verified in that tour: normal full game; HOME/resume from READY, CATEGORY, REVEAL, PLAYING, ROUND_RESULT, SCOREBOARD and WINNER; exact paused timer/turn/penalty preservation; reload during result animation; old-v1 expired deadline; eight-team setup draft; 320×568 footer position before/after scrolling; hidden words absent from DOM before reveal; personal topic/word add/edit/delete/duplicate/reload; continuous queue exhaustion and next-team no-score fallback; dark settings and visible modal close; risk30 success/forfeit; simulated native Back closing a library confirmation. No page errors or API requests. Also exercised a three-round match and 360×640 winner layout.

`npm test` now includes five personal-catalog behavior tests (merge/counts/IDs, Persian duplicate validation and atomic batches, edit/delete/non-recycled IDs, active-game protection, corruption/quota preservation), in addition to the original five.

Final update verification (2026-10-16): 10/10 Node tests; TypeScript/Vite build passed; full browser tour passed with zero page errors/API calls after the final gameplay changes. The continuous tour now consumes eleven personal words, including one replacement and nine correct answers, to exercise batch refill without repeat IDs. Additional random-category and viewport checks at 320×480, 390×844 and 768×1024 passed; reveal actions remained in view without horizontal overflow. Light reveal and dark personal editor screenshots were visually inspected. Final Capacitor sync with existing Aliyun configuration passed; JDK21 `gradlew --offline assembleDebug assembleRelease` finished `BUILD SUCCESSFUL in 22s` (261 tasks). Debug APK: 4,332,981 bytes; unsigned release APK: 3,329,292 bytes. Native bundled index SHA256 matches `mobile/dist/index.html`. These are new, locally assembled artifacts, not the owner's previously signed APK. Root Next.js build was not run (root dependencies are absent); shared React/TypeScript sources were compiled through mobile generation.

Not verified by these checks / NOT safe to claim:
- Physical phone UX, sound, vibration, background/foreground, timing and install/update behavior.
- A new owner's release signature or installation/update behavior after these changes (previous signed APK evidence remains in STATUS_AND_DECISIONS).
- Browser frame-time/perf benchmark on low-end Android hardware.
- Actual Bazaar/Myket upload or review status.

Do not represent a passing unit test or CI as a real-device functional test or proof of store compliance.

## 4. Fast checks by change type

### UI/game/core logic
From mobile/:

    npm test
    npm run build

If native packaging needs to be refreshed:

    npm run android:sync

Then Android Gradle build when accessible:

    cd android
    .\gradlew.bat assembleRelease

Root web separately, when shared code changes:

    npm install
    npm run lint
    npm run build

Web build may need Next/font network and optional MySQL configuration for online routes; do not force a database setup just to test Android.

### Game smoke tour — required before declaring ready for users

1. Fresh install; HOME screen; settings, theme light/dark, sound.
2. SETUP 2/8 teams, names, rounds min/max, duration preset/custom, category choices.
3. READY pass-the-device screen, CATEGORY list, select 2/4/6 points, ensure chosen combo locked only for that team.
4. REVEAL cover -> explicit word reveal and replacement (-1 point, only once), START timer.
5. PLAYING: correct/skip/fault options appropriate to SINGLE/CONTINUOUS, timer and end.
6. ROUND_RESULT scoring details, SCOREBOARD order, next team and round.
7. 30-risk correct (+30)/timeout forfeiture; finish when last active team/round exhausted.
8. WINNER, restart with same teams, new game, home.
9. Kill/background/restore mid-word and mid-timer; offline airplane mode; changes persist after closing/opening app.

### Visual QA — Android especially

- Right-to-left Persian typography; proper number/label direction and no clipped diacritics.
- Narrow phones 320–390 CSS px; safe area/notches/gesture navigation.
- Dark mode and system theme flip, different Android densities and text scaling.
- Keyboard and editable team names; no bottom actions hidden by keyboard.
- 60 FPS goal for simple transitions where hardware allows; avoid unjustified animation overdraw.
- Reduced-motion system setting, audio toggles, vibration permission/fallback.
- Word reveal privacy between teams (only actor sees prompt); no leak via accessibility overlays/notifications.
- Adaptive icon on actual launcher, dark/light, splash startup and foreground/background.

## 5. Performance diagnostics (measure before rewriting)

The current React client renders GameApp stateful UI. Timer tick is approximately 120ms; render frequency in PLAYING and frequent ref updates deserve profiling if animations stutter. The background CSS uses blur/ambient blobs and spring-style transitions. These are not automatically "bugs"; measure on real devices or browser profiler before removing visual flourishes.

Ideas when measurements show a bottleneck:
- Isolate countdown into a component that updates without re-rendering the entire GameApp tree.
- Avoid unnecessary array scanning of whole word packs in frequent loops.
- Use cached/precomputed eligible word indices for large catalog expansions while preserving no-repeat semantics.
- Cache UI measurements; avoid forced layouts/reflow in animations; prefer transform/opacity.
- Respect prefers-reduced-motion and budget blur/layers for weaker GPUs.
- Avoid untested major state-management rewrites.

Never claim the app is "fully optimized"/"buttery smooth" solely from a Vite/Gradle build.

## 6. Core regression checklist by risk

### Game state and timing
- Do refs / event locks still prevent double scoring, double finish, double navigation?
- Are elapsed time and speed bonus computed from timestamp rather than interval count?
- Is SINGLE behavior separate from CONTINUOUS? Is skip disallowed where intended?
- Does forfeit on failed 30 risk remove the right team?
- Are usedChoices and usedWordIds independent and preserved across resuming?

### Local persistence and upgrades
- Are pantomin-* localStorage keys unchanged or properly migrated?
- Does snapshot version 1 still parse?
- Are category IDs and word IDs stable across packaging changes?
- Does a previous active game continue when installing the updated signed APK?
- Does app back navigation respect existing save/exit semantics?

### Android-only contract
- Does no backend get called to start/continue/score?
- Are icons/fonts/catalog in packaged assets and usable without connectivity?
- Did prepare.mjs run and update generated files consistently?
- Did configure-android.mjs run and apply native patches?
- Is output signed with the same key and package ID as prior published app?
- Did versionCode increment if this is an update?

## 7. Known risk watchlist (do not present unverified bugs as confirmed)

- Replacing string anchors in prepare.mjs can break if the canonical GameApp is heavily refactored; test mobile build immediately after shared changes.
- Native Back listener currently returns non-HOME screens to HOME rather than following a stacked navigation history; verify UX, confirmation and snapshot behavior on device.
- Device lifecycle: timer expiry while app backgrounded or killed needs testing, especially delayed result-resolution callbacks.
- Huge category additions could increase word filtering cost; repeated word and choice exhaustion can happen in long sessions.
- Custom launcher icon implementation uses a single copied PNG; maskable/adaptive needs validation for store polish.
- Maven mirrors affect generated Capacitor build files in node_modules; npm install can reset the patch.
- Signed Release APK has been compiled locally, but signature/device/store QA still pending in current status.
- Android app has no server, user accounts or cloud backup; no misleading marketing claims.

## 8. Docs upkeep protocol

After every significant task, update **only** the affected docs:
- Actual game rule/state changes -> GAME_FLOW.
- Changed directories/source boundaries -> PROJECT_MAP.
- Android SDK/native publication changes -> ANDROID_RELEASE.
- Chosen brand or icon/catalg counts -> BRANDING_AND_CONTENT.
- New QA tooling/checks or accepted risks -> this file.
- User's concrete decisions and latest externally verified stage -> STATUS_AND_DECISIONS.

Do not overwrite user decisions or claim future work complete. Preserve a short chronological factual change record when relevant.
