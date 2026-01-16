---
trigger: always_on
---

# Safety and scope

Hard rules vs preferences: Treat "Do not" and "must" items as hard rules. "Prefer" items are guidance when tradeoffs exist.

## Only touch what the task needs
- Do not modify config, database schema, CI/CD, or deployment files unless the task explicitly says to.
- If a change might break other parts of the app (API behavior, data contracts, user-visible flows, or performance), stop and ask me before continuing.
- Safe to update docs and tests without explicit approval when they are required by other rules.

## No dangerous terminal actions
- Only run read-only or safe commands by default (tests, linters, listing files).
- Ask for confirmation before any command that installs, deletes, migrates, or makes network calls.
