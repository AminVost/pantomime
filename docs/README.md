# Codex navigation index — read only what you need

**Start:** ../AGENTS.md (main rules) and ../mobile/AGENTS.md when working on Android-specific behavior. The purpose of these docs is to eliminate repeated broad repository tracing, not add extra token overhead.

| Your task | Read |
| --- | --- |
| New Codex work / current project state | STATUS_AND_DECISIONS.md |
| What owns a feature, what gets regenerated | PROJECT_MAP.md |
| Gameplay screens, score, special 30, timers, persistence | GAME_FLOW.md |
| Android Studio, Gradle, SDK, APK, signing, market publication | ANDROID_RELEASE.md |
| Product name, logo, icons, typography, categories/words | BRANDING_AND_CONTENT.md |
| Task intake, quality gates, performance, e2e/device tests | QA_AND_WORKFLOW.md |

Short repeatable Codex kickoff:

    Read AGENTS.md, mobile/AGENTS.md (if Android), docs/STATUS_AND_DECISIONS.md and
    the single topic document relevant to my request.
    Do not trace the whole repository. Read only the affected source functions,
    implement a minimal change, preserve Android offline/game design, run
    relevant tests/build and report verified results and remaining checks.
    Update docs only if the architecture, release state or decisions changed.

Documented facts verified through 2026-10-16; when source and docs disagree, inspect source and correct documentation.
