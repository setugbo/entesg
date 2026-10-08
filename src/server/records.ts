"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import * as s from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getSessionUser, assertTenant, logAudit } from "@/lib/auth";
import { notify } from "./notify";
import { computeAssessmentScore } from "./scoring";
import { hash } from "./password";

function needDb() {
  if (!db) throw new Error("Database not configured. Set DATABASE_URL and run migrations + seed.");
  return db;
}

async function orgContext() {
  const me = await getSessionUser();
  if (!me) throw new Error("Not authenticated.");
  if (!me.organisationId) throw new Error("No organisation context. Ask an admin to assign you to an organisation.");
  return me;
}

const MODULE_PERMS: Record<string, (typeof import("@/lib/permissions"))["PERMISSIONS"][number]> = {
  metrics: "metric.create", risks: "risk.manage", opportunities: "risk.manage",
  controls: "control.manage", targets: "target.manage", "net-zero": "target.manage",
  capex: "target.manage", disclosures: "report.create", materiality: "materiality.manage",
  tasks: "assessment.create", "data-requests": "metric.create",
};

async function requirePerm(me: { roleKeys: string[] }, perm: (typeof MODULE_PERMS)[string]) {
  const { hasPermission } = await import("@/lib/permissions");
  if (!me.roleKeys.includes("SUPER_ADMIN") && !hasPermission(me.roleKeys, perm)) {
    throw new Error(`Insufficient permission (${perm}).`);
  }
}

// ---------- Generic create (powers the per-module create forms) ----------
export async function createRecord(module: string, form: FormData): Promise<string | void> {
  const d = needDb();
  const me = await orgContext();
  const need = MODULE_PERMS[module];
  if (need) await requirePerm(me, need);
  const g = (k: string) => { const v = form.get(k); return v == null || v === "" ? undefined : String(v); };
  const orgId = me.organisationId!;
  let entity = module, entityId = "";

  switch (module) {
    case "metrics": {
      const [m] = await d.insert(s.metrics).values({ organisationId: orgId, code: g("code")!, name: g("name")!, frequency: g("frequency") ?? "monthly", source: g("source"), methodology: g("methodology"), ownerId: me.id }).returning();
      entityId = m.id; break;
    }
    case "risks": {
      const [r] = await d.insert(s.risks).values({ organisationId: orgId, title: g("title")!, description: g("description"), category: g("category"), ownerId: me.id }).returning();
      if (g("likelihood") && g("impact")) {
        const l = Number(g("likelihood")), im = Number(g("impact"));
        await d.insert(s.riskAssessments).values({ riskId: r.id, likelihood: l, impact: im, inherentRisk: l * im, residualRisk: l * im, assessedBy: me.id });
      }
      entityId = r.id; break;
    }
    case "opportunities": {
      const [o] = await d.insert(s.opportunities).values({ organisationId: orgId, title: g("title")!, description: g("description"), category: g("category"), ownerId: me.id }).returning();
      entityId = o.id; break;
    }
    case "controls": {
      const [c] = await d.insert(s.controls).values({ organisationId: orgId, code: g("code")!, title: g("title")!, description: g("description"), frequency: g("frequency"), ownerId: me.id }).returning();
      entityId = c.id; break;
    }
    case "targets": {
      const { createTarget } = await import("./actions");
      entityId = await createTarget({ title: g("title")!, kind: g("kind"), baselineYear: g("baselineYear") ? Number(g("baselineYear")) : undefined, baselineValue: g("baselineValue") ? Number(g("baselineValue")) : undefined, targetYear: g("targetYear") ? Number(g("targetYear")) : undefined, targetValue: g("targetValue") ? Number(g("targetValue")) : undefined });
      break;
    }
    case "net-zero": {
      const [i] = await d.insert(s.initiatives).values({ organisationId: orgId, title: g("title")!, description: g("description"), annualReductionTco2e: (g("reduction") ?? null) as never, ownerId: me.id, status: "planned" }).returning();
      entity = "initiative"; entityId = i.id; break;
    }
    case "capex": {
      let prog = (await d.select().from(s.capexProgrammes).where(eq(s.capexProgrammes.organisationId, orgId)).limit(1))[0];
      if (!prog) [prog] = await d.insert(s.capexProgrammes).values({ organisationId: orgId, name: `CapEx Programme ${new Date().getFullYear()}`, year: new Date().getFullYear() }).returning();
      const [ci] = await d.insert(s.capexItems).values({ programmeId: prog.id, asset: g("asset")!, investment: (g("investment") ?? null) as never, netZeroCompatible: g("compatible") === "yes", alignmentGap: g("gap"), recommendedAction: g("action") }).returning();
      entity = "capex_item"; entityId = ci.id; break;
    }
    case "disclosures": {
      const [x] = await d.insert(s.disclosures).values({ organisationId: orgId, title: g("title")!, status: "draft", ownerId: me.id }).returning();
      entityId = x.id; break;
    }
    case "materiality": {
      let a = (await d.select().from(s.materialityAssessments).where(eq(s.materialityAssessments.organisationId, orgId)).limit(1))[0];
      if (!a) [a] = await d.insert(s.materialityAssessments).values({ organisationId: orgId, title: `Double Materiality ${new Date().getFullYear()}`, year: new Date().getFullYear(), status: "draft", ownerId: me.id }).returning();
      const im = Number(g("impact") ?? 2), fi = Number(g("financial") ?? 2);
      const [t] = await d.insert(s.materialityTopics).values({ assessmentId: a.id, topic: g("topic")!, category: g("category"), impactScore: im, financialScore: fi, combinedScore: String(((im + fi) / 2).toFixed(1)) as never, decision: im >= 3 || fi >= 3 ? "material" : "monitor", rationale: g("rationale"), ownerId: me.id }).returning();
      entity = "materiality_topic"; entityId = t.id; break;
    }
    case "tasks": {
      const [t] = await d.insert(s.tasks).values({ organisationId: orgId, title: g("title")!, description: g("description"), dueDate: g("dueDate") || null, status: "open" }).returning();
      entityId = t.id; break;
    }
    case "data-requests": {
      const { createRequest } = await import("./actions");
      entity = "data_request";
      entityId = await createRequest({ title: g("title")!, description: g("description"), period: g("period"), dueDate: g("dueDate"), priority: (g("priority") as "low" | "medium" | "high" | "critical") ?? "medium" });
      break;
    }
    default:
      throw new Error(`Create is not supported for module "${module}".`);
  }
  await logAudit({ organisationId: orgId, userId: me.id, action: `${entity}.create`, entity, entityId });
  revalidatePath(`/${module}`);
  return entityId;
}

// ---------- Metric values: submit / validate / approve / reject ----------
export async function submitMetricValueForm(form: FormData) {
  const { submitMetricValue } = await import("./actions");
  await submitMetricValue({ metricId: String(form.get("metricId")), period: String(form.get("period")), value: Number(form.get("value")), siteId: String(form.get("siteId") ?? "") || undefined });
}

async function metricTransition(id: string, to: typeof s.metricValues.$inferSelect.status, action: string) {
  const d = needDb();
  const me = await getSessionUser();
  if (!me) throw new Error("Not authenticated.");
  const v = (await d.select().from(s.metricValues).where(eq(s.metricValues.id, id)).limit(1))[0];
  if (!v) throw new Error("Metric value not found.");
  assertTenant(me, v.organisationId);
  await requirePerm(me, "metric.approve");
  const patch: Partial<typeof v> = { status: to };
  if (to === "validated") patch.reviewedBy = me.id;
  if (to === "approved") patch.approvedBy = me.id;
  await d.update(s.metricValues).set(patch).where(eq(s.metricValues.id, id));
  await logAudit({ organisationId: v.organisationId, userId: me.id, action, entity: "metric_value", entityId: id, newValue: { to } });
  await notify(v.organisationId, v.submittedBy, `Metric value ${to}`, `Period ${v.period} · value ${v.value}`);
  revalidatePath("/metrics");
}
export async function validateMetricValue(id: string) { return metricTransition(id, "validated", "metric.validate"); }
export async function approveMetricValue(id: string) { return metricTransition(id, "approved", "metric.approve"); }
export async function rejectMetricValue(id: string) { return metricTransition(id, "rejected", "metric.reject"); }

// ---------- Assessment scoring ----------
export async function recomputeScore(assessmentId: string) {
  const me = await getSessionUser();
  if (!me) throw new Error("Not authenticated.");
  const d = needDb();
  const a = (await d.select().from(s.assessments).where(eq(s.assessments.id, assessmentId)).limit(1))[0];
  if (!a) throw new Error("Assessment not found.");
  assertTenant(me, a.organisationId);
  const r = await computeAssessmentScore(assessmentId);
  await logAudit({ organisationId: a.organisationId, userId: me.id, action: "assessment.score", entity: "assessment", entityId: assessmentId, newValue: { overall: r.overall, band: r.band } });
  revalidatePath("/dashboard");
  revalidatePath("/assessments");
  revalidatePath(`/assessments/${assessmentId}`);
  return r.overall;
}

// ---------- Evidence links ----------
export async function linkEvidence(evidenceId: string, entityType: string, entityId: string) {
  const d = needDb();
  const me = await getSessionUser();
  if (!me) throw new Error("Not authenticated.");
  const e = (await d.select().from(s.evidence).where(eq(s.evidence.id, evidenceId)).limit(1))[0];
  if (!e) throw new Error("Evidence not found.");
  assertTenant(me, e.organisationId);
  await d.insert(s.evidenceLinks).values({ evidenceId, entityType, entityId: entityId as never });
  await logAudit({ organisationId: e.organisationId, userId: me.id, action: "evidence.link", entity: "evidence", entityId: evidenceId, newValue: { entityType, entityId } });
  revalidatePath(`/evidence/${evidenceId}`);
}

// ---------- Report data links (approved-data gate lives at publish time) ----------
export async function linkReportData(reportId: string, entityType: string, entityId: string) {
  const d = needDb();
  const me = await getSessionUser();
  if (!me) throw new Error("Not authenticated.");
  const r = (await d.select().from(s.reports).where(eq(s.reports.id, reportId)).limit(1))[0];
  if (!r) throw new Error("Report not found.");
  assertTenant(me, r.organisationId);
  const secs = await d.select().from(s.reportSections).where(eq(s.reportSections.reportId, reportId));
  await d.insert(s.reportDataLinks).values({ reportId, sectionId: secs[0]?.id ?? null, entityType, entityId: entityId as never });
  await logAudit({ organisationId: r.organisationId, userId: me.id, action: "report.link", entity: "report", entityId: reportId, newValue: { entityType, entityId } });
  revalidatePath(`/reports/${reportId}`);
}

// ---------- Escalations: overdue data requests ----------
export async function escalateOverdue() {
  const d = needDb();
  const me = await orgContext();
  await requirePerm(me, "risk.manage");
  const today = new Date().toISOString().slice(0, 10);
  const open = await d.select().from(s.dataRequests).where(eq(s.dataRequests.organisationId, me.organisationId!));
  let n = 0;
  for (const r of open) {
    if (!r.dueDate || r.dueDate >= today || ["approved", "validated"].includes(r.status)) continue;
    if (r.status !== "overdue") await d.update(s.dataRequests).set({ status: "overdue" }).where(eq(s.dataRequests.id, r.id));
    await d.insert(s.escalations).values({ organisationId: r.organisationId, entityType: "data_request", entityId: r.id, reason: `Overdue since ${r.dueDate}: ${r.title}`, escalatedTo: r.ownerId });
    await notify(r.organisationId, r.ownerId, "Overdue data request escalated", `${r.title} (due ${r.dueDate})`);
    n++;
  }
  await logAudit({ organisationId: me.organisationId, userId: me.id, action: "escalation.run", entity: "data_request", newValue: { count: n } });
  revalidatePath("/data-requests");
  revalidatePath("/notifications");
  return n;
}

// ---------- Organisation switching (consultant / super-admin) ----------
export async function switchOrganisation(orgId: string) {
  const me = await getSessionUser();
  if (!me) throw new Error("Not authenticated.");
  const d = needDb();
  if (!me.roleKeys.includes("SUPER_ADMIN")) {
    const rows = await d.select().from(s.consultantClients).where(and(eq(s.consultantClients.userId, me.id), eq(s.consultantClients.organisationId, orgId)));
    if (!rows.length) throw new Error("You are not assigned to that organisation.");
  }
  const { cookies } = await import("next/headers");
  (await cookies()).set("entesg_org", orgId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 8 });
  redirect("/dashboard");
}

export async function clearOrgSwitch() {
  const { cookies } = await import("next/headers");
  (await cookies()).delete("entesg_org");
  redirect("/dashboard");
}

// ---------- Admin: users & roles ----------
export async function createUser(form: FormData) {
  const d = needDb();
  const me = await getSessionUser();
  if (!me) throw new Error("Not authenticated.");
  const { hasPermission } = await import("@/lib/permissions");
  if (!me.roleKeys.includes("SUPER_ADMIN") && !hasPermission(me.roleKeys, "user.manage")) throw new Error("Insufficient permission.");
  const email = String(form.get("email")).toLowerCase().trim();
  const name = String(form.get("name"));
  const roleKey = String(form.get("role"));
  const targetOrg = me.roleKeys.includes("SUPER_ADMIN") && form.get("organisationId") ? String(form.get("organisationId")) : me.organisationId;
  if (!targetOrg) throw new Error("No organisation context.");
  let u = (await d.select().from(s.users).where(eq(s.users.email, email)))[0];
  if (!u) {
    const pw = String(form.get("password") || randomDefaultPassword());
    [u] = await d.insert(s.users).values({ name, email, passwordHash: await hash(pw), organisationId: targetOrg, emailVerified: true }).returning();
  }
  const role = (await d.select().from(s.roles).where(eq(s.roles.key, roleKey)))[0];
  if (!role) throw new Error("Unknown role.");
  await d.insert(s.userRoles).values({ userId: u.id, roleId: role.id, organisationId: targetOrg }).onConflictDoNothing();
  await logAudit({ organisationId: targetOrg, userId: me.id, action: "user.invite", entity: "user", entityId: u.id, newValue: { email, roleKey } });
  await notify(targetOrg, u.id, "Welcome to entESG", `You were added as ${roleKey}.`);
  revalidatePath("/admin");
}

function randomDefaultPassword() {
  return `Gh${Date.now().toString(36)}!x7`;
}

export async function assignConsultant(form: FormData) {
  const d = needDb();
  const me = await getSessionUser();
  if (!me) throw new Error("Not authenticated.");
  const userId = String(form.get("userId"));
  const organisationId = String(form.get("organisationId"));
  if (!me.roleKeys.includes("SUPER_ADMIN")) {
    const { hasPermission } = await import("@/lib/permissions");
    if (!hasPermission(me.roleKeys, "user.manage")) throw new Error("Insufficient permission.");
    if (me.organisationId !== organisationId) throw new Error("Tenant violation.");
  }
  await d.insert(s.consultantClients).values({ userId, organisationId }).onConflictDoNothing();
  await logAudit({ organisationId, userId: me.id, action: "consultant.assign", entity: "organisation", entityId: organisationId, newValue: { userId } });
  revalidatePath("/consultant");
  revalidatePath("/admin");
}

// ---------- Comments ----------
export async function postComment(entityType: string, entityId: string, form: FormData) {
  const { addComment } = await import("./actions");
  await addComment(entityType, entityId, String(form.get("body") ?? ""));
  revalidatePath(`/${entityType.replace(/_/g, "-")}s/${entityId}`);
}

// ---------- Data-request items ----------
export async function createRequestItem(requestId: string, form: FormData) {
  const d = needDb();
  const me = await orgContext();
  await requirePerm(me, "metric.create");
  const r = (await d.select().from(s.dataRequests).where(eq(s.dataRequests.id, requestId)).limit(1))[0];
  if (!r) throw new Error("Request not found.");
  assertTenant(me, r.organisationId);
  const g = (k: string) => { const v = form.get(k); return v == null || v === "" ? null : String(v); };
  const [it] = await d.insert(s.dataRequestItems).values({
    requestId, metricId: g("metricId"), questionId: g("questionId"),
    label: String(form.get("label")), required: form.get("required") === "yes",
  }).returning();
  await logAudit({ organisationId: r.organisationId, userId: me.id, action: "request.item.create", entity: "data_request", entityId: requestId, newValue: { label: it.label } });
  revalidatePath(`/data-requests/${requestId}`);
}

// ---------- Risk treatments ----------
export async function createRiskTreatment(riskId: string, form: FormData) {
  const d = needDb();
  const me = await orgContext();
  await requirePerm(me, "risk.manage");
  const r = (await d.select().from(s.risks).where(eq(s.risks.id, riskId)).limit(1))[0];
  if (!r) throw new Error("Risk not found.");
  assertTenant(me, r.organisationId);
  const g = (k: string) => { const v = form.get(k); return v == null || v === "" ? null : String(v); };
  await d.insert(s.riskTreatments).values({ riskId, action: String(form.get("action")), ownerId: g("ownerId"), dueDate: g("dueDate"), status: "open" });
  await logAudit({ organisationId: r.organisationId, userId: me.id, action: "risk.treatment.create", entity: "risk", entityId: riskId });
  revalidatePath(`/risks/${riskId}`);
  revalidatePath("/risks");
}

// ---------- Control exceptions & remediations ----------
export async function createException(controlId: string, form: FormData) {
  const d = needDb();
  const me = await orgContext();
  await requirePerm(me, "control.manage");
  const c = (await d.select().from(s.controls).where(eq(s.controls.id, controlId)).limit(1))[0];
  if (!c) throw new Error("Control not found.");
  assertTenant(me, c.organisationId);
  const g = (k: string) => { const v = form.get(k); return v == null || v === "" ? null : String(v); };
  const [e] = await d.insert(s.controlExceptions).values({
    controlId, testId: g("testId"), description: String(form.get("description")),
    severity: (g("severity") ?? "medium") as never, status: "open",
  }).returning();
  await logAudit({ organisationId: c.organisationId, userId: me.id, action: "control.exception.create", entity: "control", entityId: controlId, newValue: { exceptionId: e.id } });
  revalidatePath(`/controls/${controlId}`);
}

export async function createRemediation(exceptionId: string, form: FormData) {
  const d = needDb();
  const me = await orgContext();
  await requirePerm(me, "control.manage");
  const e = (await d.select().from(s.controlExceptions).where(eq(s.controlExceptions.id, exceptionId)).limit(1))[0];
  if (!e) throw new Error("Exception not found.");
  const c = (await d.select().from(s.controls).where(eq(s.controls.id, e.controlId)).limit(1))[0];
  if (c) assertTenant(me, c.organisationId);
  const g = (k: string) => { const v = form.get(k); return v == null || v === "" ? null : String(v); };
  await d.insert(s.remediations).values({ exceptionId, action: String(form.get("action")), ownerId: g("ownerId"), dueDate: g("dueDate"), status: "open" });
  await logAudit({ organisationId: c?.organisationId ?? me.organisationId, userId: me.id, action: "control.remediation.create", entity: "control_exception", entityId: exceptionId });
  if (c) revalidatePath(`/controls/${c.id}`);
}

export async function closeException(exceptionId: string, controlId: string) {
  const d = needDb();
  const me = await orgContext();
  await requirePerm(me, "control.manage");
  await d.update(s.controlExceptions).set({ status: "closed" }).where(eq(s.controlExceptions.id, exceptionId));
  await logAudit({ organisationId: me.organisationId, userId: me.id, action: "control.exception.close", entity: "control_exception", entityId: exceptionId });
  revalidatePath(`/controls/${controlId}`);
}

// ---------- Target progress ----------
export async function updateTargetProgress(targetId: string, form: FormData) {
  const d = needDb();
  const me = await orgContext();
  await requirePerm(me, "target.manage");
  const t = (await d.select().from(s.targets).where(eq(s.targets.id, targetId)).limit(1))[0];
  if (!t) throw new Error("Target not found.");
  assertTenant(me, t.organisationId);
  const g = (k: string) => { const v = form.get(k); return v == null || v === "" ? null : String(v); };
  const cur = g("currentValue");
  await d.update(s.targets).set({
    currentValue: (cur ?? null) as never,
    status: (g("status") ?? t.status) as never,
  }).where(eq(s.targets.id, targetId));
  await logAudit({ organisationId: t.organisationId, userId: me.id, action: "target.progress", entity: "target", entityId: targetId, newValue: { currentValue: cur } });
  revalidatePath(`/targets/${targetId}`);
  revalidatePath("/targets");
  revalidatePath("/dashboard");
}

// ---------- Tasks ----------
export async function updateTask(taskId: string, form: FormData) {
  const d = needDb();
  const me = await orgContext();
  await requirePerm(me, "assessment.create");
  const t = (await d.select().from(s.tasks).where(eq(s.tasks.id, taskId)).limit(1))[0];
  if (!t) throw new Error("Task not found.");
  assertTenant(me, t.organisationId);
  const g = (k: string) => { const v = form.get(k); return v == null || v === "" ? null : String(v); };
  await d.update(s.tasks).set({ status: (g("status") ?? t.status) as never, assigneeId: (g("assigneeId") ?? t.assigneeId) as never }).where(eq(s.tasks.id, taskId));
  await logAudit({ organisationId: t.organisationId, userId: me.id, action: "task.update", entity: "task", entityId: taskId, newValue: { status: g("status") } });
  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
}

// ---------- Disclosure ↔ requirement mapping ----------
export async function linkDisclosureRequirement(disclosureId: string, form: FormData) {
  const d = needDb();
  const me = await orgContext();
  await requirePerm(me, "requirement.manage");
  const x = (await d.select().from(s.disclosures).where(eq(s.disclosures.id, disclosureId)).limit(1))[0];
  if (!x) throw new Error("Disclosure not found.");
  if (x.organisationId) assertTenant(me, x.organisationId);
  const requirementId = String(form.get("requirementId"));
  await d.insert(s.disclosureRequirements).values({ disclosureId, requirementId: requirementId as never });
  await logAudit({ organisationId: me.organisationId, userId: me.id, action: "disclosure.link", entity: "disclosure", entityId: disclosureId, newValue: { requirementId } });
  revalidatePath(`/disclosures/${disclosureId}`);
}

// ---------- Questionnaire builder ----------
export async function createQuestionnaire(form: FormData) {
  const d = needDb();
  const me = await orgContext();
  await requirePerm(me, "requirement.manage");
  const [q] = await d.insert(s.questionnaires).values({
    organisationId: me.organisationId, title: String(form.get("title")),
    description: String(form.get("description") ?? ""), status: "active", createdBy: me.id,
  }).returning();
  await logAudit({ organisationId: me.organisationId, userId: me.id, action: "questionnaire.create", entity: "questionnaire", entityId: q.id });
  revalidatePath("/questionnaires");
  return q.id;
}

export async function createSection(questionnaireId: string, form: FormData) {
  const d = needDb();
  const me = await orgContext();
  await requirePerm(me, "requirement.manage");
  const existing = await d.select().from(s.questionnaireSections).where(eq(s.questionnaireSections.questionnaireId, questionnaireId));
  const [sec] = await d.insert(s.questionnaireSections).values({
    questionnaireId: questionnaireId as never, title: String(form.get("title")), position: existing.length,
  }).returning();
  await logAudit({ organisationId: me.organisationId, userId: me.id, action: "questionnaire.section.create", entity: "questionnaire", entityId: questionnaireId });
  revalidatePath(`/questionnaires/${questionnaireId}`);
  return sec.id;
}

export async function createQuestion(sectionId: string, form: FormData) {
  const d = needDb();
  const me = await orgContext();
  await requirePerm(me, "requirement.manage");
  const g = (k: string) => { const v = form.get(k); return v == null || v === "" ? null : String(v); };
  const sec = (await d.select().from(s.questionnaireSections).where(eq(s.questionnaireSections.id, sectionId)).limit(1))[0];
  if (!sec) throw new Error("Section not found.");
  const siblings = await d.select().from(s.questions).where(eq(s.questions.sectionId, sectionId));
  const [q] = await d.insert(s.questions).values({
    sectionId: sectionId as never, code: String(form.get("code")), text: String(form.get("text")),
    type: (g("type") ?? "yes_no") as never, guidance: g("guidance"),
    weight: (g("weight") ?? "1") as never, requiredEvidence: g("requiredEvidence") === "yes",
    ownerRole: g("ownerRole"), requirementId: g("requirementId"), position: siblings.length,
  }).returning();
  const opts = String(form.get("options") ?? "").split(",").map((o) => o.trim()).filter(Boolean);
  for (let i = 0; i < opts.length; i++) {
    await d.insert(s.questionOptions).values({ questionId: q.id, label: opts[i], value: opts[i].toLowerCase().replace(/\s+/g, "_"), score: "0" as never, position: i });
  }
  const reqId = g("requirementId");
  if (reqId) await d.insert(s.questionMappings).values({ questionId: q.id, requirementId: reqId as never });
  await logAudit({ organisationId: me.organisationId, userId: me.id, action: "question.create", entity: "question", entityId: q.id });
  revalidatePath(`/questionnaires/${sec.questionnaireId}`);
}

// ---------- Framework / version / requirement management ----------
export async function createFramework(form: FormData) {
  const d = needDb();
  const me = await orgContext();
  await requirePerm(me, "requirement.manage");
  const g = (k: string) => { const v = form.get(k); return v == null || v === "" ? null : String(v); };
  const [f] = await d.insert(s.frameworks).values({
    code: String(form.get("code")), name: String(form.get("name")),
    publisher: g("publisher"), description: g("description"),
  }).returning().catch(async () => {
    return d.select().from(s.frameworks).where(eq(s.frameworks.code, String(form.get("code")))).limit(1);
  });
  await logAudit({ organisationId: me.organisationId, userId: me.id, action: "framework.create", entity: "framework", entityId: f.id });
  revalidatePath("/frameworks");
  return f.id;
}

export async function createFrameworkVersion(frameworkId: string, form: FormData) {
  const d = needDb();
  const me = await orgContext();
  await requirePerm(me, "requirement.manage");
  const g = (k: string) => { const v = form.get(k); return v == null || v === "" ? null : String(v); };
  const [v] = await d.insert(s.frameworkVersions).values({
    frameworkId: frameworkId as never, version: String(form.get("version")),
    effectiveDate: g("effectiveDate"), jurisdiction: g("jurisdiction"), sourceUrl: g("sourceUrl"), status: "active",
  }).returning();
  await logAudit({ organisationId: me.organisationId, userId: me.id, action: "framework.version.create", entity: "framework", entityId: frameworkId });
  revalidatePath("/frameworks");
  return v.id;
}

export async function createRequirement(form: FormData) {
  const d = needDb();
  const me = await orgContext();
  await requirePerm(me, "requirement.manage");
  const g = (k: string) => { const v = form.get(k); return v == null || v === "" ? null : String(v); };
  const [r] = await d.insert(s.requirements).values({
    frameworkVersionId: g("frameworkVersionId"), code: String(form.get("code")), title: String(form.get("title")),
    description: g("description"), topic: g("topic"), category: g("category"),
    jurisdiction: g("jurisdiction"), sector: g("sector"),
    sourceOrg: g("sourceOrg"), sourceDoc: g("sourceDoc"), sourceUrl: g("sourceUrl"),
    interpretation: g("interpretation"), validationStatus: "REQUIRES SME VALIDATION",
    criticality: ((g("criticality") ?? "medium") as string) as never,
  }).returning();
  await logAudit({ organisationId: me.organisationId, userId: me.id, action: "requirement.create", entity: "requirement", entityId: r.id });
  revalidatePath("/requirements");
  return r.id;
}

// ---------- User administration ----------
export async function setUserStatus(userId: string, status: "active" | "suspended") {
  const d = needDb();
  const me = await getSessionUser();
  if (!me) throw new Error("Not authenticated.");
  await requirePerm(me, "user.manage");
  const u = (await d.select().from(s.users).where(eq(s.users.id, userId)).limit(1))[0];
  if (!u) throw new Error("User not found.");
  if (u.id === me.id) throw new Error("You cannot suspend your own account.");
  if (!me.roleKeys.includes("SUPER_ADMIN") && u.organisationId !== me.organisationId) throw new Error("Tenant violation.");
  await d.update(s.users).set({ status: status as never }).where(eq(s.users.id, userId));
  await logAudit({ organisationId: u.organisationId, userId: me.id, action: `user.${status}`, entity: "user", entityId: userId });
  revalidatePath("/admin");
}

export async function setUserRole(userId: string, form: FormData) {
  const d = needDb();
  const me = await getSessionUser();
  if (!me) throw new Error("Not authenticated.");
  await requirePerm(me, "user.manage");
  const u = (await d.select().from(s.users).where(eq(s.users.id, userId)).limit(1))[0];
  if (!u) throw new Error("User not found.");
  if (!me.roleKeys.includes("SUPER_ADMIN") && u.organisationId !== me.organisationId) throw new Error("Tenant violation.");
  const role = (await d.select().from(s.roles).where(eq(s.roles.key, String(form.get("role")))))[0];
  if (!role) throw new Error("Unknown role.");
  await d.delete(s.userRoles).where(eq(s.userRoles.userId, userId));
  await d.insert(s.userRoles).values({ userId, roleId: role.id, organisationId: u.organisationId });
  await logAudit({ organisationId: u.organisationId, userId: me.id, action: "user.role.change", entity: "user", entityId: userId, newValue: { role: role.key } });
  revalidatePath("/admin");
}

export async function resetUserPassword(userId: string) {
  const d = needDb();
  const me = await getSessionUser();
  if (!me) throw new Error("Not authenticated.");
  await requirePerm(me, "user.manage");
  const u = (await d.select().from(s.users).where(eq(s.users.id, userId)).limit(1))[0];
  if (!u) throw new Error("User not found.");
  if (!me.roleKeys.includes("SUPER_ADMIN") && u.organisationId !== me.organisationId) throw new Error("Tenant violation.");
  const temp = `Gh${Date.now().toString(36)}!x9`;
  await d.update(s.users).set({ passwordHash: await hash(temp) }).where(eq(s.users.id, userId));
  await logAudit({ organisationId: u.organisationId, userId: me.id, action: "user.password.reset", entity: "user", entityId: userId });
  return temp;
}

export async function changePassword(form: FormData) {
  const d = needDb();
  const me = await getSessionUser();
  if (!me) throw new Error("Not authenticated.");
  const u = (await d.select().from(s.users).where(eq(s.users.id, me.id)).limit(1))[0];
  if (!u?.passwordHash) throw new Error("Account has no password set. Ask an admin to reset it.");
  const { compare } = await import("./password");
  if (!(await compare(String(form.get("current") ?? ""), u.passwordHash))) throw new Error("Current password is incorrect.");
  const next = String(form.get("next") ?? "");
  if (next.length < 10) throw new Error("New password must be at least 10 characters.");
  await d.update(s.users).set({ passwordHash: await hash(next) }).where(eq(s.users.id, me.id));
  await logAudit({ organisationId: me.organisationId, userId: me.id, action: "user.password.change", entity: "user", entityId: me.id });
}
