import { AppShell } from "@/components/app-shell";
import { PageHeader, Card, Badge, DataTable } from "@/components/ui";
import { db } from "@/db";
import * as s from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUser, assertTenant } from "@/lib/auth";
import { submitAssessment, reviewAssessment, approveAssessment, returnAssessment, saveAnswer } from "@/server/actions";
import { recomputeScore, assignAssessment } from "@/server/records";
import { notFound } from "next/navigation";

export default async function AssessmentDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (db && user?.organisationId) {
    try {
      const a = (await db.select().from(s.assessments).where(eq(s.assessments.id, id)).limit(1))[0];
      if (!a) return notFound();
      assertTenant(user, a.organisationId);
      const sections = await db.select().from(s.questionnaireSections).where(eq(s.questionnaireSections.questionnaireId, a.questionnaireId));
      const qids = sections.map((x) => x.id);
      const allQ = qids.length ? await db.select().from(s.questions) : [];
      const qs = allQ.filter((q) => qids.includes(q.sectionId));
      const answers = await db.select().from(s.assessmentAnswers).where(eq(s.assessmentAnswers.assessmentId, id));
      const amap = new Map(answers.map((x) => [x.questionId, x]));
      const people = await db.select({ id: s.users.id, name: s.users.name }).from(s.users).where(eq(s.users.organisationId, a.organisationId!));
      const pname = new Map(people.map((p) => [p.id, p.name]));
      const myQs = qs.filter((q) => q.ownerId === user.id);
      return (
        <AppShell>
          <PageHeader title={a.title} sub={`Status: ${a.status} · Owner ${a.ownerId ? pname.get(a.ownerId) ?? "—" : "unassigned"} · Reviewer ${a.reviewerId ? pname.get(a.reviewerId) ?? "—" : "—"} · Approver ${a.approverId ? pname.get(a.approverId) ?? "—" : "—"} · Score signals readiness, not compliance.`}
            actions={<div className="flex gap-2">
              <form action={async () => { "use server"; await recomputeScore(id); }}><button className="rounded-lg border border-emerald-700 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900">Recompute score</button></form>
              <form action={async () => { "use server"; await submitAssessment(id); }}><button className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold">Submit</button></form>
              <form action={async () => { "use server"; await reviewAssessment(id); }}><button className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold">Review</button></form>
              <form action={async () => { "use server"; await approveAssessment(id); }}><button className="rounded-lg bg-emerald-900 px-3 py-2 text-xs font-semibold text-white">Approve</button></form>
              <form action={async () => { "use server"; await returnAssessment(id); }}><button className="rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-semibold text-red-700">Return</button></form>
            </div>} />
          <Card>
            <div className="border-b border-slate-100 px-5 py-3 text-sm font-bold">Assign owner / reviewer / approver</div>
            <form action={async (f: FormData) => { "use server"; await assignAssessment(id, f); }} className="grid gap-2 p-5 sm:grid-cols-4">
              {( [["ownerId", "Owner", a.ownerId], ["reviewerId", "Reviewer", a.reviewerId], ["approverId", "Approver", a.approverId]] as [string, string, string | null][] ).map(([name, label, cur]) => (
                <label key={name} className="block"><span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">{label}</span>
                  <select name={name} defaultValue={cur ?? undefined} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                    <option value="">—</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select></label>
              ))}
              <div className="flex items-end"><button className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold">Assign</button></div>
            </form>
          </Card>
          {myQs.length > 0 && (
            <Card>
              <div className="border-b border-slate-100 px-5 py-3 text-sm font-bold">Assigned to you ({myQs.length})</div>
              <div className="divide-y divide-slate-100">
                {myQs.map((q) => {
                  const ans = amap.get(q.id);
                  const sec = sections.find((x) => x.id === q.sectionId);
                  return (
                    <div key={q.id} className="px-5 py-3">
                      <p className="text-sm font-medium">{q.code} — {q.text} <span className="text-xs font-normal text-slate-400">({sec?.title})</span></p>
                      <form action={async (f: FormData) => { "use server"; await saveAnswer(id, q.id, String(f.get("value") ?? ""), String(f.get("comment") ?? "")); }} className="mt-2 flex flex-wrap items-center gap-2">
                        <input name="value" defaultValue={typeof ans?.value === "string" ? ans.value : ""} placeholder="answer…" className="min-w-52 flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
                        <button className="rounded-lg bg-emerald-900 px-3 py-1.5 text-xs font-semibold text-white">Save</button>
                        {ans?.value ? <Badge status="approved">answered</Badge> : <Badge status="high">todo</Badge>}
                      </form>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
          <div className="space-y-4">
            {sections.map((sec) => (
              <Card key={sec.id}>
                <div className="border-b border-slate-100 px-5 py-3 text-sm font-bold">{sec.title}</div>
                <div className="divide-y divide-slate-100">
                  {qs.filter((q) => q.sectionId === sec.id).map((q) => {
                    const ans = amap.get(q.id);
                    return (
                      <div key={q.id} className="px-5 py-3">
                        <p className="text-sm font-medium">{q.code} — {q.text}
                          {q.ownerId && <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{pname.get(q.ownerId) ?? "assigned"}</span>}
                        </p>
                        <form action={async (f: FormData) => { "use server"; await saveAnswer(id, q.id, String(f.get("value") ?? ""), String(f.get("comment") ?? "")); }} className="mt-2 flex flex-wrap items-center gap-2">
                          <input name="value" defaultValue={typeof ans?.value === "string" ? ans.value : ""} placeholder={q.type === "yes_no" ? "yes / no" : "answer…"} className="min-w-52 flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
                          <input name="comment" defaultValue={ans?.comment ?? ""} placeholder="comment (optional)" className="min-w-52 flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
                          <button className="rounded-lg bg-emerald-900 px-3 py-1.5 text-xs font-semibold text-white">Save</button>
                          {q.requiredEvidence && <Badge status="high">evidence required</Badge>}
                        </form>
                      </div>
                    );
                  })}
                </div>
              </Card>
            ))}
          </div>
        </AppShell>
      );
    } catch (e) { /* fallthrough to demo */ }
  }
  return (
    <AppShell>
      <PageHeader title="IFRS S1/S2 Readiness — Q3 2026 (preview)" sub="Connect DATABASE_URL to run the live assessment workflow end-to-end." />
      <Card><DataTable columns={["Question", "Type", "Evidence"]} rows={[["GOV-01 — Board oversight defined?", "yes/no", "required"], ["MET-01 — Scope 1 by source?", "metric", "required"], ["EVI-01 — Attach supporting file", "evidence", "required"]]} /></Card>
    </AppShell>
  );
}
