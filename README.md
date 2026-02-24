# Cortex

A Nuxt.js 4 dashboard for interacting with an autonomous AI agent. Chat with the agent, configure its behavior, and track jobs — all from a single interface.

## Features

- **Chat interface** — send prompts and receive streaming responses with Markdown rendering
- **Agent config** — update persona, reasoning parameters, and git behavior via the UI; changes are committed and PR'd automatically
- **Config changelogs** — every config update writes a Markdown changelog to `agent/logs/`
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
    index.vue         # Landing page
    chat.vue          # Primary chat interface
    config/           # LLM provider configuration
    jobs/             # Job tracking (dashboard, logs, crons)
  composables/
    useCortexChat.ts  # Chat state and logic
    useCortexConfig.ts# LLM config (persisted to localStorage)
  types/cortex.ts     # Shared TypeScript interfaces
server/
  api/
    chat.post.ts      # Proxies to OpenAI, injects agent settings
    agent/config.get.ts
    agent/config.post.ts
agent/
  config/settings.json  # Agent behavioral config
  prompts/SYSTEM_PROMPT.md
  logs/               # Auto-generated changelogs
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

Config updates made through the UI are committed to a branch and opened as a GitHub PR. PRs labeled `auto-merge` are merged automatically via `.github/workflows/auto-merge-config.yml`; those labeled `needs-review` are left open.

## Tech Stack

- [Nuxt 4](https://nuxt.com/) + [Vue 3](https://vuejs.org/)
- [Nuxt UI](https://ui.nuxt.com/) (components, icons via Lucide)
- [Tailwind CSS](https://tailwindcss.com/)
- [Nitro](https://nitro.build/) (server-side API routes)
