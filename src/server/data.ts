import { db } from "@/db";
import * as s from "@/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { DEMO } from "./demo";

/** Tenant-scoped reads. Falls back to DEMO when DB is unavailable. */
export async function getOverview(orgId: string | null) {
  if (!db) return { demo: true, ...DEMO };
  try {
    if (!orgId) return { demo: true, ...DEMO };
    const [assessments, requests, evidenceItems, risks, controls, targets, materiality, runs, tests] = await Promise.all([
      db.select().from(s.assessments).where(eq(s.assessments.organisationId, orgId)).orderBy(desc(s.assessments.updatedAt)).limit(5),
      db.select().from(s.dataRequests).where(eq(s.dataRequests.organisationId, orgId)).orderBy(desc(s.dataRequests.createdAt)).limit(6),
      db.select().from(s.evidence).where(eq(s.evidence.organisationId, orgId)).orderBy(desc(s.evidence.createdAt)).limit(6),
      db.select().from(s.risks).where(eq(s.risks.organisationId, orgId)).limit(6),
      db.select().from(s.controls).where(eq(s.controls.organisationId, orgId)).limit(6),
      db.select().from(s.targets).where(eq(s.targets.organisationId, orgId)).limit(6),
      db.select().from(s.materialityAssessments).where(eq(s.materialityAssessments.organisationId, orgId)).limit(1),
      db.select().from(s.calculationRuns).where(eq(s.calculationRuns.organisationId, orgId)).orderBy(desc(s.calculationRuns.createdAt)).limit(8),
      db.select().from(s.controlTests).limit(200),
    ]);
    const allAssess = await db.select().from(s.assessments).where(eq(s.assessments.organisationId, orgId)).limit(100);
    const allReq = await db.select().from(s.dataRequests).where(eq(s.dataRequests.organisationId, orgId)).limit(200);
    const allEv = await db.select().from(s.evidence).where(eq(s.evidence.organisationId, orgId)).limit(500);
    const allRuns = await db.select().from(s.calculationRuns).where(eq(s.calculationRuns.organisationId, orgId)).limit(100);
    const latest = allAssess[0];
    let readiness = DEMO.readiness;
    if (latest) {
      const sc = await db.select().from(s.assessmentScores).where(eq(s.assessmentScores.assessmentId, latest.id));
      if (sc.length) readiness = sc.map((x) => ({ dimension: x.dimension, pct: Math.round(Number(x.score)) }));
    }
    const kpis = {
      readiness: latest?.score != null ? Math.round(Number(latest.score)) : 0,
      criticalGaps: allAssess.filter((a) => a.hasCriticalGap).length,
      ghg2026: Math.round(allRuns.filter((r) => r.status === "approved" && String(r.period).startsWith("2026")).reduce((a, r) => a + Number(r.totalTco2e ?? 0), 0)),
      evidenceCoverage: allEv.length ? Math.round((allEv.filter((e) => e.status === "accepted").length / allEv.length) * 100) : 0,
      controlCoverage: controls.length ? Math.round((controls.filter((c) => tests.filter((t) => t.controlId === c.id).sort((x, y) => Number(y.testedAt) - Number(x.testedAt))[0]?.result === "effective").length / controls.length) * 100) : 0,
      openRequests: allReq.filter((r) => !["approved", "validated"].includes(r.status)).length,
    };
    let topics: { topic: string; impact: number; financial: number }[] = DEMO.materiality;
    if (materiality[0]) {
      const t = await db.select().from(s.materialityTopics).where(eq(s.materialityTopics.assessmentId, materiality[0].id));
      if (t.length) topics = t.map((x) => ({ topic: x.topic, impact: x.impactScore ?? 2, financial: x.financialScore ?? 2 }));
    }
    const ghgTrend = runs.length
      ? runs.slice().reverse().map((r) => ({ label: String(r.period), value: Number(r.totalTco2e ?? 0) }))
      : [];
    const byScope = new Map<string, number>();
    for (const r of allRuns.filter((x) => x.status === "approved" && String(x.period).startsWith("2026"))) {
      byScope.set(r.scope, (byScope.get(r.scope) ?? 0) + Number(r.totalTco2e ?? 0));
    }
    const scopeSplit = [...byScope.entries()].map(([label, value]) => ({ label, value: Math.round(value) }));
    return {
      demo: false, org: null, kpis, readiness,
      hasCriticalGap: allAssess.some((a) => a.hasCriticalGap),
      assessments, requests, evidence: evidenceItems, risks, controls, targets,
      materiality: topics, ghgTrend, scopeSplit,
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
