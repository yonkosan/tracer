import Redis from 'ioredis'

if (!process.env.REDIS_HOST) {
  throw new Error('REDIS_HOST is not set')
}

export const cache = new Redis({
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  lazyConnect: true,
  maxRetriesPerRequest: 3,
})

cache.on('error', (err) => {
  console.error('redis error:', err.message)
})
