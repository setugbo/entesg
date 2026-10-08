import { db } from "@/db";
import * as s from "@/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { DEMO } from "./demo";

/** Tenant-scoped reads. Falls back to DEMO when DB is unavailable. */
export async function getOverview(orgId: string | null) {
  if (!db) return { demo: true, ...DEMO };
  try {
    if (!orgId) return { demo: true, ...DEMO };
    const [assessments, requests, evidenceItems, risks, controls, targets, materiality, runs] = await Promise.all([
      db.select().from(s.assessments).where(eq(s.assessments.organisationId, orgId)).orderBy(desc(s.assessments.updatedAt)).limit(5),
      db.select().from(s.dataRequests).where(eq(s.dataRequests.organisationId, orgId)).orderBy(desc(s.dataRequests.createdAt)).limit(6),
      db.select().from(s.evidence).where(eq(s.evidence.organisationId, orgId)).orderBy(desc(s.evidence.createdAt)).limit(6),
      db.select().from(s.risks).where(eq(s.risks.organisationId, orgId)).limit(6),
      db.select().from(s.controls).where(eq(s.controls.organisationId, orgId)).limit(6),
      db.select().from(s.targets).where(eq(s.targets.organisationId, orgId)).limit(6),
      db.select().from(s.materialityAssessments).where(eq(s.materialityAssessments.organisationId, orgId)).limit(1),
      db.select().from(s.calculationRuns).where(eq(s.calculationRuns.organisationId, orgId)).orderBy(desc(s.calculationRuns.createdAt)).limit(8),
    ]);
    let topics: { topic: string; impact: number; financial: number }[] = DEMO.materiality;
    if (materiality[0]) {
      const t = await db.select().from(s.materialityTopics).where(eq(s.materialityTopics.assessmentId, materiality[0].id));
      if (t.length) topics = t.map((x) => ({ topic: x.topic, impact: x.impactScore ?? 2, financial: x.financialScore ?? 2 }));
    }
    const ghgTrend = runs.length
      ? runs.slice().reverse().map((r) => ({ label: String(r.period), value: Number(r.totalTco2e ?? 0) }))
      : DEMO.ghgTrend;
    return {
      demo: false, org: null, kpis: null, readiness: DEMO.readiness,
      assessments, requests, evidence: evidenceItems, risks, controls, targets,
      materiality: topics, ghgTrend, scopeSplit: DEMO.scopeSplit,
    };
  } catch {
    return { demo: true, ...DEMO };
  }
}

export async function countAudit(orgId: string | null) {
  if (!db || !orgId) return 0;
  try {
    const r = await db.select({ n: sql<number>`count(*)` }).from(s.auditEvents).where(eq(s.auditEvents.organisationId, orgId));
    return Number(r[0]?.n ?? 0);
  } catch { return 0; }
}
