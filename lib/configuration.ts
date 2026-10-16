import { PASSWORD_MIN_LENGTH, anyPasswordStored } from './credentials';

export function missingConfiguration() {
  const url = process.env.TURSO_DATABASE_URL?.trim() ?? '';
  const remote = /^(libsql|https):\/\//.test(url);
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? '';
  return ['AUTH_SECRET', 'BOOTSTRAP_ADMIN_EMAIL', 'TURSO_DATABASE_URL']
    .filter(key => !process.env[key]?.trim())
    .concat(password.trim() && password.length < PASSWORD_MIN_LENGTH ? [`BOOTSTRAP_ADMIN_PASSWORD (at least ${PASSWORD_MIN_LENGTH} characters)`] : [])
    .concat(remote && !process.env.TURSO_AUTH_TOKEN?.trim() ? ['TURSO_AUTH_TOKEN'] : [])
    // A local SQLite file is not persistent inside a Vercel function.
    .concat(process.env.VERCEL && url && !remote ? ['TURSO_DATABASE_URL (remote libsql:// URL)'] : []);
}

// The deployment password only matters until someone has a stored password, so it may be removed afterwards.
export async function missingSetup() {
  const missing = missingConfiguration();
  if (!missing.length && !process.env.BOOTSTRAP_ADMIN_PASSWORD?.trim() && !await anyPasswordStored()) missing.push('BOOTSTRAP_ADMIN_PASSWORD');
  return missing;
}
