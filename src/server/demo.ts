// Demo dataset used when DATABASE_URL is not configured (build/CI, first-run preview).
// Mirrors the GreenHarvest Foods Nigeria Ltd. seed so the UI is populated immediately.
export const DEMO = {
  org: { id: "demo-org", name: "GreenHarvest Foods Nigeria Ltd.", industry: "FMCG / Manufacturing", jurisdiction: "Nigeria" },
  kpis: { readiness: 68, criticalGaps: 3, ghg2026: 12480, evidenceCoverage: 74, controlCoverage: 61, openRequests: 14, overdue: 4 },
  readiness: [
    { dimension: "Governance", pct: 82 }, { dimension: "Strategy", pct: 64 },
    { dimension: "Materiality", pct: 71 }, { dimension: "Risk", pct: 58 },
    { dimension: "Metrics", pct: 73 }, { dimension: "Data Completeness", pct: 66 },
    { dimension: "Evidence", pct: 74 }, { dimension: "Controls", pct: 61 },
    { dimension: "Assurance", pct: 44 }, { dimension: "Reporting", pct: 57 },
  ],
  ghgTrend: [
    { label: "Jan", value: 980 }, { label: "Feb", value: 1012 }, { label: "Mar", value: 1044 },
    { label: "Apr", value: 990 }, { label: "May", value: 1062 }, { label: "Jun", value: 1105 },
    { label: "Jul", value: 1088 }, { label: "Aug", value: 1120 },
  ],
  scopeSplit: [
    { label: "Scope 1", value: 6420 }, { label: "Scope 2 (LB)", value: 3890 }, { label: "Scope 3", value: 2170 },
  ],
  assessments: [
    { id: "a1", title: "IFRS S1/S2 Readiness — Q3 2026", status: "under_review", score: "68", band: "Progressing" },
    { id: "a2", title: "ESRS Gap Assessment — Lagos Plant", status: "in_progress", score: "54", band: "Early" },
    { id: "a3", title: "GHG Protocol Readiness", status: "approved", score: "81", band: "On Track" },
  ],
  requests: [
    { id: "r1", title: "Electricity — Lagos Plant — Aug 2026", status: "submitted", due: "2026-09-10", owner: "Facilities" },
    { id: "r2", title: "Diesel — Ogun Fleet — Aug 2026", status: "overdue", due: "2026-09-05", owner: "Operations" },
    { id: "r3", title: "Water abstraction — Lagos — Aug 2026", status: "validated", due: "2026-09-08", owner: "HSE" },
    { id: "r4", title: "Headcount & turnover — HR — Aug 2026", status: "in_progress", due: "2026-09-15", owner: "HR" },
  ],
  evidence: [
    { id: "e1", name: "PHCN bill — Lagos — Aug 2026.pdf", status: "accepted", version: 2 },
    { id: "e2", name: "Diesel delivery notes — Ogun.xlsx", status: "under_review", version: 1 },
    { id: "e3", name: "Waste pickup manifest — LAWMA.pdf", status: "accepted", version: 1 },
    { id: "e4", name: "Fire safety certificate.pdf", status: "expired", version: 1 },
  ],
  risks: [
    { id: "k1", title: "NAPs carbon pricing exposure on diesel fleet", category: "Climate", residual: 16 },
    { id: "k2", title: "Water stress — Ogun abstraction licence", category: "Environmental", residual: 12 },
    { id: "k3", title: "ESRS / IFRS disclosure timetable slippage", category: "Regulatory", residual: 12 },
  ],
  controls: [
    { id: "c1", code: "CTL-ENV-01", title: "Monthly meter-reading reconciliation", result: "effective" },
    { id: "c2", code: "CTL-DAT-02", title: "Evidence linkage before metric approval", result: "partially_effective" },
    { id: "c3", code: "CTL-GHG-03", title: "Emission-factor version lock per run", result: "not_tested" },
  ],
  targets: [
    { id: "t1", title: "Scope 1+2 −30% by 2030 (2023 base)", progress: 18 },
    { id: "t2", title: "Renewable electricity 60% by 2028", progress: 34 },
    { id: "t3", title: "Zero waste to landfill by 2027", progress: 52 },
  ],
  materiality: [
    { topic: "GHG emissions & energy", impact: 4, financial: 4 },
    { topic: "Water stewardship", impact: 4, financial: 3 },
    { topic: "Food safety & quality", impact: 4, financial: 4 },
    { topic: "Workforce H&S", impact: 3, financial: 3 },
    { topic: "Packaging & waste", impact: 3, financial: 3 },
    { topic: "Business ethics", impact: 3, financial: 4 },
  ],
  frameworks: [
    { code: "IFRS S1", version: "2024", reqs: 42 }, { code: "IFRS S2", version: "2024", reqs: 38 },
    { code: "GHG Protocol", version: "Corporate Standard", reqs: 24 }, { code: "GRI", version: "2021", reqs: 56 },
    { code: "ESRS", version: "E1–E5/S/G", reqs: 64 }, { code: "SASB — Food & Bev", version: "2023", reqs: 18 },
  ],
  lineage: [
    { step: "Requirement", detail: "IFRS S2 ¶29 — Scope 1 disclosure" },
    { step: "Question", detail: "GHG-01: Report Scope 1 by source" },
    { step: "Data request", detail: "Diesel — Ogun Fleet — Aug 2026" },
    { step: "Submission", detail: "12,400 L by Operations (A. Bello)" },
    { step: "Evidence", detail: "Diesel delivery notes (accepted v1)" },
    { step: "Validation", detail: "Range check passed · duplicate check passed" },
    { step: "Methodology", detail: "GHG Protocol Corporate Standard v1.0" },
    { step: "Calculation", detail: "RUN-2026-08-S1: 33.2 tCO₂e" },
    { step: "Review → Approval", detail: "HSE review · ESG Manager approval" },
    { step: "Disclosure → Report", detail: "S2 Climate → FY2026 Sustainability Report §3" },
  ],
};
