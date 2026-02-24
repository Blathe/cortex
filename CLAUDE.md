# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # Start dev server at http://localhost:3000
pnpm build        # Build for production
pnpm preview      # Preview production build
pnpm lint         # Run ESLint
pnpm typecheck    # Run TypeScript type checking
```

Run `pnpm lint` and `pnpm typecheck` before every commit.

Tests use Vitest and live in `__tests__/`. There are none yet; new features require them.

## Architecture

**Cortex** is a Nuxt.js 4 dashboard for interacting with an autonomous AI agent. It uses file-based routing, Nuxt UI components, and lightweight state via `useState()` composables (no Pinia).

### Pages & Layout
- `app.vue` — root layout with collapsible sidebar (`UDashboardSidebar`) and main panel
- `app/pages/index.vue` — landing/home
- `app/pages/chat.vue` — primary chat interface
- `app/pages/config.vue` — LLM provider configuration form
- `app/pages/jobs.vue` — stub page for future job tracking

### Composables (state lives here)
- `app/composables/useCortexChat.ts` — all chat state and logic (`messages`, `status`, `sendPrompt`, `retryLastResponse`). Has a **mock mode** (default) and a **live mode** that posts to `/api/chat` when provider="openai" and apiKey is set.
- `app/composables/useCortexConfig.ts` — LLM config persisted to `localStorage` under key `cortex.config.v1`. Provides `loadConfig`, `saveConfig`, `resetConfig`.

### API / Backend
- `server/api/chat.post.ts` — Nitro endpoint that validates the request and proxies to OpenAI's `/chat/completions`. The API key comes from the request body (never stored server-side).

### Types
All shared interfaces are in `app/types/cortex.ts`: `CortexConfig`, `CortexChatMessage`, `CortexChatPart`, `CortexChatRole`, `ChatStatus`.

## Key Conventions

- **Components**: Arrow function syntax (`const MyComponent = defineComponent(...)` or `<script setup>`), Tailwind CSS for styling.
- **UI**: Always use Nuxt UI components (`UButton`, `UChatMessages`, `UForm`, etc.) before building custom ones.
- **Planning**: For non-trivial changes, draft steps in `PLAN.md` first.
- **Icons**: Lucide icons via `@iconify-json/lucide` (e.g. `<UIcon name="i-lucide-send" />`).
- **Colors**: Primary = green, Neutral = slate (configured in `nuxt.config.ts`).
