# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Scope

This document defines AI agent behavior and safety rules.
- Contributor workflow (commands, coding style, PR expectations): see `AGENTS.md`.
- System design and data model: see `architecture.md`.

Last verified: 2026-02-07.

## TypeScript Configuration

Strict mode is **off**. `noImplicitAny`, `strictNullChecks`, `noUnusedLocals`, and `noUnusedParameters` are disabled. ESLint also has `@typescript-eslint/no-unused-vars` disabled.

## Agent Rules (`.agent/rules/`)

These rules apply to AI agents working in this repo:

- **Scope:** Only touch what the task requires. Do not modify config, DB schemas, or CI/CD unless explicitly asked. Ask before changes that might break other parts.
- **Style:** Match existing patterns. Prefer small focused functions. Avoid broad refactors unless requested.
- **Contracts:** Propose a plan before changing public APIs or DB schemas. Suggest backward-compatible options when possible.
- **Testing:** Add or update tests for non-trivial changes. Never delete tests without approval. Show a summary of test results.
- **Docs:** Update docs for user-facing features. Document new config flags or env vars. Add comments only for non-obvious logic.

## Agent Checklist

Before finishing a task:
1. Run `npm run lint` when code changes are made.
2. Run `node --test "tests/*.test.js"` when touched logic is covered by unit tests.
3. If DB behavior changes, include a migration and document impact.
4. If architecture-level behavior changes, update `architecture.md`.
