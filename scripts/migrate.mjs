import { createClient } from '@libsql/client';
import { readFile } from 'node:fs/promises';
const url = process.env.TURSO_DATABASE_URL;
if (!url) throw new Error('Set TURSO_DATABASE_URL before migrating.');
if (process.env.VERCEL && url.startsWith('file:')) throw new Error('Vercel requires a remote database.');
const client = createClient({url, authToken: process.env.TURSO_AUTH_TOKEN});
try {
  const schema = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8');
  await client.batch(schema.split(';').map(x => x.trim()).filter(Boolean), 'write');
  // Existing runs all used the school model. Preserve that provenance when upgrading.
  const columns=new Set((await client.execute('PRAGMA table_info(runs)')).rows.map(r=>r.name));
  if(!columns.has('provider'))await client.execute("ALTER TABLE runs ADD COLUMN provider TEXT NOT NULL DEFAULT 'school'");
  if(!columns.has('model'))await client.execute("ALTER TABLE runs ADD COLUMN model TEXT NOT NULL DEFAULT 'claude-haiku-5-5'");
  console.log('Workshop schema is ready.');
} finally { client.close(); }
