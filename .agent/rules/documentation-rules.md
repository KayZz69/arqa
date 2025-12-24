---
trigger: always_on
---

# Documentation rules

##Update docs with features
- “Every new feature or breaking change must update at least one doc file (README, feature guide, or changelog) that explains how to use it.”​​
- “If you add a config flag, environment variable, or CLI option, document it (name, default, effect, example).”

## Use lightweight architecture notes

- “When adding a non‑trivial subsystem, create or update an architecture.md/Architect.md describing components, data flow, and external dependencies in simple terms.”
- “Keep architecture docs high‑level: what components exist, how they talk to each other, and where core business logic lives.”

## Explain tricky code

- “If logic is non‑obvious (performance hacks, complex conditions, security checks), add a short comment explaining why it’s written that way, not just what it does.”
- “Link from comments or docs to any relevant design/decision notes if they exist.”​

