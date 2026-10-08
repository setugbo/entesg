"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import * as s from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { compare, hash } from "./password";
import { createSessionToken, setSessionCookie, clearSessionCookie, getSessionUser, assertTenant, logAudit } from "@/lib/auth";
import { calcEmissions } from "@/lib/engines";

function needDb() {
  if (!db) throw new Error("Database not configured. Set DATABASE_URL (Neon/Local PostgreSQL) and run migrations + seed.");
  return db;
}

async function requirePerm(me: { roleKeys: string[] }, perm: string) {
  const { hasPermission } = await import("@/lib/permissions");
  if (!me.roleKeys.includes("SUPER_ADMIN") && !hasPermission(me.roleKeys, perm as never)) {
    throw new Error(`Insufficient permission (${perm}).`);
  }
}

// ---------- Auth ----------
const loginAttempts = new Map<string, number[]>();
function throttleLogin(key: string) {
  const now = Date.now();
  const arr = (loginAttempts.get(key) ?? []).filter((t) => now - t < 60_000);
  arr.push(now);
  loginAttempts.set(key, arr);
  if (arr.length > 10) throw new Error("Too many sign-in attempts. Wait a minute and try again.");
}

export async function signIn(form: FormData) {
  const d = needDb();
  const email = String(form.get("email") ?? "").toLowerCase().trim();
  const password = String(form.get("password") ?? "");
  throttleLogin(`login:${email}`);
  const rows = await d.select().from(s.users).where(eq(s.users.email, email)).limit(1);
  const u = rows[0];
  if (!u?.passwordHash || !(await compare(password, u.passwordHash))) throw new Error("Invalid email or password.");
  const token = await createSessionToken(u.id);
  await d.insert(s.sessions).values({ userId: u.id, token, expiresAt: new Date(Date.now() + 7 * 864e5) });
  await setSessionCookie(token);
  await logAudit({ organisationId: u.organisationId, userId: u.id, action: "auth.login", entity: "user", entityId: u.id });
  redirect("/dashboard");
}

export async function signOut() {
  const u = await getSessionUser();
  if (db && u) {
    const c = (await import("next/headers")).cookies;
    const token = (await c()).get("entesg_session")?.value;
    if (token) await db.delete(s.sessions).where(eq(s.sessions.token, token));
    await logAudit({ organisationId: u.organisationId, userId: u.id, action: "auth.logout", entity: "user", entityId: u.id });
  }
  await clearSessionCookie();
  redirect("/login");
}

// ---------- Generic workflow transitions (all tenant-guarded + audited) ----------
async function transitionAssessment(id: string, to: typeof s.assessments.$inferSelect.status, action: string) {
  const d = needDb();
  const me = await getSessionUser();
  if (!me) throw new Error("Not authenticated.");
  const rows = await d.select().from(s.assessments).where(eq(s.assessments.id, id)).limit(1);
  const a = rows[0];
  if (!a) throw new Error("Assessment not found.");
  assertTenant(me, a.organisationId);
  await requirePerm(me, to === "approved" ? "assessment.approve" : to === "submitted" ? "assessment.submit" : "assessment.review");
  await d.update(s.assessments).set({ status: to, updatedAt: new Date() }).where(eq(s.assessments.id, id));
  await d.insert(s.approvals).values({ organisationId: a.organisationId, entityType: "assessment", entityId: id, requestedBy: me.id, decidedBy: me.id, decision: to === "approved" ? "approved" : to === "returned" ? "returned" : undefined, comment: action });
  await logAudit({ organisationId: a.organisationId, userId: me.id, action, entity: "assessment", entityId: id, newValue: { to } });
  const { notify } = await import("./notify");
  await notify(a.organisationId, a.ownerId, `Assessment ${to.replace(/_/g, " ")}`, a.title);
  revalidatePath("/assessments");
  revalidatePath(`/assessments/${id}`);
}

export async function submitAssessment(id: string) { return transitionAssessment(id, "submitted", "assessment.submit"); }
export async function reviewAssessment(id: string) { return transitionAssessment(id, "under_review", "assessment.review"); }
export async function approveAssessment(id: string) { return transitionAssessment(id, "approved", "assessment.approve"); }
export async function returnAssessment(id: string) { return transitionAssessment(id, "returned", "assessment.return"); }

export async function saveAnswer(assessmentId: string, questionId: string, value: unknown, comment?: string) {
  const d = needDb();
  const me = await getSessionUser();
  if (!me) throw new Error("Not authenticated.");
  const a = (await d.select().from(s.assessments).where(eq(s.assessments.id, assessmentId)).limit(1))[0];
  if (!a) throw new Error("Assessment not found.");
  assertTenant(me, a.organisationId);
  await requirePerm(me, "assessment.edit");
  const existing = await d.select().from(s.assessmentAnswers).where(and(eq(s.assessmentAnswers.assessmentId, assessmentId), eq(s.assessmentAnswers.questionId, questionId))).limit(1);
  const score = value === true || value === "yes" ? "1" : value === false || value === "no" ? "0" : null;
  if (existing[0]) {
    await d.update(s.assessmentAnswers).set({ value: value as never, comment, answeredBy: me.id }).where(eq(s.assessmentAnswers.id, existing[0].id));
  } else {
    await d.insert(s.assessmentAnswers).values({ assessmentId, questionId, value: value as never, score: score as never, comment, answeredBy: me.id });
  }
  if (a.status === "draft") await d.update(s.assessments).set({ status: "in_progress" }).where(eq(s.assessments.id, assessmentId));
  await logAudit({ organisationId: a.organisationId, userId: me.id, action: "assessment.answer", entity: "assessment", entityId: assessmentId });
  revalidatePath(`/assessments/${assessmentId}`);
}

// ---------- Data requests ----------
async function transitionRequest(id: string, to: typeof s.dataRequests.$inferSelect.status, action: string) {
  const d = needDb();
  const me = await getSessionUser();
  if (!me) throw new Error("Not authenticated.");
  const r = (await d.select().from(s.dataRequests).where(eq(s.dataRequests.id, id)).limit(1))[0];
  if (!r) throw new Error("Request not found.");
  assertTenant(me, r.organisationId);
  await requirePerm(me, to === "approved" ? "metric.approve" : to === "validated" ? "metric.approve" : "metric.submit");
  await d.update(s.dataRequests).set({ status: to }).where(eq(s.dataRequests.id, id));
  await logAudit({ organisationId: r.organisationId, userId: me.id, action, entity: "data_request", entityId: id, newValue: { to } });
  const { notify } = await import("./notify");
  await notify(r.organisationId, r.ownerId, `Data request ${to.replace(/_/g, " ")}`, r.title);
  revalidatePath("/data-requests");
  revalidatePath(`/data-requests/${id}`);
}
export async function sendRequest(id: string) { return transitionRequest(id, "sent", "request.send"); }
export async function submitRequest(id: string) { return transitionRequest(id, "submitted", "request.submit"); }
export async function validateRequest(id: string) { return transitionRequest(id, "validated", "request.validate"); }
export async function approveRequest(id: string) { return transitionRequest(id, "approved", "request.approve"); }
export async function returnRequest(id: string) { return transitionRequest(id, "returned", "request.return"); }

export async function createRequest(input: { title: string; description?: string; period?: string; dueDate?: string; priority?: string; ownerId?: string }) {
  const d = needDb();
  const me = await getSessionUser();
  if (!me?.organisationId) throw new Error("No organisation context. SUPER_ADMIN must pass organisationId.");
  await requirePerm(me, "metric.create");
  const orgId = me.roleKeys.includes("SUPER_ADMIN") && (input as { organisationId?: string }).organisationId
    ? (input as { organisationId?: string }).organisationId!
    : me.organisationId!;
  const [r] = await d.insert(s.dataRequests).values({
    organisationId: orgId,
    title: input.title, description: input.description, period: input.period,
    dueDate: input.dueDate || null, priority: input.priority ?? "medium",
    ownerId: input.ownerId || null, createdBy: me.id, status: "draft",
  }).returning();
  await logAudit({ organisationId: r.organisationId, userId: me.id, action: "request.create", entity: "data_request", entityId: r.id });
  return r.id;
}

export async function submitMetricValue(input: { metricId: string; period: string; value: number; siteId?: string }) {
  const d = needDb();
  const me = await getSessionUser();
  if (!me?.organisationId) throw new Error("No organisation context.");
  await requirePerm(me, "metric.submit");
  const m = (await d.select().from(s.metrics).where(eq(s.metrics.id, input.metricId)).limit(1))[0];
  if (!m) throw new Error("Metric not found.");
  if (m.organisationId) assertTenant(me, m.organisationId);
  const [v] = await d.insert(s.metricValues).values({
    organisationId: me.organisationId, metricId: input.metricId, period: input.period,
    value: String(input.value) as never, siteId: input.siteId || null, status: "submitted", submittedBy: me.id,
  }).returning();
  // Auto validation: range + completeness checks
  const rules = await d.select().from(s.validationRules).where(eq(s.validationRules.metricId, input.metricId));
  for (const rule of rules) {
    const cfg = (rule.config ?? {}) as Record<string, number>;
    let passed = true, msg = "passed";
    if (rule.ruleType === "range" && (cfg.min !== undefined || cfg.max !== undefined)) {
      if (cfg.min !== undefined && input.value < cfg.min) { passed = false; msg = `Below minimum ${cfg.min}`; }
      if (cfg.max !== undefined && input.value > cfg.max) { passed = false; msg = `Above maximum ${cfg.max}`; }
    }
    await d.insert(s.validationResults).values({ organisationId: me.organisationId, metricValueId: v.id, ruleId: rule.id, passed, message: msg });
  }
  await logAudit({ organisationId: me.organisationId, userId: me.id, action: "metric.submit", entity: "metric_value", entityId: v.id, newValue: input });
  revalidatePath("/metrics");
  return v.id;
}

// ---------- Evidence ----------
export async function reviewEvidence(id: string, decision: "approved" | "rejected" | "returned", comment?: string) {
  const d = needDb();
  const me = await getSessionUser();
  if (!me) throw new Error("Not authenticated.");
  const e = (await d.select().from(s.evidence).where(eq(s.evidence.id, id)).limit(1))[0];
  if (!e) throw new Error("Evidence not found.");
  assertTenant(me, e.organisationId);
  await requirePerm(me, decision === "approved" ? "evidence.approve" : "evidence.review");
  const status = decision === "approved" ? "accepted" : decision === "rejected" ? "rejected" : "under_review";
  await d.update(s.evidence).set({ status }).where(eq(s.evidence.id, id));
  await d.insert(s.evidenceReviews).values({ evidenceId: id, reviewerId: me.id, decision, comment });
  await logAudit({ organisationId: e.organisationId, userId: me.id, action: `evidence.${decision}`, entity: "evidence", entityId: id });
  const { notify } = await import("./notify");
  await notify(e.organisationId, e.uploadedBy, `Evidence ${decision}`, e.name);
  revalidatePath("/evidence");
  revalidatePath(`/evidence/${id}`);
}

// ---------- GHG ----------
export async function runGhgCalculation(input: { scope: string; period: string; inputs: { label: string; activityData: number; unit: string; factorId: string; siteId?: string }[] }) {
  const d = needDb();
  const me = await getSessionUser();
  if (!me?.organisationId) throw new Error("No organisation context.");
  await requirePerm(me, "ghg.calculate");
  const factors = await d.select().from(s.emissionFactors);
  const fmap = new Map(factors.map((f) => [f.id, f]));
  const [run] = await d.insert(s.calculationRuns).values({
    organisationId: me.organisationId, scope: input.scope, period: input.period, status: "draft", createdBy: me.id,
  }).returning();
  let total = 0;
  for (const i of input.inputs) {
    const f = fmap.get(i.factorId);
    if (!f) throw new Error(`Unknown emission factor ${i.factorId}`);
    const t = calcEmissions(i.activityData, Number(f.factorKgco2e));
    total += t;
    const [ci] = await d.insert(s.calculationInputs).values({
      runId: run.id, activityData: String(i.activityData) as never, unit: i.unit,
      factorId: i.factorId, siteId: i.siteId || null, label: i.label,
    }).returning();
    await d.insert(s.calculationOutputs).values({
      runId: run.id, inputId: ci.id, emissionsTco2e: String(t) as never,
      detail: { factor: f.code, factorKgco2e: String(f.factorKgco2e), methodology: "GHG Protocol" } as never,
    });
  }
  await d.update(s.calculationRuns).set({ totalTco2e: String(total) as never }).where(eq(s.calculationRuns.id, run.id));
  await logAudit({ organisationId: me.organisationId, userId: me.id, action: "ghg.calculate", entity: "calculation_run", entityId: run.id, newValue: { total } });
  revalidatePath("/emissions");
  return { runId: run.id, total };
}

export async function approveGhgRun(id: string) {
  const d = needDb();
  const me = await getSessionUser();
  if (!me) throw new Error("Not authenticated.");
  const r = (await d.select().from(s.calculationRuns).where(eq(s.calculationRuns.id, id)).limit(1))[0];
  if (!r) throw new Error("Run not found.");
  assertTenant(me, r.organisationId);
  await requirePerm(me, "ghg.approve");
  await d.update(s.calculationRuns).set({ status: "approved" }).where(eq(s.calculationRuns.id, id));
  await logAudit({ organisationId: r.organisationId, userId: me.id, action: "ghg.approve", entity: "calculation_run", entityId: id });
  revalidatePath("/emissions");
}

// ---------- Risks / controls / targets / reports ----------
export async function createRisk(input: { title: string; description?: string; category?: string; likelihood?: number; impact?: number }) {
  const d = needDb();
  const me = await getSessionUser();
  if (!me?.organisationId) throw new Error("No organisation context.");
  await requirePerm(me, "risk.manage");
  const [r] = await d.insert(s.risks).values({ organisationId: me.organisationId, title: input.title, description: input.description, category: input.category, ownerId: me.id }).returning();
  if (input.likelihood && input.impact) {
    const inherent = input.likelihood * input.impact;
    await d.insert(s.riskAssessments).values({ riskId: r.id, likelihood: input.likelihood, impact: input.impact, inherentRisk: inherent, residualRisk: inherent, assessedBy: me.id });
  }
  await logAudit({ organisationId: me.organisationId, userId: me.id, action: "risk.create", entity: "risk", entityId: r.id });
  return r.id;
}

export async function testControl(controlId: string, result: "effective" | "partially_effective" | "ineffective" | "not_tested", notes?: string) {
  const d = needDb();
  const me = await getSessionUser();
  if (!me) throw new Error("Not authenticated.");
  const c = (await d.select().from(s.controls).where(eq(s.controls.id, controlId)).limit(1))[0];
  if (!c) throw new Error("Control not found.");
  assertTenant(me, c.organisationId);
  await requirePerm(me, "control.test");
  await d.insert(s.controlTests).values({ controlId, testerId: me.id, result, notes });
  await logAudit({ organisationId: c.organisationId, userId: me.id, action: "control.test", entity: "control", entityId: controlId, newValue: { result } });
  revalidatePath("/controls");
  revalidatePath(`/controls/${controlId}`);
}

export async function createTarget(input: { title: string; metricId?: string; kind?: string; baselineYear?: number; baselineValue?: number; targetYear?: number; targetValue?: number }) {
  const d = needDb();
  const me = await getSessionUser();
  if (!me?.organisationId) throw new Error("No organisation context.");
  await requirePerm(me, "target.manage");
  const [t] = await d.insert(s.targets).values({
    organisationId: me.organisationId, title: input.title, metricId: input.metricId || null, kind: input.kind,
    baselineYear: input.baselineYear, baselineValue: input.baselineValue == null ? null : String(input.baselineValue) as never,
    targetYear: input.targetYear, targetValue: input.targetValue == null ? null : String(input.targetValue) as never,
    ownerId: me.id,
  }).returning();
  await logAudit({ organisationId: me.organisationId, userId: me.id, action: "target.create", entity: "target", entityId: t.id });
  return t.id;
}

export async function createReport(input: { title: string; period?: string }) {
  const d = needDb();
  const me = await getSessionUser();
  if (!me?.organisationId) throw new Error("No organisation context.");
  await requirePerm(me, "report.create");
  // Only approved metric values may flow into reports — enforced at assembly time.
  const [r] = await d.insert(s.reports).values({ organisationId: me.organisationId, title: input.title, period: input.period, status: "draft", createdBy: me.id }).returning();
  const sections = ["Governance & Strategy", "Materiality", "Climate & GHG (IFRS S2)", "Environment — Energy, Water, Waste", "Social & Workforce", "Assurance Readiness"];
  for (let i = 0; i < sections.length; i++) {
    await d.insert(s.reportSections).values({ reportId: r.id, title: sections[i], position: i, content: `Auto-assembled from approved data. Section ${i + 1} pending narrative.` });
  }
  await logAudit({ organisationId: me.organisationId, userId: me.id, action: "report.create", entity: "report", entityId: r.id });
  revalidatePath("/reports");
  return r.id;
}

export async function transitionReport(id: string, to: "review" | "approval" | "published" | "draft") {
  const d = needDb();
  const me = await getSessionUser();
  if (!me) throw new Error("Not authenticated.");
  const r = (await d.select().from(s.reports).where(eq(s.reports.id, id)).limit(1))[0];
  if (!r) throw new Error("Report not found.");
  assertTenant(me, r.organisationId);
  if (to === "approval" || to === "published") await requirePerm(me, "report.approve");
  if (to === "published") {
    // Gate: no unapproved metric values referenced by this report's links may be published.
    const links = await d.select().from(s.reportDataLinks).where(eq(s.reportDataLinks.reportId, id));
    for (const l of links) {
      if (l.entityType === "metric_value") {
        const mv = (await d.select().from(s.metricValues).where(eq(s.metricValues.id, l.entityId)).limit(1))[0];
        if (mv && mv.status !== "approved") throw new Error("Cannot publish: report references unapproved data. Approve all linked data first.");
      }
    }
    await d.insert(s.reportVersions).values({ reportId: id, version: 1, snapshot: { publishedAt: new Date().toISOString(), by: me.id } as never, createdBy: me.id });
  }
  await d.update(s.reports).set({ status: to }).where(eq(s.reports.id, id));
  await logAudit({ organisationId: r.organisationId, userId: me.id, action: `report.${to}`, entity: "report", entityId: id });
  revalidatePath("/reports");
  revalidatePath(`/reports/${id}`);
}

export async function addComment(entityType: string, entityId: string, body: string) {
  const d = needDb();
  const me = await getSessionUser();
  if (!me?.organisationId) throw new Error("No organisation context.");
  await d.insert(s.comments).values({ organisationId: me.organisationId, entityType, entityId: entityId as never, authorId: me.id, body });
}

export async function hashPassword(pw: string) {
  return hash(pw);
}
