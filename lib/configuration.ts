export function missingConfiguration() {
  return ['AUTH_SECRET', 'AUTH_GITHUB_ID', 'AUTH_GITHUB_SECRET', 'BOOTSTRAP_ADMIN_EMAIL', 'TURSO_DATABASE_URL']
    .filter(key => !process.env[key]?.trim())
    .concat(/^(libsql|https):\/\//.test(process.env.TURSO_DATABASE_URL ?? '') && !process.env.TURSO_AUTH_TOKEN ? ['TURSO_AUTH_TOKEN'] : []);
}
