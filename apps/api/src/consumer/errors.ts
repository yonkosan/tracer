import { connect, StringCodec, NatsConnection } from 'nats'
import crypto from 'crypto'
import { db } from '../db/client'
import { cache } from '../cache/client'
import { es } from '../search/client'

let nc: NatsConnection | null = null

interface IngestPayload {
  project_id: string
  message: string
  error_type: string
  stack_trace: string | null
  url: string | null
  user_agent: string | null
  ip_hash: string | null
  metadata: Record<string, unknown> | null
}

async function processError(payload: IngestPayload) {
  const { project_id, message, error_type, stack_trace, url, user_agent, ip_hash, metadata } = payload

  const fingerprint = crypto
    .createHash('sha256')
    .update(`${project_id}:${message}:${error_type}`)
    .digest('hex')

  // 5-minute dedup window — if we've seen this fingerprint recently, just bump count
  const dedupKey = `dedup:${fingerprint}`
  const seen = await cache.get(dedupKey)

  if (seen) {
    await db.query(
      'UPDATE errors SET count = count + 1, last_seen = NOW() WHERE project_id = $1 AND fingerprint = $2',
      [project_id, fingerprint]
    )
  } else {
    // upsert: handles the race where two identical errors arrive simultaneously
    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO errors (project_id, fingerprint, message, error_type, stack_trace, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (project_id, fingerprint)
       DO UPDATE SET count = errors.count + 1, last_seen = NOW()
       RETURNING id`,
      [project_id, fingerprint, message, error_type, stack_trace, metadata ? JSON.stringify(metadata) : null]
    )

    const errorId = rows[0].id

    await db.query(
      'INSERT INTO error_occurrences (error_id, url, user_agent, ip_hash, metadata) VALUES ($1, $2, $3, $4, $5)',
      [errorId, url, user_agent, ip_hash, metadata ? JSON.stringify(metadata) : null]
    )

    // index into elasticsearch for search
    await es.index({
      index: 'errors',
      id: errorId,
      document: {
        project_id,
        message,
        error_type,
        stack_trace,
        fingerprint,
        status: 'open',
        first_seen: new Date(),
        last_seen: new Date(),
        count: 1,
      },
    })

    await cache.setex(dedupKey, 300, errorId)
  }
}

export async function startConsumer() {
  if (!process.env.NATS_URL) {
    console.warn('NATS_URL not set — skipping NATS consumer')
    return
  }

  try {
    nc = await connect({ servers: process.env.NATS_URL })
    const sc = StringCodec()

    console.log('nats consumer connected')

    const sub = nc.subscribe('errors.ingest')
    ;(async () => {
      for await (const msg of sub) {
        try {
          const payload = JSON.parse(sc.decode(msg.data)) as IngestPayload
          await processError(payload)
        } catch (err) {
          console.error('consumer processing error:', (err as Error).message)
        }
      }
    })()
  } catch (err) {
    // NATS unavailable — ingest route falls back to synchronous processing
    console.warn('nats unavailable, consumer not started:', (err as Error).message)
  }
}

export function getNatsConnection() {
  return nc
}

// exported so the ingest route can call it directly when NATS is down
export { processError }
