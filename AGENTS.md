# Repository Guidelines

Last verified: 2026-02-07.

Use this file for contributor workflow and expectations. For AI-agent behavior see `CLAUDE.md`; for system design see `architecture.md`.

## Project Structure & Module Organization
- `src/` contains application code:
  - `pages/` route-level screens
  - `components/` reusable UI (`components/ui/` for shadcn primitives)
  - `hooks/` custom React hooks
  - `services/` business logic
  - `integrations/supabase/` Supabase client and generated types
  - `lib/` shared utilities
- `tests/` contains Node-based unit tests for pure logic (`search`, `reportPrefill`).
- `supabase/migrations/` stores SQL migrations; `public/` stores static assets.
- `dist/` is build output and should not be edited manually.

## Build, Test, and Development Commands
- `npm install` installs dependencies.
- `npm run dev` starts the Vite dev server (configured for port `8080`).
- `npm run build` creates a production bundle in `dist/`.
- `npm run build:dev` builds with development mode flags.
- `npm run preview` serves the production build locally.
- `npm run lint` runs ESLint across the repository.
- `node --test "tests/*.test.js"` runs the current unit tests (no `npm test` script is defined).

## Coding Style & Naming Conventions
- Use TypeScript/TSX for app code; prefer 2-space indentation, semicolons, and double quotes to match existing files.
- Components, pages, and contexts use `PascalCase` filenames (example: `DailyReport.tsx`).
- Hooks use `camelCase` with `use` prefix (example: `useCurrentStock.tsx`).
- Keep utility functions small and pure in `src/lib/`.
- Use the `@` alias for imports from `src` (configured in `vite.config.ts`).

## Testing Guidelines
- Test framework: built-in `node:test` with `node:assert/strict`.
- Name tests `*.test.js` in `tests/`.
- Focus on deterministic logic (filters, calculations, data transforms).
- Before opening a PR, run `npm run lint` and `node --test "tests/*.test.js"`.

## Commit & Pull Request Guidelines
- Recent history includes `feat:`, `chore:`, and `docs:` prefixes; prefer Conventional Commits.
- Recommended format: `<type>(scope): imperative summary` (example: `feat(report): add yesterday prefill guard`).
- Avoid vague subjects like `Changes`; keep titles specific.
- PRs should include: purpose, affected routes/components, migration notes (if any), and manual verification steps.
- Include screenshots for UI changes and link related issues/tasks.

## Security & Configuration Tips
- Keep secrets in `.env`; only expose client-safe `VITE_*` values.
- Never commit Supabase service-role keys.
- When schema changes are required, add a new file under `supabase/migrations/` and mention it in the PR.
