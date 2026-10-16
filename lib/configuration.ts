export function missingConfiguration() {
  const url = process.env.TURSO_DATABASE_URL?.trim() ?? '';
  const remote = /^(libsql|https):\/\//.test(url);
  return ['AUTH_SECRET', 'AUTH_GITHUB_ID', 'AUTH_GITHUB_SECRET', 'BOOTSTRAP_ADMIN_EMAIL', 'TURSO_DATABASE_URL']
    .filter(key => !process.env[key]?.trim())
    .concat(remote && !process.env.TURSO_AUTH_TOKEN?.trim() ? ['TURSO_AUTH_TOKEN'] : [])
    // A local SQLite file is not persistent inside a Vercel function.
    .concat(process.env.VERCEL && url && !remote ? ['TURSO_DATABASE_URL (remote libsql:// URL)'] : []);
}
