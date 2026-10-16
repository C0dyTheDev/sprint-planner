import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { getDatabase } from './database';
import { isBootstrapAdmin } from './bootstrap';

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 200;
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const COST = 2 ** 15;

function derive(password: string, salt: Buffer, cost: number) {
  return new Promise<Buffer>((resolve, reject) =>
    scrypt(password.normalize('NFKC'), salt, 64, { N: cost, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolve(key)));
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  return `scrypt$${COST}$${salt.toString('base64')}$${(await derive(password, salt, COST)).toString('base64')}`;
}

export async function verifyHash(password: string, stored: string) {
  const [scheme, cost, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const actual = await derive(password, Buffer.from(salt, 'base64'), Number(cost));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function passwordProblem(password: string) {
  if (password.length < PASSWORD_MIN_LENGTH) return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  if (password.length > PASSWORD_MAX_LENGTH) return `Password must be at most ${PASSWORD_MAX_LENGTH} characters.`;
  return null;
}

export async function setPassword(email: string, password: string) {
  await (await getDatabase()).execute({
    sql: `INSERT INTO credentials (email, password_hash, failed_attempts, locked_until, updated_at) VALUES (?, ?, 0, NULL, ?)
          ON CONFLICT(email) DO UPDATE SET password_hash = excluded.password_hash, failed_attempts = 0, locked_until = NULL, updated_at = excluded.updated_at`,
    args: [email.trim().toLowerCase(), await hashPassword(password), new Date().toISOString()],
  });
}

export async function removePassword(email: string) {
  await (await getDatabase()).execute({ sql: 'DELETE FROM credentials WHERE email = ?', args: [email.trim().toLowerCase()] });
}

// The configured administrator starts with the deployment password and can change it after signing in.
async function seedBootstrapPassword(email: string) {
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? '';
  if (!isBootstrapAdmin(email) || passwordProblem(password)) return;
  await (await getDatabase()).execute({
    sql: 'INSERT OR IGNORE INTO credentials (email, password_hash, failed_attempts, locked_until, updated_at) VALUES (?, ?, 0, NULL, ?)',
    args: [email, await hashPassword(password), new Date().toISOString()],
  });
}

export async function verifyPassword(rawEmail: string, password: string) {
  const email = rawEmail.trim().toLowerCase();
  const db = await getDatabase();
  const find = async () => (await db.execute({ sql: 'SELECT password_hash, locked_until FROM credentials WHERE email = ?', args: [email] })).rows[0];
  let row = await find();
  if (!row && isBootstrapAdmin(email)) { await seedBootstrapPassword(email); row = await find(); }
  if (!row) {
    // Spend the same work as a real check so response time does not reveal which emails exist.
    await hashPassword(password);
    return false;
  }
  const now = new Date();
  if (row.locked_until && String(row.locked_until) > now.toISOString()) return false;
  if (await verifyHash(password, String(row.password_hash))) {
    await db.execute({ sql: 'UPDATE credentials SET failed_attempts = 0, locked_until = NULL WHERE email = ?', args: [email] });
    return true;
  }
  await db.execute({
    sql: `UPDATE credentials SET
            failed_attempts = CASE WHEN failed_attempts + 1 >= ? THEN 0 ELSE failed_attempts + 1 END,
            locked_until = CASE WHEN failed_attempts + 1 >= ? THEN ? ELSE locked_until END
          WHERE email = ?`,
    args: [MAX_FAILED_ATTEMPTS, MAX_FAILED_ATTEMPTS, new Date(now.getTime() + LOCK_MINUTES * 60_000).toISOString(), email],
  });
  return false;
}

export async function anyPasswordStored() {
  return (await (await getDatabase()).execute('SELECT 1 FROM credentials LIMIT 1')).rows.length > 0;
}
