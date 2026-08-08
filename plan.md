# Hackathon Build Plan — WeMakeDevs × Zerops Challenge
**Aug 8–9, 2026 | Deadline: Midnight tonight**

> **Working name: Tracer** — finalize the name before Step 11 (social post).
> Find-replace `tracer` / `Tracer` across the codebase when decided.
>
> **Tone rule (applies everywhere):** Everything — code comments, README, social post, commit messages — must read like it was written by a senior dev who knows what they're doing. No AI phrasing, no "certainly", no "it's worth noting that", no em-dash overuse. Direct, confident, slightly terse.

---

## The Idea (30 seconds)

Every developer has shipped a bug and found out from users instead of their own tooling. Tracer fixes that. Drop one line of code in your app, and every unhandled error gets captured, deduplicated, stored, made searchable, and optionally explained by AI — all visible in a real-time dashboard. Self-hosted, open-source, and deployed entirely on Zerops.

---

## Architecture

```
  SDK (1 line of JS)
       │  HTTP POST /api/ingest
       ▼
  ┌─────────────────────────────────────────────────────┐
  │              Zerops project: tracer                 │
  │                  (private network)                  │
  │                                                     │
  │   ┌─────────┐    publishes    ┌──────────┐          │
  │   │   api   │ ─────────────► │  broker  │          │
  │   │ Fastify │ ◄─ consumes ── │   NATS   │          │
  │   │ :3001   │                └──────────┘          │
  │   └────┬────┘                                      │
  │        │  writes/reads                             │
  │   ┌────┼──────────────────┐                        │
  │   ▼    ▼                  ▼                        │
  │  ┌────┐ ┌───────┐ ┌──────────┐                     │
  │  │ db │ │ cache │ │  search  │                     │
  │  │PG  │ │Valkey │ │ Elastic  │                     │
  │  └────┘ └───────┘ └──────────┘                     │
  │                                                     │
  │   ┌──────────────────────┐                          │
  │   │         web          │ ← queries api            │
  │   │      Next.js 15      │                          │
  │   │        :3000         │                          │
  │   └──────────────────────┘                          │
  └─────────────────────────────────────────────────────┘
```

---

## Service Map

| Zerops hostname | Type | Purpose |
|---|---|---|
| `api` | Node.js 22 | Fastify HTTP server + NATS consumer (same process) |
| `web` | Node.js 22 | Next.js 15 dashboard |
| `db` | PostgreSQL 16 | Projects, users, errors, occurrences |
| `cache` | Valkey 7 | Error deduplication + rate limiting + sessions |
| `search` | Elasticsearch 8 | Full-text search across error messages + stack traces |
| `broker` | NATS 2 | Async error ingestion queue (decouples ingest from processing) |

---

## PHASE 1: MVP Tracer — 6 Services

---

### ✋ YOU DO THIS — Pre-flight (15 min)

- [ ] Confirm you're logged in at [app.zerops.io](https://app.zerops.io) and credits are available
- [ ] Confirm you're registered for the hackathon at [wemakedevs.org/hackathons/zerops](https://www.wemakedevs.org/hackathons/zerops)
- [ ] Have your OpenAI API key ready (needed in Step 7)
- [ ] macOS: confirm QuickTime Player works for screen recording (needed in Step 10)

---

### ✋ YOU DO THIS — Step 1: Create the GitHub Repo (10 min)

1. Go to [github.com/new](https://github.com/new)
2. Name: `tracer` (or final project name — all lowercase, no spaces)
3. Visibility: **Public**
4. Initialize with README: **yes**
5. `.gitignore`: Node
6. Click **Create repository**
7. Clone it locally into this workspace folder:
   ```bash
   git clone https://github.com/YOUR_USERNAME/tracer.git
   cd tracer
   ```
8. Paste the project name here once decided: **`___________`**
9. Paste the GitHub repo URL here: **`___________`**

---

### ✋ YOU DO THIS — Step 2: Provision Zerops Services (30 min)

Go to [app.zerops.io](https://app.zerops.io) and follow these steps exactly.

**2a. Create the project**
1. Click **New project** (top right or center)
2. Name: `tracer` (or final project name)
3. Click **Create project**

**2b. Add services (do these one by one)**

For each service below, click **Add service** inside the project:

| Click | Select | Hostname to use | Mode |
|---|---|---|---|
| Add service | Node.js | `api` | — |
| Add service | Node.js | `web` | — |
| Add service | PostgreSQL | `db` | Non-HA (single container) |
| Add service | Valkey | `cache` | Non-HA |
| Add service | Elasticsearch | `search` | Non-HA |
| Add service | NATS | `broker` | Non-HA |

> Non-HA means single container — cheaper, fine for a hackathon. HA = high availability (multiple containers, for production).

**2c. Enable public access for `web` and `api`**

For each of `web` and `api`:
1. Click the service
2. Left menu → **Subdomain & domain & IP access**
3. Toggle **Zerops subdomain access** → ON
4. Note the URL it assigns. Paste them here:
   - `web` public URL: **`___________`** (this is your live deployment link)
   - `api` public URL: **`___________`** (your frontend will call this)

**2d. Note down the auto-generated env vars**

For each service, click it → left menu → **Environment variables**. Zerops auto-generates connection details. Note them here (you'll need them in Step 7):

- PostgreSQL (`db`):
  - Connection string: `${db_connectionString}` (Zerops injects this automatically — no action needed, just confirm it exists)
- Valkey (`cache`):
  - Host ref: `${cache_hostname}`, Port ref: `${cache_port}` (confirm these exist in the service env vars panel)
- Elasticsearch (`search`):
  - Host ref: `${search_hostname}`, Port ref: `${search_port}`
- NATS (`broker`):
  - Host ref: `${broker_hostname}`, Port ref: `${broker_port}`

> These `${service_varName}` references are what you put in zerops.yaml. Zerops replaces them at runtime with actual values. Never hardcode credentials.

---

### 💻 CODE WORK — Step 3: Monorepo Skeleton (20 min, Copilot helps)

Run these commands in the cloned repo root:

```bash
mkdir -p apps/api/src/{routes,consumer,db,search,cache}
mkdir -p apps/web
mkdir -p packages/sdk
```

**Root `package.json`** (workspaces):
```json
{
  "name": "tracer",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev:api": "cd apps/api && npm run dev",
    "dev:web": "cd apps/web && npm run dev"
  }
}
```

**Create `zerops.yaml` at root:**
```yaml
zerops:
  - setup: api
    build:
      base: nodejs@22
      buildCommands:
        - npm ci --workspace=apps/api
        - npm run build --workspace=apps/api
      deployFiles:
        - apps/api/dist
        - apps/api/node_modules
        - apps/api/package.json
      cache:
        - apps/api/node_modules
    run:
      base: nodejs@22
      ports:
        - port: 3001
          httpSupport: true
      envVariables:
        NODE_ENV: production
        DATABASE_URL: ${db_connectionString}
        REDIS_HOST: ${cache_hostname}
        REDIS_PORT: ${cache_port}
        NATS_URL: nats://${broker_hostname}:${broker_port}
        ES_URL: http://${search_hostname}:${search_port}
      start: node apps/api/dist/server.js
      readinessCheck:
        httpGet:
          port: 3001
          path: /health

  - setup: web
    build:
      base: nodejs@22
      buildCommands:
        - npm ci --workspace=apps/web
        - npm run build --workspace=apps/web
      deployFiles:
        - apps/web/.next
        - apps/web/node_modules
        - apps/web/package.json
        - apps/web/public
      cache:
        - apps/web/node_modules
    run:
      base: nodejs@22
      ports:
        - port: 3000
          httpSupport: true
      envVariables:
        NODE_ENV: production
        NEXT_PUBLIC_API_URL: FILL_IN_API_ZEROPS_URL
      start: cd apps/web && node_modules/.bin/next start
      readinessCheck:
        httpGet:
          port: 3000
          path: /
```

> Replace `FILL_IN_API_ZEROPS_URL` with the `api` public URL you noted in Step 2c. **Do not commit secrets here** — secrets go in Step 7 via the Zerops GUI.

Commit this skeleton:
```bash
git add . && git commit -m "chore: project skeleton and zerops.yaml"
git push
```

---

### 💻 CODE WORK — Step 4: API Server (3-4 hours, Copilot builds)

**`apps/api/package.json`** dependencies to install:
```
fastify @fastify/cors @fastify/helmet
pg            (PostgreSQL client)
ioredis       (Valkey — fully Redis-compatible)
nats          (NATS client)
@elastic/elasticsearch
bcryptjs jsonwebtoken
```

**What to build (in this order, ask Copilot for each):**

**4a. Database schema** — `apps/api/src/db/schema.sql`
Tables needed:
- `users` — id (uuid), email, password_hash, created_at
- `projects` — id (uuid), user_id, name, api_key (uuid, for SDK auth), openai_api_key (nullable, for BYOK AI feature), created_at
- `errors` — id, project_id, fingerprint (sha256 of message+stack), message, error_type, stack_trace (text), status (open/resolved/ignored), count (int, increments on duplicate), first_seen, last_seen, metadata (jsonb)
- `error_occurrences` — id, error_id, url, user_agent, ip_hash, created_at, metadata (jsonb)

Copilot prompt: *"Write a PostgreSQL schema SQL file for an error tracking app with these tables: [paste above]. Use UUIDs for primary keys, add appropriate indexes on project_id, fingerprint, created_at."*

**4b. DB client** — `apps/api/src/db/client.ts`
```typescript
// apps/api/src/db/client.ts
import { Pool } from 'pg'

export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000
})
```

**4c. Valkey (Redis) client** — `apps/api/src/cache/client.ts`
```typescript
import Redis from 'ioredis'

export const cache = new Redis({
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT),
  lazyConnect: true
})
```

**4d. Elasticsearch client** — `apps/api/src/search/client.ts`
```typescript
import { Client } from '@elastic/elasticsearch'

export const es = new Client({ node: process.env.ES_URL })

export async function ensureIndex() {
  const exists = await es.indices.exists({ index: 'errors' })
  if (!exists) {
    await es.indices.create({
      index: 'errors',
      mappings: {
        properties: {
          project_id: { type: 'keyword' },
          message: { type: 'text' },
          error_type: { type: 'keyword' },
          stack_trace: { type: 'text' },
          fingerprint: { type: 'keyword' },
          status: { type: 'keyword' },
          first_seen: { type: 'date' },
          last_seen: { type: 'date' },
          count: { type: 'integer' }
        }
      }
    })
  }
}
```

**4e. NATS publisher** — part of the ingest route
```typescript
// publish to NATS, consumer picks it up
await nc.publish('errors.ingest', sc.encode(JSON.stringify(payload)))
```

**4f. Routes to build:**
- `GET /health` — returns `{ status: 'ok' }` (needed for readiness check)
- `POST /api/auth/register` — create user
- `POST /api/auth/login` — return JWT
- `POST /api/projects` — create project, generate api_key
- `GET /api/projects` — list user's projects
- `PATCH /api/projects/:id/openai-key` — save BYOK OpenAI key (encrypted)
- `POST /api/ingest` — authenticated by `X-API-Key` header, publishes to NATS
- `GET /api/errors` — list errors for a project (with pagination, filter by status)
- `GET /api/errors/:id` — single error with occurrences
- `PATCH /api/errors/:id/status` — resolve/ignore
- `GET /api/errors/search?q=` — Elasticsearch query
- `POST /api/errors/:id/analyze` — calls OpenAI with the error + stack trace, returns explanation

**4g. NATS consumer** — `apps/api/src/consumer/errors.ts`

This runs in the same process as Fastify. On startup, it:
1. Connects to NATS
2. Subscribes to `errors.ingest`
3. For each message:
   - Compute `fingerprint = sha256(message + error_type)`
   - Check Valkey: `SETNX dedup:{fingerprint}:{project_id} 1 EX 300` (5 min dedup window)
   - If new: insert into `errors`, insert occurrence, index in Elasticsearch
   - If seen: `UPDATE errors SET count = count + 1, last_seen = now() WHERE fingerprint = ...`

Copilot prompt: *"Write a NATS JetStream consumer in TypeScript that subscribes to 'errors.ingest', processes each message by computing a SHA256 fingerprint of message+error_type, checking Redis (ioredis) for a dedup key, then either inserting a new error to Postgres + indexing to Elasticsearch, or incrementing the count on the existing error."*

**4h. Server entry point** — `apps/api/src/server.ts`
```typescript
// starts Fastify, runs migrations, starts NATS consumer, all in one process
async function start() {
  await runMigrations()   // run schema.sql on cold start
  await ensureIndex()     // create ES index if missing
  await startConsumer()   // NATS subscriber
  await app.listen({ port: 3001, host: '0.0.0.0' })
}
start()
```

---

### 💻 CODE WORK — Step 5: Next.js Dashboard (4 hours, Copilot builds)

Init Next.js in `apps/web`:
```bash
cd apps/web && npx create-next-app@latest . --typescript --tailwind --app --no-src-dir
```

**Pages to build:**

| Route | What it shows |
|---|---|
| `/` | Landing page — "Drop one line, track every error." + login/register |
| `/dashboard` | Project list → click to enter |
| `/dashboard/[projectId]` | Error list: message, count, last seen, status badge. Poll every 3s. |
| `/dashboard/[projectId]/[errorId]` | Error detail: stack trace, occurrences list, AI analysis button |
| `/dashboard/[projectId]/settings` | Project settings: copy API key, paste OpenAI key (BYOK) |
| `/demo` | A demo page with a button that intentionally throws an error (has SDK installed) |

**Key UI decisions:**
- Tailwind dark theme (looks better in demo videos)
- Error status badges: red (open), grey (ignored), green (resolved)
- Stack trace displayed in a monospace code block
- "AI Analysis" button only appears if the project has an OpenAI key set in settings
- `/demo` page has a big red button: "Throw a test error →" — this is your demo moment

**SDK snippet for `/demo` page** (and for the README's quick-start section):
```html
<script>
  (function() {
    var API_URL = 'https://YOUR_API_ZEROPS_URL';
    var API_KEY = 'your-project-api-key';
    window.onerror = function(msg, src, line, col, err) {
      fetch(API_URL + '/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
        body: JSON.stringify({
          message: msg,
          stack: err ? err.stack : null,
          url: window.location.href,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString()
        })
      }).catch(function() {});
    };
  })();
</script>
```

Copilot prompt: *"Build a Next.js 15 App Router dashboard page at /dashboard/[projectId] that fetches errors from the API every 3 seconds, displays them in a table with columns: error message (truncated to 80 chars), error type, count, last seen (relative time), status badge. Tailwind, dark theme."*

---

### ✋ YOU DO THIS — Step 6: Set Secret Env Vars in Zerops GUI (15 min)

Some env vars are secrets and must NOT go in zerops.yaml (which is in your public repo). Set these manually:

For the `api` service:
1. Go to app.zerops.io → your project → click `api`
2. Left menu → **Environment variables**
3. Add these:
   - `JWT_SECRET` = any long random string (generate one: `openssl rand -hex 32` in terminal)
   - `OPENAI_API_KEY` = your OpenAI API key (used for the demo account's AI analysis)
   - `ENCRYPTION_KEY` = another random 32-char hex string (for encrypting user-submitted BYOK keys)

For the `web` service:
1. Click `web` → Environment variables
2. Update `NEXT_PUBLIC_API_URL` = the `api` Zerops subdomain URL from Step 2c

> These are set once. Zerops injects them securely into the container at runtime.

---

### ✋ YOU DO THIS — Step 7: Connect GitHub to Zerops (15 min)

For **both** `api` and `web` services:
1. Click the service → left menu → **Pipelines & CI/CD settings**
2. Click **Connect with a GitHub repository**
3. Authorize Zerops to access GitHub if prompted
4. Select your `tracer` repo
5. Branch: `main`
6. Click **Save**

From this point, every `git push` to `main` automatically triggers a build and deploy on Zerops. You don't need to do anything manually.

**Trigger the first deploy:**
```bash
git add . && git commit -m "feat: initial tracer implementation"
git push
```

Watch the builds in the Zerops GUI → Pipeline tab. Both `api` and `web` should go green.

---

### ✋ YOU DO THIS — Step 8: Run DB Migrations (5 min)

After first deploy, the `api` service needs the database schema applied.

Option A (auto): If you implemented `runMigrations()` in the server startup (recommended), it runs automatically on first boot. Check the runtime log in Zerops GUI → `api` → **Runtime log**.

Option B (manual): Use Zerops VPN or remote access to run the SQL manually.
1. Install Zerops CLI: `npm i -g @zerops/zcli`
2. Login: `zcli login`
3. `zcli vpn up` — joins the Zerops private network
4. Connect to the DB and run the schema SQL

---

### ✋ YOU DO THIS — Step 9: Verify Everything Works (20 min)

- [ ] Open the `web` public URL — landing page loads
- [ ] Register an account
- [ ] Create a project — copy the API key
- [ ] Open the `/demo` page — update the API key in the demo SDK snippet
- [ ] Click "Throw a test error"
- [ ] Go to dashboard — error should appear within ~5 seconds
- [ ] Click the error — see stack trace, occurrences
- [ ] Go to project settings — paste your OpenAI key → click AI Analysis on an error
- [ ] Search for an error in the search bar

If anything is broken: Zerops GUI → service → **Runtime log** or **Build log**. Paste the error into Copilot Chat.

Note the live URL here (this goes in the submission form):
**Live deployment URL: `___________`**

---

### ✋ YOU DO THIS — Step 10: Record Demo Video (45 min)

**Tool:** QuickTime Player → File → New Screen Recording (macOS, free, no install)

**Script (aim for 60–90 seconds, no "umm", confident pace):**

```
[0:00] Open terminal — show the SDK snippet (3 lines)
"This is Tracer. Add this to any web app and you're done."

[0:08] Open the dashboard — it's empty, clean, dark UI
"Every error gets captured here, in real time."

[0:14] Switch to the /demo page
"Watch." → click "Throw a test error"

[0:17] Switch back to dashboard — error appears
"There it is. Message, count, when it first happened."

[0:22] Click the error → show stack trace
"Stack trace, exactly what broke, full context."

[0:30] Click "AI Analysis"
"One click — AI explains what went wrong and how to fix it."
Show the response: root cause + suggested fix

[0:40] Show the search bar → type the error message
"Search works across every error in the project. Elasticsearch under the hood."

[0:50] Quick cut to Zerops dashboard
"Six Zerops services. API, database, cache, search, message broker, frontend.
All on a private network. Auto-scaling. Deployed from GitHub."
[show the 6 services in the Zerops GUI]

[1:05] Back to dashboard
"Open source. Self-hostable. One weekend."
"GitHub: github.com/[USERNAME]/tracer"
"Live: [zerops URL]"
```

Record the video, export as MP4. Upload to YouTube (unlisted is fine) or X directly.
Paste the video URL here: **`___________`**

---

### ✋ YOU DO THIS — Step 11: Post on X (20 min)

**Compose this post** (edit to make it yours — change wording so it sounds human, not templated):

```
built an open source error tracker in 48h, deployed on @zeropsio

every unhandled exception in your app → captured, deduplicated, searchable, AI-explained

drop 1 script tag and you're done

under the hood it's 6 zerops services: fastify api, nats queue, postgres, valkey,
elasticsearch, next.js — all on a private network, auto-scaling

[attach: demo video or GIF]

live → [web zerops.app URL]
code → github.com/[USERNAME]/tracer

@WeMakeDevs @zeropsio #zerops #devtools #opensource
```

> **Edit it before posting.** Make it feel like you wrote it at 2am after a long build session — genuine, specific, not a press release. Add one line about something that surprised you or something that was tricky to get right. That specificity is what gets engagement.

After posting, copy the post URL and paste it here:
**Social post URL: `___________`**

---

### ✋ YOU DO THIS — Step 12: Fill Submission Form (15 min)

Go to [wemakedevs.org/hackathons/zerops/submit](https://www.wemakedevs.org/hackathons/zerops/submit) and log in.

Fill in:

**Project Title:**
```
Tracer — Open Source Error Tracking on Zerops
```
(Replace "Tracer" with final name. Keep it punchy, under 10 words.)

**Project Description:**
```
Tracer is a self-hostable error tracking platform. Add one script tag to any
web app and every unhandled error gets captured, deduplicated, and stored.
The dashboard shows errors in real time with full stack traces, occurrence
history, and optional AI analysis (BYOK — bring your own OpenAI key). Search
across all errors via Elasticsearch.

Built on 6 Zerops services: a Node.js Fastify API (which also runs the NATS
consumer as a single process), a Next.js dashboard, PostgreSQL for persistence,
Valkey for deduplication and rate limiting, Elasticsearch for full-text search,
and NATS as the message broker that decouples error ingestion from processing.
All services communicate over Zerops' private network. GitHub push triggers
auto-deploy via the Zerops pipeline.
```
(Edit this to match your actual implementation — make sure it's accurate.)

**Repository (Source Code):**
```
https://github.com/YOUR_USERNAME/tracer
```

**Live deployment on Zerops:**
```
https://[your web service URL].zerops.app
```

**Social Post:**
```
[paste the X post URL from Step 11]
```

**AI tools used (disclosed):** GitHub Copilot (code generation, debugging)

Click **Submit**.

---

## Progress Tracker

Mark these off as you go:

- [ ] Pre-flight done
- [ ] GitHub repo created
- [ ] Zerops project + 6 services provisioned
- [ ] Public access enabled for `api` and `web`
- [ ] Monorepo skeleton + zerops.yaml committed
- [ ] API server: DB client, Valkey client, ES client connected
- [ ] API routes: ingest, auth, projects, errors, search, AI analyze
- [ ] NATS consumer running and processing errors correctly
- [ ] Next.js dashboard: all pages built
- [ ] `/demo` page works end-to-end (throw error → appears in dashboard)
- [ ] Secrets set in Zerops GUI (JWT_SECRET, OPENAI_API_KEY)
- [ ] GitHub connected to Zerops, auto-deploy confirmed working
- [ ] DB migrations run on deployed container
- [ ] Live URL verified — everything works from the public URL
- [ ] Demo video recorded and uploaded
- [ ] Social post live on X
- [ ] Submission form submitted at wemakedevs.org

---

## PHASE 2: ZeroSearch — Stretch Goal

> Only attempt if PHASE 1 is fully done, submitted, and you have 6+ hours remaining.
> This would replace the Phase 1 submission (you can only submit one project).
> Realistically, on Aug 9 with a midnight deadline, Phase 2 is a post-hackathon goal.

**What it is:** A semantic search SaaS. Upload documents → get a REST API that does hybrid search (vector + keyword). Like Algolia, but with vector embeddings.

**Extra services needed (on top of Phase 1):**
- `indexer` — Python 3.12 worker: NATS consumer → chunks text → embeds via OpenAI → upserts to Qdrant
- `qdrant` — Vector database (native Zerops service)
- `meilisearch` — Fast keyword search
- `store` — Object Storage (S3-compatible, for original uploaded files)

**Total: 9 Zerops services**

If you want to start Phase 2 anyway, create a new Zerops project and a new GitHub repo (`zerosearch`). Don't touch the Tracer project — it needs to stay up for judging.

---

## Useful Links

| Resource | URL |
|---|---|
| Zerops dashboard | https://app.zerops.io |
| zerops.yaml spec | https://docs.zerops.io/zerops-yaml/specification |
| Env var references | https://docs.zerops.io/features/env-variables |
| Internal networking | https://docs.zerops.io/references/networking/internal-access |
| Public access setup | https://docs.zerops.io/references/networking/public-access |
| Zerops Discord (if stuck) | https://discord.gg/zeropsio |
| Hackathon rules | https://wemakedevs.org/hackathons/zerops/rules |
| Submit form | https://wemakedevs.org/hackathons/zerops/submit |
