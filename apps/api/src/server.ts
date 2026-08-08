import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import { migrate } from './db/migrate'
import { ensureIndex } from './search/client'
import { startConsumer } from './consumer/errors'
import { healthRoutes } from './routes/health'
import { authRoutes } from './routes/auth'
import { projectRoutes } from './routes/projects'
import { ingestRoutes } from './routes/ingest'
import { errorRoutes } from './routes/errors'
import { analyzeRoutes } from './routes/analyze'

const app = Fastify({ logger: true, trustProxy: true })

app.register(cors, { origin: true })
app.register(helmet, { contentSecurityPolicy: false })

app.register(healthRoutes)
app.register(authRoutes)
app.register(projectRoutes)
app.register(ingestRoutes)
app.register(errorRoutes)
app.register(analyzeRoutes)

async function start() {
  try {
    await migrate()
    await ensureIndex()
    await startConsumer()

    const port = Number(process.env.PORT) || 3001
    await app.listen({ port, host: '0.0.0.0' })
    console.log(`api listening on :${port}`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()
