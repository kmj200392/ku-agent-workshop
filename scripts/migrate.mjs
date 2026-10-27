import { createClient } from '@libsql/client';
import { readFile } from 'node:fs/promises';
const url = process.env.TURSO_DATABASE_URL;
if (!url) throw new Error('Set TURSO_DATABASE_URL before migrating.');
if (process.env.VERCEL && url.startsWith('file:')) throw new Error('Vercel requires a remote database.');
const client = createClient({url, authToken: process.env.TURSO_AUTH_TOKEN});
try {
  const schema = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8');
  await client.batch(schema.split(';').map(x => x.trim()).filter(Boolean), 'write');
  console.log('Workshop schema is ready.');
} finally { client.close(); }
