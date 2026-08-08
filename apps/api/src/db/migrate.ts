import fs from 'fs'
import path from 'path'
import { db } from './client'

export async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8')
  await db.query(sql)
  console.log('migrations applied')
}
