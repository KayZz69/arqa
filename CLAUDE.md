# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ARQA is a React-based inventory and daily reporting system for cafés/restaurants. Baristas submit end-of-day stock reports; managers oversee inventory, orders, and analytics. Two roles: **barista** (submit reports, view history) and **manager** (full access).

## Commands

```bash
npm run dev          # Start dev server on port 8080
npm run build        # Production build
npm run build:dev    # Development build
npm run lint         # ESLint
npm run preview      # Preview production build
```

No test runner is configured. There are no project-level tests yet.

## Tech Stack

- **Frontend:** React 18 + TypeScript + Vite (SWC)
- **Styling:** Tailwind CSS 3 + shadcn/ui (Radix primitives)
- **Backend:** Supabase (PostgreSQL + Auth + RLS)
- **Server state:** React Query (`@tanstack/react-query`)
- **Routing:** React Router v6 with lazy-loaded pages
- **Forms:** React Hook Form + Zod validation
- **Path alias:** `@/` maps to `./src/`

## Architecture

### Layers

```
src/
├── pages/           # Route-level components (main business logic lives here)
├── components/      # Shared components (ProtectedRoute, dialogs, navigation)
│   └── ui/          # shadcn/ui base components — do not edit directly
├── hooks/           # Custom hooks (usePositions, useCategories, useCurrentStock, etc.)
├── services/        # Business logic (reportValidation, stockNotifications)
├── contexts/        # AuthContext — provides user, session, role, isManager, isBarista
├── integrations/    # Supabase client and auto-generated DB types
└── lib/             # Utilities (cn() for class merging)
```

### Key Patterns

- **Auth flow:** Login page uses multi-step selection (role → user → password). `AuthContext` wraps the app; `ProtectedRoute` guards pages by checking session.
- **Data fetching:** All Supabase queries go through React Query hooks. Queries use `supabase` client from `@/integrations/supabase/client`. DB types are auto-generated in `@/integrations/supabase/types.ts`.
- **Write-off calculation:** `previous_stock + arrivals - current_stock`. This logic is in `DailyReport.tsx` and `reportValidation.ts`.
- **Notifications:** `stockNotifications.ts` generates low-stock alerts (stock < min_stock) and high write-off alerts (write-off > 50% of available and > 2 units).
- **Role-based UI:** Dashboard (`Index.tsx`) renders different views for barista vs manager using `isManager`/`isBarista` from `useAuth()`.

### Database Tables

`profiles`, `user_roles`, `categories`, `positions`, `daily_reports`, `report_items`, `inventory_batches`, `notifications`. View: `current_stock_levels`. See `architecture.md` for the ER diagram.

## TypeScript Configuration

Strict mode is **off**. `noImplicitAny`, `strictNullChecks`, `noUnusedLocals`, `noUnusedParameters` are all disabled. ESLint also has `@typescript-eslint/no-unused-vars` turned off.

## Agent Rules (`.agent/rules/`)

These rules apply to all AI agents working in this repo:

- **Scope:** Only touch what the task requires. Do not modify config, DB schemas, or CI/CD unless explicitly asked. Ask before changes that might break other parts.
- **Style:** Match existing patterns. Small focused functions. No big refactors unless asked. New features go in their own file/module.
- **Contracts:** Propose a plan before changing public APIs or DB schemas. Suggest backward-compatible options if a change would break callers.
- **Testing:** Add or update tests for non-trivial changes. Never delete tests without approval. Show a summary of test results.
- **Docs:** Update at least one doc file for user-facing features. Document new config flags/env vars. Add comments for non-obvious logic.
