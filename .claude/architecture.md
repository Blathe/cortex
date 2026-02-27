# Architecture Reference

**Cortex** — Nuxt.js 4 dashboard for an autonomous AI agent. File-based routing, Nuxt UI components, `useState()` composables (no Pinia).

## Pages & Layout
- `app.vue` — root layout: collapsible `UDashboardSidebar` + main panel
- `app/pages/index.vue` — home
- `app/pages/chat.vue` — primary chat interface
- `app/pages/config/` — LLM provider config sub-pages
- `app/pages/jobs/` — job tracking (dashboard, logs, crons)

## Composables
- `useCortexChat.ts` — chat state/logic (`messages`, `status`, `sendPrompt`, `retryLastResponse`, `clearProposal`). Mock mode by default; live mode posts to `/api/chat` when provider="openai" + apiKey set.
- `useCortexConfig.ts` — LLM config persisted to `localStorage` (`cortex.config.v1`). API: `loadConfig`, `saveConfig`, `resetConfig`.
- `useCortexProviders.ts` — provider list management.

## API / Backend
- `server/api/chat.post.ts` — proxies to OpenAI; reads `agent/config/settings.json` to inject tone/verbosity + temperature/maxTokens; parses `CONFIG_PROPOSAL` blocks.
- `server/api/agent/config.get.ts` — `GET /api/agent/config`
- `server/api/agent/config.post.ts` — `POST /api/agent/config` → patches settings, writes changelog, commits, creates GitHub PR.
- `server/utils/agentConfig.ts` — `readSettings`, `writeSettings`, `classifyRisk`, `createChangeLog`, `commitAndPush`, `createGitHubPR`.

## Agent
- `agent/config/settings.json` — `persona` (name, tone, verbosity), `reasoning` (temperature, maxTokens), `git` (autoPush, autoMerge), `meta`.
- `agent/prompts/SYSTEM_PROMPT.md` — system prompt; tone/verbosity injected as header per-request.
- `agent/logs/` — Markdown changelogs auto-written on every config update.
- `.github/workflows/auto-merge-config.yml` — auto-merges PRs labeled `auto-merge`; leaves `needs-review` open.

## Types
`app/types/cortex.ts`: `CortexConfig`, `CortexChatMessage`, `CortexChatPart`, `CortexChatRole`, `ChatStatus`, `AgentConfigProposal`.

## Environment Variables
Copy `.env.example` → `.env` (gitignored).
- `GH_TOKEN` — GitHub personal access token
- `GH_REPO` — `owner/repo` format
