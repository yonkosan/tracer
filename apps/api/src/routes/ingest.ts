import type { FastifyInstance } from 'fastify'
import { StringCodec } from 'nats'
import { db } from '../db/client'
import { cache } from '../cache/client'
import { getNatsConnection, processError } from '../consumer/errors'

export async function ingestRoutes(app: FastifyInstance) {
  app.post('/api/ingest', async (req, reply) => {
    const apiKey = req.headers['x-api-key'] as string | undefined
    if (!apiKey) return reply.code(401).send({ error: 'missing X-API-Key header' })

    const { rows } = await db.query<{ id: string }>(
      'SELECT id FROM projects WHERE api_key = $1',
      [apiKey]
    )
    if (!rows[0]) return reply.code(401).send({ error: 'invalid API key' })

    const projectId = rows[0].id

    // rate limit: max 1000 ingest calls per minute per project
    const minute = Math.floor(Date.now() / 60000)
    const rateKey = `rate:${projectId}:${minute}`
    const calls = await cache.incr(rateKey)
    if (calls === 1) await cache.expire(rateKey, 120)
    if (calls > 1000) return reply.code(429).send({ error: 'rate limit exceeded' })

    const body = req.body as {
      message?: string
      stack?: string
      url?: string
      userAgent?: string
      timestamp?: string
      metadata?: Record<string, unknown>
    }

    const payload = {
      project_id: projectId,
      message: (body.message || 'Unknown error').slice(0, 2000),
      error_type: extractErrorType(body.message),
      stack_trace: body.stack?.slice(0, 10000) || null,
      url: body.url?.slice(0, 500) || null,
      user_agent: body.userAgent?.slice(0, 500) || null,
      ip_hash: hashIp(req.ip),
      metadata: body.metadata || null,
    }

    const nc = getNatsConnection()
    if (nc) {
      const sc = StringCodec()
      nc.publish('errors.ingest', sc.encode(JSON.stringify(payload)))
    } else {
      // NATS unavailable — process synchronously so we never drop an error
      await processError(payload)
    }

    return reply.code(202).send({ ok: true })
  })
}

function extractErrorType(message?: string): string {
  if (!message) return 'Error'
  const match = message.match(/^([A-Za-z]+Error|[A-Za-z]+Exception)/)
  return match ? match[1] : 'Error'
}

function hashIp(ip: string): string {
  const crypto = require('crypto')
  return crypto.createHash('sha256').update(ip + (process.env.JWT_SECRET || '')).digest('hex').slice(0, 16)
}
