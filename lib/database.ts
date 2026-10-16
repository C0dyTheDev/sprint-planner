import { createClient, type Client } from '@libsql/client';

let client: Client | undefined;

export function getDatabase(): Client {
  if (client) return client;
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url) throw new Error('TURSO_DATABASE_URL is not configured');
  if (process.env.VERCEL && !/^(libsql|https):\/\//.test(url)) {
    throw new Error('Vercel requires a remote database, not a local SQLite file');
  }
  if (/^(libsql|https):\/\//.test(url) && !authToken) {
    throw new Error('TURSO_AUTH_TOKEN is not configured');
  }
  client = createClient({ url, authToken });
  return client;
}
