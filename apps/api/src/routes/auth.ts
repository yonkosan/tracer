import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { db } from '../db/client'

function jwtSecret() {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not set')
  return process.env.JWT_SECRET
}

export async function authRoutes(app: FastifyInstance) {
  app.post<{ Body: { email: string; password: string } }>('/api/auth/register', async (req, reply) => {
    const { email, password } = req.body
    if (!email || !password) return reply.code(400).send({ error: 'email and password required' })

    const hash = await bcrypt.hash(password, 12)

    try {
      const { rows } = await db.query<{ id: string }>(
        'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id',
        [email.toLowerCase().trim(), hash]
      )
      const token = jwt.sign({ sub: rows[0].id, email }, jwtSecret(), { expiresIn: '7d' })
      return reply.code(201).send({ token })
    } catch (err: unknown) {
      if ((err as { code?: string }).code === '23505') {
        return reply.code(409).send({ error: 'email already registered' })
      }
      throw err
    }
  })

  app.post<{ Body: { email: string; password: string } }>('/api/auth/login', async (req, reply) => {
    const { email, password } = req.body
    if (!email || !password) return reply.code(400).send({ error: 'email and password required' })

    const { rows } = await db.query<{ id: string; password_hash: string }>(
      'SELECT id, password_hash FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    )

    if (!rows[0] || !(await bcrypt.compare(password, rows[0].password_hash))) {
      return reply.code(401).send({ error: 'invalid credentials' })
    }

    const token = jwt.sign({ sub: rows[0].id, email }, jwtSecret(), { expiresIn: '7d' })
    return { token }
  })
}
