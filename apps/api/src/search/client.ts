import { Client } from '@elastic/elasticsearch'

if (!process.env.ES_URL) {
  throw new Error('ES_URL is not set')
}

export const es = new Client({
  node: process.env.ES_URL,
  auth: process.env.ES_USER
    ? { username: process.env.ES_USER, password: process.env.ES_PASSWORD ?? '' }
    : undefined,
})

export async function ensureIndex() {
  const exists = await es.indices.exists({ index: 'errors' })
  if (exists) return

  await es.indices.create({
    index: 'errors',
    mappings: {
      properties: {
        project_id:  { type: 'keyword' },
        message:     { type: 'text' },
        error_type:  { type: 'keyword' },
        stack_trace: { type: 'text' },
        fingerprint: { type: 'keyword' },
        status:      { type: 'keyword' },
        first_seen:  { type: 'date' },
        last_seen:   { type: 'date' },
        count:       { type: 'integer' },
      },
    },
  })

  console.log('elasticsearch index "errors" created')
}
