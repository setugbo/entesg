import { Card, DataTable } from "./ui";
import { db } from "@/db";
import * as s from "@/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";
import { validateMetricValue, approveMetricValue, rejectMetricValue } from "@/server/records";
import { approveGhgRun } from "@/server/actions";

/** Values awaiting validation/approval (metric.submit → validated → approved). */
export async function PendingMetricValues() {
  const me = await getSessionUser();
  if (!db || !me?.organisationId) return null;
  let rows: typeof s.metricValues.$inferSelect[] = [];
  let names = new Map<string, string>();
  try {
    rows = await db.select().from(s.metricValues)
      .where(eq(s.metricValues.organisationId, me.organisationId))
      .orderBy(desc(s.metricValues.createdAt)).limit(20);
    rows = rows.filter((r) => ["submitted", "validated"].includes(r.status));
    if (rows.length) {
      const ms = await db.select().from(s.metrics);
      names = new Map(ms.map((m) => [m.id, `${m.code} — ${m.name}`]));
    }
  } catch { return null; }
  if (!rows.length) return null;
  const canApprove = me.roleKeys.includes("SUPER_ADMIN") || me.roleKeys.some((r) => ["ORGANISATION_ADMIN", "APPROVER", "ESG_MANAGER"].includes(r));
  return (
    <Card>
      <div className="border-b border-slate-100 px-5 py-3 text-sm font-bold">Validation queue ({rows.length})</div>
      <DataTable columns={["Metric", "Period", "Value", "Status", ...(canApprove ? [""] : [])]}
        rows={rows.map((r) => [
          names.get(r.metricId) ?? r.metricId.slice(0, 8), r.period, String(r.value), r.status.replace(/_/g, " "),
          ...(canApprove ? [(
            <span key={r.id} className="flex gap-1">
              <form action={async () => { "use server"; await validateMetricValue(r.id); }}><button className="rounded border border-slate-300 px-2 py-1 text-[11px] font-semibold">Validate</button></form>
              <form action={async () => { "use server"; await approveMetricValue(r.id); }}><button className="rounded bg-emerald-900 px-2 py-1 text-[11px] font-semibold text-white">Approve</button></form>
              <form action={async () => { "use server"; await rejectMetricValue(r.id); }}><button className="rounded border border-red-300 px-2 py-1 text-[11px] font-semibold text-red-700">Reject</button></form>
            </span>
          )] : []),
        ])} />
    </Card>
  );
}

/** Questions assigned to the current user, with answer status per latest open assessment. */
export async function MyAssignedQuestions() {
  const me = await getSessionUser();
  if (!db || !me?.organisationId) return null;
  try {
    const qns = await db.select().from(s.questionnaires);
    const mine = qns.filter((q) => !q.organisationId || q.organisationId === me.organisationId);
    const qids = new Set(mine.map((q) => q.id));
    const secs = await db.select().from(s.questionnaireSections);
    const mySecs = secs.filter((x) => qids.has(x.questionnaireId));
    const allQ = await db.select().from(s.questions);
    const assigned = allQ.filter((q) => q.ownerId === me.id && mySecs.some((x) => x.id === q.sectionId));
    if (!assigned.length) return null;
    const assesses = await db.select().from(s.assessments).where(eq(s.assessments.organisationId, me.organisationId));
    const open = assesses.filter((a) => ["draft", "in_progress", "submitted", "under_review", "returned"].includes(a.status));
    const answers = await db.select().from(s.assessmentAnswers);
    const rows = assigned.slice(0, 8).map((q) => {
      const sec = mySecs.find((x) => x.id === q.sectionId);
      const a = open.find((x) => x.questionnaireId === sec?.questionnaireId);
      const done = a ? answers.some((x) => x.assessmentId === a.id && x.questionId === q.id && String(x.value ?? "").trim() !== "") : false;
      return { q, assessmentId: a?.id ?? null, assessment: a?.title ?? mine.find((x) => x.id === sec?.questionnaireId)?.title ?? "—", done };
    });
    return (
      <Card>
        <div className="border-b border-slate-100 px-5 py-3 text-sm font-bold">My assigned questions ({assigned.length})</div>
        <DataTable columns={["Question", "Assessment", "Status", ""]}
          rows={rows.map((r) => [`${r.q.code} — ${r.q.text.slice(0, 70)}`, r.assessment.slice(0, 40),
            r.done ? "answered" : "todo",
            r.assessmentId ? <a key={r.q.id} href={`/assessments/${r.assessmentId}`} className="font-semibold text-emerald-800">Answer →</a> : "—"])} />
      </Card>
    );
  } catch { return null; }
}
/** Draft GHG runs awaiting approval. */
export async function DraftGhgRuns() {
  const me = await getSessionUser();
  if (!db || !me?.organisationId) return null;
  let rows: typeof s.calculationRuns.$inferSelect[] = [];
  try {
    const all = await db.select().from(s.calculationRuns)
      .where(eq(s.calculationRuns.organisationId, me.organisationId))
      .orderBy(desc(s.calculationRuns.createdAt)).limit(10);
    rows = all.filter((r) => r.status === "draft" || r.status === "review");
  } catch { return null; }
  if (!rows.length) return null;
  const canApprove = me.roleKeys.includes("SUPER_ADMIN") || me.roleKeys.some((r) => ["ORGANISATION_ADMIN", "APPROVER"].includes(r));
  return (
    <Card>
      <div className="border-b border-slate-100 px-5 py-3 text-sm font-bold">Runs awaiting approval ({rows.length})</div>
      <DataTable columns={["Period", "Scope", "Total tCO₂e", "Status", ...(canApprove ? [""] : [])]}
        rows={rows.map((r) => [r.period, r.scope, String(r.totalTco2e ?? "—"), r.status,
          ...(canApprove ? [(
            <form key={r.id} action={async () => { "use server"; await approveGhgRun(r.id); }}>
              <button className="rounded bg-emerald-900 px-2 py-1 text-[11px] font-semibold text-white">Approve run</button>
            </form>
          )] : [])])} />
    </Card>
  );
}
