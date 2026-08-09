# Pantomime — Persian Pantomime Game

A complete, production-ready Persian charades web app focused on mobile devices, RTL support, fast gameplay, and an app-like user experience.

## Tech Stack

* Next.js 16 + React 19 + TypeScript
* Tailwind CSS 4 + custom design tokens
* Prisma ORM + MySQL
* Route Handlers for APIs
* Client-side drift-resistant timer
* LocalStorage for game resume, theme, and sound preferences
* Lightweight offline outbox for answers and turn completion
* CSS motion using `transform` / `opacity` with `prefers-reduced-motion` support

## Implemented Features

* Complete game flow from Home to Winner
* Support for 2 to 8 teams with custom names
* Preset round counts or a custom value from 1 to 20
* 30 / 45 / 60 / 90 / 120-second turn durations
* 25 database-backed categories
* 225 seeded words across 2 / 4 / 6-point difficulty levels
* Prevention of duplicate words within the same game
* Word queue and prefetching to eliminate delays between words
* Server-side scoring; scores submitted by the client are not trusted
* Tracking of correct/skipped answers and turn results
* Scoreboard and Winner screen
* Light / Dark / System themes with initial flash prevention
* Lightweight ambient animations and a custom CSS mascot
* Lightweight sound effects using the Web Audio API with mute support
* Haptic feedback on supported devices
* Game resume support on the same device
* Offline outbox for handling short network interruptions
* Health endpoint at `/api/health`
* PWA manifest and iOS/Android safe-area support

## Quick Start

### 1) Prerequisites

Node.js 22 LTS and MySQL 8 are recommended.

### 2) Database

Create a MySQL database and a dedicated database user with the required permissions.

Keep database credentials outside the repository and provide them through environment variables.

Alternatively, for development, you can use Docker:

```bash
docker compose up -d
```

### 3) Environment

```bash
cp .env.example .env
```

Configure `DATABASE_URL` in your local `.env` file using your own MySQL connection details.

Do not commit `.env` files or production database credentials to version control.

### 4) Install Dependencies and Initialize the Database

```bash
npm install
npm run setup
```

The `setup` command performs the following steps:

1. Generates the Prisma Client
2. Pushes the schema to MySQL
3. Seeds categories and words

### 5) Development

```bash
npm run dev
```

Then open:

```text
http://localhost:3000
```

### Production

```bash
npm run build
npm run start
```

For a real production environment, once the schema is stable, it is recommended to use Prisma migrations and `prisma migrate deploy` instead of `prisma db push`.

## Project Structure

```text
app/
  api/
    catalog/categories/
    games/
    health/
  globals.css
  layout.tsx
  page.tsx

components/
  game/
    GameApp.tsx
    Mascot.tsx
    TimerRing.tsx
  ui/
    AmbientBackground.tsx
    AppShell.tsx
    Button.tsx
    Modal.tsx

lib/
  db/prisma.ts
  game/client-sync.ts
  game/validation.ts
  utils/http.ts

prisma/
  schema.prisma
  seed.ts
```

## Main APIs

* `GET /api/catalog/categories`
* `POST /api/games`
* `GET /api/games/:id`
* `POST /api/games/:id/words/queue`
* `POST /api/games/:id/turns/start`
* `POST /api/games/:id/answers`
* `POST /api/games/:id/turns/:turnId/finish`
* `GET /api/health`

## Score Security

The client only reports whether a specific `wordId` was answered correctly or skipped.

The server verifies that:

* The game is active
* The turn is active and belongs to the current team
* The word was previously reserved for the same game
* The word has not already been answered
* The actual point value is retrieved directly from the `words` table

As a result, the client cannot submit an arbitrary score value to the server.

## Adding Categories or Words

The game runtime does not load words from a static source file.

The `prisma/seed.ts` file is only used to populate the initial MySQL data. After setup, categories and words can be managed directly through the database or through a future admin panel.

## Persian Font Stack

The CSS is configured with the following font stack:

```text
Vazirmatn → Noto Sans Arabic → Geeza Pro → Tahoma
```

For a branded production deployment, if you have a valid license for a custom font such as Yekan Bakh or IRANSansX, self-host the font in your deployment and replace the corresponding `font-family`.

## v1.4 — PWA / Local-first

* Each team independently selects a `category + point value` combination; a combination is locked only for that specific team.
* `Online`: The game runs instantly on the device while events are synchronized with MySQL in order in the background.
* `Local`: The game, scores, words, and resume state run entirely on the same device, with no API or database usage in the game loop.
* The local catalog contains 25 categories and 600 words in `public/data/catalog.json`.
* The PWA includes a manifest, Service Worker, app icons, and installation guidance for iOS and Android.
* The Service Worker is enabled only in production to prevent stale caches from interfering with local development.
