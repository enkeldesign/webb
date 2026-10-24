# Agent instructions

## Roles and ownership

- **Erik is TURN's product owner, design lead and accessibility lead.** Erik owns product direction, interaction/design decisions, accessibility interpretation and final acceptance.
- **OPUS is TURN's sole implementation developer.** OPUS owns code changes, fixes, refactors, implementation branches and implementation PRs unless Erik explicitly changes this policy.
- **CODEX is the independent formal code reviewer.** Review OPUS work for correctness, regressions, architecture, accessibility implementation, performance, test gaps and release integrity. CODEX reviews by default rather than rewriting the implementation; findings go back to OPUS unless Erik explicitly asks CODEX to make a fix.
- **SOL / ChatGPT is the product and coordination partner.** SOL supports brainstorming, product/design reasoning, requirements, GitHub issue writing and triage, testing interpretation, repository/PR inspection, research and lightweight advisory review in Chat. SOL does not implement code, create implementation branches/PRs, or merge TURN production changes unless Erik explicitly asks.
- Current `main` is the source of truth. Issues, comments, mockups and earlier discussions explain intent and history but do not override current repository state.

## Agent workflow

- Erik + SOL may define, refine and triage work; OPUS implements it; CODEX independently reviews it; findings that require code changes return to OPUS.
- CODEX review findings use three levels: **blocker** = unsafe to merge/release; **should-fix** = genuine defect or material risk that should normally return to OPUS before merge; **nit** = optional improvement that does not block release.
- OPUS may merge a CODEX-reviewed, green, noncontroversial PR when the relevant release rules are satisfied. Erik approval is required for unresolved review findings, product/design decisions that materially change the brief, or intentional scope expansion.
- Do not silently broaden scope. If implementation exposes a product/design decision not covered by the brief or established TURN patterns, surface it to Erik rather than inventing a new product rule.
- Device-facing work that requires physical-device verification is not considered finished until Erik or the relevant reporter confirms it on device.
- Branch/PR review URLs for Cloudflare TURN previews must include `turn-admin=1` so the session-scoped review/admin tools are available. Append `?turn-admin=1` when there is no existing query string, or `&turn-admin=1` when the URL already has query parameters.

- Prefer minimal, local changes.
- Read only files relevant to the task.
- Do not broaden scope without approval.
- Do not add CI, coverage, dependencies, refactors, or documentation unless requested.
- Run the smallest relevant existing validation command.
- Stop after the requested behavior is implemented and verified.
- Use common sense about scope and tool/usage cost. Keep each PR focused and small enough to implement, review and validate without risking exhausting available usage in one pass; split the work or ask Erik before proceeding when a PR or command set is becoming disproportionately large or expensive.
- Maximum two attempts for a failing check.
- Report changed files, exact checks run, and unresolved issues concisely.

# TURN standing rules

- TURN is designed for universal access: accessibility is a constraint on every change, not a feature.
- Performance and smooth frames come before richer sound or visuals.
- Colours come from the semantic tokens in `turn/design-tokens.css`, never hard-coded.
- Anything that runs during a race must stop on pause, leave and background: `race/race-pause.js` and `leaveRace()` in `race/session-orchestrator.js`.
- Mockups show intent. Names, lengths and counts in them may be worst-case placeholders; ask which parts are literal when unsure.
- **Mockups are not required for implementation.** When Erik provides no mockup or leaves presentation details open, OPUS should make a common-sense implementation using established TURN patterns, the design system, existing form and colour language, the surrounding code and UI as precedent, and recognised best practices across architecture, frontend, backend, performance, security, accessibility and interaction/visual design. Do not stall merely because a visual specification is absent.
- When a mockup is provided, treat it as design direction rather than permission to ignore system consistency, responsive behaviour, accessibility, sound engineering practice or established interaction patterns.

## Judgement and coherence

These rules come from a working retro: TURN's product model should live in principles, issues and `main`, not in one person's head or one chat.

- When trade-offs conflict, decide in this order even if the issue does not restate it: 1. accessibility, 2. performance, 3. architecture and correctness, 4. product and UI coherence, 5. regression risk.
- When an established TURN rule or pattern already settles a question, apply it and report it. Bring Erik only genuine product decisions, not implementation or detail choices.
- When a spec phrase touches a mechanic with more than one state or timer (e.g. OVERCHARGE while leaking vs when spent), the issue or PR states which one it means, checked against TURN's existing terms, before implementation.
- A distinct problem found mid-work gets its own focused issue rather than reopening a large one.
- After a substantial batch of work, review current `main` as one product, focusing on interactions between recently changed systems. Record findings and decisions in an issue or PR note, not only in chat.
- Accessibility sweeps cover non-text contrast for control states and focus indicators (WCAG 1.4.11), not only text contrast.

## Releases

- Every merge that changes TURN production must increment the TURN build in that same merge. `turn/release.json` remains the release source of truth (`version`, `id` `YYYY.MM.DD-rNNN`, `cacheKey` `YYYYMMDD-rNNN`); run `node turn/scripts/release.mjs --write` and `--check`. The script updates `CURRENT_RELEASE` and every module route, including `yourturn/index.html`.
- Before and after merging a production change, verify that `main` contains no TURN production commits newer than the build recorded in `turn/release.json`. If it does, treat that as a release-integrity bug and correct it.
- Assess whether the semantic release version should also be bumped. When it should, update it together with changelog/history, release metadata and other relevant release-facing surfaces.
- Do not create new manual `revision=` identifiers or revision-suffixed files. Existing revisions are legacy compatibility only.
- The changelog (`turn/content/about-history.js`) lists lasting milestones only, by completion date. Add an entry only for a new player-facing capability. Fixes and refinements to an existing milestone get none. Consolidate related history entries where that produces a clearer lasting record.
- Before pushing, run `node turn-tests/release-composition-production.mjs --base origin/main` and `npx --yes eslint@9.39.1 turn turn-tests` (0 errors).
- Squash-merge. Never merge #997.
- Use the owning issue and PR for implementation/release notes and device-verification follow-up. Do not use unrelated umbrella issues as general release logs; in particular, #928 is the TURN racing-soundscape issue, not a global release log.
- A fix for something seen on a device is finished when the reporter confirms it there, not when it merges.
- When a change alters how others work (release steps, sources of truth, agent ownership), say so in its PR and in the relevant owning issue.
