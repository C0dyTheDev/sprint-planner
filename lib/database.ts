import { createClient, type Client } from '@libsql/client';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

let ready: Promise<Client> | undefined;

function connect(): Client {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url) throw new Error('TURSO_DATABASE_URL is not configured');
  if (process.env.VERCEL && !/^(libsql|https):\/\//.test(url)) {
    throw new Error('Vercel requires a remote database, not a local SQLite file');
  }
  if (/^(libsql|https):\/\//.test(url) && !authToken) {
    throw new Error('TURSO_AUTH_TOKEN is not configured');
  }
  return createClient({ url, authToken });
}

async function open() {
  const client = connect();
  try {
    // Every schema statement is idempotent, so each instance applies it once before first use.
    await client.executeMultiple(await readFile(join(process.cwd(), 'db', 'schema.sql'), 'utf8'));
    return client;
  } catch (error) {
    client.close();
    throw error;
  }
}

export function getDatabase(): Promise<Client> {
  ready ??= open().catch(error => { ready = undefined; throw error; });
  return ready;
}
