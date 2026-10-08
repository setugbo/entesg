# entESG — Feature Guide & Usage Manual

Covers everything implemented so far: what each feature does, exact step-by-step usage,
all calculations/formulas, and what each status means. Live at **https://entesg.vercel.app**.

Status labels used in this doc:
- **Live** — full workflow works against the database.
- **Partial** — works, with a noted gap.
- **Directory** — live tables + create forms where stated; some display pages still show reference rows until wired to live data (listed in §20).

Demo logins (GreenHarvest Foods Nigeria Ltd., fictional data): `admin@greenharvest.ng`,
`esg.manager@greenharvest.ng` — password `GreenHarvest2026!`. Other seeded users follow the
pattern `<role>@greenharvest.ng` (analyst, operations, hse, reviewer, approver, auditor, exec,
consultant@partner.ng).

> Readiness scores are management signals, never legal compliance conclusions.
> Regulatory records ship flagged **REQUIRES SME VALIDATION**.

---

## 1. Sign-in, roles & tenant isolation — **Live**

**What:** Scrypt-hashed passwords, signed 7-day sessions (httpOnly cookies), login throttling
(10 attempts/minute per email), security headers, and server-side RBAC + tenant isolation.

**Steps**
1. Open `/login`, enter email + password → **Sign in** → lands on `/dashboard`.
2. Top bar shows your name, active role, and **Sign out**.
3. Visiting any page without a session redirects to `/login`. A role without the required
   permission lands on `/forbidden` (enforced server-side, never just hidden buttons).

**Roles (11)** — `ADMIN` page lists each role with its permission count:

| Role | Typical powers |
|---|---|
| SUPER_ADMIN | Everything, all organisations, org switching |
| ORGANISATION_ADMIN | Everything inside own organisation + user management |
| ESG_MANAGER | Create/manage assessments, metrics, evidence, reports, risks, targets, GHG runs |
| ESG_ANALYST | Create/edit assessments & metrics, submit data, upload evidence |
| DATA_OWNER / CONTRIBUTOR | Submit assigned data, upload evidence |
| REVIEWER | Review assessments/evidence, test controls |
| APPROVER | Approve assessments, metric values, evidence, GHG runs, reports |
| AUDITOR | Read everything + audit trail + exports |
| CONSULTANT | Sees only assigned clients; switches between them |
| EXECUTIVE | Read + export dashboards and reports |

**Rule:** Everyone except SUPER_ADMIN is pinned to one active organisation. Every mutation
checks `assertTenant()` — cross-organisation access throws. The consultant's active
organisation override is validated against `consultant_clients`.

---

## 2. Dashboards — **Live**

**What:** Role-aware executive overview computed from the database — no fake numbers.

**Steps**
1. Sign in → `/dashboard`.
2. Data owners see a **"My queue"** panel (assigned requests, submit value, upload evidence);
   consultants see client switching shortcuts; reviewers/approvers see approval queues.

**KPI formulas (all live SQL aggregations):**
- **ESG Readiness** = latest assessment `score`. Subtitle shows `CRITICAL GAP — overrides
  aggregate` when any assessment has `has_critical_gap`.
- **GHG 2026 (YTD)** = Σ `total_tco2e` over **approved** runs with period starting `2026`.
- **Evidence coverage** = accepted ÷ total evidence × 100.
- **Control coverage** = controls whose **latest** test result is `effective` ÷ total controls × 100.
- **Open data requests** = requests not in (`approved`, `validated`).
- **GHG trend** = all runs (period → total). **Scope split** = approved 2026 runs grouped by scope.
- **Readiness by dimension** = saved `assessment_scores` of the latest assessment.

---

## 3. Regulatory engine — **Live**

**What:** Configurable Framework → Version → Requirement → Disclosure → Mapping records.
Nothing is hard-coded: each requirement carries source org/document/URL, version, effective
date, jurisdiction, sector, applicability JSON, reviewer, interpretation, and validation status.

**Steps**
1. `/frameworks` — see IFRS S1/S2, GHG Protocol, GRI, ESRS, SASB with versions and requirement counts.
2. `/requirements` — each row shows an **Applicable / Not applicable** badge computed for YOUR
   organisation.
3. `/disclosures` — create a disclosure title; it starts as `draft` (mapping UI — §20).

**Applicability rule:** a requirement applies only if every set filter matches the org profile
(jurisdiction, sector/industry, org type, size, listed status, frameworks). Column-level
`jurisdiction`/`sector` act as hard filters; the JSON `applicability` object is AND-matched
(arrays = any-of). "Not applicable" items are hidden from scoring scope, never deleted.

---

## 4. Assessments & readiness scoring — **Live**

**Lifecycle:** `draft → in_progress → submitted → under_review → returned → approved`.
Every transition records an approval row + audit event + notifies the owner.

**Steps**
1. `/assessments` → **New assessment** → title + questionnaire → **Create & open**.
2. On `/assessments/[id]`, answer each question (**Save** per row, optional comment).
   Questions flagged **evidence required** must be backed by the Evidence library.
3. Click **Recompute score** — writes per-dimension scores, overall %, band, critical-gap flag.
4. Move it through **Submit → Review → Approve** (or **Return** with a reason).

**Scoring math (exact):**
- Each answer maps to a fraction of the question's weight:
  `yes/true/1/compliant/complete → 1.0` · `no/false/0/not started → 0` ·
  numeric `n → clamp(n/100, 0, 1)` · any other text → `0.5` · blank → unanswered (0).
- A question is **critical** if any linked requirement has criticality `critical`/`high`,
  or `weight ≥ 2 AND evidence required`.
- Dimension % = `round(Σ score ÷ Σ max × 100)`; **Overall** = same over all dimensions.
- **Critical-gap rule:** any critical question unanswered or scored 0 forces the dimension to
  `Critical` and the whole assessment band to **CRITICAL GAP**, regardless of the %.
- Bands: `≥80 On Track`, `≥60 Progressing`, `≥40 Early`, else `Nascent`.
- Dimension status labels: `Critical`, else `≥80 On Track`, `≥60 Low`, `≥40 Medium`, else `High`.

---

## 5. Metrics, validation & approvals — **Live**

**What:** Metric engine (code, category, unit, frequency, owner, source, methodology) with
period values flowing `draft → submitted → validated → approved` (or `rejected`).

**Steps**
1. `/metrics` → create form (code, name, frequency, source) → **Create**.
2. **Submit a value** → pick metric, site (or group-wide), period `YYYY-MM` or `YYYY-Qn`, value.
3. The **Validation queue** on the same page shows `submitted`/`validated` items with
   **Validate / Approve / Reject** buttons (approver roles).

**Validation rule (automatic on submit):** seeded `range` rules per metric, e.g.
Electricity 1,000–500,000 kWh, Diesel 100–200,000 L. A breach writes a `validation_results`
row (`passed=false`, e.g. `Above maximum 200000`). Results are advisory history; humans approve.

---

## 6. Data requests — **Live**

**Lifecycle:** `draft → sent → in_progress → submitted → returned → validated → approved → (overdue)`.

**Steps**
1. `/data-requests` → create (title, period, due date, priority, description).
2. Open the request → **Send / Submit / Validate / Approve / Return** as it moves.
   Each step notifies the owner and writes an audit event.
3. Requested items and submissions are listed; add threaded **comments**.
4. **Run overdue escalation**: flips past-due open requests to `overdue`, writes `escalations`
   rows and notifies owners.

---

## 7. Evidence management — **Live**

**What:** Private library with versions, checksum dedupe, reviews, and links to any entity.

**Steps**
1. `/evidence` → **Upload evidence** → file + display name + period + source (+ optional
   `entityType:entityId` link, e.g. `metric_value:<uuid>`).
2. **Constraints:** max 25 MB; allow-list PDF, Excel, Word, CSV, TXT, PNG/JPG.
   Re-uploading identical bytes (SHA-256 match) creates a **new version**, not a duplicate.
3. Open a file → **Download (private)** (S3 signed URL when R2 is configured, else an
   authenticated same-origin route — never public), **Accept / Return / Reject** with comment,
   and **Link** it to metric values, assessments, controls, requests, or reports.
4. Statuses: `uploaded → under_review → accepted / rejected`; `expired / superseded` supported.

---

## 8. Data lineage — **Live**

**What:** `/lineage` renders the full chain every number must be able to answer:
Requirement → Question → Data Request → Submission → Evidence → Validation → Methodology →
Calculation → Review → Approval → Disclosure → Report → Assurance.
Use it (with the evidence Links tab) to prove provenance to auditors.

---

## 9. GHG engine — **Live**

**Formula:** `Emissions (tCO₂e) = Activity Data × Emission Factor (kgCO₂e/unit) ÷ 1000`.
Run total = Σ input outputs. Methodology (GHG Protocol Corporate Standard) plus factor code,
source, and version are frozen per input row — reruns never silently change history.

**Steps**
1. `/emissions` → **New calculation run** → scope (1/2/3), period `YYYY-MM`, up to 3+ inputs
   (label, activity, unit, emission-factor picker showing kg/unit, site).
2. **Run calculation** → versioned run with per-input outputs and total.
3. **Approve run** (draft queue on the page, approver roles). Only approved runs feed the
   dashboard KPIs and scope-split chart.
4. Seeded factors (validate before assurance): Diesel 2.680, Natural gas 2.030, LPG 2.940,
   Petrol 2.310, HFO 3.110 kg/unit; Nigeria grid 0.439 kg/kWh.

**Worked example:** 12,400 L diesel × 2.680 ÷ 1000 = **33.232 tCO₂e**.

---

## 10. Energy / Water / Waste pages — **Directory**

Reference tables (electricity/fuel, abstraction/recycling, waste streams) whose live values
come from the Metrics engine (§5) and GHG inputs (§9). Per-category live rollups — §20.

## 11. Double materiality — **Live**

**Steps:** `/materiality` → create topic (category, impact 1–4, financial 1–4, rationale).
The interactive matrix plots impact (x) vs financial (y); red = both ≥3.

**Formulas:** `combined = (impact + financial) ÷ 2`; `decision = material` if impact ≥ 3
**or** financial ≥ 3, else `monitor`. Topics persist per assessment with owner + rationale.

## 12. Social & Governance pages — **Directory**

Headcount, gender, training, H&S, board, ethics indicators are tracked as metrics (§5);
dedicated live rollups — §20.

## 13. Risks & opportunities — **Live**

**Steps:** `/risks` → create (title, category, likelihood 1–5, impact 1–5, description).
`/opportunities` → same without scores.

**Formula:** `inherent risk = likelihood × impact` (1–25), stored with the assessment row
(seed example: 4 × 4 = 16 inherent, residual 12 after controls). Likelihood/impact/
control-effectiveness/residual live in `risk_assessments`. Treatment actions, control-exception
→ remediation chains — §20.

## 14. Controls — **Partial**

Create controls (code, title, frequency) — **Live**. Control testing (`testControl`:
`effective / partially_effective / ineffective / not_tested` + notes + audit) is implemented
server-side; the test-button UI, exception → remediation → retest chain — §20.

## 15. Targets / Net Zero / CapEx — **Live** (progress updates — §20)

- `/targets` → create (kind: absolute/intensity/net-zero/renewable/water/waste; baseline
  year+value; target year+value). Progress = derived from current vs baseline/target values
  once current values are recorded.
- `/net-zero` → initiatives with annual tCO₂e reductions rolling up to targets.
- `/capex` → assets with investment (₦), net-zero compatibility, alignment gap, recommended action.

## 16. Reports & assurance — **Live** (PDF/DOCX — §20)

**Steps**
1. `/reports` → **New report** (auto-creates 6 sections: Governance & Strategy, Materiality,
   Climate & GHG, Environment, Social & Workforce, Assurance Readiness).
2. Open → **To review → To approval → Publish**. **Publish is hard-blocked** if any linked
   `metric_value` is not `approved` ("Cannot publish: report references unapproved data").
   Publishing snapshots a version row.
3. **Export CSV** downloads sections (auth + tenant checked; unpublished reports restricted
   to privileged roles).

## 17. Tasks, notifications, comments — **Live** (task status UI — §20)

Create tasks (title, due, description); notifications are auto-written by every workflow
transition and listed on `/notifications`; comments thread on data-request detail pages.

## 18. Admin, consultant switching, audit — **Live**

- `/admin` (user.view/user.manage or audit.view): user table with roles; **Invite user**
  (name, email, temp password, role); **Assign consultant to client**; role ÷ permission
  catalogue; latest **audit trail** (append-only — no edit/delete code paths exist).
- `/consultant`: assigned-client list, server-validated **Switch →** context, reset to home org.
- Audited actions: logins, creates, answers, submits, reviews, approvals, returns, uploads,
  downloads, exports, escalation runs, role/assignment changes — each with user, org,
  timestamp, old/new values.

## 19. Formula reference (all calculations in one place)

| # | Formula | Where |
|---|---|---|
| 1 | Answer fraction: yes-like→1, no-like→0, number→n/100 clamped, text→0.5, blank→0 | `src/server/scoring.ts` |
| 2 | Dimension % = round(Σscore/Σmax×100); Overall likewise | `src/lib/engines.ts` |
| 3 | Critical gap = critical Q unanswered/zero → band = CRITICAL GAP | `src/lib/engines.ts` |
| 4 | Bands ≥80/60/40 → On Track/Progressing/Early/Nascent | `src/lib/engines.ts` |
| 5 | tCO₂e = activity × factor_kg ÷ 1000; run = Σ outputs | `src/lib/engines.ts`, `src/server/actions.ts` |
| 6 | Materiality combined = (impact+financial)/2; material if either ≥3 | `src/server/records.ts` |
| 7 | Inherent risk = likelihood × impact (1–5 each) | `src/server/actions.ts`, `src/server/records.ts` |
| 8 | Range validation: value < min → fail "Below minimum"; > max → "Above maximum" | `src/server/actions.ts` |
| 9 | Dashboard KPIs (readiness, GHG Σ approved-2026, evidence %, control %, open count) | `src/server/data.ts` |
| 10 | Applicability = AND of all set jurisdiction/sector/profile filters | `src/lib/applicability.ts` |

## 20. What is pending

**A. Wire display pages to live data** (currently reference rows): disclosures mapping UI,
tasks list, energy/water/waste rollups, social/governance rollups, opportunities board,
organisation tree editor, settings editor, computed assurance checklist.
**B. Workflow UIs for existing tables/actions:** control test buttons + exception →
remediation → retest; risk treatment actions; target current-value/progress updates;
report↔data linking UI; data-request item builder; questionnaire/section/question builder;
framework/version/requirement management; task status/assignment; user edit/deactivate.
**C. Exports:** PDF/DOCX report export, Excel/CSV metric exports (CSV for reports exists).
**D. Operations:** Cloudflare R2 keys (uploads currently use ephemeral local disk on Vercel);
self-service password change + forced rotation of seeded passwords; run Playwright E2E
against preview/local rather than production (it writes E2E-prefixed rows).
**E. Phase 11 AI (intentionally deferred, needs an LLM key):** evidence summarisation, gap
analysis, requirement explanations, narrative drafting, anomaly detection — with a hard rule
that AI never invents regulatory requirements.
