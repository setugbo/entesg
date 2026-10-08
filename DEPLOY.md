# entESG — Deployment Runbook (Vercel + Neon + R2/S3)

Target: **Vercel** (app) + **Neon PostgreSQL** (database) + **Cloudflare R2** (private evidence storage).
The app is portable: any PostgreSQL works (Neon, local PG, VPS).

## 0. What you need

- GitHub repo with this code pushed
- Neon account (free tier is enough to start)
- Vercel account
- Cloudflare account with R2 (or any S3-compatible bucket; optional at first — uploads fall back to local disk, which does **not** persist on Vercel, so configure R2 before real use)

## 1. Create the Neon database

1. Go to https://console.neon.tech → New Project → name `entesg`, region closest to your users (e.g. EU West), Postgres 16+.
2. Open the project → **Connection Details** → copy the **pooled** connection string. It looks like:
   `postgresql://<user>:<password>@<host>-pooler.<region>.neon.tech/entesg?sslmode=require`
3. Also note the **direct** (non-pooled) string — use it for migrations if the pooled one ever fails on DDL.
4. Keep `?sslmode=require` on both.

Local/VPS alternative: any PostgreSQL 14+ with a database `entesg`, e.g.
`DATABASE_URL=postgresql://postgres:postgres@localhost:5432/entesg`

## 2. Configure environment (local machine first)

```bash
cp .env.example .env
```

| Variable | Value |
|---|---|
| `DATABASE_URL` | Neon pooled string from step 1 |
| `BETTER_AUTH_SECRET` | random 32+ chars: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` (Git Bash/`cmd`: use `openssl rand -hex 32` if available) |
| `BETTER_AUTH_URL` | `http://localhost:3000` for now (production URL later) |
| `NEXT_PUBLIC_APP_URL` | same as above |
| `S3_*` | leave blank for now (R2 in step 5) |

`.env` is git-ignored. Never commit it.

## 3. Migrate + seed (run from your machine against Neon)

```bash
npm install
npm run db:migrate        # applies drizzle/*.sql to DATABASE_URL
npm run db:seed           # GreenHarvest Foods Nigeria Ltd. demo data
npm run dev               # open http://localhost:3000, sign in below
```

Demo logins: `admin@greenharvest.ng` / `esg.manager@greenharvest.ng` — password `GreenHarvest2026!`
Sanity check: Dashboard shows KPIs → Assessments opens the seeded questionnaire → Admin shows users + audit events.

To re-run cleanly, seed is idempotent (safe to run twice).

## 4. Deploy to Vercel

1. Push the repo to GitHub (including the `drizzle/` folder).
2. Vercel → Add New → Project → import the repo. Framework preset: **Next.js** (auto). Leave Build Command (`npm run build`) and Output as defaults. No `vercel.json` needed.
3. **Environment Variables** (Production + Preview): set `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL=https://<your-app>.vercel.app`, `NEXT_PUBLIC_APP_URL` (same), plus `S3_*` from step 5.
4. Deploy. First build runs with no DB writes — migrations/seed were already applied from your machine.
5. Open `https://<your-app>.vercel.app/login` and sign in with the demo admin.

Ongoing deploys: `git push` → Vercel builds automatically. For schema changes: run `npm run db:migrate` from your machine (pointed at Neon) **before/with** the code push.

## 5. Private evidence storage (Cloudflare R2)

1. Cloudflare dashboard → R2 → Create bucket `entesg-evidence` (private, no public access).
2. R2 → Manage API tokens → create token with Object Read & Write on that bucket → note Access Key, Secret, and the endpoint `https://<accountid>.r2.cloudflarestorage.com`.
3. Set on Vercel (and local `.env`):
   `S3_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com`
   `S3_REGION=auto` · `S3_BUCKET=entesg-evidence`
   `S3_ACCESS_KEY_ID=…` · `S3_SECRET_ACCESS_KEY=…`
4. Redeploy (or wait for next push). Downloads then use 15-minute signed URLs; nothing is ever public.

## 6. Custom domain (when ready)

1. Vercel project → Settings → Domains → add `app.yourdomain.com` → follow the DNS instructions (CNAME).
2. Update `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` to `https://app.yourdomain.com` in Vercel env → Redeploy.

## 7. Post-deploy checklist

- [ ] Login works with seeded admin; **rotate the demo passwords first** (delete/re-invite users from Admin, or update `password_hash` directly — self-service password change is a planned follow-up).
- [ ] Dashboard KPIs render from the database (no "Preview mode" banner).
- [ ] Upload a test file in Evidence → it appears, downloads privately, review → Accept works.
- [ ] Create a data request → send → submit → approve; check Admin audit trail records each step.
- [ ] `npm run test:e2e` passes against production (set `E2E_BASE_URL=https://<app>`; use a test user).

## Troubleshooting

- `Database not configured` banner → `DATABASE_URL` missing/unset in that environment.
- `ConnectTimeout / SSL` → ensure `?sslmode=require`; try the **direct** connection string for `db:migrate`.
- `Too many clients` on Neon → app uses a small pool (`max: 5`) plus `prepare: false` for pooler compatibility; migrations should use the direct URL.
- Vercel build fails on type errors → run `npx tsc --noEmit` locally first; never set `DATABASE_URL` to localhost in Vercel env.
- Evidence 413/415 → 25 MB limit and PDF/Excel/Word/CSV/image allow-list are intentional; adjust in `src/app/api/evidence/upload/route.ts`.
