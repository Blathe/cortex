# CLAUDE.md

## Commands
```bash
pnpm dev       # http://localhost:3000
pnpm build
pnpm lint
pnpm typecheck
```
Run `pnpm lint && pnpm typecheck` before every commit. Tests: Vitest in `__tests__/` (none yet; new features require them).

## Conventions
- **Branch**: new git branch per feature before any changes.
- **Plan**: non-trivial changes → draft in `PLAN.md` first.
- **UI**: always prefer Nuxt UI components (`UButton`, `UChatMessages`, etc.) over custom.
- **Icons**: Lucide via `@iconify-json/lucide` (`i-lucide-*`).
- **Colors**: primary = green, neutral = slate (`nuxt.config.ts`).
- **Components**: use `<script setup>` or arrow function `defineComponent`.
- **pnpm**: `/usr/local/lib/node_modules/corepack/shims/pnpm` (not on PATH).

## Reference Docs
Read these on demand when working in the relevant area:
- `.claude/architecture.md` — pages, composables, API routes, agent config, types, env vars.
- `.claude/auth.md` — PIN auth, sessions, sudo mode, recovery.

Update referenced docs when relevant features change.
