# Agent instructions

- Prefer minimal, local changes.
- Read only files relevant to the task.
- Do not broaden scope without approval.
- Do not add CI, coverage, dependencies, refactors, or documentation unless requested.
- Run the smallest relevant existing validation command.
- Stop after the requested behavior is implemented and verified.
- Ask before changing more than 5 files or running expensive commands.
- Maximum two attempts for a failing check.
- Report changed files, exact checks run, and unresolved issues concisely.
# TURN standing rules

- TURN is designed for universal access: accessibility is a constraint on every change, not a feature.
- Performance and smooth frames come before richer sound or visuals.
- Colours come from the semantic tokens in `turn/design-tokens.css`, never hard-coded.
- Anything that runs during a race must stop on pause, leave and background: `race/race-pause.js` and `leaveRace()` in `race/session-orchestrator.js`.
- Mockups show intent. Names, lengths and counts in them may be worst-case placeholders; ask which parts are literal when unsure.

## Releases

- Every device-facing change ships as a release. Bump `turn/release.json` (`version`, `id` `YYYY.MM.DD-rNNN`, `cacheKey` `YYYYMMDD-rNNN`), then run `node turn/scripts/release.mjs --write` and `--check`. The script updates `CURRENT_RELEASE` and every module route, including `yourturn/index.html`.
- The changelog (`turn/content/about-history.js`) lists lasting milestones only, by completion date. Add an entry only for a new player-facing capability. Fixes and refinements to an existing milestone get none.
- Before pushing, run `node turn-tests/release-composition-production.mjs --base origin/main` and `npx --yes eslint@9.39.1 turn turn-tests` (0 errors).
- Squash-merge. Never merge #997.
- Post a short summary of each merged release on issue #928.
- When a change alters how others work (release steps, sources of truth), say so in its PR and in #928.
