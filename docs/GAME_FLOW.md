# Game flow and rules — field guide for focused Codex work

Grounded in components/game/GameApp.tsx and types/game.ts as of 2026-10-16. This is not a feature-request backlog; protect existing behavior unless the user explicitly asks to change it.

## 1. Screens and transitions

    HOME
      | "شروع بازی" -> SETUP (4 setup steps)
      | "ادامه بازی" -> restored persisted Screen
      | rules/settings -> modal
      v
    SETUP
      step 0: team count 2..8 and names
      step 1: rounds 1..20, wheel/presets
      step 2: turn duration preset 30/45/60/90/120 or custom 15..300
      step 3: confirmation and category selection via settings
      | createGame
      v
    READY (pass phone to active team)
      | openCategorySelection
      v
    CATEGORY (per-team category+points, or special risk 30)
      | chooseCategoryPoints
      v
    REVEAL (privacy cover -> explicit reveal; one possible change for -1 score)
      | startTimer
      v
    PLAYING (timer, answer, fault, optional continuous skip)
      | correct in single -> finishRound
      | timer expiry -> beginTimeoutResolution -> finishRound
      | continuous -> next word / local batch refill until time or words end
      v
    ROUND_RESULT -> SCOREBOARD
      | next team / next round -> READY
      | if game finished -> WINNER
    WINNER -> same teams new game / new setup / home

Render entry points (in original GameApp):
- renderHome; renderSetup; renderReady; renderCategory; renderReveal
- renderPlaying; renderRoundResult; renderScoreboard; renderWinner
- Bottom of GameApp selects by screen string. Rule/Settings/Score appear as modal overlays.

## 2. Core helpers and owners

| Function / state | Role |
| --- | --- |
| initialConfig | 2 teams, 3 rounds, 60 seconds default |
| preferredCategoryIds | restores valid IDs or selects all categories |
| advanceGameLocally | advances current team in position order; skips forfeited; finish when round cap or <=1 active |
| localSpeedBonus | adds 1..3 bonus if correct within first third of allotted turn (only 2/4/6) |
| loadCategories | loads proper catalog and selected categories |
| resetForNewGame | clears saved active game and opens setup |
| resumeGame | rehydrates v1 snapshot and game state |
| createGame | validates setup, creates local IDs/game, enters READY |
| openCategorySelection | ensures legal category+points combinations, optionally picks category randomly |
| fetchQueue | selects unused words, registers chosen combination, preloads words |
| chooseCategoryPoints | locks points and previews selected word |
| changeWord | 1 use per turn; -1 score; replace unused word |
| startTimer | sets end timestamp and enters PLAYING |
| fetchQueue / registerAnswer | reserve initial batch and refill locally when the CONTINUOUS queue is consumed |
| registerFault | -1 point per fault; debounced |
| registerAnswer | CORRECT / SKIPPED, score and next-word logic |
| beginTimeoutResolution | visual feedback and delayed round completion |
| finishRound | result summary, forfeiture of failed risk-30, advance team/round |
| continueAfterResult / continueAfterScoreboard | navigation |

Find precise implementations by searching the function names, not by re-reading the entire GameApp. Internal refs (flowLockRef, actionLockRef, roundEndingRef, roundStatsRef, resolutionTimerRef) protect against double submissions/stale timed callbacks. Keep them when adjusting event paths.

## 3. Scoring and safeguards

- Difficulty choices: 2, 4, 6 (the word JSON's "points").
- One team may select a given category + difficulty only once per game; another team is independent.
- Each selected word ID is added to usedWordIds; selected queue excludes used IDs.
- SINGLE: correct score = chosen points plus speed bonus of 1..3 if guessed within first one-third of turn; correct ends turn. UI does not expose SKIPPED for SINGLE.
- CONTINUOUS: reserve up to 8 words initially and refill from the local catalog in batches when the queue is consumed; correct adds chosen points, SKIPPED adds 0 and advances. Time or word exhaustion ends the turn. Speed bonus is only for SINGLE. Word replacement can consume the next reserved word; it must be removed from the queue so it is not shown twice.
- Both modes: "fault" decreases team's score by 1; repeated faults are possible, with a brief action lock.
- REVEAL: word is not rendered before «نمایش کلمه». One word change per turn costs -1; replacement comes from the reserved queue or remaining catalog. An explicitly paused timed turn cannot change its word again on resume.
- CATEGORY disables exhausted difficulty/risk choices based on remaining words, not just original counts. If every legal choice is exhausted, «ادامه بدون امتیاز» advances the team without changing its score (important for small personal catalogs).
- Special 30 risk: selectedPoints = 30; current candidate is picked from enabled categories' 6-point words, score for successful answer is **30**, no speed bonus, no skip. If timeout before correct answer, mark active team forfeited. Special 30 may be chosen once by each team; on failed risk, remaining team(s) continue or game ends as per advanceGameLocally.
- Scoreboard sorts non-forfeited first, then score descending, then original team position.
- Treat "used category combination" and "used word" as distinct concepts.

Potential touchpoints if changing scores: registerAnswer, registerFault, changeWord, finishRound, UI summaries, the (web-only) server scoring endpoints, and corresponding tests. Online mode remains separate from offline.

## 4. Timer and lifecycle

- Home is available from all game screens. In local mode, explicit Home/Android Back pauses with exact milliseconds and saves the original screen; resume goes through REVEAL privacy and «ادامه زمان», keeping the same turn ID/queue/penalties. Online web mode keeps its existing server deadline.
- Backgrounding or killing the process without explicitly going Home does not pause time. An expired saved deadline resolves as timeout; an unexpired local turn is covered on restore before continuing.
- Feedback resolution is persisted (`resolutionReason`) so killing/reloading during the 620ms result animation cannot leave PLAYING with a null timer. Deferred result effects are cleaned up on screen change.

- startTimer creates timerEndAt = Date.now() + roundDuration * 1000; setInterval runs ~120ms but elapsed time uses wall clock.
- Displayed remaining time is ceil((timerEndAt - Date.now()) / 1000), bounded at 0.
- Last 10 seconds trigger tick feedback if tick value changed.
- Audio update (2026-10-31): shared `GameAudio.ts` preloads packaged AAC cues and two original music loops after a user gesture. Start rings immediately, timeout plays the user's full 3.04-second clip, last-ten-second cues duck the music. Music stops on turn completion, explicit Home and app background; restored/paused turns keep existing deadline semantics. Master mute and separate effects/music levels are saved locally.
- Expiry triggers feedback state then delayed finish (~620ms). Correct SINGLE also uses a resolution delay. Rapid taps are gated by locks.
- Snapshot stores timerEndAt and relevant turn state. App background/resume requires validation: don't assume a foreground interval reliably runs in background.
- For changes to pause/resume, inspect both screen transition and persisted snapshot. Test app termination, background expiration, unmounts and duplicate effects.

## 5. LocalStorage contract (do not silently rename)

| Key | Purpose |
| --- | --- |
| pantomin-active-game-v1 | PersistedSnapshot version 1; team/round, queue, word, used IDs, choices, timer, screen |
| pantomin-setup-v1 | Unfinished setup config and step; removed when a game is created/replaced |
| pantomin-personal-catalog-v1 | Android personal categories/words and monotonic negative ID allocator |
| pantomin-sound-v1 | on/off |
| pantomin-theme | light/dark/system |
| pantomin-category-preferences-v1 | selected category IDs |
| pantomin-random-category-v1 | on/off |
| pantomin-continuous-mode-v1 | on/off |
| pantomin-runtime-mode-v1 | original web online/local preference; mobile forced local by prepare |
| pantomin-online-catalog-v1 | web online cached pack only |
| pantomin-outbox-v1 | web API pending events only |

The Android app stores data inside private WebView storage. Deleting the app or Clear Storage deletes it; **do not claim sync across phones**.

PersistedSnapshot.version = 1; if fields change, plan migration/fallback instead of indiscriminate removal. Reset/resume may be impacted by changing available categories/word IDs. Test upgrades with an active saved game.

Optional fields added 2026-10-31: `config.teamStyles` and `TeamDTO.avatarId`. Missing values fall back by team position, preserving old saves. Setup offers eight original SVG mascots and eight named colors. New preferences: `pantomin-music-v1` (`neon`/`playful`/`off`) and `pantomin-audio-levels-v1` (effects/music volumes 0..1). Existing sound mute key remains authoritative. Assets and shared audio/avatar components are copied by `mobile/scripts/prepare.mjs`.

Optional snapshot fields added 2026-10-16: `pausedRemainingMs` and `resolutionReason` (`correct` / `timeout`). Missing fields use the original deadline and legacy completion fallback. Word visibility is deliberately not persisted. SETUP resume preserves current topic preferences, so settings changed on HOME are not overwritten by an old draft.

## 6. Mobile-only transforms in prepare.mjs

Original GameApp starts runtime modes as "online"; prepare.mjs replaces BOTH initial useState values with "local", forces storedRuntime and restored snapshot local, removes the complete runtime section from settings, and disables flush on boot. Native Back handling now lives in canonical GameApp (the personal library handles its nested dialogs). The original web code still has online support. **Each mobile build regenerates these adjustments.**

If function signatures or exact source strings change, prepare.mjs may throw "cannot safely patch" (by design). Update adapter and tests together; do not "fix" it by disabling the offline constraints.

## 7. Examples of focused test cases

- Team count 2, 8; names empty; 1 and 20 rounds; custom 15 and 300 seconds.
- Selecting disabled/unavailable category+points, selecting a previously used combination, selecting a different combination for another team.
- No repeated word IDs even after changeWord and queue refill.
- Correct near 0/first third/after bonus window; correct just before timeout.
- Fault twice, fault rapidly, change word once then try again, skip in continuous.
- Normal SINGLE turn vs CONTINUOUS batch refill and end.
- 30-point correct, failure/forfeit, team order after forfeit, last survivor wins.
- Save/reopen from REVEAL, PLAYING, SCOREBOARD, WINNER; simulated time expiration while in background.
- Light/dark/theme system, haptic/sound toggles, device back and modals.

## 8. Current limitations that deserve verification, not unsupported bug claims

- `mobile/tests/game-flow.browser.js` is a reusable Playwright tour, separate from `npm test`; see QA_AND_WORKFLOW for execution and tested cases.
- Native Back closes a modal first, otherwise saves/pauses to HOME, and can exit from HOME. Library Back closes its own confirmation or asks before discarding unsaved input. Actual Android events still require device verification.
- Timers during process death / long background suspension and deferred callbacks need real-device regression.
- Long session word exhaustion and category choice availability should be exercised.
- Screens inherit styling from shared global CSS; designer changes require Android small-screen testing.
