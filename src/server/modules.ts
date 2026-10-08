import { db } from "@/db";
import * as s from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { DEMO } from "./demo";

export type ModuleRow = { id: string | null; cells: string[] };
export type ModuleData = { columns: string[]; rows: ModuleRow[]; demo: boolean; linkPrefix?: string };

function demoRows(cells: string[][], prefix: string): ModuleRow[] {
  return cells.map((c, i) => ({ id: `${prefix}-${i}`, cells: c }));
}

/** Target progress % from baseline → current → target (reduction or growth aware). */
export function progressOf(baseline: unknown, current: unknown, target: unknown): string {
  const b = Number(baseline), c = Number(current), t = Number(target);
  if ([b, c, t].some((n) => Number.isNaN(n)) || current == null || target == null) return "—";
  if (t === b) return c === t ? "100%" : "—";
  const p = ((c - b) / (t - b)) * 100;
  return `${Math.max(0, Math.min(999, Math.round(p)))}%`;
}

function coverage(done: number, total: number): { label: string; verdict: string } {
  if (!total) return { label: "No data", verdict: "medium" };
  const p = Math.round((done / total) * 100);
  return { label: `${p}% (${done}/${total})`, verdict: p >= 80 ? "on_track" : p >= 50 ? "attention" : "critical" };
}

const DEMO_TABLES: Record<string, { columns: string[]; rows: string[][]; linkPrefix?: string }> = {
  disclosures: { columns: ["Title", "Status"], rows: [["IFRS S2 Climate disclosure — Scope 1", "draft"], ["GRI 305 Emissions disclosure", "review"]] },
  materiality: { columns: ["Topic", "Impact", "Financial"], rows: DEMO.materiality.map((t) => [t.topic, String(t.impact), String(t.financial)]) },
  metrics: { columns: ["Code", "Metric", "Frequency"], rows: [["ELC", "Electricity consumption", "monthly"], ["DSL", "Diesel consumption", "monthly"], ["WTR", "Water abstraction", "monthly"], ["S1", "Scope 1 GHG emissions", "monthly"]] },
  "data-requests": { columns: ["Request", "Status"], rows: DEMO.requests.map((r) => [r.title, r.status]), linkPrefix: "/data-requests" },
  evidence: { columns: ["File", "Status"], rows: DEMO.evidence.map((e) => [e.name, e.status]), linkPrefix: "/evidence" },
  emissions: { columns: ["Run", "Scope", "Total tCO₂e"], rows: [["RUN-2026-08-S1", "Scope 1", "412.6"], ["RUN-2026-08-S2", "Scope 2", "388.1"]] },
  energy: { columns: ["Metric", "Aug 2026", "Unit"], rows: [["Electricity — Lagos", "84,200", "kWh"], ["Diesel — Ogun fleet", "12,400", "L"], ["Natural gas", "6,100", "m³"]] },
  water: { columns: ["Metric", "Aug 2026", "Unit"], rows: [["Abstraction — Lagos", "9,800", "m³"], ["Abstraction — Ogun", "14,200", "m³"], ["Recycled", "12%", "%"]] },
  waste: { columns: ["Metric", "Aug 2026", "Unit"], rows: [["Total waste", "46.2", "t"], ["Recycled", "28.4", "t"], ["Landfill", "9.1", "t"]] },
  social: { columns: ["Metric", "Value", "Period"], rows: [["Headcount", "1,284", "Aug 2026"], ["Women in workforce", "38%", "Aug 2026"], ["Training hours", "3,420", "Aug 2026"], ["LTIR", "0.4%", "Aug 2026"]] },
  governance: { columns: ["Metric", "Value"], rows: [["Board independence", "55%"], ["Ethics training coverage", "92%"], ["Whistleblowing cases", "2 (resolved)"], ["Data protection incidents", "0"]] },
  risks: { columns: ["Risk", "Category"], rows: DEMO.risks.map((r) => [r.title, r.category]) },
  opportunities: { columns: ["Opportunity", "Category"], rows: [["Solar PPA — Ogun plant", "Energy"], ["Lightweight packaging", "Circularity"], ["Carbon-efficient logistics", "Climate"]] },
  controls: { columns: ["Control", "Last result"], rows: DEMO.controls.map((c) => [`${c.code} — ${c.title}`, c.result.replace(/_/g, " ")]) },
  targets: { columns: ["Target", "Progress"], rows: DEMO.targets.map((t) => [t.title, `${t.progress}%`]) },
  "net-zero": { columns: ["Initiative", "Annual reduction", "Status"], rows: [["Solar array — Ogun (2MW)", "1,180 tCO₂e", "business case"], ["Fleet efficiency + HVO trial", "640 tCO₂e", "pilot"], ["Heat recovery — Lagos", "310 tCO₂e", "planned"]] },
  capex: { columns: ["Asset", "Investment", "Net-zero compatible"], rows: [["New efficient boilers", "₦240m", "Yes"], ["Diesel truck replacement", "₦410m", "Partial"], ["Solar array", "₦380m", "Yes"]] },
  assurance: { columns: ["Check", "Status"], rows: [["Evidence linkage ≥95%", "On track"], ["Factor version locks", "Partial"], ["Approval coverage", "On track"], ["Unapproved data in drafts", "2 items"]] },
  tasks: { columns: ["Task", "Status", "Due"], rows: [["Review diesel evidence — Ogun", "open", "2026-09-12"], ["Approve Aug GHG run", "open", "2026-09-14"], ["Materiality sign-off", "in_progress", "2026-09-20"]] },
  organisations: { columns: ["Entity / Site", "Location"], rows: [["GreenHarvest Manufacturing", "Group"], ["Lagos Plant — Ikeja", "Lagos"], ["Ogun Factory — Agbara", "Ogun"], ["Abuja Depot & Office", "FCT"]] },
  consultant: { columns: ["Client", "Readiness", "Critical gaps"], rows: [["GreenHarvest Foods Nigeria Ltd.", "68%", "3"], ["(assign more clients via Admin)", "—", "—"]] },
  admin: { columns: ["Area", "Detail"], rows: [["Users", "10 seeded across 9 roles"], ["Roles", "11 with granular permissions"], ["Audit events", "immutable log"], ["Tenant isolation", "enforced server-side"]] },
  settings: { columns: ["Setting", "Value"], rows: [["Base year", "2023"], ["Currency", "NGN"], ["Internal carbon price", "₦15,000 / tCO₂e"], ["Fiscal year start", "01-01"]] },
};

export async function getModule(key: string, orgId: string | null): Promise<ModuleData> {
  const fallback = DEMO_TABLES[key] ?? { columns: ["Item"], rows: [] as string[][] };
  const toData = (): ModuleData => ({ columns: fallback.columns, rows: demoRows(fallback.rows, key), demo: true, linkPrefix: fallback.linkPrefix });
  if (!db || !orgId) return toData();
  const emptyLive = (): ModuleData => ({ columns: fallback.columns, rows: [], demo: false, linkPrefix: fallback.linkPrefix });
  try {
    switch (key) {
      case "metrics": {
        const r = await db.select().from(s.metrics).where(eq(s.metrics.organisationId, orgId)).limit(50);
        if (r.length) return { columns: ["Code", "Metric", "Frequency"], rows: r.map((m) => ({ id: m.id, cells: [m.code, m.name, m.frequency ?? "—"] })), demo: false };
        break;
      }
      case "data-requests": {
        const r = await db.select().from(s.dataRequests).where(eq(s.dataRequests.organisationId, orgId)).orderBy(desc(s.dataRequests.createdAt)).limit(50);
        if (r.length) return { columns: ["Request", "Status"], rows: r.map((x) => ({ id: x.id, cells: [x.title, x.status] })), demo: false, linkPrefix: "/data-requests" };
        break;
      }
      case "evidence": {
        const r = await db.select().from(s.evidence).where(eq(s.evidence.organisationId, orgId)).orderBy(desc(s.evidence.createdAt)).limit(50);
        if (r.length) return { columns: ["File", "Status"], rows: r.map((x) => ({ id: x.id, cells: [x.name, x.status] })), demo: false, linkPrefix: "/evidence" };
        break;
      }
      case "risks": {
        const r = await db.select().from(s.risks).where(eq(s.risks.organisationId, orgId)).limit(50);
        if (r.length) return { columns: ["Risk", "Category"], rows: r.map((x) => ({ id: x.id, cells: [x.title, x.category ?? "—"] })), demo: false, linkPrefix: "/risks" };
        break;
      }
      case "controls": {
        const r = await db.select().from(s.controls).where(eq(s.controls.organisationId, orgId)).limit(50);
        if (r.length) {
          const t = await db.select().from(s.controlTests).limit(500);
          const last = (cid: string) => t.filter((x) => x.controlId === cid).sort((a, b) => Number(b.testedAt) - Number(a.testedAt))[0];
          return { columns: ["Control", "Code", "Last result"], rows: r.map((x) => ({ id: x.id, cells: [x.title, x.code, (last(x.id)?.result ?? "not_tested").replace(/_/g, " ")] })), demo: false, linkPrefix: "/controls" };
        }
        break;
      }
      case "targets": {
        const r = await db.select().from(s.targets).where(eq(s.targets.organisationId, orgId)).limit(50);
        if (r.length) return { columns: ["Target", "Kind", "Progress"], rows: r.map((x) => ({ id: x.id, cells: [x.title, x.kind ?? "—", progressOf(x.baselineValue, x.currentValue, x.targetValue)] })), demo: false, linkPrefix: "/targets" };
        break;
      }
      case "emissions": {
        const r = await db.select().from(s.calculationRuns).where(eq(s.calculationRuns.organisationId, orgId)).orderBy(desc(s.calculationRuns.createdAt)).limit(20);
        if (r.length) return { columns: ["Run", "Scope", "Total tCO₂e"], rows: r.map((x) => ({ id: null, cells: [x.period, x.scope, String(x.totalTco2e ?? "—")] })), demo: false };
        break;
      }
      case "materiality": {
        const a = await db.select().from(s.materialityAssessments).where(eq(s.materialityAssessments.organisationId, orgId)).limit(1);
        if (a[0]) {
          const t = await db.select().from(s.materialityTopics).where(eq(s.materialityTopics.assessmentId, a[0].id));
          if (t.length) return { columns: ["Topic", "Impact", "Financial"], rows: t.map((x) => ({ id: null, cells: [x.topic, String(x.impactScore ?? "—"), String(x.financialScore ?? "—")] })), demo: false };
        }
        break;
      }
      case "disclosures": {
        const r = await db.select().from(s.disclosures).where(eq(s.disclosures.organisationId, orgId)).limit(50);
        if (r.length) {
          const links = await db.select().from(s.disclosureRequirements).limit(500);
          return { columns: ["Title", "Status", "Requirements"], rows: r.map((x) => ({ id: x.id, cells: [x.title, x.status ?? "draft", String(links.filter((l) => l.disclosureId === x.id).length)] })), demo: false, linkPrefix: "/disclosures" };
        }
        break;
      }
      case "tasks": {
        const r = await db.select().from(s.tasks).where(eq(s.tasks.organisationId, orgId)).orderBy(desc(s.tasks.createdAt)).limit(50);
        if (r.length) return { columns: ["Task", "Status", "Due"], rows: r.map((x) => ({ id: x.id, cells: [x.title, (x.status ?? "open").replace(/_/g, " "), x.dueDate ?? "—"] })), demo: false, linkPrefix: "/tasks" };
        break;
      }
      case "opportunities": {
        const r = await db.select().from(s.opportunities).where(eq(s.opportunities.organisationId, orgId)).limit(50);
        if (r.length) return { columns: ["Opportunity", "Category"], rows: r.map((x) => ({ id: null, cells: [x.title, x.category ?? "—"] })), demo: false };
        break;
      }
      case "energy":
      case "water":
      case "waste":
      case "social":
      case "governance": {
        const catMap: Record<string, string[]> = {
          energy: ["Energy"], water: ["Water"], waste: ["Waste"],
          social: ["Workforce", "Health & Safety"], governance: ["Board & Ethics"],
        };
        const metrics = await db.select().from(s.metrics);
        const cats = await db.select().from(s.metricCategories);
        const wanted = new Set((catMap[key] ?? []).map((n) => cats.find((c) => c.name === n)?.id).filter(Boolean) as string[]);
        const mine = metrics.filter((m) => !m.organisationId || m.organisationId === orgId);
        const mids = new Set(mine.filter((m) => m.categoryId && wanted.has(m.categoryId)).map((m) => m.id));
        if (mids.size) {
          const vals = await db.select().from(s.metricValues).where(eq(s.metricValues.organisationId, orgId)).limit(200);
          const rows = vals.filter((v) => mids.has(v.metricId))
            .sort((a, b) => String(b.period).localeCompare(String(a.period))).slice(0, 30)
            .map((v) => {
              const m = mine.find((x) => x.id === v.metricId);
              return { id: null, cells: [`${m?.code ?? "?"} — ${m?.name ?? v.metricId.slice(0, 8)}`, v.period, String(v.value), v.status.replace(/_/g, " ")] };
            });
          if (rows.length) return { columns: ["Metric", "Period", "Value", "Status"], rows, demo: false };
        }
        break;
      }
      case "organisations": {
        const [ents, st, deps] = await Promise.all([
          db.select().from(s.businessEntities).where(eq(s.businessEntities.organisationId, orgId)),
          db.select().from(s.sites).where(eq(s.sites.organisationId, orgId)),
          db.select().from(s.departments).where(eq(s.departments.organisationId, orgId)),
        ]);
        const rows: ModuleRow[] = [
          ...ents.map((e) => ({ id: null, cells: [e.name, "Business entity", e.code ?? "—"] })),
          ...st.map((x) => ({ id: null, cells: [x.name, "Site", [x.city, x.state].filter(Boolean).join(", ") || "—"] })),
          ...deps.map((x) => ({ id: null, cells: [x.name, "Department", x.code ?? "—"] })),
        ];
        if (rows.length) return { columns: ["Name", "Type", "Detail"], rows, demo: false };
        break;
      }
      case "settings": {
        const st = (await db.select().from(s.organisationSettings).where(eq(s.organisationSettings.organisationId, orgId)).limit(1))[0];
        if (st) {
          return {
            columns: ["Setting", "Value"],
            rows: [
              { id: null, cells: ["Base year", String(st.baseYear ?? "—")] },
              { id: null, cells: ["Currency", st.currency ?? "—"] },
              { id: null, cells: ["Internal carbon price", st.internalCarbonPrice != null ? `${st.currency ?? ""} ${st.internalCarbonPrice} / tCO₂e` : "—"] },
              { id: null, cells: ["Fiscal year start", st.fiscalYearStart ?? "—"] },
            ],
            demo: false,
          };
        }
        break;
      }
      case "assurance": {
        const [vals, ev, runsA, ass, reps, ctrls, tst] = await Promise.all([
          db.select().from(s.metricValues).where(eq(s.metricValues.organisationId, orgId)).limit(500),
          db.select().from(s.evidence).where(eq(s.evidence.organisationId, orgId)).limit(500),
          db.select().from(s.calculationRuns).where(eq(s.calculationRuns.organisationId, orgId)).limit(200),
          db.select().from(s.assessments).where(eq(s.assessments.organisationId, orgId)).limit(100),
          db.select().from(s.reports).where(eq(s.reports.organisationId, orgId)).limit(100),
          db.select().from(s.controls).where(eq(s.controls.organisationId, orgId)).limit(200),
          db.select().from(s.controlTests).limit(1000),
        ]);
        const submittedVals = vals.filter((v) => v.status !== "draft");
        const effCtrls = ctrls.filter((c) => tst.filter((t) => t.controlId === c.id).sort((a, b) => Number(b.testedAt) - Number(a.testedAt))[0]?.result === "effective").length;
        const checks: [string, { label: string; verdict: string }][] = [
          ["Metric values approved", coverage(vals.filter((v) => v.status === "approved").length, submittedVals.length)],
          ["Evidence accepted", coverage(ev.filter((e) => e.status === "accepted").length, ev.length)],
          ["GHG runs approved", coverage(runsA.filter((r) => r.status === "approved").length, runsA.length)],
          ["Assessments approved", coverage(ass.filter((a) => a.status === "approved").length, ass.length)],
          ["Controls effective", coverage(effCtrls, ctrls.length)],
          ["Reports published", coverage(reps.filter((r) => r.status === "published").length, reps.length)],
        ];
        return { columns: ["Check", "Coverage"], rows: checks.map(([t, c]) => ({ id: null, cells: [t, `${c.label} · ${c.verdict.replace(/_/g, " ")}`] })), demo: false };
      }
      default:
        break;
    }
  } catch { /* fall through to empty live state */ }
  return emptyLive();
}
