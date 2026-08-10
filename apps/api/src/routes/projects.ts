import type { FastifyInstance } from 'fastify'
import crypto from 'crypto'
import { db } from '../db/client'
import { verifyToken } from './middleware'

// AES-256-GCM encrypt/decrypt for BYOK OpenAI keys
function encryptKey(plaintext: string): string {
  if (!process.env.ENCRYPTION_KEY) throw new Error('ENCRYPTION_KEY is not set')
  const iv = crypto.randomBytes(12)
  const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex')
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

export function decryptKey(ciphertext: string): string {
  if (!process.env.ENCRYPTION_KEY) throw new Error('ENCRYPTION_KEY is not set')
  const buf = Buffer.from(ciphertext, 'base64')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const encrypted = buf.subarray(28)
  const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex')
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(encrypted) + decipher.final('utf8')
}

export async function projectRoutes(app: FastifyInstance) {
  app.post('/api/projects', { preHandler: verifyToken }, async (req, reply) => {
    const { name } = req.body as { name: string }
    if (!name?.trim()) return reply.code(400).send({ error: 'project name required' })

    const { rows } = await db.query<{ id: string; api_key: string; name: string; created_at: string }>(
      'INSERT INTO projects (user_id, name) VALUES ($1, $2) RETURNING id, api_key, name, created_at',
      [(req as { userId: string }).userId, name.trim()]
    )
    return reply.code(201).send(rows[0])
  })

  app.get('/api/projects', { preHandler: verifyToken }, async (req) => {
    const { rows } = await db.query(
      `SELECT p.id, p.name, p.api_key, p.created_at,
              COUNT(e.id) FILTER (WHERE e.status = 'open') AS open_errors,
              COUNT(e.id) AS total_errors,
              MAX(e.last_seen) AS last_error_at
       FROM projects p
       LEFT JOIN errors e ON e.project_id = p.id
       WHERE p.user_id = $1
       GROUP BY p.id
       ORDER BY p.created_at DESC`,
      [(req as { userId: string }).userId]
    )
    return rows
  })

  app.patch<{ Params: { id: string }; Body: { openai_key: string } }>(
    '/api/projects/:id/openai-key',
    { preHandler: verifyToken },
    async (req, reply) => {
      const { id } = req.params
      const { openai_key } = req.body

      // confirm project belongs to this user
      const { rows } = await db.query(
        'SELECT id FROM projects WHERE id = $1 AND user_id = $2',
        [id, (req as { userId: string }).userId]
      )
      if (!rows[0]) return reply.code(404).send({ error: 'project not found' })

      const enc = openai_key ? encryptKey(openai_key) : null
      await db.query('UPDATE projects SET openai_key_enc = $1 WHERE id = $2', [enc, id])
      return { ok: true }
    }
  )
}
