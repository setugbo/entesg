"use server";
import { redirect } from "next/navigation";
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
}

// ---------- Comments ----------
export async function postComment(entityType: string, entityId: string, form: FormData) {
  const { addComment } = await import("./actions");
  await addComment(entityType, entityId, String(form.get("body") ?? ""));
}
