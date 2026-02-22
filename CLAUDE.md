# CLAUDE.md — PokéPlay Platform

## Project Overview
Browser-based Pokémon ROM hack platform with cloud saves and multiplayer.
Stack: Next.js 14 (App Router) + TypeScript + Tailwind v4 + shadcn/ui (tweakcn theme) + EmulatorJS + Supabase.

## Commands
- `npm run dev` — Start dev server on port 3000
- `npm run build` — Production build
- `npm run lint` — ESLint
- `npm run typecheck` — TypeScript type checking
- `npm run test` — Run Vitest unit tests
- `npm run test:e2e` — Run Playwright E2E tests
- `npm run test:emulator` — Run emulator integration tests

## Styling — CRITICAL RULES

### Tailwind v4 + oklch
We use **Tailwind CSS v4** with oklch color space. All colors are defined as CSS custom properties in `globals.css` using oklch values. **Do NOT create any additional CSS files.** All styling is done via Tailwind utility classes and the CSS variables in `globals.css`.

### shadcn/ui + tweakcn Theme
We use **shadcn/ui** components exclusively, themed by **tweakcn** (neo-brutalist: hard shadows, 0px border-radius, bold borders).

**CRITICAL: Only use shadcn/ui components.** Do NOT create custom UI primitives.

To add a shadcn component:
```bash
npx shadcn@latest add button
```

### Theme Characteristics (tweakcn neo-brutalist)
- `--radius: 0px` — All elements have sharp corners
- Hard box shadows: `3px 3px 0px 0px` with full opacity borders
- Bold `1px solid` borders using `oklch(0 0 0)` in light / `oklch(1 0 0)` in dark
- Primary color: Red `oklch(0.5799 0.2380 29.2339)`
- Accent: Gold/yellow `oklch(0.8408 0.1725 84.2008)`
- Fonts: Inter (sans), Georgia (serif), SF Mono (mono)
- Letter spacing: `-0.02em` default tracking

### CSS Rules
- **globals.css is the ONLY CSS file.** No CSS modules, no styled-components, no additional .css files.
- All theme colors are CSS custom properties (oklch). Reference them via Tailwind: `bg-primary`, `text-muted-foreground`, `border-border`, etc.
- Dark mode uses the `dark` class on `<html>`.
- Never use arbitrary color values — always use the theme tokens.

## Architecture Rules
1. **ROMs NEVER touch the server.** All ROM handling is client-side (File API → IndexedDB).
2. **Saves are offline-first.** Write to IndexedDB immediately, then async-sync to Supabase Storage.
3. **Emulator runs in a Web Worker when possible.**
4. **Memory polling is 10Hz maximum.**
5. **Multiplayer overlay is a separate canvas element.** Never modify the emulator's internal rendering.
6. **Supabase RLS enforces all access control.**
7. **BPS patches only.** We never store or transmit ROM data.

## File Structure Conventions
- `src/app/` — Next.js App Router pages and layouts
- `src/components/` — React components (PascalCase files)
- `src/lib/` — Utility libraries and business logic
- `src/lib/emulator/` — EmulatorJS wrapper, memory reader, save manager
- `src/lib/multiplayer/` — Room management, position broadcasting, overlay renderer
- `src/lib/supabase/` — Supabase client, auth helpers, storage helpers
- `src/lib/rom/` — ROM loading, patching, hash identification
- `src/hooks/` — Custom React hooks
- `src/types/` — TypeScript type definitions
- `src/stores/` — Zustand state stores
- `supabase/migrations/` — Database migration SQL files
- `tests/` — Test files mirroring src structure

## Coding Standards
- Use `async/await`, never raw `.then()` chains
- All functions have TypeScript return types
- React components are functional with hooks
- Use `'use client'` directive only when needed (default to server components)
- Error boundaries around emulator and multiplayer components
- Use Zod for runtime validation of external data
- **UI: Only use shadcn/ui components**
- **CSS: Only globals.css**
- **Colors: Only theme tokens**

## Key Memory Addresses (Pokémon Red/Blue)
- `0xD35E` — wCurMap (current map ID, 1 byte)
- `0xD361` — wYCoord (player Y position, 1 byte)
- `0xD362` — wXCoord (player X position, 1 byte)
- `0xD430` — wSpritePlayerStateData1FacingDirection
- `0xD163` — wPartyCount (number of Pokémon in party)
- `0xD057` — wIsInBattle (0=no, 1=wild, 2=trainer)

## Supabase — LIVE PROJECT

### MCP Tool Access
Claude Code has **Supabase MCP server** access. Use MCP tools instead of manual curl/API calls.

### Live Project Details
- **Project ID**: `xwvmepsnblywtnvtxbko`
- **Supabase URL**: `https://xwvmepsnblywtnvtxbko.supabase.co`

### Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL=https://xwvmepsnblywtnvtxbko.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<in .env.local>
```

## Test Account
- **Email**: efpfefpf@gmail.com
- **Password**: test123

## Test ROM Files
Two test ROM zips are in the project root (gitignored):
- `Pokemon - Red Version (USA, Europe) (SGB Enhanced).zip` — Gen 1
- `Pokemon - Emerald Version (USA, Europe).zip` — Gen 3

Unzipped ROMs available in `roms/` for dev testing. **Do NOT commit to git.**

## Agent Teams
This project uses Claude Code Agent Teams. The team lead coordinates 5 teammates:
1. **emulator** — src/lib/emulator/, src/components/Emulator/, public/emulatorjs/
2. **backend** — src/lib/supabase/, supabase/, src/app/api/, src/app/(auth)/
3. **frontend** — src/app/(main)/, src/components/ui/, src/stores/, src/hooks/
4. **multiplayer** — src/lib/multiplayer/, src/components/Multiplayer/
5. **testing** — tests/, vitest.config.ts, playwright.config.ts

Each teammate owns their directories. Avoid editing files owned by another teammate.
