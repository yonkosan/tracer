import type { FastifyRequest, FastifyReply } from 'fastify'
import jwt from 'jsonwebtoken'

interface JwtPayload {
  sub: string
  email: string
}

// Attached to req by verifyToken so routes can read req.userId
declare module 'fastify' {
  interface FastifyRequest {
    userId: string
  }
}

export async function verifyToken(req: FastifyRequest, reply: FastifyReply) {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) {
    return reply.code(401).send({ error: 'missing authorization header' })
  }

  try {
    const payload = jwt.verify(auth.slice(7), process.env.JWT_SECRET!) as JwtPayload
    req.userId = payload.sub
  } catch {
    return reply.code(401).send({ error: 'invalid or expired token' })
  }
}
