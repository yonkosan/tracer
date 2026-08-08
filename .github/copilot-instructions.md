# Copilot Workspace Instructions — Tracer (WeMakeDevs × Zerops Hackathon)

## 1. Always start here

Before writing any code, check `plan.md` in the repo root.

- Figure out which step we're on by looking at the Progress Tracker checkboxes.
- If the user asks "where are we?" or "what's next?", read `plan.md` and tell them the current phase, the next unchecked item, and any blockers.
- Never suggest work that skips ahead of the plan. Finish the current step cleanly before moving on.

## 2. Project context

This is an error tracking platform built for the WeMakeDevs × Zerops hackathon (Aug 8–9, 2026). It captures unhandled errors from web apps via a JS snippet, processes them asynchronously through NATS, stores in PostgreSQL, deduplicates via Valkey, indexes in Elasticsearch, and displays them in a Next.js dashboard.

**Six Zerops services:**
- `api` — Node.js 22 + Fastify (HTTP server + NATS consumer in one process)
- `web` — Node.js 22 + Next.js 15 (dashboard)
- `db` — PostgreSQL 16
- `cache` — Valkey 7 (Redis-compatible, use `ioredis`)
- `search` — Elasticsearch 8 (use `@elastic/elasticsearch`)
- `broker` — NATS 2 (use `nats` npm package)

Internal service addresses (Zerops private network): `db:5432`, `cache:6379`, `search:9200`, `broker:4222`.

Env vars are injected by Zerops using `${serviceName_varName}` syntax in `zerops.yaml`. Never hardcode credentials anywhere.

## 3. Tone and style — non-negotiable

Everything produced in this repo — code, comments, commit messages, README, the social post copy — must read like it was written by a senior developer. Not an AI assistant. A human who knows what they're doing.

Specifically:
- No "certainly!", "great question!", "it's worth noting that", "as an AI language model", or any similar phrases
- No unnecessary hedging ("you might want to consider possibly...")
- No em-dash overuse. One em-dash per paragraph max.
- Comments explain **why**, not what. If the code is clear, skip the comment.
- Variable and function names: descriptive but not verbose. `getErrorById`, not `fetchTheErrorFromTheDatabaseByItsId`.
- Error messages in the API: clear and actionable. "Project not found" not "The requested project resource could not be located in the system."
- Commit messages: conventional commits format (`feat:`, `fix:`, `chore:`, `refactor:`) — one line, imperative mood, lowercase after the prefix.
- The README should read like something a senior dev would actually want to read — short, direct, with working examples.

## 4. Code standards

**TypeScript everywhere** in `apps/api` and `apps/web`. Strict mode, but don't add unnecessary type annotations — let inference do its job.

**Error handling in the API:**
- All Fastify route handlers catch and log errors properly
- Return consistent JSON error shapes: `{ error: string, code?: string }`
- Never return a 500 with an internal error message to the client

**Security:**
- Passwords: bcrypt with cost factor 12
- API keys: UUID v4, stored as plaintext (they're not passwords — they're meant to be shared with the SDK)
- BYOK OpenAI keys: AES-256-GCM encrypted before storing in PostgreSQL
- JWTs: HS256, 7-day expiry
- The `/api/ingest` endpoint is authenticated via `X-API-Key` header — no JWT, it's called from the SDK
- All other `/api/*` endpoints require a valid JWT in the `Authorization: Bearer ...` header
- Rate limiting on `/api/ingest`: use Valkey — `INCR rate:{apiKey}:{minute}`, reject if over 1000/min per project

**Database:**
- Use `pg` (node-postgres) with connection pooling, not an ORM
- Run migrations from a SQL file on server startup — simple, no migration framework overhead
- Parameterized queries everywhere — no string concatenation in SQL

**NATS:**
- Use core NATS pub/sub (not JetStream) for this hackathon — simpler, still demonstrates the pattern
- Subject: `errors.ingest`
- If NATS is down, the ingest route should still accept the error and process it synchronously as a fallback

**Elasticsearch:**
- Index name: `errors`
- Create the index with proper mappings on server startup if it doesn't exist
- Use multi-match for search: query across `message`, `error_type`, and `stack_trace` fields

**Next.js:**
- App Router, TypeScript, Tailwind
- Dark theme (it looks better in demo recordings)
- Fetch errors with a 3-second polling interval — simple, readable, no need for WebSockets
- Don't use any state management library — React state + SWR or React Query for data fetching is enough

## 5. What NOT to do

- Don't add features not in `plan.md` unless the plan is complete and there's time left
- Don't refactor working code just to make it "cleaner" — submit what works
- Don't use Prisma, Sequelize, or any ORM — raw `pg` only
- Don't add tests — there's no time, and the judges won't run them
- Don't change the Zerops service hostnames — `api`, `web`, `db`, `cache`, `search`, `broker` — they're baked into `zerops.yaml`
- Don't commit secrets — `.env` is in `.gitignore`, secrets go in Zerops GUI

## 6. File structure (don't deviate from this)

```
tracer/
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── server.ts          — entry point, starts everything
│   │   │   ├── routes/
│   │   │   │   ├── health.ts
│   │   │   │   ├── auth.ts
│   │   │   │   ├── projects.ts
│   │   │   │   ├── ingest.ts
│   │   │   │   ├── errors.ts
│   │   │   │   └── analyze.ts
│   │   │   ├── consumer/
│   │   │   │   └── errors.ts      — NATS subscriber + error processor
│   │   │   ├── db/
│   │   │   │   ├── client.ts
│   │   │   │   ├── schema.sql
│   │   │   │   └── migrate.ts
│   │   │   ├── cache/
│   │   │   │   └── client.ts
│   │   │   └── search/
│   │   │       └── client.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── web/
│       ├── app/
│       │   ├── layout.tsx
│       │   ├── page.tsx
│       │   ├── dashboard/
│       │   │   ├── page.tsx
│       │   │   └── [projectId]/
│       │   │       ├── page.tsx
│       │   │       ├── [errorId]/
│       │   │       │   └── page.tsx
│       │   │       └── settings/
│       │   │           └── page.tsx
│       │   └── demo/
│       │       └── page.tsx
│       ├── package.json
│       └── next.config.ts
├── packages/
│   └── sdk/
│       └── index.js               — copy-paste SDK snippet
├── zerops.yaml
├── plan.md
├── analysis.md
└── .github/
    └── copilot-instructions.md
```

## 7. Zerops-specific reminders

- `zerops.yaml` is the build and deploy pipeline config — one section per service
- Env var cross-references use `${serviceName_varName}` — Zerops injects these at runtime
- The `readinessCheck` in `zerops.yaml` must pass before the container takes traffic
- Build containers are free — don't worry about build time cost
- Changes deployed by pushing to `main` on GitHub (after GitHub integration is set up in Step 7 of plan.md)
- If a deploy fails, check the Build log in Zerops GUI: project → service → Pipelines & CI/CD

## 8. When you're stuck

1. Check `plan.md` — the step you're on has the prompt, the expected output, and the context you need
2. Check the Zerops runtime log: Zerops GUI → service → Runtime log
3. Check the build log: Zerops GUI → service → Pipelines & CI/CD → pipeline detail
4. For Zerops-specific questions: https://discord.gg/zeropsio
5. For zerops.yaml syntax: https://docs.zerops.io/zerops-yaml/specification
