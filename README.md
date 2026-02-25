![Cortex - Futuristic robot squid in digital command](/public/cortex_banner.png)

# Cortex

Cortex is a self-hosted dashboard for running and managing an autonomous AI agent. It gives you a real-time chat interface to send prompts and receive streamed responses, a configuration UI to shape the agent's persona and reasoning, and a job-tracking system to monitor what the agent is doing over time.

The agent's behavior is defined in a versioned `settings.json` file. Any change made through the UI is automatically committed to a new git branch and opened as a GitHub PR — so every tweak to the agent's tone, temperature, or automation settings goes through version control with a human-readable changelog entry.

Cortex is designed to run locally, on a VPS, or in a docker container with ngrok tunneling, making it easy to expose the agent to external services or test webhooks without a dedicated server.

## Features

- **Chat interface** — send prompts and receive streaming responses with Markdown rendering
- **Agent config** — update persona (name, tone, verbosity), reasoning parameters, and git automation via the UI; changes are committed and PR'd automatically
- **Dashboard preferences** — choose primary color, color mode (light/dark/system), timezone, and date format; persisted to `localStorage`
- **Config changelogs** — every agent config update writes a Markdown changelog to `agent/logs/`
- **Job tracking** — dashboard, logs, and cron views for monitoring agent activity
- **Auth & security** — token-based auth with encrypted storage at rest, signed session cookies, and rate limiting
- **Mock mode** — works out of the box without an API key for local development

## Security Notice

> **Keep your Cortex repository private.** The repo may contain your agent's system prompt, behavioral config, and changelog entries that reveal how your agent is instructed and what it has done. Exposing this publicly could allow others to reverse-engineer or manipulate your agent's behavior.

Additionally, set `CORTEX_SETUP_SECRET` and `CORTEX_TOKEN_ENCRYPTION_KEY` before deploying to any shared or internet-facing environment (see [Environment Variables](#environment-variables)).

## LLM Provider API Keys

Cortex requires at least one LLM provider API key for chat and autonomous agent functionality. Mock mode is available for local development without a key, but all real interactions route through a configured provider.

Supported providers are configured via the UI at `/config/providers`. You will need an API key from one or more of the following:

| Provider | Where to get a key |
|---|---|
| OpenAI | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| Anthropic | [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys) |
| Google Gemini | [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) |

Keys are stored server-side and never exposed to the browser after submission.

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/)

## Setup

Install dependencies:

```bash
pnpm install
```

Copy `.env.example` to `.env` and configure as needed:

```bash
cp .env.example .env
```

## Development

```bash
pnpm dev       # Start dev server at http://localhost:3000
pnpm build     # Build for production
pnpm preview   # Preview production build
pnpm lint      # Run ESLint
pnpm typecheck # Run TypeScript type checking
```

## Docker Compose (App + ngrok)

1. Ensure `.env` contains your ngrok auth token:

```bash
cp .env.example .env
# then set NGROK_AUTHTOKEN in .env
```

2. Start the app and ngrok tunnel:

```bash
docker compose up --build -d
```

3. View the public ngrok URL:

```bash
docker compose logs -f ngrok
```

4. Optional: open ngrok inspector at [http://localhost:4040](http://localhost:4040).

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `CORTEX_SETUP_SECRET` | Recommended | Prevents first-requester token takeover on bootstrap. Generate with `openssl rand -hex 32`. |
| `CORTEX_TOKEN_ENCRYPTION_KEY` | Production | Encrypts the stored auth token (`agent/config/auth.json`) at rest. Generate with `openssl rand -hex 32`. If unset, plaintext fallback is used (local dev only). |
| `GH_TOKEN` | Git/PR features | GitHub personal access token for autonomous commits and PR creation. |
| `GH_REPO` | Git/PR features | Target repo in `owner/repo` format. |
| `NGROK_AUTHTOKEN` | Docker+ngrok | Auth token from [ngrok dashboard](https://dashboard.ngrok.com/get-started/your-authtoken). |

## Authentication

Cortex uses a token-based auth system:

1. **Bootstrap** — on first run, `POST /api/agent/auth/generate` creates and stores the auth token. Set `CORTEX_SETUP_SECRET` to prevent unauthenticated bootstrap on shared machines.
2. **Login** — `POST /api/agent/auth/login` accepts the token and sets a signed session cookie for browser sessions.
3. **Token rotation** — re-calling the generate endpoint rotates the token; requires the current token (Bearer header or valid session cookie).
4. **Storage** — the token is written to `agent/config/auth.json`, encrypted at rest when `CORTEX_TOKEN_ENCRYPTION_KEY` is set.

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
    chat.post.ts                        # Proxies to OpenAI, injects agent settings
    agent/config.get.ts                 # GET /api/agent/config
    agent/config.post.ts                # POST /api/agent/config — patches, commits, opens PR
    agent/auth/generate.post.ts         # Bootstrap/rotate auth token
    agent/auth/login.post.ts            # Login with token → sets session cookie
    agent/providers/index.get.ts        # List configured providers
    agent/providers/index.post.ts       # Add a provider
    agent/providers/[id].delete.ts      # Remove a provider
    agent/providers/active.post.ts      # Set the active provider
    agent/providers/credentials.post.ts # Store provider credentials
    agent/providers/validate.post.ts    # Validate provider credentials
    agent/logs.get.ts                   # GET /api/agent/logs
    agent/env.post.ts                   # Write environment variables server-side
    agent/onboarding-status.get.ts      # Check onboarding completion
  utils/
    agentConfig.ts    # readSettings, writeSettings, classifyRisk, changelog, git/PR helpers
    authToken.ts      # Token generation, encrypted read/write
    authSession.ts    # Signed session cookie helpers
    security.ts       # Rate limiting, safe string comparison
    providerConfig.ts # Provider storage helpers
    providerCatalog.ts
    providerRuntime.ts
agent/
  config/settings.json     # Agent behavioral config
  config/auth.json          # Stored auth token (encrypted at rest, gitignored)
  prompts/SYSTEM_PROMPT.md
  logs/                    # Auto-generated changelogs
```

## Agent Configuration

`agent/config/settings.json` controls the agent's behavior:

```json
{
  "persona": { "name": "Cortex", "tone": "professional", "verbosity": "low" },
  "reasoning": { "temperature": 0.7, "maxTokens": 2048 },
  "git": { "autoPush": true, "autoMerge": true },
  "meta": { "onboarded": false, "revision": 1 }
}
```

Changes made through the UI (`/config`) are committed to a new branch and pushed to origin automatically. Each update increments `meta.revision` and writes a changelog to `agent/logs/`.

## Tech Stack

- [Nuxt 4](https://nuxt.com/) + [Vue 3](https://vuejs.org/)
- [Nuxt UI](https://ui.nuxt.com/) (components, icons via Lucide)
- [Tailwind CSS](https://tailwindcss.com/)
- [Nitro](https://nitro.build/) (server-side API routes)
- [Docker](https://www.docker.com/) + [ngrok](https://ngrok.com/) (optional containerised deployment)
