# Project map and dependency graph — verified 2026-10-16

Read after AGENTS.md only for architecture, ownership, or cross-platform feature tasks.

## Overview

Pantomin is one game UI with two delivery environments:

A. Next.js web/PWA: Next.js 16.2.12, React 19.2.8, TypeScript, Tailwind 4/custom CSS, optional Prisma 6.19/MySQL. The web app has ONLINE (async API/MySQL sync) and LOCAL (static JSON) modes.

B. Offline Android: React 19 + Vite 7 + Capacitor 7 + Android Gradle. The app bundles a generated copy of the web GameApp, shared components/styles, Android-local catalog, and a no-server networking adapter. Android gameplay is local; it does **not** start Next.js or host MySQL.

### Simplified dependency diagram

    Web route app/page.tsx
      -> components/game/GameApp.tsx (canonical UI + gameplay state)
            -> components/ui/AppShell.tsx, Button.tsx, Modal.tsx
            -> components/game/Mascot.tsx, TimerRing.tsx
            -> lib/game/catalog-client.ts (web: JSON for local, server API for online)
            -> lib/game/client-sync.ts (web: API calls / outbox)
            -> types/game.ts
      -> app/globals.css (CSS tokens + components + screens + animations)
      -> app/layout.tsx (RTL, metadata, next/font, PWA manager)

    mobile/scripts/prepare.mjs [at npm test / build / sync]
      -> copies GameApp/shared components/CSS/types to mobile/generated/
      -> replaces online-default / resume / settings code with offline-only variants
      -> replaces generated lib/game/catalog-client.ts with mobile/src/offline/catalog-client.ts
      -> replaces generated lib/game/client-sync.ts with mobile/src/offline/client-sync.ts
      -> reads public/data/catalog.json (web local JSON)
      -> extends it with additional curated groups, writes mobile/public/data/catalog.json
      -> copies public/icons assets into mobile/public/icons and mobile/assets/icon.png

    mobile/src/main.tsx
      -> mobile/generated/components/game/GameApp.tsx
      -> mobile/generated/globals.css
      -> offline local Vazirmatn font bundle
      -> mobile/src/native-back.ts

    mobile/vite.config.ts -> mobile/dist/*
      -> npx cap sync android -> mobile/android/app/src/main/assets/public/*
      -> mobile/scripts/configure-android.mjs [manifest, icon, signing hook, optional Maven mirrors]
      -> Android Studio / Gradle -> APK or AAB

## Source ownership table

| Concern | Edit first | Related |
| --- | --- | --- |
| Any UI/game rule | components/game/GameApp.tsx | app/globals.css, types/game.ts, mobile/scripts/prepare.mjs literal transforms |
| Mascot visuals | components/game/Mascot.tsx | app/globals.css mascot selectors |
| Timer ring | components/game/TimerRing.tsx | tick/expiry logic in GameApp, CSS |
| Shared controls/modal | components/ui/* | app/globals.css |
| Theme and visual tokens | app/globals.css (:root and html[data-theme=dark]) | app/layout.tsx + mobile/index.html flash prevention |
| Web local catalog | public/data/catalog.json | lib/game/catalog-client.ts |
| Mobile-only extra words | mobile/scripts/prepare.mjs | mobile/tests/offline.test.mjs |
| Mobile offline transport and selection | mobile/src/offline/* | prepare alias overrides, GameApp.tsx |
| Android startup/native Back | mobile/src/main.tsx; mobile/src/native-back.ts | prepare.mjs generated game event listener |
| Native app metadata | mobile/capacitor.config.ts; mobile/scripts/configure-android.mjs | generated android/app/build.gradle, AndroidManifest.xml |
| Icons | public/icons/* | mobile/scripts/prepare.mjs, PWA manifest, app/layout.tsx |
| Native local Maven mirrors | mobile/scripts/configure-android.mjs | android/build.gradle and node_modules/@capacitor/** generated files |
| Web API/MySQL | app/api/**, lib/db/prisma.ts, prisma/schema.prisma | lib/game/validation.ts, server outbox |
| CI packaging | .github/workflows/android.yml | Node/Java/Gradle, optional signing secrets |
| Full release/store QA | docs/ANDROID_RELEASE.md, docs/QA_AND_WORKFLOW.md | test artifacts and device logs |

## Web server, optional/NOT shipped to Android

Routes:
- app/api/catalog/categories/route.ts; app/api/catalog/pack/route.ts.
- app/api/games/route.ts; game by ID route.
- app/api/games/[id]/choices/route.ts; words/queue and words/release.
- app/api/games/[id]/turns/start/route.ts; turns/[turnId]/fault and finish.
- app/api/games/[id]/answers/route.ts; words/change.
- app/api/health/route.ts.

Related: lib/game/validation.ts, lib/game/client-sync.ts, lib/db/prisma.ts, prisma/schema.prisma and prisma/seed.ts. The database models include Category, Word, Game, Team, GameRound, GameTurn, GameChoice, GameUsedWord, GameAnswer, GamePenalty, User, Setting. Web online mode records events on server and verifies scoring; Android offline mode uses device-local score/state and never executes those API calls. DO NOT attempt to "fix" Android by installing MySQL, setting DATABASE_URL or deploying backend.

## Build lifecycle and files that disappear

mobile/.gitignore excludes these generated outputs:
- node_modules/, dist/, generated/, public/, assets/, android/, .env*, *.jks, *.keystore.

This means editing mobile/android/app/src/main/AndroidManifest.xml, build.gradle, a copied icon, mobile/generated/GameApp.tsx, or mobile/public/data/catalog.json is **NOT** a persistent code change. The next build/regeneration or clean clone can remove such edits.

Durable change recipe:
1. Update original source (GameApp, CSS, data scripts, config).
2. Extend/review prepare.mjs if offline transform or catalog logic is affected.
3. Extend/review configure-android.mjs if native Android output is affected.
4. Run cd mobile && npm test && npm run build; for native changes npm run android:sync; Gradle build.
5. Check both web and mobile if shared source changed.

## State/data ownership

- Most gameplay state lives in GameApp React state: screen, setup, game, active team, categories, selected points, used choices/word IDs, queue, word, timer end, scores and modal.
- LocalStorage "pantomin-*" keys hold resume and preferences (see GAME_FLOW.md). Android uses the WebView's app-private localStorage; uninstall or clear app data erases it. There is no cloud sync.
- Catalog is deterministic build-time data. JSON entries have category IDs, word IDs, point levels, title/categoryName, and category count metadata.
- Native back button is sent to the generated React UI as a custom event. It is not Android navigation-stack routing.

## Browser, perf and design

- CSS in app/globals.css defines token palette (--bg, --surface, --accent, shadows), light/dark, animations, safe-area/mobile layout.
- Shared character uses CSS, not an external animation runtime.
- TimerRing only renders timer state; GameApp uses Date.now/endAt to avoid interval drift.
- Vite bundles local @fontsource-variable/vazirmatn; website separately uses Next next/font/google.
- Motion quality must be profiled on mid/low-range Android devices, not judged from a desktop GPU alone.

## Reconciling docs with source

README.md at web root describes older MySQL/PWA functionality and includes historical counts. mobile/README.md covers setup and distribution. Some local-user steps (manual SDK installation, signed APK wizard) exist only in docs/ANDROID_RELEASE.md because they are machine-specific.

After changing architecture, update this map; don't keep two contradictory "sources of truth".
