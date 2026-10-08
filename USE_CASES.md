# entESG — Overall Use Case Document
### Basic overview + granular feature-by-feature walkthrough
*Use this document to explain the entire application bit by bit — start at Part A for
executives, drill into Part B per module, use Part C as a live demo script.*

---

## PART A — THE BASIC STORY

### A1. What entESG is (30 seconds)
entESG is the system a company runs its sustainability operation on. Sustainability teams
today juggle spreadsheets, emailed meter readings, PDFs in shared drives, and consultants
asking "where did this number come from?" entESG replaces that with one controlled pipeline:
the company assesses how ready it is, assigns work to real people, collects data with
evidence attached, validates and approves it, calculates emissions with locked methods,
and only then publishes reports — with every number traceable back to its source.

### A2. The one principle
**"The report is the output. The real product is the controlled data underneath it."**
Anyone can type a report. entESG's value is everything beneath: who provided each figure,
what evidence backs it, which method calculated it, who reviewed and approved it.

### A3. The lifecycle (the backbone of every demo)
```
ASSESS → PLAN → COLLECT → VALIDATE → EVIDENCE → REVIEW → APPROVE → DISCLOSE → ASSURE → IMPROVE
```
Each arrow is a real screen with real buttons — nothing is a mockup.

### A4. Who uses it (cast of characters — GreenHarvest Foods Nigeria Ltd., fictional)
| Person | Role | What they do all quarter |
|---|---|---|
| Adaeze | Organisation Admin | Owns users, roles, org setup |
| Tunde | ESG Manager | Designs questionnaires, runs assessments, requests data, builds reports |
| Funke | ESG Analyst | Answers/owns assessment work, submits values, runs GHG calculations |
| Ibrahim | Data Owner (Operations) | Answers his assigned questions, submits diesel/fleet data |
| Ngozi | Data Owner (HSE) | Answers evidence questions, uploads permits/manifests |
| Chidi | Reviewer | Checks assessments and evidence, returns or passes on |
| Amina | Approver | Final sign-off on assessments, values, runs, reports |
| Olumide | Auditor | Reads everything, traces lineage, exports |
| Grace | Executive | Reads dashboards and published reports only |
| Consult Ade | Consultant | Sees assigned clients, switches between them |

### A5. The ten modules in one paragraph each
1. **Dashboards** — role-based home pages with live KPIs (readiness %, GHG tonnes, evidence
   and control coverage, open requests), charts, and personal queues.
2. **Regulatory engine** — the library of frameworks (IFRS S1/S2, GHG Protocol, GRI, ESRS,
   SASB) broken into versioned requirements, each auto-marked applicable-or-not for *your*
   company. Everything flagged for SME validation, never presented as legal compliance.
3. **Assessments** — reusable questionnaire templates run as scored assessments with
   owner/reviewer/approver accountability and per-question assignment.
4. **Metrics & data requests** — the metric catalogue plus the tasking system ("submit X by
   Friday") with validation and approval queues.
5. **Evidence** — the private file library: uploads, versions, reviews, links to anything.
6. **GHG engine** — activity × factor calculations, version-locked, scope by scope.
7. **Materiality** — double-materiality scoring (impact × financial) on a live matrix.
8. **Risks, opportunities & controls** — risk register with scoring, control testing with
   exceptions and remediation.
9. **Targets, net-zero & CapEx** — goals with measured progress, initiatives, investment alignment.
10. **Reports & assurance** — reports assembled *only* from approved data, publish-gated,
    exported to CSV/PDF/DOCX, with a computed assurance-readiness checklist.

---

## PART B — GRANULAR, FEATURE BY FEATURE

### B1. Sign-in, roles, tenant isolation
- **Actor:** everyone. **Precondition:** an admin invited you (Admin → Invite user).
- **Steps:** (1) open `/login`; (2) email + password; (3) land on your role's dashboard.
  Top bar shows org, your role, Password page, Sign out.
- **What happens:** password checked with scrypt hash; a signed 7-day session cookie is set;
  every later request re-validates session + role permission + organisation match.
- **Granular notes:** 10 failed logins/minute locks further attempts for a minute; sessions are
  server rows (revocable); `SUPER_ADMIN` aside, a user literally cannot open another
  organisation's records — the server throws, the UI shows 403. Consultants hold an
  *assignment list* and switch active client from `/consultant`; each switch is re-validated.

### B2. Executive & role dashboards
- **Actor:** all roles (content adapts). **Precondition:** seeded or live data.
- **Steps:** sign in. Executives read KPIs; data owners use the queue panel (Assigned
  requests / Submit a value / Upload evidence / My assigned questions); reviewers open
  approval queues.
- **What happens:** six KPIs aggregate live tables (§B12 formulas). Charts plot approved
  calculation runs. "My assigned questions" lists questions where `owner_id = me`, each with
  answered/todo state and an Answer → deep link.

### B3. Frameworks, requirements, disclosures
- **Actor:** ESG Manager/Admin. **Precondition:** none (seeded with 6 frameworks, 30 requirements).
- **Steps:** (1) `/frameworks` — review framework versions and counts; managers can Add
  framework / version / requirement (requirements auto-flag SME validation). (2)
  `/requirements` — read the Applicable/Not-applicable badge per row; applicability derives
  from your org's jurisdiction, sector, size and profile. (3) `/disclosures` — create a
  disclosure, open it, map requirements to it from the picker.
- **What happens:** mapping rows accumulate; disclosures become the корзины report sections
  draw on. Nothing here is compliance advice — badges say *applicable*, never *compliant*.

### B4. Questionnaires (templates)
- **Actor:** ESG Manager. **Precondition:** permission `requirement.manage`.
- **Steps:** (1) `/questionnaires` → Create; (2) open it → Add section (repeat for the 10
  dimensions or your own); (3) per section, Add question: code, text, one of 14 types,
  weight, guidance, comma-separated options for choice types, linked requirement, question
  owner, evidence-required tick.
- **What happens:** a versioned-able template exists. Assigning an owner notifies them.
  Templates are org-scoped and reusable across quarters.

### B5. Assessments (runs) — the delegation heart
- **Actors:** manager creates; owner answers; reviewer returns/passes; approver signs.
- **Steps:** (1) `/assessments/new` → title + questionnaire → Create & open. (2) Assign
  owner/reviewer/approver (same-org enforced). (3) Owners answer inline (question owners see
  a dedicated "Assigned to you" tray + dashboard queue). (4) **Recompute score** → dimension
  bars + band + critical-gap flag. (5) Submit → Review → Approve (or Return with reason).
- **What happens:** each answer stores value, score fraction, author; recompute rewrites
  `assessment_scores` and the assessment's score/band/gap flag; each transition writes an
  approval row, audit event, and owner notification.
- **Scoring (exact):** yes-like→1.0, no-like→0, number→n/100, other text→0.5, blank→0;
  × weight; critical = linked requirement critical/high or (weight≥2 + evidence required);
  dimension % and overall = weighted means; any failed critical ⇒ **CRITICAL GAP** band;
  else ≥80 On Track / ≥60 Progressing / ≥40 Early / Nascent.

### B6. Metrics catalogue & value submission
- **Actors:** manager defines; owners/analysts submit; reviewers/approvers gate.
- **Steps:** (1) `/metrics` → Create metric (code, name, frequency, source). (2) **Submit a
  value** → metric, site or group-wide, period `YYYY-MM`/`YYYY-Qn`, number. (3) Validation
  queue → **Validate / Approve / Reject**.
- **What happens:** submit runs seeded range rules (e.g. diesel 100–200,000 L) and stores
  pass/fail rows; only `approved` values feed reports, dashboards KPIs and exports.

### B7. Data requests (tasking)
- **Actors:** manager → owner → reviewer → approver.
- **Steps:** (1) Create request (title, period, due date, priority). (2) Add items (labels,
  optional metric/question links). (3) Drive Send → Submit → Validate → Approve/Return from
  the detail page; comment inline. (4) **Run overdue escalation** flips late items to
  `overdue`, logs escalations, notifies owners.
- **What happens:** the request is the unit of accountability for every datum: who was asked,
  what, when, and every state change with who/when/why.

### B8. Evidence library
- **Actors:** owners upload; reviewers accept/return/reject.
- **Steps:** (1) Upload (≤25 MB; PDF/Excel/Word/CSV/TXT/images) with name, period, source,
  optional `entityType:entityId` link. (2) Reviewers Accept/Return/Reject with comment.
  (3) Link files to values, assessments, controls, requests, reports. (4) Download privately
  (signed URL on S3/R2, authenticated route otherwise).
- **What happens:** identical bytes create a *version*, never a duplicate (SHA-256); reviews
  and links are permanent history; nothing is public. Local-disk mode warns it is ephemeral.

### B9. GHG calculations
- **Actors:** analyst runs; approver locks.
- **Steps:** (1) `/emissions` → New run → scope, period, up to 3+ inputs (label, activity,
  unit, factor picker showing kg/unit, site). (2) Run → per-input tCO₂e + total, versioned.
  (3) Approve from the draft queue.
- **Formula:** `tCO₂e = activity × factor(kgCO₂e/unit) ÷ 1000`; run total = Σ outputs.
  Factor, source, version and methodology freeze per input row. Example: 12,400 L diesel ×
  2.680 ÷ 1000 = **33.232 tCO₂e**. Only approved runs feed KPIs and scope charts.

### B10. Materiality
- **Actors:** manager + stakeholders. **Steps:** `/materiality` → add topic (category,
  impact 1–4, financial 1–4, rationale) → read the matrix (red quadrant = both ≥3).
- **Formulas:** `combined = (impact + financial) ÷ 2`; `material` if either axis ≥ 3 else
  `monitor`. Topics persist per assessment year with owner and rationale.

### B11. Risks, opportunities, controls
- **Risks:** create with category + likelihood/impact 1–5 → `inherent = L × I`; open the
  risk → add treatments (action, owner, due date); comment thread.
- **Opportunities:** same register without scores, feeding targets/CapEx narrative.
- **Controls:** create (code, title, frequency) → open → **Record test** (effective /
  partially / ineffective / not tested + notes) → **Raise exception** (severity) → add
  **remediation** actions → **Close after retest**. The retest loop is the assurance
  backbone: ineffective controls stay visibly open.

### B12. Targets, net-zero, CapEx
- **Targets:** create (kind, baseline year/value, target year/value) → open → **Record
  progress** (current value + status) → progress bar. Progress % = (current−baseline) ÷
  (target−baseline) × 100, direction-aware.
- **Net-zero:** initiatives with annual tCO₂e reductions; link them to targets (target
  detail lists them).
- **CapEx:** programme auto-created per org; items carry investment, net-zero compatibility,
  alignment gap, recommended action — the "what we spend vs what we promised" view.

### B13. Reports, exports, assurance
- **Reports:** New report → 6 sections auto-created → link approved data rows (metric values,
  GHG runs, assessments, evidence) → Review → Approval → **Publish, hard-blocked if any
  linked value is unapproved** → snapshot version → export **CSV / PDF / DOCX** (audited,
  permission-gated).
- **Assurance:** `/assurance` computes six live coverage checks (approved values, accepted
  evidence, approved runs/assessments, effective controls, published reports) with
  on-track/attention/critical verdicts — the pre-audit punch list.
- **Metrics export:** one-click CSV of all values with codes, periods, statuses, sites.

### B14. Tasks, notifications, comments, audit
- **Tasks:** create with due dates; open to change status/assignee; comment thread; tasks can
  reference other entities.
- **Notifications:** the system's memory of "you need to do something" — every assignment,
  transition, escalation and review writes one; listed newest-first.
- **Comments:** threaded per request/risk/task for the working conversation.
- **Audit trail** (`/admin`): every login, create, answer, transition, upload, download,
  export, assignment and role change with who/when/old/new. Append-only by design.

### B15. Admin, users, passwords, lineage, settings
- **Admin:** invite users (temp password), suspend/activate, change roles, one-click password
  reset (temp shown once), assign consultants to clients, browse audit + role catalogue.
- **Password page:** self-service change (current check, 10-char minimum, audited).
- **Lineage** (`/lineage`): the one-screen provenance story, requirement → assurance.
- **Organisation/Settings:** live entity/site/department tree and base-year/currency/carbon-price settings.

---

## PART C — LIVE DEMO SCRIPT (a quarter at GreenHarvest, 15 minutes)

1. **Login as Tunde** (esg.manager): dashboard → open Q3 assessment → show assignees.
2. **Login as Ibrahim** (operations): "My assigned questions (8)" → answer one → Save.
3. **Back as Tunde**: Recompute score → show 36% + CRITICAL GAP → explain the override.
4. **Data request**: open diesel request → walk Send→…→Approve buttons → comments.
5. **Evidence**: upload a PDF → link to the metric value → Accept it.
6. **GHG**: New run → 12,400 L diesel → 33.232 tCO₂e → Approve → dashboard trend moves.
7. **Materiality**: matrix → add a topic → watch it plot.
8. **Control**: record a test → raise exception → add remediation.
9. **Target**: record progress → bar moves.
10. **Report**: link the approved value → Publish → Export PDF → open it.
11. **Admin**: audit trail shows every click you just made. Close: "that trail is the product."

---

## PART D — WHAT "DONE" MEANS PER FEATURE (acceptance one-liners)

Questionnaires/assessments run template→run→assign→answer→score→approve · metrics submit→
validate→approve · requests full lifecycle + escalation · evidence upload→review→link→private
download · GHG versioned runs + approval · materiality matrix · risks + treatments · controls
test→exception→remediation · targets + progress · initiatives + CapEx · reports gated on
approved data + 3 export formats · assurance checklist computed live · tasks/notifications/
comments/audit · 11 roles + tenant isolation + consultant switching · unit + E2E green.
Remaining: R2 keys (yours), AI phase (needs key), PDF polish as volumes grow.
