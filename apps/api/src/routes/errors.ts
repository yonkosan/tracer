import type { FastifyInstance } from 'fastify'
import { db } from '../db/client'
import { es } from '../search/client'
import { verifyToken } from './middleware'

export async function errorRoutes(app: FastifyInstance) {
  // list errors for a project
  app.get<{ Querystring: { projectId: string; status?: string; page?: string } }>(
    '/api/errors',
    { preHandler: verifyToken },
    async (req, reply) => {
      const { projectId, status, page = '1' } = req.query
      if (!projectId) return reply.code(400).send({ error: 'projectId required' })

      // confirm project belongs to caller
      const { rows: pRows } = await db.query(
        'SELECT id FROM projects WHERE id = $1 AND user_id = $2',
        [projectId, req.userId]
      )
      if (!pRows[0]) return reply.code(404).send({ error: 'project not found' })

      const limit = 50
      const offset = (Number(page) - 1) * limit
      const params: (string | number)[] = [projectId, limit, offset]
      let where = 'WHERE project_id = $1'
      if (status) {
        where += ' AND status = $4'
        params.push(status)
      }

      const { rows } = await db.query(
        `SELECT id, fingerprint, message, error_type, status, count, first_seen, last_seen
         FROM errors ${where}
         ORDER BY last_seen DESC
         LIMIT $2 OFFSET $3`,
        params
      )

      const { rows: countRows } = await db.query(
        `SELECT COUNT(*) FROM errors WHERE project_id = $1${status ? ' AND status = $2' : ''}`,
        status ? [projectId, status] : [projectId]
      )

      return { errors: rows, total: Number(countRows[0].count) }
    }
  )

  // single error with occurrences
  app.get<{ Params: { id: string } }>(
    '/api/errors/:id',
    { preHandler: verifyToken },
    async (req, reply) => {
      const { rows } = await db.query(
        `SELECT e.*, p.user_id FROM errors e
         JOIN projects p ON p.id = e.project_id
         WHERE e.id = $1`,
        [req.params.id]
      )
      if (!rows[0]) return reply.code(404).send({ error: 'error not found' })
      if (rows[0].user_id !== req.userId) return reply.code(403).send({ error: 'forbidden' })

      const { rows: occurrences } = await db.query(
        'SELECT id, url, user_agent, created_at, metadata FROM error_occurrences WHERE error_id = $1 ORDER BY created_at DESC LIMIT 20',
        [req.params.id]
      )

      const { user_id: _, ...error } = rows[0]
      return { ...error, occurrences }
    }
  )

  // update status (open / resolved / ignored)
  app.patch<{ Params: { id: string }; Body: { status: string } }>(
    '/api/errors/:id/status',
    { preHandler: verifyToken },
    async (req, reply) => {
      const { status } = req.body
      if (!['open', 'resolved', 'ignored'].includes(status)) {
        return reply.code(400).send({ error: 'status must be open, resolved, or ignored' })
      }

      const { rows } = await db.query(
        `UPDATE errors SET status = $1
         WHERE id = $2 AND project_id IN (SELECT id FROM projects WHERE user_id = $3)
         RETURNING id`,
        [status, req.params.id, req.userId]
      )
      if (!rows[0]) return reply.code(404).send({ error: 'error not found' })

      // keep elasticsearch in sync
      await es.update({ index: 'errors', id: req.params.id, doc: { status } })

      return { ok: true }
    }
  )

  // full-text search via elasticsearch
  app.get<{ Querystring: { q: string; projectId: string } }>(
    '/api/errors/search',
    { preHandler: verifyToken },
    async (req, reply) => {
      const { q, projectId } = req.query
      if (!q || !projectId) return reply.code(400).send({ error: 'q and projectId required' })

      // confirm ownership
      const { rows } = await db.query(
        'SELECT id FROM projects WHERE id = $1 AND user_id = $2',
        [projectId, req.userId]
      )
      if (!rows[0]) return reply.code(404).send({ error: 'project not found' })

      const result = await es.search({
        index: 'errors',
        query: {
          bool: {
            must: [
              { term: { project_id: projectId } },
              {
                multi_match: {
                  query: q,
                  fields: ['message', 'error_type', 'stack_trace'],
                  fuzziness: 'AUTO',
                },
              },
            ],
          },
        },
        size: 20,
      })

      return result.hits.hits.map((h) => ({ id: h._id, ...h._source }))
    }
  )
}
