# Tracer

Open source error tracking. Drop one script tag in your app and every unhandled error gets captured, deduplicated, and shown in a real-time dashboard — with optional AI analysis.

Self-hosted. Deployed on [Zerops](https://zerops.io).

## What it does

- Captures `window.onerror` and `unhandledrejection` events via a lightweight SDK snippet
- Deduplicates errors using a SHA-256 fingerprint + Valkey cache — 500 identical crashes show as one issue with a count
- Stores errors in PostgreSQL, indexes them in Elasticsearch for instant full-text search
- Processes ingest asynchronously via NATS so the SDK call returns in under 5ms
- AI analysis: paste your OpenAI key in project settings and get a root cause + fix suggestion per error (BYOK — your key, never stored in plaintext)

## Stack

Six Zerops managed services, all on a private network:

| Service | Role |
|---|---|
| `api` (Node.js 22 + Fastify) | HTTP server + NATS consumer |
| `web` (Node.js 22 + Next.js) | Dashboard |
| `db` (PostgreSQL 16) | Persistent storage |
| `cache` (Valkey 7) | Deduplication + rate limiting |
| `search` (Elasticsearch 8) | Full-text error search |
| `broker` (NATS 2) | Async ingest queue |

## SDK integration

Paste this before `</body>` in your HTML:

```html
<script>
(function() {
  var T = 'YOUR_PROJECT_API_KEY', U = 'https://YOUR_API_URL';
  window.onerror = function(msg, s, l, c, err) {
    fetch(U + '/api/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': T },
      body: JSON.stringify({
        message: msg, stack: err ? err.stack : null,
        url: location.href, userAgent: navigator.userAgent
      })
    }).catch(function(){});
  };
})();
</script>
```

Get your project API key from the dashboard → project → Settings.

## Running locally

You'll need Docker or the actual Zerops managed services running. The easiest path is deploying to Zerops directly:

```bash
# install zerops cli
npm i -g @zerops/zcli

# push and deploy
zcli service push
```

## Environment variables

Set these in Zerops GUI (never commit them):

| Variable | Service | Description |
|---|---|---|
| `JWT_SECRET` | api | Random 64-char hex string |
| `ENCRYPTION_KEY` | api | Random 32-byte hex string (for BYOK key encryption) |
| `OPENAI_API_KEY` | api | Platform-level OpenAI key (optional, used if project has no BYOK key) |
| `NEXT_PUBLIC_API_URL` | web | Public URL of the `api` service |
| `NEXT_PUBLIC_DEMO_API_KEY` | web | API key of the demo project (for `/demo` page) |

Zerops injects service connection strings automatically — `DATABASE_URL`, `REDIS_HOST`, `NATS_URL`, and `ES_URL` come from `zerops.yaml` env var references.

## Architecture

```
  SDK (script tag)
       │  POST /api/ingest
       ▼
  ┌─────────────────────────────────────────┐
  │          Zerops private network         │
  │  ┌─────────┐  publish  ┌─────────┐      │
  │  │   api   │ ────────► │ broker  │      │
  │  │ Fastify │ ◄─ sub ── │  NATS   │      │
  │  └────┬────┘           └─────────┘      │
  │       │                                 │
  │  ┌────┼──────────────────┐              │
  │  ▼    ▼                  ▼              │
  │ ┌────┐ ┌───────┐ ┌──────────┐           │
  │ │ db │ │ cache │ │  search  │           │
  │ │ PG │ │Valkey │ │ Elastic  │           │
  │ └────┘ └───────┘ └──────────┘           │
  │  ┌────────────────┐                     │
  │  │      web       │  polls api/3s       │
  │  │    Next.js     │                     │
  │  └────────────────┘                     │
  └─────────────────────────────────────────┘
```

## Built with

[WeMakeDevs × Zerops Challenge](https://wemakedevs.org/hackathons/zerops) — August 2026
