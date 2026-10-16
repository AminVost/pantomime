# Branding, name, icon, typography and word-catalog guide

This is planning guidance for Codex, NOT authorization to rename or replace anything. User wants to review the name and create a unique, attention-grabbing logo later, while preserving the actual game experience.

## 1. Current baseline verified in source

- Working display name: «پانتومین». Homepage tagline: «کمتر حرف بزن، بیشتر بازی کن.»
- Android package ID: ir.aminvost.pantomime. This is a durable update identity, independent of app name and icon.
- Logo/brand heading currently rendered by components/game/GameApp.tsx; small "پ" mark is CSS/markup.
- CSS mascot: components/game/Mascot.tsx and its rules in app/globals.css.
- Main styling: app/globals.css :root and html[data-theme="dark"]. Key tokens --bg, --surface, --text, --accent, --accent-2, --success, --danger; current recognizable purple/cyan highlights.
- Font: Vazirmatn; web uses Next/font in app/layout.tsx, mobile uses locally bundled @fontsource-variable/vazirmatn.
- Web icons: public/icons/icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png.
- Current Android build script uses icon-512 as drawable-nodpi/pantomime_icon.png (a basic icon approach, adaptive icon layers not yet separately designed/verified).
- Name also appears in mobile/index.html, mobile/capacitor.config.ts, app/layout.tsx, public/manifest.webmanifest, README/docs.

## 2. Proposed brand-review workflow (do not skip user approval)

When asked to start:
1. Get direction: family-friendly, humorous, energetic, premium, minimal, distinctive Persian identity; desired age group; name must be easy to say and find in Bazaar/Myket.
2. Propose 3–5 distinct Persian names, optional transliteration, one-line rationale, tagline, logo metaphor; avoid generic terms and inflated claims.
3. Research obvious store/name/domain collision and trademark risks as feasible; a quick search is NOT legal clearance.
4. Wait for user to select the actual name/concept. Until then, current name and package ID remain untouched.
5. Develop 2–3 unique mark directions that communicate body language/guessing/team play, not a generic AI swirl, speech bubble or stock icon. Prefer striking silhouette, legibility at 48dp, smooth curves, accessible contrast, no microscopic text.
6. Finalize mark and visual system; generate/produce properly licensed *source* (prefer editable vector SVG if possible), export Android launcher assets and store icon in required sizes/format.
7. Test icon with adaptive launcher masks, light/dark system themes, notification/background surfaces, dense launcher grid. Keep subject safely inside masks.
8. Only then implement approved logo/name in all source assets and app metadata, build and verify on device.
9. Capture actual release-build screenshots after final design. Do not present fabricated in-app screenshots for store upload.

## 3. Comprehensive rename impact

| Owner | What to update | Consequence |
| --- | --- | --- |
| components/game/GameApp.tsx | HOME logo heading, tagline, mini headers, visible brand copy | canonical UI also used in mobile |
| app/globals.css | style of wordmark/mark/mascot/brand colors | both platforms, light/dark modes |
| app/layout.tsx | web title, description, applicationName, Apple PWA titles | web only |
| public/manifest.webmanifest | web/PWA name, short_name, description, icons | web/PWA |
| mobile/index.html | Android WebView document title and metadata | mobile web container |
| mobile/capacitor.config.ts | native appName (visible launcher app label) | requires Capacitor sync; verify Android label |
| public/icons/* | source icons used in web and copied to mobile | regenerate both, verify masks |
| mobile/scripts/prepare.mjs | icon copy + possible hard-coded display strings/transforms | regenerated icons/GamApp |
| mobile/scripts/configure-android.mjs | Android icon injection/mask strategy and native metadata | regenerated Android project |
| README, docs, store listing | name, marketing, screenshots | publishing/discoverability |
| package.json, mobile/package.json | optional package internal name | NOT equivalent to Android appId |
| persisted keys "pantomin-*" | ideally keep unchanged | renaming them without migration erases users' stored sessions |
| android appId | only before publication and with explicit user approval | after publication changes create a different app; affects updates |
| private signing key | KEEP SAME | losing/changing can break store updates |

Do not accidentally migrate package identifier when simply renaming the app's visible label. After first Bazaar/Myket publication package ID and key should be treated as release invariants.

## 4. Deliverable quality for icons/branding

At minimum: editable master/vector for retained design source, full-resolution launcher image, maskable/adaptive icon foreground/background where supported, 192px and 512px web icons, Apple touch icon if PWA continues, high-res store listing icon and screenshots per current market rules. Ensure PNGs are generated from the master, not scaled up from a tiny existing icon. Include a visually checked light/dark preview and RTL logo lockup.

Avoid shipping font files to users via chat. Font dependency code/package is fine; never expose proprietary/unlicensed assets or secret signing material.

### Do not overlook the native generator

The default source icon is public/icons/icon-512.png; prepare.mjs copies it to mobile/assets/icon.png and mobile/public/icons. configure-android.mjs copies from mobile/public/icons to Android drawable. A manual edit of mobile/android/res or mobile/public/icons alone is lost when regenerated.

For a more sophisticated adaptive icon process, implement deterministic script-based image generation or a tracked native resource strategy, update tests, and verify APK launcher masks. Do not assume current one-PNG drawable implementation is store-polished.

## 5. Offline words and category data (NO MySQL on Android)

**Canonical web local catalog**: public/data/catalog.json; currently 25 categories / 600 words.

**Mobile extra catalog**: mobile/scripts/prepare.mjs const additions (eight extra categories, across 2/4/6 levels) and const extras (new entries for some existing slugs). During prepare, original JSON is loaded, category/word IDs are appended, duplicate titles in the same category are filtered, category difficulty counts are recomputed, and the result is written to generated mobile/public/data/catalog.json.

Current generated Android baseline: **33 categories, 771 words**. This is a baseline to update after approved content changes, not a hardcoded gameplay limit.

Types in types/game.ts:
- CategoryDTO { id:number, name:string, slug:string, icon:string|null, counts:{ points2, points4, points6 } }.
- CatalogWordDTO { id:number, title:string, categoryId:number, points:2|4|6, categoryName:string }.
- App's word queue WordDTO contains ID/title/points/categoryName.
- UsedWordIds prevents exact ID reuse in same game. Category+point combination is locked separately per team.
- Risk 30 uses a 6-point word candidate from enabled categories and scores 30 in GameApp.

### Mobile-only added slugs

- iranian-cinema — سینمای ایران
- party-time — دورهمی و مهمانی
- funny-moments — اتفاقات خنده‌دار
- travel-adventure — سفر و ماجراجویی
- digital-life — دنیای دیجیتال
- football-moments — ماجراهای فوتبالی
- fantasy-world — افسانه و خیال
- daily-adventures — زندگی روزمره

Existing-category extras are keyed by slug in mobile/scripts/prepare.mjs. Web Prisma seed lives in prisma/seed.ts but is not read by the mobile app.

## 6. Content editing rules

- Entries must be understandable, fun, physically actable without dialogue, suitable for intended Iranian age group, and assigned realistic 2 (easy), 4 (medium), 6 (hard) levels.
- Normalize Persian orthography (ی/ي, ک/ك, diacritics, spacing and ZWNJ) and check near-duplicates, not just exact string matches.
- Avoid low-quality filler, obscure/exclusionary jokes, defamatory stereotypes, copying copyrighted creative works as asset art, or age-inappropriate material.
- Preserve existing IDs wherever possible; do not break saved active games/category preferences.
- Increasing the total pack doesn't solve starvation of a single rare difficulty: verify words per category and long continuous-mode sessions.
- Avoid unrequested network-backed catalog and unconsented analytics/ads.

### Minimal content workflow

1. Edit mobile/scripts/prepare.mjs for mobile-only words, or intentionally coordinate original public/data/catalog.json/web seed changes with the user.
2. Run cd mobile && npm test && npm run build.
3. Inspect generated JSON for unique IDs/slugs, valid point bands, count fields and sample phrasing.
4. Test reuse/exhaustion for SINGLE, CONTINUOUS and risk-30 path.
5. Regenerate Android with npm run android:sync, build fresh signed release.
6. Update this document's category/count baseline and docs/STATUS_AND_DECISIONS.md.

## 7. Store listing content (post-approval)

Use the final selected brand in Persian; align icon/logo/tagline with screenshots **taken from actual app**: HOME, setup, categories, reveal, timer/score and winner. Disclose that gameplay is offline, saved only on-device, no account sync; do not claim features not implemented. Verify current Bazaar/Myket screenshot dimensions and privacy/age-policy requirements from their live developer consoles when publishing.

## 8. Brand acceptance criteria

- One approved name + original logo concept.
- Icon legible at small scale and both themes; no corner clipping under masks.
- Consistent source web/PWA/Android branding and app labels.
- No change to package ID or signing certificate after publication.
- All nine game screens/flows work, RTL and responsive layout remain intact.
- Store screenshots reflect the final version and logo.
