import type { FastifyInstance } from 'fastify'
import OpenAI from 'openai'
import { db } from '../db/client'
import { verifyToken } from './middleware'
import { decryptKey } from './projects'

export async function analyzeRoutes(app: FastifyInstance) {
  app.post<{ Params: { id: string } }>(
    '/api/errors/:id/analyze',
    { preHandler: verifyToken },
    async (req, reply) => {
      // fetch error + project's OpenAI key
      const { rows } = await db.query(
        `SELECT e.message, e.error_type, e.stack_trace, p.openai_key_enc
         FROM errors e
         JOIN projects p ON p.id = e.project_id
         WHERE e.id = $1 AND p.user_id = $2`,
        [req.params.id, req.userId]
      )

      if (!rows[0]) return reply.code(404).send({ error: 'error not found' })

      const { message, error_type, stack_trace, openai_key_enc } = rows[0]

      // prefer project's BYOK key, fall back to platform key
      const apiKey = openai_key_enc
        ? decryptKey(openai_key_enc)
        : process.env.OPENAI_API_KEY

      if (!apiKey) {
        return reply.code(422).send({
          error: 'no OpenAI key configured — add one in project settings',
          code: 'NO_OPENAI_KEY',
        })
      }

      const openai = new OpenAI({ apiKey })

      const prompt = `You are a debugging assistant. A web application threw the following error:

Error type: ${error_type}
Message: ${message}
${stack_trace ? `\nStack trace:\n${stack_trace.slice(0, 3000)}` : ''}

In 3–5 sentences: explain what caused this error and what the developer should do to fix it. Be specific and direct. No preamble.`

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 300,
        temperature: 0.3,
      })

      return { analysis: completion.choices[0].message.content }
    }
  )
}
