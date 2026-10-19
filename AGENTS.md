# Repository agent instructions

This repository contains independent projects. Apply the TURN section only when the task concerns TURN; other projects retain their own instructions and workflows.

## When working on TURN

- Read `turn/AGENTS.md` for roles, implementation authority, accessibility, validation and release rules. This also applies to TURN work in `turn-tests/`, `turn-lab/`, `turn-next/`, `yourturn/` and related CI. Do not load TURN guidance for unrelated projects.
- Verify current repository and PR state before continuing earlier work. Start with changed filenames and diff statistics, then search relevant paths and read targeted sections. Expand scope when dependencies or findings require it; avoid dumping whole repositories, files or release diffs into context.
- Everyday development uses production `turn/` and Cloudflare PR preview deployments. LAB is for larger experiments; NEXT is retired compatibility. Do not update, synchronize or remove experiments or compatibility files unless the task requires it.
- Production tests live in both `turn-tests/` and `turn-lab/tests/`. Select relevant tests regardless of directory. Preserve required validation and CI gates; do not move tests as incidental cleanup.
- Review functional changes separately from generated release changes. Use the canonical release writer and required release checks to verify generated output; inspect unexpected changes and files mixing functional and generated edits. Never hide an entire file just because it includes build identifiers.
- Keep tool output concise: report results and relevant failures, not complete successful logs. Avoid repeated checks without a concrete reason.
- At a task boundary, leave a short issue/PR handoff when needed: current branch/head, decisions, checks and remaining work. Keep durable rules here or in scoped instructions rather than relying on a long conversation.
