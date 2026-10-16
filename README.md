# Sprint Planner

Sprint Overview for developers and 3D designers, adapted to deploy on **Vercel** with standard **Next.js 16**, **Auth.js / GitHub sign-in**, and a persistent **Turso/libSQL** database.

The app includes a four-week Gantt chart with a highlighted two-week planning window, daily capacity and leave, assignments across teams and sprints, Czech/English UI, recognition with one point per award and person/date filters, statistics, manager roles, audit history, CSV export, and JSON backup export. The free-capacity list and employee weekly-capacity editor scroll through all entries.

The original Sites application is separate. This repository contains application source, not its live database, employee roster, credentials, or Sites hosting configuration.

## Deploy to Vercel

1. Create a **Turso libSQL database** and a database auth token. Use a remote `libsql://...` database in production. A file stored inside a Vercel function is not persistent storage.
2. Create a **GitHub OAuth App** under GitHub → Settings → Developer settings → OAuth Apps. Set its homepage to your stable Vercel production URL and its callback to `https://YOUR-DOMAIN/api/auth/callback/github`. Use a separate OAuth app with `http://localhost:3000/api/auth/callback/github` for development. The GitHub email used for the first administrator must be verified.
3. Import `C0dyTheDev/sprint-planner` into Vercel. Framework: **Next.js**, root directory: repository root, Node.js: **22.x**. `vercel.json` supplies install/build commands. Enable Corepack with `ENABLE_EXPERIMENTAL_COREPACK=1` so Vercel uses the pinned pnpm version.
4. Configure these environment variables in Vercel. Redeploy after changing them.

   | Variable | Value |
   | --- | --- |
   | `AUTH_SECRET` | Generate a random value with `openssl rand -base64 32`. Keep it secret. |
   | `AUTH_GITHUB_ID` | GitHub OAuth App client ID |
   | `AUTH_GITHUB_SECRET` | GitHub OAuth App client secret |
   | `AUTH_URL` | Canonical production URL, for example `https://YOUR-PROJECT.vercel.app` |
   | `BOOTSTRAP_ADMIN_EMAIL` | Exact verified email on the first administrator's GitHub account |
   | `TURSO_DATABASE_URL` | Remote database URL from Turso |
   | `TURSO_AUTH_TOKEN` | Turso database auth token |
   | `ENABLE_EXPERIMENTAL_COREPACK` | `1` |

5. Initialize the schema **once**, using the production Turso values in a local ignored `.env.local`, then run `pnpm db:migrate`. This creates the table without overwriting data. Migration is a separate operation, not a side effect of every build or page request.
6. If migrating an existing plan, import its backup **before the first login** using the instructions below. Otherwise the first authorized administrator's login initializes an empty employee list, six VR teams, and current/next sprints on the two-week cadence anchored at 19 October 2026.
7. Sign in with GitHub. In **Settings → Manager access**, add each scrum master's or viewer's verified GitHub email and role. Unknown users cannot sign in or initialize a workspace. Adding a member does not send an invitation.

Use separate databases and OAuth configuration for development, previews, and production. When preview variables are configured, set their `AUTH_URL` to the matching stable preview domain and register its callback in a separate OAuth app. Preview builds without configuration show a setup message and do not expose planning data.

## Move an existing Sites plan

1. In the original Sprint Overview, as an administrator, open **Settings → Data export → Download backup**.
2. Keep the JSON file outside this repository. The ignore rules also exclude backup JSON and database files.
3. Point `.env.local` at a **fresh destination database** and set `BOOTSTRAP_ADMIN_EMAIL` to your verified GitHub email.
4. Run:

   ```sh
   pnpm db:import /secure/path/sprint-overview-backup.json
   ```

The importer creates the schema if needed, preserves planning records, snapshots, recognition, revisions, and audit history, and adds/promotes the configured email as an administrator. It refuses to replace an existing workspace. Importing does not change the original Sites database. Existing app membership emails must match the verified GitHub email used for sign-in.

## Local development

Use Node.js 22.13+ (22.x recommended) and the pinned pnpm version via Corepack:

```sh
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env.local
# Fill in the OAuth credentials, random AUTH_SECRET, and administrator email.
# The default file:./local.db works locally without a Turso token.
pnpm db:migrate
pnpm dev
```

Open `http://localhost:3000`. There is no authentication bypass or default password. The production configuration requires a remote database on Vercel.

## Checks

```sh
pnpm test
pnpm typecheck
pnpm build
```

Tests cover daily capacity, legacy schedule quantities, leave and holidays, multi-sprint allocations, closed sprint snapshots, recognition, Czech/English rendering, first-administrator bootstrap, membership and verified-email policy, exports, and concurrent revision-guarded saves against an actual local SQLite database. CI runs checks and a production build without real credentials.

## Runtime model

- All business data stays in a versioned JSON workspace in a shared database row, not browser storage or function-local files.
- Writes are explicit domain commands; a conditional SQL update on `revision` prevents one manager overwriting another's changes across Vercel instances. Stale writes return HTTP 409.
- JWT sessions last eight hours. GitHub verified email is checked at sign-in. Workspace membership and roles are checked on every API request, so removing a member or changing a role takes effect without waiting for a session to expire.
- Only the configured bootstrap email may create the first workspace. The first anonymous/unknown visitor cannot become administrator.
- Mutations check the request origin. OAuth/session handling uses Auth.js; untrusted identity headers are never used.
- Recognition and audit data are hidden from viewers. Backup export requires an administrator.
- Secrets belong in Vercel environment variables or ignored `.env.local`. Never prefix database or OAuth secrets with `NEXT_PUBLIC_`.
- Times are planned as daily quantities in 15-minute increments. Closed sprints retain snapshots; active changes require reasons. Capacity is a plan, not actual time tracking.

This small-workspace architecture supports up to 300 employees, 15,000 allocations, and 200 sprints. For larger workloads, normalize entities into separate transactional tables.

## Reference documentation

- [Vercel: Next.js](https://vercel.com/docs/frameworks/full-stack/nextjs)
- [Auth.js: Next.js installation](https://authjs.dev/getting-started/installation)
- [Auth.js: GitHub provider](https://authjs.dev/getting-started/providers/github)
- [Turso: Next.js](https://docs.turso.tech/sdk/ts/guides/nextjs)
