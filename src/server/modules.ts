import { db } from "@/db";
import * as s from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { DEMO } from "./demo";

export type ModuleRow = { id: string | null; cells: string[] };
export type ModuleData = { columns: string[]; rows: ModuleRow[]; demo: boolean; linkPrefix?: string };

function demoRows(cells: string[][], prefix: string): ModuleRow[] {
  return cells.map((c, i) => ({ id: `${prefix}-${i}`, cells: c }));
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
        if (r.length) return { columns: ["Risk", "Category"], rows: r.map((x) => ({ id: null, cells: [x.title, x.category ?? "—"] })), demo: false };
        break;
      }
      case "controls": {
        const r = await db.select().from(s.controls).where(eq(s.controls.organisationId, orgId)).limit(50);
        if (r.length) return { columns: ["Control", "Code"], rows: r.map((x) => ({ id: null, cells: [x.title, x.code] })), demo: false };
        break;
      }
      case "targets": {
        const r = await db.select().from(s.targets).where(eq(s.targets.organisationId, orgId)).limit(50);
        if (r.length) return { columns: ["Target", "Kind"], rows: r.map((x) => ({ id: null, cells: [x.title, x.kind ?? "—"] })), demo: false };
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
      default:
        break;
    }
  } catch { /* fall through to empty live state */ }
  return emptyLive();
}
