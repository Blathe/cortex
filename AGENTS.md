# AGENTS.md

## Repository Expectations
- **Language**: TypeScript (Strict mode)
- **Framework**: Nuxt.js 4.3.1
- **UI Framework**: Nuxt UI v4.4.0
- **Linting**: Run `npm run lint` before proposing file writes and before every commit.
- **Typechecking**: Run `npm run typecheck` before every commit.
- **Testing**: Prioritize Vitest. New features require tests in `__tests__`.
- **Docs**: Document public API utility functions in `/docs` using JSDoc.

## Behavioral Rules
- If unsure, use `PLAN.md` to outline steps before editing code.
- Prefer small, incremental changes.
- Do not remove existing comments unless they are obsolete.

## Specific Guidelines
- Ensure all components are functional components using Arrow Function syntax.
- Use Tailwind CSS for styling.
- ALWAYS use NuxtUI Components before trying to implement something yourself.
