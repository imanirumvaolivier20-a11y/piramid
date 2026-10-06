# Pyramid

"GitHub for construction": every project has a running, timestamped history of daily reports,
expenses, materials used and wages paid, so anyone involved can see what happened on a job,
when, and who did it.

**Stack:** Next.js (App Router, TypeScript) · PostgreSQL · Prisma · Tailwind CSS · Auth.js with
Google OAuth · Docker Compose.

## What Phase 1 includes

- Google sign-in and account-type onboarding (company, engineer, worker, homeowner, architect, supplier)
- Accounts (tenants), projects, and a public profile per account
- "Hire Engineer or Company": search by username/email/name, view profile, hire with an
  engagement model (Full management / Owner funds); the hired side accepts or declines
- Daily reports: photos (camera or gallery), description, materials used, head count, wages by category
- Project activity feed (reports, expenses and hires on one timeline)
- Expenses with optional receipt photo
- Worker roster and editable worker categories per account; assigning workers to a project with a role
- Row-level security in PostgreSQL as a backstop against cross-tenant leaks
- Account logo upload; without one, the owner's Google photo is shown. All amounts are in RWF.

## What Phase 2 includes

- Material requests from anyone on a project (owner, hired company/engineer, assigned workers),
  sent to the project owner or the hired company. Each item has a name, free-text product
  description, quantity, unit and optional estimated price.
- The recipient approves (confirming prices) or rejects; the hired company can forward a request
  from its team to the owner. The requester can cancel while it is pending.
- Delivery confirmation records counted quantities (discrepancies shown in red) and logs the cost
  as a materials expense of the paying account.
- Printable request (browser "Save as PDF") with signature lines.
- Stock on site: received minus used (from daily reports), matched by material name and unit.
- Project summary: materials bought, value of materials used and still in stock, wages, salaries,
  other expenses, total spent, agreed budget progress, and who paid what.

Not built yet (later phases): attendance and payroll, email notifications.

## Run it locally

Requirements: Node 22+, Docker Desktop.

```bash
cp .env.example .env          # then set AUTH_SECRET (see the comment in the file)
docker compose up -d          # PostgreSQL on localhost:5433
npm install
npm run db:migrate            # create the tables and security policies
npm run db:seed               # optional: demo accounts, projects and reports
npm run dev                   # http://localhost:3000
```

With `DEV_LOGIN="true"` the login page offers an email-only login (development builds only).
After seeding, try `owner@demo.test`, `company@demo.test`, `engineer@demo.test` or
`worker@demo.test`. Any other email creates a new user and starts onboarding.

| Command              | What it does                                                    |
| -------------------- | --------------------------------------------------------------- |
| `npm run dev`        | Start the app in development                                    |
| `npm run db:migrate` | Apply migrations / create a new one after editing the schema    |
| `npm run db:seed`    | Reset and load the demo data                                    |
| `npm run test:rls`   | Check tenant isolation against the demo data                    |
| `npm run typecheck`  | Generate the Prisma client and type-check                       |
| `npm run lint`       | ESLint                                                          |

### Environment variables

| Variable                               | Purpose                                                        |
| -------------------------------------- | -------------------------------------------------------------- |
| `DATABASE_URL`                         | PostgreSQL connection string                                   |
| `AUTH_SECRET`                          | Encrypts sessions. `npx auth secret` or `openssl rand -base64 33` |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | Google OAuth client (below)                                    |
| `AUTH_URL`                             | Public URL of the site; production only                        |
| `DEV_LOGIN`                            | `true` enables the email-only login outside production         |
| `UPLOAD_DIR`                           | Folder for uploaded photos and receipts                        |

### Google sign-in

1. Open <https://console.cloud.google.com/> and create (or pick) a project.
2. **APIs & Services → OAuth consent screen**: choose *External*, fill in the app name and your
   email, and add yourself as a test user.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**, type *Web application*.
4. Under **Authorized redirect URIs** add `http://localhost:3000/api/auth/callback/google`
   (and later `https://YOUR-DOMAIN/api/auth/callback/google`).
5. Copy the client ID and secret into `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` in `.env`,
   then restart `npm run dev`.

Google does not accept a bare IP address as a redirect URI, so the live site needs a domain
with HTTPS before Google sign-in works there.

## Folder structure

```
prisma/
  schema.prisma            data model
  migrations/              SQL migrations, including the row-level security policies
  seed.ts                  demo data
scripts/check-rls.ts       tenant isolation checks
src/
  app/
    page.tsx               landing page
    login/, onboarding/    sign-in and account-type onboarding
    (app)/                 everything behind sign-in (shared header and navigation)
      dashboard/           projects you own, are hired on, or are assigned to
      projects/new/
      projects/[id]/       activity feed, plus reports/new, expenses, team, hire
      accounts/[username]/ public profile and the hire form
      workers/             roster and worker categories
      settings/            account profile and invite code
    api/auth/              Auth.js routes
    api/files/             serves uploaded photos after an access check
    api/health/            used by the deploy health check
  actions/                 server actions (all writes), one file per area
  components/              shared UI and the client-side forms
  lib/
    db.ts                  Prisma clients: `prisma` (unscoped) and `dbFor(userId)` (tenant-scoped)
    auth.ts, session.ts    Auth.js setup; current user, accounts and active account
    access.ts              what the current user may do on a project
    storage.ts             file storage (local disk today, swappable for MinIO/S3)
```

## How multi-tenancy works

- An **Account** is the tenant. Companies and individuals are both accounts; the differences
  come from capability flags on the `AccountType` lookup table (`canOwnProjects`, `canBeHired`,
  `canManageWorkers`), so adding a type is a new row, not new code paths.
- Users belong to accounts through **Membership** (owner / admin / member).
- A project belongs to its owner's account. A hired company or engineer reaches it through a
  **Contract**; a roster worker reaches it through a **ProjectMember** assignment.
- Application code checks permissions in `src/lib/access.ts`.
- As a backstop, every tenant query goes through `dbFor(userId)`, which runs it as the
  unprivileged `piramid_app` database role with `app.user_id` set. PostgreSQL policies then
  hide rows the user has no link to. The unscoped `prisma` client bypasses those policies, so
  use it only for identity and directory data (users, accounts, memberships, account types).

## Deployment

Every push to `main` runs `.github/workflows/deploy.yml`:

1. Lints, type-checks, builds the Docker image and pushes it to `ghcr.io/imanirumvaolivier20-a11y/piramid`.
2. Copies `docker-compose.prod.yml` to `/var/www/apps/piramid` on the VPS over SSH.
3. Pulls the new image and restarts the stack. The container applies pending database
   migrations on start. The deploy then checks `/api/health`.

The app is published on port `3100` of the VPS (change `APP_PORT` in `/var/www/apps/piramid/.env`).
`POSTGRES_PASSWORD` and `AUTH_SECRET` are generated into that `.env` on the first deploy if they
are missing. Uploaded files and the database live in Docker volumes (`piramid_uploads`,
`piramid_pg_data`).

GitHub repository secrets used by the workflow: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, and
`VPS_PORT` if SSH is not on port 22.

To enable Google sign-in on the live site, point a domain at the VPS, proxy it to port 3100
with HTTPS, then add `AUTH_URL`, `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` to the VPS `.env`
and redeploy.
