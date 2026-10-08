# entESG — Enterprise ESG Management Platform

## Quick start

```bash
npm install
cp .env.example .env        # set DATABASE_URL (Neon or local PostgreSQL)
npm run db:push             # create schema (or db:migrate)
npm run db:seed             # GreenHarvest Foods Nigeria Ltd. demo data
npm run dev                 # http://localhost:3000
```

Demo logins (after seed): `admin@greenharvest.ng` / `esg.manager@greenharvest.ng` — password `GreenHarvest2026!`

Without `DATABASE_URL` the app runs in **preview mode** with seeded demo data (read-only).

## Deploy (Vercel + Neon + R2/S3)

1. Create Neon project → copy `DATABASE_URL` (with `?sslmode=require`).
2. Vercel → import repo → set env: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`, S3/R2 vars.
3. Build command: `npm run build`. Run `npm run db:migrate && npm run db:seed` once against the Neon DB.
4. Private evidence storage: Cloudflare R2 (S3-compatible). Set `S3_ENDPOINT/REGION/BUCKET/KEYS`. Files use signed/private access; without S3 config uploads fall back to local `./uploads` (single-instance only).
5. Custom domain: Vercel → Domains → add domain → set `BETTER_AUTH_URL`/`NEXT_PUBLIC_APP_URL` to it.

## Architecture

Modular monolith: Next.js App Router + Server Actions + service layer (`src/server`, `src/lib`) + Drizzle/PostgreSQL. Portable — no Neon-proprietary SQL.

- `src/db/schema.ts` — full schema (tenancy, RBAC, regulatory engine, assessments, metrics, evidence, GHG, materiality, risks/controls, targets/capex, workflow, reports, audit)
- `src/lib/auth.ts` — sessions, `requirePermission`, `assertTenant` (server-side), audit writer
- `src/lib/permissions.ts` — 11 roles, granular permission matrix
- `src/lib/applicability.ts`, `src/lib/engines.ts` — applicability, readiness (critical-gap override), GHG calc
- `src/server/actions.ts` — all workflow transitions (tenant-guarded + audited)
- `src/server/modules.ts` + `src/server/demo.ts` — DB reads with demo fallback

## Testing

```bash
npm test                          # vitest: applicability, readiness, GHG, RBAC, tenant isolation
npm run test:e2e                   # Playwright critical lifecycle (needs seeded DB + browsers: npx playwright install)
```

Critical E2E (`tests/e2e/critical.spec.ts`): login → dashboard → assessment answer → recompute → data request create → metric submit → GHG run → report create → audit trail.

## What works end-to-end (with DATABASE_URL)

- Auth (scrypt-hashed passwords, signed sessions, login throttling) → role-aware dashboards (owner / reviewer / consultant / executive queues)
- Regulatory engine (frameworks, versions, requirements with SME-validation flags) + per-org applicability
- Assessments: create → answer → recompute readiness (critical-gap override) → submit → review → approve/return, all audited
- Metrics: create → submit value (auto range-validation) → validate → approve/reject queues
- Data requests: create → send → submit → validate → approve/return + overdue escalation → notifications + comments
- Evidence: private upload (25MB allow-list, SHA-256 dedupe → versioning) → link → review/accept/return/reject → private download (S3 signed URL or authenticated local route)
- Lineage timeline requirement → report; materiality matrix + topic scoring; risks with residual scoring; controls with test history
- GHG: factor table (source/version locked per run) → multi-input runs → approve → dashboard trend
- Targets / net-zero initiatives / CapEx alignment; reports (approved-data publish gate + CSV export); assurance checklist
- Admin: invite users + assign roles, consultant↔client assignment, client switching (server-validated), immutable audit trail
