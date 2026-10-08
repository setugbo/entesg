import { AppShell } from "@/components/app-shell";
import { PageHeader, Card, DataTable } from "@/components/ui";
import { db } from "@/db";
import * as s from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getSessionUser, assertTenant } from "@/lib/auth";
import { createRiskTreatment, postComment } from "@/server/records";
import { notFound } from "next/navigation";

export default async function RiskDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!db || !user?.organisationId) return notFound();
  let r;
  try {
    r = (await db.select().from(s.risks).where(eq(s.risks.id, id)).limit(1))[0];
    if (!r) return notFound();
    assertTenant(user, r.organisationId);
  } catch { return notFound(); }
  const assess = await db.select().from(s.riskAssessments).where(eq(s.riskAssessments.riskId, id)).orderBy(desc(s.riskAssessments.createdAt)).limit(5);
  const treats = await db.select().from(s.riskTreatments).where(eq(s.riskTreatments.riskId, id));
  const users = await db.select({ id: s.users.id, name: s.users.name }).from(s.users).limit(100);
  const latest = assess[0];

  return (
    <AppShell>
      <PageHeader title={r.title} sub={`${r.category ?? "—"} · Inherent ${latest?.inherentRisk ?? "—"} (L${latest?.likelihood ?? "?"}×I${latest?.impact ?? "?"}) · Residual ${latest?.residualRisk ?? "—"}`} />
      {r.description && <Card><p className="p-5 text-sm text-slate-700">{r.description}</p></Card>}
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card>
          <div className="border-b border-slate-100 px-5 py-3 text-sm font-bold">Assessments</div>
          <DataTable columns={["Likelihood", "Impact", "Inherent", "Residual", "At"]}
            rows={assess.map((a) => [String(a.likelihood ?? "—"), String(a.impact ?? "—"), String(a.inherentRisk ?? "—"), String(a.residualRisk ?? "—"), a.createdAt ? new Date(a.createdAt).toLocaleDateString() : "—"])} />
        </Card>
        <Card>
          <div className="border-b border-slate-100 px-5 py-3 text-sm font-bold">Treatments & actions ({treats.length})</div>
          <div className="space-y-2 p-5">
            <DataTable columns={["Action", "Status", "Due"]} rows={treats.map((t) => [t.action, (t.status ?? "open").replace(/_/g, " "), t.dueDate ?? "—"])} />
            <form action={async (f: FormData) => { "use server"; await createRiskTreatment(id, f); }} className="grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-2">
              <input name="action" required placeholder="Treatment action…" className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2" />
              <select name="ownerId" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="">Owner…</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              <input name="dueDate" type="date" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <div className="sm:col-span-2"><button className="rounded-lg bg-emerald-900 px-4 py-2 text-sm font-semibold text-white">Add treatment</button></div>
            </form>
          </div>
        </Card>
      </div>
      <Card>
        <div className="border-b border-slate-100 px-5 py-3 text-sm font-bold">Comments</div>
        <form action={async (f: FormData) => { "use server"; await postComment("risk", id, f); }} className="flex gap-2 p-5">
          <input name="body" required placeholder="Add a comment…" className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <button className="rounded-lg bg-emerald-900 px-4 py-2 text-sm font-semibold text-white">Post</button>
        </form>
      </Card>
    </AppShell>
  );
}
