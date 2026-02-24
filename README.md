# Cortex

A Nuxt.js 4 dashboard for interacting with an autonomous AI agent. Chat with the agent, configure its behavior, and track jobs — all from a single interface.

## Features

- **Chat interface** — send prompts and receive streaming responses with Markdown rendering
- **Agent config** — update persona (name, tone, verbosity), reasoning parameters, and git automation via the UI; changes are committed and PR'd automatically
- **Dashboard preferences** — choose primary color, color mode (light/dark/system), timezone, and date format; persisted to `localStorage`
- **Config changelogs** — every agent config update writes a Markdown changelog to `agent/logs/`
- **Job tracking** — dashboard, logs, and cron views for monitoring agent activity
- **Mock mode** — works out of the box without an API key for local development

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/)

## Setup

Install dependencies:

```bash
pnpm install
```

Copy the environment file and fill in your values:

```bash
cp .env.example .env
```

| Variable | Description |
|----------|-------------|
| `GH_TOKEN` | GitHub personal access token (required for auto-PR on config changes) |
| `GH_REPO` | Target repo in `owner/repo` format |

## Development

```bash
pnpm dev       # Start dev server at http://localhost:3000
pnpm build     # Build for production
pnpm preview   # Preview production build
pnpm lint      # Run ESLint
pnpm typecheck # Run TypeScript type checking
```

## Project Structure

```
app/
  pages/
    index.vue              # Landing page
    chat.vue               # Primary chat interface
    config/
      index.vue            # Agent behavior settings (persona, reasoning, git)
      dashboard.vue        # Dashboard preferences (color, timezone, date format)
      providers.vue        # LLM provider management
      sources.vue          # Data source integrations
      logs.vue             # Agent config changelogs
    jobs/                  # Job tracking (dashboard, logs, crons)
  composables/
    useCortexChat.ts       # Chat state and logic
    useCortexConfig.ts     # LLM config (persisted to localStorage)
    useCortexDashboard.ts  # Dashboard preferences (persisted to localStorage)
    useCortexProviders.ts  # Provider list management
  types/cortex.ts          # Shared TypeScript interfaces
server/
  api/
    chat.post.ts           # Proxies to OpenAI, injects agent settings
    agent/config.get.ts    # GET /api/agent/config
    agent/config.post.ts   # POST /api/agent/config — patches, commits, opens PR
agent/
  config/settings.json     # Agent behavioral config
  prompts/SYSTEM_PROMPT.md
  logs/                    # Auto-generated changelogs
```

## Agent Configuration

`agent/config/settings.json` controls the agent's behavior:

```json
{
  "persona": { "name": "Cortex", "tone": "professional", "verbosity": "low" },
  "reasoning": { "temperature": 0.7, "maxTokens": 2048 },
  "git": { "autoPush": true, "autoMerge": true }
}
```

Changes made through the UI (`/config`) are committed to a new branch and opened as a GitHub PR. PRs labeled `auto-merge` are merged automatically via `.github/workflows/auto-merge-config.yml`; those labeled `needs-review` are left open.

## Tech Stack

- [Nuxt 4](https://nuxt.com/) + [Vue 3](https://vuejs.org/)
- [Nuxt UI](https://ui.nuxt.com/) (components, icons via Lucide)
- [Tailwind CSS](https://tailwindcss.com/)
- [Nitro](https://nitro.build/) (server-side API routes)
