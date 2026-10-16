import nextEnv from '@next/env';
const {loadEnvConfig}=nextEnv;
import { createClient } from '@libsql/client';
import { readFile } from 'node:fs/promises';
loadEnvConfig(process.cwd());
if (!process.env.TURSO_DATABASE_URL) throw new Error('Set TURSO_DATABASE_URL before migrating');
const db = createClient({url:process.env.TURSO_DATABASE_URL,authToken:process.env.TURSO_AUTH_TOKEN});
try {
 await db.execute(await readFile(new URL('../db/schema.sql', import.meta.url),'utf8'));
 console.log('Database schema is ready. Existing workspace data was preserved.');
} finally { db.close(); }
