import { createClient, type Client, type InValue } from '@libsql/client';

let client: Client | undefined;
export function getClient() {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL;
    if (!url) throw new Error('Database is not configured');
    if (process.env.VERCEL && url.startsWith('file:')) throw new Error('Hosted deployments require durable storage');
    client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  }
  return client;
}

// Preserve the existing parameterized SQLite queries while moving from a D1
// binding to Turso's HTTP client. No browser input can choose SQL statements.
export function db() {
  return { prepare(sql: string) {
    let args: InValue[] = [];
    const statement = {
      bind(...values: InValue[]) { args = values; return statement; },
      async all() { const r = await getClient().execute({ sql, args }); return { results: r.rows }; },
      async first<T = any>(): Promise<T | null> { const r = await getClient().execute({ sql, args }); return (r.rows[0] as T) ?? null; },
      async run() { return getClient().execute({ sql, args }); },
    };
    return statement;
  }};
}
