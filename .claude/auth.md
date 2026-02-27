# Auth System Reference

PIN-based authentication. 6-digit numeric PIN, Argon2id + HMAC pepper, stored as `PIN_HASH` env var.

## Key Files
- `server/utils/pinAuth.ts` — hashing, rate limiting
- `server/utils/authSession.ts` — sessions, sudo mode
- `app/pages/login.vue` — login UI
- `app/pages/recover.vue` — recovery UI

## Session
- Payload v2 with optional `sudoAt` (seconds); `requireSudoMode()` enforces 2h window.
- `PIN_PEPPER` auto-generated at setup; used as session signing secret.

## Sudo Triggers
Changing PIN, saving provider credentials.

## Recovery
- One-time 16-char code (`PIN_RECOVERY_HASH`).
- Recovery regenerates pepper → invalidates all sessions.
