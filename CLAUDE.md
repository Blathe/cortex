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
- `app/pages/config/` — LLM provider configuration (split into sub-pages)
- `app/pages/jobs/` — job tracking sub-pages (dashboard, logs, crons)

### Composables (state lives here)
- `app/composables/useCortexChat.ts` — all chat state and logic (`messages`, `status`, `sendPrompt`, `retryLastResponse`, `clearProposal`). Has a **mock mode** (default) and a **live mode** that posts to `/api/chat` when provider="openai" and apiKey is set.
- `app/composables/useCortexConfig.ts` — LLM config persisted to `localStorage` under key `cortex.config.v1`. Provides `loadConfig`, `saveConfig`, `resetConfig`.
- `app/composables/useCortexProviders.ts` — provider list management.

### API / Backend
- `server/api/chat.post.ts` — Nitro endpoint that proxies to OpenAI. Reads `agent/config/settings.json` per-request to inject tone/verbosity into system prompt and pass temperature/maxTokens. Parses `CONFIG_PROPOSAL` blocks from responses.
- `server/api/agent/config.get.ts` — `GET /api/agent/config` → returns current agent settings.
- `server/api/agent/config.post.ts` — `POST /api/agent/config` → applies patch, writes changelog, commits to branch, creates GitHub PR.
- `server/utils/agentConfig.ts` — shared logic: `readSettings`, `writeSettings`, `classifyRisk`, `createChangeLog`, `commitAndPush`, `createGitHubPR`.

### Agent
- `agent/config/settings.json` — behavioral config: `persona` (name, tone, verbosity), `reasoning` (temperature, maxTokens), `git` (autoPush, autoMerge), `meta`.
- `agent/prompts/SYSTEM_PROMPT.md` — system prompt; tone/verbosity injected as header per-request.
- `agent/logs/` — Markdown changelogs auto-written on every config update.
- `.github/workflows/auto-merge-config.yml` — auto-merges PRs labeled `auto-merge`; leaves `needs-review` open.

### Types
All shared interfaces are in `app/types/cortex.ts`: `CortexConfig`, `CortexChatMessage`, `CortexChatPart`, `CortexChatRole`, `ChatStatus`, `AgentConfigProposal`.

### Environment variables
Copy `.env.example` to `.env` (gitignored). Required for git/PR features:
- `GH_TOKEN` — GitHub personal access token
- `GH_REPO` — target repo in `owner/repo` format

## Key Conventions

- **Components**: Arrow function syntax (`const MyComponent = defineComponent(...)` or `<script setup>`), Tailwind CSS for styling.
- **UI**: Always use Nuxt UI components (`UButton`, `UChatMessages`, `UForm`, etc.) before building custom ones.
- **Branching**: Always create a new git branch for each new feature before making changes.
- **Planning**: For non-trivial changes, draft steps in `PLAN.md` first.
- **Icons**: Lucide icons via `@iconify-json/lucide` (e.g. `<UIcon name="i-lucide-send" />`).
- **Colors**: Primary = green, Neutral = slate (configured in `nuxt.config.ts`).
- **pnpm path**: `/usr/local/lib/node_modules/corepack/shims/pnpm` (not on PATH in shell sessions).
